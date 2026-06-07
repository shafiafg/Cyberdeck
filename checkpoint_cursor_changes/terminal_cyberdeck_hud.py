#!/usr/bin/env python3
"""
==============================================================================
       ____ _   _ ____  _____ ____  ____  _____ ____ _  __ _   _ ___ 
      / ___| | | |  _ \| ____|  _ \|  _ \| ____/ ___| |/ / | | | |_ _|
     | |   | | | | |_) |  _| | |_) | |_) |  _|| |   | ' /  | | | || | 
     | |___| |_| |  _ <| |___|  _ <|  _ <| |__| |___| . \  | |_| || | 
      \____|\___/|_| \_\_____|_| \_\_| \_\_____\____|_|\_\  \___/|___|
                                                                     
                  --- STANDALONE TERMINAL CYBERDECK HUD ---
                  No Browsers. No Hosting. Pure Terminal.
==============================================================================

This script is a 100% terminal-based, offline hand tracking HUD built to run
on your personal computer's local console. It reads your physical webcam,
analyzes hand structures with MediaPipe, and draws a real-time ASCII-art
3D skeleton, interactive visual dials, gesture signals, and telemetry feed
directly within your local shell!

If no camera hardware is available or libraries are missing, it falls back
to an organic orbital synthesizer demo mode drawing automatic simulated
coordinate flows inside the terminal so you can preview its performance.

Requirements:
    pip install opencv-python mediapipe

Running Locally:
    python terminal_cyberdeck_hud.py
"""

import os
import sys
import time
import math
import random

# Safe imports for OpenCV and MediaPipe
OPENCV_AVAILABLE = False
MEDIAPIPE_AVAILABLE = False

try:
    import cv2
    OPENCV_AVAILABLE = True
except ImportError:
    pass

try:
    import mediapipe as mp
    if hasattr(mp, 'solutions') and hasattr(mp.solutions, 'hands'):
        MEDIAPIPE_AVAILABLE = True
except Exception:
    pass


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
    """A virtual pixel matrix canvas that outputs beautiful ASCII graphics."""
    def __init__(self, width=64, height=22):
        self.width = width
        self.height = height
        self.clear()

    def clear(self):
        # Empty space background, with a subtle high-tech dotted grid matrix
        self.grid = []
        for r in range(self.height):
            row = []
            for c in range(self.width):
                # Draw subtle grid dots on every 6th col & 3rd row for styling
                if c % 8 == 0 and r % 4 == 0:
                    row.append(".")
                else:
                    row.append(" ")
            self.grid.append(row)

    def draw_point(self, x, y, char):
        ix = int(x * (self.width - 1))
        iy = int(y * (self.height - 1))
        # Flip Y horizontally for natural webcam mirroring
        iy = (self.height - 1) - iy
        if 0 <= ix < self.width and 0 <= iy < self.height:
            self.grid[iy][ix] = char

    def draw_line(self, x1, y1, x2, y2, char):
        """Standard Bresenham's Line Algorithm to draw connect-the-dots."""
        ix1 = int(x1 * (self.width - 1))
        iy1 = (self.height - 1) - int(y1 * (self.height - 1))
        ix2 = int(x2 * (self.width - 1))
        iy2 = (self.height - 1) - int(y2 * (self.height - 1))

        dx = abs(ix2 - ix1)
        dy = abs(iy2 - iy1)
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


class GestureState:
    def __init__(self):
        self.active_fist = False
        self.active_pinch = False
        self.pinch_x = 0.5
        self.pinch_y = 0.5
        self.status_msg = "AWAITING USER WEBCAM HANDS"
        self.swipe_event = None
        self.swipe_timer = 0
        self.last_hx = 0.5
        self.last_hy = 0.5

    def update(self, events, current_x, current_y):
        self.last_hx = current_x
        self.last_hy = current_y
        
        self.active_fist = False
        self.active_pinch = False

        for ev in events:
            event_name = ev.get("event")
            if event_name in ["FIST_START", "FIST_MOVE"]:
                self.active_fist = True
                self.status_msg = "CYBERFIST CLENCH ACTIVE"
            elif event_name in ["PINCH_START", "PINCH_MOVE"]:
                self.active_pinch = True
                self.pinch_x = ev.get("x", 0.5)
                self.pinch_y = ev.get("y", 0.5)
                self.status_msg = "ACCURATE PINCH COORDS EXTRACTED"
            elif event_name == "SWIPE":
                self.swipe_event = ev.get("direction", "SWIPE_LEFT")
                self.swipe_timer = 6  # keep badge active for 6 frames

        if not self.active_fist and not self.active_pinch:
            self.status_msg = "SENSORS ONLINE. HAND IDLE"


