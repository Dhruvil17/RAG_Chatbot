require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { collectNewsData, queryNewsContent } = require("./model");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Health check
app.get("/health", (req, res) => {
    res.json({ status: "OK" });
});

// Collect news
app.post("/api/news/collect", async (req, res) => {
    try {
        const result = await collectNewsData();
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Chat
app.post("/api/chat", async (req, res) => {
    try {
        const { question } = req.body;
        const answer = await queryNewsContent(question);
        res.json({ success: true, answer });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
