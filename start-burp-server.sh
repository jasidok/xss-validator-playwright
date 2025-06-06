#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Print banner
echo -e "${MAGENTA}"
echo "====================================================="
echo "  🎯 XSS Validator - Burp Suite Integration Server"
echo "  Modern Playwright-based XSS Detection v2.0"
echo "====================================================="
echo -e "${NC}"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}ERROR: Node.js is not installed${NC}"
    echo "Please install Node.js from https://nodejs.org/"
    exit 1
fi

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}ERROR: package.json not found${NC}"
    echo "Please run this script from the project root directory"
    exit 1
fi

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing dependencies...${NC}"
    npm install
    if [ $? -ne 0 ]; then
        echo -e "${RED}ERROR: Failed to install dependencies${NC}"
        exit 1
    fi
fi

# Display configuration
echo -e "${GREEN}Starting XSS Validator server for Burp Suite...${NC}"
echo
echo -e "${CYAN}Configuration:${NC}"
echo "  - Host: 127.0.0.1"
echo "  - Port: 8093"
echo "  - Optimized for Burp Suite integration"
echo
echo -e "${CYAN}Instructions:${NC}"
echo "  1. Load burp-extension/ModernXSSValidator.py in Burp Suite"
echo "  2. Configure extension to use 127.0.0.1:8093"
echo "  3. Enable auto-testing and start using Intruder!"
echo
echo -e "${YELLOW}Press Ctrl+C to stop the server when done.${NC}"
echo

# Function to handle cleanup on exit
cleanup() {
    echo
    echo -e "${YELLOW}🛑 Stopping server...${NC}"
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Start the server
node start-burp-suite-server.js

echo
echo -e "${GREEN}👋 Server stopped gracefully${NC}"