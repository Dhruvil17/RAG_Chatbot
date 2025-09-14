require("dotenv").config();
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const { collectNewsData, queryNewsContent } = require("./model");

const app = express();
const PORT = process.env.PORT;

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

app.get("/", (req, res) => {
    console.log(`Server is up and running on PORT ${PORT}`);
    res.json({ message: "GET request received!" });
});

app.post("/", (req, res) => {
    console.log(`Server is up and running on PORT ${PORT}`);
    res.json({ message: "POST request received!" });
});

app.get("/health", (req, res) => {
    res.json({ status: "OK" });
});

app.post("/api/news/collect", async (req, res) => {
    try {
        const result = await collectNewsData();
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post("/api/send-message", async (req, res) => {
    try {
        const { question } = req.body;
        const sessionID = req.headers["session-id"];
        const answer = await queryNewsContent(question);
        res.json({
            success: true,
            reply: answer,
            sessionID: sessionID || "new-session",
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
