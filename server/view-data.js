require("dotenv").config();
const { ChromaClient } = require("chromadb");

const chroma = new ChromaClient({
    path: "http://localhost:8000",
});

const newsCollectionName = "news_corpus";

async function viewChromaDBData() {
    try {
        console.log("🔍 Viewing ChromaDB Data...\n");

        // List all collections
        console.log("📚 All Collections:");
        const collections = await chroma.listCollections();
        console.log(collections);
        console.log(`Total collections: ${collections.length}\n`);

        // Get news collection
        console.log("📰 News Collection Details:");
        const collection = await chroma.getCollection({
            name: newsCollectionName,
        });

        // Get collection count
        const count = await collection.count();
        console.log(`Total documents: ${count}\n`);

        // Get sample documents
        console.log("📄 Sample Documents (first 3):");
        const results = await collection.get({ limit: 3 });

        results.documents.forEach((doc, index) => {
            console.log(`\n--- Document ${index + 1} ---`);
            console.log(`Content: ${doc.substring(0, 200)}...`);
            console.log(`Metadata:`, results.metadatas[index]);
            console.log(`ID: ${results.ids[index]}`);
        });

        // Query the collection
        console.log("\n🔍 Querying for 'technology' news:");
        const { HfInference } = require("@huggingface/inference");
        const hf = new HfInference(
            process.env.HUGGINGFACE_API_KEY || "hf_dummy_key"
        );

        // Generate embedding for query
        const queryEmbedding = await hf.featureExtraction({
            model: "sentence-transformers/all-MiniLM-L6-v2",
            inputs: "technology news",
        });

        const queryResults = await collection.query({
            queryEmbeddings: [queryEmbedding],
            nResults: 2,
        });

        console.log(`Found ${queryResults.documents[0].length} results:`);
        queryResults.documents[0].forEach((doc, index) => {
            console.log(`\n--- Query Result ${index + 1} ---`);
            console.log(`Content: ${doc.substring(0, 150)}...`);
            console.log(`Distance: ${queryResults.distances[0][index]}`);
        });
    } catch (error) {
        console.error("❌ Error viewing data:", error.message);
    }
}

// Run the function
viewChromaDBData();
