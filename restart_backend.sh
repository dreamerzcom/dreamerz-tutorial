#!/bin/bash

# Kill backend server on port 8001
echo "Killing backend server on port 8001..."
lsof -ti:8001 | xargs kill -9 2>/dev/null || echo "No process found on port 8001"

# Wait a moment for the port to be released
sleep 2

# Start backend server
echo "Starting backend server..."
cd backend
source venv/bin/activate
python -m uvicorn server:app --host 0.0.0.0 --port 8001 --reload
