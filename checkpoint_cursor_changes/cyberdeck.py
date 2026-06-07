#!/usr/bin/env python3
"""
CYBERDECK GESTURE CONTROLLER v3.0
=================================
Native desktop app — no browser, no Node.js, no npm.

  python cyberdeck.py          # Full GUI (pygame, 60 FPS)
  python cyberdeck.py --help

Requirements: pip install -r requirements.txt
Build .exe:   python build.py
"""

from __future__ import annotations

import argparse
import math
import random
import sys
import time
from typing import List, Optional, Tuple

import numpy as np

try:
    import pygame
except ImportError:
    print("pygame is required. Run: pip install -r requirements.txt")
    sys.exit(1)

from cyberdeck.camera import CameraPipeline, CameraConfig, OPENCV_AVAILABLE, MEDIAPIPE_AVAILABLE
from cyberdeck.gestures import HAND_CONNECTIONS
from cyberdeck.math3d import Vec3, build_topology
from cyberdeck.theme import COLORS


# ── Layout ──────────────────────────────────────────────────────────────────
WIN_W, WIN_H = 1280, 800
HEADER_H = 56
FOOTER_H = 110
CAM_W = 420
TARGET_FPS = 60


class Particle:
    __slots__ = ("x", "y", "z", "ox", "oy", "oz", "hue")

    def __init__(self):
        self.ox = random.uniform(-1.2, 1.2)
        self.oy = random.uniform(-1.2, 1.2)
        self.oz = random.uniform(-1.2, 1.2)
        self.x = self.ox
        self.y = self.oy
        self.z = self.oz
        self.hue = random.choice(["magenta", "cyan"])


