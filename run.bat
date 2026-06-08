@echo off
title Cyberdeck Gesture Controller Launcher
echo ===================================================
echo 🌌 Starting Cyberdeck Gesture Controller Launcher...
echo ===================================================
echo.

cd /d "%~dp0"

:: 1. Check if Python is installed and accessible
where python >nul 2>nul
if errorlevel 1 goto no_python

:: 2. Check if Virtual Environment exists, if not create it
if exist venv\Scripts\activate.bat goto venv_exists

echo [1/3] Creating safe virtual environment (venv)...
echo (This keeps your computer clean and organizes dependencies. Please wait...)
python -m venv venv
if errorlevel 1 goto venv_failed
goto venv_created

:venv_exists
echo [1/3] Virtual environment (venv) already exists. Skipping creation...

:venv_created
:: 3. Activate Virtual Environment
echo [2/3] Activating virtual environment...
call venv\Scripts\activate.bat
if errorlevel 1 goto activate_failed

:: 3.5. Ensure pip, setuptools, and wheel are up-to-date to find pre-compiled wheels
echo Upgrading package managers (pip, setuptools, wheel)...
python -m pip install --upgrade pip setuptools wheel
if errorlevel 1 (
    echo [WARNING] Minimal failure upgrading installer tools. Continuing installation...
)

:: 4. Install Dependencies
echo [3/3] Installing libraries (opencv, mediapipe, pygame-ce, etc.)...
echo (This might take 30-40 seconds on the first run as it downloads them...)
echo.
pip install -r requirements.txt
if errorlevel 1 goto pip_failed

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

if errorlevel 1 goto app_failed
echo.
echo [SUCCESS] Cyberdeck closed normally.
goto end

:no_python
echo [ERROR] Python is not installed or not added to your PC's PATH variable!
echo.
echo Please make sure you checked "Add python.exe to PATH" during installation.
echo Read the Step-by-Step section in README.md to easily fix this!
goto end

:venv_failed
echo [ERROR] Failed to create virtual environment!
goto end

:activate_failed
echo [ERROR] Failed to activate virtual environment!
goto end

:pip_failed
echo.
echo [ERROR] Failed to install dependencies!
echo Please verify your internet connection is active and try again.
goto end

:app_failed
echo.
echo [ERROR] Cyberdeck closed with an error code!
goto end

:end
echo.
echo ===================================================
echo This console window will now pause.
echo Press any key when you are ready to close this window...
echo ===================================================
pause >nul
