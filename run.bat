@echo off
title Cyberdeck Gesture Controller Launcher
echo ===================================================
echo 🌌 Starting Cyberdeck Gesture Controller Launcher...
echo ===================================================
echo.

cd /d "%~dp0"

:: 1. Check if Python is installed and accessible
where python >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed or not added to your PC's PATH variable!
    echo.
    echo Please make sure you checked "Add python.exe to PATH" during installation.
    echo Read the Step-by-Step section in README.md to easily fix this!
    goto end
)

:: 2. Create Virtual Environment
if not exist venv (
    echo [1/3] Creating safe virtual environment (venv)...
    echo (This keeps your computer clean and organizes dependencies. Please wait...)
    python -m venv venv
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to create virtual environment!
        goto end
    )
) else (
    echo [1/3] Virtual environment (venv) already exists. Skipping...
)

:: 3. Activate Virtual Environment
echo [2/3] Activating virtual environment...
call venv\Scripts\activate.bat
if %errorlevel% neq 0 (
    echo [ERROR] Failed to activate virtual environment!
    goto end
)

:: 4. Install Dependencies
echo [3/3] Installing libraries (opencv, mediapipe, pygame, etc.)...
echo (This might take 30-40 seconds on the first run as it downloads them...)
echo.
pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Failed to install dependencies!
    echo Please verify your internet connection is active and try again.
    goto end
)

:: 5. Launch the App
echo.
echo ===================================================
echo 🚀 Launching Cyberdeck! Wave high to see the magic.
echo ===================================================
echo.

if "%1"=="terminal" (
    python cyberdeck.py --terminal
) else if "%1"=="build" (
    python build.py
) else (
    python cyberdeck.py
)

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Cyberdeck closed with an error code: %errorlevel%
) else (
    echo.
    echo [SUCCESS] Cyberdeck closed normally.
)

:end
echo.
echo ===================================================
echo This console window will now pause.
echo Press any key when you are ready to close this window...
echo ===================================================
pause >nul
