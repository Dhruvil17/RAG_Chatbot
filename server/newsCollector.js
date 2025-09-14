require("dotenv").config();
const axios = require("axios");
const cheerio = require("cheerio");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { ChromaClient } = require("chromadb");
const { v4: uuidv4 } = require("uuid");

// Initialize Google Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Initialize ChromaDB client
const chroma = new ChromaClient({
    path: "http://localhost:8000",
});

const BATCH_SIZE = 10; // Process in smaller batches for better performance
const newsCollectionName = "news_corpus";

// RSS feeds for news collection
const RSS_FEEDS = [
    "https://feeds.bbci.co.uk/news/rss.xml",
    "https://rss.cnn.com/rss/edition.rss",
    "https://feeds.reuters.com/reuters/topNews",
    "https://feeds.npr.org/1001/rss.xml",
    "https://feeds.washingtonpost.com/rss/world",
    "https://feeds.skynews.com/feeds/rss/world.xml",
    "https://feeds.foxnews.com/foxnews/world",
    "https://feeds.cbsnews.com/CBSNewsWorld",
    "https://feeds.nbcnews.com/nbcnews/public/world",
    "https://feeds.abcnews.com/abcnews/internationalheadlines",
];

// Function to get embeddings from Google Gemini
const getGeminiEmbeddings = async (texts) => {
    try {
        const model = genAI.getGenerativeModel({ model: "embedding-001" });
        const embeddings = await Promise.all(
            texts.map(async (text) => {
                const result = await model.embedContent(text);
                return result.embedding.values;
            })
        );
        return embeddings;
    } catch (error) {
        console.error("Error getting Gemini embeddings:", error);
        throw error;
    }
};

// Custom embedding function for ChromaDB
const embeddingFunction = {
    generate: async (texts) => {
        return await getGeminiEmbeddings(texts);
    },
};

