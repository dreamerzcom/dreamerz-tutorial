#!/bin/bash

# Kill frontend server on port 3000
echo "Killing frontend server on port 3000..."
lsof -ti:3000 | xargs kill -9 2>/dev/null || echo "No process found on port 3000"

sleep 2

cd frontend

# Clear Webpack/CRA build cache
echo "Clearing build cache..."
rm -rf node_modules/.cache
echo "Cache cleared!"

# Remove old build output
if [ -d "build" ]; then
  rm -rf build
  echo "Old build removed!"
fi

# Start frontend dev server
echo "Starting frontend server..."
npm start
