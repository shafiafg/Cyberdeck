/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Terminal, Cpu, Download, Copy, Check, MousePointer, HelpCircle, HardDrive, Info } from 'lucide-react';
import { pythonScriptContent } from './pythonCode';

// Beautiful interactive double-sphere vector graphic (React-based mouse interaction mock)
function InteractiveHologram() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDragging = useRef(false);
  const lastMousePos = useRef({ x: 0, y: 0 });
  const rotation = useRef({ x: 0.1, y: -0.2, z: 0 });
  const targetRotation = useRef({ x: 0.1, y: -0.2 });
  const [activeShape, setActiveShape] = useState<'SPHERE' | 'CYLINDER'>('SPHERE');
  const [fistActive, setFistActive] = useState(false);
  const [pinchActive, setPinchActive] = useState(false);

  // Generate math coordinates
  const generatePoints = () => {
    const list: { x: number; y: number; z: number }[] = [];
    const outerEdges: [number, number][] = [];
    const innerList: { x: number; y: number; z: number }[] = [];
    const innerEdges: [number, number][] = [];

    // Outer geometry
    if (activeShape === 'SPHERE') {
      const rings = 9;
      const pointsPerRing = 12;
      for (let i = 0; i < rings; i++) {
        const lat = Math.PI * (i + 1) / (rings + 1);
        const sinLat = Math.sin(lat);
        const cosLat = Math.cos(lat);

        for (let j = 0; j < pointsPerRing; j++) {
          const lon = (2 * Math.PI * j) / pointsPerRing;
          list.push({
            x: sinLat * Math.cos(lon),
            y: cosLat,
            z: sinLat * Math.sin(lon)
          });
        }
      }

      for (let i = 0; i < rings; i++) {
        const start = i * pointsPerRing;
        for (let j = 0; j < pointsPerRing; j++) {
          outerEdges.push([start + j, start + ((j + 1) % pointsPerRing)]);
          if (i < rings - 1) {
            outerEdges.push([start + j, start + j + pointsPerRing]);
          }
        }
      }
    } else {
      const levels = 6;
      const pointsPerLevel = 12;
      for (let i = 0; i < levels; i++) {
        const y = -0.8 + (1.6 * i) / (levels - 1);
        for (let j = 0; j < pointsPerLevel; j++) {
          const angle = (2 * Math.PI * j) / pointsPerLevel;
          list.push({
            x: 0.7 * Math.cos(angle),
            y,
            z: 0.7 * Math.sin(angle)
          });
        }
      }

      for (let i = 0; i < levels; i++) {
        const start = i * pointsPerLevel;
        for (let j = 0; j < pointsPerLevel; j++) {
          outerEdges.push([start + j, start + ((j + 1) % pointsPerLevel)]);
          if (i < levels - 1) {
            outerEdges.push([start + j, start + j + pointsPerLevel]);
          }
        }
      }
    }

    // Inner Concentric Core
    const iRings = 5;
    const iPoints = 8;
    for (let i = 0; i < iRings; i++) {
      const lat = Math.PI * (i + 1) / (iRings + 1);
      const sinLat = Math.sin(lat);
      const cosLat = Math.cos(lat);

      for (let j = 0; j < iPoints; j++) {
        const lon = (2 * Math.PI * j) / iPoints;
        innerList.push({
          x: 0.48 * sinLat * Math.cos(lon),
          y: 0.48 * cosLat,
          z: 0.48 * sinLat * Math.sin(lon)
        });
      }
    }

    for (let i = 0; i < iRings; i++) {
      const start = i * iPoints;
      for (let j = 0; j < iPoints; j++) {
        innerEdges.push([start + j, start + ((j + 1) % iPoints)]);
        if (i < iRings - 1) {
          innerEdges.push([start + j, start + j + iPoints]);
        }
      }
    }

    return { outerVerts: list, outerEdges, innerVerts: innerList, innerEdges };
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const handleResize = () => {
      canvas.width = canvas.parentElement?.clientWidth || 500;
      canvas.height = canvas.parentElement?.clientHeight || 400;
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    const pointsData = generatePoints();

    const render = () => {
      animId = requestAnimationFrame(render);
      ctx.fillStyle = '#020105';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const sizeFactor = Math.min(canvas.width, canvas.height) * 0.45;

      // Draw background sci-fi crosshair and alignment markers
      ctx.strokeStyle = '#1b123a';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, sizeFactor * 0.8, 0, Math.PI * 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(cx - 30, cy); ctx.lineTo(cx + 30, cy);
      ctx.moveTo(cx, cy - 30); ctx.lineTo(cx, cy + 30);
      ctx.strokeStyle = '#251552';
      ctx.stroke();

      // Continuous rotation of the outer/inner matrices
      rotation.current.y += (targetRotation.current.y - rotation.current.y) * 0.15;
      rotation.current.x += (targetRotation.current.x - rotation.current.x) * 0.15;
      rotation.current.z += 0.007;

      if (!isDragging.current) {
        // Automatic gentle spinning when idle
        targetRotation.current.y += 0.003;
      }

      // Draw Inner Core (Neon Cyan)
      const scaleVal = fistActive ? 0.6 : pinchActive ? 0.85 : 1.0;
      const innerRotZ = -rotation.current.z * 1.8;

      const innerProjected = pointsData.innerVerts.map((v) => {
        // opposite orbit
        let rx1 = v.x;
        let ry1 = v.y * Math.cos(rotation.current.x) - v.z * Math.sin(rotation.current.x);
        let rz1 = v.y * Math.sin(rotation.current.x) + v.z * Math.cos(rotation.current.x);

        let rx2 = rx1 * Math.cos(-rotation.current.y * 1.5) + rz1 * Math.sin(-rotation.current.y * 1.5);
        let rz2 = -rx1 * Math.sin(-rotation.current.y * 1.5) + rz1 * Math.cos(-rotation.current.y * 1.5);

        let rx3 = rx2 * Math.cos(innerRotZ) - ry1 * Math.sin(innerRotZ);
        let ry3 = rx2 * Math.sin(innerRotZ) + ry1 * Math.cos(innerRotZ);

        const dist = 3.0;
        const scale = sizeFactor / (dist + rz2);

        return {
          x: cx + rx3 * scale * scaleVal,
          y: cy - ry3 * scale * scaleVal,
          z: rz2
        };
      });

      ctx.lineWidth = 1;
      pointsData.innerEdges.forEach(([p1, p2]) => {
        const pt1 = innerProjected[p1];
        const pt2 = innerProjected[p2];
        if (pt1 && pt2) {
          const depth = (pt1.z + pt2.z) / 2;
          ctx.strokeStyle = depth > 0 ? '#031e2d' : '#00ffff';
          ctx.beginPath();
          ctx.moveTo(pt1.x, pt1.y);
          ctx.lineTo(pt2.x, pt2.y);
          ctx.stroke();
        }
      });

      // Draw Outer Core (Neon Pink)
      const outerProjected = pointsData.outerVerts.map((v) => {
        let rx1 = v.x;
        let ry1 = v.y * Math.cos(rotation.current.x) - v.z * Math.sin(rotation.current.x);
        let rz1 = v.y * Math.sin(rotation.current.x) + v.z * Math.cos(rotation.current.x);

        let rx2 = rx1 * Math.cos(rotation.current.y) + rz1 * Math.sin(rotation.current.y);
        let rz2 = -rx1 * Math.sin(rotation.current.y) + rz1 * Math.cos(rotation.current.y);

        let rx3 = rx2 * Math.cos(rotation.current.z) - ry1 * Math.sin(rotation.current.z);
        let ry3 = rx2 * Math.sin(rotation.current.z) + ry1 * Math.cos(rotation.current.z);

        const dist = 3.0;
        const scale = sizeFactor / (dist + rz2);

        return {
          x: cx + rx3 * scale * scaleVal,
          y: cy - ry3 * scale * scaleVal,
          z: rz2
        };
      });

      ctx.lineWidth = pinchActive ? 2 : 1;
      pointsData.outerEdges.forEach(([p1, p2]) => {
        const pt1 = outerProjected[p1];
        const pt2 = outerProjected[p2];
        if (pt1 && pt2) {
          const depth = (pt1.z + pt2.z) / 2;
          ctx.strokeStyle = depth > 0.1 ? '#2c061a' : pinchActive ? '#ff007f' : '#b00560';
          ctx.beginPath();
          ctx.moveTo(pt1.x, pt1.y);
          ctx.lineTo(pt2.x, pt2.y);
          ctx.stroke();
        }
      });

      // UI text indicators
      ctx.fillStyle = '#ff007f';
      ctx.font = 'bold 11px monospace';
      ctx.fillText(`GEOMETRY_MATRIX: [${activeShape}]`, 18, 25);
      ctx.fillStyle = '#00ffff';
      ctx.fillText(`PITCH_ORIENTATION: ${Math.round(rotation.current.x * (180 / Math.PI)) % 360}°`, 18, 42);
      ctx.fillText(`YAW_ORIENTATION  : ${Math.round(rotation.current.y * (180 / Math.PI)) % 360}°`, 18, 56);

      // Status beacon text
      const statusText = fistActive 
        ? "TELEMETRY GESTURE: COMPRESSION FIST DEFORM ACTIVE" 
        : pinchActive 
        ? "TELEMETRY GESTURE: TARGET PINCH TRACK LOCKED" 
        : "WEBCAM HUD SIMULATOR ACTIVE [STANDBY]";
      ctx.fillStyle = fistActive ? '#ff007f' : pinchActive ? '#00ffff' : '#62577a';
      ctx.fillText(statusText, 18, canvas.height - 20);

      // Sci-fi corners drawing
      const sz = 16;
      ctx.strokeStyle = '#4e3e75';
      ctx.lineWidth = 1;
      // TL
      ctx.beginPath(); ctx.moveTo(10, 10); ctx.lineTo(10 + sz, 10); ctx.moveTo(10, 10); ctx.lineTo(10, 10 + sz); ctx.stroke();
      // TR
      ctx.beginPath(); ctx.moveTo(canvas.width - 10, 10); ctx.lineTo(canvas.width - 10 - sz, 10); ctx.moveTo(canvas.width - 10, 10); ctx.lineTo(canvas.width - 10, 10 + sz); ctx.stroke();
      // BL
      ctx.beginPath(); ctx.moveTo(10, canvas.height - 10); ctx.lineTo(10 + sz, canvas.height - 10); ctx.moveTo(10, canvas.height - 10); ctx.lineTo(10, canvas.height - 10 - sz); ctx.stroke();
      // BR
      ctx.beginPath(); ctx.moveTo(canvas.width - 10, canvas.height - 10); ctx.lineTo(canvas.width - 10 - sz, canvas.height - 10); ctx.moveTo(canvas.width - 10, canvas.height - 10); ctx.lineTo(canvas.width - 10, canvas.height - 10 - sz); ctx.stroke();
    };

    render();

    // Drag handlers
    const onMouseDown = (e: MouseEvent) => {
      isDragging.current = true;
      lastMousePos.current = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const dx = e.clientX - lastMousePos.current.x;
      const dy = e.clientY - lastMousePos.current.y;
      targetRotation.current.y += dx * 0.007;
      targetRotation.current.x += dy * 0.007;
      lastMousePos.current = { x: e.clientX, y: e.clientY };
    };

    const onMouseUp = () => {
      isDragging.current = false;
    };

    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [activeShape, fistActive, pinchActive]);

  return (
    <div className="flex flex-col h-full bg-[#0a0618] border border-purple-500/20 rounded-xl overflow-hidden relative" id="hologram-viewport-panel">
      <div className="flex-1 min-h-[300px] relative">
        <canvas ref={canvasRef} className="w-full h-full block bg-[#020105]" />
        
        {/* Helper drag prompt */}
        <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded text-[9px] font-mono text-purple-300 flex items-center gap-1">
          <MousePointer className="w-3 h-3 text-cyan-400" />
          <span>DRAG MOUSE TO ROTATE WIREFRAME UNIT</span>
        </div>
      </div>

      {/* Manual testing widgets simulating gestures in browser */}
      <div className="border-t border-purple-500/20 p-4 bg-[#0d0722] flex flex-wrap gap-2 items-center justify-between">
        <div className="flex gap-1.5">
          <button
            onClick={() => setActiveShape('SPHERE')}
            className={`px-3 py-1.5 rounded font-mono text-[11px] font-bold transition-all cursor-pointer ${activeShape === 'SPHERE' ? 'bg-cyan-950 border border-cyan-500/40 text-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.15)]' : 'bg-black/40 border border-purple-500/10 text-purple-400 hover:text-purple-300'}`}
            id="sphere-shape-btn"
          >
            3D SPHERE
          </button>
          <button
            onClick={() => setActiveShape('CYLINDER')}
            className={`px-3 py-1.5 rounded font-mono text-[11px] font-bold transition-all cursor-pointer ${activeShape === 'CYLINDER' ? 'bg-cyan-950 border border-cyan-500/40 text-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.15)]' : 'bg-black/40 border border-purple-500/10 text-purple-400 hover:text-purple-300'}`}
            id="cylinder-shape-btn"
          >
            CYBER CYLINDER
          </button>
        </div>

        <div className="flex gap-2">
          <button
            onMouseDown={() => setPinchActive(true)}
            onMouseUp={() => setPinchActive(false)}
            onMouseLeave={() => setPinchActive(false)}
            className={`px-2.5 py-1 rounded border font-mono text-[10px] select-none transition-all cursor-pointer ${pinchActive ? 'bg-cyan-950 border-cyan-500 text-cyan-400' : 'bg-black/30 border-purple-500/20 text-purple-400 hover:text-purple-300'}`}
            id="sim-pinch-btn"
          >
            HOLD TO SIMULATE PINCH
          </button>
          <button
            onMouseDown={() => setFistActive(true)}
            onMouseUp={() => setFistActive(false)}
            onMouseLeave={() => setFistActive(false)}
            className={`px-2.5 py-1 rounded border font-mono text-[10px] select-none transition-all cursor-pointer ${fistActive ? 'bg-pink-950 border-pink-500 text-pink-400' : 'bg-black/30 border-purple-500/20 text-purple-400 hover:text-purple-300'}`}
            id="sim-fist-btn"
          >
            HOLD TO SIMULATE FIST
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'DEPLOY' | 'SOURCE'>('DEPLOY');

  const copyPythonCode = () => {
    navigator.clipboard.writeText(pythonScriptContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadPythonFile = () => {
    const blob = new Blob([pythonScriptContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'desktop_cyberdeck_app.py';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[#05020c] text-purple-100 flex flex-col font-sans relative" id="app-root">
      {/* Background ambiance radial glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,#180e35_0%,#05020c_65%)] pointer-events-none z-0" />
      <div className="absolute inset-0 bg-retro-scanlines opacity-[0.02] pointer-events-none z-0" />
      
      {/* HEADER SECTION */}
      <header className="border-b border-purple-500/30 bg-[#090514]/90 px-6 py-4 backdrop-blur-md relative overflow-hidden z-10" id="deck-header">
        <div className="absolute top-0 left-0 w-full h-[1px] bg-cyan-400 shadow-[0_0_10px_#22d3ee] animate-pulse" />
        
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="relative p-2 rounded-lg bg-purple-950/50 border border-purple-500/40">
              <Cpu className="w-5 h-5 text-cyan-400 animate-pulse" />
            </div>
            <div>
              <span className="text-[10px] font-mono tracking-widest text-purple-400 uppercase font-bold">CYBERDECK COCKPIT HARNESS</span>
              <h1 className="text-lg font-mono font-bold text-white tracking-wider">CYBERDECK CORE v2.0</h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981]" />
            <span className="text-[10px] font-mono font-bold tracking-widest text-emerald-400">DESKTOP STANDALONE ENVELOPE</span>
          </div>
        </div>
      </header>

      {/* MAIN LAYOUT */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 z-10 relative">
        
        {/* LEFT COLUMN: INTERACTIVE sphere PREVIEW */}
        <div className="lg:col-span-6 flex flex-col gap-6">
          <div className="flex-1 flex flex-col h-full min-h-[420px]">
            <InteractiveHologram />
          </div>

          {/* Quick info panel */}
          <div className="bg-[#0b071a]/80 border border-purple-500/15 p-4 rounded-xl flex items-start gap-3">
            <Info className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
            <div className="text-xs font-mono text-purple-300 leading-relaxed space-y-1">
              <span className="text-white font-bold block">WHY STANDALONE PYTHON INSTEAD OF CHROME?</span>
              <p>
                Browser sandbox security restrictions degrade webcam access and throttling drops webcam FPS to under 15fps. Native OpenCV and MediaPipe executed directly on your Linux Mint/Ubuntu computer run cleanly at native **60+ FPS** with zero latency, low overhead, and full hardware privileges!
              </p>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: DOWNLOAD / DEPLOYMENT GUIDE */}
        <div className="lg:col-span-6 flex flex-col gap-6 h-full min-h-[500px]">
          <div className="bg-[#0b071a]/95 border border-purple-500/30 rounded-xl overflow-hidden flex flex-col h-full" id="deployment-panel">
            
            {/* Tabs */}
            <div className="bg-[#120d26] border-b border-purple-500/30 flex items-center justify-between p-1.5">
              <div className="flex gap-2">
                <button
                  onClick={() => setActiveTab('DEPLOY')}
                  className={`px-3 py-1.5 rounded text-xs font-mono font-bold transition-all cursor-pointer ${activeTab === 'DEPLOY' ? 'bg-purple-900/30 border border-purple-500/40 text-cyan-400' : 'text-purple-400 hover:text-white'}`}
                >
                  DEPLOY_GUIDE.md
                </button>
                <button
                  onClick={() => setActiveTab('SOURCE')}
                  className={`px-3 py-1.5 rounded text-xs font-mono font-bold transition-all cursor-pointer ${activeTab === 'SOURCE' ? 'bg-purple-900/30 border border-purple-500/40 text-cyan-400' : 'text-purple-400 hover:text-white'}`}
                >
                  desktop_cyberdeck_app.py
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={copyPythonCode}
                  className="px-2.5 py-1 rounded bg-black/40 hover:bg-black/60 text-purple-300 border border-purple-500/20 transition-all font-mono text-[10px] flex items-center gap-1.5 cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                      <span className="text-emerald-400">COPIED</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>COPY_CODE</span>
                    </>
                  )}
                </button>
                <button
                  onClick={downloadPythonFile}
                  className="px-2.5 py-1 rounded bg-cyan-950 hover:bg-cyan-900 text-cyan-400 border border-cyan-500/30 transition-all font-mono text-[10px] flex items-center gap-1.5 cursor-pointer font-bold shadow-[0_0_8px_rgba(6,182,212,0.1)]"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>DOWNLOAD</span>
                </button>
              </div>
            </div>

            {/* TAB CONTAINER */}
            <div className="flex-1 overflow-y-auto p-5 font-mono text-purple-200 text-xs leading-relaxed space-y-5 h-full relative">
              
              {activeTab === 'DEPLOY' ? (
                <>
                  <div className="space-y-2">
                    <h2 className="text-sm font-bold text-white flex items-center gap-2 border-b border-purple-500/20 pb-1.5">
                      <Terminal className="w-4 h-4 text-cyan-400" />
                      1. INSTALL LOCAL DEPENDENCIES
                    </h2>
                    <p className="text-purple-300/80 text-[11px]">
                      Install Python 3 and CV libraries utilizing pip package managers to unlock hardware webcam access:
                    </p>
                    <div className="bg-black/40 border border-purple-950 p-3 rounded text-cyan-400 relative">
                      <code className="block select-all whitespace-pre">pip install opencv-python mediapipe pillow</code>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h2 className="text-sm font-bold text-white flex items-center gap-2 border-b border-purple-500/20 pb-1.5">
                      <HardDrive className="w-4 h-4 text-emerald-400" />
                      2. EXECUTE THE SYSTEM STANDALONE
                    </h2>
                    <p className="text-purple-300/80 text-[11px]">
                      Download or Copy the <code className="text-cyan-400">desktop_cyberdeck_app.py</code> script. Launch the process from your terminal to boot the native dashboard stream:
                    </p>
                    <div className="bg-black/40 border border-purple-950 p-3 rounded text-emerald-400">
                      <code className="block select-all">python desktop_cyberdeck_app.py</code>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h2 className="text-sm font-bold text-white flex items-center gap-2 border-b border-purple-500/20 pb-1.5">
                      <Cpu className="w-4 h-4 text-purple-400 animate-pulse" />
                      3. COMPILE INTO NATIVE STANDALONE .EXE
                    </h2>
                    <p className="text-purple-300/80 text-[11px]">
                      You can compile this entire program into a single, highly-optimized freestanding native `.exe` executable (no Python installation required by the runner!):
                    </p>
                    <div className="bg-black/40 border border-purple-950 p-3 rounded text-pink-400 leading-relaxed font-mono whitespace-pre-line text-[11px] select-all">
                      pip install pyinstaller {"\n"}
                      pyinstaller --onefile --noconsole --name="CyberdeckCore" desktop_cyberdeck_app.py
                    </div>
                    <p className="text-[10px] text-purple-400">
                      Once processed, the self-contained app will be placed inside the <code className="text-cyan-400">/dist</code> directory!
                    </p>
                  </div>

                  <div className="space-y-2">
                    <h2 className="text-xs font-bold text-cyan-400 uppercase select-none">SYSTEM FEATURES SUMMARY</h2>
                    <ul className="list-disc pl-5 text-[11px] text-purple-400/90 space-y-1.5">
                      <li>
                        <strong className="text-white">Dual Concentric Cores:</strong> Features an outer wireframe chassis coupled with an oppositing inner core vector orbital layout.
                      </li>
                      <li>
                        <strong className="text-white">Zero Simulated Motion Noise:</strong> The sphere coordinates remain beautifully centered. Core rotation displacement only warps when physical hand coordinates are visible to the lens!
                      </li>
                      <li>
                        <strong className="text-white">Tactile Telemetry Console:</strong> A Tkinter-based log tracks system state changes, clenches, and locks.
                      </li>
                    </ul>
                  </div>
                </>
              ) : (
                <div className="p-0 overflow-hidden text-[10px] select-text h-full flex flex-col absolute inset-0">
                  <div className="flex-1 overflow-auto bg-[#04010a] p-4 text-purple-300 scrollbar-cyber">
                    <pre className="text-cyan-400">
                      <code>{pythonScriptContent}</code>
                    </pre>
                  </div>
                  <div className="px-4 py-2.5 bg-[#120d26] border-t border-purple-500/20 text-[10px] text-purple-400 flex justify-between select-none shrink-0">
                    <span>FILE: desktop_cyberdeck_app.py</span>
                    <span>SIZE: ~20 KB</span>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>

      </main>

      {/* FOOTER */}
      <footer className="border-t border-purple-500/20 bg-[#090514]/70 py-3.5 text-center text-[10px] font-mono text-purple-500/60 z-10 relative">
        <span>CYBERDECK // NATIVE EMULATOR PIPELINE TERMINATION SEQUENCER // SECURE TERMINAL CONNECTION</span>
      </footer>
    </div>
  );
}
