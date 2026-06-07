@echo off
REM Cyberdeck Gesture Controller — one-command launcher (Windows)
cd /d "%~dp0"

if not exist venv (
    echo Creating virtual environment...
    python -m venv venv
)

call venv\Scripts\activate.bat
pip install -q -r requirements.txt

if "%1"=="terminal" (
    python cyberdeck.py --terminal
) else if "%1"=="build" (
    python build.py
) else (
    python cyberdeck.py
)
