"use client";

import { useState, Fragment } from "react";
import type { ProviderUsage, CostItem } from "@/lib/types";
import { PROVIDER_DESCRIPTORS, providerLogo } from "@/lib/dataMapping";
import { formatTimeUntil, getProviderGradient } from "@/lib/utils";
import { invoke } from "@tauri-apps/api/core";

export const PROVIDER_URLS: Record<string, { dashboard: string; statusPage: string }> = {
  claude: { dashboard: "https://claude.ai/settings/usage", statusPage: "https://status.claude.com/" },
  gemini: { dashboard: "https://aistudio.google.com/", statusPage: "https://status.cloud.google.com/" },
  antigravity: { dashboard: "https://aistudio.google.com/", statusPage: "https://status.cloud.google.com/" },
  codex: { dashboard: "https://platform.openai.com/usage", statusPage: "https://status.openai.com/" },
  cursor: { dashboard: "https://www.cursor.com/settings", statusPage: "https://status.cursor.com/" },
  copilot: { dashboard: "https://github.com/settings/copilot", statusPage: "https://www.githubstatus.com/" },
  openrouter: { dashboard: "https://openrouter.ai/activity", statusPage: "https://status.openrouter.ai/" },
  deepseek: { dashboard: "https://platform.deepseek.com/usage", statusPage: "https://status.deepseek.com/" },
  groq: { dashboard: "https://console.groq.com/usage", statusPage: "https://status.groq.com/" },
  ollama: { dashboard: "http://localhost:11434/", statusPage: "https://github.com/ollama/ollama" },
};

interface ProviderDetailProps {
  provider: ProviderUsage;
  costItem?: CostItem;
  theme: 'dark' | 'light';
  onOpenAddAccountModal: (provider: string) => void;
  onOpenSettingsModal: () => void;
  onOpenAboutModal: () => void;
}

function formatRelativeTime(sec: number | null | undefined): string {
  if (!sec) return "Updated recently";
  const now = Math.floor(Date.now() / 1000);
  const diff = now - sec;
  if (diff < 10) return "Updated just now";
  if (diff < 60) return `Updated ${diff}s ago`;
  const mins = Math.floor(diff / 60);
  if (mins < 60) return `Updated ${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Updated ${hrs}h ago`;
  return `Updated on ${new Date(sec * 1000).toLocaleDateString()}`;
}

