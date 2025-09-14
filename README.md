# RAG-Powered News Chatbot

A smart chatbot that answers questions about news using AI. It reads news from multiple sources, understands your questions, and gives intelligent answers using Google Gemini AI.

## 🚀 Live Demo

-   **Frontend**: [Netlify Deployment](https://your-netlify-url.netlify.app)
-   **Backend**: AWS EC2 (13.235.24.172:5050)

## ✨ What it does

-   📰 Reads 300+ news articles from 15+ sources
-   🤖 Answers questions using AI (Google Gemini)
-   💬 Remembers your chat history
-   🔄 Works in real-time

## 🛠 Tech Stack

**Backend:** Node.js, Express, ChromaDB, Redis, Hugging Face, Google Gemini
**Frontend:** React, CSS
**Deployment:** AWS EC2, Netlify

## 🚀 Quick Start

### 1. Clone & Install

```bash
git clone https://github.com/yourusername/rag-news-chatbot.git
cd rag-news-chatbot

# Backend
cd server
npm install

# Frontend
cd ../client
npm install
```

### 2. Setup Environment

```bash
# In server directory
cp .env.example .env
nano .env
```

Add your API keys:

```bash
HUGGINGFACE_API_KEY=your_key_here
GEMINI_API_KEY=your_key_here
REDIS_HOST=localhost
REDIS_PORT=6379
```

### 3. Start Services

```bash
# Start ChromaDB
docker-compose up -d

# Start Redis
redis-server

# Start backend
cd server
npm start

# Start frontend
cd client
npm start
```

### 4. Collect News Data

```bash
cd server
npm run collect-news
```

## 📁 Project Structure

```
rag-news-chatbot/
├── client/          # React frontend
├── server/          # Node.js backend
├── README.md        # This file
└── docker-compose.yml
```

## 🔧 How it works

1. **News Collection**: Scrapes RSS feeds from BBC, CNN, Reuters, etc.
2. **AI Processing**: Creates embeddings using Hugging Face
3. **Vector Storage**: Stores in ChromaDB for fast search
4. **Smart Answers**: Uses Google Gemini to generate responses
5. **Session Memory**: Redis stores your chat history

## 📡 API Endpoints

-   `POST /api/session/create` - Create new chat session
-   `GET /api/session/:id/history` - Get chat history
-   `DELETE /api/session/:id` - Clear session
-   `POST /api/send-message` - Send message to chatbot

## 🚀 Deployment

### Backend (AWS EC2)

```bash
# Install Redis
sudo apt install redis-server -y
sudo systemctl start redis-server

# Deploy app
git clone <repo>
cd server
npm install
pm2 start server.js --name "rag-chatbot"
```

### Frontend (Netlify)

1. Connect GitHub repo to Netlify
2. Build command: `npm run build`
3. Publish directory: `build`
4. Add redirect rule in `netlify.toml`

## 🔄 Session Management

-   Each user gets a unique session ID
-   Chat history stored in Redis (24-hour TTL)
-   Sessions persist across page refreshes
-   Reset button clears conversation

## 🐛 Troubleshooting

**Redis not working?**

```bash
sudo systemctl status redis-server
sudo systemctl restart redis-server
```

**ChromaDB issues?**

```bash
docker ps | grep chroma
docker-compose restart
```

**API errors?**

-   Check your API keys in `.env`
-   Verify keys have proper permissions

## 📄 License

MIT License - see LICENSE file for details.

## 🙏 Built for

Voosh Full Stack Developer Assignment

---

**Questions?** Email: richa@voosh.in
