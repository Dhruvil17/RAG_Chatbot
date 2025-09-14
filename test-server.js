#!/usr/bin/env node

/**
 * Test script to verify the RAG server functionality
 */

const axios = require("axios");

const SERVER_URL = "http://localhost:5050";

async function testServer() {
    console.log("🧪 Testing RAG Server...");
    console.log("=".repeat(50));

    try {
        // Test 1: Health check
        console.log("1. Testing health check...");
        const healthResponse = await axios.get(`${SERVER_URL}/health`);
        console.log("✅ Health check passed:", healthResponse.data.status);

        // Test 2: Create session
        console.log("\n2. Testing session creation...");
        const sessionResponse = await axios.post(
            `${SERVER_URL}/api/session/create`
        );
        const sessionId = sessionResponse.data.sessionId;
        console.log("✅ Session created:", sessionId);

        // Test 3: Chat
        console.log("\n3. Testing chat functionality...");
        const chatResponse = await axios.post(`${SERVER_URL}/api/chat`, {
            question: "What are the latest news about technology?",
            sessionId: sessionId,
        });

        if (chatResponse.data.success) {
            console.log("✅ Chat response received");
            console.log(
                "Answer:",
                chatResponse.data.answer.substring(0, 100) + "..."
            );
            console.log("Sources:", chatResponse.data.sources?.length || 0);
        } else {
            console.log("❌ Chat failed:", chatResponse.data.error);
        }

        // Test 4: Get session messages
        console.log("\n4. Testing session messages...");
        const messagesResponse = await axios.get(
            `${SERVER_URL}/api/session/${sessionId}/messages`
        );
        console.log(
            "✅ Messages retrieved:",
            messagesResponse.data.messages.length
        );

        // Test 5: Stats
        console.log("\n5. Testing stats...");
        const statsResponse = await axios.get(`${SERVER_URL}/api/stats`);
        console.log("✅ Stats retrieved:", statsResponse.data);

        console.log("\n🎉 All tests passed!");
    } catch (error) {
        console.error("❌ Test failed:", error.message);
        if (error.response) {
            console.error("Response:", error.response.data);
        }
    }
}

// Run tests
testServer().catch(console.error);
