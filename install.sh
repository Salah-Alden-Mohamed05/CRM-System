#!/bin/bash
# ============================================================
# Logistics CRM – First-Time Installation Script
# Run once on a fresh machine after cloning the repo
# Compatible with: Ubuntu/Debian, macOS, WSL
# ============================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo -e "${BLUE}╔══════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Logistics CRM – Installation Script        ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════╝${NC}"
echo ""

# ── Helper: run psql as postgres user ───────────────────────
run_psql() {
  if sudo -u postgres psql "$@" 2>/dev/null; then return 0
  elif psql -U postgres "$@" 2>/dev/null;    then return 0
  else return 1; fi
}

run_psql_db() {
  local db="$1"; shift
  if sudo -u postgres psql -d "$db" "$@" 2>/dev/null; then return 0
  elif PGPASSWORD="${DB_PASSWORD:-postgres}" psql -U "${DB_USER:-postgres}" -d "$db" "$@" 2>/dev/null; then return 0
  else return 1; fi
}

# ── Step 1: Check Node.js ────────────────────────────────────
echo -e "${YELLOW}[1/6] Checking Node.js...${NC}"
if ! command -v node &> /dev/null; then
  echo -e "${RED}❌ Node.js not installed. Install Node 18+ from https://nodejs.org${NC}"
  exit 1
fi
NODE_VER=$(node -v)
echo -e "${GREEN}   ✅ Node.js $NODE_VER found${NC}"

# ── Step 2: Check PostgreSQL ─────────────────────────────────
echo -e "${YELLOW}[2/6] Checking PostgreSQL...${NC}"
if ! command -v psql &> /dev/null; then
  echo -e "${RED}❌ PostgreSQL not installed.${NC}"
  echo "   Ubuntu/Debian: sudo apt install postgresql postgresql-contrib"
  echo "   macOS:         brew install postgresql && brew services start postgresql"
  echo "   Windows:       https://www.postgresql.org/download/windows/"
  exit 1
fi
PG_VER=$(psql --version | awk '{print $3}')
echo -e "${GREEN}   ✅ PostgreSQL $PG_VER found${NC}"

# ── Step 3: Start PostgreSQL ─────────────────────────────────
echo -e "${YELLOW}[3/6] Starting PostgreSQL...${NC}"
sudo pg_ctlcluster 16 main start 2>/dev/null || \
sudo pg_ctlcluster 15 main start 2>/dev/null || \
sudo pg_ctlcluster 14 main start 2>/dev/null || \
sudo service postgresql start 2>/dev/null || \
brew services start postgresql@16 2>/dev/null || \
brew services start postgresql 2>/dev/null || \
pg_ctl start 2>/dev/null || true
sleep 3
echo -e "${GREEN}   ✅ PostgreSQL started${NC}"

# ── Step 4: Configure .env files ─────────────────────────────
echo -e "${YELLOW}[4/6] Configuring environment...${NC}"

DB_USER="postgres"
DB_PASSWORD="postgres"
DB_NAME="logistics_crm"
DB_HOST="localhost"
DB_PORT="5432"

# Check if we can connect automatically; if not, ask for credentials
if ! sudo -u postgres psql -c "SELECT 1;" > /dev/null 2>&1; then
  echo ""
  echo -e "${YELLOW}   Could not connect as 'postgres' automatically.${NC}"
  echo -e "   Enter your PostgreSQL credentials:"
  read -rp  "   DB Username [postgres]: " INPUT_USER
  DB_USER="${INPUT_USER:-postgres}"
  read -rsp "   DB Password [postgres]: " INPUT_PASS
  echo ""
  DB_PASSWORD="${INPUT_PASS:-postgres}"
fi

if [ ! -f "$SCRIPT_DIR/backend/.env" ]; then
  echo "   Creating backend/.env..."
  JWT_SECRET="logistics_crm_$(openssl rand -hex 32 2>/dev/null || date +%s%N)"
  cat > "$SCRIPT_DIR/backend/.env" << EOF
PORT=5000
NODE_ENV=development
DB_HOST=${DB_HOST}
DB_PORT=${DB_PORT}
DB_NAME=${DB_NAME}
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASSWORD}
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=24h
CORS_ORIGIN=http://localhost:3000
LOG_LEVEL=info
EOF
  echo -e "${GREEN}   ✅ backend/.env created${NC}"
