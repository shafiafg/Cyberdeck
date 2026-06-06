/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import CyberdeckHeader from './components/CyberdeckHeader';
import HologramCanvas from './components/HologramCanvas';
import TerminalLog from './components/TerminalLog';
import PythonScriptViewer from './components/PythonScriptViewer';
import WebcamTracker from './components/WebcamTracker';
import InstructionModal from './components/InstructionModal';
import { GestureEvent, GestureEventType } from './types';
import { pythonScriptContent } from './pythonCode';

export default function App() {
  const [logs, setLogs] = useState<GestureEvent[]>([]);
  const [logsPaused, setLogsPaused] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('connecting');
  const [activeSource, setActiveSource] = useState<'socket' | 'browser' | 'simulator'>('simulator');
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  
  // Hand tracking coordinate states
  const [currentPinch, setCurrentPinch] = useState<{ x: number; y: number } | null>(null);
  const [isFistActive, setIsFistActive] = useState(false);
  const [lastSwipe, setLastSwipe] = useState<{ direction: 'SWIPE_LEFT' | 'SWIPE_RIGHT'; timestamp: number } | null>(null);
  const [currentLandmarks, setCurrentLandmarks] = useState<{ x: number; y: number; z: number }[] | null>(null);
  const [showHandSkeleton, setShowHandSkeleton] = useState(true);

  // FPS ticker states
  const [fps, setFps] = useState(0);
  const frameCountRef = useRef(0);
  const lastFpsUpdateRef = useRef(Date.now());

  // WebSocket reference
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);

  // Incremental log counter to generate unique IDs
  const logCounterRef = useRef(0);

  // Function to dispatch a new log seamlessly
  const addLog = (event: Omit<GestureEvent, 'id' | 'timestamp'>) => {
    if (logsPaused) return;

    logCounterRef.current += 1;
    const newLog: GestureEvent = {
      ...event,
      id: `log-${Date.now()}-${logCounterRef.current}`,
      timestamp: Date.now()
    };

    setLogs((prev) => {
      const updated = [...prev, newLog];
      // Keep sliding window list capped at 150 frames max to avoid slowing down rendering engines
      if (updated.length > 150) {
        return updated.slice(updated.length - 150);
      }
      return updated;
    });

    // Mirror actions to visual state managers immediately
    processGestureState(event);
  };

  // Convert raw stream events to active visual feedback triggers
  const processGestureState = (event: Omit<GestureEvent, 'id' | 'timestamp'>) => {
    if (event.landmarks) {
      setCurrentLandmarks(event.landmarks);
    } else if (event.event === 'PINCH_END' || event.event === 'FIST_END') {
      setCurrentLandmarks(null);
    }

    switch (event.event) {
      case 'FIST_START':
        setIsFistActive(true);
        if (event.x !== undefined && event.y !== undefined) {
          setCurrentPinch({ x: event.x, y: event.y });
        }
        break;
      case 'FIST_MOVE':
        setIsFistActive(true);
        if (event.x !== undefined && event.y !== undefined) {
          setCurrentPinch({ x: event.x, y: event.y });
        }
        break;
      case 'FIST_END':
        setIsFistActive(false);
        break;
      case 'PINCH_START':
      case 'PINCH_MOVE':
        if (event.x !== undefined && event.y !== undefined) {
          setCurrentPinch({ x: event.x, y: event.y });
        }
        break;
      case 'PINCH_END':
        setCurrentPinch(null);
        break;
      case 'SWIPE':
      case 'SWIPE_LEFT':
      case 'SWIPE_RIGHT':
        const dir = event.direction || (event.event === 'SWIPE_LEFT' ? 'SWIPE_LEFT' : 'SWIPE_RIGHT');
        setLastSwipe({ direction: dir, timestamp: Date.now() });
        // Clear swipe visual after a quick moment
        setTimeout(() => setLastSwipe(null), 1000);
        break;
      default:
        break;
    }
  };

  // Establish local websocket loop targeting ws://localhost:8765
  const connectWebSocket = () => {
    if (wsRef.current) {
      wsRef.current.close();
    }

    setConnectionStatus('connecting');
    console.log('Connecting to core vibe websocket...');

    const socketUrl = 'ws://localhost:8765';
    const ws = new WebSocket(socketUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnectionStatus('connected');
      setActiveSource('socket');
      addLog({
        event: 'VIBE_READY',
        details: 'Handshake successful with Python socket core server.',
        source: 'socket'
      });
    };

    ws.onmessage = (eventMsg) => {
      try {
        const payload = JSON.parse(eventMsg.data);
        if (payload && payload.event) {
          // If local client is in webcam or simulator and python transmits live, prioritize local python socket!
          setActiveSource('socket');
          addLog({
            ...payload,
            source: 'socket'
          });
        }
      } catch (err) {
        console.error('Failed parsing server WebSocket frame', err);
      }
    };

    ws.onclose = () => {
      setConnectionStatus('disconnected');
      if (activeSource === 'socket') {
        setActiveSource('simulator'); // fallback gracefully to browser simulator
      }
      
      // Auto-reconnect after 3 seconds
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = window.setTimeout(() => {
        connectWebSocket();
      }, 3000);
    };

    ws.onerror = () => {
      ws.close();
    };
  };

  useEffect(() => {
    const hasLaunched = localStorage.getItem('hologram_first_launch');
    if (!hasLaunched) {
      setIsHelpOpen(true);
      localStorage.setItem('hologram_first_launch', 'true');
    }
  }, []);

  useEffect(() => {
    connectWebSocket();

    // Start FPS calculations
    const calculateFps = () => {
      frameCountRef.current += 1;
      const now = Date.now();
      const elapsed = now - lastFpsUpdateRef.current;

      if (elapsed >= 1000) {
        setFps(Math.round((frameCountRef.current * 1000) / elapsed));
        frameCountRef.current = 0;
        lastFpsUpdateRef.current = now;
      }
      requestAnimationFrame(calculateFps);
    };
    
    const animId = requestAnimationFrame(calculateFps);

    return () => {
      if (wsRef.current) {
        wsRef.current.onclose = null; // unset close hook during unmount
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#05020c] text-purple-100 flex flex-col font-sans" id="app-root">
      {/* Background radial glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,#180e35_0%,#05020c_65%)] pointer-events-none z-0" />
      
      {/* Cinematic grid lines */}
      <div className="absolute inset-0 bg-retro-scanlines opacity-[0.02] pointer-events-none z-0" />

      {/* Cyberdeck top panel */}
      <CyberdeckHeader 
        connectionStatus={connectionStatus} 
        activeSource={activeSource} 
        fps={fps} 
        onHelpClick={() => setIsHelpOpen(true)}
      />

      {/* Cyberdeck tutorial interactive overlay */}
      <InstructionModal 
        isOpen={isHelpOpen} 
        onClose={() => setIsHelpOpen(false)} 
      />

      {/* Bento grid workspace layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 z-10 relative">
        {/* LEFT COLUMN: Main Visual Studio (7 units out of 12) */}
        <div className="lg:col-span-7 flex flex-col gap-6 h-full min-h-[500px]">
          {/* Main 3D Hologram Projection */}
          <div className="flex-1 bg-[#070412]/80 border border-purple-500/20 rounded-xl overflow-hidden shadow-[0_0_25px_rgba(168,85,247,0.1)] h-full relative min-h-[350px]">
            <HologramCanvas 
              currentPinch={currentPinch} 
              isFistActive={isFistActive} 
              lastSwipe={lastSwipe} 
              currentLandmarks={currentLandmarks}
              showHandSkeleton={showHandSkeleton}
            />

            {/* Tactical overlay for hand tracking visual mesh feedback */}
            <div className="absolute bottom-4 right-4 z-20 flex gap-2">
              <button
                onClick={() => setShowHandSkeleton(prev => !prev)}
                className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg font-mono text-[10px] sm:text-xs font-semibold tracking-wider transition-all duration-300 backdrop-blur-md shadow-lg cursor-pointer ${
                  showHandSkeleton
                    ? 'border-cyan-500/40 bg-cyan-950/40 text-cyan-400 hover:border-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.25)]'
                    : 'border-purple-500/30 bg-[#090514]/75 text-purple-400 hover:border-purple-400 hover:text-purple-300'
                }`}
                title={showHandSkeleton ? "Hide Hand Skeleton overlay on Hologram" : "Show Hand Skeleton overlay on Hologram"}
                id="toggle-hand-skeleton-btn"
              >
                <div className={`w-2 h-2 rounded-full ${showHandSkeleton ? 'bg-cyan-400 animate-pulse shadow-[0_0_6px_rgba(34,211,238,1)]' : 'bg-purple-600'}`} />
                <span>HAND_OVERLAY: {showHandSkeleton ? 'ACTIVE' : 'MUTED'}</span>
              </button>
            </div>
          </div>

          {/* Scrolling Terminal Frame Outputs */}
          <div className="h-[280px]">
            <TerminalLog 
              logs={logs} 
              onClear={() => setLogs([])} 
              paused={logsPaused} 
              onTogglePause={() => setLogsPaused(!logsPaused)} 
            />
          </div>
        </div>

        {/* RIGHT COLUMN: Control Panel & Code Setup (5 units out of 12) */}
        <div className="lg:col-span-5 flex flex-col gap-6 h-full">
          {/* Active webcam/simulation controller */}
          <div>
            <WebcamTracker 
              onGestureDetected={(ev) => {
                setActiveSource(ev.source);
                addLog(ev);
              }}
              activeSource={activeSource}
              setActiveSource={setActiveSource}
              isFistActive={isFistActive}
            />
          </div>

          {/* Linux Installation Launcher and Code Hub */}
          <div className="flex-1 min-h-[350px]">
            <PythonScriptViewer scriptContent={pythonScriptContent} />
          </div>
        </div>
      </main>

      {/* Retro bottom cyber margin element */}
      <footer className="border-t border-purple-500/20 bg-[#090514]/70 py-3 text-center text-[10px] font-mono text-purple-500/60 z-10 relative">
        <span>CYBERDECK::ENGINE // CONNECTED TO THE VIBE // TOTAL RECALL SEQUENCE INITIATED</span>
      </footer>
    </div>
  );
}
