#!/bin/bash

# burhan2ws - Start All Services
# This script starts backend, frontend, and worker in one terminal

echo "🚀 Starting burhan2ws services..."
echo ""

# Kill any existing processes on ports 3000 and 5173
echo "🧹 Cleaning up existing processes..."
pkill -f "node.*burhan2ws" 2>/dev/null
pkill -f "vite" 2>/dev/null
sleep 2

# Start backend
echo "📡 Starting Backend (port 3000)..."
cd /var/dev/moon/burhan2ws
npm run dev > logs/backend.log 2>&1 &
BACKEND_PID=$!
echo "   ✓ Backend started (PID: $BACKEND_PID)"

# Wait for backend to start
sleep 3

# Start worker
echo "⚙️  Starting Worker..."
npm run worker > logs/worker.log 2>&1 &
WORKER_PID=$!
echo "   ✓ Worker started (PID: $WORKER_PID)"

# Wait for worker to start
sleep 2

# Start frontend
echo "🎨 Starting Frontend (port 5173)..."
cd /var/dev/moon/burhan2ws/frontend
npm run dev > logs/frontend.log 2>&1 &
FRONTEND_PID=$!
echo "   ✓ Frontend started (PID: $FRONTEND_PID)"

echo ""
echo "🎉 All services started!"
echo ""
echo "📊 Status:"
echo "   Backend:  http://localhost:3000"
echo "   Frontend: http://localhost:5173"
echo ""
echo "📁 Logs:"
echo "   Backend:  tail -f /var/dev/moon/burhan2ws/logs/backend.log"
echo "   Worker:   tail -f /var/dev/moon/burhan2ws/logs/worker.log"
echo "   Frontend: tail -f /var/dev/moon/burhan2ws/logs/frontend.log"
echo ""
echo "🛑 To stop all services: pkill -f 'node.*burhan2ws'"
echo ""

# Create logs directory if not exists
mkdir -p /var/dev/moon/burhan2ws/logs

# Wait for processes
wait $BACKEND_PID $WORKER_PID $FRONTEND_PID
