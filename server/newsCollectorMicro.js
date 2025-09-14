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

const BATCH_SIZE = 5; // Smaller batches for t2.micro
const newsCollectionName = "news_corpus";

// Reduced RSS feeds for t2.micro (5 instead of 10)
const RSS_FEEDS = [
    "https://feeds.bbci.co.uk/news/rss.xml",
    "https://rss.cnn.com/rss/edition.rss",
    "https://feeds.reuters.com/reuters/topNews",
    "https://feeds.npr.org/1001/rss.xml",
    "https://feeds.washingtonpost.com/rss/world",
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

// Simplified content extraction for t2.micro
const fetchArticleContent = async (url) => {
    try {
        const headers = {
            "User-Agent": "Mozilla/5.0 (compatible; NewsBot/1.0)",
        };

        const response = await axios.get(url, {
            headers,
            timeout: 5000, // Shorter timeout
            maxRedirects: 3,
        });

        const $ = cheerio.load(response.data);

        // Remove script and style elements
        $("script, style").remove();

        // Try to find article content
        let articleContent = "";

        // Simplified selectors for faster processing
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

        // Clean up and limit content for t2.micro
        articleContent = articleContent.replace(/\s+/g, " ").trim();

        return articleContent.substring(0, 2000); // Reduced from 5000 to 2000
    } catch (error) {
        console.error(`Error fetching content from ${url}:`, error.message);
        return null;
    }
};

// Function to parse RSS feed
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

// Simplified chunking for t2.micro
const chunkText = (text, chunkSize = 1000, overlap = 100) => {
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

// Collect news from RSS feeds (optimized for t2.micro)
const collectNewsFromRSS = async () => {
    console.log("Starting RSS news collection (t2.micro optimized)...");
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

            // Process only first 3 articles from each feed (reduced from 5)
            for (let j = 0; j < Math.min(3, articles.length); j++) {
                const article = articles[j];
                console.log(`  Fetching: ${article.title.substring(0, 40)}...`);

                const content = await fetchArticleContent(article.link);

                if (content && content.length > 50) {
                    // Reduced minimum length
                    allArticles.push({
                        ...article,
                        content,
                        id: uuidv4(),
                    });
                    console.log(
                        `  ✓ Collected: ${article.title.substring(0, 40)}...`
                    );
                } else {
                    console.log(
                        `  ✗ Insufficient content: ${article.title.substring(
                            0,
                            40
                        )}...`
                    );
                }

                // Shorter delay for t2.micro
                await new Promise((resolve) => setTimeout(resolve, 500));
            }

            console.log(`✓ Processed feed: ${feedUrl}`);
            await new Promise((resolve) => setTimeout(resolve, 1000)); // Reduced delay
        } catch (error) {
            console.error(`✗ Error fetching feed ${feedUrl}:`, error.message);
            continue;
        }
    }

    return allArticles;
};

// Store articles in ChromaDB (optimized for t2.micro)
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

            // Split into smaller chunks for t2.micro
            const chunks = chunkText(fullText, 1000, 100);

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

        // Store in ChromaDB in smaller batches
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

            // Add delay between batches for t2.micro
            await new Promise((resolve) => setTimeout(resolve, 1000));
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

// Main function to collect and store news (t2.micro optimized)
const collectAndStoreNews = async () => {
    console.log("=== News Collection and Storage (t2.micro) ===");
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
