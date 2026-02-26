#!/bin/bash
# Logistics CRM - Startup Script

set -e

echo "🚢 Starting Logistics CRM System..."
echo ""

# Start PostgreSQL
echo "📦 Starting PostgreSQL..."
sudo pg_ctlcluster 15 main start 2>/dev/null || true
sleep 2

# Check if DB exists
sudo -u postgres psql -lqt | cut -d \| -f 1 | grep -qw logistics_crm || {
  echo "🗄️ Creating database..."
  sudo -u postgres psql -c "CREATE DATABASE logistics_crm;"
  sudo -u postgres psql -d logistics_crm -f /home/user/webapp/backend/src/db/schema.sql
  cd /home/user/webapp/backend && npm run build && node dist/db/seed.js
}

# Start Backend
echo "🔧 Starting Backend API (port 5000)..."
pkill -f "node dist/server" 2>/dev/null || true
sleep 1
cd /home/user/webapp/backend
node dist/server.js > /tmp/backend.log 2>&1 &
BACKEND_PID=$!
echo "   Backend PID: $BACKEND_PID"

# Wait for backend
sleep 3
if curl -s http://localhost:5000/health > /dev/null; then
  echo "   ✅ Backend is running"
else
  echo "   ❌ Backend failed to start. Check /tmp/backend.log"
  exit 1
fi

# Start Frontend
echo "🌐 Starting Frontend (port 3000)..."
pkill -f "next start" 2>/dev/null || true
sleep 1
cd /home/user/webapp/frontend
node_modules/.bin/next start -p 3000 > /tmp/frontend.log 2>&1 &
FRONTEND_PID=$!
echo "   Frontend PID: $FRONTEND_PID"

# Wait for frontend
sleep 5
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 | grep -q "200"; then
  echo "   ✅ Frontend is running"
else
  echo "   ❌ Frontend failed to start. Check /tmp/frontend.log"
  exit 1
fi

echo ""
echo "═══════════════════════════════════════════"
echo "  🚀 Logistics CRM is LIVE!"
echo "═══════════════════════════════════════════"
echo "  Frontend: http://localhost:3000"
echo "  Backend:  http://localhost:5000"
echo ""
echo "  Demo Logins:"
echo "  Admin:   admin@logisticscrm.com / Admin@1234"
echo "  Sales:   sales@logisticscrm.com / Sales@1234"
echo "  Ops:     ops@logisticscrm.com   / Ops@1234"
echo "  Finance: finance@logisticscrm.com / Finance@1234"
echo "  Support: support@logisticscrm.com / Support@1234"
echo "═══════════════════════════════════════════"
