/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  ChevronRight, 
  ChevronLeft, 
  Hand, 
  Sparkles, 
  Activity, 
  MousePointerClick, 
  Eye,
  Zap,
  CheckCircle2
} from 'lucide-react';

interface InstructionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function InstructionModal({ isOpen, onClose }: InstructionModalProps) {
  const [currentTab, setCurrentTab] = useState(0);
  
  // Interactive sandbox states
  const [clenchActive, setClenchActive] = useState(false);
  const [practiceCoords, setPracticeCoords] = useState({ x: 100, y: 100 });
  const [isPinching, setIsPinching] = useState(false);

  // Tabs structure
  const tabs = [
    {
      title: "SYNAPTIC LINK INITIATION",
      subtitle: "Welcome to Core Gesture Telemetry",
      description: "Welcome back, Operator. This interface bridges physical hand tracking datasets directly to cybernetic 3D energy matrices. Prepare to synchronize your peripheral spatial coordinates.",
      color: "from-purple-500/10 to-indigo-500/10 border-indigo-500/30 text-indigo-400"
    },
    {
      title: "1 // PALM ADRIFT NAVIGATION",
      subtitle: "Kinetic Drift and Organic Inertia",
      description: "Hold your hand open. As you drift left, right, up, or down, the holographic construct moves to align its center with your palm coordinates. Your hand's offset from center accelerates the sphere's spin velocity, leaving a smooth trailing physical momentum after hand absence.",
      color: "from-cyan-500/10 to-teal-500/10 border-cyan-500/30 text-cyan-400"
    },
    {
      title: "2 // COUPLING ENERGY FIST",
      subtitle: "Thermodynamic Shrinkage & Lock-Braking",
      description: "Clench all fingers tightly into a fist. This triggers gravitational field compression: the neural sphere collapses instantly into an ultra-dense, glowing energetic core, locking its spatial axes. Releasing the fist restores the expansive scale with explosive thermodynamic impulse.",
      color: "from-pink-500/10 to-rose-500/10 border-pink-500/30 text-pink-400"
    },
    {
      title: "3 // COGNITIVE TARGET PINCH",
      subtitle: "Microsecond Precision Calibration",
      description: "Bring your index finger and thumb together to activate cognitive target pincers. This locks a focused targeting laser crosshair on the matrix. Excellent for microsecond coordinate selections and system calibration drills.",
      color: "from-purple-500/10 to-fuchsia-500/10 border-purple-500/30 text-purple-400"
    }
  ];

