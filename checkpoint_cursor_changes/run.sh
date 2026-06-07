#!/usr/bin/env bash
# Cyberdeck Gesture Controller — one-command launcher (Linux/macOS)
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

source venv/bin/activate
pip install -q -r requirements.txt

MODE="${1:-gui}"
case "$MODE" in
    gui|"")     python cyberdeck.py ;;
    terminal|t) python cyberdeck.py --terminal ;;
    build)      python build.py ;;
    *)          echo "Usage: ./run.sh [gui|terminal|build]"; exit 1 ;;
esac
