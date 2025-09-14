# RAG-Powered News Chatbot

A full-stack chatbot that answers queries over a news corpus using Retrieval-Augmented Generation (RAG) pipeline with Google Gemini embeddings and ChromaDB vector storage.

## 🎯 Project Overview

This project implements a RAG-based news chatbot for the Voosh Full Stack Developer assignment. It collects news articles from major news sources, stores them in a vector database, and uses Google Gemini for embeddings and text generation.

## 🏗️ Architecture

-   **Frontend**: React with SCSS
-   **Backend**: Node.js with Express
-   **Vector Database**: ChromaDB
-   **Embeddings**: Google Gemini (free tier)
-   **LLM**: Google Gemini Pro
-   **News Collection**: Python with news-please
-   **Session Management**: In-memory with UUID

## 📁 Project Structure

```
RAG-News-Chatbot/
├── client/                    # React Frontend
│   ├── src/
│   │   ├── components/
│   │   ├── App.js
│   │   └── App.css
│   └── package.json
├── server/                    # Node.js Backend
│   ├── server.js
│   ├── model.js
│   └── package.json
├── scripts/                   # Python News Collection
│   ├── news_collector.py
│   ├── requirements.txt
│   └── README.md
├── data/                      # ChromaDB Storage
│   └── chroma_db/
└── README.md
```

## 🚀 Setup Instructions

### Prerequisites

-   Node.js (v14+)
-   Python (v3.8+)
-   Google Gemini API key

### 1. Clone and Setup

```bash
git clone <repository-url>
cd RAG-News-Chatbot
```

### 2. Backend Setup

```bash
cd server
npm install
```

Create `.env` file:

```env
GEMINI_API_KEY=your_gemini_api_key_here
PORT=5050
```

### 3. Frontend Setup

```bash
cd client
npm install
```

### 4. Python News Collection Setup

```bash
cd scripts
python -m venv news_env
source news_env/bin/activate  # On Windows: news_env\Scripts\activate
pip install -r requirements.txt
```

### 5. Collect News Articles

```bash
# From the scripts directory
python news_collector.py
```

This will:

-   Collect ~50 news articles from major sources
-   Chunk articles into 2000-character pieces
-   Store in ChromaDB collection "news_corpus"

### 6. Start the Application

**Terminal 1 - Backend:**

```bash
cd server
npm start
```

**Terminal 2 - Frontend:**

```bash
cd client
npm start
```

## 🎯 Features

### ✅ RAG Pipeline

-   **News Ingestion**: Collects articles from 10+ major news sources
-   **Embeddings**: Google Gemini embeddings (free tier)
-   **Vector Storage**: ChromaDB with cosine similarity
-   **Retrieval**: Top-5 relevant chunks for each query
-   **Generation**: Google Gemini Pro for final answers

### ✅ Backend Features

-   **REST API**: Express.js with CORS
-   **Session Management**: UUID-based session tracking
-   **Error Handling**: Comprehensive error management
-   **Conversation History**: Stored in ChromaDB

### ✅ Frontend Features

-   **Clean UI**: Modern, responsive design
-   **Real-time Chat**: Instant message exchange
-   **Session Reset**: Clear conversation history
-   **Error Handling**: User-friendly error messages

## 🔧 API Endpoints

### POST `/api/send-message`

Send a question to the news chatbot.

**Request:**

```json
{
    "question": "What are the latest technology news?"
}
```

**Response:**

```json
{
    "sessionID": "uuid-string",
    "reply": "Based on recent news articles..."
}
```

## 📊 Data Collection

The system collects news from:

-   Reuters
-   BBC News
-   CNN
-   AP News
-   The Guardian
-   NPR
-   PBS NewsHour
-   CBS News
-   NBC News
-   ABC News

**Expected Data:**

-   **Articles**: 50+ news articles
-   **Chunks**: 150-200 text chunks
-   **Storage**: ~2-5MB of news data

## 🎯 Assignment Requirements Met

### ✅ RAG Pipeline

-   [x] Ingest ~50 news articles using news-please
-   [x] Embed with Google Gemini (free tier)
-   [x] Store in ChromaDB vector database
-   [x] Retrieve top-k passages and call Gemini API

### ✅ Backend

-   [x] REST API with Node.js/Express
-   [x] Session management with UUID
-   [x] Conversation history storage
-   [x] Error handling

### ✅ Frontend

-   [x] React with SCSS
-   [x] Chat interface with message display
-   [x] Input box for new messages
-   [x] Session reset button
-   [x] Clean, modern UI

### ✅ Performance

-   [x] ChromaDB for vector storage
-   [x] Session-based conversation history
-   [x] Efficient chunking and retrieval

## 🚀 Deployment

### Local Development

```bash
# Backend
cd server && npm start

# Frontend
cd client && npm start
```

### Production

-   Deploy backend to Render/Railway
-   Deploy frontend to Vercel/Netlify
-   Use persistent ChromaDB storage

## 📝 Tech Stack

-   **Frontend**: React, SCSS, JavaScript
-   **Backend**: Node.js, Express, CORS
-   **Vector DB**: ChromaDB
-   **Embeddings**: Google Gemini
-   **LLM**: Google Gemini Pro
-   **News Collection**: Python, news-please
-   **Session Management**: UUID

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🎯 Assignment Submission

This project fulfills all requirements for the Voosh Full Stack Developer assignment:

1. **Complete RAG Pipeline** with news corpus
2. **Full-stack Implementation** with React and Node.js
3. **Vector Database Integration** with ChromaDB
4. **Session Management** with conversation history
5. **Modern UI/UX** with clean design
6. **Free Tier Usage** with Google Gemini
7. **Comprehensive Documentation** and setup instructions

---

**Built for Voosh Full Stack Developer Assignment** 🚀

