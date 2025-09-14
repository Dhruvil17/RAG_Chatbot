import React, { useState } from "react";
import ChatBox from "./components/ChatBox";
import InputArea from "./components/InputArea";
import "./App.css";

const API_BASE_URL = process.env.REACT_APP_BASE_URL;

function App() {
    const [messages, setMessages] = useState([]);
    const [sessionID, setSessionID] = useState("");

    const handleSendMessage = async (question) => {
        const userMessage = { type: "user", content: question };
        setMessages((prev) => [...prev, userMessage]);

        try {
            const response = await fetch(`${API_BASE_URL}/api/send-message`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "session-id": sessionID,
                },
                body: JSON.stringify({ question }),
            });

            const data = await response.json();

            if (data.sessionID) {
                setSessionID(data.sessionID);
            }

            const serverMessage = { type: "server", content: data.reply };
            setMessages((prev) => [...prev, serverMessage]);
        } catch (error) {
            console.error("Error sending message:", error);
            const errorMessage = {
                type: "error",
                content: "Error sending message. Please try again.",
            };
            setMessages((prev) => [...prev, errorMessage]);
        }
    };

    const handleResetSession = () => {
        setMessages([]);
        setSessionID("");
    };

    return (
        <div className="App">
            <div className="chat-container">
                <ChatBox messages={messages} />
                <div className="chat-input-container">
                    <InputArea onSendMessage={handleSendMessage} />
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
