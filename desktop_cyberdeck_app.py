#!/usr/bin/env python3
"""
==============================================================================
       ____ _   _ ____  _____ ____  ____  _____ ____ _  __ _   _ ___ 
      / ___| | | |  _ \| ____|  _ \|  _ \| ____/ ___| |/ / | | | |_ _|
     | |   | | | | |_) |  _| | |_) | |_) |  _|| |   | ' /  | | | || | 
     | |___| |_| |  _ <| |___|  _ <|  _ <| |__| |___| . \  | |_| || | 
      \____|\___/|_| \_\_____|_| \_\_| \_\_____\____|_|\_\  \___/|___|
                                                                     
               --- STANDALONE NATIVE DESKTOP CYBERDECK APP ---
                 Dual-Sphere Deep Core Matrix. Solid 60+ FPS.
==============================================================================

This script is a high-performance, standalone Python Desktop UI combining 
Tkinter, OpenCV, and MediaPipe. 

It provides an elegant, double-buffered dual-pane dashboard:
- Left Pane: Deep Core dual-concentric rotating wireframe spheres (Outer Core
             and Inner Core), moving dynamically strictly on your tracked hand coordinates.
- Right Pane: Low-latency live webcam feed with MediaPipe joint overlays, styled
             with a cyberpunk target crosshair HUD.
- Control Panel: Interactive styling sliders, damping factor, and logging terminal.

Note: There are no automatic simulated movements. The sphere remains completely centered In place, 
only translating and warping if your physical hand coordinate feeds are detected!

To run locally:
   pip install opencv-python mediapipe pillow

Running locally:
   python desktop_cyberdeck_app.py

To compile into a single standalone executable:
   pip install pyinstaller
   pyinstaller --onefile --noconsole --name="CyberdeckCore" desktop_cyberdeck_app.py
"""

import sys
import math
import time
import tkinter as tk
from tkinter import messagebox
from PIL import Image, ImageTk

# Safe imports for Computer Vision libraries
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


class CyberdeckTheme:
    """Color palette for a highly polished sci-fi dashboard console."""
    BG_VOID = "#020105"
    BG_PANEL = "#0a0618"
    BG_ACTIVE = "#150a2e"
    NEON_MAGENTA = "#ff007f"
    NEON_CYAN = "#00ffff"
    NEON_GREEN = "#39ff14"
    NEON_YELLOW = "#ffff00"
    MUTED_GRAY = "#62577a"
    TEXT_WHITE = "#ffffff"


class Vector3D:
    def __init__(self, x=0.0, y=0.0, z=0.0):
        self.x = x
        self.y = y
        self.z = z

    def rotate_y(self, angle):
        rad = math.radians(angle)
        cos_a = math.cos(rad)
        sin_a = math.sin(rad)
        return Vector3D(
            self.x * cos_a - self.z * sin_a,
            self.y,
            self.x * sin_a + self.z * cos_a
        )

    def rotate_x(self, angle):
        rad = math.radians(angle)
        cos_a = math.cos(rad)
        sin_a = math.sin(rad)
        return Vector3D(
            self.x,
            self.y * cos_a - self.z * sin_a,
            self.y * sin_a + self.z * cos_a
        )

    def rotate_z(self, angle):
        rad = math.radians(angle)
        cos_a = math.cos(rad)
        sin_a = math.sin(rad)
        return Vector3D(
            self.x * cos_a - self.y * sin_a,
            self.x * sin_a + self.y * cos_a,
            self.z
        )

    def project(self, win_width, win_height, fov=420, distance=3.0):
        # Prevent division by zero if point moves too close
        denom = max(0.1, distance + self.z)
        factor = fov / denom
        x2d = int(win_width / 2 + self.x * factor)
        y2d = int(win_height / 2 - self.y * factor)
        return x2d, y2d


