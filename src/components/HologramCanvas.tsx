/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect } from 'react';
import { GestureEvent } from '../types';

interface HologramCanvasProps {
  currentPinch: { x: number; y: number } | null;
  isFistActive: boolean;
  lastSwipe: { direction: 'SWIPE_LEFT' | 'SWIPE_RIGHT'; timestamp: number } | null;
}

interface Particle {
  x: number;
  y: number;
  z: number;
  ox: number; // original X in 3D
  oy: number; // original Y in 3D
  oz: number; // original Z in 3D
  color: string;
  size: number;
}

export default function HologramCanvas({ currentPinch, isFistActive, lastSwipe }: HologramCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  
  // Physics / Interaction parameters
  const targetRotationX = useRef(0);
  const targetRotationY = useRef(0);
  const currentRotationX = useRef(0);
  const currentRotationY = useRef(0);
  const rotationSpeed = useRef(0.005);
  const swipeRotationVelocityY = useRef(0); // Rotational speed impulse from swipes
  const centroidX = useRef(0.5);
  const centroidY = useRef(0.5);
  const targetCentroidX = useRef(0.5);
  const targetCentroidY = useRef(0.5);
  
  // Collapse controller for Fist gesture (lerping from 1.0 down to 0.0)
  const collapseFactor = useRef(1.0);
  const explosionPulse = useRef(0);

  // Swipe glow effect parameters
  const swipePosition = useRef(-1);
  const activeSwipe = useRef<'LEFT' | 'RIGHT' | null>(null);

  // Initialize and preserve a set of 3D spherical particles
  const particles = useRef<Particle[]>([]);

  useEffect(() => {
    // Generate particles
    const list: Particle[] = [];
    const count = 350;
    const colors = [
      'rgba(34, 211, 238, 0.85)', // cyan
      'rgba(168, 85, 247, 0.85)', // purple
      'rgba(236, 72, 153, 0.85)', // pink
      'rgba(139, 92, 246, 0.7)',  // violet
    ];

    for (let i = 0; i < count; i++) {
      // Uniform distribution on a 3D sphere
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos((Math.random() * 2) - 1);
      const r = 120 + Math.random() * 30; // sphere radius

      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.sin(phi) * Math.sin(theta);
      const z = r * Math.cos(phi);

      list.push({
        x, y, z,
        ox: x, oy: y, oz: z,
        color: colors[i % colors.length],
        size: Math.random() * 2 + 1,
      });
    }

    particles.current = list;
  }, []);

  // Update centroid and rotation based on PINCH coordinates
  useEffect(() => {
    if (currentPinch) {
      targetCentroidX.current = currentPinch.x;
      targetCentroidY.current = currentPinch.y;
      
      // Control rotation speeds based on pinch relative position
      targetRotationX.current = (currentPinch.y - 0.5) * Math.PI * 2;
      targetRotationY.current = (currentPinch.x - 0.5) * Math.PI * 2;
    } else {
      // Revert to stable floating rotation parameters
      targetCentroidX.current = 0.5;
      targetCentroidY.current = 0.5;
    }
  }, [currentPinch]);

  // Handle Swipe trigger triggering animations
  useEffect(() => {
    if (lastSwipe) {
      if (lastSwipe.direction === 'SWIPE_LEFT') {
        swipePosition.current = 1.1; // Animation flows from right side to left side
        activeSwipe.current = 'LEFT';
        swipeRotationVelocityY.current = -0.32; // Velocity impulse (spin counter-clockwise / left)
      } else {
        swipePosition.current = -0.1; // Animation flows from left to right
        activeSwipe.current = 'RIGHT';
        swipeRotationVelocityY.current = 0.32; // Velocity impulse (spin clockwise / right)
      }
    }
  }, [lastSwipe]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const handleResize = () => {
      canvas.width = canvas.parentElement?.clientWidth || 640;
      canvas.height = canvas.parentElement?.clientHeight || 400;
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    // MAIN CANVAS LOOP
    const render = () => {
      ctx.fillStyle = '#06030c';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw Retro Synthwave Grid Perspective Background
      drawGrid(ctx, canvas.width, canvas.height);

      // Damping/Interpolating hand centroid calculations (Physics smoothness)
      const easing = 0.1;
      centroidX.current += (targetCentroidX.current - centroidX.current) * easing;
      centroidY.current += (targetCentroidY.current - centroidY.current) * easing;

      // Handle FIST clenching factor interpolations
      if (isFistActive) {
        collapseFactor.current += (0.01 - collapseFactor.current) * 0.15; // fast tight collapse!
        explosionPulse.current = 1.0; // Ready the explosive visual frame
      } else {
        collapseFactor.current += (1.0 - collapseFactor.current) * 0.08; // smooth expand back
        
        // Dissipate the explosive shockwave animation pulse
        if (explosionPulse.current > 0) {
          explosionPulse.current -= 0.02;
        }
      }

      // Smooth decay swipe velocity impulse
      swipeRotationVelocityY.current *= 0.95;

      // Smooth rotate calculations
      if (currentPinch) {
        currentRotationX.current += (targetRotationX.current - currentRotationX.current) * easing;
        currentRotationY.current += (targetRotationY.current - currentRotationY.current) * easing + swipeRotationVelocityY.current;
      } else {
        // Floating idle spin parameters
        currentRotationX.current += rotationSpeed.current * 0.3;
        currentRotationY.current += rotationSpeed.current + swipeRotationVelocityY.current;
      }

      const centerX = canvas.width * centroidX.current;
      const centerY = canvas.height * centroidY.current;

      // Draw active coordinates laser indicator on PINCH action
      if (currentPinch) {
        drawLaserPointer(ctx, centerX, centerY, canvas.width, canvas.height);
      }

      // Draw particle cluster structure 3D projected onto 2D canvas
      ctx.save();
      ctx.translate(centerX, centerY);

      // Sine wave breathing scaling
      const timeSecStr = Date.now() / 1000;
      const breatheScale = (collapseFactor.current) * (1 + Math.sin(timeSecStr * 4.0) * 0.04);

      // Draw standard inner energy core glowing ring
      ctx.shadowColor = isFistActive ? '#ec4899' : '#06b6d4';
      ctx.shadowBlur = isFistActive ? 30 : 15;
      ctx.beginPath();
      ctx.arc(0, 0, 45 * breatheScale, 0, Math.PI * 2);
      ctx.fillStyle = isFistActive 
        ? 'rgba(236, 72, 153, 0.15)' 
        : 'rgba(34, 211, 238, 0.05)';
      ctx.lineWidth = 2;
      ctx.strokeStyle = isFistActive ? '#ec4899' : '#06b6d4';
      ctx.stroke();
      ctx.fill();

      // Render 3D Hologram point network
      particles.current.forEach((p) => {
        // 1. Rotate in 3D matrix space
        // Rot X
        const cosX = Math.cos(currentRotationX.current);
        const sinX = Math.sin(currentRotationX.current);
        let y1 = p.oy * cosX - p.oz * sinX;
        let z1 = p.oy * sinX + p.oz * cosX;

        // Rot Y
        const cosY = Math.cos(currentRotationY.current);
        const sinY = Math.sin(currentRotationY.current);
        let x2 = p.ox * cosY + z1 * sinY;
        let z2 = -p.ox * sinY + z1 * cosY;

        // 2. Adjust with collapse factors
        const finalX = x2 * breatheScale;
        const finalY = y1 * breatheScale;
        const finalZ = z2 * breatheScale;

        // Perspective projection calculation
        const perspective = 300 / (300 + finalZ);
        const px = finalX * perspective;
        const py = finalY * perspective;

        // Don't render clip out specs
        if (perspective < 0.2) return;

        ctx.fillStyle = p.color;
        // Increase visual particle sizing depending on projection camera layers
        const computedSize = Math.max(0.5, p.size * perspective * (isFistActive ? 0.4 : 1));
        
        ctx.beginPath();
        ctx.arc(px, py, computedSize, 0, Math.PI * 2);
        ctx.fill();

        // Beautiful connecting matrix lines for adjacent points
        if (Math.random() < 0.015 && !isFistActive) {
          ctx.strokeStyle = 'rgba(6, 182, 212, 0.12)';
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(px + (Math.random() * 40 - 20), py + (Math.random() * 40 - 20));
          ctx.stroke();
        }
      });

      // Render shockwave pulse ring on FIST release
      if (explosionPulse.current > 0) {
        ctx.shadowColor = '#f43f5e';
        ctx.shadowBlur = 40;
        ctx.strokeStyle = `rgba(244, 63, 94, ${explosionPulse.current})`;
        ctx.lineWidth = 4 * explosionPulse.current;
        ctx.beginPath();
        // Expanding ring outwards
        ctx.arc(0, 0, (1.0 - explosionPulse.current) * 320, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();

      // Render beautiful lateral sweep energy lines for SWIPE trigger
      if (activeSwipe.current !== null) {
        drawSwipeVisuals(ctx, canvas.width, canvas.height);
      }

      // Cinematic terminal warnings during clenching transitions
      if (isFistActive) {
        ctx.font = 'bold 12px "JetBrains Mono", monospace';
        ctx.fillStyle = '#ec4899';
        ctx.shadowBlur = 0;
        ctx.fillText('CRITICAL::MASS_ACCUMULATION_ACTIVE', 20, canvas.height - 25);
        ctx.fillStyle = 'rgba(236,72,153, 0.1)';
        ctx.fillRect(15, canvas.height - 40, 240, 22);
        ctx.strokeStyle = '#ec4899';
        ctx.lineWidth = 1;
        ctx.strokeRect(15, canvas.height - 40, 240, 22);
      }

      // Display HUD details
      drawHUDTelemetry(ctx, canvas.width, canvas.height);

      animationRef.current = requestAnimationFrame(render);
    };

    const drawGrid = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      ctx.save();
      ctx.lineWidth = 1;
      
      const horizonY = h * 0.45;
      const gridW = w * 1.8;
      const lineCount = 20;

      // Draw fading cyan/pink grid perspective
      const gradient = ctx.createLinearGradient(w / 2, horizonY, w / 2, h);
      gradient.addColorStop(0, 'rgba(147, 51, 234, 0.05)');
      gradient.addColorStop(0.5, 'rgba(6, 182, 212, 0.07)');
      gradient.addColorStop(1, 'rgba(236, 72, 153, 0.18)');
      ctx.strokeStyle = gradient;

      // Draw prospective diagonal lines starting from a single vanishing dot
      for (let i = 0; i <= lineCount; i++) {
        const xPos = (w / 2) - (gridW / 2) + (gridW * (i / lineCount));
        ctx.beginPath();
        ctx.moveTo(w / 2, horizonY);
        ctx.lineTo(xPos, h);
        ctx.stroke();
      }

      // Draw horizontal vanishing lines pacing down with perspective depth spacing
      let gridCount = 12;
      for (let i = 0; i < gridCount; i++) {
        const ratio = i / gridCount;
        // Exponential spacing for deep depth feeling
        const gridY = horizonY + (h - horizonY) * Math.pow(ratio, 2.5);
        ctx.beginPath();
        ctx.moveTo(0, gridY);
        ctx.lineTo(w, gridY);
        ctx.stroke();
      }
      ctx.restore();
    };

    const drawLaserPointer = (ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number) => {
      ctx.save();
      // Target Reticle Box
      ctx.shadowColor = '#06b6d4';
      ctx.shadowBlur = 10;
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.8)';
      ctx.lineWidth = 1.5;

      const size = 18;
      // Crosshair brackets
      ctx.strokeRect(cx - size / 2, cy - size / 2, size, size);

      ctx.beginPath();
      // Horizontal laser line
      ctx.moveTo(10, cy); ctx.lineTo(cx - size, cy);
      ctx.moveTo(cx + size, cy); ctx.lineTo(w - 10, cy);
      // Vertical laser line
      ctx.moveTo(cx, 10); ctx.lineTo(cx, cy - size);
      ctx.moveTo(cx, cy + size); ctx.lineTo(cx, h - 10);
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.15)';
      ctx.stroke();

      // Mini text coordinates tag
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#06b6d4';
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillText(`PINCH_NODE_LOCKED::[${(cx/w).toFixed(3)}, ${(cy/h).toFixed(3)}]`, cx + 15, cy - 10);
      ctx.restore();
    };

    const drawSwipeVisuals = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      ctx.save();
      // Shift coordinate position
      const transitionRate = 0.08;
      
      if (activeSwipe.current === 'LEFT') {
        swipePosition.current -= transitionRate;
        if (swipePosition.current < -0.2) {
          activeSwipe.current = null;
        }
      } else {
        swipePosition.current += transitionRate;
        if (swipePosition.current > 1.2) {
          activeSwipe.current = null;
        }
      }

      if (activeSwipe.current !== null) {
        const xPos = w * swipePosition.current;

        // Draw multiple layered neon energy spikes
        ctx.shadowColor = '#d946ef';
        ctx.shadowBlur = 25;
        ctx.fillStyle = 'rgba(217, 70, 239, 0.15)';
        ctx.fillRect(xPos - 25, 0, 50, h);

        ctx.strokeStyle = '#d946ef';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(xPos, 0);
        ctx.lineTo(xPos, h);
        ctx.stroke();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(xPos - 5, 0);
        ctx.lineTo(xPos - 5, h);
        ctx.moveTo(xPos + 5, 0);
        ctx.lineTo(xPos + 5, h);
        ctx.stroke();
      }
      ctx.restore();
    };

    const drawHUDTelemetry = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      ctx.save();
      ctx.fillStyle = 'rgba(168, 85, 247, 0.7)';
      ctx.font = '10px "JetBrains Mono", monospace';

      // Draw decorative screen bounds telemetry markings
      ctx.fillText('SYNAPTIC_GRID_PERSPECTIVE_MATRIX', 20, 30);
      ctx.fillText('HOLO_STATION_ROTATIVE', w - 180, 30);

      // Simple visual framing corners
      ctx.strokeStyle = 'rgba(168, 85, 247, 0.3)';
      ctx.lineWidth = 1;
      
      // Top Left Corner
      ctx.beginPath();
      ctx.moveTo(15, 45); ctx.lineTo(15, 15); ctx.lineTo(45, 15);
      ctx.stroke();

      // Top Right Corner
      ctx.beginPath();
      ctx.moveTo(w - 15, 45); ctx.lineTo(w - 15, 15); ctx.lineTo(w - 45, 15);
      ctx.stroke();

      // Bottom Left Corner
      ctx.beginPath();
      ctx.moveTo(15, h - 45); ctx.lineTo(15, h - 15); ctx.lineTo(45, h - 15);
      ctx.stroke();

      // Bottom Right Corner
      ctx.beginPath();
      ctx.moveTo(w - 15, h - 45); ctx.lineTo(w - 15, h - 15); ctx.lineTo(w - 45, h - 15);
      ctx.stroke();

      ctx.restore();
    };

    // Run animation frames
    render();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      window.removeEventListener('resize', handleResize);
    };
  }, [isFistActive]);

  return (
    <div className="w-full h-full relative" id="hologram-viewport">
      {/* Visual neon border */}
      <div className="absolute inset-0 border border-cyan-500/30 rounded-xl pointer-events-none shadow-[inset_0_0_15px_rgba(34,211,238,0.1)]" />
      <canvas 
        ref={canvasRef} 
        className="w-full h-full rounded-xl block bg-[#06030c] cursor-crosshair"
      />
    </div>
  );
}
