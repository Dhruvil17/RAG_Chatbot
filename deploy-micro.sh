#!/bin/bash

echo "🚀 Starting RAG Server Deployment on AWS EC2 t2.micro..."

# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Docker
sudo apt-get install -y docker.io
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker ubuntu

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Install Redis
sudo apt install -y redis-server
sudo systemctl start redis-server
sudo systemctl enable redis-server

# Navigate to server directory
cd server

# Install dependencies
npm install

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "Creating .env file..."
    cat > .env << EOF
GEMINI_API_KEY=your_gemini_api_key_here
PORT=5050
REDIS_HOST=localhost
REDIS_PORT=6379
EOF
    echo "⚠️  Please edit .env file and add your Gemini API key!"
    echo "Run: nano .env"
    exit 1
fi

# Start ChromaDB with micro optimization
echo "🐳 Starting ChromaDB (t2.micro optimized)..."
docker-compose -f docker-compose-micro.yml up -d

# Wait for ChromaDB to be ready
echo "⏳ Waiting for ChromaDB to start..."
sleep 60

# Check if ChromaDB is running
echo "🔍 Checking ChromaDB status..."
if curl -f http://localhost:8000/api/v1/heartbeat > /dev/null 2>&1; then
    echo "✅ ChromaDB is running!"
else
    echo "❌ ChromaDB failed to start. Check logs:"
    docker logs server-chromadb-1
    exit 1
fi

# Collect news data (micro version)
echo "📰 Collecting news data (t2.micro optimized)..."
npm run collect-news-micro

# Check if news collection was successful
if [ $? -eq 0 ]; then
    echo "✅ News collection completed successfully!"
    echo "🚀 Starting RAG server..."
    npm start
else
    echo "❌ News collection failed. Check logs above."
    exit 1
fi
