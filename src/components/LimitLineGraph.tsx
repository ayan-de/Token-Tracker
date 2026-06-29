"use client";

import { memo, useMemo } from "react";
import type { ProviderUsage } from "@/lib/types";
import { PROVIDER_DESCRIPTORS, providerLogo } from "@/lib/dataMapping";
import { getProviderGradient } from "@/lib/utils";
import { useTheme } from "@/app/page";

interface LimitLineGraphProps {
  provider: ProviderUsage;
}

// Lightweight custom SVG bar chart - much faster than Chart.js for simple usage display
function LimitLineGraph({ provider: p }: LimitLineGraphProps) {
  const { theme } = useTheme();
  const logo = providerLogo(p.provider, theme);
  const gradient = getProviderGradient(p.provider);
  const desc = PROVIDER_DESCRIPTORS[p.provider.toLowerCase()] || {
    displayName: p.provider_label,
    sessionLabel: "Session",
    weeklyLabel: "Weekly",
    opusLabel: null,
  };

  const u = p.usage;
  if (!u) return null;

  // Build chart data
  const bars = useMemo(() => {
    const result: { label: string; percent: number }[] = [];

    if (u.primary) {
      result.push({ label: desc.sessionLabel, percent: u.primary.usedPercent });
    }
    if (u.secondary) {
      result.push({ label: desc.weeklyLabel, percent: u.secondary.usedPercent });
    }
    if (u.tertiary && desc.opusLabel) {
      result.push({ label: desc.opusLabel, percent: u.tertiary.usedPercent });
    }

    return result;
  }, [u, desc]);

  if (bars.length === 0) return null;

  return (
    <div className="py-2.5 border-b border-border-subtle">
      <div className="flex items-center gap-2 text-xs font-semibold text-text-main mb-3">
        {logo ? (
          <img src={logo} alt="" className="w-4 h-4 object-contain shrink-0" />
        ) : (
          <span className={`w-2.5 h-2.5 rounded-full bg-gradient-to-r ${gradient} shrink-0`} />
        )}
        <span>Usage Overview</span>
      </div>
      <div className="space-y-3">
        {bars.map((bar) => (
          <div key={bar.label} className="flex items-center gap-3">
            <span className="text-[10px] text-text-muted w-16 truncate">{bar.label}</span>
            <div className="flex-1 h-2 bg-bg-subtle rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full bg-gradient-to-r ${gradient} transition-all duration-500`}
                style={{ width: `${Math.min(Math.max(bar.percent, 0), 100)}%` }}
              />
            </div>
            <span className="text-[10px] text-text-muted w-10 text-right">
              {bar.percent.toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default memo(LimitLineGraph);
