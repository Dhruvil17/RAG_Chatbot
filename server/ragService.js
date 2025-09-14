require("dotenv").config();
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { ChromaClient } = require("chromadb");
const { getGeminiEmbeddings, embeddingFunction } = require("./newsCollector");

// Initialize Google Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Initialize ChromaDB client
const chroma = new ChromaClient({
    path: "http://localhost:8000",
});

const newsCollectionName = "news_corpus";
const conversationCollectionName = "user_conversations";

class RAGService {
    constructor() {
        this.chroma = chroma;
        this.genAI = genAI;
    }

    // Get or create news collection
    async getNewsCollection() {
        try {
            return await this.chroma.getCollection({
                name: newsCollectionName,
                embeddingFunction: embeddingFunction,
            });
        } catch (error) {
            console.error("Error getting news collection:", error);
            throw new Error(
                "News collection not found. Please run news collection first."
            );
        }
    }

    // Get or create conversation collection
    async getConversationCollection() {
        try {
            return await this.chroma.getCollection({
                name: conversationCollectionName,
                embeddingFunction: embeddingFunction,
            });
        } catch (error) {
            console.log("Creating conversation collection...");
            return await this.chroma.createCollection({
                name: conversationCollectionName,
                embeddingFunction: embeddingFunction,
            });
        }
    }

    // Search for relevant documents
    async searchRelevantDocuments(query, topK = 5) {
        try {
            const collection = await this.getNewsCollection();

            // Search for relevant documents
            const results = await collection.query({
                queryTexts: [query],
                nResults: topK,
                include: ["documents", "metadatas", "distances"],
            });

            return {
                success: true,
                documents: results.documents[0] || [],
                metadatas: results.metadatas[0] || [],
                distances: results.distances[0] || [],
            };
        } catch (error) {
            console.error("Error searching documents:", error);
            return {
                success: false,
                error: error.message,
                documents: [],
                metadatas: [],
                distances: [],
            };
        }
    }

    // Generate context from retrieved documents
    generateContext(documents, metadatas) {
        let context = "";

        for (let i = 0; i < documents.length; i++) {
            const doc = documents[i];
            const metadata = metadatas[i];

            context += `\n--- Source ${i + 1} ---\n`;
            context += `Title: ${metadata.title}\n`;
            context += `Source: ${metadata.source}\n`;
            context += `Date: ${metadata.date}\n`;
            context += `Content: ${doc}\n`;
        }

        return context;
    }

    // Generate answer using Gemini
    async generateAnswer(query, context, conversationHistory = []) {
        try {
            const model = this.genAI.getGenerativeModel({
                model: "gemini-1.5-flash",
            });

            // Build conversation history context
            let historyContext = "";
            if (conversationHistory.length > 0) {
                historyContext = "\n\nPrevious conversation:\n";
                conversationHistory.slice(-5).forEach((msg) => {
                    historyContext += `${msg.role}: ${msg.content}\n`;
                });
            }

            const prompt = `You are a helpful AI assistant that answers questions based on the provided news articles and context. 

Instructions:
1. Use ONLY the information provided in the context below
2. If the context doesn't contain relevant information, say so clearly
3. Cite sources when possible using the source information provided
4. Be concise but informative
5. If asked about recent events, mention that the information is based on the available news articles

Context from news articles:
${context}

${historyContext}

Question: ${query}

Answer:`;

            const result = await model.generateContent(prompt);
            const response = await result.response;

            return {
                success: true,
                answer: response.text(),
                sources: this.extractSources(metadatas),
            };
        } catch (error) {
            console.error("Error generating answer:", error);
            return {
                success: false,
                error: error.message,
                answer: "I'm sorry, I encountered an error while generating an answer. Please try again.",
            };
        }
    }

    // Extract sources from metadata
    extractSources(metadatas) {
        const sources = [];
        const seenUrls = new Set();

        metadatas.forEach((metadata) => {
            if (metadata.url && !seenUrls.has(metadata.url)) {
                seenUrls.add(metadata.url);
                sources.push({
                    title: metadata.title,
                    url: metadata.url,
                    source: metadata.source,
                    date: metadata.date,
                });
            }
        });

        return sources;
    }

    // Store conversation in ChromaDB
    async storeConversation(sessionId, query, answer, sources) {
        try {
            const collection = await this.getConversationCollection();

            const conversationData = {
                sessionId,
                query,
                answer,
                sources: JSON.stringify(sources),
                timestamp: new Date().toISOString(),
            };

            await collection.add({
                documents: [`Query: ${query}\nAnswer: ${answer}`],
                metadatas: [conversationData],
                ids: [`conv_${sessionId}_${Date.now()}`],
            });

            console.log(`✓ Stored conversation for session ${sessionId}`);
            return { success: true };
        } catch (error) {
            console.error("Error storing conversation:", error);
            return { success: false, error: error.message };
        }
    }

    // Main RAG pipeline
    async processQuery(query, sessionId, conversationHistory = []) {
        console.log(`Processing query: ${query.substring(0, 50)}...`);

        try {
            // Step 1: Search for relevant documents
            const searchResult = await this.searchRelevantDocuments(query, 5);

            if (!searchResult.success || searchResult.documents.length === 0) {
                return {
                    success: false,
                    answer: "I couldn't find any relevant information in the news articles to answer your question. Please try a different question or check if the news collection has been populated.",
                    sources: [],
                };
            }

            // Step 2: Generate context
            const context = this.generateContext(
                searchResult.documents,
                searchResult.metadatas
            );

            // Step 3: Generate answer
            const answerResult = await this.generateAnswer(
                query,
                context,
                conversationHistory
            );

            if (!answerResult.success) {
                return answerResult;
            }

            // Step 4: Store conversation
            await this.storeConversation(
                sessionId,
                query,
                answerResult.answer,
                answerResult.sources
            );

            return {
                success: true,
                answer: answerResult.answer,
                sources: answerResult.sources,
                relevantDocuments: searchResult.documents.length,
            };
        } catch (error) {
            console.error("Error in RAG pipeline:", error);
            return {
                success: false,
                error: error.message,
                answer: "I'm sorry, I encountered an error while processing your question. Please try again.",
            };
        }
    }

    // Get collection statistics
    async getCollectionStats() {
        try {
            const newsCollection = await this.getNewsCollection();
            const conversationCollection =
                await this.getConversationCollection();

            const newsCount = await newsCollection.count();
            const conversationCount = await conversationCollection.count();

            return {
                success: true,
                newsDocuments: newsCount,
                conversations: conversationCount,
            };
        } catch (error) {
            console.error("Error getting collection stats:", error);
            return {
                success: false,
                error: error.message,
            };
        }
    }

    // Health check
    async healthCheck() {
        try {
            await this.getNewsCollection();
            return { status: "healthy", timestamp: new Date().toISOString() };
        } catch (error) {
            return {
                status: "unhealthy",
                error: error.message,
                timestamp: new Date().toISOString(),
            };
        }
    }
}

// Create singleton instance
const ragService = new RAGService();

module.exports = ragService;
