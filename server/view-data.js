require("dotenv").config();
const { ChromaClient } = require("chromadb");
const { HfInference } = require("@huggingface/inference");

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

        // Get news collection with embedding function
        console.log("📰 News Collection Details:");

        const hf = new HfInference(process.env.HUGGINGFACE_API_KEY);

        const embeddingFunction = {
            generate: async (texts) => {
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
                    return texts.map(() => new Array(384).fill(0));
                }
            },
        };

        const collection = await chroma.getCollection({
            name: newsCollectionName,
            embeddingFunction: embeddingFunction,
        });

        // Get collection count
        const count = await collection.count();
        console.log(`Total documents: ${count}\n`);

        // Get sample documents
        console.log("📄 Sample Documents (first 3):");
        const results = await collection.get();

        results.documents.forEach((doc, index) => {
            console.log(`\n--- Document ${index + 1} ---`);
            console.log(`Content: ${doc.substring(0, 200)}...`);
            console.log(`Metadata:`, results.metadatas[index]);
            console.log(`ID: ${results.ids[index]}`);
        });

        // Query the collection using embedding function
        console.log("\n🔍 Querying for 'technology' news:");
        try {
            // Generate embedding for the query
            const queryEmbedding = await embeddingFunction.generate([
                "technology news",
            ]);

            const queryResults = await collection.query({
                queryEmbeddings: queryEmbedding,
                nResults: 2,
            });

            console.log(`Found ${queryResults.documents[0].length} results:`);
            queryResults.documents[0].forEach((doc, index) => {
                console.log(`\n--- Query Result ${index + 1} ---`);
                console.log(`Content: ${doc.substring(0, 150)}...`);
                if (queryResults.distances && queryResults.distances[0]) {
                    console.log(
                        `Distance: ${queryResults.distances[0][index]}`
                    );
                }
            });
        } catch (queryError) {
            console.log("⚠️ Query failed, but data viewing was successful!");
            console.log("Query error:", queryError.message);
        }
    } catch (error) {
        console.error("❌ Error viewing data:", error.message);
    }
}

// Run the function
viewChromaDBData();
