# RAG Client

A React-based frontend application for a Retrieval-Augmented Generation (RAG) chat system that allows users to interact with news data through natural language queries.

## Features

-   **Interactive Chat Interface**: Real-time chat with the RAG system
-   **Session Management**: Persistent chat sessions with history
-   **Responsive Design**: Clean and modern UI with CSS styling
-   **Error Handling**: Graceful error handling and user feedback
-   **Loading States**: Visual feedback during message processing

## Tech Stack

-   **React 18.2.0** - Frontend framework
-   **React Scripts 5.0.1** - Build tools and development server
-   **CSS3** - Styling and responsive design

## Components

-   `App.js` - Main application component with state management
-   `ChatBox.js` - Chat message display component
-   `InputArea.js` - Message input and send functionality

## Getting Started

### Prerequisites

-   Node.js (v14 or higher)
-   npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm start
```

The application will open at `http://localhost:3000`

### Available Scripts

-   `npm start` - Runs the app in development mode
-   `npm build` - Builds the app for production
-   `npm test` - Launches the test runner
-   `npm eject` - Ejects from Create React App (one-way operation)

## API Integration

The client communicates with the RAG server through the following endpoints:

-   `POST /api/send-message` - Send chat messages
-   `POST /api/session/create` - Create new chat session
-   `GET /api/session/:id/history` - Load session history
-   `DELETE /api/session/:id` - Clear session

## Session Management

-   Sessions are automatically created on first load
-   Session IDs are stored in localStorage for persistence
-   Chat history is maintained across browser refreshes
-   Users can reset sessions to start fresh

## Deployment

The app is configured for deployment on:

-   **Netlify** (netlify.toml)
-   **Vercel** (vercel.json)

Build the production version:

```bash
npm run build
```

The build artifacts will be in the `build/` directory.
