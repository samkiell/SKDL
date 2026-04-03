'use client';

import { useState, useEffect } from 'react';

interface SubtitleResult {
  id: string;
  title: string;
  year: string | number;
  release_name: string;
  file_id: string;
}

interface DownloadModalProps {
  result: SubtitleResult;
  onClose: () => void;
  onDownload: (file_id: string, release_name: string) => void;
}

export default function DownloadModal({ result, onClose, onDownload }: DownloadModalProps) {
  const [countdown, setCountdown] = useState(10);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setIsReady(true);
    }
  }, [countdown]);

  const handleDownload = () => {
    if (isReady) {
      onDownload(result.file_id, result.release_name);
    }
  };

  // Prevent background scrolling when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-xl bg-black/80 animate-in fade-in duration-300">
      <div className="bg-zinc-950 border border-white/10 w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
        <div className="p-8 flex flex-col items-center text-center space-y-6">
          {/* Header */}
          <div className="space-y-2">
            <h2 className="text-2xl font-space font-bold tracking-tight">
              Ready to Download
            </h2>
            <p className="font-mono text-xs text-zinc-500 uppercase tracking-widest break-all">
              {result.title} ({result.year})
            </p>
          </div>

          {/* Countdown Ring */}
          <div className="relative w-24 h-24 flex items-center justify-center">
            <svg className="w-full h-full -rotate-90">
              <circle
                cx="48"
                cy="48"
                r="40"
                stroke="currentColor"
                strokeWidth="4"
                fill="transparent"
                className="text-white/5"
              />
              <circle
                cx="48"
                cy="48"
                r="40"
                stroke="currentColor"
                strokeWidth="4"
                fill="transparent"
                strokeDasharray="251.2"
                strokeDashoffset={251.2 * (countdown / 10)}
                className="text-zinc-400 transition-all duration-1000 linear"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-4xl font-space font-bold text-white">
              {countdown}
            </span>
          </div>

          <p className="text-sm font-mono text-zinc-400">
            {countdown > 0 
                ? `Your download will begin in ${countdown}s...` 
                : 'Your download is ready!'}
          </p>

          {/* AD SLOT — replace with your ad network script */}
          <div className="w-full h-[250px] bg-zinc-900/50 rounded-xl border border-white/5 flex flex-col items-center justify-center space-y-2 relative overflow-hidden group">
            <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-black/50 rounded text-[8px] font-mono text-zinc-500 uppercase tracking-tighter border border-white/5">
              Advertisement
            </div>
            {/* 
                DROP AD SCRIPT HERE 
            */}
            <div className="text-zinc-600 font-mono text-[10px] animate-pulse">
                AD_SLOT_300x250
            </div>
            
            <div className="w-24 h-24 opacity-10 blur-xl bg-zinc-400 rounded-full absolute -bottom-12 -left-12 group-hover:opacity-20 transition-opacity"></div>
          </div>

          {/* Actions */}
          <div className="flex flex-col w-full gap-3">
            <button
              onClick={handleDownload}
              disabled={!isReady}
              className={`w-full py-4 rounded-xl font-space font-bold transition-all ${
                isReady 
                  ? 'bg-zinc-400 text-black hover:scale-[1.02] active:scale-95 shadow-[0_0_20px_rgba(161,161,170,0.2)]' 
                  : 'bg-zinc-800 text-zinc-600 cursor-not-allowed opacity-50'
              }`}
            >
              {isReady ? 'DOWNLOAD NOW' : 'PLEASE WAIT...'}
            </button>
            
            <button
              onClick={onClose}
              className="text-[10px] font-mono text-zinc-600 hover:text-white uppercase tracking-widest transition-colors py-2"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
