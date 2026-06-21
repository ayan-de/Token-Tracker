"use client";

import type { ProviderUsage } from "@/lib/types";
import { formatTimeUntil, formatPacingStage, escapeHtml, getProviderGradient } from "@/lib/utils";
import ProgressBar from "./ProgressBar";

function pacingBadgeClass(stage: string): string {
  const map: Record<string, string> = {
    onTrack: "bg-status-ok/10 text-status-ok border border-status-ok/20",
    ahead: "bg-status-ok/10 text-status-ok border border-status-ok/20",
    farAhead: "bg-accent-cyan/10 text-accent-cyan border border-accent-cyan/20",
    behind: "bg-status-warning/10 text-status-warning border border-status-warning/20",
    farBehind: "bg-status-danger/10 text-status-danger border border-status-danger/20",
    stale: "bg-gray-500/10 text-gray-400 border border-gray-500/20",
    unavailable: "bg-gray-500/10 text-gray-400 border border-gray-500/20",
  };
  return map[stage] ?? map.onTrack;
}

interface ProviderCardProps {
  provider: ProviderUsage;
}

export default function ProviderCard({ provider: p }: ProviderCardProps) {
  const resetsIn = formatTimeUntil(p.resets_at);
  const fillPercent = Math.min(Math.max(p.percentage || 0, 0), 100);

  const pacingStage = p.pacing?.stage || "onTrack";
  const labelText = p.status_message
    ? p.status_message
    : p.used != null && p.limit != null
      ? `${Number(p.used).toLocaleString()} / ${Number(p.limit).toLocaleString()} ${p.unit}`
      : `${fillPercent.toFixed(1)}% used`;

  const lastSuccessful = p.last_successful_at
    ? new Date(p.last_successful_at * 1000).toLocaleString()
    : null;

  const statusDetail =
    p.stale && p.error_message ? (
      <div className="provider-status stale text-xs text-status-warning mt-1">
        Last update failed
        {lastSuccessful ? `; showing data from ${escapeHtml(lastSuccessful)}` : ""}
        . {escapeHtml(p.error_message)}
      </div>
    ) : p.unavailable && p.error_message ? (
      <div className="provider-status unavailable text-xs text-text-muted mt-1">
        {escapeHtml(p.error_message)}
      </div>
    ) : null;

  return (
    <div
      className={`provider-card p-3 rounded-xl bg-secondary/60 backdrop-blur-md border border-white/5 ${
        p.stale ? "opacity-70" : ""
      } ${p.unavailable ? "opacity-60" : ""}`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div
            className={`w-7 h-7 rounded-lg bg-gradient-to-br ${getProviderGradient(
              p.provider
            )} flex items-center justify-center text-white text-xs font-bold font-fira`}
          >
            {escapeHtml(p.provider.substring(0, 2))}
          </div>
          <span className="text-sm font-medium text-text-main">
            {escapeHtml(p.provider_label)}
          </span>
        </div>
        {p.stale ? (
          <span className={`text-xs px-1.5 py-0.5 rounded-md ${pacingBadgeClass("stale")}`}>
            Stale
          </span>
        ) : p.unavailable ? (
          <span className={`text-xs px-1.5 py-0.5 rounded-md ${pacingBadgeClass("unavailable")}`}>
            Unavailable
          </span>
        ) : (
          <span className={`text-xs px-1.5 py-0.5 rounded-md ${pacingBadgeClass(pacingStage)}`}>
            {escapeHtml(formatPacingStage(pacingStage))}
          </span>
        )}
      </div>

      <ProgressBar percent={fillPercent} />

      <div className="flex items-center justify-between mt-1.5">
        <span className="text-xs text-text-muted">{escapeHtml(labelText)}</span>
        {resetsIn && (
          <span className="flex items-center gap-1 text-xs text-text-muted">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-3 h-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            resets in {resetsIn}
          </span>
        )}
      </div>

      {statusDetail}
    </div>
  );
}