class HologramRenderer:
    def __init__(self, width: int, height: int):
        self.width = width
        self.height = height
        self.form = "SPHERE"
        self.outer_v, self.outer_e, self.inner_v, self.inner_e = build_topology(self.form)
        self.rot_x = 0.0
        self.rot_y = 0.0
        self.rot_z = 0.0
        self.particles: List[Particle] = [Particle() for _ in range(180)]
        self.scan_y = 0.0
        self.swipe_flash = 0.0

    def set_form(self, form: str) -> None:
        self.form = form
        self.outer_v, self.outer_e, self.inner_v, self.inner_e = build_topology(form)

    def _project_mesh(
        self,
        verts: List[Vec3],
        rot_x: float,
        rot_y: float,
        rot_z: float,
        scale: float,
        offset_x: float,
        offset_y: float,
        fov: float,
    ) -> List[Tuple[int, int, float]]:
        projected = []
        for v in verts:
            p = v.scale(scale)
            p = p.rotate_y(rot_y).rotate_x(rot_x).rotate_z(rot_z)
            x, y, z = p.project(self.width, self.height, fov=fov)
            projected.append((x + int(offset_x), y + int(offset_y), z))
        return projected

    def render(
        self,
        surface: pygame.Surface,
        hand_x: float,
        hand_y: float,
        hand_detected: bool,
        fist: bool,
        pinch: bool,
        swipe: Optional[str],
        dt: float,
    ) -> None:
        surface.fill(COLORS.VOID)
        cx, cy = self.width / 2, self.height / 2
        min_dim = min(self.width, self.height)
        fov = min_dim * 0.42

        # Grid + horizon
        pygame.draw.circle(surface, COLORS.GRID, (int(cx), int(cy)), int(min_dim * 0.34), 1)
        pygame.draw.line(surface, (18, 10, 36), (0, int(cy)), (self.width, int(cy)), 1)
        pygame.draw.line(surface, (18, 10, 36), (int(cx), 0), (int(cx), self.height), 1)

        target_yaw = (hand_x - 0.5) * 140
        target_pitch = (hand_y - 0.5) * -140
        self.rot_y += (target_yaw - self.rot_y) * 0.12
        self.rot_x += (target_pitch - self.rot_x) * 0.12
        self.rot_z += 0.55 + (2.5 if swipe else 0.0)

        if swipe:
            self.swipe_flash = 1.0
        self.swipe_flash = max(0.0, self.swipe_flash - dt * 2.5)

        scale = 0.55 if fist else 1.0
        disp_x = (hand_x - 0.5) * self.width * 0.35 if hand_detected else 0.0
        disp_y = (hand_y - 0.5) * -self.height * 0.35 if hand_detected else 0.0

        inner_rot_y = -self.rot_y * 1.4 - time.time() * 18
        inner_proj = self._project_mesh(
            self.inner_v, self.rot_x, inner_rot_y, -self.rot_z * 1.8,
            scale, disp_x, disp_y, fov,
        )
        outer_proj = self._project_mesh(
            self.outer_v, self.rot_x, self.rot_y, self.rot_z,
            scale, disp_x, disp_y, fov,
        )

        # Particles
        for p in self.particles:
            p.x = p.ox + math.sin(time.time() * 0.7 + p.oz) * 0.05
            p.y = p.oy + math.cos(time.time() * 0.5 + p.ox) * 0.05
            pv = Vec3(p.x, p.y, p.z).rotate_y(self.rot_y * 0.3).rotate_x(self.rot_x * 0.2)
            px, py, pz = pv.project(self.width, self.height, fov=fov * 0.9)
            px += int(disp_x * 0.5)
            py += int(disp_y * 0.5)
            if pz < 0 and 0 <= px < self.width and 0 <= py < self.height:
                color = COLORS.CYAN if p.hue == "cyan" else COLORS.MAGENTA
                pygame.draw.circle(surface, color, (px, py), 1)

        # Inner core (cyan)
        for i, j in self.inner_e:
            p1, p2 = inner_proj[i], inner_proj[j]
            avg_z = (p1[2] + p2[2]) / 2
            color = COLORS.DEEP_CYAN if avg_z > 0 else COLORS.CYAN
            pygame.draw.line(surface, color, (p1[0], p1[1]), (p2[0], p2[1]))

        # Outer core (magenta)
        outer_color = COLORS.CYAN if pinch else COLORS.MAGENTA
        line_w = 2 if pinch else 1
        for i, j in self.outer_e:
            p1, p2 = outer_proj[i], outer_proj[j]
            avg_z = (p1[2] + p2[2]) / 2
            color = (53, 8, 32) if avg_z > 0.1 else outer_color
            pygame.draw.line(surface, color, (p1[0], p1[1]), (p2[0], p2[1]), line_w)

        # Scan line
        self.scan_y = (self.scan_y + dt * 120) % self.height
        scan_color = (0, 80, 80, 40)
        scan_surf = pygame.Surface((self.width, 3), pygame.SRCALPHA)
        scan_surf.fill(scan_color)
        surface.blit(scan_surf, (0, int(self.scan_y)))

        # Swipe flash ring
        if self.swipe_flash > 0:
            radius = int((1.0 - self.swipe_flash) * min_dim * 0.5)
            pygame.draw.circle(surface, COLORS.GREEN, (int(cx), int(cy)), radius, 2)

        # HUD corners
        self._draw_corners(surface)
        self._draw_hud_text(surface, hand_detected, fist, pinch, swipe, target_pitch, target_yaw)

    def _draw_corners(self, surface: pygame.Surface) -> None:
        w, h = self.width, self.height
        c = COLORS.MUTED
        s = 18
        for ox, oy, dx, dy in [
            (10, 10, 1, 1), (w - 10, 10, -1, 1),
            (10, h - 10, 1, -1), (w - 10, h - 10, -1, -1),
        ]:
            pygame.draw.line(surface, c, (ox, oy), (ox + dx * s, oy), 1)
            pygame.draw.line(surface, c, (ox, oy), (ox, oy + dy * s), 1)

    def _draw_hud_text(
        self, surface, detected, fist, pinch, swipe,
        pitch, yaw,
    ) -> None:
        font = pygame.font.SysFont("consolas", 14, bold=True)
        small = pygame.font.SysFont("consolas", 12)

        lines = [
            (font, f"MATRIX: {self.form}", COLORS.MAGENTA, (14, 12)),
            (small, f"PITCH: {int(pitch):+4d}°  YAW: {int(yaw):+4d}°", COLORS.CYAN, (14, 32)),
        ]
        if fist:
            status, sc = "FIST COMPRESS", COLORS.MAGENTA
        elif pinch:
            status, sc = "PINCH LOCK", COLORS.CYAN
        elif detected:
            status, sc = "PALM TRACKING", COLORS.GREEN
        else:
            status, sc = "SCANNING...", COLORS.MUTED
        lines.append((font, f"STATUS: {status}", sc, (14, self.height - 28)))
        if swipe:
            lines.append((small, f"SWIPE: {swipe}", COLORS.YELLOW, (14, self.height - 48)))

        for fn, text, color, pos in lines:
            surface.blit(fn.render(text, True, color), pos)


