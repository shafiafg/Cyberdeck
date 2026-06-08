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

# ── ModernGL Hardware Accelerated 3D Sub-Renderer ──────────────────────────
MODERNGL_AVAILABLE = False
try:
    import moderngl
    MODERNGL_AVAILABLE = True
except ImportError:
    pass

def create_mvp_matrix(width, height, rot_x, rot_y, rot_z, scale, disp_x, disp_y, offset=0.0):
    aspect = width / height
    fovy = 45.0
    f = 1.0 / math.tan(math.radians(fovy) / 2.0)
    proj = np.zeros((4, 4), dtype=np.float32)
    proj[0, 0] = f / aspect
    proj[1, 1] = f
    proj[2, 2] = (100.1 / -99.9)
    proj[2, 3] = -1.0
    proj[3, 2] = (2.0 * 100.0 * 0.1) / -99.9
    
    view = np.eye(4, dtype=np.float32)
    view[3, 2] = -3.5
    
    offset_x_3d = (disp_x / (width / 2.0)) * 1.7
    offset_y_3d_gl = -(disp_y / (height / 2.0)) * 1.7 / aspect
    
    s = np.eye(4, dtype=np.float32)
    s[0, 0] = scale
    s[1, 1] = scale
    s[2, 2] = scale
    
    rz = np.eye(4, dtype=np.float32)
    c, ss = math.cos(math.radians(rot_z)), math.sin(math.radians(rot_z))
    rz[0, 0] = c
    rz[0, 1] = ss
    rz[1, 0] = -ss
    rz[1, 1] = c
    
    rx = np.eye(4, dtype=np.float32)
    c, ss = math.cos(math.radians(rot_x)), math.sin(math.radians(rot_x))
    rx[1, 1] = c
    rx[1, 2] = ss
    rx[2, 1] = -ss
    rx[2, 2] = c
    
    ry = np.eye(4, dtype=np.float32)
    c, ss = math.cos(math.radians(rot_y)), math.sin(math.radians(rot_y))
    ry[0, 0] = c
    ry[0, 2] = -ss
    ry[2, 0] = ss
    ry[2, 2] = c
    
    t = np.eye(4, dtype=np.float32)
    t[3, 0] = offset_x_3d
    t[3, 1] = offset_y_3d_gl
    
    model = s @ rz @ rx @ ry @ t
    mvp = model @ view @ proj
    return mvp

def create_mvp_matrix_for_components(width, height, rot_x, rot_y, rot_z, scale, disp_x, disp_y, offset_rot=None):
    aspect = width / height
    fovy = 45.0
    f = 1.0 / math.tan(math.radians(fovy) / 2.0)
    proj = np.zeros((4, 4), dtype=np.float32)
    proj[0, 0] = f / aspect
    proj[1, 1] = f
    proj[2, 2] = (100.1 / -99.9)
    proj[2, 3] = -1.0
    proj[3, 2] = (2.0 * 100.0 * 0.1) / -99.9
    
    view = np.eye(4, dtype=np.float32)
    view[3, 2] = -3.5
    
    offset_x_3d = (disp_x / (width / 2.0)) * 1.7
    offset_y_3d_gl = -(disp_y / (height / 2.0)) * 1.7 / aspect
    
    s = np.eye(4, dtype=np.float32)
    s[0, 0] = scale
    s[1, 1] = scale
    s[2, 2] = scale
    
    rz = np.eye(4, dtype=np.float32)
    c, ss = math.cos(math.radians(rot_z)), math.sin(math.radians(rot_z))
    rz[0, 0] = c
    rz[0, 1] = ss
    rz[1, 0] = -ss
    rz[1, 1] = c
    
    rx = np.eye(4, dtype=np.float32)
    c, ss = math.cos(math.radians(rot_x)), math.sin(math.radians(rot_x))
    rx[1, 1] = c
    rx[1, 2] = ss
    rx[2, 1] = -ss
    rx[2, 2] = c
    
    ry = np.eye(4, dtype=np.float32)
    c, ss = math.cos(math.radians(rot_y)), math.sin(math.radians(rot_y))
    ry[0, 0] = c
    ry[0, 2] = -ss
    ry[2, 0] = ss
    ry[2, 2] = c
    
    model = s @ rz @ rx @ ry
    
    if offset_rot is not None:
        tr = np.eye(4, dtype=np.float32)
        tr[3, 0] = offset_rot.x
        tr[3, 1] = offset_rot.y
        tr[3, 2] = offset_rot.z
        model = model @ tr
        
    t = np.eye(4, dtype=np.float32)
    t[3, 0] = offset_x_3d
    t[3, 1] = offset_y_3d_gl
    
    model = model @ t
    mvp = model @ view @ proj
    return mvp

