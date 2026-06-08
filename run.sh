#!/usr/bin/env bash
# Cyberdeck Gesture Controller — one-command launcher (Linux/macOS)
set -eo pipefail
cd "$(dirname "$0")"

echo "==================================================="
echo "🌌 Starting Cyberdeck Gesture Controller Launcher..."
echo "==================================================="
echo

# 1. Check if Python 3 is installed
if ! command -v python3 &> /dev/null; then
    echo "[ERROR] python3 is not installed or not in your PATH!"
    echo "Please install Python 3.x using your system package manager."
    exit 1
fi

# 2. Check if virtual environment exists, if not create it
if [ ! -d "venv" ]; then
    echo "[1/3] Creating safe virtual environment (venv)..."
    echo "(This keeps your computer clean and organizes dependencies. Please wait...)"
    python3 -m venv venv || { echo "[ERROR] Failed to create virtual environment!"; exit 1; }
else
    echo "[1/3] Virtual environment (venv) already exists. Skipping creation..."
fi

# 3. Activate virtual environment
echo "[2/3] Activating virtual environment..."
source venv/bin/activate || { echo "[ERROR] Failed to activate virtual environment!"; exit 1; }

# 3.5. Ensure installer tools are up-to-date
echo "Upgrading package managers (pip, setuptools, wheel)..."
python -m pip install --upgrade pip setuptools wheel || echo "[WARNING] Minimal failure upgrading install tools. Continuing..."

# 4. Install Dependencies
echo "[3/3] Installing libraries (opencv, mediapipe, pygame-ce, etc.)..."
echo "(This might take 30-40 seconds on the first run as it downloads them...)"
echo
pip install -r requirements.txt || { echo "[ERROR] Failed to install dependencies!"; exit 1; }

# 5. Launch the App
echo
echo "==================================================="
echo "🚀 Launching Cyberdeck! Wave high to see the magic."
echo "==================================================="
echo

MODE="${1:-gui}"
case "$MODE" in
    gui|"")
        python cyberdeck.py || { echo; echo "[ERROR] Cyberdeck closed with an error code!"; exit 1; }
        ;;
    terminal|t)
        python cyberdeck.py --terminal || { echo; echo "[ERROR] Cyberdeck closed with an error code!"; exit 1; }
        ;;
    build)
        python build.py || { echo; echo "[ERROR] Build tool closed with an error code!"; exit 1; }
        ;;
    *)
        echo "Usage: ./run.sh [gui|terminal|build]"
        exit 1
        ;;
esac

echo
echo "[SUCCESS] Cyberdeck closed normally."
