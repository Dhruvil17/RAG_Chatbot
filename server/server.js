require("dotenv").config();
const cors = require("cors");
const express = require("express");
const { v4: uuidv4 } = require("uuid");
const bodyParser = require("body-parser");

// Import our services
const ragService = require("./ragService");
const sessionManager = require("./sessionManager");
const { collectAndStoreNews, getCollectionStats } = require("./newsCollector");

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

const PORT = process.env.PORT || 5050;

// Health check endpoint
app.get("/", (req, res) => {
    res.json({
        message: `RAG Server is running on port ${PORT}`,
        timestamp: new Date().toISOString(),
        version: "1.0.0",
    });
});

// Health check for all services
app.get("/health", async (req, res) => {
    try {
        const ragHealth = await ragService.healthCheck();
        const sessionHealth = await sessionManager.healthCheck();

        res.json({
            status: "healthy",
            timestamp: new Date().toISOString(),
            services: {
                rag: ragHealth,
                session: sessionHealth,
            },
        });
    } catch (error) {
        res.status(500).json({
            status: "unhealthy",
            error: error.message,
            timestamp: new Date().toISOString(),
        });
    }
});

// Create new session
app.post("/api/session/create", async (req, res) => {
    try {
        const sessionId = await sessionManager.createSession();
        res.json({
            success: true,
            sessionId,
            message: "Session created successfully",
        });
    } catch (error) {
        console.error("Error creating session:", error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

// Get session messages
app.get("/api/session/:sessionId/messages", async (req, res) => {
    try {
        const { sessionId } = req.params;
        const messages = await sessionManager.getSessionMessages(sessionId);

        res.json({
            success: true,
            sessionId,
            messages,
        });
    } catch (error) {
        console.error("Error getting session messages:", error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

// Clear session
app.delete("/api/session/:sessionId", async (req, res) => {
    try {
        const { sessionId } = req.params;
        await sessionManager.clearSession(sessionId);

        res.json({
            success: true,
            message: "Session cleared successfully",
        });
    } catch (error) {
        console.error("Error clearing session:", error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

// Main chat endpoint
app.post("/api/chat", async (req, res) => {
    try {
        const { question, sessionId } = req.body;

        if (!question) {
            return res.status(400).json({
                success: false,
                error: "Question is required",
            });
        }

        // Get or create session
        let currentSessionId = sessionId;
        if (!currentSessionId) {
            currentSessionId = await sessionManager.createSession();
        }

        // Verify session exists
        const session = await sessionManager.getSession(currentSessionId);
        if (!session) {
            currentSessionId = await sessionManager.createSession();
        }

        // Get conversation history
        const conversationHistory = await sessionManager.getSessionMessages(
            currentSessionId
        );

        // Process query with RAG
        const result = await ragService.processQuery(
            question,
            currentSessionId,
            conversationHistory
        );

        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: result.error || "Failed to process query",
            });
        }

        // Add messages to session
        await sessionManager.addMessage(currentSessionId, {
            role: "user",
            content: question,
            timestamp: new Date().toISOString(),
        });

        await sessionManager.addMessage(currentSessionId, {
            role: "assistant",
            content: result.answer,
            sources: result.sources,
            timestamp: new Date().toISOString(),
        });

        res.json({
            success: true,
            sessionId: currentSessionId,
            answer: result.answer,
            sources: result.sources,
            relevantDocuments: result.relevantDocuments,
        });
    } catch (error) {
        console.error("Error processing chat:", error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

// Legacy endpoint for backward compatibility
app.post("/api/send-message", async (req, res) => {
    try {
        const { question } = req.body;
        let sessionID = req.headers["session-id"];

        if (!sessionID) {
            sessionID = await sessionManager.createSession();
        }

        // Get conversation history
        const conversationHistory = await sessionManager.getSessionMessages(
            sessionID
        );

        // Process query with RAG
        const result = await ragService.processQuery(
            question,
            sessionID,
            conversationHistory
        );

        if (!result.success) {
            return res.status(500).json({
                sessionID,
                reply: result.error || "Failed to process query",
            });
        }

        // Add messages to session
        await sessionManager.addMessage(sessionID, {
            role: "user",
            content: question,
            timestamp: new Date().toISOString(),
        });

        await sessionManager.addMessage(sessionID, {
            role: "assistant",
            content: result.answer,
            sources: result.sources,
            timestamp: new Date().toISOString(),
        });

        res.json({
            sessionID,
            reply: result.answer,
            sources: result.sources,
        });
    } catch (error) {
        console.error("Error processing message:", error);
        res.status(500).json({
            sessionID: req.headers["session-id"] || "unknown",
            reply: `Sorry, I encountered an error: ${error.message}`,
        });
    }
});

// Collect and store news articles
app.post("/api/news/collect", async (req, res) => {
    try {
        console.log("Starting news collection...");
        const result = await collectAndStoreNews();

        if (result.success) {
            res.json({
                success: true,
                message: "News collection completed successfully",
                articles: result.articles,
                chunks: result.chunks,
            });
        } else {
            res.status(500).json({
                success: false,
                error: result.error || "News collection failed",
            });
        }
    } catch (error) {
        console.error("Error collecting news:", error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

// Get collection statistics
app.get("/api/stats", async (req, res) => {
    try {
        const ragStats = await ragService.getCollectionStats();
        const sessionStats = await sessionManager.getSessionStats();

        res.json({
            success: true,
            rag: ragStats,
            sessions: sessionStats,
        });
    } catch (error) {
        console.error("Error getting stats:", error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

// Get all sessions (for debugging)
app.get("/api/sessions", async (req, res) => {
    try {
        const sessions = await sessionManager.getAllSessions();
        res.json({
            success: true,
            sessions,
        });
    } catch (error) {
        console.error("Error getting sessions:", error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error("Unhandled error:", error);
    res.status(500).json({
        success: false,
        error: "Internal server error",
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: "Endpoint not found",
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 RAG Server is running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`📈 Stats: http://localhost:${PORT}/api/stats`);
    console.log(`💬 Chat: http://localhost:${PORT}/api/chat`);
    console.log(
        `📰 News collection: http://localhost:${PORT}/api/news/collect`
    );
});

module.exports = app;
