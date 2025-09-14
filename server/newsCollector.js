require("dotenv").config();
const axios = require("axios");
const cheerio = require("cheerio");
const { HfInference } = require("@huggingface/inference");
const { ChromaClient } = require("chromadb");
const { v4: uuidv4 } = require("uuid");

// Initialize Hugging Face with better error handling
const hf = new HfInference(process.env.HUGGINGFACE_API_KEY || "hf_dummy_key");

// Initialize ChromaDB client
const chroma = new ChromaClient({
    path: "http://localhost:8000",
});

const BATCH_SIZE = 3; // Smaller batches for t2.micro
const newsCollectionName = "news_corpus";

// Updated RSS feeds - replaced problematic Reuters feed
const RSS_FEEDS = [
    "https://feeds.bbci.co.uk/news/rss.xml",
    "https://rss.cnn.com/rss/edition.rss",
    "https://feeds.a.dj.com/rss/RSSWorldNews.xml", // Wall Street Journal instead of Reuters
];

// Simple embedding function
const getHFEmbeddings = async (texts) => {
    try {
        const model = "sentence-transformers/all-MiniLM-L6-v2";

        const embeddings = await Promise.all(
            texts.map(async (text) => {
                try {
                    const result = await hf.featureExtraction({
                        model: model,
                        inputs: text.substring(0, 500),
                    });
                    return result;
                } catch (error) {
                    return new Array(384).fill(0);
                }
            })
        );

        return embeddings;
    } catch (error) {
        console.error("Error getting embeddings:", error.message);
        return texts.map(() => new Array(384).fill(0));
    }
};

// Custom embedding function for ChromaDB
const embeddingFunction = {
    generate: async (texts) => {
        return await getHFEmbeddings(texts);
    },
};

// Simple content extraction
const fetchArticleContent = async (url) => {
    try {
        const response = await axios.get(url, {
            timeout: 5000,
            maxRedirects: 3,
        });

        const $ = cheerio.load(response.data);

        // Remove script and style elements
        $("script, style").remove();

        // Try to find article content
        let articleContent = "";
        const selectors = [
            "article",
            ".article-content",
            ".story-body",
            "main",
        ];

        for (const selector of selectors) {
            const content = $(selector).first();
            if (content.length > 0) {
                articleContent = content.text().trim();
                if (articleContent.length > 50) break;
            }
        }

        // If no article content found, get body text
        if (!articleContent) {
            articleContent = $("body").text().trim();
        }

        // Clean up content
        articleContent = articleContent.replace(/\s+/g, " ").trim();
        return articleContent.substring(0, 1000);
    } catch (error) {
        console.error(`Error fetching content from ${url}:`, error.message);
        return null;
    }
};

// Simple RSS parsing
const parseRSSFeed = async (feedUrl) => {
    try {
        const response = await axios.get(feedUrl, { timeout: 5000 });

        const $ = cheerio.load(response.data, { xmlMode: true });

        const articles = [];

        $("item").each((index, element) => {
            const $item = $(element);

            const title = $item.find("title").text().trim();
            const link = $item.find("link").text().trim();
            const description = $item.find("description").text().trim();
            const pubDate = $item.find("pubDate").text().trim();

            if (title && link && title.length > 10) {
                // Ensure meaningful title
                articles.push({
                    title,
                    link,
                    description,
                    pubDate,
                    source: feedUrl,
                });
            }
        });

        return articles;
    } catch (error) {
        console.error(`Error parsing RSS feed ${feedUrl}:`, error.message);
        return [];
    }
};

// Simplified chunking for t2.micro
const chunkText = (text, chunkSize = 800, overlap = 80) => {
    const chunks = [];
    let start = 0;

    while (start < text.length) {
        const end = start + chunkSize;
        const chunk = text.substring(start, end);
        if (chunk.trim().length > 50) {
            // Only add meaningful chunks
            chunks.push(chunk.trim());
        }
        start = end - overlap;
    }

    return chunks;
};

