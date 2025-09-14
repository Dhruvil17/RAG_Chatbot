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

// RSS feeds for news collection
const RSS_FEEDS = [
    "https://feeds.bbci.co.uk/news/rss.xml",
    "https://rss.cnn.com/rss/edition.rss",
    "https://feeds.a.dj.com/rss/RSSWorldNews.xml",
    "https://feeds.reuters.com/reuters/topNews",
    "https://feeds.npr.org/1001/rss.xml",
];

// async function resolveCoreference(currentQuestion, conversationHistory) {
//     try {
//         // Extract all previous messages to build context
//         const previousQuestions = conversationHistory.filter((msg) => msg.role === "user").map((msg) => msg.content);

//         // Simply join all previous questions for context
//         const conversationFlow = previousQuestions.join("\n");

//         const prompt = `
//         Given this conversation flow:
//         ${conversationFlow}

//         Current question: "${currentQuestion}"

//         Task: Analyze the current question and resolve any pronouns or unclear references based on the conversation context. Return the fully resolved version of the current question with all specific details.

//         Rules:
//         1. Resolve pronouns (it, they, this, etc.) based on the most recently discussed items
//         2. Keep the question natural and grammatically correct
//         3. Only return the resolved question
//         4. If no resolution is needed, return the original question unchanged`;

//         const completion = await openai.chat.completions.create({
//             model: "gpt-4",
//             messages: [
//                 {
//                     role: "system",
//                     content: "You are a context-aware reference resolution system. Your task is to maintain conversation context and resolve unclear references while keeping the language natural.",
//                 },
//                 {
//                     role: "user",
//                     content: prompt,
//                 },
//             ],
//             temperature: 0.1,
//         });

//         const resolvedQuestion = completion.choices[0].message.content.trim();

//         return resolvedQuestion;
//     } catch (error) {
//         console.error("Error in context-aware resolution:", error);
//         return currentQuestion;
//     }
// }

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

// Function to fetch article content from URL
async function fetchArticleContent(url) {
    try {
        const response = await axios.get(url, {
            timeout: 5000,
            maxRedirects: 3,
        });

        const $ = cheerio.load(response.data);
        $("script, style").remove();

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

        if (!articleContent) {
            articleContent = $("body").text().trim();
        }

        articleContent = articleContent.replace(/\s+/g, " ").trim();
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
            const title = $item.find("title").text().trim();
            const link = $item.find("link").text().trim();
            const description = $item.find("description").text().trim();
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

            // Process first 10 articles from each feed
            for (let j = 0; j < Math.min(10, articles.length); j++) {
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
        const chunk = text.substring(start, end);
        if (chunk.trim().length > 50) {
            chunks.push(chunk.trim());
        }
        start = end - overlap;
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
            const fullText = `${article.title}\n\n${article.content}`;

            // Split into chunks
            const chunks = splitIntoChunks(fullText, 800, 80);

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
            nResults: 5,
            includeMetadata: true,
        });

        const context = results.documents[0].join(" ");
        console.log("Context:", context);

        // For now, return a simple response based on the context
        // You can integrate with Gemini API here later
        const answer = `Based on the latest news, here's what I found:\n\n${context.substring(
            0,
            500
        )}...`;

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