export default function ProviderDetail({
  provider: p,
  costItem,
  theme,
  onOpenAddAccountModal,
  onOpenSettingsModal,
  onOpenAboutModal,
}: ProviderDetailProps) {
  const [costExpanded, setCostExpanded] = useState(false);
  const desc = PROVIDER_DESCRIPTORS[p.provider.toLowerCase()] || {
    displayName: p.provider_label,
    sessionLabel: "Session",
    weeklyLabel: "Weekly",
  };

  const urls = PROVIDER_URLS[p.provider.toLowerCase()] || {
    dashboard: "https://github.com/steipete/CodexBar",
    statusPage: "https://github.com/steipete/CodexBar",
  };

  const handleOpenUrl = async (url: string) => {
    try {
      await invoke("plugin:opener|open", { path: url });
    } catch (err) {
      console.error("Failed to open URL via Tauri:", err);
    }
  };

  const handleQuit = async () => {
    try {
      await invoke("quit_app");
    } catch (err) {
      console.error("Failed to quit app:", err);
    }
  };

  const lastUpdatedText = formatRelativeTime(p.last_successful_at);
  const u = p.usage;

  const renderProgressRow = (
    title: string,
    percent: number,
    resetsAt: string | null | undefined,
    resetDesc: string | null | undefined,
    used: number | null | undefined,
    limit: number | null | undefined,
    unit: string | null | undefined,
    extraLabel?: string
  ) => {
    const fillPercent = Math.min(Math.max(percent || 0, 0), 100);
    const resetsIn = formatTimeUntil(resetsAt ?? null);
    
    // Status text underneath progress bar
    let statusLeft = `${fillPercent.toFixed(0)}% used`;
    if (used !== undefined && limit !== undefined && used !== null && limit !== null) {
      statusLeft = `${used.toLocaleString()} / ${limit.toLocaleString()} ${unit || "requests"}`;
    }
    
    let statusRight = resetDesc || "";
    if (!statusRight && resetsIn) {
      statusRight = `Resets in ${resetsIn}`;
    }

    return (
      <div className="py-2.5 border-b border-border-subtle space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-text-main font-outfit">{title}</span>
        </div>
        
        {/* Sleek, thin progress bar */}
        <div className="h-1.5 w-full bg-bg-subtle rounded-full overflow-hidden">
          <div
            className={`h-full bg-gradient-to-r ${getProviderGradient(p.provider)} rounded-full transition-all duration-500`}
            style={{ width: `${fillPercent}%` }}
          />
        </div>
        
        <div className="flex items-center justify-between text-[11px] text-text-muted">
          <span>{statusLeft}</span>
          <span>{statusRight}</span>
        </div>
        {extraLabel && (
          <div className="text-[11px] text-text-muted/65 italic pt-0.5">
            {extraLabel}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col flex-1 overflow-y-auto px-4 py-2 font-outfit">
      
      {/* Provider General Header */}
      <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
        <div className="flex items-center gap-3">
          {providerLogo(p.provider, theme) && (
            <img src={providerLogo(p.provider, theme)} alt="" className="w-8 h-8 object-contain" />
          )}
          <div className="flex flex-col">
            <h2 className="text-lg font-bold text-text-main leading-tight">{desc.displayName}</h2>
            <span className="text-[11px] text-text-muted/75">{lastUpdatedText}</span>
          </div>
        </div>
        {u?.loginMethod && (
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-bg-subtle text-text-main border border-border-subtle">
            {u.loginMethod}
          </span>
        )}
      </div>

      {/* Quotas & Rates List */}
      <div className="flex-1 min-h-0 space-y-0.5">
        {p.unavailable ? (
          <div className="py-8 flex flex-col items-center justify-center text-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-status-warning/70 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="text-xs font-semibold text-text-main mb-1">Provider Not Configured</span>
            <span className="text-[11px] text-text-muted max-w-[240px]">
              {p.error_message || "Set up active credentials to view usage stats."}
            </span>
            <button
              onClick={() => onOpenAddAccountModal(p.provider)}
              className="mt-3 px-3 py-1 bg-accent-blue/15 text-accent-blue hover:bg-accent-blue/25 text-xs font-medium rounded-lg border border-accent-blue/20 transition-all cursor-pointer focus:bg-accent-blue/25 focus:text-accent-blue focus:outline-none"
            >
              Add Account...
            </button>
          </div>
        ) : (
          <>
            {/* Primary quota (Session) */}
            {u?.primary && renderProgressRow(
              desc.sessionLabel,
              u.primary.usedPercent,
              u.primary.resetsAt,
              u.primary.resetDescription,
              u.primary.used,
              u.primary.limit,
              u.primary.unit,
              u.primary.pacing?.stage && u.primary.pacing.stage !== "onTrack" ? `Pace: ${u.primary.pacing.stage}` : undefined
            )}

            {/* Secondary quota (Weekly) */}
            {u?.secondary && renderProgressRow(
              desc.weeklyLabel,
              u.secondary.usedPercent,
              u.secondary.resetsAt,
              u.secondary.resetDescription,
              u.secondary.used,
              u.secondary.limit,
              u.secondary.unit,
              u.secondary.pacing?.stage && u.secondary.pacing.stage !== "onTrack" ? `Pace: ${u.secondary.pacing.stage}` : undefined
            )}

            {/* Tertiary quota (Sonnet / Flash / etc.) */}
            {u?.tertiary && desc.opusLabel && renderProgressRow(
              desc.opusLabel,
              u.tertiary.usedPercent,
              u.tertiary.resetsAt,
              u.tertiary.resetDescription,
              u.tertiary.used,
              u.tertiary.limit,
              u.tertiary.unit
            )}

            {/* Extra named windows */}
            {u?.extraRateWindows?.map((ew) => (
              <Fragment key={ew.title}>
                {renderProgressRow(
                  ew.title,
                  ew.window.usedPercent,
                  ew.window.resetsAt,
                  ew.window.resetDescription,
                  ew.window.used,
                  ew.window.limit,
                  ew.window.unit
                )}
              </Fragment>
            ))}

            {/* Extra Usage (Spend Limit / providerCost) */}
            {u?.providerCost && renderProgressRow(
              u.providerCost.period || "Extra usage",
              u.providerCost.limit > 0 ? (u.providerCost.used / u.providerCost.limit) * 100 : 0,
              u.providerCost.resetsAt,
              null,
              null,
              null,
              null,
              `This month: $${u.providerCost.used.toFixed(2)} / $${u.providerCost.limit.toFixed(2)}`
            )}
          </>
        )}
      </div>

      {/* Cost Row (Collapsible) */}
      {!p.unavailable && costItem && (
        <div className="py-2.5 border-b border-border-subtle">
          <button
            onClick={() => setCostExpanded(!costExpanded)}
            className="w-full flex items-center justify-between group hover:text-text-main transition-colors text-left cursor-pointer focus:bg-transparent focus:outline-none"
          >
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-text-main group-hover:text-accent-blue transition-colors">Cost</span>
              <span className="text-[10px] text-text-muted mt-0.5">
                Today: ${(costItem.totalCostUSD || 0).toFixed(2)} · Last 30d: ${(costItem.last30DaysCostUSD || 0).toFixed(2)}
              </span>
            </div>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className={`w-3.5 h-3.5 text-text-muted transition-transform duration-300 ${
                costExpanded ? "rotate-90 text-accent-blue" : ""
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
          
          {/* Models Breakdown Dropdown */}
          {costExpanded && costItem.modelBreakdowns && costItem.modelBreakdowns.length > 0 && (
            <div className="mt-2 pl-1 space-y-1 border-l border-border-subtle animate-fadeIn">
              {costItem.modelBreakdowns.map((m) => (
                <div key={m.modelName} className="flex items-center justify-between text-[11px]">
                  <span className="text-text-muted truncate max-w-[200px] font-fira">{m.modelName}</span>
                  <span className="text-text-main/80 font-fira">${(m.costUSD || 0).toFixed(4)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Menu / Links Action Area */}
      <div className="py-2 space-y-1 text-xs">
        
        {/* Add Account... */}
        <button
          onClick={() => onOpenAddAccountModal(p.provider)}
          className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-hover-subtle text-text-muted hover:text-text-main transition-all text-left cursor-pointer focus:bg-hover-subtle focus:text-text-main focus:outline-none"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
          <span>Add Account...</span>
        </button>

        {/* Usage Dashboard */}
        <button
          onClick={() => handleOpenUrl(urls.dashboard)}
          className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-hover-subtle text-text-muted hover:text-text-main transition-all text-left cursor-pointer focus:bg-hover-subtle focus:text-text-main focus:outline-none"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <span>Usage Dashboard</span>
        </button>

        {/* Status Page */}
        <button
          onClick={() => handleOpenUrl(urls.statusPage)}
          className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-hover-subtle text-text-muted hover:text-text-main transition-all text-left cursor-pointer focus:bg-hover-subtle focus:text-text-main focus:outline-none"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
          <span>Status Page</span>
        </button>

        <div className="h-px bg-border-subtle my-1.5" />

        {/* Settings... */}
        <button
          onClick={onOpenSettingsModal}
          className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-hover-subtle text-text-muted hover:text-text-main transition-all text-left cursor-pointer focus:bg-hover-subtle focus:text-text-main focus:outline-none"
        >
          <span>Settings...</span>
        </button>

        {/* About TokenTracker */}
        <button
          onClick={onOpenAboutModal}
          className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-hover-subtle text-text-muted hover:text-text-main transition-all text-left cursor-pointer focus:bg-hover-subtle focus:text-text-main focus:outline-none"
        >
          <span>About TokenTracker</span>
        </button>

        {/* Quit */}
        <button
          onClick={handleQuit}
          className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-hover-subtle text-text-muted hover:text-status-danger transition-all text-left cursor-pointer focus:bg-hover-subtle focus:text-status-danger focus:outline-none"
        >
          <span>Quit</span>
        </button>
      </div>

    </div>
  );
}
