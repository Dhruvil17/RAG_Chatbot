import React, { useState } from "react";
import "./InputArea.css";

const InputArea = ({ onSendMessage, isLoading }) => {
    const [messageInput, setMessageInput] = useState("");

    const handleSubmit = (e) => {
        e.preventDefault();
        const message = messageInput.trim();

        if (message && !isLoading) {
            onSendMessage(message);
            setMessageInput("");
        }
    };

    return (
        <form className="input-area" onSubmit={handleSubmit}>
            <div className="input-container">
                <input
                    type="text"
                    className="message-input"
                    placeholder={
                        isLoading
                            ? "Bot is thinking..."
                            : "Ask me about news articles... (e.g., 'What are the latest tech news?')"
                    }
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    disabled={isLoading}
                    required
                />
                <button
                    type="submit"
                    className="send-button"
                    disabled={isLoading}>
                    {isLoading ? (
                        <div className="loading-spinner"></div>
                    ) : (
                        <svg
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg">
                            <path
                                d="M2.01 21L23 12L2.01 3L2 10L17 12L2 14L2.01 21Z"
                                fill="currentColor"
                            />
                        </svg>
                    )}
                </button>
            </div>
        </form>
    );
};

export default InputArea;
