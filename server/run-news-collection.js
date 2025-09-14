require("dotenv").config();
const { collectNewsData } = require("./model");

async function main() {
    console.log("=== News Collection Script ===");
    console.log("Starting news collection...");

    try {
        const result = await collectNewsData();

        if (result.success) {
            console.log("✅ News collection completed successfully!");
            console.log(`📰 Articles: ${result.articles || "N/A"}`);
            console.log(`📄 Chunks: ${result.chunks || "N/A"}`);
        } else {
            console.log("❌ News collection failed:");
            console.log(result.error || result.message);
        }
    } catch (error) {
        console.error("❌ Error during news collection:", error.message);
    }
}

main();
