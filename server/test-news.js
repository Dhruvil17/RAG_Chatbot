require("dotenv").config();
const { collectNewsData, queryNewsContent } = require("./model");

async function testNewsCollection() {
    console.log("=== Testing News Collection ===");

    try {
        // Collect news data
        console.log("1. Collecting news data...");
        const collectionResult = await collectNewsData();
        console.log("Collection result:", collectionResult);

        // Test querying
        console.log("\n2. Testing news query...");
        const answer = await queryNewsContent(
            "What are the latest news about technology?"
        );
        console.log("Answer:", answer);
    } catch (error) {
        console.error("Error in test:", error);
    }
}

// Run the test
testNewsCollection();
