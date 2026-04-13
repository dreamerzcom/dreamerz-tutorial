#!/bin/bash

# Kill frontend server on port 3000
echo "Killing frontend server on port 3000..."
lsof -ti:3000 | xargs kill -9 2>/dev/null || echo "No process found on port 3000"

# Wait a moment for the port to be released
sleep 2

# Start frontend server
echo "Starting frontend server..."
cd frontend
npm start
