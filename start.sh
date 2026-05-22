#!/bin/bash

# PromptShield — Start Script
# Starts backend and frontend in separate terminal tabs/processes

set -e

echo ""
echo "██████╗ ██████╗  ██████╗ ███╗   ███╗██████╗ ████████╗███████╗██╗  ██╗██╗███████╗██╗     ██████╗"
echo "██╔══██╗██╔══██╗██╔═══██╗████╗ ████║██╔══██╗╚══██╔══╝██╔════╝██║  ██║██║██╔════╝██║     ██╔══██╗"
echo "██████╔╝██████╔╝██║   ██║██╔████╔██║██████╔╝   ██║   ███████╗███████║██║█████╗  ██║     ██║  ██║"
echo "██╔═══╝ ██╔══██╗██║   ██║██║╚██╔╝██║██╔═══╝    ██║   ╚════██║██╔══██║██║██╔══╝  ██║     ██║  ██║"
echo "██║     ██║  ██║╚██████╔╝██║ ╚═╝ ██║██║        ██║   ███████║██║  ██║██║███████╗███████╗██████╔╝"
echo "╚═╝     ╚═╝  ╚═╝ ╚═════╝ ╚═╝     ╚═╝╚═╝        ╚═╝   ╚══════╝╚═╝  ╚═╝╚═╝╚══════╝╚══════╝╚═════╝"
echo ""
echo "  AI Prompt Injection Security Gateway"
echo "  ────────────────────────────────────"
echo ""

# Get the directory where this script lives
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
MODEL_PATH="$ROOT_DIR/models/injection_detector.pkl"
TRAINING_DIR="$ROOT_DIR/training"

# ── Check model exists ────────────────────────────────────────────────────────
if [ ! -f "$MODEL_PATH" ]; then
  echo "⚠  Model not found at models/injection_detector.pkl"
  echo "   Running training pipeline first..."
  echo ""

  cd "$TRAINING_DIR"

  if ! python3 -c "import sklearn" 2>/dev/null; then
    echo "   Installing training dependencies..."
    pip3 install scikit-learn numpy --quiet
  fi

  echo "   Generating dataset..."
  python3 generate_dataset.py

  echo "   Training model..."
  python3 train_model.py

  echo ""
  echo "✓  Model trained and saved."
  echo ""
fi

# ── Check backend dependencies ────────────────────────────────────────────────
echo "→  Checking backend dependencies..."
cd "$BACKEND_DIR"

if ! python3 -c "import fastapi" 2>/dev/null; then
  echo "   Installing backend dependencies..."
  pip3 install -r requirements.txt --quiet
  echo "✓  Backend dependencies installed."
else
  echo "✓  Backend dependencies OK."
fi

# ── Check frontend dependencies ───────────────────────────────────────────────
# ── Check frontend dependencies ───────────────────────────────────────────────
echo "→  Checking frontend dependencies..."
cd "$FRONTEND_DIR"

if [ ! -d "node_modules" ]; then
  echo "   Installing frontend dependencies..."
  npm install --silent
fi

# Ensure TypeScript deps are installed (fix for Next.js crash)
if [ -f "tsconfig.json" ]; then
  if ! npm list typescript >/dev/null 2>&1; then
    echo "   Installing TypeScript dependencies..."
    npm install --save-dev typescript @types/react @types/node --silent
    echo "✓  TypeScript dependencies installed."
  else
    echo "✓  TypeScript dependencies OK."
  fi
fi

echo "✓  Frontend dependencies ready."

# ── Start backend ─────────────────────────────────────────────────────────────
cd "$BACKEND_DIR"

echo "→  Starting backend on http://localhost:8000"
echo "   API docs: http://localhost:8000/docs"

# Try to open in a new terminal window, fallback to background process
if command -v gnome-terminal &>/dev/null; then
  gnome-terminal --title="PromptShield Backend" -- bash -c "cd '$BACKEND_DIR' && uvicorn main:app --reload --port 8000; exec bash"
elif command -v xterm &>/dev/null; then
  xterm -title "PromptShield Backend" -e "cd '$BACKEND_DIR' && uvicorn main:app --reload --port 8000; exec bash" &
elif command -v osascript &>/dev/null; then
  # macOS
  osascript -e "tell app \"Terminal\" to do script \"cd '$BACKEND_DIR' && uvicorn main:app --reload --port 8000\""
else
  # Fallback: run in background, log to file
  echo "   (Running in background — logs: /tmp/promptshield_backend.log)"
  uvicorn main:app --reload --port 8000 > /tmp/promptshield_backend.log 2>&1 &
  BACKEND_PID=$!
  echo "   Backend PID: $BACKEND_PID"
fi

# Give backend a moment to start
sleep 2

# ── Start frontend ────────────────────────────────────────────────────────────
cd "$FRONTEND_DIR"

echo "→  Starting frontend on http://localhost:3000"

if command -v gnome-terminal &>/dev/null; then
  gnome-terminal --title="PromptShield Frontend" -- bash -c "cd '$FRONTEND_DIR' && npm run dev; exec bash"
elif command -v xterm &>/dev/null; then
  xterm -title "PromptShield Frontend" -e "cd '$FRONTEND_DIR' && npm run dev; exec bash" &
elif command -v osascript &>/dev/null; then
  # macOS
  osascript -e "tell app \"Terminal\" to do script \"cd '$FRONTEND_DIR' && npm run dev\""
else
  # Fallback: run in background, log to file
  echo "   (Running in background — logs: /tmp/promptshield_frontend.log)"
  npm run dev > /tmp/promptshield_frontend.log 2>&1 &
  FRONTEND_PID=$!
  echo "   Frontend PID: $FRONTEND_PID"
fi

echo ""
echo "  ✓ PromptShield is starting up!"
echo "  ────────────────────────────────────────────────────"
echo "  Frontend  →  http://localhost:3000"
echo "  Backend   →  http://localhost:8000"
echo "  API Docs  →  http://localhost:8000/docs"
echo "  ────────────────────────────────────────────────────"
echo ""
echo "  To stop: close the terminal windows, or run:"
echo "  kill \$(lsof -ti:3000) \$(lsof -ti:8000)"
echo ""

# If we used background processes (no terminal emulator), wait and show logs
if [ -n "$BACKEND_PID" ] || [ -n "$FRONTEND_PID" ]; then
  echo "  Tailing logs (Ctrl+C to stop watching, services keep running)..."
  echo ""
  tail -f /tmp/promptshield_backend.log /tmp/promptshield_frontend.log 2>/dev/null
fi
