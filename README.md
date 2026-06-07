# Cyberdeck Gesture Controller

Hand-gesture cyberdeck dashboard with synthwave holographics. **Runs 100% natively in Python** — no browser, no Node.js, no `npm`.

Track your hand via webcam (MediaPipe), control a 3D wireframe hologram (pinch, fist, swipe), and watch live telemetry — all at **60 FPS** with threaded low-latency tracking.

---

## Quick Start

### Linux / macOS

```bash
chmod +x run.sh
./run.sh              # GUI app
./run.sh terminal     # Terminal HUD
```

### Windows

```cmd
run.bat               # GUI app
run.bat terminal      # Terminal HUD
```

### Manual setup

```bash
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
python cyberdeck.py             # Full GUI
python cyberdeck.py --terminal  # Terminal mode
```

---

## What You Get

| Mode | Command | Description |
|------|---------|-------------|
| **GUI** | `python cyberdeck.py` | Pygame desktop app — dual-pane hologram + webcam, 60 FPS render |
| **Terminal** | `python cyberdeck.py --terminal` | ASCII oscilloscope HUD in your shell |
| **Legacy Tkinter** | `python desktop_cyberdeck_app.py` | Original app (still works) |

### Gestures

| Gesture | Action |
|---------|--------|
| **Open palm** | Rotates hologram, moves crosshair |
| **Pinch** | Precision targeting, brighter wireframe |
| **Fist** | Compress / shrink 3D object |
| **Swipe** | Horizontal flick triggers rotation burst |

### Keyboard (GUI)

| Key | Action |
|-----|--------|
| `Q` / `Esc` | Quit |
| `C` | Toggle camera |
| `S` | Switch sphere ↔ cylinder |
| `[` `]` | Adjust motion damping |

---

## Build Standalone `.exe` (Windows) or Binary (Linux)

No Python install needed on the target machine after building:

```bash
pip install pyinstaller
python build.py              # → dist/Cyberdeck.exe (Windows) or dist/Cyberdeck (Linux)
python build.py --terminal     # → dist/CyberdeckTerminal.exe
python build.py --all          # Both
```

Or use the launcher:

```bash
./run.sh build        # Linux
run.bat build         # Windows
```

---

## Prerequisites

1. **Webcam** — USB or built-in
2. **Python 3.8–3.12**
3. **Good lighting** — helps MediaPipe hand tracking

### Linux system packages

```bash
# Debian/Ubuntu
sudo apt install python3-pip python3-venv libgl1-mesa-glx libglib2.0-0

# Fedora
sudo dnf install python3-pip mesa-libGL glib2
```

### Windows camera permissions

Settings → Privacy & Security → Camera → enable **Let desktop apps access your camera**.

---

## Architecture

```
cyberdeck.py              ← Main entry (pygame GUI, 60 FPS)
terminal_cyberdeck_hud.py ← Terminal HUD
cyberdeck/
  camera.py               ← Threaded webcam + MediaPipe (low latency)
  gestures.py             ← Fist / pinch / swipe detection
  math3d.py               ← 3D wireframe topology
  theme.py                ← Synthwave color palette
build.py                  ← PyInstaller .exe builder
run.sh / run.bat          ← One-command launchers
```

**Why no browser?** Browser MediaPipe runs at ~15 FPS due to sandboxing. Native OpenCV + threaded MediaPipe hits **45–60 FPS tracking** with **60 FPS rendering**.

The `src/` React app and `npm` scripts are legacy deployment artifacts. You do not need them to run the gesture controller.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `No module named pygame` | `pip install -r requirements.txt` |
| Webcam not found | Check cable, close other apps using camera, enable OS permissions |
| Low FPS | Lower room lighting variance; ensure `model_complexity=0` (default) |
| MediaPipe import error | Use Python 3.8–3.12; `pip install mediapipe --upgrade` |

---

## License

Apache 2.0 (see component headers).
