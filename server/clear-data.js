require("dotenv").config();
const { ChromaClient } = require("chromadb");

const chroma = new ChromaClient({
    path: "http://localhost:8000",
});

const newsCollectionName = "news_corpus";

async function clearData() {
    try {
        console.log("🗑️  Clearing existing data...");

        // Delete the collection
        await chroma.deleteCollection({ name: newsCollectionName });

        console.log("✅ Data cleared successfully!");
        console.log("You can now run: npm run collect-news");
    } catch (error) {
        console.error("❌ Error clearing data:", error.message);
    }
}

clearData();
