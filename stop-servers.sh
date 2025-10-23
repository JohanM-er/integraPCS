#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== integraPCS Server Stop Script ===${NC}"
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
echo -e "${RED}=== Stopping all servers ===${NC}"
echo

# Kill processes on specific ports
kill_port 3000 "GraphQL API"
kill_port 5173 "Web Frontend"
kill_port 6006 "Storybook"

# Kill all node processes
kill_node_processes

# Wait a moment for ports to be released
sleep 2

echo -e "${GREEN}=== All servers stopped ===${NC}"
echo
echo "All development servers have been stopped."
echo "To start them again, run: ./restart-servers.sh"
