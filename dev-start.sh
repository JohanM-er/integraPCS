#!/bin/bash

# Development startup script for integraPCS Application
echo "🚀 Starting integraPCS Development Environment..."

# Build shared packages (skip if directory doesn't exist)
echo "📦 Building shared packages..."
if [ -d "packages/shared-types" ]; then
    cd packages/shared-types && npm run build
    if [ $? -ne 0 ]; then
        echo "❌ Failed to build shared-types package"
        exit 1
    fi
    cd ../..
else
    echo "⚠️  packages/shared-types not found, skipping..."
fi

# Start backend (GraphQL on port 3000) in background
echo "🔧 Starting backend GraphQL server (http://localhost:3000/graphql)..."
cd backend
npm run dev > backend.log 2>&1 &
BACKEND_PID=$!
echo "Backend started with PID: $BACKEND_PID"

# Give backend time to start
sleep 3

# Start frontend on Vite (5173)
echo "🎨 Starting frontend server (http://localhost:5173)..."
cd ../frontend
npm run dev

# Cleanup function
cleanup() {
    echo "🛑 Stopping servers..."
    kill $BACKEND_PID 2>/dev/null
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Wait for frontend to exit
wait