def calculate_distance(p1, p2):
    return math.sqrt((p1.x - p2.x)**2 + (p1.y - p2.y)**2 + (p1.z - p2.z)**2)


def process_hand_landmarks(landmarks):
    """Calculates gestures like FISTS, PINCHES, and returns event triggers."""
    events = []
    
    # Coordinates of critical interest
    wrist = landmarks.landmark[0]
    thumb_tip = landmarks.landmark[4]
    index_tip = landmarks.landmark[8]
    middle_tip = landmarks.landmark[12]
    ring_tip = landmarks.landmark[16]
    pinky_tip = landmarks.landmark[20]
    palm_centroid = landmarks.landmark[9]

    # Calculate scale of hand for proximity invariance
    hand_scale = calculate_distance(wrist, landmarks.landmark[9]) or 0.1

    # Fist detection base check
    distances = [
        calculate_distance(index_tip, wrist) / hand_scale,
        calculate_distance(middle_tip, wrist) / hand_scale,
        calculate_distance(ring_tip, wrist) / hand_scale,
        calculate_distance(pinky_tip, wrist) / hand_scale,
    ]
    avg_finger_distance = sum(distances) / len(distances)

    hx = 1.0 - palm_centroid.x
    hy = palm_centroid.y

    if avg_finger_distance < 0.18:
        events.append({"event": "FIST_START", "x": hx, "y": hy})
    else:
        # Check Pinch
        pinch_dist = calculate_distance(index_tip, thumb_tip)
        if pinch_dist < 0.05:
            cx = (index_tip.x + thumb_tip.x) / 2.0
            cy = (index_tip.y + thumb_tip.y) / 2.0
            events.append({"event": "PINCH_START", "x": 1.0 - cx, "y": cy})

    return events, hx, hy


