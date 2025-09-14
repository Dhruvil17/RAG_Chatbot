# Redis Session Management for RAG Chatbot

## Overview

This implementation uses Redis as an in-memory database to store chat session history with automatic TTL (Time To Live) management.

## Architecture

### Session Storage Structure

```
Key: chat_session:{sessionId}
Value: {
  "id": "uuid",
  "createdAt": "2025-01-15T10:30:00.000Z",
  "lastActivity": "2025-01-15T10:30:00.000Z",
  "messages": [
    {
      "type": "user",
      "content": "What are the latest news?",
      "timestamp": "2025-01-15T10:30:00.000Z"
    },
    {
      "type": "assistant",
      "content": "Based on the latest news...",
      "timestamp": "2025-01-15T10:30:05.000Z"
    }
  ]
}
```

## Configuration

### Environment Variables

```bash
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password  # Optional

# Session TTL (in seconds)
SESSION_TTL=86400  # 24 hours
```

### TTL Configuration

-   **Default TTL**: 24 hours (86400 seconds)
-   **Auto-refresh**: TTL resets on each session access
-   **Key Pattern**: `chat_session:{sessionId}`

## API Endpoints

### 1. Create Session

```http
POST /api/session/create
```

**Response:**

```json
{
    "success": true,
    "sessionId": "uuid-here",
    "message": "Session created successfully"
}
```

### 2. Get Session History

```http
GET /api/session/{sessionId}/history
```

**Response:**

```json
{
  "success": true,
  "messages": [...],
  "sessionId": "uuid-here",
  "createdAt": "2025-01-15T10:30:00.000Z",
  "lastActivity": "2025-01-15T10:30:00.000Z"
}
```

### 3. Clear Session

```http
DELETE /api/session/{sessionId}
```

**Response:**

```json
{
    "success": true,
    "message": "Session cleared successfully"
}
```

### 4. Validate Session

```http
GET /api/session/{sessionId}/validate
```

**Response:**

```json
{
    "success": true,
    "valid": true,
    "sessionId": "uuid-here"
}
```

### 5. Send Message (with Session)

```http
POST /api/send-message
Headers:
  session-id: {sessionId}
Body:
  {
    "question": "What are the latest news?"
  }
```

**Response:**

```json
{
    "success": true,
    "reply": "Based on the latest news...",
    "sessionID": "uuid-here"
}
```

## Session Management Features

### 1. Automatic Session Creation

-   If no session ID provided, creates new session
-   If invalid session ID provided, creates new session
-   Returns session ID in response

### 2. Message Storage

-   Stores both user questions and bot responses
-   Includes timestamps for each message
-   Maintains conversation context

### 3. TTL Management

-   **Automatic Refresh**: TTL resets on each session access
-   **Configurable**: Set via `SESSION_TTL` environment variable
-   **Cleanup**: Expired sessions are automatically removed

### 4. Session Validation

-   Validates session existence before operations
-   Handles invalid/expired sessions gracefully
-   Auto-creates new sessions when needed

## Redis Commands Used

### Key Operations

```bash
# Set session with TTL
SETEX chat_session:{sessionId} 86400 '{sessionData}'

# Get session
GET chat_session:{sessionId}

# Delete session
DEL chat_session:{sessionId}

# Check if key exists
EXISTS chat_session:{sessionId}
```

### TTL Operations

```bash
# Set TTL
EXPIRE chat_session:{sessionId} 86400

# Get remaining TTL
TTL chat_session:{sessionId}

# Remove TTL (persist key)
PERSIST chat_session:{sessionId}
```

## Performance Considerations

### 1. Memory Usage

-   Each session: ~1-5KB (depending on message count)
-   1000 active sessions: ~1-5MB
-   Monitor with `INFO memory` command

### 2. TTL Strategy

-   **Short TTL**: Reduces memory usage, may lose context
-   **Long TTL**: Better user experience, higher memory usage
-   **Recommended**: 24 hours for chat applications

### 3. Cache Warming

```javascript
// Pre-warm frequently accessed sessions
async function warmCache(sessionIds) {
    for (const sessionId of sessionIds) {
        await getSession(sessionId);
    }
}
```

## Monitoring & Maintenance

### 1. Redis Monitoring

```bash
# Check memory usage
redis-cli INFO memory

# Check key count
redis-cli DBSIZE

# Check TTL distribution
redis-cli --scan --pattern "chat_session:*" | xargs -I {} redis-cli TTL {}
```

### 2. Health Checks

```javascript
// Check Redis connection
redis.ping().then(() => console.log("Redis connected"));

// Check session count
redis
    .keys("chat_session:*")
    .then((keys) => console.log(`Active sessions: ${keys.length}`));
```

### 3. Cleanup Strategies

```bash
# Manual cleanup of expired keys
redis-cli --scan --pattern "chat_session:*" | xargs -I {} redis-cli TTL {} | grep -1 | wc -l

# Force cleanup (use with caution)
redis-cli FLUSHDB
```

## Security Considerations

### 1. Session ID Security

-   Uses UUID v4 (cryptographically secure)
-   No predictable patterns
-   128-bit entropy

### 2. Data Privacy

-   Sessions stored in memory only
-   Automatic expiration
-   No persistent storage

### 3. Access Control

-   No authentication required (stateless)
-   Session-based isolation
-   No cross-session data access

## Error Handling

### 1. Redis Connection Issues

-   Graceful fallback to new sessions
-   Error logging for monitoring
-   No data loss for active sessions

### 2. Session Not Found

-   Auto-create new session
-   Return appropriate error messages
-   Maintain API consistency

### 3. Memory Pressure

-   TTL-based cleanup
-   Monitor Redis memory usage
-   Scale horizontally if needed

## Deployment Notes

### 1. Redis Setup

```bash
# Install Redis
sudo apt-get install redis-server

# Start Redis
sudo systemctl start redis-server

# Enable auto-start
sudo systemctl enable redis-server
```

### 2. Docker Deployment

```yaml
version: "3.8"
services:
    redis:
        image: redis:7-alpine
        ports:
            - "6379:6379"
        command: redis-server --appendonly yes
        volumes:
            - redis_data:/data

    app:
        build: .
        environment:
            - REDIS_HOST=redis
            - REDIS_PORT=6379
        depends_on:
            - redis

volumes:
    redis_data:
```

### 3. Production Considerations

-   Use Redis Cluster for high availability
-   Set up Redis persistence (RDB/AOF)
-   Monitor memory usage and TTL distribution
-   Implement backup strategies
