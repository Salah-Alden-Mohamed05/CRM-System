#!/bin/bash
# ============================================================
# Logistics CRM – Startup Script
# Usage: bash start.sh [--seed] [--reset]
#   --seed   : Run the seed script (inserts roles if missing)
#   --reset  : Drop and recreate the database (WARNING: destroys ALL data)
# ============================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOAD_SEED=false
RESET_DB=false

# Parse flags
for arg in "$@"; do
  case $arg in
    --seed)  LOAD_SEED=true ;;
    --reset) RESET_DB=true  ;;
  esac
done

echo -e "${BLUE}╔══════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║       Logistics CRM – Starting Up            ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════╝${NC}"
echo ""

# ── Helper: run psql against the app database ───────────────
run_psql_db() {
  local db="$1"; shift
  if sudo -u postgres psql -d "$db" "$@" > /dev/null 2>&1; then return 0; fi
  if [ -f "$SCRIPT_DIR/backend/.env" ]; then
    DB_USER_ENV=$(grep "^DB_USER="     "$SCRIPT_DIR/backend/.env" | cut -d= -f2 | tr -d '"')
    DB_PASS_ENV=$(grep "^DB_PASSWORD=" "$SCRIPT_DIR/backend/.env" | cut -d= -f2 | tr -d '"')
  fi
  PGPASSWORD="${DB_PASS_ENV:-postgres}" psql -U "${DB_USER_ENV:-postgres}" -d "$db" "$@" > /dev/null 2>&1
}

run_psql_cmd() {
  local cmd="$1"
  if result=$(sudo -u postgres psql -tAc "$cmd" 2>/dev/null); then echo "$result"; return 0; fi
  if [ -f "$SCRIPT_DIR/backend/.env" ]; then
    DB_USER_ENV=$(grep "^DB_USER="     "$SCRIPT_DIR/backend/.env" | cut -d= -f2 | tr -d '"')
    DB_PASS_ENV=$(grep "^DB_PASSWORD=" "$SCRIPT_DIR/backend/.env" | cut -d= -f2 | tr -d '"')
    DB_NAME_ENV=$(grep "^DB_NAME="     "$SCRIPT_DIR/backend/.env" | cut -d= -f2 | tr -d '"')
  fi
  PGPASSWORD="${DB_PASS_ENV:-postgres}" psql -U "${DB_USER_ENV:-postgres}" \
    -d "${DB_NAME_ENV:-logistics_crm}" -tAc "$cmd" 2>/dev/null || echo "0"
}

# ── 1. Start PostgreSQL ──────────────────────────────────────
echo -e "${YELLOW}▶  Starting PostgreSQL...${NC}"
sudo pg_ctlcluster 16 main start 2>/dev/null || \
sudo pg_ctlcluster 15 main start 2>/dev/null || \
sudo pg_ctlcluster 14 main start 2>/dev/null || \
sudo service postgresql start 2>/dev/null || \
brew services start postgresql@16 2>/dev/null || \
brew services start postgresql 2>/dev/null || true
sleep 2
echo -e "${GREEN}   ✅ PostgreSQL ready${NC}"

# ── 2. Read DB name from .env ────────────────────────────────
DB_NAME="logistics_crm"
if [ -f "$SCRIPT_DIR/backend/.env" ]; then
  DB_NAME_ENV=$(grep "^DB_NAME=" "$SCRIPT_DIR/backend/.env" | cut -d= -f2 | tr -d '"')
  DB_NAME="${DB_NAME_ENV:-logistics_crm}"
fi

# ── 3. Handle --reset flag ───────────────────────────────────
if [ "$RESET_DB" = true ]; then
  echo ""
  echo -e "${RED}⚠️   --reset will DESTROY all data in '${DB_NAME}'!${NC}"
  read -rp "   Type 'yes' to confirm: " CONFIRM
  if [ "$CONFIRM" = "yes" ]; then
    echo "   Dropping database..."
    sudo -u postgres psql -c "DROP DATABASE IF EXISTS ${DB_NAME};" 2>/dev/null || \
    PGPASSWORD="${DB_PASS_ENV:-postgres}" psql -U "${DB_USER_ENV:-postgres}" \
      -c "DROP DATABASE IF EXISTS ${DB_NAME};" 2>/dev/null || true
    echo -e "${GREEN}   ✅ Database dropped – will be recreated fresh${NC}"
    LOAD_SEED=true
  else
    echo "   Reset cancelled."
    RESET_DB=false
  fi
fi

# ── 4. Create DB + apply schema ──────────────────────────────
echo -e "${YELLOW}▶  Checking database...${NC}"

DB_EXISTS=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}';" 2>/dev/null || echo "")
if [ -z "$DB_EXISTS" ]; then
  echo "   Creating database '${DB_NAME}'..."
  sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME};" 2>/dev/null || \
  PGPASSWORD="${DB_PASS_ENV:-postgres}" psql -U "${DB_USER_ENV:-postgres}" \
    -c "CREATE DATABASE ${DB_NAME};" 2>/dev/null || true
fi

echo "   Applying schema (idempotent)..."
if sudo -u postgres psql -d "${DB_NAME}" -f "$SCRIPT_DIR/backend/src/db/schema.sql" > /dev/null 2>&1; then
  echo -e "${GREEN}   ✅ Schema ready${NC}"
