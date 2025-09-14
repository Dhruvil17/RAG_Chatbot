# RAG Server - News Chatbot with ChromaDB

A comprehensive RAG (Retrieval-Augmented Generation) server that collects news articles, stores them in ChromaDB with Gemini embeddings, and provides intelligent chat responses.

## 🚀 Features

-   **News Collection**: Automatically collects news from 10+ RSS feeds
-   **Vector Storage**: Stores articles in ChromaDB with Gemini embeddings
-   **Session Management**: Redis-based session management with chat history
-   **RAG Pipeline**: Retrieves relevant documents and generates answers using Gemini
-   **REST API**: Complete REST API for frontend integration
-   **Real-time Chat**: Support for streaming responses and session management

## 🛠️ Tech Stack

-   **Backend**: Node.js + Express
-   **Vector DB**: ChromaDB (Docker)
-   **Embeddings**: Google Gemini (embedding-001)
-   **LLM**: Google Gemini (gemini-1.5-flash)
-   **Session Storage**: Redis
-   **News Sources**: RSS feeds from major news outlets

## 📋 Prerequisites

-   Node.js (v16+)
-   Docker & Docker Compose
-   Redis (optional, can use in-memory fallback)
-   Google Gemini API key

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Setup

Create a `.env` file in the server directory:

```env
GEMINI_API_KEY=your_gemini_api_key_here
PORT=5050
REDIS_HOST=localhost
REDIS_PORT=6379
```

### 3. Start ChromaDB

```bash
docker-compose up -d
```

### 4. Collect News Articles

```bash
npm run collect-news
```

This will:

-   Collect ~50 news articles from RSS feeds
-   Process and chunk the content
-   Generate embeddings using Gemini
-   Store everything in ChromaDB

### 5. Start the Server

```bash
npm start
```

The server will be available at `http://localhost:5050`

## 📚 API Endpoints

### Health & Status

-   `GET /` - Server status
-   `GET /health` - Health check for all services
-   `GET /api/stats` - Collection and session statistics

### Session Management

-   `POST /api/session/create` - Create new session
-   `GET /api/session/:sessionId/messages` - Get session messages
-   `DELETE /api/session/:sessionId` - Clear session

### Chat

-   `POST /api/chat` - Main chat endpoint
-   `POST /api/send-message` - Legacy chat endpoint

### News Management

-   `POST /api/news/collect` - Collect and store news articles

## 💬 Usage Examples

### Create a Session and Chat

```bash
# Create session
curl -X POST http://localhost:5050/api/session/create

# Chat
curl -X POST http://localhost:5050/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What are the latest news about AI?",
    "sessionId": "your-session-id"
  }'
```

### Get Session History

```bash
curl http://localhost:5050/api/session/your-session-id/messages
```

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   RAG Server    │    │   ChromaDB      │
│   (React)       │◄──►│   (Node.js)     │◄──►│   (Vector DB)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │     Redis       │
                       │   (Sessions)    │
                       └─────────────────┘
```

## 📊 Data Flow

1. **News Collection**: RSS feeds → Content extraction → Text chunking
2. **Embedding Generation**: Text chunks → Gemini embeddings
3. **Vector Storage**: Embeddings → ChromaDB with metadata
4. **Query Processing**: User query → Vector search → Context generation
5. **Answer Generation**: Context + Query → Gemini → Response
6. **Session Storage**: Messages → Redis → Chat history

## 🔧 Configuration

### ChromaDB Settings

-   Collection: `news_corpus`
-   Embedding model: `embedding-001`
-   Chunk size: 2000 characters
-   Overlap: 200 characters

### Session Settings

-   TTL: 24 hours
-   Storage: Redis (with in-memory fallback)
-   Max history: 5 messages for context

## 🐛 Troubleshooting

### ChromaDB Connection Issues

```bash
# Check if ChromaDB is running
docker ps

# Restart ChromaDB
docker-compose down && docker-compose up -d
```

### Redis Connection Issues

The server will work without Redis, but session management will be limited.

### API Key Issues

Make sure your `GEMINI_API_KEY` is set in the `.env` file.

## 📈 Performance

-   **News Collection**: ~5-10 minutes for 50 articles
-   **Query Response**: ~2-5 seconds per query
-   **Memory Usage**: ~200MB for server + ChromaDB
-   **Storage**: ~50MB for 50 articles with embeddings

## 🔒 Security

-   CORS enabled for frontend integration
-   Session-based authentication
-   Input validation and sanitization
-   Error handling and logging

## 📝 Development

### Running in Development Mode

```bash
npm run dev
```

### Adding New News Sources

Edit the `RSS_FEEDS` array in `newsCollector.js`

### Customizing Embeddings

Modify the `embeddingFunction` in `newsCollector.js`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

For issues and questions:

1. Check the troubleshooting section
2. Review the logs for error messages
3. Ensure all services are running
4. Verify API keys and configuration