  const handleNext = () => {
    if (currentTab < tabs.length - 1) {
      setCurrentTab(prev => prev + 1);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentTab > 0) {
      setCurrentTab(prev => prev - 1);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Glass backdrop with dark veil */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/85 backdrop-blur-md"
          onClick={onClose}
        />

        {/* Modal Window Cyberdeck */}
        <motion.div 
          initial={{ scale: 0.92, opacity: 0, y: 25 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.92, opacity: 0, y: 25 }}
          transition={{ type: "spring", stiffness: 290, damping: 26 }}
          className="bg-[#0b071a]/95 border-2 border-purple-500/30 rounded-2xl w-full max-w-2xl overflow-hidden shadow-[0_0_50px_rgba(168,85,247,0.3)] z-10 font-mono relative flex flex-col max-h-[90vh]"
          id="instruction-modal-deck"
        >
          {/* Neon decorative edge highlights */}
          <div className="absolute top-0 inset-x-0 h-[3px] bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500" />
          
          {/* Header */}
          <div className="border-b border-purple-500/20 px-6 py-4 flex items-center justify-between bg-[#120b29]/40">
            <div className="flex items-center gap-3">
              <Zap className="w-5 h-5 text-purple-400 animate-pulse" />
              <span className="text-xs uppercase font-bold tracking-widest text-purple-300">SYSTEM_MANUAL :: NEURAL_LINK</span>
            </div>
            
            <button 
              onClick={onClose}
              className="text-purple-400/60 hover:text-pink-400 transition-colors p-1 hover:bg-pink-500/10 rounded-md"
              aria-label="Close dialogue"
              id="close-instruction-modal-btn"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal body Content split */}
          <div className="p-6 overflow-y-auto flex-1 flex flex-col md:flex-row gap-6">
            
            {/* Left: Telemetry Practice Sandbox (Interactive) */}
            <div className="flex-1 bg-[#06030c] border border-purple-950 rounded-xl p-4 flex flex-col justify-between min-h-[220px] md:min-h-0 relative group">
              <div className="absolute top-2 left-2 bg-black/60 border border-purple-500/20 px-1.5 py-0.5 rounded text-[8px] font-mono text-purple-400/70 select-none uppercase tracking-widest">
                • Gesture Practice Sandbox
              </div>

              {/* Rendering interactive preview according to tab selection */}
              <div className="flex-1 flex items-center justify-center relative py-6">
                
                {/* Visual state tab 0: Welcome Sphere */}
                {currentTab === 0 && (
                  <div className="relative flex flex-col items-center">
                    <motion.div 
                      animate={{ 
                        scale: [1, 1.1, 1],
                        rotate: [0, 360]
                      }}
                      transition={{ 
                        duration: 6, 
                        repeat: Infinity, 
                        ease: "linear" 
                      }}
                      className="w-16 h-16 rounded-full border border-dashed border-indigo-400/60 flex items-center justify-center"
                    >
                      <Sparkles className="w-6 h-6 text-indigo-400 animate-pulse" />
                    </motion.div>
                    <div className="absolute -inset-4 rounded-full border border-purple-900/20 animate-ping duration-1000" />
                  </div>
                )}

                {/* Visual state tab 1: Interactive Palm Drift */}
                {currentTab === 1 && (
                  <div 
                    className="w-full h-full min-h-[140px] border border-cyan-950/40 rounded bg-cyan-950/5 flex flex-col items-center justify-center overflow-hidden cursor-crosshair relative"
                    onMouseMove={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setPracticeCoords({
                        x: e.clientX - rect.left,
                        y: e.clientY - rect.top,
                      });
                    }}
                  >
                    {/* Floating Holographic Sphere representation */}
                    <motion.div 
                      animate={{
                        x: practiceCoords.x - 70, // offset center
                        y: practiceCoords.y - 70,
                        rotate: practiceCoords.x * 2 // spin based on coordinate movement
                      }}
                      transition={{ type: "spring", damping: 18, stiffness: 120 }}
                      className="absolute w-12 h-12 rounded-full bg-cyan-500/10 border border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.4)] flex items-center justify-center"
                    >
                      <motion.div 
                        animate={{ scale: [1, 1.3, 1] }} 
                        transition={{ repeat: Infinity, duration: 1.5 }}
                        className="w-4 h-4 rounded-full bg-cyan-400/30 border border-cyan-300"
                      />
                    </motion.div>

                    {/* Centroid indicator guidance */}
                    <div className="absolute text-[8px] text-cyan-400/40 bottom-1">
                      [MOUSE OVER AREA TO SIMULATE HAND PALM CONTROLS]
                    </div>
                  </div>
                )}

                {/* Visual state tab 2: Interactive Fist Clench */}
                {currentTab === 2 && (
                  <div className="w-full flex flex-col items-center justify-center gap-4">
                    <div className="relative flex items-center justify-center min-h-[100px]">
                      {/* Energy Core */}
                      <motion.div 
                        animate={{ 
                          scale: clenchActive ? 0.4 : 1.3,
                          borderRadius: clenchActive ? "10%" : "50%",
                        }}
                        transition={{ type: "spring", damping: 14 }}
                        className={`w-14 h-14 border flex items-center justify-center transition-all ${
                          clenchActive 
                            ? 'bg-rose-500/30 border-rose-400 shadow-[0_0_20px_rgba(244,63,94,0.6)]' 
                            : 'bg-pink-500/10 border-pink-500/40 shadow-[0_0_10px_rgba(236,72,153,0.15)]'
                        }`}
                      >
                        <Activity className={`w-4 h-4 ${clenchActive ? 'text-rose-400 animate-spin' : 'text-pink-300'}`} />
                      </motion.div>
                    </div>

                    <button
                      onClick={() => setClenchActive(!clenchActive)}
                      className={`px-4 py-2 border rounded-md text-xs font-bold transition-all flex items-center gap-2 ${
                        clenchActive 
                          ? 'border-rose-500 bg-rose-500/20 text-rose-300' 
                          : 'border-pink-500/40 hover:border-pink-400 hover:bg-pink-500/10 text-pink-400'
                      }`}
                      id="practice-clench-btn"
                    >
                      <Hand className={`w-4 h-4 ${clenchActive ? 'rotate-180' : ''}`} />
                      {clenchActive ? "RELEASE ENERGY RECOIL" : "CLENCH FIST NOW"}
                    </button>
                  </div>
                )}

