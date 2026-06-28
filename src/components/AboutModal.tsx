"use client";

interface AboutModalProps {
  onClose: () => void;
}

export default function AboutModal({ onClose }: AboutModalProps) {
  return (
    <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-[320px] bg-secondary border border-border-subtle rounded-xl p-4 shadow-2xl text-center space-y-4">
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-accent-cyan via-accent-blue to-accent-purple flex items-center justify-center shadow-lg shadow-accent-blue/20 text-white font-extrabold text-lg tracking-wider mb-2 font-outfit">
            TT
          </div>
          <h3 className="text-sm font-bold text-text-main leading-tight">TokenTracker Desktop</h3>
          <span className="text-[10px] text-text-muted">v0.1.0 (Beta) - Linux client</span>
        </div>

        <p className="text-xs text-text-muted/85 leading-relaxed font-outfit max-w-[260px] mx-auto">
          A cross-platform desktop application for monitoring LLM quota, rate limit, and spend statistics across multiple AI providers.
        </p>

        <button
          onClick={onClose}
          className="w-full py-1.5 bg-bg-subtle hover:bg-hover-subtle text-xs font-semibold rounded-lg text-text-main border border-border-subtle transition-colors cursor-pointer"
        >
          Close
        </button>
      </div>
    </div>
  );
}
