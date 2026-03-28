#!/bin/bash
# start.sh — Start Baymax AI backend + frontend
# Usage: bash start.sh

set -e

PROJECT="$(cd "$(dirname "$0")" && pwd)"
BACKEND="$PROJECT/backend"
FRONTEND="$PROJECT/frontend"

echo ""
echo "  🤖  Baymax AI — Multi-Agent Career Assistant"
echo "  ─────────────────────────────────────────────"
echo ""

# ── Kill any stale processes on our ports ─────────────────────────────────────
lsof -ti:8000,8080 | xargs kill -9 2>/dev/null || true
sleep 0.5

# ── Create venv if it doesn't exist ──────────────────────────────────────────
if [ ! -f "$BACKEND/venv/bin/python3" ]; then
  echo "  📦 Creating virtual environment..."
  python3 -m venv "$BACKEND/venv"
  "$BACKEND/venv/bin/pip" install --upgrade pip -q
  "$BACKEND/venv/bin/pip" install -r "$BACKEND/requirements.txt" -q
  echo "  ✅ Dependencies installed"
fi

# ── Start Backend ─────────────────────────────────────────────────────────────
echo "  ▶  Backend  → http://localhost:8000"
cd "$BACKEND"
"$BACKEND/venv/bin/uvicorn" api:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

# ── Wait for backend to be ready (up to 15s) ─────────────────────────────────
echo "  ⏳ Waiting for backend..."
for i in {1..30}; do
  curl -s http://localhost:8000/health > /dev/null 2>&1 && break
  sleep 0.5
done
echo "  ✅ Backend ready"

# ── Start Frontend ────────────────────────────────────────────────────────────
echo "  ▶  Frontend → http://localhost:8080"
cd "$FRONTEND"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "  ✅ Baymax AI is running!"
echo "     Open: http://localhost:8080"
echo ""
echo "     Press Ctrl+C to stop"
echo ""

# ── Trap Ctrl+C ───────────────────────────────────────────────────────────────
trap "echo ''; echo '  Stopping...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM

wait $BACKEND_PID $FRONTEND_PID
