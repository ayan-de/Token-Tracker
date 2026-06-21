"use client";

import type { CostItem } from "@/lib/types";

interface CostCardProps {
  costData: CostItem[];
}

export default function CostCard({ costData }: CostCardProps) {
  if (!costData || costData.length === 0) {
    return (
      <div className="cost-card p-3 rounded-xl bg-secondary/60 backdrop-blur-md border border-white/5">
        <div className="text-center py-4 text-text-muted text-xs">
          No cost summaries available.
        </div>
      </div>
    );
  }

  let total30dUSD = 0;
  const allModels: Array<{ modelName: string; costUSD: number }> = [];

  costData.forEach((c) => {
    total30dUSD += c.last30DaysCostUSD || 0;
    if (c.modelBreakdowns) {
      allModels.push(...c.modelBreakdowns);
    }
  });

  allModels.sort((a, b) => (b.costUSD || 0) - (a.costUSD || 0));
  const topModels = allModels.slice(0, 3);

  return (
    <div className="cost-card p-3 rounded-xl bg-secondary/60 backdrop-blur-md border border-white/5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-text-muted">Total Spend</span>
        <span className="text-sm font-semibold text-text-main font-fira">
          ${total30dUSD.toFixed(2)}
        </span>
      </div>

      {topModels.length > 0 && (
        <div className="space-y-1">
          {topModels.map((m) => (
            <div key={m.modelName} className="flex items-center justify-between">
              <span className="text-xs text-text-muted truncate max-w-[160px] font-fira">
                {m.modelName}
              </span>
              <span className="text-xs text-text-main font-fira ml-2">
                ${(m.costUSD || 0).toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}