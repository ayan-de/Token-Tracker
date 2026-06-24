"use client";

import { memo, useMemo } from "react";
import type { ProviderUsage } from "@/lib/types";
import { PROVIDER_DESCRIPTORS } from "@/lib/dataMapping";
import { getProviderGradient } from "@/lib/utils";

interface LimitLineGraphProps {
  provider: ProviderUsage;
}

// Lightweight custom SVG bar chart - much faster than Chart.js for simple usage display
function LimitLineGraph({ provider: p }: LimitLineGraphProps) {
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
    const result: { label: string; percent: number; colorIndex: number }[] = [];

    if (u.primary) {
      result.push({ label: desc.sessionLabel, percent: u.primary.usedPercent, colorIndex: 0 });
    }
    if (u.secondary) {
      result.push({ label: desc.weeklyLabel, percent: u.secondary.usedPercent, colorIndex: 1 });
    }
    if (u.tertiary && desc.opusLabel) {
      result.push({ label: desc.opusLabel, percent: u.tertiary.usedPercent, colorIndex: 2 });
    }

    return result;
  }, [u, desc]);

  if (bars.length === 0) return null;

  const gradientColors = [
    { start: '#3b82f6', end: '#60a5fa' },  // blue
    { start: '#8b5cf6', end: '#a78bfa' },  // purple
    { start: '#16a7c0', end: '#22d3ee' },  // cyan
  ];

  return (
    <div className="py-2.5 border-b border-border-subtle">
      <div className="text-xs font-semibold text-text-main mb-3">Usage Overview</div>
      <div className="space-y-3">
        {bars.map((bar, i) => (
          <div key={bar.label} className="flex items-center gap-3">
            <span className="text-[10px] text-text-muted w-16 truncate">{bar.label}</span>
            <div className="flex-1 h-2 bg-bg-subtle rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(Math.max(bar.percent, 0), 100)}%`,
                  background: `linear-gradient(90deg, ${gradientColors[bar.colorIndex].start}, ${gradientColors[bar.colorIndex].end})`,
                }}
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
