/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect } from 'react';
import { Terminal, Trash2, Pause, Play, ChevronRight, Share } from 'lucide-react';
import { GestureEvent } from '../types';

interface TerminalLogProps {
  logs: GestureEvent[];
  onClear: () => void;
  paused: boolean;
  onTogglePause: () => void;
}

export default function TerminalLog({ logs, onClear, paused, onTogglePause }: TerminalLogProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of the logs unless paused
  useEffect(() => {
    if (!paused && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs, paused]);

  const getEventBadgeClass = (event: GestureEvent['event']) => {
    if (event.includes('START')) return 'bg-emerald-950 text-emerald-400 border-emerald-500/40';
    if (event.includes('END')) return 'bg-rose-950 text-rose-400 border-rose-500/40';
    if (event.includes('MOVE')) return 'bg-cyan-950 text-cyan-400 border-cyan-500/40';
    if (event.includes('SWIPE')) return 'bg-fuchsia-950 text-fuchsia-400 border-fuchsia-500/40';
    return 'bg-purple-950 text-purple-400 border-purple-500/40';
  };

  const getSourceColor = (source: GestureEvent['source']) => {
    switch (source) {
      case 'socket': return 'text-emerald-400 font-bold';
      case 'browser': return 'text-cyan-400';
      default: return 'text-amber-400 border-amber-500/30';
    }
  };

  return (
    <div className="bg-[#0b071a]/95 border border-purple-500/30 rounded-xl overflow-hidden shadow-[0_0_20px_rgba(168,85,247,0.15)] flex flex-col h-[320px] md:h-full relative" id="terminal-console">
      {/* Visual background styling grids */}
      <div className="absolute inset-0 bg-retro-scanlines pointer-events-none opacity-[0.03]" />
      
      {/* Terminal Title Bar */}
      <div className="bg-[#120d26] border-b border-purple-500/30 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block" />
            <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block" />
            <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
          </div>
          <span className="text-xs font-mono font-semibold text-purple-300 ml-2 flex items-center gap-1.5">
            <Terminal className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            LIVE_FRAME_FEED
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={onTogglePause}
            className={`p-1.5 rounded hover:bg-purple-900/40 text-purple-300 transition-colors border ${paused ? 'border-amber-500/40 text-amber-400 bg-amber-950/20' : 'border-purple-500/20'}`}
            title={paused ? "Resume Feed" : "Pause Feed"}
          >
            {paused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={onClear}
            className="p-1.5 rounded hover:bg-rose-950/40 text-purple-300 hover:text-rose-400 transition-all border border-purple-500/20 hover:border-rose-500/40"
            title="Clear Terminal Log"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Terminal Code Grid Rows */}
      <div 
        ref={containerRef}
        className="flex-1 p-4 font-mono text-xs overflow-y-auto space-y-2 h-full scrollbar-cyber"
      >
        {logs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-purple-400/60 font-mono">
            <ChevronRight className="w-8 h-8 text-purple-500/30 mb-2 animate-bounce" />
            <p className="font-bold mb-1">AWAITING TRANSLATIONS...</p>
            <p className="text-[10px] max-w-xs text-purple-400/40">
              Run 'core_vibe_engine.py' locally or toggle the Browser Camera / Web Simulator on the right panel to flood this display.
            </p>
          </div>
        ) : (
          logs.map((log) => {
            const timeStr = new Date(log.timestamp).toISOString().substring(11, 23);
            return (
              <div 
                key={log.id} 
                className="group border-b border-purple-950/30 pb-2 flex flex-col md:flex-row items-start md:items-center justify-between gap-2 hover:bg-purple-950/10 rounded px-1 transition-colors"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] text-purple-500/70">[{timeStr}]</span>
                  <span className={`text-[9px] px-1.5 py-0.5 border rounded uppercase tracking-wider font-bold ${getEventBadgeClass(log.event)}`}>
                    {log.event}
                  </span>
                  <span className="text-[10px] text-purple-400/80">
                    {log.event.includes('PINCH') && log.x !== undefined && log.y !== undefined ? (
                      <span className="text-cyan-300">
                        X: <span className="text-white font-bold">{log.x.toFixed(4)}</span> | Y: <span className="text-white font-bold">{log.y.toFixed(4)}</span>
                      </span>
                    ) : log.event === 'SWIPE' ? (
                      <span className="text-fuchsia-300 font-bold uppercase tracking-widest bg-fuchsia-950/40 px-1 py-0.5 rounded border border-fuchsia-500/20">
                        {log.direction} (I: {log.intensity})
                      </span>
                    ) : (
                      <span className="text-purple-300 text-[10px] leading-tight select-all">{log.details || 'Signal processed.'}</span>
                    )}
                  </span>
                </div>
                
                <div className="flex items-center gap-1.5 ml-auto md:ml-0 self-end md:self-center">
                  <span className="text-[9px] font-bold tracking-widest text-[rgb(34,211,238)]/40 hover:text-[rgb(34,211,238)]/85 transition-colors uppercase cursor-help" title={`Source: ${log.source}`}>
                    src_val::<span className={getSourceColor(log.source)}>{log.source}</span>
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Frame log status bar */}
      <div className="bg-[#090514] border-t border-purple-500/20 px-4 py-1.5 flex items-center justify-between text-[10px] font-mono text-purple-400">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
          TOTAL_DISPATCHED: <strong className="text-cyan-300 font-bold">{logs.length}</strong>
        </span>
        <span className="text-purple-500/70 text-[9px]">ENV: Linux_Mint_Ubuntu</span>
      </div>
    </div>
  );
}
