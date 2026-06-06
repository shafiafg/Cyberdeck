/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect } from 'react';

interface HologramCanvasProps {
  currentPinch: { x: number; y: number } | null;
  isFistActive: boolean;
  lastSwipe: { direction: 'SWIPE_LEFT' | 'SWIPE_RIGHT'; timestamp: number } | null;
  currentLandmarks?: { x: number; y: number; z: number }[] | null;
  showHandSkeleton?: boolean;
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

// Procedural beautiful holographic finger skeleton generator for simulator fallback
function generateProceduralHand(cx: number, cy: number, isClenched: boolean): { x: number; y: number; z: number }[] {
  const pts: { x: number; y: number; z: number }[] = [];
  
  // Base wrist point (0)
  const wx = cx;
  const wy = cy + 0.16;
  pts.push({ x: wx, y: wy, z: 0 });
  
  // Finger angles mapping from thumb to pinky
  const angles = [-0.55, -0.22, 0.0, 0.22, 0.45];
  const ext = isClenched ? 0.045 : 0.11; // Open vs clenched finger length
  
  // Create 4 points for each of the 5 fingers
  for (let f = 0; f < 5; f++) {
    const angle = angles[f];
    const kDist = 0.07; // knuckle distance
    
    // Knuckle Base MCP (coordinates 1, 5, 9, 13, 17)
    const kx = cx + Math.sin(angle) * kDist * 0.75;
    const ky = cy + Math.cos(angle) * kDist * 0.4;
    pts.push({ x: kx, y: ky, z: 10 });
    
    let lastX = kx;
    let lastY = ky;
    const segmentLength = ext * (f === 0 ? 0.6 : f === 4 ? 0.7 : 0.85) / 3;
    
    for (let seg = 0; seg < 3; seg++) {
      // Clenched fingers curl inward slightly on the Y coordinate
      const curlOffset = isClenched ? (seg + 1) * 0.015 : -0.005;
      const combinedAngle = angle + (f === 0 ? -0.2 : 0);
      const nextX = lastX + Math.sin(combinedAngle) * segmentLength;
      const nextY = lastY - Math.cos(combinedAngle) * segmentLength + curlOffset;
      
      pts.push({ x: nextX, y: nextY, z: -10 * (seg + 1) });
      lastX = nextX;
      lastY = nextY;
    }
  }
  
  return pts;
}

export default function HologramCanvas({ 
  currentPinch, 
  isFistActive, 
  lastSwipe,
  currentLandmarks,
  showHandSkeleton = true
}: HologramCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  
  // Keep live track of state props in mutable refs to keep the frame loop detached from React re-renders, 
  // preventing context tearing, and matching 60FPS rendering logic.
  const currentPinchRef = useRef(currentPinch);
  const isFistActiveRef = useRef(isFistActive);
  const currentLandmarksRef = useRef(currentLandmarks);
  const showHandSkeletonRef = useRef(showHandSkeleton);
  
  useEffect(() => {
    currentPinchRef.current = currentPinch;
    isFistActiveRef.current = isFistActive;
    currentLandmarksRef.current = currentLandmarks;
    showHandSkeletonRef.current = showHandSkeleton;
  }, [currentPinch, isFistActive, currentLandmarks, showHandSkeleton]);

  // Physics / Interaction parameters
  const targetRotationX = useRef(0);
  const targetRotationY = useRef(0);
  const currentRotationX = useRef(0);
  const currentRotationY = useRef(0);
  const rotationVelocityX = useRef(0);
  const rotationVelocityY = useRef(0);
  const rotationSpeed = useRef(0.005);
  const swipeRotationVelocityY = useRef(0); // Rotational speed impulse from swipes
  const centroidX = useRef(0.5);
  const centroidY = useRef(0.5);
  const targetCentroidX = useRef(0.5);
  const targetCentroidY = useRef(0.5);
  
  // Collapse controller for Fist gesture (lerping from 1.0 down to a tight dense visual)
  const collapseFactor = useRef(1.0);
  const explosionPulse = useRef(0);

  // Swipe glow effect parameters
  const swipePosition = useRef(-1);
  const activeSwipe = useRef<'LEFT' | 'RIGHT' | null>(null);

  // Initialize and preserve 3D spherical particles
  const particles = useRef<Particle[]>([]);

  useEffect(() => {
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

  // Update centroid and rotation based on live coords
  useEffect(() => {
    const activeFist = isFistActiveRef.current;
    const activePinch = currentPinchRef.current;

    if (activeFist && activePinch) {
      targetCentroidX.current = activePinch.x;
      targetCentroidY.current = activePinch.y;
      
      // Control rotation speeds based on position
      targetRotationX.current = (activePinch.y - 0.5) * Math.PI * 2;
      targetRotationY.current = (activePinch.x - 0.5) * Math.PI * 2;
    } else if (activePinch) {
      targetCentroidX.current = activePinch.x;
      targetCentroidY.current = activePinch.y;
    } else {
      // Revert floating parameters back to centered
      targetCentroidX.current = 0.5;
      targetCentroidY.current = 0.5;
    }
  }, [currentPinch, isFistActive]);

  // Handle Swipe triggers
  useEffect(() => {
    if (lastSwipe) {
      if (lastSwipe.direction === 'SWIPE_LEFT') {
        swipePosition.current = 1.1; 
        activeSwipe.current = 'LEFT';
        swipeRotationVelocityY.current = -0.32; 
      } else {
        swipePosition.current = -0.1; 
        activeSwipe.current = 'RIGHT';
        swipeRotationVelocityY.current = 0.32; 
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

    // FPS Pacing tracker ref
    let lastFrameTime = performance.now();

    // MAIN HIGH PERF RENDER LOOP (DECOUPLED AND THROTTLED)
    const render = () => {
      animationRef.current = requestAnimationFrame(render);

      const now = performance.now();
      const elapsed = now - lastFrameTime;

      // Restrict rendering updates to a maximum of 60 frames per second to reduce high frame-rate noise
      if (elapsed < 16.0) return; 
      lastFrameTime = now - (elapsed % 16.67);

      const activeFist = isFistActiveRef.current;
      const activePinch = currentPinchRef.current;
      const activeLandmarks = currentLandmarksRef.current;

      // Draw standard dark canvas feed background
      ctx.fillStyle = '#06030c';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw Retro Synthwave Grid Perspective Background
      drawGrid(ctx, canvas.width, canvas.height);

      // Core ease damping / interpolations (smooth movement)
      const easing = 0.1;
      centroidX.current += (targetCentroidX.current - centroidX.current) * easing;
      centroidY.current += (targetCentroidY.current - centroidY.current) * easing;

      // Amplified dynamic sphere size scale check (Shrink on Fist clench, expand on release)
      if (activeFist) {
        collapseFactor.current += (0.18 - collapseFactor.current) * 0.16; // Shrinks to extremely tight dense visual core!
        explosionPulse.current = 1.0; // Prepare the release explosive visual frame
      } else {
        collapseFactor.current += (1.12 - collapseFactor.current) * 0.085; // Expands back smoothly to generous scale!
        
        // Dissipate the explosive shockwave pulse ring
        if (explosionPulse.current > 0) {
          explosionPulse.current -= 0.022;
        }
      }

      // Smooth swipe dampeners
      swipeRotationVelocityY.current *= 0.95;

      // Friction factor for organic inertia damping
      const friction = 0.965;

      // Smooth rotate calculations with velocity and friction damping
      if (activePinch && !activeFist) {
        // Human palm is active and driving rotation: drift torque depends on finger offset from center
        const dx = activePinch.x - 0.5;
        const dy = activePinch.y - 0.5;
        const forceFactor = 0.005;

        // Spin velocity accelerates gracefully
        rotationVelocityY.current += dx * forceFactor;
        rotationVelocityX.current += dy * forceFactor;

        // Apply friction damping to contain speed
        rotationVelocityY.current *= friction;
        rotationVelocityX.current *= friction;
      } else if (activeFist) {
        // Fist clenched functions as an active magnetic brake to lock the rotation
        rotationVelocityX.current *= 0.82;
        rotationVelocityY.current *= 0.82;
      } else {
        // Decay manual spin speeds down to standard baseline automatic background idle spin
        const targetIdleXVel = rotationSpeed.current * 0.3;
        const targetIdleYVel = rotationSpeed.current + swipeRotationVelocityY.current;

        rotationVelocityX.current += (targetIdleXVel - rotationVelocityX.current) * 0.035;
        rotationVelocityY.current += (targetIdleYVel - rotationVelocityY.current) * 0.035;
      }

      // Apply cumulative velocity vector to update sphere rotation angles
      currentRotationX.current += rotationVelocityX.current;
      currentRotationY.current += rotationVelocityY.current;

      const centerX = canvas.width * centroidX.current;
      const centerY = canvas.height * centroidY.current;

      // Draw active coordinates laser indicator on clenches
      if (activePinch) {
        drawLaserPointer(ctx, centerX, centerY, canvas.width, canvas.height, !!activeFist);
      }

      // Draw particle cluster structure projected globally
      ctx.save();
      ctx.translate(centerX, centerY);

      // Sine wave breathing scaling
      const timeSecStr = Date.now() / 1000;
      const breatheScale = (collapseFactor.current) * (1 + Math.sin(timeSecStr * 4.0) * 0.04);

      // Draw glowing background visual ring
      ctx.shadowColor = activeFist ? '#ec4899' : '#06b6d4';
      ctx.shadowBlur = activeFist ? 35 : 15;
      ctx.beginPath();
      ctx.arc(0, 0, 48 * breatheScale, 0, Math.PI * 2);
      ctx.fillStyle = activeFist 
        ? 'rgba(236, 72, 153, 0.18)' 
        : 'rgba(34, 211, 238, 0.06)';
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = activeFist ? '#ec4899' : '#06b6d4';
      ctx.stroke();
      ctx.fill();

      // Render 3D Hologram point network
      particles.current.forEach((p) => {
        // Evaluate rotation matrix coordinates
        const cosX = Math.cos(currentRotationX.current);
        const sinX = Math.sin(currentRotationX.current);
        let y1 = p.oy * cosX - p.oz * sinX;
        let z1 = p.oy * sinX + p.oz * cosX;

        const cosY = Math.cos(currentRotationY.current);
        const sinY = Math.sin(currentRotationY.current);
        let x2 = p.ox * cosY + z1 * sinY;
        let z2 = -p.ox * sinY + z1 * cosY;

        // Apply dynamic scale
        const finalX = x2 * breatheScale;
        const finalY = y1 * breatheScale;
        const finalZ = z2 * breatheScale;

        // Perspective 3D transformation
        const perspective = 300 / (300 + finalZ);
        const px = finalX * perspective;
        const py = finalY * perspective;

        if (perspective < 0.2) return;

        ctx.fillStyle = p.color;
        const computedSize = Math.max(0.5, p.size * perspective * (activeFist ? 0.35 : 1.0));
        
        ctx.beginPath();
        ctx.arc(px, py, computedSize, 0, Math.PI * 2);
        ctx.fill();

        // Aesthetic network connection vectors
        if (Math.random() < 0.015 && !activeFist) {
          ctx.strokeStyle = 'rgba(6, 182, 212, 0.12)';
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(px + (Math.random() * 40 - 20), py + (Math.random() * 40 - 20));
          ctx.stroke();
        }
      });

      // Release Shockwave Ring
      if (explosionPulse.current > 0) {
        ctx.shadowColor = '#f43f5e';
        ctx.shadowBlur = 40;
        ctx.strokeStyle = `rgba(244, 63, 94, ${explosionPulse.current})`;
        ctx.lineWidth = 4 * explosionPulse.current;
        ctx.beginPath();
        ctx.arc(0, 0, (1.0 - explosionPulse.current) * 320, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();

      // OVERLAY GORGEOUS HAND LANDMARK skeleton directly on top of the 3D canvas viewport
      if (activePinch && showHandSkeletonRef.current) {
        let joints: { x: number; y: number; z: number }[] = [];
        if (activeLandmarks && activeLandmarks.length === 21) {
          joints = activeLandmarks;
        } else {
          // Generate realistic procedural animated tracker skeleton when in simulator mode
          joints = generateProceduralHand(activePinch.x, activePinch.y, !!activeFist);
        }

        if (joints && joints.length === 21) {
          const paths = [
            [0, 1, 2, 3, 4],     // Thumb
            [5, 6, 7, 8],        // Index
            [9, 10, 11, 12],     // Middle
            [13, 14, 15, 16],    // Ring
            [17, 18, 19, 20],    // Pinky
            [0, 5, 9, 13, 17, 0] // Palm base connection loop
          ];

          ctx.save();
          ctx.shadowBlur = 10;
          ctx.shadowColor = activeFist ? '#ec4899' : '#06b6d4';
          ctx.strokeStyle = activeFist ? 'rgba(236, 72, 153, 0.65)' : 'rgba(34, 211, 238, 0.55)';
          ctx.lineWidth = 3.0;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';

          // Render connecting cyber-lines
          paths.forEach(path => {
            ctx.beginPath();
            for (let i = 0; i < path.length; i++) {
              const pt = joints[path[i]];
              if (pt) {
                const jx = pt.x * canvas.width;
                const jy = pt.y * canvas.height;
                if (i === 0) {
                  ctx.moveTo(jx, jy);
                } else {
                  ctx.lineTo(jx, jy);
                }
              }
            }
            ctx.stroke();
          });

          // Draw joint connector neon nodes
          ctx.shadowBlur = 0;
          for (let i = 0; i < joints.length; i++) {
            const pt = joints[i];
            if (pt) {
              const jx = pt.x * canvas.width;
              const jy = pt.y * canvas.height;
              const isFingerTip = [4, 8, 12, 16, 20].indexOf(i) !== -1;

              ctx.beginPath();
              const sizeRad = isFingerTip ? 4.5 : 2.5;
              ctx.arc(jx, jy, sizeRad, 0, 2 * Math.PI);
              ctx.fillStyle = isFingerTip ? '#ec4899' : '#22d3ee';
              ctx.fill();
              ctx.strokeStyle = '#ffffff';
              ctx.lineWidth = 1;
              ctx.stroke();
            }
          }
          ctx.restore();
        }
      }

      // Render Swipe visual transitions
      if (activeSwipe.current !== null) {
        drawSwipeVisuals(ctx, canvas.width, canvas.height);
      }

      // Cinematic terminal indicators
      if (activeFist) {
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
    };

    const drawGrid = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      ctx.save();
      ctx.lineWidth = 1;
      
      const horizonY = h * 0.45;
      const gridW = w * 1.8;
      const lineCount = 20;

      // Draw fading purple perspective grid
      const gradient = ctx.createLinearGradient(w / 2, horizonY, w / 2, h);
      gradient.addColorStop(0, 'rgba(147, 51, 234, 0.05)');
      gradient.addColorStop(0.5, 'rgba(6, 182, 212, 0.07)');
      gradient.addColorStop(1, 'rgba(236, 72, 153, 0.18)');
      ctx.strokeStyle = gradient;

      for (let i = 0; i <= lineCount; i++) {
        const xPos = (w / 2) - (gridW / 2) + (gridW * (i / lineCount));
        ctx.beginPath();
        ctx.moveTo(w / 2, horizonY);
        ctx.lineTo(xPos, h);
        ctx.stroke();
      }

      let gridCount = 12;
      for (let i = 0; i < gridCount; i++) {
        const ratio = i / gridCount;
        const gridY = horizonY + (h - horizonY) * Math.pow(ratio, 2.5);
        ctx.beginPath();
        ctx.moveTo(0, gridY);
        ctx.lineTo(w, gridY);
        ctx.stroke();
      }
      ctx.restore();
    };

    const drawLaserPointer = (ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number, clenching: boolean) => {
      ctx.save();
      ctx.shadowColor = clenching ? '#ec4899' : '#06b6d4';
      ctx.shadowBlur = 10;
      ctx.strokeStyle = clenching ? 'rgba(236, 72, 153, 0.7)' : 'rgba(6, 182, 212, 0.8)';
      ctx.lineWidth = 1.5;

      const size = 18;
      ctx.strokeRect(cx - size / 2, cy - size / 2, size, size);

      ctx.beginPath();
      ctx.moveTo(10, cy); ctx.lineTo(cx - size, cy);
      ctx.moveTo(cx + size, cy); ctx.lineTo(w - 10, cy);
      ctx.moveTo(cx, 10); ctx.lineTo(cx, cy - size);
      ctx.moveTo(cx, cy + size); ctx.lineTo(cx, h - 10);
      ctx.strokeStyle = clenching ? 'rgba(236, 72, 153, 0.15)' : 'rgba(6, 182, 212, 0.15)';
      ctx.stroke();

      ctx.shadowBlur = 0;
      ctx.fillStyle = clenching ? '#ec4899' : '#06b6d4';
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillText(
        clenching ? `FIST_COLLAPSE_DRAG::[${(cx/w).toFixed(3)}, ${(cy/h).toFixed(3)}]` : `TRACK_TARGET_LOCK::[${(cx/w).toFixed(3)}, ${(cy/h).toFixed(3)}]`, 
        cx + 15, 
        cy - 10
      );
      ctx.restore();
    };

    const drawSwipeVisuals = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      ctx.save();
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

      ctx.fillText('SYNAPTIC_GRID_PERSPECTIVE_MATRIX', 20, 30);
      ctx.fillText('HOLO_STATION_ROTATIVE', w - 180, 30);

      ctx.strokeStyle = 'rgba(168, 85, 247, 0.3)';
      ctx.lineWidth = 1;
      
      ctx.beginPath();
      ctx.moveTo(15, 45); ctx.lineTo(15, 15); ctx.lineTo(45, 15);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(w - 15, 45); ctx.lineTo(w - 15, 15); ctx.lineTo(w - 45, 15);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(15, h - 45); ctx.lineTo(15, h - 15); ctx.lineTo(45, h - 15);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(w - 15, h - 45); ctx.lineTo(w - 15, h - 15); ctx.lineTo(w - 45, h - 15);
      ctx.stroke();

      ctx.restore();
    };

    render();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      window.removeEventListener('resize', handleResize);
    };
  }, []); // Run continuous rendering frame rate on empty dependency to match game engines loop style

  return (
    <div className="w-full h-full relative" id="hologram-viewport">
      <div className="absolute inset-0 border border-cyan-500/30 rounded-xl pointer-events-none shadow-[inset_0_0_15px_rgba(34,211,238,0.1)]" />
      <canvas 
        ref={canvasRef} 
        className="w-full h-full rounded-xl block bg-[#06030c] cursor-crosshair"
      />
    </div>
  );
}
