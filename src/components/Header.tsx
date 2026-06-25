"use client";

import type { BackendStatus } from "@/lib/types";
import StatusBadge from "./StatusBadge";

interface HeaderProps {
  backendStatus: BackendStatus;
  onRefresh: () => void;
  isRefreshing: boolean;
}

export default function Header({ backendStatus, onRefresh, isRefreshing }: HeaderProps) {
  return (
    <header className="flex items-center justify-between px-4 py-3 border-b border-white/5">
      <div className="flex items-center gap-3">
        <h1 className="text-base font-bold bg-gradient-to-r from-accent-cyan to-accent-purple bg-clip-text text-transparent font-outfit">
          CodexBar
        </h1>
        <StatusBadge status={backendStatus} />
      </div>

      <button
        id="refresh-btn"
        onClick={onRefresh}
        disabled={isRefreshing}
        className={`p-1.5 rounded-lg hover:bg-white/5 transition-colors ${
          isRefreshing ? "animate-spin" : ""
        }`}
        title="Refresh data"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="w-4 h-4 text-text-muted"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
      </button>
    </header>
  );
}