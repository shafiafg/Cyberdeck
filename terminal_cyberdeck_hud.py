#!/usr/bin/env python3
"""
CYBERDECK TERMINAL HUD v3.0
===========================
Pure terminal hand-tracking dashboard — no browser, no Node.js.

  python terminal_cyberdeck_hud.py
  python cyberdeck.py --terminal
"""

from __future__ import annotations

import os
import sys
import time
import math
import random
import argparse

from cyberdeck.camera import CameraPipeline, CameraConfig, OPENCV_AVAILABLE, MEDIAPIPE_AVAILABLE
from cyberdeck.gestures import HAND_CONNECTIONS


class ConsoleColor:
    CYAN = "\033[96m"
    GREEN = "\033[92m"
    YELLOW = "\033[93m"
    RED = "\033[91m"
    MAGENTA = "\033[95m"
    BLUE = "\033[94m"
    BOLD = "\033[1m"
    UNDERLINE = "\033[4m"
    BG_CYAN = "\033[106m\033[30m"
    BG_MAGENTA = "\033[105m\033[30m"
    BG_GREEN = "\033[102m\033[30m"
    RESET = "\033[0m"


class TerminalCanvas:
    def __init__(self, width: int = 52, height: int = 20):
        self.width = width
        self.height = height
        self.clear()

    def clear(self) -> None:
        self.grid = []
        for r in range(self.height):
            row = []
            for c in range(self.width):
                row.append("." if c % 8 == 0 and r % 4 == 0 else " ")
            self.grid.append(row)

    def draw_point(self, x: float, y: float, char: str) -> None:
        ix = int(x * (self.width - 1))
        iy = (self.height - 1) - int(y * (self.height - 1))
        if 0 <= ix < self.width and 0 <= iy < self.height:
            self.grid[iy][ix] = char

    def draw_line(self, x1: float, y1: float, x2: float, y2: float, char: str) -> None:
        ix1 = int(x1 * (self.width - 1))
        iy1 = (self.height - 1) - int(y1 * (self.height - 1))
        ix2 = int(x2 * (self.width - 1))
        iy2 = (self.height - 1) - int(y2 * (self.height - 1))
        dx, dy = abs(ix2 - ix1), abs(iy2 - iy1)
        sx = 1 if ix1 < ix2 else -1
        sy = 1 if iy1 < iy2 else -1
        err = dx - dy
        cx, cy = ix1, iy1
        while True:
            if 0 <= cx < self.width and 0 <= cy < self.height:
                self.grid[cy][cx] = char
            if cx == ix2 and cy == iy2:
                break
            e2 = 2 * err
            if e2 > -dy:
                err -= dy
                cx += sx
            if e2 < dx:
                err += dx
                cy += sy


def run_simulation(canvas: TerminalCanvas, t: float) -> tuple:
    hx = 0.5 + 0.3 * math.sin(t)
    hy = 0.5 + 0.25 * math.sin(t * 1.6)
    fingers = [
        (hx, hy),
        (hx - 0.1, hy + 0.12 * math.cos(t * 0.8)),
        (hx - 0.05, hy + 0.25 + 0.05 * math.sin(t)),
        (hx + 0.02, hy + 0.30 + 0.02 * math.cos(t * 1.2)),
        (hx + 0.08, hy + 0.26 + 0.04 * math.sin(t * 0.9)),
        (hx + 0.14, hy + 0.18 + 0.06 * math.cos(t * 1.5)),
    ]
    for i in range(1, len(fingers)):
        canvas.draw_line(fingers[0][0], fingers[0][1], fingers[i][0], fingers[i][1], "x")
        canvas.draw_point(fingers[i][0], fingers[i][1], "#")
    canvas.draw_point(fingers[0][0], fingers[0][1], "O")
    return hx, hy, random.choice(["IDLE", "PINCH", "FIST"])


