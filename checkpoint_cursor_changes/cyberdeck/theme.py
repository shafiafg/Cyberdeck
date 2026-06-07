"""Synthwave cyberdeck color palette."""

from dataclasses import dataclass


@dataclass(frozen=True)
class Colors:
    VOID: tuple = (2, 1, 8)
    PANEL: tuple = (10, 6, 24)
    ACTIVE: tuple = (21, 10, 46)
    MAGENTA: tuple = (255, 0, 127)
    CYAN: tuple = (0, 255, 255)
    GREEN: tuple = (57, 255, 20)
    YELLOW: tuple = (255, 255, 0)
    MUTED: tuple = (98, 87, 122)
    WHITE: tuple = (255, 255, 255)
    DEEP_MAGENTA: tuple = (176, 5, 96)
    DEEP_CYAN: tuple = (4, 32, 48)
    GRID: tuple = (22, 12, 40)


COLORS = Colors()
