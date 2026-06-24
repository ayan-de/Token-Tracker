"use client";

import { Sun, Moon, RefreshCw } from "@/lib/icons";
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
            <Sun className="w-3.5 h-3.5" />
          ) : (
            <Moon className="w-3.5 h-3.5" />
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
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