class ModernGLHologram:
    def __init__(self, width: int, height: int):
        self.width = width
        self.height = height
        self.ctx = None
        self.initialized = False
        self.current_form = ""
        
        if not MODERNGL_AVAILABLE:
            return
            
        try:
            # Standalone headless rendering context
            self.ctx = moderngl.create_context(standalone=True)
            self.ctx.enable(moderngl.BLEND)
            self.ctx.blend_func = (
                moderngl.SRC_ALPHA, moderngl.ONE,
                moderngl.ONE, moderngl.ONE
            )
            
            # Setup FBO targets
            self.color_tex = self.ctx.texture((self.width, self.height), 4)
            self.depth_rbo = self.ctx.depth_renderbuffer((self.width, self.height))
            self.fbo = self.ctx.framebuffer(self.color_tex, self.depth_rbo)
            
            # Glow/Bloom subpass targets
            self.pass_tex = self.ctx.texture((self.width, self.height), 4)
            self.pass_fbo = self.ctx.framebuffer(self.pass_tex, self.depth_rbo)
            
            # Shaders
            # Vector/Mesh Shader
            self.prog = self.ctx.program(
                vertex_shader="""
                    #version 330
                    in vec3 in_vert;
                    uniform mat4 mvp;
                    void main() {
                        gl_Position = mvp * vec4(in_vert, 1.0);
                    }
                """,
                fragment_shader="""
                    #version 330
                    out vec4 f_color;
                    uniform vec4 u_color;
                    void main() {
                        f_color = u_color;
                    }
                """
            )
            
            # Particle Point Shader
            self.part_prog = self.ctx.program(
                vertex_shader="""
                    #version 330
                    in vec3 in_vert;
                    in vec4 in_col;
                    uniform mat4 mvp;
                    out vec4 v_col;
                    void main() {
                        gl_Position = mvp * vec4(in_vert, 1.0);
                        v_col = in_col;
                    }
                """,
                fragment_shader="""
                    #version 330
                    in vec4 v_col;
                    out vec4 f_color;
                    void main() {
                        f_color = v_col;
                    }
                """
            )
            
            # Bloom / CRT Screen space warp post-processing shader
            self.quad_prog = self.ctx.program(
                vertex_shader="""
                    #version 330
                    in vec2 in_position;
                    in vec2 in_texcoord;
                    out vec2 v_texcoord;
                    void main() {
                        gl_Position = vec4(in_position, 0.0, 1.0);
                        v_texcoord = vec2(in_texcoord.x, 1.0 - in_texcoord.y);
                    }
                """,
                fragment_shader="""
                    #version 330
                    in vec2 v_texcoord;
                    out vec4 f_color;
                    uniform sampler2D Texture;
                    uniform float u_time;
                    uniform int u_fist;
                    uniform int u_is_dragging;
                    void main() {
                        vec2 uv = v_texcoord;
                        
                        #ifdef GL_ES
                        precision mediump float;
                        #endif
                        
                        // CRT warp curvature
                        vec2 dc = uv - vec2(0.5);
                        float r2 = dot(dc, dc);
                        uv = uv + dc * r2 * 0.04;
                        
                        if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
                            f_color = vec4(0.004, 0.002, 0.010, 1.0);
                            return;
                        }
                        
                        float shift = 0.0028 + float(u_fist) * 0.007 + float(u_is_dragging) * 0.0035;
                        vec4 col;
                        col.r = texture(Texture, uv + vec2(-shift, 0.0)).r;
                        col.g = texture(Texture, uv).g;
                        col.b = texture(Texture, uv + vec2(shift, 0.0)).b;
                        col.a = texture(Texture, uv).a;
                        
                        // Real-time scanlines
                        float scanline = sin(uv.y * 220.0 + u_time * 6.0) * 0.06;
                        col.rgb += scanline;
                        
                        // Screen flicker noise
                        float flicker = sin(u_time * 42.0) * 0.012;
                        col.rgb += flicker;
                        
                        // Glow expansion
                        col.rgb *= 1.25;
                        
                        f_color = col;
                    }
                """
            )
            
            # Screen quad coordinates
            quad_vertices = np.array([
                -1.0, -1.0, 0.0, 0.0,
                 1.0, -1.0, 1.0, 0.0,
                -1.0,  1.0, 0.0, 1.0,
                 1.0,  1.0, 1.0, 1.0,
            ], dtype='f4')
            self.quad_vbo = self.ctx.buffer(quad_vertices)
            self.quad_vao = self.ctx.vertex_array(
                self.quad_prog,
                [(self.quad_vbo, '2f 2f', 'in_position', 'in_texcoord')]
            )
            
            # Concentric Unit Circle Geometry
            circle_verts = []
            for i in range(73):
                theta = 2.0 * math.pi * i / 72.0
                circle_verts.append([math.cos(theta), 0.0, math.sin(theta)])
            circle_arr = np.array(circle_verts, dtype='f4')
            self.circle_vbo = self.ctx.buffer(circle_arr)
            self.circle_vao = self.ctx.vertex_array(
                self.prog,
                [(self.circle_vbo, '3f', 'in_vert')]
            )
            
            # Unit Grid Bed Geometry
            grid_verts = []
            divisions = 6
            size = 1.8
            step = size / divisions
            y_offset = -0.95
            for i in range(divisions + 1):
                x = -size/2 + i * step
                grid_verts.append([x, y_offset, -size/2])
                grid_verts.append([x, y_offset, size/2])
            for i in range(divisions + 1):
                z = -size/2 + i * step
                grid_verts.append([-size/2, y_offset, z])
                grid_verts.append([size/2, y_offset, z])
            grid_arr = np.array(grid_verts, dtype='f4')
            self.grid_vbo = self.ctx.buffer(grid_arr)
            self.grid_vao = self.ctx.vertex_array(
                self.prog,
                [(self.grid_vbo, '3f', 'in_vert')]
            )
            
            # Axis helper
            axis_verts = [
                0.0, 0.0, 0.0,   1.7, 0.0, 0.0,
                0.0, 0.0, 0.0,   0.0, 1.7, 0.0,
                0.0, 0.0, 0.0,   0.0, 0.0, 1.7
            ]
            axis_arr = np.array(axis_verts, dtype='f4')
            self.axis_vbo = self.ctx.buffer(axis_arr)
            self.axis_vao = self.ctx.vertex_array(
                self.prog,
                [(self.axis_vbo, '3f', 'in_vert')]
            )
            
            # Mesh buffers
            self.outer_vbo = None
            self.outer_ibo = None
            self.outer_vao = None
            self.inner_vbo = None
            self.inner_ibo = None
            self.inner_vao = None
            
            self.initialized = True
            
        except Exception as e:
            print(f"[ModernGL] standalone context failed or unsupported: {e}")
            self.initialized = False

    def update_mesh(self, outer_v, outer_e, inner_v, inner_e, form: str):
        if not self.initialized:
            return
        try:
            if self.outer_vbo: self.outer_vbo.release()
            if self.outer_ibo: self.outer_ibo.release()
            if self.inner_vbo: self.inner_vbo.release()
            if self.inner_ibo: self.inner_ibo.release()
            
            outer_arr = np.array([[v.x, v.y, v.z] for v in outer_v], dtype='f4')
            outer_ind = np.array(outer_e, dtype='i4').flatten()
            self.outer_vbo = self.ctx.buffer(outer_arr)
            self.outer_ibo = self.ctx.buffer(outer_ind)
            self.outer_vao = self.ctx.vertex_array(
                self.prog,
                [(self.outer_vbo, '3f', 'in_vert')],
                self.outer_ibo
            )
            
            inner_arr = np.array([[v.x, v.y, v.z] for v in inner_v], dtype='f4')
            inner_ind = np.array(inner_e, dtype='i4').flatten()
            self.inner_vbo = self.ctx.buffer(inner_arr)
            self.inner_ibo = self.ctx.buffer(inner_ind)
            self.inner_vao = self.ctx.vertex_array(
                self.prog,
                [(self.inner_vbo, '3f', 'in_vert')],
                self.inner_ibo
            )
            self.current_form = form
        except Exception as e:
            print(f"[ModernGL] Failed to update mesh buffers: {e}")

    def render(
        self, rot_x, rot_y, rot_z, scale, disp_x, disp_y, anim_time,
        particles, fist, pinch, is_dragging, explosion_wave
    ) -> pygame.Surface:
        if not self.initialized:
            return pygame.Surface((self.width, self.height))
        try:
            self.pass_fbo.use()
            self.ctx.clear(0.005, 0.002, 0.012, 1.0)
            
            grid_color = np.array([COLORS.GRID[0]/255.0 * 0.42, COLORS.GRID[1]/255.0 * 0.42, COLORS.GRID[2]/255.0 * 0.42, 0.4], dtype='f4')
            cyan_color = np.array([COLORS.CYAN[0]/255.0, COLORS.CYAN[1]/255.0, COLORS.CYAN[2]/255.0, 0.95], dtype='f4')
            deep_cyan_color = np.array([COLORS.DEEP_CYAN[0]/255.0, COLORS.DEEP_CYAN[1]/255.0, COLORS.DEEP_CYAN[2]/255.0, 0.65], dtype='f4')
            magenta_color = np.array([COLORS.MAGENTA[0]/255.0, COLORS.MAGENTA[1]/255.0, COLORS.MAGENTA[2]/255.0, 0.95], dtype='f4')
            yellow_color = np.array([COLORS.YELLOW[0]/255.0, COLORS.YELLOW[1]/255.0, COLORS.YELLOW[2]/255.0, 1.0], dtype='f4')
            green_color = np.array([COLORS.GREEN[0]/255.0, COLORS.GREEN[1]/255.0, COLORS.GREEN[2]/255.0, 0.95], dtype='f4')
            
            outer_base_color = cyan_color if pinch else magenta_color
            
            # Ground Grid
            mvp_grid = create_mvp_matrix(self.width, self.height, rot_x, rot_y, rot_z, 1.0, disp_x, disp_y)
            self.prog['mvp'].write(mvp_grid.tobytes())
            self.prog['u_color'].write(grid_color.tobytes())
            self.grid_vao.render(moderngl.LINES)
            
            # Tech rings
            mvp_ring1 = create_mvp_matrix_for_components(self.width, self.height, rot_x, -rot_y * 0.7, rot_z, 1.45 * scale, disp_x, disp_y)
            self.prog['mvp'].write(mvp_ring1.tobytes())
            self.prog['u_color'].write((magenta_color * 0.75).tobytes())
            self.circle_vao.render(moderngl.LINE_STRIP)
            
            mvp_ring2 = create_mvp_matrix_for_components(self.width, self.height, -rot_x, rot_y * 1.3, -rot_z * 0.5, 1.12 * scale, disp_x, disp_y)
            self.prog['mvp'].write(mvp_ring2.tobytes())
            self.prog['u_color'].write((cyan_color * 0.8).tobytes())
            self.circle_vao.render(moderngl.LINE_STRIP)
            
            ring3_col = green_color if is_dragging else (grid_color * 1.5)
            mvp_ring3 = create_mvp_matrix_for_components(self.width, self.height, 0.0, rot_y, 0.0, 1.75 * scale, disp_x, disp_y)
            self.prog['mvp'].write(mvp_ring3.tobytes())
            self.prog['u_color'].write(ring3_col.tobytes())
            self.circle_vao.render(moderngl.LINE_STRIP)
            
            # Core mesh
            mvp_outer = create_mvp_matrix(self.width, self.height, rot_x, rot_y, rot_z, scale, disp_x, disp_y)
            self.prog['mvp'].write(mvp_outer.tobytes())
            self.prog['u_color'].write(outer_base_color.tobytes())
            if self.outer_vao:
                self.outer_vao.render(moderngl.LINES)
                
            inner_rot_y = -rot_y * 1.5 - anim_time * 20.0
            mvp_inner = create_mvp_matrix(self.width, self.height, rot_x, inner_rot_y, -rot_z * 1.6, scale, disp_x, disp_y)
            self.prog['mvp'].write(mvp_inner.tobytes())
            self.prog['u_color'].write(deep_cyan_color.tobytes())
            if self.inner_vao:
                self.inner_vao.render(moderngl.LINES)
                
            # Satellite 1
            t1 = anim_time * 2.5
            sat1_local = Vec3(1.5 * scale * math.cos(t1), 0.0, 1.5 * scale * math.sin(t1))
            sat1_rot = sat1_local.rotate_y(rot_y).rotate_x(rot_x).rotate_z(rot_z)
            mvp_sat1 = create_mvp_matrix_for_components(self.width, self.height, 0.0, 0.0, 0.0, 0.07, disp_x, disp_y, offset_rot=sat1_rot)
            self.prog['mvp'].write(mvp_sat1.tobytes())
            self.prog['u_color'].write(yellow_color.tobytes())
            self.circle_vao.render(moderngl.LINE_STRIP)
            
            # Satellite 2
            t2 = -anim_time * 1.8
            sat2_local = Vec3(0.0, 1.25 * scale * math.cos(t2), 1.25 * scale * math.sin(t2))
            sat2_rot = sat2_local.rotate_y(rot_y).rotate_x(rot_x).rotate_z(rot_z)
            mvp_sat2 = create_mvp_matrix_for_components(self.width, self.height, 0.0, 0.0, 0.0, 0.06, disp_x, disp_y, offset_rot=sat2_rot)
            self.prog['mvp'].write(mvp_sat2.tobytes())
            self.prog['u_color'].write(cyan_color.tobytes())
            self.circle_vao.render(moderngl.LINE_STRIP)
            
            # Core coordinates axes
            self.prog['mvp'].write(mvp_outer.tobytes())
            self.prog['u_color'].write(magenta_color.tobytes())
            self.axis_vao.render(moderngl.LINES, vertices=2, first=0)
            self.prog['u_color'].write(green_color.tobytes())
            self.axis_vao.render(moderngl.LINES, vertices=2, first=2)
            self.prog['u_color'].write(cyan_color.tobytes())
            self.axis_vao.render(moderngl.LINES, vertices=2, first=4)
            
            # Float-point glowing dust particles
            p_verts = []
            p_colors = []
            for p in particles:
                p_verts.append([p.x, p.y, p.z])
                color_comb = p.color
                if explosion_wave > 0:
                    color_comb = COLORS.YELLOW if random.random() > 0.5 else COLORS.WHITE
                z_ratio = max(0.1, min(1.0, 1.0 - (p.z / 1.5)))
                if explosion_wave > 0:
                    z_ratio *= max(0.0, min(1.0, p.life / p.max_life))
                r, g, b = color_comb
                p_colors.append([r/255.0 * z_ratio, g/255.0 * z_ratio, b/255.0 * z_ratio, z_ratio])
                
            if p_verts:
                p_verts_arr = np.array(p_verts, dtype='f4')
                p_cols_arr = np.array(p_colors, dtype='f4')
                vbo_pos = self.ctx.buffer(p_verts_arr)
                vbo_col = self.ctx.buffer(p_cols_arr)
                part_vao = self.ctx.vertex_array(
                    self.part_prog,
                    [
                        (vbo_pos, '3f', 'in_vert'),
                        (vbo_col, '4f', 'in_col')
                    ]
                )
                self.part_prog['mvp'].write(mvp_outer.tobytes())
                self.ctx.point_size = 3.5
                part_vao.render(moderngl.POINTS)
                vbo_pos.release()
                vbo_col.release()
                part_vao.release()
            
            # POST-PROCESS CRT / BLOOM PASS
            self.fbo.use()
            self.ctx.clear(0.005, 0.002, 0.012, 1.0)
            self.pass_tex.use(0)
            
            self.quad_prog['Texture'].value = 0
            self.quad_prog['u_time'].value = anim_time
            self.quad_prog['u_fist'].value = 1 if fist else 0
            self.quad_prog['u_is_dragging'].value = 1 if is_dragging else 0
            
            self.quad_vao.render(moderngl.TRIANGLE_STRIP)
            
            raw_data = self.color_tex.read()
            return pygame.image.frombuffer(raw_data, (self.width, self.height), "RGBA")
            
        except Exception as e:
            print(f"[ModernGL] Render pass crashed: {e}")
            self.initialized = False
            return pygame.Surface((self.width, self.height))

