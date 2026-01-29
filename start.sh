#!/bin/bash

# burhan2ws Quick Start Script

echo "🚀 burhan2ws Quick Start"
echo ""

# Kill any existing processes
echo "🧹 Stopping existing processes..."
pkill -f "node.*burhan2ws" 2>/dev/null
pkill -f "node.*vite" 2>/dev/null
sleep 2

# Check PostgreSQL
echo "📊 Checking PostgreSQL..."
if ! sudo -u postgres psql -c "SELECT 1" 2>/dev/null; then
    echo "❌ PostgreSQL is not running or password is incorrect"
    echo ""
    echo "Try starting PostgreSQL:"
    echo "  sudo systemctl start postgresql"
    echo "  # OR reset postgres password"
    echo "  sudo -u postgres psql -c \"ALTER USER postgres WITH PASSWORD 'yourpassword';\""
    echo ""
    echo "Then run this script again."
    exit 1
fi
echo "✅ PostgreSQL is running"

# Check Redis
echo "🔴 Checking Redis..."
if ! redis-cli ping 2>/dev/null | grep -q PONG; then
    echo "⚠️  Redis is not running"
    echo "   BullMQ workers may not work properly"
    echo "   Start Redis: sudo systemctl start redis"
else
    echo "✅ Redis is running"
fi

# Run migrations
echo ""
echo "🗄️  Running Prisma migrations..."
cd /var/dev/moon/burhan2ws
npm run prisma:generate

if npm run prisma:migrate 2>&1 | grep -q "Error"; then
    echo "❌ Migration failed"
    echo "   Check DATABASE_URL in .env"
    echo "   Current DATABASE_URL: $(grep DATABASE_URL .env | cut -d'=' -f2)"
    exit 1
fi

echo "✅ Migrations completed"

# Start backend and workers in background
echo ""
echo "📡 Starting Backend and Workers..."
cd /var/dev/moon/burhan2ws
npm run dev > logs/backend.log 2>&1 &
BACKEND_PID=$!
echo "   Backend PID: $BACKEND_PID"

# Wait for backend to start
echo "⏳ Waiting for backend to start..."
sleep 5

# Check if backend is still running
if ! ps -p $BACKEND_PID > /dev/null; then
    echo "❌ Backend failed to start!"
    echo ""
    echo "Check logs:"
    echo "  tail -f /var/dev/moon/burhan2ws/logs/backend.log"
    echo ""
    echo "Last 20 lines from backend.log:"
    tail -20 /var/dev/moon/burhan2ws/logs/backend.log
    exit 1
fi

# Check if backend is healthy
echo "🔍 Checking backend health..."
if ! curl -s http://localhost:3000/health > /dev/null; then
    echo "❌ Backend is not responding"
    echo "   Check logs: tail -f /var/dev/moon/burhan2ws/logs/backend.log"
    exit 1
fi

echo "✅ Backend is running"

# Start frontend
echo ""
echo "🎨 Starting Frontend..."
cd /var/dev/moon/burhan2ws/frontend
npm run dev > logs/frontend.log 2>&1 &
FRONTEND_PID=$!
echo "   Frontend PID: $FRONTEND_PID"

# Wait for frontend
echo "⏳ Waiting for frontend to start..."
sleep 3

# Check if frontend is running
if ! ps -p $FRONTEND_PID > /dev/null; then
    echo "❌ Frontend failed to start!"
    echo "   Check logs: tail -f /var/dev/moon/burhan2ws/logs/frontend.log"
    exit 1
fi

# Success!
echo ""
echo "🎉 All services started successfully!"
echo ""
echo "📊 Services:"
echo "   Backend:  http://localhost:3000"
echo "   Frontend: http://localhost:5175"
echo ""
echo "📁 Logs:"
echo "   Backend:  tail -f /var/dev/moon/burhan2ws/logs/backend.log"
echo "   Frontend: tail -f /var/dev/moon/burhan2ws/logs/frontend.log"
echo ""
echo "🛑 To stop all services: pkill -f 'node.*burhan2ws'"
echo ""
echo "Press Ctrl+C to stop this monitoring script (services will continue running)"

# Monitor loop
while true; do
    sleep 10
    # Check if processes are still running
    if ! ps -p $BACKEND_PID > /dev/null 2>&1; then
        echo ""
        echo "❌ Backend stopped unexpectedly!"
        break
    fi
    if ! ps -p $FRONTEND_PID > /dev/null 2>&1; then
        echo ""
        echo "❌ Frontend stopped unexpectedly!"
        break
    fi
done
