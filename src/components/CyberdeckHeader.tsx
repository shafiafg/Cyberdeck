/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Cpu, Wifi, Radio, Clock, Anchor, Terminal } from 'lucide-react';

interface CyberdeckHeaderProps {
  connectionStatus: 'connected' | 'disconnected' | 'connecting';
  activeSource: 'socket' | 'browser' | 'simulator';
  fps: number;
}

export default function CyberdeckHeader({ connectionStatus, activeSource, fps }: CyberdeckHeaderProps) {
  const [systemTime, setSystemTime] = useState('');
  const [latency, setLatency] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setSystemTime(now.toISOString().replace('T', ' ').substring(0, 19) + ' UTC');
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (connectionStatus === 'connected') {
      const pingInterval = setInterval(() => {
        setLatency(Math.floor(Math.random() * 8) + 2); // Extremely fast local websockets latency
      }, 2000);
      return () => clearInterval(pingInterval);
    } else {
      setLatency(0);
    }
  }, [connectionStatus]);

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'text-emerald-400 border-emerald-500 bg-emerald-950/30';
      case 'connecting': return 'text-amber-400 border-amber-500 bg-amber-950/30';
      default: return 'text-rose-500 border-rose-500/50 bg-rose-950/20';
    }
  };

  return (
    <header className="border-b border-purple-500/30 bg-[#090514]/90 px-6 py-4 backdrop-blur-md relative overflow-hidden" id="deck-header">
      {/* Sci-fi top scanline effect */}
      <div className="absolute top-0 left-0 w-full h-[1px] bg-cyan-400 shadow-[0_0_10px_#22d3ee] animate-pulse" />
      
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Left Brand and Title */}
        <div className="flex items-center gap-3">
          <div className="relative p-2 rounded-lg bg-purple-950/50 border border-purple-500/40 shadow-[0_0_15px_rgba(168,85,247,0.2)]">
            <Cpu className="w-6 h-6 text-cyan-400 animate-pulse" />
            <div className="absolute inset-0 rounded-lg border border-cyan-400/30 scale-110 filter blur-[2px]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono tracking-widest text-purple-400 uppercase font-bold">AISTUDIO_BUILD // PROTO_DECK</span>
              <span className="text-[9px] font-mono px-1.5 py-0.5 bg-cyan-950 border border-cyan-500/30 text-cyan-400 rounded">v1.0.0</span>
            </div>
            <h1 className="text-xl font-mono font-bold tracking-tight text-white flex items-center gap-2">
              CYBERDECK_GESTURE_ENGINE
            </h1>
          </div>
        </div>

        {/* Middle Stats - Cyber metrics */}
        <div className="flex flex-wrap items-center justify-center gap-6 text-xs font-mono text-purple-300">
          <div className="flex items-center gap-2 bg-purple-950/20 px-3 py-1.5 rounded border border-purple-500/20">
            <Radio className="w-3.5 h-3.5 text-purple-400" />
            <span>ACTIVE_SOURCE:</span>
            <span className="text-cyan-400 uppercase font-bold">{activeSource}</span>
          </div>

          <div className="flex items-center gap-2 bg-purple-950/20 px-3 py-1.5 rounded border border-purple-500/20">
            <Clock className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-purple-200">{systemTime}</span>
          </div>

          {connectionStatus === 'connected' && (
            <div className="flex items-center gap-2 bg-emerald-950/20 px-3 py-1.5 rounded border border-emerald-500/20">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>LATENCY:</span>
              <span className="text-emerald-400 font-bold">{latency}ms</span>
            </div>
          )}

          <div className="flex items-center gap-2 bg-purple-950/20 px-3 py-1.5 rounded border border-purple-500/20">
            <span>FPS:</span>
            <span className="text-cyan-300 font-bold">{fps}</span>
          </div>
        </div>

        {/* Right - Live connection status */}
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2.5 px-4 py-2 rounded border font-mono text-xs font-bold transition-all duration-300 shadow-[0_0_15px_rgba(34,211,238,0.05)] ${getStatusColor()}`}>
            <Wifi className={`w-4 h-4 ${connectionStatus === 'connected' ? 'animate-pulse' : ''}`} />
            <span className="tracking-wider">
              {connectionStatus === 'connected' && 'SOCKET_CONNECTED - 8765'}
              {connectionStatus === 'connecting' && 'AWAITING_CORE_VIBE_SOCKET...'}
              {connectionStatus === 'disconnected' && 'WEBSOCKET_OFFLINE'}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
