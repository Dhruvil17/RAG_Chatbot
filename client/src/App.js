import React, { useState, useEffect } from "react";
import ChatBox from "./components/ChatBox";
import InputArea from "./components/InputArea";
import "./App.css";

function App() {
    const [messages, setMessages] = useState([]);
    const [sessionID, setSessionID] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    // Load or create session on component mount
    useEffect(() => {
        const savedSessionId = localStorage.getItem("chatSessionId");
        if (savedSessionId) {
            // Try to load existing session
            loadSessionHistory(savedSessionId)
                .then(() => {
                    setSessionID(savedSessionId);
                })
                .catch(() => {
                    // If loading fails, create new session
                    createNewSession();
                });
        } else {
            // No saved session, create new one
            createNewSession();
        }
    }, []);

    const createNewSession = async () => {
        try {
            const response = await fetch("/api/session/create", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
            });
            const data = await response.json();
            if (data.success) {
                setSessionID(data.sessionId);
                localStorage.setItem("chatSessionId", data.sessionId);
                console.log("New session created:", data.sessionId);
            }
        } catch (error) {
            console.error("Error creating session:", error);
        }
    };

    const loadSessionHistory = async (sessionId) => {
        try {
            const response = await fetch(`/api/session/${sessionId}/history`);
            const data = await response.json();
            if (data.success && data.messages) {
                setMessages(
                    data.messages.map((msg) => ({
                        type: msg.type === "user" ? "user" : "server",
                        content: msg.content,
                    }))
                );
            }
        } catch (error) {
            console.error("Error loading session history:", error);
        }
    };

    const clearSession = async () => {
        if (sessionID) {
            try {
                await fetch(`/api/session/${sessionID}`, {
                    method: "DELETE",
                });
            } catch (error) {
                console.error("Error clearing session:", error);
            }
        }
        setMessages([]);
        localStorage.removeItem("chatSessionId");
        await createNewSession();
    };

    const handleSendMessage = async (question) => {
        const userMessage = { type: "user", content: question };
        setMessages((prev) => [...prev, userMessage]);
        setIsLoading(true);

        try {
            const response = await fetch("/api/send-message", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "session-id": sessionID,
                },
                body: JSON.stringify({ question }),
            });

            const data = await response.json();

            if (data.success) {
                const serverMessage = { type: "server", content: data.reply };
                setMessages((prev) => [...prev, serverMessage]);
                setSessionID(data.sessionID);
            } else {
                const errorMessage = {
                    type: "error",
                    content: "Sorry, I couldn't process your question.",
                };
                setMessages((prev) => [...prev, errorMessage]);
            }
        } catch (error) {
            console.error("Error sending message:", error);
            const errorMessage = {
                type: "error",
                content: "Error sending message. Please try again.",
            };
            setMessages((prev) => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleResetSession = () => {
        clearSession();
    };

    return (
        <div className="App">
            <div className="chat-container">
                <ChatBox messages={messages} />
                <div className="chat-input-container">
                    <InputArea
                        onSendMessage={handleSendMessage}
                        isLoading={isLoading}
                    />
                    <div className="bottom-actions">
                        <button
                            className="reset-button"
                            onClick={handleResetSession}>
                            Reset Session
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default App;