def draw_webcam_panel(
    surface: pygame.Surface,
    frame: Optional[np.ndarray],
    landmarks,
    hand_detected: bool,
    rect: pygame.Rect,
) -> None:
    pygame.draw.rect(surface, COLORS.PANEL, rect)
    pygame.draw.rect(surface, COLORS.MUTED, rect, 1)

    inner = rect.inflate(-16, -16)
    if frame is None:
        font = pygame.font.SysFont("consolas", 13)
        msg = font.render("CAMERA OFFLINE", True, COLORS.MUTED)
        surface.blit(msg, msg.get_rect(center=inner.center))
        return

    fh, fw = frame.shape[:2]
    scale = min(inner.width / fw, inner.height / fh)
    dw, dh = int(fw * scale), int(fh * scale)
    resized = frame if (dw == fw and dh == fh) else _cv2_resize(frame, dw, dh)

    rgb = resized[:, :, ::-1]
    cam_surf = pygame.surfarray.make_surface(np.transpose(rgb, (1, 0, 2)))
    dest = cam_surf.get_rect(center=inner.center)
    surface.blit(cam_surf, dest)

    if landmarks and hand_detected:
        ox = dest.x
        oy = dest.y
        for i, j in HAND_CONNECTIONS:
            p1, p2 = landmarks[i], landmarks[j]
            x1 = ox + int(p1["x"] * dw)
            y1 = oy + int(p1["y"] * dh)
            x2 = ox + int(p2["x"] * dw)
            y2 = oy + int(p2["y"] * dh)
            pygame.draw.line(surface, COLORS.MAGENTA, (x1, y1), (x2, y2), 1)
        for lm in landmarks:
            x = ox + int(lm["x"] * dw)
            y = oy + int(lm["y"] * dh)
            pygame.draw.circle(surface, COLORS.CYAN, (x, y), 3)

    # Targeting reticle
    cx, cy = inner.center
    r = 28
    pygame.draw.rect(surface, COLORS.MAGENTA, (cx - r, cy - r, r * 2, r * 2), 1)
    pygame.draw.line(surface, COLORS.CYAN, (cx - 8, cy), (cx + 8, cy), 1)
    pygame.draw.line(surface, COLORS.CYAN, (cx, cy - 8), (cx, cy + 8), 1)


def _cv2_resize(frame: np.ndarray, w: int, h: int) -> np.ndarray:
    import cv2
    return cv2.resize(frame, (w, h), interpolation=cv2.INTER_LINEAR)


