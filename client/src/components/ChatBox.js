import React, { useEffect, useRef } from "react";
import "./ChatBox.css";

const ChatBox = ({ messages }) => {
    const chatBoxRef = useRef(null);

    useEffect(() => {
        if (chatBoxRef.current) {
            chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
        }
    }, [messages]);

    const formatMessage = (content) => {
        return content.split("\n").map((line, index) => (
            <span key={index}>
                {line}
                {index < content.split("\n").length - 1 && <br />}
            </span>
        ));
    };

    return (
        <div className="chat-box" ref={chatBoxRef}>
            {messages.length === 0 ? (
                <div className="welcome-message">
                    <h2>RAG-Powered News Chatbot</h2>
                    <p>
                        Ask me questions about news articles! I can help you
                        find information from our news corpus using RAG.
                    </p>
                </div>
            ) : (
                messages.map((message, index) => (
                    <div
                        key={index}
                        className={`message ${message.type}-message`}>
                        <div className="message-content">
                            {formatMessage(message.content)}
                        </div>
                        <div className="message-time">
                            {new Date().toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                            })}
                        </div>
                    </div>
                ))
            )}
        </div>
    );
};

export default ChatBox;
