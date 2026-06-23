"use client";

import type { CliStatus } from "@/lib/types";

interface ProviderHeaderProps {
  cliStatus: CliStatus;
  isRefreshing: boolean;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onRefresh: () => void;
}

export default function ProviderHeader({
  cliStatus,
  isRefreshing,
  theme,
  onToggleTheme,
  onRefresh,
}: ProviderHeaderProps) {
  return (
    <div className="flex items-center justify-between px-4 pt-3 pb-1 border-b border-border-subtle bg-secondary/20 backdrop-blur-sm">
      <div className="flex items-center gap-2">
        <h1 className="text-xs font-black tracking-wider bg-gradient-to-r from-accent-cyan via-accent-blue to-accent-purple bg-clip-text text-transparent font-outfit uppercase">
          TokenTracker
        </h1>
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            cliStatus.status === "available" ? "bg-status-ok" : "bg-status-warning"
          } animate-pulse`}
          title={cliStatus.status === "available" ? "Backend Connected" : "Connecting..."}
        />
      </div>

      <div className="flex items-center gap-1.5">
        {/* Theme Mode Toggle Button */}
        <button
          onClick={onToggleTheme}
          className="p-1 rounded-lg bg-bg-subtle hover:bg-hover-subtle text-text-muted hover:text-text-main transition-all cursor-pointer border-0 outline-none focus:outline-none focus:bg-bg-subtle focus:text-text-main"
          title={theme === 'dark' ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
          {theme === 'dark' ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m12.728 12.728l.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          )}
        </button>

        {/* Refresh Button */}
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className={`p-1 rounded-lg bg-bg-subtle hover:bg-hover-subtle text-text-muted hover:text-text-main transition-all cursor-pointer border-0 outline-none focus:outline-none focus:bg-bg-subtle focus:text-text-main ${
            isRefreshing ? "animate-spin text-accent-blue" : ""
          }`}
          title="Refresh AI quotas"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>
    </div>
  );
}
