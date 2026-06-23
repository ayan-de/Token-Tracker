"use client";

import { useState } from "react";
import type { ProviderUsage, CostItem } from "@/lib/types";

interface CreditsCostProps {
  provider: ProviderUsage;
  costItem?: CostItem;
}

export default function CreditsCost({ provider: p, costItem }: CreditsCostProps) {
  const [costExpanded, setCostExpanded] = useState(false);

  if (p.unavailable || !costItem) {
    return null;
  }

  return (
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
  );
}