else
  echo -e "${GREEN}   ✅ backend/.env already exists (skipping)${NC}"
fi

if [ ! -f "$SCRIPT_DIR/frontend/.env.local" ]; then
  echo "   Creating frontend/.env.local..."
  echo "NEXT_PUBLIC_API_URL=http://localhost:5000/api" > "$SCRIPT_DIR/frontend/.env.local"
  echo -e "${GREEN}   ✅ frontend/.env.local created${NC}"
else
  echo -e "${GREEN}   ✅ frontend/.env.local already exists (skipping)${NC}"
fi

# ── Step 5: Create database + apply schema ───────────────────
echo -e "${YELLOW}[5/6] Setting up database...${NC}"

echo "   Creating database '${DB_NAME}' (if not exists)..."
if sudo -u postgres psql 2>/dev/null << 'EOSQL'
SELECT 'exists' FROM pg_database WHERE datname='logistics_crm' \gset
\if :{?exists}
  \echo 'Database already exists'
\else
  CREATE DATABASE logistics_crm;
  \echo 'Database created'
\endif
EOSQL
then
  echo -e "${GREEN}   ✅ Database ready${NC}"
elif PGPASSWORD="${DB_PASSWORD}" psql -U "${DB_USER}" -c "CREATE DATABASE ${DB_NAME};" 2>/dev/null; then
  echo -e "${GREEN}   ✅ Database created${NC}"
else
  echo -e "${YELLOW}   (Database may already exist – continuing)${NC}"
fi

echo "   Applying schema..."
if sudo -u postgres psql -d "${DB_NAME}" -f "$SCRIPT_DIR/backend/src/db/schema.sql" > /dev/null 2>&1; then
  echo -e "${GREEN}   ✅ Schema applied${NC}"
elif PGPASSWORD="${DB_PASSWORD}" psql -U "${DB_USER}" -d "${DB_NAME}" -f "$SCRIPT_DIR/backend/src/db/schema.sql" > /dev/null 2>&1; then
  echo -e "${GREEN}   ✅ Schema applied${NC}"
else
  echo -e "${RED}   ❌ Failed to apply schema. Check PostgreSQL connection.${NC}"
  echo "   Try: psql -U ${DB_USER} -d ${DB_NAME} -f backend/src/db/schema.sql"
  exit 1
fi

# ── Step 6: Install dependencies & build ─────────────────────
echo -e "${YELLOW}[6/6] Installing dependencies & building...${NC}"

echo "   Installing backend dependencies..."
cd "$SCRIPT_DIR/backend" && npm install --silent 2>&1 | tail -3
echo "   Building backend..."
npm run build 2>&1 | tail -3
echo "   Seeding roles..."
npm run seed
echo -e "${GREEN}   ✅ Backend ready${NC}"

echo "   Installing frontend dependencies..."
cd "$SCRIPT_DIR/frontend" && npm install --silent 2>&1 | tail -3
echo "   Building frontend (this may take 1-2 minutes)..."
npm run build 2>&1 | tail -5
echo -e "${GREEN}   ✅ Frontend ready${NC}"
cd "$SCRIPT_DIR"

# ── Done ─────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   ✅  Installation Complete!                  ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${YELLOW}To start the app:${NC}"
echo -e "    ${BLUE}bash start.sh${NC}"
echo ""
echo -e "  ${CYAN}┌──────────────────────────────────────────────┐${NC}"
echo -e "  ${CYAN}│  🆕 First-time setup                          │${NC}"
echo -e "  ${CYAN}│                                               │${NC}"
echo -e "  ${CYAN}│  1. Open  ${BLUE}http://localhost:3000${CYAN}            │${NC}"
echo -e "  ${CYAN}│  2. Click '${YELLOW}Create Admin Account${CYAN}'           │${NC}"
echo -e "  ${CYAN}│  3. Enter your name, email & password         │${NC}"
echo -e "  ${CYAN}│  4. Sign in and add your team members         │${NC}"
echo -e "  ${CYAN}│     (Users Management → Add Employee)         │${NC}"
echo -e "  ${CYAN}└──────────────────────────────────────────────┘${NC}"
echo ""
echo -e "  Other commands:"
echo -e "    ${BLUE}bash start.sh --reset${NC}  → Wipe database and start fresh"
echo -e "    ${BLUE}tail -f /tmp/backend.log${NC}  → Watch backend logs"
echo ""
