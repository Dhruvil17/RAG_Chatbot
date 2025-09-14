#!/usr/bin/env node

/**
 * Script to collect and store news articles in ChromaDB
 * Usage: node runNewsCollection.js
 */

require("dotenv").config();
const { collectAndStoreNews, getCollectionStats } = require("./newsCollector");

async function main() {
    console.log("🚀 Starting News Collection Process...");
    console.log("=".repeat(50));

    // Check if GEMINI_API_KEY is set
    if (!process.env.GEMINI_API_KEY) {
        console.error(
            "❌ Error: GEMINI_API_KEY not found in environment variables"
        );
        console.log("Please set your Gemini API key in the .env file");
        process.exit(1);
    }

    // Check if ChromaDB is running
    try {
        const { ChromaClient } = require("chromadb");
        const chroma = new ChromaClient({ path: "http://localhost:8000" });
        await chroma.heartbeat();
        console.log("✅ ChromaDB connection verified");
    } catch (error) {
        console.error("❌ Error: Cannot connect to ChromaDB");
        console.log("Please make sure ChromaDB is running:");
        console.log("  cd server && docker-compose up -d");
        process.exit(1);
    }

    try {
        // Collect and store news
        const result = await collectAndStoreNews();

        if (result.success) {
            console.log("\n🎉 News collection completed successfully!");
            console.log("=".repeat(50));
            console.log(`📰 Articles collected: ${result.articles}`);
            console.log(`📄 Chunks created: ${result.chunks}`);
            console.log(`🗄️  Collection name: news_corpus`);

            // Get final stats
            const stats = await getCollectionStats();
            if (stats.success) {
                console.log(`📊 Total documents in collection: ${stats.count}`);
            }

            console.log(
                "\n✅ You can now start the server and begin chatting!"
            );
            console.log("Run: npm start");
        } else {
            console.error("\n❌ News collection failed:");
            console.error(result.error || "Unknown error");
            process.exit(1);
        }
    } catch (error) {
        console.error("\n❌ Unexpected error during news collection:");
        console.error(error.message);
        process.exit(1);
    }
}

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
    console.error("❌ Uncaught Exception:", error.message);
    process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
    console.error("❌ Unhandled Rejection at:", promise, "reason:", reason);
    process.exit(1);
});

// Run the main function
main().catch((error) => {
    console.error("❌ Main function error:", error.message);
    process.exit(1);
});
