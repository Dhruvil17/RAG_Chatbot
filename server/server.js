require("dotenv").config();
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const {
    collectNewsData,
    queryNewsContent,
    createSession,
    getSessionHistory,
    clearSession,
    validateSession,
} = require("./model");

const app = express();
const PORT = process.env.PORT;

app.use(
    cors({
        origin: true,
        credentials: true,
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization", "session-id"],
    })
);
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

        const result = await queryNewsContent(question, sessionID);

        res.json({
            success: true,
            reply: result.answer,
            sessionID: result.sessionId,
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Session Management Endpoints
app.post("/api/session/create", async (req, res) => {
    try {
        const sessionId = await createSession();
        res.json({
            success: true,
            sessionId: sessionId,
            message: "Session created successfully",
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get("/api/session/:sessionId/history", async (req, res) => {
    try {
        const { sessionId } = req.params;
        const history = await getSessionHistory(sessionId);

        res.json({
            success: true,
            ...history,
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.delete("/api/session/:sessionId", async (req, res) => {
    try {
        const { sessionId } = req.params;
        const result = await clearSession(sessionId);

        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get("/api/session/:sessionId/validate", async (req, res) => {
    try {
        const { sessionId } = req.params;
        const isValid = await validateSession(sessionId);

        res.json({
            success: true,
            valid: isValid,
            sessionId: sessionId,
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