// Simple news collection
const collectNewsFromRSS = async () => {
    console.log("Starting RSS news collection...");

    const allArticles = [];

    for (let i = 0; i < RSS_FEEDS.length; i++) {
        const feedUrl = RSS_FEEDS[i];
        console.log(
            `\n[${i + 1}/${RSS_FEEDS.length}] Fetching from: ${feedUrl}`
        );

        try {
            const articles = await parseRSSFeed(feedUrl);

            console.log(`Found ${articles.length} articles`);

            // Process first 2 articles from each feed
            for (let j = 0; j < Math.min(2, articles.length); j++) {
                const article = articles[j];
                const content = await fetchArticleContent(article.link);

                if (content && content.length > 50) {
                    allArticles.push({
                        ...article,
                        content,
                        id: uuidv4(),
                    });
                }

                await new Promise((resolve) => setTimeout(resolve, 1000));
            }

            await new Promise((resolve) => setTimeout(resolve, 2000));
        } catch (error) {
            console.error(`Error fetching feed ${feedUrl}:`, error.message);
        }
    }

    return allArticles;
};

// Simple ChromaDB storage
const storeArticlesInChromaDB = async (articles) => {
    console.log("Storing articles in ChromaDB...");

    try {
        // Get or create collection
        const collection = await chroma.getOrCreateCollection({
            name: newsCollectionName,
            embeddingFunction: embeddingFunction,
            metadata: { "hnsw:space": "cosine" },
        });

        let chunkId = 0;
        const documents = [];
        const metadatas = [];
        const ids = [];

        for (let articleIdx = 0; articleIdx < articles.length; articleIdx++) {
            const article = articles[articleIdx];

            // Combine title and content for better context
            const fullText = `${article.title}\n\n${article.content}`;

            // Split into chunks
            const chunks = chunkText(fullText, 800, 80);

            for (let chunkIdx = 0; chunkIdx < chunks.length; chunkIdx++) {
                chunkId++;

                const metadata = {
                    title: article.title,
                    source: article.source,
                    url: article.link,
                    date: article.pubDate || new Date().toISOString(),
                    description: article.description || "",
                    chunk_index: chunkIdx,
                    total_chunks: chunks.length,
                    article_index: articleIdx,
                    article_id: article.id,
                };

                documents.push(chunks[chunkIdx]);
                metadatas.push(metadata);
                ids.push(`news_${Date.now()}_${articleIdx}_${chunkIdx}`);
            }
        }

        // Store in ChromaDB in batches
        for (let i = 0; i < documents.length; i += BATCH_SIZE) {
            const batchDocs = documents.slice(i, i + BATCH_SIZE);
            const batchMetas = metadatas.slice(i, i + BATCH_SIZE);
            const batchIds = ids.slice(i, i + BATCH_SIZE);

            await collection.add({
                documents: batchDocs,
                metadatas: batchMetas,
                ids: batchIds,
            });

            await new Promise((resolve) => setTimeout(resolve, 2000));
        }

        console.log(`Stored ${documents.length} chunks from ${articles.length} articles`);
        return {
            success: true,
            chunks: documents.length,
            articles: articles.length,
        };
    } catch (error) {
        console.error("Error storing articles in ChromaDB:", error);
        return { success: false, error: error.message };
    }
};

// Get collection stats
const getCollectionStats = async () => {
    try {
        const collection = await chroma.getCollection({
            name: newsCollectionName,
            embeddingFunction: embeddingFunction,
        });

        const count = await collection.count();
        return { success: true, count };
    } catch (error) {
        console.error("Error getting collection stats:", error);
        return { success: false, error: error.message };
    }
};

// Main function
const collectAndStoreNews = async () => {
    console.log("=== News Collection and Storage ===");

    try {
        // Collect articles
        const articles = await collectNewsFromRSS();

        if (articles.length === 0) {
            console.log("No articles collected");
            return { success: false, message: "No articles collected" };
        }

        console.log(`Collected ${articles.length} articles`);

        // Store in ChromaDB
        const result = await storeArticlesInChromaDB(articles);

        if (result.success) {
            console.log("Collection completed successfully!");
            return { success: true, ...result };
        } else {
            console.log(`Collection failed: ${result.error}`);
            return result;
        }
    } catch (error) {
        console.error("Error in collectAndStoreNews:", error);
        return { success: false, error: error.message };
    }
};

module.exports = {
    collectAndStoreNews,
    getCollectionStats,
    getHFEmbeddings,
    embeddingFunction,
};