def main(simulate: bool = False) -> None:
    use_sim = simulate or not OPENCV_AVAILABLE or not MEDIAPIPE_AVAILABLE
    canvas = TerminalCanvas()
    pipeline = None
    tel_logs = ["Pipeline initialized.", "Cyberdeck terminal HUD online."]
    t_counter = 0.0
    target_fps = 30
    frame_time = 1.0 / target_fps

    if not use_sim:
        pipeline = CameraPipeline(CameraConfig(width=480, height=360, target_fps=45))
        ok, msg = pipeline.start()
        if not ok:
            use_sim = True
            tel_logs.append(f"Fallback: {msg}")
        else:
            tel_logs.append(msg)

    os.system("cls" if os.name == "nt" else "clear")
    print(f"{ConsoleColor.BOLD}{ConsoleColor.CYAN}")
    print("=" * 72)
    print("     CYBERDECK TERMINAL MOTION HUD v3.0")
    print("=" * 72)
    print(f"{ConsoleColor.RESET}")
    if use_sim:
        print(f"{ConsoleColor.YELLOW}[DEMO] Synthetic orbit mode — no camera required{ConsoleColor.RESET}")
    else:
        print(f"{ConsoleColor.GREEN}[LIVE] Webcam + MediaPipe tracking active{ConsoleColor.RESET}")
    print("Press Ctrl+C to exit.\n")
    time.sleep(1.0)

    status_msg = "AWAITING HAND"
    active_fist = False
    active_pinch = False
    swipe_label = "IDLE"
    hx, hy = 0.5, 0.5
    track_fps = 0.0

    try:
        while True:
            loop_start = time.perf_counter()
            t_counter += 0.06
            canvas.clear()

            if use_sim:
                hx, hy, sim_state = run_simulation(canvas, t_counter)
                active_fist = sim_state == "FIST"
                active_pinch = sim_state == "PINCH"
                status_msg = f"SYNTH {sim_state}"
            else:
                snap = pipeline.get_snapshot()
                hand = snap.hand
                hx, hy = hand.smooth_x, hand.smooth_y
                track_fps = snap.fps_track
                active_fist = hand.fist
                active_pinch = hand.pinch

                if hand.swipe and hand.swipe_timer > 0:
                    swipe_label = hand.swipe
                else:
                    swipe_label = "IDLE"

                if hand.detected:
                    status_msg = "PALM LOCKED"
                    if hand.fist:
                        status_msg = "FIST CLENCH"
                    elif hand.pinch:
                        status_msg = "PINCH TARGET"
                    if hand.landmarks:
                        for i, j in HAND_CONNECTIONS:
                            p1, p2 = hand.landmarks[i], hand.landmarks[j]
                            canvas.draw_line(p1["x"], p1["y"], p2["x"], p2["y"], "x")
                        for lm in hand.landmarks:
                            canvas.draw_point(lm["x"], lm["y"], "O")
                    for ev in hand.events:
                        tel_logs.append(ev)
                else:
                    status_msg = "SCANNING..."
                    for a in range(14):
                        ox = 0.5 + 0.22 * math.cos(t_counter + a * 0.45)
                        oy = 0.5 + 0.22 * math.sin(t_counter + a * 0.45)
                        canvas.draw_point(ox, oy, "+")
                    canvas.draw_point(0.5, 0.5, "*")

            tel_logs = tel_logs[-8:]

            out = []
            out.append(f"{ConsoleColor.BOLD}{ConsoleColor.CYAN}╔{'═' * 50}╗ ╔{'═' * 28}╗{ConsoleColor.RESET}")
            out.append(f"{ConsoleColor.BOLD}{ConsoleColor.CYAN}║  OSCILLOSCOPE STREAM {' ' * 27}║ ║  TELEMETRY CORE          ║{ConsoleColor.RESET}")
            out.append(f"{ConsoleColor.BOLD}{ConsoleColor.CYAN}╠{'═' * 50}╣ ╠{'═' * 28}╣{ConsoleColor.RESET}")

            for r_idx, row in enumerate(canvas.grid):
                row_str = "".join(row)
                sidebar = ""
                if r_idx == 0:
                    src = "DEMO" if use_sim else "WEBCAM"
                    sidebar = f"SRC: {ConsoleColor.CYAN}{src}{ConsoleColor.RESET}  FPS: {ConsoleColor.YELLOW}{track_fps:.0f}{ConsoleColor.RESET}"
                elif r_idx == 2:
                    sidebar = f"{ConsoleColor.BOLD}STATUS:{ConsoleColor.RESET} {ConsoleColor.GREEN}{status_msg}{ConsoleColor.RESET}"
                elif r_idx == 5:
                    sidebar = f"X:{ConsoleColor.YELLOW}{hx:.2f}{ConsoleColor.RESET} Y:{ConsoleColor.YELLOW}{hy:.2f}{ConsoleColor.RESET}"
                elif r_idx == 8:
                    fist_b = f"{ConsoleColor.BG_MAGENTA} FIST {ConsoleColor.RESET}" if active_fist else " open "
                    pinch_b = f"{ConsoleColor.BG_CYAN} PINCH {ConsoleColor.RESET}" if active_pinch else " wide "
                    sidebar = f"{fist_b} {pinch_b}"
                elif r_idx == 11:
                    sidebar = f"SWIPE: {swipe_label}"
                elif r_idx == 14 and tel_logs:
                    sidebar = f"{ConsoleColor.YELLOW}λ{ConsoleColor.RESET} {tel_logs[-1][:24]}"
                elif r_idx == 15 and len(tel_logs) > 1:
                    sidebar = f"{ConsoleColor.YELLOW}λ{ConsoleColor.RESET} {tel_logs[-2][:24]}"
                elif r_idx == 16 and len(tel_logs) > 2:
                    sidebar = f"{ConsoleColor.YELLOW}λ{ConsoleColor.RESET} {tel_logs[-3][:24]}"
                elif r_idx == 18:
                    sidebar = f"{ConsoleColor.BOLD}[Ctrl+C exit]{ConsoleColor.RESET}"

                out.append(
                    f"{ConsoleColor.CYAN}║{ConsoleColor.RESET} {row_str} {ConsoleColor.CYAN}║{ConsoleColor.RESET} {sidebar}"
                )

            out.append(f"{ConsoleColor.BOLD}{ConsoleColor.CYAN}╚{'═' * 50}╝ ╚{'═' * 28}╝{ConsoleColor.RESET}")

            sys.stdout.write("\033[H" + "\n".join(out) + "\n")
            sys.stdout.flush()

            elapsed = time.perf_counter() - loop_start
            sleep_t = frame_time - elapsed
            if sleep_t > 0:
                time.sleep(sleep_t)

    except KeyboardInterrupt:
        print(f"\n{ConsoleColor.YELLOW}Cyberdeck terminal HUD closed.{ConsoleColor.RESET}")
        if pipeline:
            pipeline.stop()
        sys.exit(0)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--sim", action="store_true", help="Force demo mode")
    args = parser.parse_args()
    main(simulate=args.sim)
