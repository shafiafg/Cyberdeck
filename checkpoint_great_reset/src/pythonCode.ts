/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const pythonScriptContent = `#!/usr/bin/env python3
"""
================================================================================
       ____ _   _ ____  _____ ____  ____  _____ ____ _  __  _   _ ___ 
      / ___| | | |  _ \\\\| ____|  _ \\\\|  _ \\\\| ____/ ___| |/ / | | | |_ _|
     | |   | | | | |_) |  _| | |_) | | | |  _|| |   | ' /  | | | || | 
     | |___| |_| |  _ <| |___|  _ <| |_| | |__| |___| . \\\\  | |_| || | 
      \\\\____|\\\\___/|_| \\\\_\\\\_____|_| \\\\_\\\\____/|_____\\\\____|_|\\\\_\\\\  \\\\___/|___|
                                                                      
                       --- CORE VIBE ENGINE v1.2.0 ---
             With Intelligent Auto-Fallback Synthesizer Simulation
================================================================================

This Python script captures hand tracking data from your webcam, detects hand 
gestures with fine-tuned spatial smoothing and state machines, and broadcasts 
event payloads (including full 21-point landmark arrays) via a local WebSocket 
server to fuel high-performance, responsive cyberdeck web frontends.

*** NEW IN v1.2.0: ***
- Landmarks broadcast in all FIST/PINCH events so the web overlay renders
  your actual hand skeleton in real-time over the hologram viewport.
- Auto-simulation loop activates automatically when falling back (no camera).
- Safe per-socket broadcast handler prevents one stale client crashing others.

Requirements:
    pip install opencv-python mediapipe websockets asyncio
"""

import asyncio
import json
import math
import sys
import os
import time
import random

# Colored logging utility using standard ANSI Escape Sequences
class ConsoleColor:
    CYAN = "\\\\033[96m"
    GREEN = "\\\\033[92m"
    YELLOW = "\\\\033[93m"
    RED = "\\\\033[91m"
    MAGENTA = "\\\\033[95m"
    BLUE = "\\\\033[94m"
    BOLD = "\\\\033[1m"
    UNDERLINE = "\\\\033[4m"
    RESET = "\\\\033[0m"

def print_neon(msg, color=ConsoleColor.CYAN, prefix="[SYSTEM]"):
    """Prints a beautifully formatted, colorized terminal message."""
    timestamp = f"{ConsoleColor.BLUE}{time.strftime('%H:%M:%S')}{ConsoleColor.RESET}"
    print(f"{timestamp} {color}{ConsoleColor.BOLD}{prefix}{ConsoleColor.RESET} {msg}")


# ==============================================================================
#                                  CONFIG PANEL
# ==============================================================================
# Change these values to adapt to your hardware, room lighting, or preferences.
CONFIG = {
    # ------------ SIMULATION CONTROLS ------------
    "SIMULATION_MODE": False,   # Set to True to force mock interactive data feeds (ignoring camera).
    "AUTO_SIMULATION": False,   # Set to True to enable automatic continuous orbit/swipe demo movements.
    
    # ---------------- CAM SETTINGS ----------------
    "WEBCAM_ID": 0,             # 0 is usually the built-in webcam.
    "RUN_HEADLESS": False,      # Set to True if you want to save CPU / don't need cv2 window display feeds.
    "MIRROR_VIDEO": True,       # Flip video horizontally so left acts as left on the screen.
    "FRAME_WIDTH": 640,         # Tracking resolution width.
    "FRAME_HEIGHT": 480,        # Tracking resolution height.
    "TARGET_FPS": 30,           # Frame-rate parsing tick speed limit.
    
    # ------------- WEBSOCKET SETTINGS -------------
    "WS_HOST": "0.0.0.0",       # Localhost bindings.
    "WS_PORT": 8765,            # Port where backend broadcasts JSON logs.
    
    # ----------- MEDIAPIPE AI CONFIG -----------
    "MAX_NUM_HANDS": 1,         # Focus entirely on 1 hand.
    "MIN_DETECTION_CONFIDENCE": 0.75,
    "MIN_TRACKING_CONFIDENCE": 0.75,
    
    # ----------- GESTURE TUNING RATIOS -----------
    "FIST_THRESHOLD": 0.18,       # Lower = tighter fist.
    "PINCH_THRESHOLD": 0.05,      # Normalized pinch threshold.
    "SWIPE_VELOCITY_MIN": 0.5,    # Speed threshold for swipe detection.
    "SMOOTHING_FACTOR": 0.35,     # Exponential moving average filter coefficient.
}


# ==============================================================================
#                    GRAVITY-SAFE OPTIONAL CV2 / MP LOADER
# ==============================================================================
OPENCV_AVAILABLE = False
MEDIAPIPE_AVAILABLE = False

try:
    import cv2
    OPENCV_AVAILABLE = True
except Exception as e:
    print_neon(f"CV2 module skipped or missing. Local previews disabled.", ConsoleColor.YELLOW, "[WARN]")

try:
    import mediapipe as mp
    # Guard against AttributeError if mediapipe is installed but broken/empty
    if hasattr(mp, 'solutions') and hasattr(mp.solutions, 'hands'):
        MEDIAPIPE_AVAILABLE = True
    else:
        print_neon("MediaPipe has no '.solutions.hands' attribute.", ConsoleColor.YELLOW, "[WARN]")
except Exception as e:
    print_neon(f"MediaPipe module failed to load. Gesture extraction disabled.", ConsoleColor.YELLOW, "[WARN]")


# If the configuration forces simulation, or required libraries cannot be found, fallback!
if CONFIG["SIMULATION_MODE"]:
    print_neon("Manual simulation mode is enabled via CONFIG['SIMULATION_MODE'] = True.", ConsoleColor.MAGENTA, "[VIBE]")
elif not OPENCV_AVAILABLE or not MEDIAPIPE_AVAILABLE:
    CONFIG["SIMULATION_MODE"] = True
    CONFIG["AUTO_SIMULATION"] = True  # Auto-enable demo orbit loop when falling back — otherwise the UI stays frozen
    print_neon("AUTOMATIC FALLBACK: OpenCV or MediaPipe are incomplete. Initializing Vibe Simulator...", ConsoleColor.YELLOW, "[SYSTEM]")


# ==============================================================================
#                             GESTURE STATE MACHINE
# ==============================================================================
class GestureDetector:
    """Modulized class responsible for tracking hand state transitions.
    
    Uses geometric landmark ratio calculations to stay highly reliable
    regardless of user's hand size or camera distance.
    """
    def __init__(self):
        # Tracking States
        self.fist_active = False
        self.pinch_active = False
        
        # Smoothed coordinate buffers
        self.smoothed_pinch_x = 0.5
        self.smoothed_pinch_y = 0.5
        
        # Swipe tracking
        self.prev_time = time.time()
        self.prev_wrist_x = None
        self.swipe_cooldown = 0.0

    def calculate_distance(self, p1, p2):
        """Calculates 3D Euclidean distance between two landmarks."""
        return math.sqrt((p1.x - p2.x)**2 + (p1.y - p2.y)**2 + (p1.z - p2.z)**2)

    def serialize_landmarks(self, landmarks):
        """Converts MediaPipe landmark list to JSON-safe list of {x, y, z} dicts."""
        mirror = CONFIG["MIRROR_VIDEO"]
        return [
            {
                "x": round(1.0 - lm.x if mirror else lm.x, 5),
                "y": round(lm.y, 5),
                "z": round(lm.z, 5)
            }
            for lm in landmarks.landmark
        ]

    def process_hand(self, landmarks):
        """Processes 21 MediaPipe landmarks and returns a list of fired events."""
        events = []
        now = time.time()
        dt = now - self.prev_time
        if dt <= 0:
            dt = 0.001
        self.prev_time = now

        # Get critical landmarks
        wrist = landmarks.landmark[0]
        thumb_tip = landmarks.landmark[4]
        index_tip = landmarks.landmark[8]
        middle_tip = landmarks.landmark[12]
        ring_tip = landmarks.landmark[16]
        pinky_tip = landmarks.landmark[20]

        # Serialize all 21 landmarks for web overlay rendering
        serialized_landmarks = self.serialize_landmarks(landmarks)

        # 1. GESTURE: FIST DETECTOR
        hand_scale = self.calculate_distance(wrist, landmarks.landmark[9])
        if hand_scale <= 0:
            hand_scale = 0.1

        distances = [
            self.calculate_distance(index_tip, wrist) / hand_scale,
            self.calculate_distance(middle_tip, wrist) / hand_scale,
            self.calculate_distance(ring_tip, wrist) / hand_scale,
            self.calculate_distance(pinky_tip, wrist) / hand_scale
        ]
        avg_finger_distance = sum(distances) / len(distances)

        # Get stable coordinates from landmark 9 (Middle MCP) representing hand center
        palm_center = landmarks.landmark[9]
        fx = 1.0 - palm_center.x if CONFIG["MIRROR_VIDEO"] else palm_center.x
        fy = palm_center.y
        fx = max(0.0, min(1.0, fx))
        fy = max(0.0, min(1.0, fy))

        if avg_finger_distance < CONFIG["FIST_THRESHOLD"]:
            if not self.fist_active:
                self.fist_active = True
                events.append({
                    "event": "FIST_START",
                    "x": round(fx, 4),
                    "y": round(fy, 4),
                    "landmarks": serialized_landmarks,
                    "details": f"All fingers curled tight! Average distance ratio: {avg_finger_distance:.3f}"
                })
            else:
                events.append({
                    "event": "FIST_MOVE",
                    "x": round(fx, 4),
                    "y": round(fy, 4),
                    "landmarks": serialized_landmarks
                })
        else:
            if self.fist_active:
                self.fist_active = False
                events.append({
                    "event": "FIST_END",
                    "details": f"Fist unclenched. Release ratio: {avg_finger_distance:.3f}"
                })

        # 2. GESTURE: PINCH DETECTOR (skip if fist clench is active)
        if not self.fist_active:
            pinch_distance = self.calculate_distance(index_tip, thumb_tip)
            
            if pinch_distance < CONFIG["PINCH_THRESHOLD"]:
                centroid_x = (index_tip.x + thumb_tip.x) / 2.0
                centroid_y = (index_tip.y + thumb_tip.y) / 2.0
                
                alpha = CONFIG["SMOOTHING_FACTOR"]
                self.smoothed_pinch_x = (alpha * centroid_x) + ((1.0 - alpha) * self.smoothed_pinch_x)
                self.smoothed_pinch_y = (alpha * centroid_y) + ((1.0 - alpha) * self.smoothed_pinch_y)

                tx = 1.0 - self.smoothed_pinch_x if CONFIG["MIRROR_VIDEO"] else self.smoothed_pinch_x
                ty = self.smoothed_pinch_y

                tx = max(0.0, min(1.0, tx))
                ty = max(0.0, min(1.0, ty))

                state_desc = "PINCH_MOVE" if self.pinch_active else "PINCH_START"
                self.pinch_active = True
                
                events.append({
                    "event": state_desc,
                    "x": round(tx, 4),
                    "y": round(ty, 4),
                    "raw_distance": round(pinch_distance, 4),
                    "landmarks": serialized_landmarks
                })
            else:
                if self.pinch_active:
                    self.pinch_active = False
                    events.append({
                        "event": "PINCH_END",
                        "raw_distance": round(pinch_distance, 4)
                    })

        # 3. GESTURE: SWIPE DETECTOR
        if self.prev_wrist_x is not None:
            dx = wrist.x - self.prev_wrist_x
            velocity_x = dx / dt
            
            if self.swipe_cooldown > 0:
                self.swipe_cooldown -= dt
            else:
                scalar_vel = -velocity_x if CONFIG["MIRROR_VIDEO"] else velocity_x
                if abs(scalar_vel) > CONFIG["SWIPE_VELOCITY_MIN"]:
                    direction = "SWIPE_RIGHT" if scalar_vel > 0 else "SWIPE_LEFT"
                    events.append({
                        "event": "SWIPE",
                        "direction": direction,
                        "intensity": round(abs(scalar_vel), 2)
                    })
                    self.swipe_cooldown = 0.5
                    
        self.prev_wrist_x = wrist.x
        return events


# ==============================================================================
#                         ASYNC WEBSOCKET BROADCASTER
# ==============================================================================
class WebSocketBroadcaster:
    """Asynchronous WebSocket broadcaster coordinating connected front-end interfaces."""
    def __init__(self):
        self.connected_sockets = set()

    async def register(self, websocket):
        self.connected_sockets.add(websocket)
        print_neon(f"Cyberdeck Client Handshake Synced! Active Nodes: {len(self.connected_sockets)}", ConsoleColor.GREEN, "[SOCKET]")
        await websocket.send(json.dumps({
            "event": "VIBE_READY",
            "message": "Synaptic pipeline initialized. Cyberdeck responsive.",
            "timestamp": time.time()
        }))

    async def unregister(self, websocket):
        self.connected_sockets.remove(websocket)
        print_neon(f"Cyberdeck Client Link Terminated. Active Nodes: {len(self.connected_sockets)}", ConsoleColor.YELLOW, "[SOCKET]")

    async def broadcast(self, payload):
        """Serializes and sends hand payloads to all open active connections.
        
        Uses a safe per-socket send to isolate failures — a disconnected client
        will not raise an exception that kills the remaining broadcast loop.
        """
        if not self.connected_sockets:
            return
        
        message = json.dumps(payload)
        dead_sockets = set()

        async def safe_send(ws):
            try:
                await asyncio.wait_for(ws.send(message), timeout=0.05)
            except Exception:
                dead_sockets.add(ws)

        await asyncio.gather(*(safe_send(ws) for ws in list(self.connected_sockets)))

        # Prune dead connections identified during this broadcast cycle
        for ws in dead_sockets:
            self.connected_sockets.discard(ws)

    async def socket_handler(self, websocket, path=None):
        await self.register(websocket)
        try:
            async for message in websocket:
                pass
        except Exception:
            pass
        finally:
            await self.unregister(websocket)


# ==============================================================================
#                       ORGANIC GESTURE SIMULATION LOOP
# ==============================================================================
async def main_simulation_loop(broadcaster):
    """Generates continuous organic simulated hand motions for video testing if enabled."""
    print_neon("Synthetic Hand Trajectory Simulator spawned.", ConsoleColor.MAGENTA, "[SIMULATOR]")
    
    if not CONFIG.get("AUTO_SIMULATION", False):
        print_neon("Automatic trajectory demonstration orbits are currently set to IDLE.", ConsoleColor.YELLOW, "[SIMULATOR]")
        print_neon("Hand coordinates are stationary. Set CONFIG['AUTO_SIMULATION'] = True in physical code to activate demoloops.", ConsoleColor.GREEN, "[SIMULATOR]")
        # Keep process running silently so websocket connections are maintained
        while True:
            await asyncio.sleep(1.0)

    print_neon("Broadcasting high-resolution coordinate flows to dashboards...", ConsoleColor.GREEN, "[SIMULATOR]")
    print(f"\\\\n{ConsoleColor.BOLD}{ConsoleColor.CYAN}--- ACTIVE EVENTS REAL-TIME SIMULATED STREAM ---{ConsoleColor.RESET}")

    # Orbital math factors
    t_coord = 0.0
    sim_fist_active = False
    
    # Setup state logs for next periodic actions
    next_fist_time = time.time() + 4.0
    next_swipe_time = time.time() + 9.0

    try:
        while True:
            now = time.time()
            events_to_send = []

            # Math orbits (infinity shape / Lissajous curves) representing continuous finger moves
            t_coord += 0.05
            target_x = 0.5 + 0.3 * math.sin(t_coord)
            target_y = 0.5 + 0.2 * math.sin(t_coord * 1.8)

            # 1. Handle PINCH state or FIST dragging coordinates following trajectory curves
            if not sim_fist_active:
                events_to_send.append({
                    "event": "PINCH_MOVE",
                    "x": round(target_x, 4),
                    "y": round(target_y, 4),
                    "raw_distance": round(0.01 + 0.02 * math.cos(t_coord * 0.4), 4)
                })
            else:
                events_to_send.append({
                    "event": "FIST_MOVE",
                    "x": round(target_x, 4),
                    "y": round(target_y, 4)
                })

            # 2. Periodic periodic FIST actions
            if now > next_fist_time:
                sim_fist_active = not sim_fist_active
                if sim_fist_active:
                    events_to_send.append({
                        "event": "FIST_START",
                        "x": round(target_x, 4),
                        "y": round(target_y, 4),
                        "details": "Simulated organic fist clench started."
                    })
                    # Keep fist closed for 1.8 seconds
                    next_fist_time = now + 1.8
                else:
                    events_to_send.append({
                        "event": "FIST_END",
                        "details": "Simulated organic fist clench ended."
                    })
                    # Next clench in 6 to 10 seconds
                    next_fist_time = now + random.uniform(6.0, 10.0)

            # 3. Periodic horizontal SWIPES
            if now > next_swipe_time and not sim_fist_active:
                swipe_dir = random.choice(["SWIPE_LEFT", "SWIPE_RIGHT"])
                events_to_send.append({
                    "event": "SWIPE",
                    "direction": swipe_dir,
                    "intensity": round(random.uniform(1.8, 3.5), 2)
                })
                # Next swipe in 8 to 14 seconds
                next_swipe_time = now + random.uniform(8.0, 14.0)

            # Ship actions!
            for act in events_to_send:
                action_type = act["event"]
                color_choice = ConsoleColor.GREEN if "START" in action_type else ConsoleColor.YELLOW
                if "MOVE" in action_type:
                    color_choice = ConsoleColor.CYAN
                elif "SWIPE" in action_type or action_type == "SWIPE":
                    color_choice = ConsoleColor.MAGENTA
                    
                log_line = json.dumps(act)
                print(f"{ConsoleColor.BLUE}[{time.strftime('%M:%S')}]{ConsoleColor.RESET} {ConsoleColor.BOLD}{ConsoleColor.UNDERLINE}SIM_{action_type.ljust(12)}{ConsoleColor.RESET} » {log_line}")
                
                await broadcaster.broadcast(act)

            # Broadcast frequency matching FPS configuration
            await asyncio.sleep(1.0 / CONFIG["TARGET_FPS"])

    except asyncio.CancelledError:
        pass


# ==============================================================================
#                       REAL OpenCV + MEDIAPIPE CORE LOOP
# ==============================================================================
async def main_video_loop(broadcaster):
    """Captures camera frames, evaluates computer vision structures, and outputs events."""
    webcam_id = CONFIG["WEBCAM_ID"]
    cap = cv2.VideoCapture(webcam_id)
    
    # Configure frame dimensions
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, CONFIG["FRAME_WIDTH"])
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, CONFIG["FRAME_HEIGHT"])

    if not cap.isOpened():
        print_neon(f"Could not open Camera index '{webcam_id}'. Entering AUTOMATIC SIMULATION fallback...", ConsoleColor.YELLOW, "[WARN]")
        cap.release()
        await main_simulation_loop(broadcaster)
        return

    print_neon(f"Camera stream active on /dev/video{webcam_id}. Capturing at {CONFIG['FRAME_WIDTH']}x{CONFIG['FRAME_HEIGHT']}.", ConsoleColor.GREEN, "[CAMERA]")

    # Initialize MediaPipe Solutions
    mp_hands = mp.solutions.hands
    tracker = mp_hands.Hands(
        max_num_hands=CONFIG["MAX_NUM_HANDS"],
        model_complexity=0, # Fast lightweight model complexity for high speed tracking on lower end CPUs
        min_detection_confidence=CONFIG["MIN_DETECTION_CONFIDENCE"],
        min_tracking_confidence=CONFIG["MIN_TRACKING_CONFIDENCE"]
    )
    mp_draw = mp.solutions.drawing_utils
    detector = GestureDetector()

    print_neon("Synaptic hand tracking framework online! MediaPipe tracking weights loaded.", ConsoleColor.GREEN, "[TRACKER]")
    print_neon("Listening for hand events on WebSocket... Ready to shoot cinematic clips!", ConsoleColor.MAGENTA, "[VIBE]")
    print(f"\\\\n{ConsoleColor.BOLD}{ConsoleColor.CYAN}--- ACTIVE EVENTS REAL-TIME PROCESSOR ---{ConsoleColor.RESET}")

    frame_interval = 1.0 / CONFIG["TARGET_FPS"]
    
    try:
        while True:
            start_frame_time = time.time()
            ret, frame = cap.read()
            if not ret:
                await asyncio.sleep(0.01)
                continue

            if CONFIG["MIRROR_VIDEO"]:
                frame = cv2.flip(frame, 1)

            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = tracker.process(rgb_frame)

            detected_any_hand = False
            
            if results.multi_hand_landmarks:
                detected_any_hand = True
                for hand_landmarks in results.multi_hand_landmarks:
                    if not CONFIG["RUN_HEADLESS"]:
                        mp_draw.draw_landmarks(
                            frame, 
                            hand_landmarks, 
                            mp_hands.HAND_CONNECTIONS,
                            mp_draw.DrawingSpec(color=(0, 255, 230), thickness=2, circle_radius=2), # Cyan
                            mp_draw.DrawingSpec(color=(255, 0, 180), thickness=2, circle_radius=1)  # Hot Pink
                        )

                    displacement_events = detector.process_hand(hand_landmarks)
                    for action in displacement_events:
                        action_type = action["event"]
                        color_choice = ConsoleColor.GREEN if "START" in action_type else ConsoleColor.YELLOW
                        if "MOVE" in action_type:
                            color_choice = ConsoleColor.CYAN
                        elif "SWIPE" in action_type or action_type == "SWIPE":
                            color_choice = ConsoleColor.MAGENTA
                            
                        log_line = json.dumps(action)
                        print(f"{ConsoleColor.BLUE}[{time.strftime('%M:%S')}]{ConsoleColor.RESET} {action_type.ljust(12)} » {log_line}")
                        
                        await broadcaster.broadcast(action)

            # Show window feed with cyberpunk overlay graphics
            if not CONFIG["RUN_HEADLESS"]:
                cv2.putText(frame, "CYBERDECK HARNESS V1.2", (15, 30), 
                            cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 0, 180), 2, cv2.LINE_AA)
                
                status_color = (0, 255, 0) if detected_any_hand else (0, 0, 255)
                status_text = "HAND ACTIVE" if detected_any_hand else "AWAITING SYMPATHETIC HAND"
                cv2.putText(frame, status_text, (15, 55), 
                            cv2.FONT_HERSHEY_SIMPLEX, 0.5, status_color, 1, cv2.LINE_AA)
                
                conn_count = len(broadcaster.connected_sockets)
                cv2.putText(frame, f"SOCKET PEERS: {conn_count}", (15, CONFIG["FRAME_HEIGHT"] - 20),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 230), 1, cv2.LINE_AA)

                cv2.imshow("Cyberdeck Vibe Hand Track HUD", frame)
                
                if cv2.waitKey(1) & 0xFF == ord('q'):
                    print_neon("Manual interrupt key parsed. Initializing cleanup sequence...", ConsoleColor.YELLOW, "[SYSTEM]")
                    break

            elapsed = time.time() - start_frame_time
            delay = max(0.001, frame_interval - elapsed)
            await asyncio.sleep(delay)
            
    except asyncio.CancelledError:
        pass
    finally:
        cap.release()
        cv2.destroyAllWindows()
        print_neon("Camera hardware frame releases completed. Engine powered down gracefully.", ConsoleColor.CYAN, "[SYSTEM]")


# ==============================================================================
#                                   MAIN ENTRY
# ==============================================================================
async def run_engine():
    broadcaster = WebSocketBroadcaster()
    ws_host = CONFIG["WS_HOST"]
    ws_port = CONFIG["WS_PORT"]
    
    try:
        import websockets.server
        ws_srv = await websockets.serve(broadcaster.socket_handler, ws_host, ws_port)
        print_neon(f"WebSocket Daemon listening on » ws://{ws_host}:{ws_port}", ConsoleColor.CYAN, "[SOCKET]")
    except Exception as exc:
        print_neon(f"FATAL: Socket port {ws_port} is already in use!", ConsoleColor.RED, "[ERROR]")
        sys.exit(1)

    # Launch video tracking loop OR simulated loop task
    if CONFIG["SIMULATION_MODE"]:
        execution_task = asyncio.create_task(main_simulation_loop(broadcaster))
    else:
        execution_task = asyncio.create_task(main_video_loop(broadcaster))

    await asyncio.gather(ws_srv.wait_closed(), execution_task)

if __name__ == "__main__":
    os.system('cls' if os.name == 'nt' else 'clear')
    
    print(f"""{ConsoleColor.CYAN}{ConsoleColor.BOLD}
  ▓█████▄  ▄▄▄       ██▀███   ███▄    █  ▄▄▄       ██▓███   ▓█████ 
  ▒██▀ ██▌▒████▄    ▓██ ▒ ██▒ ██ ▀█   █ ▒████▄    ▓██░  ██▒ ▓█   ▀ 
  ░██   █▌▒██  ▀█▄  ▓██ ░▄█ ▒▓██  ▀█ ██▒▒██  ▀█▄  ▓██░ ██▓▒ ▒███   
  ░▓█▄   ▌░██▄▄▄▄██ ▒██▀▀█▄  ▓██▒  ▐▌██▒░██▄▄▄▄██ ▒██▄█▓▒ ▒ ▒▓█  ▄ 
  ░▒████▓  ▓█   ▓██▒░██▓ ▒██▒▒██░   ▓██░ ▓█   ▓██▒▒██▒ ░  ░░▒████▒
   ▒▒▓  ▒  ▒▒   ▓▒█░░ ▒▓ ░▒▓░░ ▒░   ▒ ▒  ▒▒   ▓▒█░▒▓▒░ ░  ░░░ ▒░ ░
   ░ ▒  ▒   ▒   ▒▒ ░  ░▒ ░ ▒░░ ░░   ░ ▒░  ▒   ▒▒ ░░▒ ░      ░ ░  ░
   ░ ░  ░   ░   ▒     ░░   ░    ░   ░ ░   ░   ▒   ░░          ░   
     ░          ░  ░   ░              ░       ░  ░            ░  ░
   ░                                                              
{ConsoleColor.MAGENTA}    »»» MULTI-MODAL MOTION BROADCAST PIPELINE WITH SIMULATOR FALLBACK «««
{ConsoleColor.RESET}""")

    print_neon("Warming system vacuum tubes...", ConsoleColor.CYAN, "[SYSTEM]")
    print_neon(f"Targeting host container: Linux / Mint / Ubuntu core architecture", ConsoleColor.CYAN, "[SYSTEM]")
    
    if CONFIG["SIMULATION_MODE"]:
        print_neon(f"CONFIGURATION FLAG FORCES SIMULATOR MODE. Local camera checks skipped.", ConsoleColor.MAGENTA, "[VIBE]")
    else:
        print_neon(f"CV libraries assessment: OpenCV={OPENCV_AVAILABLE}, MediaPipe={MEDIAPIPE_AVAILABLE}", ConsoleColor.CYAN, "[SYSTEM]")
    
    try:
        asyncio.run(run_engine())
    except KeyboardInterrupt:
        print("\\\\n")
        print_neon("Shutdown signal received via termination keys. Exiting safely.", ConsoleColor.YELLOW, "[VIBE]")
        sys.exit(0)
`;