# ── Layout ──────────────────────────────────────────────────────────────────
WIN_W, WIN_H = 1280, 800
HEADER_H = 56
FOOTER_H = 110
CAM_W = 420
TARGET_FPS = 60


class Particle:
    __slots__ = ("x", "y", "z", "ox", "oy", "oz", "vx", "vy", "vz", "life", "max_life", "color", "size")

    def __init__(self):
        self.reset()

    def reset(self):
        theta = random.uniform(0, 2 * math.pi)
        phi = math.acos(random.uniform(-1, 1))
        r = random.uniform(0.7, 1.4)
        self.ox = r * math.sin(phi) * math.cos(theta)
        self.oy = r * math.sin(phi) * math.sin(theta)
        self.oz = r * math.cos(phi)

        self.x = self.ox
        self.y = self.oy
        self.z = self.oz

        self.vx = math.sin(phi) * math.cos(theta)
        self.vy = math.sin(phi) * math.sin(theta)
        self.vz = math.cos(phi)

        self.life = random.uniform(0.5, 1.5)
        self.max_life = self.life
        self.color = random.choice([COLORS.CYAN, COLORS.MAGENTA, COLORS.MUTED])
        self.size = random.choice([1, 2])


class HologramRenderer:
    def __init__(self, width: int, height: int):
        self.width = width
        self.height = height
        self.form = "SPHERE"
        self.outer_v, self.outer_e, self.inner_v, self.inner_e = build_topology(self.form)
        self.rot_x = 0.0
        self.rot_y = 0.0
        self.rot_z = 0.0
        self.particles: List[Particle] = [Particle() for _ in range(240)]
        self.scan_y = 0.0
        self.swipe_flash = 0.0

        # Persistent translation coordinate for pinch/grasp drag-and-drop mechanics
        self.holo_x = 0.0
        self.holo_y = 0.0

        # Grab and Drag tracking state
        self.is_dragging = False
        self.drag_start_hand_x = 0.0
        self.drag_start_hand_y = 0.0
        self.drag_start_holo_x = 0.0
        self.drag_start_holo_y = 0.0

        self._was_fist = False
        self.explosion_wave = 0.0
        self.current_scale = 1.0
        self.idle_rotation = True
        self.anim_time = 0.0
        self.mgl = ModernGLHologram(width, height)
        if self.mgl.initialized:
            self.mgl.update_mesh(self.outer_v, self.outer_e, self.inner_v, self.inner_e, self.form)

    def set_form(self, form: str) -> None:
        self.form = form
        self.outer_v, self.outer_e, self.inner_v, self.inner_e = build_topology(form)
        if self.mgl.initialized:
            self.mgl.update_mesh(self.outer_v, self.outer_e, self.inner_v, self.inner_e, form)

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

    def _draw_3d_ring(
        self,
        surface: pygame.Surface,
        radius: float,
        rot_x: float,
        rot_y: float,
        rot_z: float,
        disp_x: float,
        disp_y: float,
        fov: float,
        color: tuple,
        width: int = 1,
        segmented: bool = False,
        num_points: int = 48,
    ):
        points = []
        for i in range(num_points):
            theta = 2.0 * math.pi * i / num_points
            p = Vec3(radius * math.cos(theta), 0.0, radius * math.sin(theta))
            p = p.rotate_y(rot_y).rotate_x(rot_x).rotate_z(rot_z)
            px, py, pz = p.project(self.width, self.height, fov=fov)
            points.append((px + int(disp_x), py + int(disp_y), pz))

        for i in range(num_points):
            if segmented and (i // 2) % 3 == 0:
                continue
            p1 = points[i]
            p2 = points[(i + 1) % num_points]

            if p1[2] < -2.95 or p2[2] < -2.95:
                continue

            avg_z = (p1[2] + p2[2]) / 2.0
            depth_ratio = max(0.2, min(1.0, 1.0 - (avg_z / (radius * 1.8 + 0.1))))
            seg_color = (
                int(color[0] * depth_ratio),
                int(color[1] * depth_ratio),
                int(color[2] * depth_ratio),
            )
            pygame.draw.line(surface, seg_color, (p1[0], p1[1]), (p2[0], p2[1]), width)

    def _draw_3d_grid_base(
        self,
        surface: pygame.Surface,
        size: float,
        y_offset: float,
        disp_x: float,
        disp_y: float,
        fov: float,
    ):
        divisions = 6
        step = size / divisions
        lines = []

        for i in range(divisions + 1):
            x = -size/2 + i * step
            lines.append((Vec3(x, y_offset, -size/2), Vec3(x, y_offset, size/2)))

        for i in range(divisions + 1):
            z = -size/2 + i * step
            lines.append((Vec3(-size/2, y_offset, z), Vec3(size/2, y_offset, z)))

        for p1, p2 in lines:
            p1_rot = p1.rotate_y(self.rot_y).rotate_x(self.rot_x).rotate_z(self.rot_z)
            p2_rot = p2.rotate_y(self.rot_y).rotate_x(self.rot_x).rotate_z(self.rot_z)

            px1, py1, pz1 = p1_rot.project(self.width, self.height, fov=fov)
            px2, py2, pz2 = p2_rot.project(self.width, self.height, fov=fov)

            px1 += int(disp_x)
            py1 += int(disp_y)
            px2 += int(disp_x)
            py2 += int(disp_y)

            avg_z = (pz1 + pz2) / 2.0
            depth_ratio = max(0.08, min(0.65, 0.65 - (avg_z / 3.0)))
            
            grid_color = (
                int(COLORS.GRID[0] * depth_ratio),
                int(COLORS.GRID[1] * depth_ratio),
                int(COLORS.GRID[2] * depth_ratio),
            )
            pygame.draw.line(surface, grid_color, (px1, py1), (px2, py2), 1)

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
        proximity: float = 1.0,
        point: bool = False,
    ) -> None:
        surface.fill(COLORS.VOID)
        cx, cy = self.width / 2, self.height / 2
        min_dim = min(self.width, self.height)
        fov = min_dim * 0.45

        # Steering Rotation vs Autonomous drift
        if hand_detected:
            # Multiplied by 540.0 degrees for dramatic hand-following orientation
            target_yaw = (hand_x - 0.5) * 540.0
            target_pitch = (hand_y - 0.5) * -540.0
            self.rot_y += (target_yaw - self.rot_y) * 0.12
            self.rot_x += (target_pitch - self.rot_x) * 0.12
            if self.idle_rotation:
                self.rot_z += dt * 36.0
        else:
            if self.idle_rotation:
                self.rot_y += dt * 25.0
                self.rot_x += dt * 10.0
                self.rot_z += dt * 16.0
            target_yaw, target_pitch = 0.0, 0.0

        if self.idle_rotation:
            self.anim_time += dt

        # Only update the hologram's screen coordinates if a 'pinch' gesture is active
        # allowing for precise placement instead of continuous tracking
        if hand_detected and pinch:
            self.holo_x = (hand_x - 0.5) * 2.0
            self.holo_y = (hand_y - 0.5) * 2.0
            self.is_dragging = True
        else:
            self.is_dragging = False

        # Translate holo coordinates (-1 to 1) directly to screen space center displacement
        # (holo_x/2) is back to (hand_x - 0.5), so disp_x is exactly: (hand_x - 0.5) * self.width.
        disp_x = (self.holo_x / 2.0) * self.width
        disp_y = (self.holo_y / 2.0) * self.height

        # Fist shockwave release
        if self._was_fist and not fist:
            self.explosion_wave = 1.0
            for p in self.particles:
                p.life = p.max_life
        self._was_fist = fist

        if self.explosion_wave > 0:
            self.explosion_wave = max(0.0, self.explosion_wave - dt * 2.0)

        # Scale interpolation (fist compress vs palm extend)
        scale_target = 0.30 if fist else 1.0
        self.current_scale += (scale_target - self.current_scale) * dt * 9.0

        # Update Particle Accretion / Shockwaves
        for p in self.particles:
            if fist:
                p.x += (0.0 - p.x) * dt * 6.5
                p.y += (0.0 - p.y) * dt * 6.5
                p.z += (0.0 - p.z) * dt * 6.5
                d = math.sqrt(p.x**2 + p.y**2 + p.z**2)
                if d < 0.12:
                    p.reset()
            elif self.explosion_wave > 0:
                expansion_speed = 3.6 * dt
                r_dist = math.sqrt(p.x**2 + p.y**2 + p.z**2) or 0.1
                p.x += (p.x / r_dist) * expansion_speed * 1.6 + p.vx * dt * 0.5
                p.y += (p.y / r_dist) * expansion_speed * 1.6 + p.vy * dt * 0.5
                p.z += (p.z / r_dist) * expansion_speed * 1.6 + p.vz * dt * 0.5
                p.life -= dt
                if p.life <= 0:
                    p.reset()
            else:
                ang_rad = dt * 0.52
                c_a, s_a = math.cos(ang_rad), math.sin(ang_rad)
                new_x = p.x * c_a - p.z * s_a
                new_z = p.x * s_a + p.z * c_a
                p.x = new_x
                p.z = new_z
                p.y += math.sin(self.anim_time * 2.2 + p.ox) * 0.005

                r_dist = math.sqrt(p.x**2 + p.y**2 + p.z**2) or 0.1
                factor = 1.05 / r_dist
                p.x += (p.x * (factor - 1.0)) * dt * 0.82
                p.y += (p.y * (factor - 1.0)) * dt * 0.82
                p.z += (p.z * (factor - 1.0)) * dt * 0.82

        if self.mgl.initialized:
            # ── ModernGL Hardware Shader Pipeline ──────────────────────────
            mgl_surface = self.mgl.render(
                rot_x=self.rot_x,
                rot_y=self.rot_y,
                rot_z=self.rot_z,
                scale=self.current_scale,
                disp_x=disp_x,
                disp_y=disp_y,
                anim_time=self.anim_time,
                particles=self.particles,
                fist=fist,
                pinch=pinch,
                is_dragging=self.is_dragging,
                explosion_wave=self.explosion_wave,
            )
            surface.blit(mgl_surface, (0, 0))
            
            # Dynamic green circle highlighting precision center during pinch dragging
            if self.is_dragging:
                holo_center_x = int(cx + disp_x)
                holo_center_y = int(cy + disp_y)
                pygame.draw.circle(surface, COLORS.GREEN, (holo_center_x, holo_center_y), 12, 1)
                pygame.draw.circle(surface, COLORS.GREEN, (holo_center_x, holo_center_y), 3)
        else:
            # ── Legacy 3D CPU Projected Software Pipeline ───────────────────
            # Draw compass matrix circle on the bottom deck
            pygame.draw.circle(surface, COLORS.GRID, (int(cx), int(cy)), int(min_dim * 0.36), 1)
            pygame.draw.line(surface, (18, 10, 36), (0, int(cy)), (self.width, int(cy)), 1)
            pygame.draw.line(surface, (18, 10, 36), (int(cx), 0), (int(cx), self.height), 1)

            # Draw rotating coordinate grid floor platform
            self._draw_3d_grid_base(surface, size=1.8, y_offset=-0.95, disp_x=disp_x, disp_y=disp_y, fov=fov)

            # Render Core Wireframe Geometry
            inner_rot_y = -self.rot_y * 1.5 - self.anim_time * 20.0
            inner_proj = self._project_mesh(
                self.inner_v, self.rot_x, inner_rot_y, -self.rot_z * 1.6,
                self.current_scale, disp_x, disp_y, fov,
            )
            outer_proj = self._project_mesh(
                self.outer_v, self.rot_x, self.rot_y, self.rot_z,
                self.current_scale, disp_x, disp_y, fov,
            )

            # Render floating projected particles
            for p in self.particles:
                p_rot = Vec3(p.x, p.y, p.z).rotate_y(self.rot_y).rotate_x(self.rot_x).rotate_z(self.rot_z)
                px, py, pz = p_rot.project(self.width, self.height, fov=fov)
                px += int(disp_x)
                py += int(disp_y)

                if pz > -2.95 and 0 <= px < self.width and 0 <= py < self.height:
                    z_ratio = max(0.1, min(1.0, 1.0 - (pz / 1.5)))
                    if self.explosion_wave > 0:
                        z_ratio *= max(0.0, min(1.0, p.life / p.max_life))
                    color_comb = p.color
                    if self.explosion_wave > 0:
                        color_comb = COLORS.YELLOW if random.random() > 0.5 else COLORS.WHITE
                    part_color = (
                        int(color_comb[0] * z_ratio),
                        int(color_comb[1] * z_ratio),
                        int(color_comb[2] * z_ratio),
                    )
                    pygame.draw.circle(surface, part_color, (px, py), p.size)

            # Draw core wireframes
            for i, j in self.inner_e:
                p1, p2 = inner_proj[i], inner_proj[j]
                avg_z = (p1[2] + p2[2]) / 2.0
                c_factor = max(0.2, min(1.0, 1.1 - (avg_z / 1.0)))
                color = (
                    int(COLORS.DEEP_CYAN[0] * c_factor),
                    int(COLORS.DEEP_CYAN[1] * c_factor),
                    int(COLORS.DEEP_CYAN[2] * c_factor)
                ) if avg_z > 0.1 else (
                    int(COLORS.CYAN[0] * c_factor),
                    int(COLORS.CYAN[1] * c_factor),
                    int(COLORS.CYAN[2] * c_factor)
                )
                pygame.draw.line(surface, color, (p1[0], p1[1]), (p2[0], p2[1]), 1)

            outer_color = COLORS.CYAN if pinch else COLORS.MAGENTA
            for i, j in self.outer_e:
                p1, p2 = outer_proj[i], outer_proj[j]
                avg_z = (p1[2] + p2[2]) / 2.0
                c_factor = max(0.1, min(1.0, 1.1 - (avg_z / 1.2)))
                edge_color = (
                    int(outer_color[0] * c_factor),
                    int(outer_color[1] * c_factor),
                    int(outer_color[2] * c_factor),
                )
                pygame.draw.line(surface, edge_color, (p1[0], p1[1]), (p2[0], p2[1]), 2 if pinch else 1)

            # Rotating tech concentric circular rings
            self._draw_3d_ring(
                surface, radius=1.45 * self.current_scale, rot_x=self.rot_x, rot_y=-self.rot_y * 0.7, rot_z=self.rot_z,
                disp_x=disp_x, disp_y=disp_y, fov=fov, color=COLORS.MAGENTA, width=1, segmented=True, num_points=60
            )
            self._draw_3d_ring(
                surface, radius=1.12 * self.current_scale, rot_x=-self.rot_x, rot_y=self.rot_y * 1.3, rot_z=-self.rot_z * 0.5,
                disp_x=disp_x, disp_y=disp_y, fov=fov, color=COLORS.CYAN, width=1, segmented=False, num_points=48
            )
            self._draw_3d_ring(
                surface, radius=1.75 * self.current_scale, rot_x=0.0, rot_y=self.rot_y, rot_z=0.0,
                disp_x=disp_x, disp_y=disp_y, fov=fov, color=COLORS.GREEN if self.is_dragging else COLORS.GRID, width=1, segmented=True, num_points=72
            )

            # Orbiting satellite systems
            t1 = self.anim_time * 2.5
            sat1_local = Vec3(1.5 * self.current_scale * math.cos(t1), 0.0, 1.5 * self.current_scale * math.sin(t1))
            sat1_rot = sat1_local.rotate_y(self.rot_y).rotate_x(self.rot_x).rotate_z(self.rot_z)
            px1, py1, pz1 = sat1_rot.project(self.width, self.height, fov=fov)
            px1 += int(disp_x)
            py1 += int(disp_y)
            if pz1 > -2.95:
                pygame.draw.circle(surface, COLORS.YELLOW, (px1, py1), 4)
                pygame.draw.circle(surface, COLORS.YELLOW, (px1, py1), 8, 1)

            t2 = -self.anim_time * 1.8
            sat2_local = Vec3(0.0, 1.25 * self.current_scale * math.cos(t2), 1.25 * self.current_scale * math.sin(t2))
            sat2_rot = sat2_local.rotate_y(self.rot_y).rotate_x(self.rot_x).rotate_z(self.rot_z)
            px2, py2, pz2 = sat2_rot.project(self.width, self.height, fov=fov)
            px2 += int(disp_x)
            py2 += int(disp_y)
            if pz2 > -2.95:
                pygame.draw.circle(surface, COLORS.CYAN, (px2, py2), 4)

            # Axis indicator labels in 3D projective space
            axes = [
                (Vec3(1.7 * self.current_scale, 0, 0), "E_X", COLORS.MAGENTA),
                (Vec3(0, 1.7 * self.current_scale, 0), "E_Y", COLORS.GREEN),
                (Vec3(0, 0, 1.7 * self.current_scale), "E_Z", COLORS.CYAN),
            ]
            font_sm = pygame.font.SysFont("consolas", 11)
            for v, label, color in axes:
                v_rot = v.rotate_y(self.rot_y).rotate_x(self.rot_x).rotate_z(self.rot_z)
                px, py, pz = v_rot.project(self.width, self.height, fov=fov)
                px += int(disp_x)
                py += int(disp_y)
                if pz > -2.95:
                    pygame.draw.circle(surface, color, (px, py), 2)
                    lbl_s = font_sm.render(label, True, color)
                    surface.blit(lbl_s, (px + 6, py - 6))

            # Dynamic green circle highlighting precision center during pinch dragging
            if self.is_dragging:
                holo_center_x = int(cx + disp_x)
                holo_center_y = int(cy + disp_y)
                pygame.draw.circle(surface, COLORS.GREEN, (holo_center_x, holo_center_y), 12, 1)
                pygame.draw.circle(surface, COLORS.GREEN, (holo_center_x, holo_center_y), 3)

        self.scan_y = (self.scan_y + dt * 110) % self.height
        scan_surf = pygame.Surface((self.width, 3), pygame.SRCALPHA)
        scan_surf.fill((0, 255, 255, 30))
        surface.blit(scan_surf, (0, int(self.scan_y)))

        if swipe:
            self.swipe_flash = 1.0
        self.swipe_flash = max(0.0, self.swipe_flash - dt * 2.2)
        if self.swipe_flash > 0:
            radius = int((1.0 - self.swipe_flash) * min_dim * 0.55)
            flash_alpha = int(self.swipe_flash * 255)
            flash_surf = pygame.Surface((self.width, self.height), pygame.SRCALPHA)
            pygame.draw.circle(flash_surf, (0, 255, 0, flash_alpha // 3), (int(cx + disp_x), int(cy + disp_y)), radius, 2)
            surface.blit(flash_surf, (0, 0))

        self._draw_corners(surface)
        self._draw_hud_text(surface, hand_detected, fist, pinch, swipe, target_pitch, target_yaw, proximity, point)

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
        pitch, yaw, proximity, point=False,
    ) -> None:
        font = pygame.font.SysFont("consolas", 14, bold=True)
        small = pygame.font.SysFont("consolas", 12)

        lines = [
            (font, f"MATRIX: {self.form}", COLORS.MAGENTA, (14, 12)),
            (small, f"YAW {int(yaw):+3d}° | PIT {int(pitch):+3d}° | ROLL {int(self.rot_z % 360):03d}°", COLORS.CYAN, (14, 32)),
            (small, f"HOLO POS: X {self.holo_x:+.2f} | Y {self.holo_y:+.2f}", COLORS.YELLOW if self.is_dragging else COLORS.MUTED, (14, 50)),
            (small, f"IDLE SPIN: {'ENABLED' if self.idle_rotation else 'PAUSED_LOCK'}", COLORS.GREEN if self.idle_rotation else COLORS.MUTED, (14, 68)),
        ]
        if detected:
            lines.append((small, f"INDEX-THUMB PROX: {proximity:.4f}", COLORS.GREEN if pinch else COLORS.CYAN, (14, 86)))

        if fist:
            status, sc = "FIST COMPRESS: ACOUSTIC CORES COMPRESSING", COLORS.MAGENTA
        elif point:
            status, sc = "INDEX POINT: TOGGLING AUTONOMOUS ROTATION", COLORS.YELLOW
        elif pinch:
            status, sc = "PINCH GRASP: STATIC MATRIX POSITION DRAGGING", COLORS.GREEN
        elif detected:
            status, sc = "PALM TRACK: KINETIC STEERING ORIENTATION", COLORS.CYAN
        else:
            status, sc = "SCANNING... POSITION RECENTERED", COLORS.MUTED
        lines.append((font, f"STATUS: {status}", sc, (14, self.height - 28)))
        if swipe:
            lines.append((small, f"VECTOR EVENT: {swipe}", COLORS.YELLOW, (14, self.height - 48)))

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
        self.clock = pygame.time.Clock()
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
        self._last_point_toggle = 0.0

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
                    if ev == "POINT_START":
                        now_sec = time.time()
                        if now_sec - self._last_point_toggle >= 5.0:
                            self.hologram.idle_rotation = not self.hologram.idle_rotation
                            self._last_point_toggle = now_sec
                            self._log(f"IDLE SPIN: {'ENABLED' if self.hologram.idle_rotation else 'PAUSED_LOCK'}")
                        else:
                            cooldown_left = 5.0 - (now_sec - self._last_point_toggle)
                            self._log(f"COOLDOWN ACTIVE: {cooldown_left:.1f}s REMAINING")

            hand_x = hand.smooth_x if hand else 0.5
            hand_y = hand.smooth_y if hand else 0.5
            detected = hand.detected if hand else False
            fist = hand.fist if hand else False
            pinch = hand.pinch if hand else False
            swipe = hand.swipe if hand and hand.swipe_timer > 0 else None
            landmarks = hand.landmarks if hand else None
            frame = snap.frame if snap else None
            track_fps = snap.fps_track if snap else 0.0
            point = hand.point if hand else False

            proximity_val = 1.0
            if detected and landmarks and len(landmarks) > 8:
                pt_thumb = landmarks[4]
                pt_index = landmarks[8]
                proximity_val = math.sqrt(
                    (pt_thumb["x"] - pt_index["x"]) ** 2 +
                    (pt_thumb["y"] - pt_index["y"]) ** 2 +
                    (pt_thumb["z"] - pt_index["z"]) ** 2
                )
                # Override pinch based on prox threshold
                pinch = proximity_val < 0.055

            self.hologram.render(
                self.holo_surface, hand_x, hand_y, detected, fist, pinch, swipe, dt, proximity_val, point,
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