def main():
    # Setup Terminal boundaries
    canvas = TerminalCanvas(width=46, height=18)
    state = GestureState()

    # Bone indexes in MediaPipe
    BONES = [
        (0, 1), (1, 2), (2, 3), (3, 4),        # Thumb
        (0, 5), (5, 6), (6, 7), (7, 8),        # Index Finger
        (5, 9), (9, 10), (10, 11), (11, 12),   # Middle Finger
        (9, 13), (13, 14), (14, 15), (15, 16), # Ring Finger
        (13, 17), (17, 18), (18, 19), (19, 20),# Pinky Finger
        (0, 17)                                # Palm Base
    ]

    use_simulation = not OPENCV_AVAILABLE or not MEDIAPIPE_AVAILABLE or (len(sys.argv) > 1 and sys.argv[1] == '--sim')
    
    cap = None
    mp_hands = None
    mp_tracker = None

    if not use_simulation:
        cap = cv2.VideoCapture(0)
        # Fast resolution to speed up terminal parsing
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, 320)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 240)
        
        if not cap.isOpened():
            use_simulation = True
        else:
            mp_hands = mp.solutions.hands
            mp_tracker = mp_hands.Hands(
                max_num_hands=1,
                model_complexity=0,
                min_detection_confidence=0.7,
                min_tracking_confidence=0.7
            )

    t_counter = 0.0
    sim_action_timer = 0
    sim_state = "IDLE"

    os.system('cls' if os.name == 'nt' else 'clear')
    
    print(f"{ConsoleColor.BOLD}{ConsoleColor.CYAN}")
    print("======================================================================")
    print("     CYBERDECK STANDALONE MOTION CONTROL TERMINAL HUD")
    print("======================================================================")
    print(f"{ConsoleColor.RESET}")
    
    if use_simulation:
        print(f"{ConsoleColor.YELLOW}[FALLBACK] Launching Synthetic Core Synthesizer...{ConsoleColor.RESET}")
        print("Camera hardware, OpenCV, or MediaPipe libraries were not detected.")
        print("Running beautiful simulated hand telemetry loops offline!")
    else:
        print(f"{ConsoleColor.GREEN}[ONLINE] Successfully connected to Local Camera Pipeline [WEBCAM 0]{ConsoleColor.RESET}")
        print("Point your hand at your local camera! Press Ctrl+C in this terminal to exit.")

    time.sleep(1.8)

    # Telemetry Log Buffer
    tel_logs = ["System Pipeline initialized.", "Sensors loaded. Glistening ASCII matrix spawned."]

    try:
        while True:
            t_counter += 0.08
            canvas.clear()
            events = []
            
            # 1. Update positions (Reality or Simulation)
            if use_simulation:
                # Simulated trajectories (Lissajous cosmic patterns)
                hx = 0.5 + 0.3 * math.sin(t_counter)
                hy = 0.5 + 0.25 * math.sin(t_counter * 1.6)
                
                # Draw organic simulated mesh fingers
                fingers = [
                    (hx, hy),                             # wrist
                    (hx - 0.1, hy + 0.12 * math.cos(t_counter*0.8)), # thumb
                    (hx - 0.05, hy + 0.25 + 0.05*math.sin(t_counter)), # index
                    (hx + 0.02, hy + 0.30 + 0.02*math.cos(t_counter*1.2)), # middle
                    (hx + 0.08, hy + 0.26 + 0.04*math.sin(t_counter*0.9)), # ring
                    (hx + 0.14, hy + 0.18 + 0.06*math.cos(t_counter*1.5)), # pinky
                ]
                
                # Draw simulated joints and skeleton connections
                for i in range(1, len(fingers)):
                    canvas.draw_line(fingers[0][0], fingers[0][1], fingers[i][0], fingers[i][1], "x")
                    canvas.draw_point(fingers[i][0], fingers[i][1], "#")
                canvas.draw_point(fingers[0][0], fingers[0][1], "O")

                # Mock event synthesizer
                sim_action_timer -= 1
                if sim_action_timer <= 0:
                    sim_state = random.choice(["IDLE", "PINCH", "FIST", "SWIPE"])
                    sim_action_timer = random.randint(30, 60)
                    
                    if sim_state == "FIST":
                        events.append({"event": "FIST_START", "x": hx, "y": hy})
                        tel_logs.append("SIG_DETECTED: Synthetic Clench Activated.")
                    elif sim_state == "PINCH":
                        events.append({"event": "PINCH_START", "x": hx, "y": hy})
                        tel_logs.append("SIG_DETECTED: Organic Pinch coordinates extracted.")
                    elif sim_state == "SWIPE":
                        direction = random.choice(["SWIPE_LEFT", "SWIPE_RIGHT"])
                        events.append({"event": "SWIPE", "direction": direction})
                        tel_logs.append(f"ACCELEROMETER: Detected horizontal {direction} flow.")
            else:
                # Real-world camera frame analysis
                ret, frame = cap.read()
                if not ret:
                    continue
                # Flip camera for mirror effect
                frame = cv2.flip(frame, 1)
                rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                results = mp_tracker.process(rgb)

                hx, hy = 0.5, 0.5
                if results.multi_hand_landmarks:
                    landmarks = results.multi_hand_landmarks[0]
                    events, hx, hy = process_hand_landmarks(landmarks)

                    # Draw real physical tracked lines
                    for b in BONES:
                        p1 = landmarks.landmark[b[0]]
                        p2 = landmarks.landmark[b[1]]
                        canvas.draw_line(1.0 - p1.x, p1.y, 1.0 - p2.x, p2.y, "x")
                    
                    for lm in landmarks.landmark:
                        canvas.draw_point(1.0 - lm.x, lm.y, "O")

                    if len(events) > 0:
                        ev_name = events[0]["event"]
                        tel_logs.append(f"PIPELINE: Detected real hand {ev_name} at [{hx:.2f}, {hy:.2f}]")
                else:
                    # Draw a spinning holographic scanline when local hands coordinates are idle
                    for a in range(12):
                        ox = 0.5 + 0.2 * math.cos(t_counter + (a * 0.5))
                        oy = 0.5 + 0.2 * math.sin(t_counter + (a * 0.5))
                        canvas.draw_point(ox, oy, "+")
                    canvas.draw_point(0.5, 0.5, "*")

            state.update(events, hx, hy)
            if len(tel_logs) > 6:
                tel_logs = tel_logs[-6:]

            # 2. Render ASCII Matrix onto target outputs
            out = []
            out.append(f"{ConsoleColor.BOLD}{ConsoleColor.CYAN}++==============================================++===============================++{ConsoleColor.RESET}")
            out.append(f"{ConsoleColor.BOLD}{ConsoleColor.CYAN}||       CYBERDECK OSCILLOSCOPE STREAM GRAPHIC  ||      GESTURE TELEMETRY CORE   ||{ConsoleColor.RESET}")
            out.append(f"{ConsoleColor.BOLD}{ConsoleColor.CYAN}++==============================================++===============================++{ConsoleColor.RESET}")

            for r_idx, r in enumerate(canvas.grid):
                row_str = "".join(r)
                
                # Build beautiful sidebar information panel on the right side
                sidebar = " "
                if r_idx == 0:
                    src_label = "SYNTHETIC DEMO" if use_simulation else "PHYSICAL WEBCAM"
                    sidebar = f"{ConsoleColor.BOLD}HARDWARE SCANNER:{ConsoleColor.RESET} {ConsoleColor.CYAN}{src_label}{ConsoleColor.RESET}"
                elif r_idx == 1:
                    sidebar = f"FRAME PARSER TIME: {ConsoleColor.BLUE}{time.strftime('%H:%M:%S')}{ConsoleColor.RESET}"
                elif r_idx == 3:
                    sidebar = f"{ConsoleColor.BOLD}ACTIVE SYSTEM STATUS MESSAGE:{ConsoleColor.RESET}"
                elif r_idx == 4:
                    sidebar = f"{ConsoleColor.GREEN}» {state.status_msg}{ConsoleColor.RESET}"
                elif r_idx == 6:
                    sidebar = f"{ConsoleColor.BOLD}PALM CENTROID:{ConsoleColor.RESET} X:[{ConsoleColor.YELLOW}{hx:5.2f}{ConsoleColor.RESET}] Y:[{ConsoleColor.YELLOW}{hy:5.2f}{ConsoleColor.RESET}]"
                elif r_idx == 8:
                    fist_badge = f"{ConsoleColor.BG_MAGENTA} CLENCH {ConsoleColor.RESET}" if state.active_fist else " UNPINCHED "
                    pinch_badge = f"{ConsoleColor.BG_CYAN} PINCH_S {ConsoleColor.RESET}" if state.active_pinch else " UNCLENCHED "
                    sidebar = f"STATE ENG: {fist_badge} {pinch_badge}"
                elif r_idx == 10:
                    status_swipe = "IDLE FLOW"
                    if state.swipe_timer > 0:
                        state.swipe_timer -= 1
                        status_swipe = f"{ConsoleColor.BG_GREEN} {state.swipe_event} {ConsoleColor.RESET}"
                    sidebar = f"ACCEL TRIGGER: {status_swipe}"
                elif r_idx == 12:
                    sidebar = f"{ConsoleColor.UNDERLINE}CYBERDECK SYSTEM EVENT FEED LOGS:{ConsoleColor.RESET}"
                elif r_idx == 13 and len(tel_logs) > 0:
                    sidebar = f"{ConsoleColor.YELLOW}λ{ConsoleColor.RESET} {tel_logs[-1][:28]}"
                elif r_idx == 14 and len(tel_logs) > 1:
                    sidebar = f"{ConsoleColor.YELLOW}λ{ConsoleColor.RESET} {tel_logs[-2][:28]}"
                elif r_idx == 15 and len(tel_logs) > 2:
                    sidebar = f"{ConsoleColor.YELLOW}λ{ConsoleColor.RESET} {tel_logs[-3][:28]}"
                elif r_idx == 16:
                    sidebar = f"{ConsoleColor.BOLD}[PRESS CTRL+C IN TERMINAL TO EXIT]{ConsoleColor.RESET}"

                # Append frame grid row with aligned sidebar column
                scoped_row = f"{ConsoleColor.CYAN}||{ConsoleColor.RESET} {row_str} {ConsoleColor.CYAN}||{ConsoleColor.RESET} {sidebar:<30} "
                # Trim right padding cleanly while maintaining the vertical pipe structure
                out.append(scoped_row)

            out.append(f"{ConsoleColor.BOLD}{ConsoleColor.CYAN}++==============================================++===============================++{ConsoleColor.RESET}")

            # Re-draw directly to terminal position rather than clearing the scroll history
            sys.stdout.write("\033[H" + "\n".join(out) + "\n")
            sys.stdout.flush()

            time.sleep(0.05)

    except KeyboardInterrupt:
        print("\n\n")
        print(f"{ConsoleColor.YELLOW}[TERMINATION] Standalone Motion Deck closed cleanly.{ConsoleColor.RESET}")
        if cap:
            cap.release()
        sys.exit(0)


if __name__ == "__main__":
    main()