                {/* Visual state tab 3: Interactive Pinch Crosshair */}
                {currentTab === 3 && (
                  <div 
                    className="w-full h-full min-h-[140px] border border-purple-950/40 rounded bg-purple-950/5 flex flex-col items-center justify-center overflow-hidden cursor-crosshair relative"
                    onMouseMove={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setPracticeCoords({
                        x: e.clientX - rect.left,
                        y: e.clientY - rect.top,
                      });
                    }}
                    onMouseDown={() => setIsPinching(true)}
                    onMouseUp={() => setIsPinching(false)}
                    onMouseLeave={() => setIsPinching(false)}
                  >
                    {/* Locked targeting lines */}
                    <div 
                      className="absolute pointer-events-none transition-all duration-75"
                      style={{ left: practiceCoords.x, top: practiceCoords.y }}
                    >
                      {/* Laser crosshair guides */}
                      <div className={`w-6 h-6 -translate-x-1/2 -translate-y-1/2 border rounded-full transition-all duration-150 flex items-center justify-center ${
                        isPinching ? 'border-fuchsia-400 scale-75 bg-fuchsia-500/30' : 'border-purple-400/50 scale-100'
                      }`}>
                        <div className="w-1.5 h-1.5 bg-purple-400 rounded-full" />
                      </div>
                      
                      {/* Calibration axis lines */}
                      <div className="absolute h-[1px] w-12 bg-purple-400/20 -translate-y-1/2 -left-6" />
                      <div className="absolute w-[1px] h-12 bg-purple-400/20 -translate-x-1/2 -top-6" />
                    </div>

                    {/* Instruction tags */}
                    <div className="absolute text-[8px] text-purple-400/50 bottom-1 text-center">
                      [CLICK & HOLD MOUSE TO PRACTICE TARGET LOCKING PINCH]
                    </div>
                  </div>
                )}

              </div>

              {/* Console Feedback line */}
              <div className="text-[9px] text-[#a855f7]/60 border-t border-purple-950/40 pt-2 flex items-center justify-between font-mono">
                <span>SIMULATOR::VBUS_01</span>
                <span>STATUS: ACTIVE_FEEDBACK</span>
              </div>
            </div>

            {/* Right: Informational Instruction Panel */}
            <div className="flex-1 flex flex-col justify-between">
              
              <div className="space-y-4">
                <div className="inline-block px-2 py-0.5 rounded text-[10px] uppercase font-bold text-white bg-purple-900 border border-purple-600">
                  Slide {currentTab + 1} of {tabs.length}
                </div>

                <div className="space-y-1">
                  <h3 className="text-sm font-bold tracking-tight text-white uppercase">
                    {tabs[currentTab].title}
                  </h3>
                  <p className="text-[11px] text-purple-400 italic">
                    {tabs[currentTab].subtitle}
                  </p>
                </div>

                <div className={`p-4 rounded-xl border bg-gradient-to-br ${tabs[currentTab].color}`}>
                  <p className="text-xs leading-relaxed text-slate-300">
                    {tabs[currentTab].description}
                  </p>
                </div>
              </div>

              {/* Pagination Dots */}
              <div className="flex gap-1.5 justify-start mt-6">
                {tabs.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentTab(idx)}
                    className={`h-1.5 rounded-full transition-all ${
                      idx === currentTab ? 'w-6 bg-purple-400' : 'w-1.5 bg-purple-950/80 hover:bg-purple-900'
                    }`}
                    aria-label={`Go to slide ${idx + 1}`}
                  />
                ))}
              </div>

            </div>

          </div>

          {/* Navigation Footer Controls */}
          <div className="border-t border-purple-500/20 px-6 py-4 flex items-center justify-between bg-[#120b29]/20">
            <button
              onClick={handlePrev}
              disabled={currentTab === 0}
              className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-md text-xs transition-colors font-bold ${
                currentTab === 0
                  ? 'border-purple-950/40 text-purple-950/40 cursor-not-allowed'
                  : 'border-purple-500/30 hover:border-purple-400 text-purple-300 hover:bg-purple-500/10'
              }`}
              id="modal-prev-btn"
            >
              <ChevronLeft className="w-4 h-4" />
              PREVIOUS
            </button>

            <button
              onClick={handleNext}
              className="flex items-center gap-1.5 px-4 py-2 border border-cyan-500/40 bg-cyan-950/20 hover:border-cyan-400 text-cyan-300 hover:bg-cyan-500/10 shadow-[0_0_10px_rgba(6,182,212,0.15)] rounded-md text-xs transition-colors font-bold"
              id="modal-next-btn"
            >
              {currentTab === tabs.length - 1 ? (
                <>
                  <CheckCircle2 className="w-4 h-4 font-bold text-cyan-400" />
                  INITIATE UPLINK
                </>
              ) : (
                <>
                  NEXT PHASE
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>

        </motion.div>
      </div>
    </AnimatePresence>
  );
}
