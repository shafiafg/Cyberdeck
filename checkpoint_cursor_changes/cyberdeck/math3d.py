"""3D vector math and wireframe topology for hologram rendering."""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import List, Tuple


@dataclass
class Vec3:
    x: float = 0.0
    y: float = 0.0
    z: float = 0.0

    def rotate_y(self, angle_deg: float) -> Vec3:
        rad = math.radians(angle_deg)
        c, s = math.cos(rad), math.sin(rad)
        return Vec3(self.x * c - self.z * s, self.y, self.x * s + self.z * c)

    def rotate_x(self, angle_deg: float) -> Vec3:
        rad = math.radians(angle_deg)
        c, s = math.cos(rad), math.sin(rad)
        return Vec3(self.x, self.y * c - self.z * s, self.y * s + self.z * c)

    def rotate_z(self, angle_deg: float) -> Vec3:
        rad = math.radians(angle_deg)
        c, s = math.cos(rad), math.sin(rad)
        return Vec3(self.x * c - self.y * s, self.x * s + self.y * c, self.z)

    def scale(self, factor: float) -> Vec3:
        return Vec3(self.x * factor, self.y * factor, self.z * factor)

    def project(self, width: int, height: int, fov: float = 420.0, distance: float = 3.0) -> Tuple[int, int, float]:
        denom = max(0.1, distance + self.z)
        factor = fov / denom
        return (
            int(width / 2 + self.x * factor),
            int(height / 2 - self.y * factor),
            self.z,
        )


def make_sphere(radius: float, rings: int, points_per_ring: int) -> Tuple[List[Vec3], List[Tuple[int, int]]]:
    verts: List[Vec3] = []
    edges: List[Tuple[int, int]] = []

    for i in range(rings):
        lat = math.pi * (i + 1) / (rings + 1)
        sin_lat, cos_lat = math.sin(lat), math.cos(lat)
        for j in range(points_per_ring):
            lon = 2 * math.pi * j / points_per_ring
            verts.append(Vec3(
                radius * sin_lat * math.cos(lon),
                radius * cos_lat,
                radius * sin_lat * math.sin(lon),
            ))

    for i in range(rings):
        start = i * points_per_ring
        for j in range(points_per_ring):
            curr = start + j
            nxt = start + (j + 1) % points_per_ring
            edges.append((curr, nxt))
            if i < rings - 1:
                edges.append((curr, curr + points_per_ring))

    return verts, edges


def make_cylinder(radius: float, height: float, levels: int, points: int) -> Tuple[List[Vec3], List[Tuple[int, int]]]:
    verts: List[Vec3] = []
    edges: List[Tuple[int, int]] = []

    for i in range(levels):
        y = -height / 2 + (height * i / (levels - 1))
        for j in range(points):
            angle = 2 * math.pi * j / points
            verts.append(Vec3(radius * math.cos(angle), y, radius * math.sin(angle)))

    for i in range(levels):
        start = i * points
        for j in range(points):
            curr = start + j
            nxt = start + (j + 1) % points
            edges.append((curr, nxt))
            if i < levels - 1:
                edges.append((curr, curr + points))

    return verts, edges


def build_topology(form: str) -> Tuple[List[Vec3], List[Tuple[int, int]], List[Vec3], List[Tuple[int, int]]]:
    if form == "SPHERE":
        outer_v, outer_e = make_sphere(1.0, 12, 16)
        inner_v, inner_e = make_sphere(0.55, 7, 10)
    else:
        outer_v, outer_e = make_cylinder(0.8, 1.6, 8, 14)
        inner_v, inner_e = make_cylinder(0.45, 1.0, 5, 10)
    return outer_v, outer_e, inner_v, inner_e