class CyberdeckApp:
    def __init__(self):
        pygame.init()
        pygame.display.set_caption("CYBERDECK GESTURE CONTROLLER v3.0 — NATIVE")
        self.screen = pygame.display.set_mode((WIN_W, WIN_H))
        self.clock = pygame.clock.Clock()
        self.font = pygame.font.SysFont("consolas", 14)
        self.font_sm = pygame.font.SysFont("consolas", 11)
        self.font_lg = pygame.font.SysFont("consolas", 18, bold=True)

        holo_w = WIN_W - CAM_W - 48
        holo_h = WIN_H - HEADER_H - FOOTER_H - 24
        self.holo_rect = pygame.Rect(16, HEADER_H + 8, holo_w, holo_h)
        self.cam_rect = pygame.Rect(self.holo_rect.right + 16, HEADER_H + 8, CAM_W - 16, holo_h)

        self.hologram = HologramRenderer(self.holo_rect.width, self.holo_rect.height)
        self.holo_surface = pygame.Surface((self.holo_rect.width, self.holo_rect.height))

        self.camera = CameraPipeline(CameraConfig(
            width=640, height=480, target_fps=60, smoothing=0.42,
        ))
        self.camera_on = True
        self.logs: List[str] = []
        self.render_fps = 0.0
        self._fps_counter = 0
        self._fps_timer = time.perf_counter()

        ok, msg = self.camera.start()
        self._log(msg if ok else f"ERROR: {msg}")

    def _log(self, text: str) -> None:
        stamp = time.strftime("%H:%M:%S")
        self.logs.insert(0, f"[{stamp}] {text}")
        self.logs = self.logs[:6]

    def run(self) -> None:
        running = True
        while running:
            dt = self.clock.tick(TARGET_FPS) / 1000.0
            self._fps_counter += 1
            now = time.perf_counter()
            if now - self._fps_timer >= 1.0:
                self.render_fps = self._fps_counter / (now - self._fps_timer)
                self._fps_counter = 0
                self._fps_timer = now

            for event in pygame.event.get():
                if event.type == pygame.QUIT:
                    running = False
                elif event.type == pygame.KEYDOWN:
                    running = self._handle_key(event.key)

            snap = self.camera.get_snapshot() if self.camera_on else None
            hand = snap.hand if snap else None

            if snap:
                for ev in snap.hand.events:
                    self._log(ev.replace("_", " "))

            hand_x = hand.smooth_x if hand else 0.5
            hand_y = hand.smooth_y if hand else 0.5
            detected = hand.detected if hand else False
            fist = hand.fist if hand else False
            pinch = hand.pinch if hand else False
            swipe = hand.swipe if hand and hand.swipe_timer > 0 else None
            landmarks = hand.landmarks if hand else None
            frame = snap.frame if snap else None
            track_fps = snap.fps_track if snap else 0.0

            self.hologram.render(
                self.holo_surface, hand_x, hand_y, detected, fist, pinch, swipe, dt,
            )

            self.screen.fill(COLORS.VOID)
            self._draw_header(detected, track_fps)
            self.screen.blit(self.holo_surface, self.holo_rect.topleft)
            pygame.draw.rect(self.screen, COLORS.MUTED, self.holo_rect, 1)

            draw_webcam_panel(
                self.screen, frame if self.camera_on else None,
                landmarks, detected, self.cam_rect,
            )
            self._draw_footer()
            pygame.display.flip()

        self.camera.stop()
        pygame.quit()

    def _handle_key(self, key: int) -> bool:
        if key in (pygame.K_q, pygame.K_ESCAPE):
            return False
        if key == pygame.K_c:
            self.camera_on = not self.camera_on
            if self.camera_on:
                ok, msg = self.camera.start()
                self._log(msg)
            else:
                self.camera.stop()
                self._log("Camera suspended")
        elif key == pygame.K_s:
            form = "CYLINDER" if self.hologram.form == "SPHERE" else "SPHERE"
            self.hologram.set_form(form)
            self._log(f"Geometry: {form}")
        elif key == pygame.K_LEFTBRACKET:
            self.camera.set_smoothing(self.camera.config.smoothing - 0.05)
            self._log(f"Damping: {self.camera.config.smoothing:.2f}")
        elif key == pygame.K_RIGHTBRACKET:
            self.camera.set_smoothing(self.camera.config.smoothing + 0.05)
            self._log(f"Damping: {self.camera.config.smoothing:.2f}")
        return True

    def _draw_header(self, detected: bool, track_fps: float) -> None:
        pygame.draw.rect(self.screen, COLORS.PANEL, (0, 0, WIN_W, HEADER_H))
        pygame.draw.line(self.screen, COLORS.MUTED, (0, HEADER_H), (WIN_W, HEADER_H), 1)

        title = self.font_lg.render("CORE MOTION MATRIX", True, COLORS.CYAN)
        self.screen.blit(title, (20, 14))

        sub = self.font_sm.render("NATIVE // NO BROWSER // NO NODE.JS", True, COLORS.MUTED)
        self.screen.blit(sub, (260, 20))

        status = "SENSOR ACTIVE" if detected else "AWAITING HAND"
        color = COLORS.GREEN if detected else COLORS.MAGENTA
        badge = self.font.render(status, True, color)
        self.screen.blit(badge, (WIN_W - badge.get_width() - 20, 18))

        fps_text = self.font_sm.render(
            f"RENDER {self.render_fps:.0f} | TRACK {track_fps:.0f} FPS",
            True, COLORS.CYAN,
        )
        self.screen.blit(fps_text, (WIN_W - fps_text.get_width() - 20, 36))

    def _draw_footer(self) -> None:
        y = WIN_H - FOOTER_H
        pygame.draw.rect(self.screen, COLORS.PANEL, (0, y, WIN_W, FOOTER_H))
        pygame.draw.line(self.screen, COLORS.MUTED, (0, y), (WIN_W, y), 1)

        hints = self.font_sm.render(
            "[Q] Quit  [C] Camera  [S] Shape  [[ ]] Damping",
            True, COLORS.MUTED,
        )
        self.screen.blit(hints, (20, y + 12))

        form_btn = self.font.render(f"FORM: {self.hologram.form}", True, COLORS.YELLOW)
        self.screen.blit(form_btn, (20, y + 36))

        damp = self.font.render(
            f"DAMPING: {self.camera.config.smoothing:.2f}",
            True, COLORS.CYAN,
        )
        self.screen.blit(damp, (200, y + 36))

        log_x = 420
        for i, line in enumerate(self.logs[:5]):
            color = COLORS.GREEN if "ERROR" not in line else COLORS.MAGENTA
            txt = self.font_sm.render(f"» {line}", True, color)
            self.screen.blit(txt, (log_x, y + 10 + i * 18))


def main() -> None:
    parser = argparse.ArgumentParser(description="Cyberdeck Gesture Controller — native desktop")
    parser.add_argument("--terminal", action="store_true", help="Launch terminal HUD instead")
    args = parser.parse_args()

    if args.terminal:
        from terminal_cyberdeck_hud import main as terminal_main
        terminal_main()
        return

    if not OPENCV_AVAILABLE or not MEDIAPIPE_AVAILABLE:
        print("Missing dependencies. Install with:")
        print("  pip install -r requirements.txt")
        sys.exit(1)

    CyberdeckApp().run()


if __name__ == "__main__":
    main()
