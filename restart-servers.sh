#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== integraPCS Server Restart Script ===${NC}"
echo

# Function to kill processes on a specific port
kill_port() {
    local port=$1
    local name=$2
    echo -e "${YELLOW}Checking port $port ($name)...${NC}"
    
    # Get PIDs using the port
    pids=$(lsof -ti :$port 2>/dev/null)
    
    if [ ! -z "$pids" ]; then
        echo -e "${RED}Found processes on port $port: $pids${NC}"
        for pid in $pids; do
            echo "  Killing process $pid..."
            kill -9 $pid 2>/dev/null
        done
        echo -e "${GREEN}Port $port cleared${NC}"
    else
        echo -e "${GREEN}Port $port is already free${NC}"
    fi
    echo
}

# Function to kill all node processes related to this project
kill_node_processes() {
    echo -e "${YELLOW}Cleaning up all project Node.js processes...${NC}"
    local project_name
    project_name=$(basename "$(pwd)")

    # Kill API server processes
    pkill -f "node dist/apps/api/main.js" 2>/dev/null

    # Kill Vite dev server processes
    pkill -f "vite.*5173" 2>/dev/null

    # Kill Storybook processes
    pkill -f "storybook.*6006" 2>/dev/null

    # Kill any remaining node processes for this project
    pkill -f "node.*${project_name}" 2>/dev/null

    echo -e "${GREEN}Node processes cleaned up${NC}"
    echo
}

# Step 1: Kill all processes
echo -e "${RED}=== STEP 1: Shutting down all servers ===${NC}"
echo

# Kill processes on specific ports
kill_port 3000 "GraphQL API"
kill_port 5173 "Web Frontend"
kill_port 6006 "Storybook"

# Kill all node processes
kill_node_processes

# Wait a moment for ports to be released
sleep 2

# Step 2: Start servers
echo -e "${GREEN}=== STEP 2: Starting servers ===${NC}"
echo

# Check if we're in the project root
if [ ! -f "pnpm-workspace.yaml" ]; then
    echo -e "${RED}Error: Not in project root directory${NC}"
    echo "Please run this script from the integraPCS directory"
    exit 1
fi

# Check if Docker services are running
echo -e "${YELLOW}Checking Docker services...${NC}"
if ! docker-compose ps | grep -q "Up"; then
    echo -e "${YELLOW}Docker services not running. Starting them...${NC}"
    docker-compose up -d
    echo "Waiting for Docker services to be ready..."
    sleep 5
else
    echo -e "${GREEN}Docker services are already running${NC}"
fi
echo

# Capture project root at the beginning
PROJECT_ROOT=$(pwd)

# Start development servers using Nx
echo -e "${YELLOW}Starting development servers with Nx...${NC}"
echo "🚀 Starting integraPCS Development Environment (Nx)"
echo "🔧 Serving projects: api, web"

# Start servers in background and capture output
pnpm nx run-many -t serve --projects=api,web --parallel > "$PROJECT_ROOT/dev-servers.log" 2>&1 &
SERVERS_PID=$!

echo "Development servers started with PID: $SERVERS_PID"
echo "Logs: tail -f dev-servers.log"
echo

# Start Storybook
echo -e "${YELLOW}Starting Storybook...${NC}"
cd "$PROJECT_ROOT/frontend"
npm run storybook > "$PROJECT_ROOT/storybook.log" 2>&1 &
STORYBOOK_PID=$!
echo "Storybook started with PID: $STORYBOOK_PID"
echo "Logs: tail -f storybook.log"
cd "$PROJECT_ROOT"
echo

# Wait for servers to start
echo "Waiting for servers to start..."
sleep 8

# Check if servers started successfully
echo -e "${YELLOW}Checking server status...${NC}"

# Check API server
if lsof -i :3000 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ GraphQL API server started successfully on port 3000${NC}"
else
    echo -e "${RED}❌ GraphQL API server failed to start!${NC}"
fi

# Check Web server
if lsof -i :5173 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Web frontend server started successfully on port 5173${NC}"
else
    echo -e "${RED}❌ Web frontend server failed to start!${NC}"
fi

# Check Storybook
if lsof -i :6006 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Storybook started successfully on port 6006${NC}"
else
    echo -e "${RED}❌ Storybook failed to start!${NC}"
fi

echo
echo -e "${GREEN}=== Server restart complete ===${NC}"
echo
echo "Active servers:"
echo "  - GraphQL API: http://localhost:3000/graphql"
echo "  - Web Frontend: http://localhost:5173"
echo "  - Storybook: http://localhost:6006"
echo "  - Docker services: Check with 'docker-compose ps'"
echo
echo "To view logs:"
echo "  - All servers: tail -f dev-servers.log"
echo "  - Storybook: tail -f storybook.log"
echo "  - Docker services: docker-compose logs"
echo
echo "To stop all servers again, run: ./restart-servers.sh"
echo "To stop gracefully, press Ctrl+C in the terminal where servers are running"
