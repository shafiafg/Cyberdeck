/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type GestureEventType = 
  | 'VIBE_READY'
  | 'FIST_START'
  | 'FIST_END'
  | 'PINCH_START'
  | 'PINCH_MOVE'
  | 'PINCH_END'
  | 'SWIPE'
  | 'SWIPE_LEFT'
  | 'SWIPE_RIGHT';

export interface GestureEvent {
  event: GestureEventType;
  timestamp: number;
  id: string; // unique ID for terminal logging listing
  x?: number;
  y?: number;
  raw_distance?: number;
  direction?: 'SWIPE_LEFT' | 'SWIPE_RIGHT';
  intensity?: number;
  details?: string;
  source: 'socket' | 'browser' | 'simulator';
}

export interface EngineConfig {
  webcamId: number;
  runHeadless: boolean;
  mirrorVideo: boolean;
  frameWidth: number;
  frameHeight: number;
  targetFps: number;
  wsPort: number;
  fistThreshold: number;
  pinchThreshold: number;
  smoothingFactor: number;
}