elif PGPASSWORD="${DB_PASS_ENV:-postgres}" psql -U "${DB_USER_ENV:-postgres}" \
    -d "${DB_NAME}" -f "$SCRIPT_DIR/backend/src/db/schema.sql" > /dev/null 2>&1; then
  echo -e "${GREEN}   ✅ Schema ready${NC}"
else
  echo -e "${RED}   ❌ Could not apply schema. Check PostgreSQL is running and backend/.env credentials are correct.${NC}"
  exit 1
fi

# ── 5. Always run seed (inserts roles if missing, idempotent) ─
echo -e "${YELLOW}▶  Running seed (roles only, idempotent)...${NC}"
cd "$SCRIPT_DIR/backend"
[ ! -f "dist/server.js" ] && npm run build > /dev/null 2>&1
npm run seed
cd "$SCRIPT_DIR"
echo -e "${GREEN}   ✅ Roles seeded${NC}"

# ── 6. Check admin status ────────────────────────────────────
ADMIN_COUNT=$(run_psql_cmd \
  "SELECT COUNT(*) FROM users u JOIN roles r ON u.role_id=r.id WHERE r.name='Admin' AND u.is_active=true;")
ADMIN_COUNT="${ADMIN_COUNT:-0}"

# ── 7. Build backend if needed ───────────────────────────────
if [ ! -f "$SCRIPT_DIR/backend/dist/server.js" ]; then
  echo -e "${YELLOW}▶  Building backend...${NC}"
  cd "$SCRIPT_DIR/backend"
  npm install --silent 2>/dev/null
  npm run build
  echo -e "${GREEN}   ✅ Backend built${NC}"
  cd "$SCRIPT_DIR"
fi

# ── 8. Start Backend ─────────────────────────────────────────
echo -e "${YELLOW}▶  Starting Backend API (port 5000)...${NC}"
pkill -f "node dist/server" 2>/dev/null || true
sleep 1
cd "$SCRIPT_DIR/backend"
node dist/server.js > /tmp/backend.log 2>&1 &
BACKEND_PID=$!

for i in $(seq 1 10); do
  sleep 1
  if curl -sf http://localhost:5000/health > /dev/null 2>&1; then
    echo -e "${GREEN}   ✅ Backend running (PID: $BACKEND_PID)${NC}"
    break
  fi
  if [ "$i" -eq 10 ]; then
    echo -e "${RED}   ❌ Backend failed to start. Logs:${NC}"
    tail -20 /tmp/backend.log
    exit 1
  fi
done
cd "$SCRIPT_DIR"

# ── 9. Build frontend if needed ──────────────────────────────
if [ ! -d "$SCRIPT_DIR/frontend/.next" ]; then
  echo -e "${YELLOW}▶  Building frontend...${NC}"
  cd "$SCRIPT_DIR/frontend"
  npm install --silent 2>/dev/null
  npm run build 2>&1 | tail -5
  echo -e "${GREEN}   ✅ Frontend built${NC}"
  cd "$SCRIPT_DIR"
fi

# ── 10. Start Frontend ────────────────────────────────────────
echo -e "${YELLOW}▶  Starting Frontend (port 3000)...${NC}"
pkill -f "next start" 2>/dev/null || true
sleep 1
cd "$SCRIPT_DIR/frontend"
node_modules/.bin/next start -p 3000 > /tmp/frontend.log 2>&1 &
FRONTEND_PID=$!

for i in $(seq 1 10); do
  sleep 1
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null || echo "000")
  if [ "$STATUS" = "200" ]; then
    echo -e "${GREEN}   ✅ Frontend running (PID: $FRONTEND_PID)${NC}"
    break
  fi
  if [ "$i" -eq 10 ]; then
    echo -e "${RED}   ❌ Frontend failed to start. Logs:${NC}"
    tail -20 /tmp/frontend.log
    exit 1
  fi
done
cd "$SCRIPT_DIR"

# ── 11. Summary ───────────────────────────────────────────────
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   🚀  Logistics CRM is LIVE!                 ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  Frontend:  ${BLUE}http://localhost:3000${NC}"
echo -e "  Backend:   ${BLUE}http://localhost:5000${NC}"
echo ""

if [ "${ADMIN_COUNT:-0}" = "0" ]; then
  echo -e "${CYAN}  ┌──────────────────────────────────────────────┐${NC}"
  echo -e "${CYAN}  │  🆕 First-time setup                          │${NC}"
  echo -e "${CYAN}  │                                               │${NC}"
  echo -e "${CYAN}  │  1. Open  ${BLUE}http://localhost:3000${CYAN}            │${NC}"
  echo -e "${CYAN}  │  2. Click "${YELLOW}Create Admin Account${CYAN}"            │${NC}"
  echo -e "${CYAN}  │  3. Fill your name, email & password          │${NC}"
  echo -e "${CYAN}  │  4. Sign in → Users Management → Add staff    │${NC}"
  echo -e "${CYAN}  └──────────────────────────────────────────────┘${NC}"
else
  echo -e "${GREEN}  ✅ Admin account detected – go to ${BLUE}http://localhost:3000${GREEN} and sign in.${NC}"
fi

echo ""
echo -e "  Useful commands:"
echo -e "  ${BLUE}bash start.sh${NC}          → Normal start"
echo -e "  ${BLUE}bash start.sh --reset${NC}  → Reset database (⚠️ destroys all data)"
echo -e "  ${BLUE}tail -f /tmp/backend.log${NC}  → Backend logs"
echo -e "  ${BLUE}tail -f /tmp/frontend.log${NC} → Frontend logs"
echo ""