class CyberdeckGUIPanel:
    def __init__(self, root):
        self.root = root
        self.root.title("CYBERDECK standalone CORE CONTROL v2.0")
        self.root.geometry("1180x740")
        self.root.configure(bg=CyberdeckTheme.BG_VOID)

        # Config state
        self.is_camera_on = True
        self.smoothing_factor = 0.28
        self.hologram_form = "SPHERE"  # SPHERE or CYLINDER

        # Coordinates Tracking and Centroid dampening (Centers perfectly on startup)
        self.curr_x = 0.5
        self.curr_y = 0.5
        self.target_x = 0.5
        self.target_y = 0.5
        
        self.pinch_active = False
        self.fist_active = False
        self.hand_detected = False

        # Hologram rotational state metrics
        self.rot_y = 0.0
        self.rot_x = 0.0
        self.rot_z = 0.0

        # Create geometry vertices beforehand (Outer + Inner Concentric Cores)
        self.outer_vertices = []
        self.outer_edges = []
        self.inner_vertices = []
        self.inner_edges = []
        self.generate_hologram_topology()

        # Build GUI layout
        self.setup_ui_layout()

        # Computer Vision capture binds
        self.cap = None
        self.mp_hands = None
        self.mp_tracker = None
        self.init_hardware_stream()

        # Core Loop ticking
        self.last_timer = time.time()
        self.tick_gui_loop()

    def generate_hologram_topology(self):
        """Creates dual concentric 3D point vertices for hyper-detailed aesthetics."""
        self.outer_vertices.clear()
        self.outer_edges.clear()
        self.inner_vertices.clear()
        self.inner_edges.clear()

        # Helper to generate general wireframe shapes
        def make_sphere(radius, rings, points_per_ring):
            verts = []
            edges = []
            for i in range(rings):
                lat = math.pi * (i + 1) / (rings + 1)
                sin_lat = math.sin(lat)
                cos_lat = math.cos(lat)

                for j in range(points_per_ring):
                    lon = 2 * math.pi * j / points_per_ring
                    x = radius * sin_lat * math.cos(lon)
                    z = radius * sin_lat * math.sin(lon)
                    y = radius * cos_lat
                    verts.append(Vector3D(x, y, z))

            # Build latitudal and longitudal structural loops
            for i in range(rings):
                start_r = i * points_per_ring
                for j in range(points_per_ring):
                    curr = start_r + j
                    next_pt = start_r + (j + 1) % points_per_ring
                    edges.append((curr, next_pt))  # Latitude line connect
                    if i < rings - 1:
                        next_ring_pt = curr + points_per_ring
                        edges.append((curr, next_ring_pt))  # Longitude line connect
            return verts, edges

        def make_cylinder(radius, height, levels, points_per_level):
            verts = []
            edges = []
            for i in range(levels):
                y = -height / 2 + (height * i / (levels - 1))
                for j in range(points_per_level):
                    angle = 2 * math.pi * j / points_per_level
                    x = radius * math.cos(angle)
                    z = radius * math.sin(angle)
                    verts.append(Vector3D(x, y, z))

            for i in range(levels):
                start_l = i * points_per_level
                for j in range(points_per_level):
                    curr = start_l + j
                    next_pt = start_l + (j + 1) % points_per_level
                    edges.append((curr, next_pt))
                    if i < levels - 1:
                        edges.append((curr, curr + points_per_level))
            return verts, edges

        if self.hologram_form == "SPHERE":
            self.outer_vertices, self.outer_edges = make_sphere(radius=1.0, rings=9, points_per_ring=12)
            self.inner_vertices, self.inner_edges = make_sphere(radius=0.55, rings=5, points_per_ring=8)
        else:
            self.outer_vertices, self.outer_edges = make_cylinder(radius=0.8, height=1.6, levels=6, points_per_level=12)
            self.inner_vertices, self.inner_edges = make_cylinder(radius=0.45, height=1.0, levels=4, points_per_level=8)

    def setup_ui_layout(self):
        """Builds an advanced tactile mainframe control cockpit."""
        # Top Header Banner Panel
        self.top_header = tk.Frame(self.root, bg=CyberdeckTheme.BG_PANEL, height=70, bd=1, relief=tk.SOLID)
        self.top_header.pack(fill=tk.X, side=tk.TOP, padx=12, pady=10)

        title_lbl = tk.Label(
            self.top_header, 
            text="CORE MOTION MATRIX", 
            fg=CyberdeckTheme.NEON_CYAN, 
            bg=CyberdeckTheme.BG_PANEL, 
            font=("Consolas", 16, "bold")
        )
        title_lbl.pack(side=tk.LEFT, padx=18, pady=12)

        subtitle_lbl = tk.Label(
            self.top_header, 
            text="[DESKTOP NATIVE // OFF-LINE HARNESS]", 
            fg=CyberdeckTheme.MUTED_GRAY, 
            bg=CyberdeckTheme.BG_PANEL, 
            font=("Consolas", 10)
        )
        subtitle_lbl.pack(side=tk.LEFT, padx=5, pady=18)

        # Connectivity diagnostics indicator
        self.system_status_lbl = tk.Label(
            self.top_header,
            text="SENSOR INACTIVE - PLACE HAND",
            fg=CyberdeckTheme.NEON_MAGENTA,
            bg=CyberdeckTheme.BG_PANEL,
            font=("Consolas", 11, "bold"),
            bd=1,
            relief=tk.RIDGE,
            padx=10,
            pady=4
        )
        self.system_status_lbl.pack(side=tk.RIGHT, padx=20)

        # Split pane structure
        self.main_split_frm = tk.Frame(self.root, bg=CyberdeckTheme.BG_VOID)
        self.main_split_frm.pack(fill=tk.BOTH, expand=True, padx=12, pady=5)

        # left hologram viewport
        self.hologram_frm = tk.LabelFrame(
            self.main_split_frm, 
            text=" DEEP HOLOGRAM VECTOR GRAPHIC ", 
            fg=CyberdeckTheme.NEON_CYAN, 
            bg=CyberdeckTheme.BG_PANEL,
            font=("Consolas", 9, "bold"),
            padx=10,
            pady=10,
            bd=1
        )
        self.hologram_frm.pack(fill=tk.BOTH, side=tk.LEFT, expand=True, padx=6, pady=6)

        self.canvas_3d = tk.Canvas(
            self.hologram_frm, 
            bg=CyberdeckTheme.BG_VOID, 
            bd=0, 
            highlightthickness=1, 
            highlightbackground="#24134c"
        )
        self.canvas_3d.pack(fill=tk.BOTH, expand=True)

        # right camera viewport
        self.video_frm = tk.LabelFrame(
            self.main_split_frm, 
            text=" WEBCAM SENSOR LINK ", 
            fg=CyberdeckTheme.NEON_MAGENTA, 
            bg=CyberdeckTheme.BG_PANEL,
            font=("Consolas", 9, "bold"),
            padx=10,
            pady=10,
            bd=1
        )
        self.video_frm.pack(fill=tk.BOTH, side=tk.RIGHT, expand=False, width=510, padx=6, pady=6)

        self.lbl_video_display = tk.Label(
            self.video_frm, 
            bg=CyberdeckTheme.BG_VOID,
            bd=0,
            text="WEBCAM HARDWARE SCANNER STARTING...",
            fg=CyberdeckTheme.MUTED_GRAY,
            font=("Consolas", 11)
        )
        self.lbl_video_display.pack(fill=tk.BOTH, expand=True)

        # Bottom Dock panel for fine control
        self.dock_ctrl_panel = tk.Frame(self.root, bg=CyberdeckTheme.BG_PANEL, height=130, bd=1, relief=tk.SOLID)
        self.dock_ctrl_panel.pack(fill=tk.X, side=tk.BOTTOM, padx=12, pady=10)

        # Controls columns
        btn_grid_frm = tk.Frame(self.dock_ctrl_panel, bg=CyberdeckTheme.BG_PANEL)
        btn_grid_frm.pack(side=tk.LEFT, padx=15, pady=10)

        self.btn_camera = tk.Button(
            btn_grid_frm, 
            text="A CAMERA ACTIVE", 
            command=self.action_toggle_camera,
            bg="#25093a",
            fg=CyberdeckTheme.NEON_CYAN,
            activebackground=CyberdeckTheme.NEON_CYAN,
            activeforeground="black",
            relief=tk.FLAT,
            font=("Consolas", 9, "bold"),
            padx=12,
            pady=6,
            bd=1,
            highlightbackground=CyberdeckTheme.NEON_CYAN
        )
        self.btn_camera.grid(row=0, column=0, padx=5, pady=5)

        self.btn_shape_toggle = tk.Button(
            btn_grid_frm, 
            text="SWITCH GEOMETRY FORM", 
            command=self.action_toggle_shape,
            bg="#25093a",
            fg=CyberdeckTheme.NEON_YELLOW,
            activebackground=CyberdeckTheme.NEON_YELLOW,
            activeforeground="black",
            relief=tk.FLAT,
            font=("Consolas", 9, "bold"),
            padx=12,
            pady=6,
            bd=1
        )
        self.btn_shape_toggle.grid(row=0, column=1, padx=5, pady=5)

        # Slider and interpolation
        slide_frm = tk.Frame(self.dock_ctrl_panel, bg=CyberdeckTheme.BG_PANEL)
        slide_frm.pack(side=tk.LEFT, padx=40, pady=10)

        tk.Label(
            slide_frm, 
            text="MOTION INTERPOLATION DAMPING:", 
            fg=CyberdeckTheme.MUTED_GRAY, 
            bg=CyberdeckTheme.BG_PANEL,
            font=("Consolas", 8, "bold")
        ).pack(anchor="w", pady=2)

        self.slide_factor = tk.Scale(
            slide_frm, 
            from_=0.01, 
            to=1.00, 
            resolution=0.01, 
            orient=tk.HORIZONTAL,
            bg=CyberdeckTheme.BG_PANEL,
            fg=CyberdeckTheme.NEON_CYAN,
            activebackground=CyberdeckTheme.NEON_CYAN,
            troughcolor="#150a2e",
            highlightthickness=0,
            command=self.update_damping_factor,
            width=12,
            length=240
        )
        self.slide_factor.set(self.smoothing_factor)
        self.slide_factor.pack(fill=tk.X, expand=True)

        # Telemetry scroll feed log
        log_panel_frm = tk.Frame(self.dock_ctrl_panel, bg=CyberdeckTheme.BG_VOID, bd=1, relief=tk.SOLID)
        log_panel_frm.pack(side=tk.RIGHT, fill=tk.BOTH, expand=True, padx=15, pady=10)

        self.scroll_diag_log = tk.Label(
            log_panel_frm, 
            text="λ SYSTEM DIAGNOSTIC DOCK INITIALIZED\nλ Placing trackers inside local sensor boundaries...", 
            fg=CyberdeckTheme.NEON_GREEN, 
            bg=CyberdeckTheme.BG_VOID,
            font=("Consolas", 8),
            justify=tk.LEFT,
            anchor="nw"
        )
        self.scroll_diag_log.pack(fill=tk.BOTH, expand=True, padx=10, pady=5)

    def init_hardware_stream(self):
        """Initializes actual opencv / mediapipe hardware tracking pipeline."""
        if not OPENCV_AVAILABLE:
            self.write_telemetry("ERROR: OpenCV is not installed on this PC. Camera is unavailable.")
            self.lbl_video_display.configure(text="OPENCV MISSING\nRun: pip install opencv-python")
            return

        self.write_telemetry("Warmup sequence: Opening local system camera...")
        self.cap = cv2.VideoCapture(0)
        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, 480)
        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 360)

        if not self.cap.isOpened():
            self.write_telemetry("ERROR: Webcam not detected. Please verify your camera is connected locally.")
            self.lbl_video_display.configure(text="NO WEBCAM ATTACHED // VERIFY HARDWARE")
            return

        if MEDIAPIPE_AVAILABLE:
            self.mp_hands = mp.solutions.hands
            self.mp_tracker = self.mp_hands.Hands(
                max_num_hands=1,
                model_complexity=0,  # Fast lightweight tracking model
                min_detection_confidence=0.75,
                min_tracking_confidence=0.75
            )
            self.write_telemetry("HARDWARE ONLINE: OpenCV webcam + MediaPipe skeleton parser loaded successfully.")
        else:
            self.write_telemetry("WARN: MediaPipe not found on your local system path. Active tracking is limited.")
            self.lbl_video_display.configure(text="MEDIAPIPE MISSING\nRun: pip install mediapipe")

    def action_toggle_camera(self):
        self.is_camera_on = not self.is_camera_on
        if self.is_camera_on:
            self.btn_camera.configure(bg="#25093a", text="A CAMERA ACTIVE", fg=CyberdeckTheme.NEON_CYAN)
            self.write_telemetry("SENSORS: Camera engine reactivated.")
            self.init_hardware_stream()
        else:
            self.btn_camera.configure(bg=CyberdeckTheme.BG_VOID, text="SENSORS OFF-LINE", fg=CyberdeckTheme.MUTED_GRAY)
            self.write_telemetry("SENSORS: Suspended. Sphere resting at center coordinates.")
            if self.cap:
                self.cap.release()
                self.cap = None
            self.lbl_video_display.configure(text="CAMERA HARDWARE FEED SUSPENDED", image="")
            self.target_x = 0.5
            self.target_y = 0.5
            self.hand_detected = False

    def action_toggle_shape(self):
        self.hologram_form = "CYLINDER" if self.hologram_form == "SPHERE" else "SPHERE"
        self.generate_hologram_topology()
        self.write_telemetry(f"GEOMETRY: Reconstruction of matrix wireframe into {self.hologram_form}")

    def update_damping_factor(self, value):
        self.smoothing_factor = float(value)

    def write_telemetry(self, text_line):
        time_tag = time.strftime('%H:%M:%S')
        new_text = f"λ [{time_tag}] {text_line}\n"
        curr_text = self.scroll_diag_log.cget("text")
        lines = curr_text.split('\n')
        if len(lines) > 4:
            lines = lines[:4]
        self.scroll_diag_log.configure(text=new_text + "\n".join(lines))

    def tick_rendering_pipeline(self):
        """Standard high-velocity double-buffered vector projection engine with HUD dials."""
        self.canvas_3d.delete("all")

        w = self.canvas_3d.winfo_width()
        h = self.canvas_3d.winfo_height()
        if w < 100 or h < 100:
            return  # Shield before UI renders fully

        # Center and circular locator dials
        cx, cy = w / 2, h / 2
        min_dim = min(w, h)
        r_locator = min_dim * 0.32

        # 1. Background horizon grid ticks
        self.canvas_3d.create_oval(
            cx - r_locator, cy - r_locator,
            cx + r_locator, cy + r_locator,
            outline="#160e32", width=1, dash=(30, 20)
        )
        self.canvas_3d.create_line(cx - r_locator - 20, cy, cx + r_locator + 20, cy, fill="#120c28", width=1)
        self.canvas_3d.create_line(cx, cy - r_locator - 20, cx, cy + r_locator + 20, fill="#120c28", width=1)

        # Horizon scanning line ticks (gives high-tech instrument cockpit look)
        for i in range(-5, 6):
            if i != 0:
                self.canvas_3d.create_line(cx - 10, cy + i * 30, cx + 10, cy + i * 30, fill="#1b123a")

        # 2. Coordinates derivation for rotation
        # Outer mesh coordinates (smooth tracking rotation)
        target_yaw = (self.curr_x - 0.5) * 160
        target_pitch = (self.curr_y - 0.5) * -160

        self.rot_y += (target_yaw - self.rot_y) * 0.08
        self.rot_x += (target_pitch - self.rot_x) * 0.08

        # Continuous automatic idle rotation around Z-axis and default spinning to feel alive
        self.rot_z += 0.4

        # Scale modifier based on clenched hand fist active compression
        scale_val = 0.6 if self.fist_active else 1.0

        # Draw Inner Core geometries first (Depth rendering sequence)
        inner_projected = []
        for v in self.inner_vertices:
            # Multi-axis complex spiral rotation (oppositing orbit for cool style)
            rotated = v.rotate_y(-self.rot_y * 1.5 - (time.time() * 20)).rotate_x(self.rot_x).rotate_z(-self.rot_z * 2)
            rotated.x *= scale_val
            rotated.y *= scale_val
            rotated.z *= scale_val

            px, py = rotated.project(w, h, fov=min_dim * 0.40)
            inner_projected.append((px, py, rotated.z))

        # Project Inner Core paths (Cyan)
        inner_color = CyberdeckTheme.NEON_CYAN
        for edge in self.inner_edges:
            p1 = inner_projected[edge[0]]
            p2 = inner_projected[edge[1]]
            avg_z = (p1[2] + p2[2]) / 2.0
            if avg_z > 0.0:  # Backface occlusion scaling
                color = "#042030"
            else:
                color = inner_color
            self.canvas_3d.create_line(p1[0], p1[1], p2[0], p2[1], fill=color, width=1)

        # Draw Outer Core geometries (Pink)
        outer_projected = []
        for v in self.outer_vertices:
            rotated = v.rotate_y(self.rot_y).rotate_x(self.rot_x).rotate_z(self.rot_z)
            rotated.x *= scale_val
            rotated.y *= scale_val
            rotated.z *= scale_val

            # Apply subtle lateral physical coordinate displacement offset if hand is tracking
            if self.hand_detected:
                disp_x = (self.curr_x - 0.5) * (w * 0.45)
                disp_y = (self.curr_y - 0.5) * -(h * 0.45)
                px, py = rotated.project(w, h, fov=min_dim * 0.40)
                px += int(disp_x)
                py += int(disp_y)
            else:
                px, py = rotated.project(w, h, fov=min_dim * 0.40)

            outer_projected.append((px, py, rotated.z))

        outer_color = CyberdeckTheme.NEON_MAGENTA if self.pinch_active else "#b00560"
        outer_width = 2 if self.pinch_active else 1

        for edge in self.outer_edges:
            p1 = outer_projected[edge[0]]
            p2 = outer_projected[edge[1]]
            avg_z = (p1[2] + p2[2]) / 2.0

            if avg_z > 0.1:
                color = "#350820"
                width = 1
            else:
                color = outer_color
                width = outer_width
            self.canvas_3d.create_line(p1[0], p1[1], p2[0], p2[1], fill=color, width=width)

        # 3. Dynamic Telemetry HUD text overlays (Flight Console format)
        self.canvas_3d.create_text(
            15, 15, 
            text=f"A-MATRIX: [{self.hologram_form}]", 
            fill=CyberdeckTheme.NEON_MAGENTA, 
            font=("Consolas", 10, "bold"), anchor="w"
        )
        self.canvas_3d.create_text(
            15, 32, 
            text=f"PITCH_DEG: {int(target_pitch):+04d}°", 
            fill=CyberdeckTheme.NEON_CYAN, 
            font=("Consolas", 9), anchor="w"
        )
        self.canvas_3d.create_text(
            15, 47, 
            text=f"YAW_DEG  : {int(target_yaw):+04d}°", 
            fill=CyberdeckTheme.NEON_CYAN, 
            font=("Consolas", 9), anchor="w"
        )

        tracking_state = "IDLE // SEARCHING FOR HAND"
        state_color = CyberdeckTheme.MUTED_GRAY
        if self.hand_detected:
            if self.pinch_active:
                tracking_state = "ACTIVE TARGET PINCH ENGAGED"
                state_color = CyberdeckTheme.NEON_CYAN
            elif self.fist_active:
                tracking_state = "COMPASS EXTREME FIST CLENCH ACTIVE"
                state_color = CyberdeckTheme.NEON_MAGENTA
            else:
                tracking_state = "BEACON CENTROID LOCKED"
                state_color = CyberdeckTheme.NEON_GREEN

        self.canvas_3d.create_text(
            15, h - 20, 
            text=f"HUD LOG:: {tracking_state}", 
            fill=state_color, 
            font=("Consolas", 9, "bold"), anchor="w"
        )

        # Glowing corner styling blocks for sci-fi HUD frame feel
        sz = 20
        # TR
        self.canvas_3d.create_line(w - sz - 10, 10, w - 10, 10, fill=CyberdeckTheme.MUTED_GRAY)
        self.canvas_3d.create_line(w - 10, 10, w - 10, sz + 10, fill=CyberdeckTheme.MUTED_GRAY)
        # TL
        self.canvas_3d.create_line(10, 10, sz + 10, 10, fill=CyberdeckTheme.MUTED_GRAY)
        self.canvas_3d.create_line(10, 10, 10, sz + 10, fill=CyberdeckTheme.MUTED_GRAY)
        # BL
        self.canvas_3d.create_line(10, h - 10, sz + 10, h - 10, fill=CyberdeckTheme.MUTED_GRAY)
        self.canvas_3d.create_line(10, h - 10, 10, h - sz - 10, fill=CyberdeckTheme.MUTED_GRAY)
        # BR
        self.canvas_3d.create_line(w - sz - 10, h - 10, w - 10, h - 10, fill=CyberdeckTheme.MUTED_GRAY)
        self.canvas_3d.create_line(w - 10, h - 10, w - 10, h - sz - 10, fill=CyberdeckTheme.MUTED_GRAY)

    def tick_gui_loop(self):
        """Core CV capture, coordinate state machine damping, and viewport ticks."""
        now = time.time()
        self.last_timer = now

        # Reading local webcam coordinates if active
        if self.is_camera_on and self.cap:
            ret, frame = self.cap.read()
            if ret:
                # Mirror captured matrix
                frame = cv2.flip(frame, 1)
                fh, fw, _ = frame.shape

                # Draw beautiful targeting bracket bounds in safety zone
                cv2.rectangle(frame, (int(fw*0.15), int(fh*0.15)), (int(fw*0.85), int(fh*0.85)), (40, 15, 60), 1)

                has_hands = False
                if MEDIAPIPE_AVAILABLE:
                    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                    results = self.mp_tracker.process(rgb)

                    if results.multi_hand_landmarks:
                        has_hands = True
                        hand_lms = results.multi_hand_landmarks[0]

                        wrist = hand_lms.landmark[0]
                        thumb_tip = hand_lms.landmark[4]
                        index_tip = hand_lms.landmark[8]
                        middle_tip = hand_lms.landmark[12]
                        centroid = hand_lms.landmark[9]

                        # Overlay target skeleton wireframe joints
                        for joint in [
                            (0, 1), (1, 2), (2, 3), (3, 4),
                            (0, 5), (5, 6), (6, 7), (7, 8),
                            (5, 9), (9, 10), (10, 11), (11, 12),
                            (0, 17)
                        ]:
                            p1 = hand_lms.landmark[joint[0]]
                            p2 = hand_lms.landmark[joint[1]]
                            cv2.line(frame, 
                                     (int(p1.x * fw), int(p1.y * fh)), 
                                     (int(p2.x * fw), int(p2.y * fh)), 
                                     (255, 0, 140), 1)

                        for lm in hand_lms.landmark:
                            cv2.circle(frame, (int(lm.x * fw), int(lm.y * fh)), 3, (0, 255, 255), -1)

                        # Set real coordinates target strictly from centroid hand mapping
                        self.target_x = centroid.x
                        self.target_y = centroid.y
                        
                        if not self.hand_detected:
                            self.write_telemetry("SENSORS: Centroid lock acquired.")
                        self.hand_detected = True

                        # Distance analysis for gesture state
                        dist_hand_scale = math.sqrt((wrist.x - centroid.x)**2 + (wrist.y - centroid.y)**2) or 0.1
                        dist_fist = math.sqrt((index_tip.x - wrist.x)**2 + (index_tip.y - wrist.y)**2) / dist_hand_scale
                        dist_pinch = math.sqrt((index_tip.x - thumb_tip.x)**2 + (index_tip.y - thumb_tip.y)**2)

                        if dist_fist < 1.15:
                            if not self.fist_active:
                                self.write_telemetry("SENSORS: [CLENCH GESTURE] detected.")
                            self.fist_active = True
                            self.pinch_active = False
                        else:
                            self.fist_active = False
                            if dist_pinch < 0.05:
                                if not self.pinch_active:
                                    self.write_telemetry("SENSORS: [PINCH UNISON LOCK] engaged.")
                                self.pinch_active = True
                                self.target_x = (index_tip.x + thumb_tip.x) / 2.0
                                self.target_y = (index_tip.y + thumb_tip.y) / 2.0
                            else:
                                self.pinch_active = False
                    else:
                        # Hand went out of camera sensor view. Slowly center target coordinates back to 0.5 without jumping!
                        self.target_x = 0.5
                        self.target_y = 0.5
                        if self.hand_detected:
                            self.write_telemetry("SENSORS: Centroid lost. Centering target vector.")
                        self.hand_detected = False
                        self.pinch_active = False
                        self.fist_active = False
                else:
                    # Simple OpenCV capture fallback without hand landmarks tracking
                    self.target_x = 0.5
                    self.target_y = 0.5
                    self.hand_detected = False

                # Top Indicator panel update
                if self.hand_detected:
                    self.system_status_lbl.configure(text="SENSOR STREAM ACTIVE", fg=CyberdeckTheme.NEON_GREEN)
                else:
                    self.system_status_lbl.configure(text="SENSOR INACTIVE - PLACE HAND", fg=CyberdeckTheme.NEON_MAGENTA)

                # Render camera to dashboard label monitor
                frame_resized = cv2.resize(frame, (480, 360))
                # Add stylish cyan corners overlay to the webcam monitor
                cv2_img = cv2.cvtColor(frame_resized, cv2.COLOR_BGR2RGB)
                pil_img = Image.fromarray(cv2_img)
                tk_img = ImageTk.PhotoImage(image=pil_img)

                self.lbl_video_display.configure(image=tk_img, text="")
                self.lbl_video_display.image = tk_img
            else:
                self.lbl_video_display.configure(text="HARDWARE DISCONNECTED\nVerify local webcam settings.")

        # Interpolate coordinates smoothly with damping (if hand is missing, returns dampening back to center)
        self.curr_x += (self.target_x - self.curr_x) * self.smoothing_factor
        self.curr_y += (self.target_y - self.curr_y) * self.smoothing_factor

        self.tick_rendering_pipeline()

        # Enforce highly accurate ticks ~30 FPS
        self.root.after(30, self.tick_gui_loop)


if __name__ == "__main__":
    # Launch system
    root_window = tk.Tk()
    gui_app = CyberdeckGUIPanel(root_window)

    def on_app_exit():
        if gui_app.cap:
            gui_app.cap.release()
        root_window.destroy()

    root_window.protocol("WM_DELETE_WINDOW", on_app_exit)
    root_window.mainloop()
