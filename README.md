<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Cyberdeck Core Setup and Execution Guide

This document provides a highly detailed, step-by-step system walkthrough to run the **Cyberdeck Core** hand-gesture tracking dashboard on both **Linux** and **Windows** operating systems. 

---

## 🛠️ Prerequisites & Hardware Setup

Before running the python or web applications:
1. **Physical Webcam:** A standard USB or integrated webcam is required for hand tracking.
2. **Python Environment:** Ensure Python (version 3.8 to 3.11 is recommended) is installed on your computer.
3. **Lighting:** For optimal MediaPipe skeletal joint tracking, ensure your hand and face are in a well-lit environment.

---

## 🐧 Platform Guide: LINUX (Ubuntu, Debian, Mint, Fedora, Arch)

Follow these terminal commands precisely.

### Step 1: Install System Libraries (Critical)
OpenCV and Tkinter need native OS library bindings to render windows and capture system camera grids. Open your terminal and run:

*For Debian/Ubuntu/Mint distributions:*
```bash
sudo apt update
sudo apt install python3-pip python3-tk python3-dev libgl1-mesa-glx python3-opencv -y
```

*For Fedora/RHEL:*
```bash
sudo dnf check-update
sudo dnf install python3-pip python3-tkinter python3-devel mesa-libGL opencv -y
```

*For Arch Linux:*
```bash
sudo pacman -Syu
sudo pacman -S python-pip tk opencv mesa
```

### Step 2: Set Up Virtual Environment (Recommended for Python 3.11+)
To avoid conflicts with system packages, create and activate a designated virtual environment:
```bash
python3 -m venv venv
source venv/bin/activate
```

### Step 3: Upgrade pip and Install Dependencies
With your python virtual environment activated, run:
```bash
pip install --upgrade pip
pip install opencv-python mediapipe pillow websockets
```

### Step 4: Run the Cyberdeck Application
Execute the primary cyberdeck UI with Python:
```bash
python3 desktop_cyberdeck_app.py
```
*(Optionally, you can also launch the terminal interactive hud via `python3 terminal_cyberdeck_hud.py` or the custom processing core with `python3 core_vibe_engine.py`)*

### Step 5: Native Compilation into a Standalone Executable (Optional)
If you want to package the app into a portable ELF executable that runs with a single click:
```bash
pip install pyinstaller
pyinstaller --onefile --noconsole --name="CyberdeckCore" desktop_cyberdeck_app.py
```
Your compiled binary will be placed inside the `dist/` directory!

---

## 🪟 Platform Guide: WINDOWS 10 / 11

Follow these instructions to run the application natively on Windows:

### Step 1: Install Python (with PATH Integration)
1. Download the installer from the official website: **[python.org/downloads](https://www.python.org/downloads/)**.
2. Run the installer and **MUST** check the box that says: **"Add Python.exe to PATH"** before clicking install.
3. If presented at the end, click *"Disable path length limit"*.

### Step 2: Open Command Prompt or PowerShell as Administrator
1. Press the Windows key, search for **cmd** (Command Prompt) or **PowerShell**.
2. Right-click it and select **"Run as Administrator"**.

### Step 3: Set Up a Python virtual environment
Navigate to your project directory. *(Hint: replace `C:\Path\To\Your_App` with the actual folder you downloaded/extracted the files to)*:
```powershell
cd C:\Path\To\Your_App
python -m venv venv
venv\Scripts\activate
```

### Step 4: Install pip dependencies
Install the required system wrappers into your workspace:
```powershell
python -m pip install --upgrade pip
pip install opencv-python mediapipe pillow websockets
```

### Step 5: Open Camera App Privacy Permissions
Windows often blocks desktop apps from accessing the system web camera by default:
1. Open Windows **Settings** (Win + I).
2. Go to **Privacy & Security** ➔ **Camera**.
3. Toggle ON **"Camera access"** and **"Let desktop apps access your camera"**.

### Step 6: Execute the Application
Run the script using the local environment:
```powershell
python desktop_cyberdeck_app.py
```

### Step 7: Native Compilation into a Standalone Executable (Optional)
Build a fully bundled standalone Windows `.exe` executable that operates with no Python requirement:
```powershell
pip install pyinstaller
pyinstaller --onefile --noconsole --name="CyberdeckCore" desktop_cyberdeck_app.py
```
Once compilation finishes, navigate into the created `dist\` folder to launch **`CyberdeckCore.exe`** directly!

---

## 📈 System Navigation & Action Checklist
- **Webcam Placement:** Keep your hand roughly `1.5` to `3` feet from the camera for the highest precision targeting.
- **Toggle Shape Mode:** Toggle geometry layout rendering styles seamlessly from `Sphere` to `Cylinder` in the Tkinter cockpit.
- **Telemetry Analysis:** The live output console logs when the system shifts from seeking state, to lock coordinates (`PINCH`), to volume squeeze (`FIST`).

