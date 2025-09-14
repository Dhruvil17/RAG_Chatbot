require("dotenv").config();
const Redis = require("ioredis");
const { v4: uuidv4 } = require("uuid");

// Initialize Redis client
const redis = new Redis({
    host: process.env.REDIS_HOST || "localhost",
    port: process.env.REDIS_PORT || 6379,
    retryDelayOnFailover: 100,
    enableReadyCheck: false,
    maxRetriesPerRequest: null,
});

// Session TTL (Time To Live) in seconds - 24 hours
const SESSION_TTL = 24 * 60 * 60;

class SessionManager {
    constructor() {
        this.redis = redis;
    }

    // Create a new session
    async createSession() {
        const sessionId = uuidv4();
        const sessionData = {
            id: sessionId,
            createdAt: new Date().toISOString(),
            lastActivity: new Date().toISOString(),
            messages: [],
        };

        await this.redis.setex(
            `session:${sessionId}`,
            SESSION_TTL,
            JSON.stringify(sessionData)
        );

        console.log(`✓ Created new session: ${sessionId}`);
        return sessionId;
    }

    // Get session data
    async getSession(sessionId) {
        try {
            const sessionData = await this.redis.get(`session:${sessionId}`);
            if (!sessionData) {
                return null;
            }

            const session = JSON.parse(sessionData);

            // Update last activity
            session.lastActivity = new Date().toISOString();
            await this.redis.setex(
                `session:${sessionId}`,
                SESSION_TTL,
                JSON.stringify(session)
            );

            return session;
        } catch (error) {
            console.error(`Error getting session ${sessionId}:`, error);
            return null;
        }
    }

    // Add message to session
    async addMessage(sessionId, message) {
        try {
            const session = await this.getSession(sessionId);
            if (!session) {
                throw new Error(`Session ${sessionId} not found`);
            }

            const messageData = {
                id: uuidv4(),
                timestamp: new Date().toISOString(),
                ...message,
            };

            session.messages.push(messageData);
            session.lastActivity = new Date().toISOString();

            await this.redis.setex(
                `session:${sessionId}`,
                SESSION_TTL,
                JSON.stringify(session)
            );

            console.log(`✓ Added message to session ${sessionId}`);
            return messageData;
        } catch (error) {
            console.error(
                `Error adding message to session ${sessionId}:`,
                error
            );
            throw error;
        }
    }

    // Get session messages
    async getSessionMessages(sessionId) {
        try {
            const session = await this.getSession(sessionId);
            if (!session) {
                return [];
            }

            return session.messages;
        } catch (error) {
            console.error(
                `Error getting messages for session ${sessionId}:`,
                error
            );
            return [];
        }
    }

    // Clear session messages
    async clearSession(sessionId) {
        try {
            const session = await this.getSession(sessionId);
            if (!session) {
                throw new Error(`Session ${sessionId} not found`);
            }

            session.messages = [];
            session.lastActivity = new Date().toISOString();

            await this.redis.setex(
                `session:${sessionId}`,
                SESSION_TTL,
                JSON.stringify(session)
            );

            console.log(`✓ Cleared session ${sessionId}`);
            return { success: true };
        } catch (error) {
            console.error(`Error clearing session ${sessionId}:`, error);
            throw error;
        }
    }

    // Delete session
    async deleteSession(sessionId) {
        try {
            await this.redis.del(`session:${sessionId}`);
            console.log(`✓ Deleted session ${sessionId}`);
            return { success: true };
        } catch (error) {
            console.error(`Error deleting session ${sessionId}:`, error);
            throw error;
        }
    }

    // Get all active sessions (for debugging)
    async getAllSessions() {
        try {
            const keys = await this.redis.keys("session:*");
            const sessions = [];

            for (const key of keys) {
                const sessionData = await this.redis.get(key);
                if (sessionData) {
                    sessions.push(JSON.parse(sessionData));
                }
            }

            return sessions;
        } catch (error) {
            console.error("Error getting all sessions:", error);
            return [];
        }
    }

    // Get session statistics
    async getSessionStats() {
        try {
            const sessions = await this.getAllSessions();
            const totalSessions = sessions.length;
            const totalMessages = sessions.reduce(
                (sum, session) => sum + session.messages.length,
                0
            );
            const activeSessions = sessions.filter((session) => {
                const lastActivity = new Date(session.lastActivity);
                const now = new Date();
                const diffHours = (now - lastActivity) / (1000 * 60 * 60);
                return diffHours < 1; // Active if last activity within 1 hour
            }).length;

            return {
                totalSessions,
                totalMessages,
                activeSessions,
                averageMessagesPerSession:
                    totalSessions > 0
                        ? Math.round(totalMessages / totalSessions)
                        : 0,
            };
        } catch (error) {
            console.error("Error getting session stats:", error);
            return null;
        }
    }

    // Health check
    async healthCheck() {
        try {
            await this.redis.ping();
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
const sessionManager = new SessionManager();

module.exports = sessionManager;
