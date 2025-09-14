require("dotenv").config();
const path = require("path");
const axios = require("axios");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const urlParser = require("url");
const cheerio = require("cheerio");
const langdetect = require("langdetect");
const { ChromaClient } = require("chromadb");

// Initialize Google Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Initialize ChromaDB client - connect to local ChromaDB server
const chroma = new ChromaClient({
    path: "http://localhost:8000",
});

const BATCH_SIZE = 35;

const conversationCollectionName = "user_conversations";
const newsCollectionName = "news_corpus";

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

const embeddingFunction = {
    generate: async (texts) => {
        return await getGeminiEmbeddings(texts);
    },
};

// Create or get the collection for conversation history
async function getConversationCollection() {
    return await chroma.getOrCreateCollection({
        name: conversationCollectionName,
        embeddingFunction: embeddingFunction, // Assuming you're using an embedding function like before
    });
}

async function storeConversationHistory(question, answer) {
    const collection = await getConversationCollection();
    const documentId = `conversation_${new Date().toISOString()}`;

    await collection.add({
        ids: [documentId],
        documents: [`Question: ${question} Answer: ${answer}`],
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

// Helper function to check if a URL points to a file we want to ignore
function isUnwantedFileType(url) {
    // Common file extensions to ignore
    const unwantedExtensions = [
        // Documents
        ".pdf",
        ".doc",
        ".docx",
        ".xls",
        ".xlsx",
        ".ppt",
        ".pptx",
        ".odt",
        ".ods",
        ".odp",
        // Archives
        ".zip",
        ".rar",
        ".7z",
        ".tar",
        ".gz",
        // Images
        ".jpg",
        ".jpeg",
        ".png",
        ".gif",
        ".svg",
        ".webp",
        ".bmp",
        // Audio/Video
        ".mp3",
        ".mp4",
        ".wav",
        ".avi",
        ".mov",
        ".wmv",
        // Other
        ".exe",
        ".dmg",
        ".iso",
        ".csv",
        ".xml",
        ".json",
        // E-books
        ".epub",
        ".mobi",
        ".azw",
        // Code files
        ".js",
        ".css",
        ".php",
        ".py",
        ".java",
        ".cpp",
    ];

    const urlLower = url.toLowerCase();
    return unwantedExtensions.some((ext) => urlLower.endsWith(ext));
}

// Main function to scrape the entire website and store each page's data incrementally
async function scrapeAndStoreWebsite(baseUrl, collection) {
    const visitedUrls = new Set();
    const queue = [baseUrl];
    let chunkId = 0; // Initialize the chunkId
    const allChunks = []; // Array to hold chunks before batching

    console.log(
        "scrapping the website ----------------->>>>>>>>>>>>>>>>>>>>>>>>> "
    );

    while (queue.length > 0) {
        const url = queue.shift();
        console.log(
            "Inside while loop ----------------->>>>>>>>>>>>>>>>>>>>>>>>> "
        );

        if (!visitedUrls.has(url) && !isUnwantedFileType(url)) {
            const { content, newUrls } = await scrapePage(url, baseUrl);
            if (content) {
                const chunks = splitIntoChunks(content, 2000);
                chunks.forEach((chunk, index) => {
                    chunkId++; // Increment chunkId after each chunk
                    allChunks.push({
                        id: `chunk_${chunkId}`, // Combine chunkId with index for uniqueness
                        document: chunk,
                        metadata: {
                            source: url,
                            chunk_size: chunk.length,
                        },
                    });
                });

                // If we have reached the batch size, store the chunks in ChromaDB
                if (allChunks.length >= BATCH_SIZE) {
                    await storeChunksInChromaDB(collection, allChunks);
                    await new Promise((resolve) => setTimeout(resolve, 25000));
                    allChunks.length = 0; // Clear the array after storing
                }
            }

            visitedUrls.add(url);
            // Filter out unwanted file types from new URLs before adding to queue
            const filteredUrls = newUrls.filter(
                (newUrl) =>
                    !visitedUrls.has(newUrl) && !isUnwantedFileType(newUrl)
            );
            queue.push(...filteredUrls);
        }
    }

    // Store any remaining chunks that are less than the batch size
    if (allChunks.length > 0) {
        await storeChunksInChromaDB(collection, allChunks);
    }
}

// Function to scrape a single page
async function scrapePage(url, baseUrl) {
    try {
        console.log("scrapping this url " + url);
        const { data } = await axios.get(url);
        const $ = cheerio.load(data);

        // Remove unwanted elements
        $("script, style, noscript").remove();

        // Extract visible text from the body
        let content = $("body").text();
        content = content
            .replace(/\s\s+/g, " ")
            .replace(/\*/g, "")
            .replace(/-/g, "")
            .replace(/[^\x20-\x7E\s]/g, "")
            .trim();

        // Use franc or langdetect to check the language
        const langCode = langdetect.detect(content)[0].lang;

        if (langCode === "en") {
            // Proceed with English content
            console.log("Detected English content.");

            // Find all internal links
            const newUrls = $("a")
                .map((i, link) => $(link).attr("href"))
                .get()
                .filter((href) => href)
                .map((href) => resolveUrl(href, url))
                .filter((fullUrl) => isInternalUrl(fullUrl, baseUrl));
            return { content, newUrls };
        } else {
            console.log(`Non-English content detected on ${url}, skipping...`);
            return { content: null, newUrls: [] };
        }

        // return { content, newUrls };
    } catch (error) {
        console.error(`Error scraping ${url}: ${error.message}`);
        return { content: null, newUrls: [] };
    }
}

// Helper function to resolve relative URLs
function resolveUrl(href, baseUrl) {
    return urlParser.resolve(baseUrl, href);
}

// Helper function to check if a URL is internal
function isInternalUrl(url, baseUrl) {
    const parsedBaseUrl = urlParser.parse(baseUrl);
    const parsedUrl = urlParser.parse(url);
    return parsedBaseUrl.hostname === parsedUrl.hostname;
}

// Step 2: Store page data incrementally in ChromaDB
async function storeChunksInChromaDB(collection, chunks) {
    try {
        await collection.add({
            ids: chunks.map((chunk) => chunk.id),
            documents: chunks.map((chunk) => chunk.document),
            metadatas: chunks.map((chunk) => chunk.metadata),
        });
        console.log(`Stored ${chunks.length} chunks in ChromaDB.`);
    } catch (error) {
        console.error("Error storing chunks in ChromaDB:", error);
    }
}

// Helper function to split content into chunks
function splitIntoChunks(text, chunkSize) {
    const chunks = [];
    for (let i = 0; i < text.length; i += chunkSize) {
        chunks.push(text.slice(i, i + chunkSize));
    }
    return chunks;
}

// Step 3: Ask questions based on the website data stored in ChromaDB
async function askQuestionAboutWebsite(collectionName, question) {
    try {
        const conversationHistory = await getConversationHistory();

        const collection = await chroma.getCollection({
            name: collectionName,
            embeddingFunction: embeddingFunction,
        });

        // Generate embeddings for the question
        const questionEmbedding = await embeddingFunction.generate([question]);

        const results = await collection.query({
            queryEmbeddings: questionEmbedding,
            nResults: 5,
            includeMetadata: true,
            includeEmbeddings: true,
            include: ["embeddings", "documents", "metadatas", "distances"],
        });

        console.log("Results");
        console.log(results);

        const context = results.documents[0].join(" ");
        console.log(context);

        // Use Gemini for final answer
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });

        const prompt = `You are a helpful news assistant. Answer questions based on the provided news context and conversation history.

Context from news articles:
${context}

Conversation history:
${conversationHistory.map((msg) => `${msg.role}: ${msg.content}`).join("\n")}

Question: ${question}

Instructions:
1. Answer based on the news context provided
2. If information is not available in the context, say "I don't have information about that in my news corpus"
3. Keep responses professional and concise
4. Maintain consistency with previous responses
5. Focus on news-related information

Answer:`;

        const result = await model.generateContent(prompt);
        const answer = result.response.text();

        // Call the storeConversationHistory function here
        await storeConversationHistory(question, answer);

        console.log("Question:", question);
        console.log("Answer:", answer);
        return answer;
    } catch (error) {
        console.error("Error asking question:", error);
    }
}

// Function to scrape and store website content incrementally
async function storeWebsiteContent(url, collectionName) {
    try {
        let collection = await chroma.getOrCreateCollection({
            name: collectionName,
            embeddingFunction: embeddingFunction,
        });

        // Check if the collection already has data
        const collectionInfo = await collection.count();
        if (collectionInfo > 0) {
            console.log(
                "Data already exists in the collection. Skipping scraping."
            );
            return; // Skip scraping if data already exists
        }

        // Proceed to scrape and store each page incrementally
        await scrapeAndStoreWebsite(url, collection);
    } catch (error) {
        console.error("Error checking collection:", error);
    }
}

// Function to query news articles specifically
async function queryNewsArticles(question) {
    try {
        console.log("Querying news articles...");

        // Get conversation history
        const conversationHistory = await getConversationHistory();

        // Try to get the collection, create it if it doesn't exist
        let collection;
        try {
            collection = await chroma.getCollection({
                name: newsCollectionName,
                embeddingFunction: embeddingFunction,
            });
        } catch (error) {
            console.log("Collection doesn't exist, creating it...");
            collection = await chroma.createCollection({
                name: newsCollectionName,
                embeddingFunction: embeddingFunction,
            });
        }

        // Check if collection is empty
        const collectionCount = await collection.count();
        if (collectionCount === 0) {
            return "I don't have any news articles in my database yet. Please run the news collection script first to populate the database with news articles.";
        }

        // Generate embeddings for the question
        const questionEmbedding = await embeddingFunction.generate([question]);

        const results = await collection.query({
            queryEmbeddings: questionEmbedding,
            nResults: 5,
            includeMetadata: true,
            includeEmbeddings: true,
            include: ["embeddings", "documents", "metadatas", "distances"],
        });

        console.log("News query results:", results);

        const context = results.documents[0].join(" ");
        console.log("Context:", context);

        // Use Gemini for final answer
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });

        const prompt = `You are a helpful news assistant. Answer questions based on the provided news context and conversation history.

Context from news articles:
${context}

Conversation history:
${conversationHistory.map((msg) => `${msg.role}: ${msg.content}`).join("\n")}

Question: ${question}

Instructions:
1. Answer based on the news context provided
2. If information is not available in the context, say "I don't have information about that in my news corpus"
3. Keep responses professional and concise
4. Maintain consistency with previous responses
5. Focus on news-related information

Answer:`;

        const result = await model.generateContent(prompt);
        const answer = result.response.text();

        // Store conversation
        await storeConversationHistory(question, answer);

        console.log("Question:", question);
        console.log("Answer:", answer);
        return answer;
    } catch (error) {
        console.error("Error querying news articles:", error);
        throw error;
    }
}

// Function to query stored content (can be run multiple times)
exports.queryStoredContent = async (websiteUrl, collectionName, question) => {
    console.log("Starting 1 " + new Date().toLocaleString());
    await storeWebsiteContent(websiteUrl, collectionName);
    const answer = await askQuestionAboutWebsite(collectionName, question);
    console.log("Starting 2 " + new Date().toLocaleString());
    return answer;
};

// Export the news query function
exports.queryNewsArticles = queryNewsArticles;
