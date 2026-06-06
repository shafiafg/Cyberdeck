/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState, useEffect } from 'react';
import { Camera, CameraOff, Sparkles, HelpCircle, AlertTriangle, Play, Pause, Hand } from 'lucide-react';
import { GestureEvent } from '../types';

interface WebcamTrackerProps {
  onGestureDetected: (event: Omit<GestureEvent, 'id' | 'timestamp'>) => void;
  activeSource: 'socket' | 'browser' | 'simulator';
  setActiveSource: (source: 'socket' | 'browser' | 'simulator') => void;
  isFistActive: boolean;
}

export default function WebcamTracker({
  onGestureDetected,
  activeSource,
  setActiveSource,
  isFistActive
}: WebcamTrackerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [loadingMediaPipe, setLoadingMediaPipe] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Simulation pads coordinate helper states
  const [simulatorDown, setSimulatorDown] = useState(false);
  const [simX, setSimX] = useState(0.5);
  const [simY, setSimY] = useState(0.5);
  
  // Refs for tracking script imports
  const cameraHelperRef = useRef<any>(null);
  const mpHandsRef = useRef<any>(null);

  // Handle keyboard clench event simulation (Spacebar clenches fist)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        if (activeSource !== 'simulator') {
          setActiveSource('simulator');
        }
        onGestureDetected({
          event: 'FIST_START',
          details: 'Keyboard simulated fist clench via [Spacebar]',
          source: 'simulator'
        });
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        onGestureDetected({
          event: 'FIST_END',
          details: 'Keyboard clench release',
          source: 'simulator'
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [activeSource]);

  // Clean camera dependencies if active source changes
  useEffect(() => {
    if (activeSource !== 'browser' && cameraActive) {
      stopCamera();
    }
  }, [activeSource]);

  // Inject CDN scripts dynamically for MediaPipe Hand Tracking in browser
  const loadMediaPipeScripts = (): Promise<boolean> => {
    if ((window as any).Hands && (window as any).Camera) {
      return Promise.resolve(true);
    }

    setLoadingMediaPipe(true);
    return new Promise((resolve) => {
      const handsScript = document.createElement('script');
      handsScript.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js';
      handsScript.async = true;

      const cameraScript = document.createElement('script');
      cameraScript.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js';
      cameraScript.async = true;

      let scriptsLoaded = 0;
      const onScriptLoaded = () => {
        scriptsLoaded++;
        if (scriptsLoaded === 2) {
          setLoadingMediaPipe(false);
          resolve(true);
        }
      };

      handsScript.onload = onScriptLoaded;
      cameraScript.onload = onScriptLoaded;
      handsScript.onerror = () => {
        setLoadingMediaPipe(false);
        resolve(false);
      };
      cameraScript.onerror = () => {
        setLoadingMediaPipe(false);
        resolve(false);
      };

      document.head.appendChild(handsScript);
      document.head.appendChild(cameraScript);
    });
  };

  const startCamera = async () => {
    setErrorMsg(null);
    setActiveSource('browser');

    const loaded = await loadMediaPipeScripts();
    if (!loaded) {
      setErrorMsg('Could not fetch MediaPipe library from jsDelivr CDN. Accessing manual simulator.');
      setActiveSource('simulator');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' }
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setCameraActive(true);
        setupMediaPipeTracker();
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Webcam access was denied or is not connected. Enter Simulation Mode below.');
      setActiveSource('simulator');
    }
  };

  const stopCamera = () => {
    if (cameraHelperRef.current) {
      cameraHelperRef.current.stop();
      cameraHelperRef.current = null;
    }
    
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }

    setCameraActive(false);
  };

  const setupMediaPipeTracker = () => {
    const mp = window as any;
    if (!mp.Hands || !mp.Camera || !videoRef.current) return;

    const hands = new mp.Hands({
      locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });

    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 0, // Lower complexity model (0) for significantly higher frame-rates
      minDetectionConfidence: 0.65,
      minTrackingConfidence: 0.65
    });

    let localFistActive = false;
    let localPinchActive = false;

    // Local state calculation for Fist and Pinch inside browser webcam frame rates
    hands.onResults((results: any) => {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          if (videoRef.current && videoRef.current.videoWidth) {
            if (canvas.width !== videoRef.current.videoWidth || canvas.height !== videoRef.current.videoHeight) {
              canvas.width = videoRef.current.videoWidth;
              canvas.height = videoRef.current.videoHeight;
            }
          }

          if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            const landmarks = results.multiHandLandmarks[0];
            const w = canvas.width;
            const h = canvas.height;

            const paths = [
              [0, 1, 2, 3, 4],     // Thumb
              [5, 6, 7, 8],        // Index
              [9, 10, 11, 12],     // Middle
              [13, 14, 15, 16],    // Ring
              [17, 18, 19, 20],    // Pinky
              [0, 5, 9, 13, 17, 0] // Palm / base outline
            ];

            // Render joint skeleton lines
            ctx.shadowColor = '#06b6d4';
            ctx.shadowBlur = 4;
            ctx.strokeStyle = 'rgba(6, 182, 212, 0.85)'; // Neon Cyan 
            ctx.lineWidth = 3.5;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            paths.forEach(path => {
              ctx.beginPath();
              for (let i = 0; i < path.length; i++) {
                const pt = landmarks[path[i]];
                if (i === 0) {
                  ctx.moveTo(pt.x * w, pt.y * h);
                } else {
                  ctx.lineTo(pt.x * w, pt.y * h);
                }
              }
              ctx.stroke();
            });

            // Clean-up shadow and draw joint connectors
            ctx.shadowBlur = 0;
            for (let i = 0; i < landmarks.length; i++) {
              const pt = landmarks[i];
              ctx.beginPath();
              ctx.arc(pt.x * w, pt.y * h, 4.5, 0, 2 * Math.PI);
              
              const isFingerTip = [4, 8, 12, 16, 20].indexOf(i) !== -1;
              ctx.fillStyle = isFingerTip ? '#ec4899' : '#a855f7'; // Neon pink for fingertips, purple for joints
              ctx.fill();
              ctx.strokeStyle = '#ffffff';
              ctx.lineWidth = 1.2;
              ctx.stroke();
            }
          }
        }
      }

      if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const landmarks = results.multiHandLandmarks[0];
        
        // Critical landmarks for Fist/Pinch tests
        const wrist = landmarks[0];
        const thumb_tip = landmarks[4];
        const index_tip = landmarks[8];
        const middle_tip = landmarks[12];
        const ring_tip = landmarks[16];
        const pinky_tip = landmarks[20];

        // 1. Check Fist Clench
        const calculateDist = (p1: any, p2: any) => {
          return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2) + Math.pow(p1.z - p2.z, 2));
        };

        const scale = calculateDist(wrist, landmarks[9]) || 0.1;
        const distances = [
          calculateDist(index_tip, wrist) / scale,
          calculateDist(middle_tip, wrist) / scale,
          calculateDist(ring_tip, wrist) / scale,
          calculateDist(pinky_tip, wrist) / scale
        ];
        const avgDist = distances.reduce((a, b) => a + b, 0) / distances.length;

        const fst = landmarks[9]; // Middle finger MCP is an ultra-stable palm center coordinate
        const fx = 1.0 - fst.x; // scale-x flipped
        const fy = fst.y;

        const mappedLandmarks = landmarks.map((l: any) => ({
          x: 1.0 - l.x,
          y: l.y,
          z: l.z || 0
        }));

        // Trigger events upstream
        if (avgDist < 0.22) {
          if (localPinchActive) {
            localPinchActive = false;
            onGestureDetected({
              event: 'PINCH_END',
              source: 'browser'
            });
          }
          if (!localFistActive) {
            localFistActive = true;
            onGestureDetected({
              event: 'FIST_START',
              x: Math.max(0.0, Math.min(1.0, fx)),
              y: Math.max(0.0, Math.min(1.0, fy)),
              details: `Browser tracking clench! Avg ratio: ${avgDist.toFixed(3)}`,
              source: 'browser',
              landmarks: mappedLandmarks
            });
          } else {
            // Stream continuous drag movement coordinates while fist is clenched
            onGestureDetected({
              event: 'FIST_MOVE',
              x: Math.max(0.0, Math.min(1.0, fx)),
              y: Math.max(0.0, Math.min(1.0, fy)),
              source: 'browser',
              landmarks: mappedLandmarks
            });
          }
        } else {
          if (localFistActive) {
            localFistActive = false;
            onGestureDetected({
              event: 'FIST_END',
              details: `Browser tracking released fist.`,
              source: 'browser'
            });
          }

          // 2. Track loose palm (when not clenched as fist)
          const cx = Math.max(0.0, Math.min(1.0, fx));
          const cy = Math.max(0.0, Math.min(1.0, fy));
          const status = localPinchActive ? 'PINCH_MOVE' : 'PINCH_START';
          localPinchActive = true;

          onGestureDetected({
            event: status,
            x: cx,
            y: cy,
            source: 'browser',
            landmarks: mappedLandmarks
          });
        }
      } else {
        // Handle case when no hands are visible in the camera feed: cleanly reset states
        if (localFistActive) {
          localFistActive = false;
          onGestureDetected({
            event: 'FIST_END',
            source: 'browser'
          });
        }
        if (localPinchActive) {
          localPinchActive = false;
          onGestureDetected({
            event: 'PINCH_END',
            source: 'browser'
          });
        }
      }
    });

    const camera = new mp.Camera(videoRef.current, {
      onFrame: async () => {
        if (videoRef.current) {
          await hands.send({ image: videoRef.current });
        }
      },
      width: 640,
      height: 480
    });

    camera.start();
    cameraHelperRef.current = camera;
  };

  // MANUAL SIMULATOR ACTIONS
  const handleSimMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const parent = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(1.0, (e.clientX - parent.left) / parent.width));
    const y = Math.max(0, Math.min(1.0, (e.clientY - parent.top) / parent.height));
    
    setSimulatorDown(true);
    setSimX(x);
    setSimY(y);
    setActiveSource('simulator');

    onGestureDetected({
      event: isFistActive ? 'FIST_START' : 'PINCH_START',
      x, y,
      source: 'simulator'
    });
  };

  const handleSimMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!simulatorDown) return;
    
    const parent = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(1.0, (e.clientX - parent.left) / parent.width));
    const y = Math.max(0, Math.min(1.0, (e.clientY - parent.top) / parent.height));
    
    setSimX(x);
    setSimY(y);

    onGestureDetected({
      event: isFistActive ? 'FIST_MOVE' : 'PINCH_MOVE',
      x, y,
      source: 'simulator'
    });
  };

  const handleSimMouseUpOrLeave = () => {
    if (simulatorDown) {
      setSimulatorDown(false);
      onGestureDetected({
        event: isFistActive ? 'FIST_END' : 'PINCH_END',
        source: 'simulator'
      });
    }
  };

  const triggerManualSwipe = (direction: 'SWIPE_LEFT' | 'SWIPE_RIGHT') => {
    setActiveSource('simulator');
    onGestureDetected({
      event: 'SWIPE',
      direction,
      intensity: 2.5,
      source: 'simulator'
    });
  };

  const triggerManualFistToggle = () => {
    setActiveSource('simulator');
    if (isFistActive) {
      onGestureDetected({
        event: 'FIST_END',
        details: 'Simulated fist released',
        source: 'simulator'
      });
    } else {
      onGestureDetected({
        event: 'FIST_START',
        details: 'Simulated fist clench activated',
        source: 'simulator'
      });
    }
  };

  return (
    <div className="bg-[#0b071a]/95 border border-purple-500/30 rounded-xl overflow-hidden shadow-[0_0_20px_rgba(168,85,247,0.15)] flex flex-col p-4 space-y-4" id="controller-deck">
      {/* Selector Heading buttons */}
      <div className="flex items-center justify-between border-b border-purple-500/20 pb-2.5">
        <h2 className="text-xs font-mono font-bold text-white flex items-center gap-1.5 uppercase">
          <Hand className="w-4 h-4 text-cyan-400" />
          ACTIVE INPUT MANIFOLD
        </h2>
        <div className="flex gap-1">
          <button
            onClick={() => setActiveSource('socket')}
            className={`px-2 py-1 text-[9px] font-mono border rounded uppercase font-bold transition-colors ${activeSource === 'socket' ? 'bg-purple-950 border-purple-500 text-cyan-400' : 'bg-transparent border-purple-950 text-purple-400/80 hover:text-white'}`}
          >
            LOCAL_PYTHON
          </button>
          <button
            onClick={() => setActiveSource('simulator')}
            className={`px-2 py-1 text-[9px] font-mono border rounded uppercase font-bold transition-colors ${activeSource === 'simulator' ? 'bg-purple-950 border-purple-500 text-cyan-400' : 'bg-transparent border-purple-950 text-purple-400/80 hover:text-white'}`}
          >
            SIMULATOR
          </button>
        </div>
      </div>

      {/* Webcam Module */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono text-purple-300 uppercase">WEBCAM_BROWSER_TRACKING:</span>
          {cameraActive ? (
            <button
              onClick={stopCamera}
              className="px-2.5 py-1 text-[10px] font-mono border border-rose-500/50 bg-rose-950/20 text-rose-400 hover:bg-rose-950/40 rounded flex items-center gap-1 transition-all"
            >
              <CameraOff className="w-3 h-3" />
              SHUTDOWN_CAM
            </button>
          ) : (
            <button
              onClick={startCamera}
              disabled={loadingMediaPipe}
              className="px-2.5 py-1 text-[10px] font-mono border border-cyan-500/50 bg-cyan-950/20 text-cyan-300 hover:bg-cyan-900/30 rounded flex items-center gap-1 transition-all disabled:opacity-50"
            >
              <Camera className="w-3 h-3" />
              {loadingMediaPipe ? 'LOADING_CDN...' : 'ACTIVATE_CAM'}
            </button>
          )}
        </div>

        {/* Video feed container or status */}
        <div className="relative h-[150px] bg-black/60 border border-purple-950 rounded-lg flex items-center justify-center overflow-hidden font-mono">
          <video 
            ref={videoRef} 
            className={`w-full h-full object-cover scale-x-[-1] ${cameraActive ? 'block' : 'hidden'}`} 
            playsInline 
            muted
          />
          <canvas
            ref={canvasRef}
            className={`absolute inset-0 w-full h-full object-cover scale-x-[-1] pointer-events-none ${cameraActive ? 'block' : 'hidden'}`}
          />
          {cameraActive ? (
            <div className="absolute top-2 left-2 bg-black/70 border border-cyan-500/30 px-1.5 py-0.5 rounded text-[8px] font-mono text-cyan-400 select-none animate-pulse">
              • BROWSER_SENSING_LIVE
            </div>
          ) : (
            <div className="text-center p-4 flex flex-col items-center">
              <CameraOff className="w-7 h-7 text-purple-600/50 mb-1" />
              <span className="text-[10px] font-mono text-purple-400/70 uppercase">Camera inactive</span>
              <p className="text-[9px] text-purple-500/50 mt-1 max-w-[200px]">
                Toggle browser tracking to analyze gestures directly via your web camera (MediaPipe CDN).
              </p>
            </div>
          )}
        </div>
        {errorMsg && (
          <div className="p-2 bg-amber-950/25 border border-amber-500/30 rounded text-[9px] font-mono text-amber-400 flex items-start gap-1.5 leading-snug">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

      {/* Manual Simulation Module */}
      <div className="space-y-3 pt-2.5 border-t border-purple-500/20">
        <span className="text-[10px] font-mono text-purple-300 uppercase block">SIMULATOR_PANEL:</span>
        
        {/* Interaction trigger buttons */}
        <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
          <button
            onClick={triggerManualFistToggle}
            className={`py-2 px-3 border rounded text-center transition-all ${isFistActive ? 'border-rose-500 bg-rose-950/40 text-rose-300 shadow-[0_0_10px_rgba(244,63,94,0.15)] font-bold' : 'border-purple-500/20 text-purple-400 bg-purple-950/10 hover:text-white'}`}
          >
            {isFistActive ? 'RELEASE_FIST_CLENCH' : 'SIMULATE_FIST_CLENCH'}
          </button>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={() => triggerManualSwipe('SWIPE_LEFT')}
              className="py-2 border border-purple-500/20 rounded bg-purple-950/10 hover:text-white text-center hover:bg-purple-900/10"
            >
              SWIPE_L
            </button>
            <button
              onClick={() => triggerManualSwipe('SWIPE_RIGHT')}
              className="py-2 border border-purple-500/20 rounded bg-purple-950/10 hover:text-white text-center hover:bg-purple-900/10"
            >
              SWIPE_R
            </button>
          </div>
        </div>

        {/* 2D Grid Coordinate Simulator Pad */}
        <div className="relative">
          <div 
            className="h-[120px] bg-black/40 border border-purple-500/20 rounded-lg relative cursor-crosshair overflow-hidden group select-none"
            onMouseDown={handleSimMouseDown}
            onMouseMove={handleSimMouseMove}
            onMouseUp={handleSimMouseUpOrLeave}
            onMouseLeave={handleSimMouseUpOrLeave}
          >
            {/* Visual targeting grid overlay */}
            <div className="absolute inset-0 grid grid-cols-8 grid-rows-6 opacity-10 pointer-events-none">
              {Array.from({ length: 48 }).map((_, i) => (
                <div key={i} className="border-[0.5px] border-purple-500" />
              ))}
            </div>

            {/* Helper center markings */}
            <div className="absolute top-1/2 left-0 w-full h-[0.5px] border-t border-purple-500/10 pointer-events-none" />
            <div className="absolute left-1/2 top-0 w-[0.5px] h-full border-l border-purple-500/10 pointer-events-none" />

            {/* Sim point pinches */}
            {simulatorDown && (
              <div 
                className="absolute w-4 h-4 -ml-2 -mt-2 rounded-full border border-cyan-400 bg-cyan-950/60 pointer-events-none flex items-center justify-center animate-ping"
                style={{ left: `${simX * 100}%`, top: `${simY * 100}%` }}
              />
            )}
            
            <div 
              className="absolute w-2.5 h-2.5 -ml-1.25 -mt-1.25 rounded-full border-2 border-cyan-400 bg-white pointer-events-none"
              style={{ left: `${simX * 100}%`, top: `${simY * 100}%` }}
            />

            {/* Guide label text */}
            <span className="absolute bottom-2 right-2 text-[8px] text-purple-500/40 font-mono pointer-events-none select-none uppercase">
              Drag mouse to simulate PINCH [x:{simX.toFixed(2)}, y:{simY.toFixed(2)}]
            </span>
          </div>
          
          <div className="flex justify-between text-[9px] text-purple-400/60 font-mono mt-1 px-1 select-none">
            <span>[Hotkey: Spacebar clenches Fist]</span>
            <span>2D PINCH SIM_PAD</span>
          </div>
        </div>
      </div>
    </div>
  );
}