// Function to fetch article content from URL
const fetchArticleContent = async (url) => {
    try {
        const headers = {
            "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        };

        const response = await axios.get(url, {
            headers,
            timeout: 10000,
            maxRedirects: 5,
        });

        const $ = cheerio.load(response.data);

        // Remove script and style elements
        $("script, style").remove();

        // Try to find article content
        let articleContent = "";

        // Common article selectors
        const selectors = [
            "article",
            ".article-content",
            ".story-body",
            ".entry-content",
            ".post-content",
            "main",
            ".content",
            ".article-text",
        ];

        for (const selector of selectors) {
            const content = $(selector).first();
            if (content.length > 0) {
                articleContent = content.text().trim();
                break;
            }
        }

        // If no specific article content found, get body text
        if (!articleContent) {
            const body = $("body");
            if (body.length > 0) {
                articleContent = body.text().trim();
            }
        }

        // Clean up the content
        articleContent = articleContent.replace(/\s+/g, " ").trim();

        return articleContent.substring(0, 5000); // Limit to 5000 characters
    } catch (error) {
        console.error(`Error fetching content from ${url}:`, error.message);
        return null;
    }
};

// Function to parse RSS feed
const parseRSSFeed = async (feedUrl) => {
    try {
        const response = await axios.get(feedUrl, { timeout: 10000 });
        const $ = cheerio.load(response.data, { xmlMode: true });

        const articles = [];

        $("item").each((index, element) => {
            const $item = $(element);

            const title = $item.find("title").text().trim();
            const link = $item.find("link").text().trim();
            const description = $item.find("description").text().trim();
            const pubDate = $item.find("pubDate").text().trim();

            if (title && link) {
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

// Function to chunk text
const chunkText = (text, chunkSize = 2000, overlap = 200) => {
    const chunks = [];
    let start = 0;

    while (start < text.length) {
        const end = start + chunkSize;
        const chunk = text.substring(start, end);
        chunks.push(chunk);
        start = end - overlap;
    }

    return chunks;
};

// Function to collect news from RSS feeds
const collectNewsFromRSS = async () => {
    console.log("Starting RSS news collection...");
    console.log(`Target feeds: ${RSS_FEEDS.length}`);

    const allArticles = [];

    for (let i = 0; i < RSS_FEEDS.length; i++) {
        const feedUrl = RSS_FEEDS[i];
        console.log(
            `\n[${i + 1}/${RSS_FEEDS.length}] Fetching from: ${feedUrl}`
        );

        try {
            const articles = await parseRSSFeed(feedUrl);
            console.log(`✓ Found ${articles.length} articles`);

            // Process first 5 articles from each feed
            for (let j = 0; j < Math.min(5, articles.length); j++) {
                const article = articles[j];
                console.log(`  Fetching: ${article.title.substring(0, 50)}...`);

                const content = await fetchArticleContent(article.link);

                if (content && content.length > 100) {
                    allArticles.push({
                        ...article,
                        content,
                        id: uuidv4(),
                    });
                    console.log(
                        `  ✓ Collected: ${article.title.substring(0, 50)}...`
                    );
                } else {
                    console.log(
                        `  ✗ Insufficient content: ${article.title.substring(
                            0,
                            50
                        )}...`
                    );
                }

                // Be respectful with delays
                await new Promise((resolve) => setTimeout(resolve, 1000));
            }

            console.log(`✓ Processed feed: ${feedUrl}`);
            await new Promise((resolve) => setTimeout(resolve, 2000)); // Delay between feeds
        } catch (error) {
            console.error(`✗ Error fetching feed ${feedUrl}:`, error.message);
            continue;
        }
    }

    return allArticles;
};

// Function to store articles in ChromaDB
const storeArticlesInChromaDB = async (articles) => {
    console.log("\nStoring articles in ChromaDB...");

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
            const chunks = chunkText(fullText, 2000, 200);

            for (let chunkIdx = 0; chunkIdx < chunks.length; chunkIdx++) {
                chunkId++;

                // Create metadata for each chunk
                const metadata = {
                    title: article.title,
                    source: article.source,
                    url: article.link,
                    date: article.pubDate,
                    description: article.description,
                    chunk_index: chunkIdx,
                    total_chunks: chunks.length,
                    article_index: articleIdx,
                    article_id: article.id,
                };

                documents.push(chunks[chunkIdx]);
                metadatas.push(metadata);
                ids.push(`news_${articleIdx}_${chunkIdx}`);
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

            console.log(
                `✓ Stored batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(
                    documents.length / BATCH_SIZE
                )}`
            );
        }

        console.log(
            `✓ Stored ${documents.length} chunks from ${articles.length} articles`
        );
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

// Function to get collection stats
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

// Main function to collect and store news
const collectAndStoreNews = async () => {
    console.log("=== News Collection and Storage ===");
    console.log(`Started at: ${new Date().toISOString()}`);

    try {
        // Collect articles
        const articles = await collectNewsFromRSS();

        if (articles.length === 0) {
            console.log("No articles collected. Exiting.");
            return { success: false, message: "No articles collected" };
        }

        console.log(`\nCollected ${articles.length} articles`);

        // Store in ChromaDB
        const result = await storeArticlesInChromaDB(articles);

        if (result.success) {
            console.log(`\n=== Collection Complete ===`);
            console.log(`Articles: ${result.articles}`);
            console.log(`Chunks: ${result.chunks}`);
            console.log(`Collection name: ${newsCollectionName}`);
            console.log(`Completed at: ${new Date().toISOString()}`);

            // Get final stats
            const stats = await getCollectionStats();
            if (stats.success) {
                console.log(`Total documents in collection: ${stats.count}`);
            }

            return { success: true, ...result };
        } else {
            console.log(`\n=== Collection Failed ===`);
            console.log(`Error: ${result.error}`);
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
    getGeminiEmbeddings,
    embeddingFunction,
};
