#!/usr/bin/env python3
"""
Build standalone executables with PyInstaller.

  python build.py          # GUI app (.exe on Windows, binary on Linux)
  python build.py --terminal   # Terminal HUD only
  python build.py --all    # Both
"""

from __future__ import annotations

import argparse
import os
import subprocess
import sys


def _data_arg() -> str:
    sep = ";" if os.name == "nt" else ":"
    return f"assets/hand_landmarker.task{sep}assets"


def build_gui() -> int:
    cmd = [
        sys.executable, "-m", "PyInstaller",
        "--onefile",
        "--name", "Cyberdeck",
        "--collect-all", "mediapipe",
        "--add-data", _data_arg(),
        "--hidden-import", "pygame",
        "--hidden-import", "cv2",
        "--hidden-import", "numpy",
        "cyberdeck.py",
    ]
    print("Building GUI executable...")
    print(" ".join(cmd))
    return subprocess.call(cmd)


def build_terminal() -> int:
    cmd = [
        sys.executable, "-m", "PyInstaller",
        "--onefile",
        "--console",
        "--name", "CyberdeckTerminal",
        "--collect-all", "mediapipe",
        "--add-data", _data_arg(),
        "--hidden-import", "cv2",
        "--hidden-import", "numpy",
        "terminal_cyberdeck_hud.py",
    ]
    print("Building terminal executable...")
    print(" ".join(cmd))
    return subprocess.call(cmd)


def main() -> None:
    parser = argparse.ArgumentParser(description="Build Cyberdeck standalone executables")
    parser.add_argument("--terminal", action="store_true", help="Build terminal HUD only")
    parser.add_argument("--all", action="store_true", help="Build both GUI and terminal")
    args = parser.parse_args()

    try:
        import PyInstaller  # noqa: F401
    except ImportError:
        print("PyInstaller required. Run: pip install pyinstaller")
        sys.exit(1)

    if args.all:
        rc1 = build_gui()
        rc2 = build_terminal()
        sys.exit(max(rc1, rc2))
    elif args.terminal:
        sys.exit(build_terminal())
    else:
        sys.exit(build_gui())


if __name__ == "__main__":
    main()
