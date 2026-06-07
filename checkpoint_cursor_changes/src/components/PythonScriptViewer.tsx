/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Copy, Check, Download, Play, HelpCircle, Terminal, Cpu } from 'lucide-react';

interface PythonScriptViewerProps {
  scriptContent: string;
}

export default function PythonScriptViewer({ scriptContent }: PythonScriptViewerProps) {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'launcher' | 'source'>('launcher');

  const copyToClipboard = () => {
    navigator.clipboard.writeText(scriptContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadScriptFile = () => {
    const blob = new Blob([scriptContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'core_vibe_engine.py';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-[#0b071a]/95 border border-purple-500/30 rounded-xl overflow-hidden shadow-[0_0_20px_rgba(168,85,247,0.15)] flex flex-col h-full" id="script-panel">
      {/* Tab Selectors */}
      <div className="bg-[#120d26] border-b border-purple-500/30 flex items-center justify-between p-1">
        <div className="flex gap-1.5 ml-2">
          <button
            onClick={() => setActiveTab('launcher')}
            className={`px-3 py-1.5 rounded text-xs font-mono font-medium transition-all ${activeTab === 'launcher' ? 'bg-purple-900/30 border border-purple-500/40 text-cyan-400 font-bold shadow-[0_0_8px_rgba(168,85,247,0.1)]' : 'text-purple-400 border border-transparent hover:text-white'}`}
          >
            LAUNCH_STEPS.sh
          </button>
          <button
            onClick={() => setActiveTab('source')}
            className={`px-3 py-1.5 rounded text-xs font-mono font-medium transition-all ${activeTab === 'source' ? 'bg-purple-900/30 border border-purple-500/40 text-cyan-400 font-bold shadow-[0_0_8px_rgba(168,85,247,0.1)]' : 'text-purple-400 border border-transparent hover:text-white'}`}
          >
            core_vibe_engine.py
          </button>
        </div>

        <div className="flex items-center gap-1.5 mr-2">
          <button
            onClick={copyToClipboard}
            className="p-1.5 rounded hover:bg-purple-900/40 border border-purple-500/20 text-purple-300 transition-colors flex items-center gap-1.5 text-[10px] font-mono"
            title="Copy python script to clipboard"
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
            onClick={downloadScriptFile}
            className="p-1.5 rounded bg-cyan-950 hover:bg-cyan-900 text-cyan-400 border border-cyan-500/30 hover:border-cyan-500/50 transition-colors flex items-center gap-1.5 text-[10px] font-mono"
            title="Download script file (.py)"
          >
            <Download className="w-3.5 h-3.5" />
            <span>DOWNLOAD</span>
          </button>
        </div>
      </div>

      {/* Launcher Guide Tab content */}
      {activeTab === 'launcher' ? (
        <div className="flex-1 p-5 overflow-y-auto font-mono text-purple-200 text-xs space-y-5 scrollbar-cyber h-full relative">
          <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-purple-500/5 to-transparent pointer-events-none" />
          
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-purple-500/20 pb-1.5">
              <Terminal className="w-4 h-4 text-cyan-400" />
              1. WORK ENVIRONMENT REQUIREMENTS
            </h3>
            <p className="text-purple-300/80 leading-relaxed text-[11px]">
              Our client targets **Linux Mint** or **Ubuntu**. MediaPipe requires standard camera hardware privileges linked with webcam frameworks.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-bold text-purple-300">A. OS DEPENDENCIES (DEBIAN / UBUNTU)</h3>
            <div className="bg-black/40 border border-purple-950 p-3 rounded text-cyan-300 overflow-x-auto leading-relaxed relative group">
              <span className="absolute top-2 right-2 text-[9px] text-purple-500/40 select-none uppercase">Terminal command</span>
              <code className="block select-all whitespace-pre">sudo apt-get update
sudo apt-get install python3-pip python3-opencv -y</code>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-bold text-purple-300">B. PYTHON DEPENDENCY INSTALLATION</h3>
            <div className="bg-black/40 border border-purple-950 p-3 rounded text-cyan-300 overflow-x-auto leading-relaxed relative group">
              <span className="absolute top-2 right-2 text-[9px] text-purple-500/40 select-none uppercase">Terminal command</span>
              <code className="block select-all whitespace-pre">pip install -r requirements.txt</code>
            </div>
            <p className="text-[10px] text-purple-400 href:underlined">
              Make sure your <code className="text-purple-300">requirements.txt</code> file is located in the same working folder!
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-purple-500/20 pb-1.5">
              <Play className="w-4 h-4 text-emerald-400 animate-pulse" />
              2. EXECUTING THE GESTURE BROADCST
            </h3>
            <p className="text-purple-300/80 leading-relaxed text-[11px]">
              Execute the core engine using Python 3. The script displays an elegant retro ASCII dashboard and initiates raw video matrix parsing instantly.
            </p>
            <div className="bg-black/40 border border-purple-950 p-3 rounded text-emerald-400 overflow-x-auto relative group">
              <span className="absolute top-2 right-2 text-[9px] text-purple-500/40 select-none uppercase">Execute Command</span>
              <code className="block select-all">python core_vibe_engine.py</code>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5 text-cyan-400" />
              PRO-TIPS FOR VIDEO RECORDERS / SHORTS DESIGN
            </h3>
            <ul className="list-disc leading-relaxed pl-5 text-[11px] text-purple-400/90 space-y-1.5">
              <li>
                <strong className="text-white">Headless Mode:</strong> Change <code className="text-cyan-400">CONFIG["RUN_HEADLESS"]</code> to <code className="text-white">True</code> in the script if you and your camera do not need local preview frames, broadcasting raw json blocks even faster!
              </li>
              <li>
                <strong className="text-white">Camera Indices:</strong> If your console outputs <code className="text-rose-400">Can't open webcam_id: 0</code>, tweak <code className="text-cyan-400">CONFIG["WEBCAM_ID"]</code> matching 1 or 2.
              </li>
              <li>
                <strong className="text-white">Automatic Connection:</strong> This frontend applet automatically listens on <code className="text-cyan-400">ws://localhost:8765</code>. Once your script boots, the connection board will flash <strong className="text-emerald-400 font-bold uppercase select-none">CONNECTED</strong> instantly.
              </li>
            </ul>
          </div>
        </div>
      ) : (
        <div className="flex-1 p-0 overflow-hidden font-mono text-[11px] leading-relaxed relative h-full flex flex-col">
          {/* Scrollable code window with styled lines */}
          <div className="flex-1 overflow-auto bg-[#070412] p-4 text-purple-200 scrollbar-cyber select-text">
            <pre className="text-purple-400">
              <code>{scriptContent}</code>
            </pre>
          </div>
          {/* Footer warning */}
          <div className="px-4 py-2 bg-[#120d26] border-t border-purple-500/20 text-[10px] text-purple-400/80 flex items-center justify-between">
            <span>FILE: core_vibe_engine.py</span>
            <span>LINES: {scriptContent.split('\n').length}</span>
          </div>
        </div>
      )}
    </div>
  );
}
