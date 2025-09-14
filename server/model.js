require("dotenv").config();
const axios = require("axios");
const { HfInference } = require("@huggingface/inference");
const cheerio = require("cheerio");
const { ChromaClient } = require("chromadb");
const { v4: uuidv4 } = require("uuid");

// Initialize Hugging Face
const hf = new HfInference(process.env.HUGGINGFACE_API_KEY || "hf_dummy_key");

// Initialize ChromaDB
const chroma = new ChromaClient({
    path: "http://localhost:8000",
});

const BATCH_SIZE = 10; // Smaller batch for news articles
const newsCollectionName = "news_corpus";

// Function to clean text content
function cleanText(text) {
    if (!text) return "";

    return text
        .replace(/<[^>]*>/g, "") // Remove HTML tags
        .replace(/&[^;]+;/g, " ") // Remove HTML entities
        .replace(/\s+/g, " ") // Replace multiple spaces with single space
        .replace(/[^\w\s.,!?;:'"()-]/g, "") // Remove special characters except basic punctuation
        .replace(
            /To play this video you need to enable JavaScript in your browser\./g,
            ""
        )
        .replace(/This video can not be played/g, "")
        .replace(/Media caption/g, "")
        .replace(/\s+/g, " ") // Clean up extra spaces again
        .trim();
}

// RSS feeds for news collection - Reliable global news sources
const RSS_FEEDS = [
    // Major Global News Sources (Most Reliable)
    "https://feeds.bbci.co.uk/news/rss.xml", // BBC News - Very Reliable
    "https://rss.cnn.com/rss/edition.rss", // CNN International
    "https://feeds.reuters.com/reuters/topNews", // Reuters - Global news
    "https://feeds.npr.org/1001/rss.xml", // NPR News
    "https://feeds.abcnews.com/abcnews/topstories", // ABC News
    "https://feeds.cbsnews.com/CBSNewsMain", // CBS News
    "https://feeds.nbcnews.com/nbcnews/public/news", // NBC News

    // Tech News Sources (Reliable Tech)
    "https://feeds.feedburner.com/techcrunch/startups", // TechCrunch
    "https://feeds.feedburner.com/arstechnica/index/", // Ars Technica
    "https://feeds.feedburner.com/venturebeat/SZYF", // VentureBeat

    // Alternative Reliable Sources
    "https://feeds.feedburner.com/theguardian/technology", // Guardian Tech
    "https://feeds.feedburner.com/wired/index", // Wired Magazine
    "https://feeds.feedburner.com/businessinsider", // Business Insider

    // Fallback Sources (More Accessible)
    "https://feeds.feedburner.com/ndtvnews-top-stories", // NDTV News
    "https://feeds.feedburner.com/oreilly/radar", // O'Reilly Radar
    "https://feeds.feedburner.com/forbes/innovation", // Forbes Innovation
];

// Function to get embeddings from Hugging Face
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

const embeddingFunction = {
    generate: async (texts) => {
        return await getHFEmbeddings(texts);
    },
};

// Create or get the collection for news data
async function getNewsCollection() {
    return await chroma.getOrCreateCollection({
        name: newsCollectionName,
        embeddingFunction: embeddingFunction,
    });
}

async function storeConversationHistory(question, answer) {
    const collection = await getConversationCollection();
    const documentId = `conversation_${new Date().toISOString()}`;

    const cleanQuestion = cleanText(question);
    const cleanAnswer = cleanText(answer);

    await collection.add({
        ids: [documentId],
        documents: [`Question: ${cleanQuestion} Answer: ${cleanAnswer}`],
        metadatas: [{ timestamp: new Date().toISOString() }],
    });

    console.log("Stored conversation in ChromaDB.");
}

async function getConversationHistory() {
    const collection = await getConversationCollection();

    // Retrieve all documents from the collection along with their metadata
    const allData = await collection.get();

    // Extract documents, ids, and metadata
    const allDocuments = allData.documents;

    // Process each document
    const conversationHistory = allDocuments.map((document) => {
        // Assuming the format in the document is "Question: ... Answer: ..."
        const [questionPart, answerPart] = document.split(" Answer: ");
        const question = questionPart.replace("Question: ", "").trim();
        const answer = answerPart.trim();

        return [
            { role: "user", content: question }, // The question asked by the user
            { role: "assistant", content: answer }, // The response from the assistant
        ];
    });

    // Flatten the array of arrays (since map returns nested arrays) to get a linear conversation flow
    const flattenedHistory = conversationHistory.flat();

    // Return the structured conversation history or a default message if none exists
    return flattenedHistory.length > 0
        ? flattenedHistory
        : [{ role: "assistant", content: "No prior conversation found." }];
}

// Function to fetch article content from URL
async function fetchArticleContent(url) {
    try {
        const response = await axios.get(url, {
            timeout: 5000,
            maxRedirects: 3,
        });

        const $ = cheerio.load(response.data);

        $(
            "script, style, noscript, .advertisement, .ad, .ads, .social-share, .comments, .error-message"
        ).remove();

        let articleContent = "";
        const selectors = [
            "article",
            ".article-content",
            ".story-body",
            "main",
            ".content",
            ".post-content",
            ".entry-content",
        ];

        for (const selector of selectors) {
            const content = $(selector).first();
            if (content.length > 0) {
                articleContent = content.text().trim();
                if (articleContent.length > 50) break;
            }
        }

        if (!articleContent) {
            articleContent = $("body").text().trim();
        }

        // Clean the text using the cleanText function
        articleContent = cleanText(articleContent);

        return articleContent.substring(0, 1000);
    } catch (error) {
        console.error(`Error fetching content from ${url}:`, error.message);
        return null;
    }
}

// Function to parse RSS feed
async function parseRSSFeed(feedUrl) {
    try {
        const response = await axios.get(feedUrl, { timeout: 5000 });
        const $ = cheerio.load(response.data, { xmlMode: true });

        const articles = [];
        $("item").each((i, item) => {
            const $item = $(item);
            const title = cleanText($item.find("title").text());
            const link = $item.find("link").text().trim();
            const description = cleanText($item.find("description").text());
            const pubDate = $item.find("pubDate").text().trim();

            if (title && link && title.length > 10) {
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
}

// Main function to collect news articles and store them
async function collectAndStoreNews(collection) {
    console.log("Starting news collection...");
    const allArticles = [];

    for (let i = 0; i < RSS_FEEDS.length; i++) {
        const feedUrl = RSS_FEEDS[i];
        console.log(`Processing feed ${i + 1}/${RSS_FEEDS.length}: ${feedUrl}`);

        try {
            const articles = await parseRSSFeed(feedUrl);
            console.log(`Found ${articles.length} articles`);

            // Process first 20 articles from each feed for more diverse data (aiming for 100+ chunks)
            for (let j = 0; j < Math.min(20, articles.length); j++) {
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

    console.log(`Collected ${allArticles.length} articles`);

    // Store articles in ChromaDB
    if (allArticles.length > 0) {
        const result = await storeNewsInChromaDB(collection, allArticles);
        return result;
    }

    return { success: false, error: "No articles collected" };
}

// Function to split text into chunks
function splitIntoChunks(text, chunkSize, overlap = 100) {
    const chunks = [];
    let start = 0;

    while (start < text.length) {
        const end = start + chunkSize;
        let chunk = text.substring(start, end);

        // Try to end at a sentence boundary
        if (end < text.length) {
            const lastSentenceEnd = chunk.lastIndexOf(".");
            const lastQuestionEnd = chunk.lastIndexOf("?");
            const lastExclamationEnd = chunk.lastIndexOf("!");
            const lastEnd = Math.max(
                lastSentenceEnd,
                lastQuestionEnd,
                lastExclamationEnd
            );

            if (lastEnd > start + chunkSize * 0.5) {
                // Only if we don't lose too much content
                chunk = text.substring(start, start + lastEnd + 1);
            }
        }

        if (chunk.trim().length > 50) {
            chunks.push(chunk.trim());
        }
        start = start + chunk.length - overlap;
    }

    return chunks;
}

// Function to store news articles in ChromaDB
async function storeNewsInChromaDB(collection, articles) {
    console.log("Storing articles in ChromaDB...");

    try {
        let chunkId = 0;
        const documents = [];
        const metadatas = [];
        const ids = [];

        for (let articleIdx = 0; articleIdx < articles.length; articleIdx++) {
            const article = articles[articleIdx];

            // Clean the content before storing
            const cleanTitle = cleanText(article.title);
            const cleanContent = cleanText(article.content);
            const cleanDescription = cleanText(article.description || "");

            // Create clean full text for storage
            const fullText = `${cleanTitle}\n\n${cleanDescription}\n\n${cleanContent}`;

            // Split into smaller chunks for better variety (aiming for 100+ total chunks)
            const chunks = splitIntoChunks(fullText, 600, 60);

            for (let chunkIdx = 0; chunkIdx < chunks.length; chunkIdx++) {
                chunkId++;

                const metadata = {
                    title: cleanTitle,
                    source: article.source,
                    url: article.link,
                    date: article.pubDate || new Date().toISOString(),
                    description: cleanDescription,
                    chunk_index: chunkIdx,
                    total_chunks: chunks.length,
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

        console.log(
            `Stored ${documents.length} chunks from ${articles.length} articles`
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
}

// Function to ask questions about news data
async function askQuestionAboutNews(question) {
    try {
        const collection = await chroma.getCollection({
            name: newsCollectionName,
            embeddingFunction: embeddingFunction,
        });

        // Generate embeddings for the question
        const questionEmbedding = await embeddingFunction.generate([question]);

        const results = await collection.query({
            queryEmbeddings: questionEmbedding,
            nResults: 5, // Get more results for variety
            includeMetadata: true,
        });

        // Randomize results to get different chunks each time
        if (results.documents && results.documents.length > 0) {
            const shuffledDocs = results.documents[0].sort(
                () => Math.random() - 0.5
            );
            results.documents[0] = shuffledDocs;
        }

        if (!results.documents || results.documents.length === 0) {
            return "I couldn't find any relevant news articles for your question. Please try asking about recent news topics.";
        }

        // Clean the context before using it
        const rawContext = results.documents[0].join(" ");
        const cleanContext = cleanText(rawContext);
        console.log("Context:", cleanContext);

        // Format the response better
        const answer = `Based on the latest news, here's what I found:\n\n${cleanContext.substring(
            0,
            1000
        )}${cleanContext.length > 1000 ? "..." : ""}`;

        console.log("Question:", question);
        console.log("Answer:", answer);
        return answer;
    } catch (error) {
        console.error("Error asking question:", error);
        return "Sorry, I couldn't process your question at the moment.";
    }
}

// Function to collect and store news content
async function storeNewsContent() {
    try {
        let collection = await getNewsCollection();

        // Check if the collection already has data
        const collectionInfo = await collection.count();
        if (collectionInfo > 0) {
            console.log(
                "News data already exists in the collection. Skipping collection."
            );
            return {
                success: true,
                message: "Data already exists",
                articles: 0,
                chunks: collectionInfo,
            };
        }

        // Proceed to collect and store news articles
        const result = await collectAndStoreNews(collection);
        return result;
    } catch (error) {
        console.error("Error checking collection:", error);
        return { success: false, error: error.message };
    }
}

// Function to query news content
exports.queryNewsContent = async (question) => {
    console.log("Starting news query at " + new Date().toLocaleString());
    const answer = await askQuestionAboutNews(question);
    console.log("Completed news query at " + new Date().toLocaleString());
    return answer;
};

// Function to collect news data
exports.collectNewsData = async () => {
    console.log("Starting news collection at " + new Date().toLocaleString());
    const result = await storeNewsContent();
    console.log("Completed news collection at " + new Date().toLocaleString());
    return result;
};
