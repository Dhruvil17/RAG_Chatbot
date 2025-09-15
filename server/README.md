# RAG Server

A Node.js backend server that powers a Retrieval-Augmented Generation (RAG) system for news data querying. The server uses vector databases, AI models, and Redis for session management to provide intelligent responses to user queries.

## Features

-   **News Data Collection**: Automated web scraping and data ingestion
-   **Vector Search**: ChromaDB integration for semantic search
-   **AI Integration**: Hugging Face embeddings + Google Gemini for responses
-   **Session Management**: Redis-based chat session persistence
-   **RESTful API**: Clean API endpoints for frontend integration

## Tech Stack

-   **Node.js** - Runtime environment
-   **Express.js** - Web framework
-   **ChromaDB** - Vector database for embeddings
-   **Redis** - Session storage and caching
-   **Hugging Face** - Text embeddings
-   **Google Gemini** - Large language model
-   **Cheerio** - Web scraping
-   **Axios** - HTTP client

## Architecture

```
News Sources → Web Scraping → Text Processing → Embeddings → ChromaDB
                                                      ↓
User Query → Vector Search → Context Retrieval → LLM → Response
                                                      ↓
Session Management ← Redis ← Chat History
```

## Getting Started

### Prerequisites

-   Node.js (v14 or higher)
-   Redis server running on localhost:6379
-   ChromaDB server running on localhost:8000
-   API keys for Hugging Face and Google Gemini

### Environment Setup

Create a `.env` file with:

```env
PORT=5000
HUGGINGFACE_API_KEY=your_hf_key
GEMINI_API_KEY=your_gemini_key
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password
```

### Installation

```bash
# Install dependencies
npm install

# Start the server
npm start

# Development mode with auto-restart
npm run dev
```

### Database Setup

1. **Start ChromaDB**:

    ```bash
    docker-compose up -d
    ```

2. **Start Redis**:

    ```bash
    redis-server
    ```

3. **Collect news data** (optional):
    ```bash
    npm run collect-news
    ```

## API Endpoints

### Chat & Query

-   `POST /api/send-message` - Send user query and get AI response
-   `POST /api/news/collect` - Trigger news data collection

### Session Management

-   `POST /api/session/create` - Create new chat session
-   `GET /api/session/:id/history` - Get session chat history
-   `DELETE /api/session/:id` - Clear session data
-   `GET /api/session/:id/validate` - Validate session exists

### Health

-   `GET /` - Basic server status
-   `GET /health` - Health check endpoint

## Data Flow

1. **News Collection**: Scrapes news articles and stores embeddings in ChromaDB
2. **Query Processing**: User queries are converted to embeddings
3. **Vector Search**: Similar content is retrieved from ChromaDB
4. **Context Building**: Retrieved content is formatted as context
5. **AI Generation**: Gemini generates response using context
6. **Session Storage**: Chat history is stored in Redis

## Configuration

-   **Batch Size**: 10 articles per processing batch
-   **Session TTL**: 24 hours
-   **Collection Name**: "news_corpus"
-   **CORS**: Enabled for all origins

## Utility Scripts

-   `clear-data.js` - Clear ChromaDB collections
-   `view-data.js` - View stored data
-   `test-news.js` - Test news collection
-   `run-news-collection.js` - Standalone news collection

## Monitoring

The server includes:

-   Morgan logging for HTTP requests
-   Redis connection monitoring
-   Error handling and logging
-   Health check endpoints
