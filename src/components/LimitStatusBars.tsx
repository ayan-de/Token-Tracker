"use client";

import { Fragment, memo } from "react";
import type { ProviderUsage } from "@/lib/types";
import { PROVIDER_DESCRIPTORS } from "@/lib/dataMapping";
import { formatTimeUntil, getProviderGradient } from "@/lib/utils";

interface LimitStatusBarsProps {
  provider: ProviderUsage;
  onOpenAddAccountModal: (provider: string) => void;
}

export default memo(function LimitStatusBars({ provider: p, onOpenAddAccountModal }: LimitStatusBarsProps) {
  const desc = PROVIDER_DESCRIPTORS[p.provider.toLowerCase()] || {
    displayName: p.provider_label,
    sessionLabel: "Session",
    weeklyLabel: "Weekly",
  };

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

  if (p.unavailable) {
    return (
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
    );
  }

  return (
    <div className="space-y-0.5">
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
    </div>
  );
});
