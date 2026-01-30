#!/bin/bash

# Define ports
FRONTEND_PORT=2112
BACKEND_PORT=2113

echo "Starting iComptaBudget..."

# Function to kill process on a specific port
kill_process_on_port() {
  local port=$1
  echo "Checking port $port..."
  
  # Find PIDs using the port
  local pids=$(lsof -ti tcp:$port)

  if [ -n "$pids" ]; then
    echo "Port $port is in use by process(es): $pids. Killing..."
    # Kill each PID
    echo "$pids" | xargs kill -9
    echo "Process(es) on port $port killed."
  else
    echo "Port $port is free."
  fi
}

# Check and clear ports
kill_process_on_port $FRONTEND_PORT
kill_process_on_port $BACKEND_PORT

echo "All ports are clear."
echo "Starting application..."

# Start the application
npm run dev:all