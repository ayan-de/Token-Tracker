"use client";

import { memo, useMemo } from "react";
import type { NamedRateWindow } from "@/lib/types";
import { getProviderGradient } from "@/lib/utils";

interface ModelRow {
  modelName: string;
  sessions: number;
  tokens: number;
  cost: number;
}

interface ProviderDBGroup {
  providerId: string;
  label: string;
  modelRows: ModelRow[];
  totalSessions: number;
  totalTokens: number;
  totalCost: number;
}

interface GrandTotal {
  totalSessions: number;
  totalTokens: number;
  totalCost: number;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatCost(n: number): string {
  return `$${n.toFixed(n < 1 ? 4 : 2)}`;
}

/** Parse "X sessions | Y tokens | $Z" from resetDescription */
function parseStats(desc: string | null | undefined): { sessions: number; tokens: number; cost: number } {
  if (!desc) return { sessions: 0, tokens: 0, cost: 0 };
  const parts = desc.split("|").map((p) => p.trim());
  let sessions = 0, tokens = 0, cost = 0;
  for (const p of parts) {
    const s = p.match(/^(\d+)\s*sessions?/i);
    if (s) { sessions = parseInt(s[1], 10); continue; }
    const t = p.match(/^([\d,]+)\s*tokens?/i);
    if (t) { tokens = parseInt(t[1].replace(/,/g, ""), 10); continue; }
    const c = p.match(/^\$?([\d.]+)/);
    if (c) { cost = parseFloat(c[1]); }
  }
  return { sessions, tokens, cost };
}

/** Extract model name from title like "  MiniMax-M2.7 — 54 sessions, 5.04M tokens, $10.06"
 *  or from title like "gpt-5.5 — 2 sessions, 280.7K tokens, $1.4766" */
function parseModelName(title: string): string {
  // Strip leading spaces and "  " prefix from backend formatting
  const t = title.trim();
  // Format: "modelName — X sessions, Y tokens, $Z"
  const dashIdx = t.lastIndexOf(" — ");
  if (dashIdx === -1) return t;
  return t.slice(0, dashIdx).trim();
}

/** Extract provider ID from a DB window ID:
 *  - "opencode-db-{provider}-{idx}"  → provider
 *  - "opencode-db-summary-{provider}" → provider
 */
function extractProviderId(windowId: string): { providerId: string; isSummary: boolean } | null {
  if (!windowId.startsWith("opencode-db-")) return null;

  const rest = windowId.slice("opencode-db-".length);

  if (rest.startsWith("summary-")) {
    return { providerId: rest.slice("summary-".length), isSummary: true };
  }

  // opencode-db-{provider}-{idx} — split at last dash
  const lastDash = rest.lastIndexOf("-");
  if (lastDash === -1) return null;
  return { providerId: rest.slice(0, lastDash), isSummary: false };
}

/** Normalize provider ID to display label */
function providerLabel(id: string): string {
  return id.charAt(0).toUpperCase() + id.slice(1);
}

interface OpenCodeDBHistoryProps {
  /** All extraRateWindows from OpenCode's usage data */
  windows: NamedRateWindow[];
}

export default memo(function OpenCodeDBHistory({ windows }: OpenCodeDBHistoryProps) {
  const { groups, grandTotal } = useMemo(() => {
    const groupMap = new Map<string, ProviderDBGroup>();
    let grandSessions = 0, grandTokens = 0, grandCost = 0;

    for (const w of windows) {
      const parsed = extractProviderId(w.id);
      if (!parsed) continue;

      const { providerId, isSummary } = parsed;
      const stats = parseStats(w.window.resetDescription);

      if (!groupMap.has(providerId)) {
        groupMap.set(providerId, {
          providerId,
          label: providerLabel(providerId),
          modelRows: [],
          totalSessions: 0,
          totalTokens: 0,
          totalCost: 0,
        });
      }

      const group = groupMap.get(providerId)!;

      if (isSummary) {
        // Use summary window stats as provider totals
        group.totalSessions = stats.sessions;
        group.totalTokens = stats.tokens;
        group.totalCost = stats.cost;
      } else {
        // Model row
        const modelName = parseModelName(w.title);
        group.modelRows.push({
          modelName,
          sessions: stats.sessions,
          tokens: stats.tokens,
          cost: stats.cost,
        });
        // Accumulate for grand total
        grandSessions += stats.sessions;
        grandTokens += stats.tokens;
        grandCost += stats.cost;
      }
    }

    const groups = Array.from(groupMap.values()).sort((a, b) => b.totalCost - a.totalCost);
    const grandTotal: GrandTotal = { totalSessions: grandSessions, totalTokens: grandTokens, totalCost: grandCost };

    return { groups, grandTotal };
  }, [windows]);

  if (groups.length === 0) return null;

  const gradient = getProviderGradient("opencode");

  return (
    <div className="space-y-4">
      {/* Grand total metric grid */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-bg-subtle rounded-lg px-3 py-2">
          <div className="text-[10px] uppercase tracking-wider text-text-muted/70 mb-0.5">Sessions</div>
          <div className="text-base font-semibold text-text-main">{grandTotal.totalSessions}</div>
        </div>
        <div className="bg-bg-subtle rounded-lg px-3 py-2">
          <div className="text-[10px] uppercase tracking-wider text-text-muted/70 mb-0.5">Tokens</div>
          <div className="text-base font-semibold text-text-main">{formatTokens(grandTotal.totalTokens)}</div>
        </div>
        <div className="bg-bg-subtle rounded-lg px-3 py-2">
          <div className="text-[10px] uppercase tracking-wider text-text-muted/70 mb-0.5">Total cost</div>
          <div className="text-base font-semibold text-text-main">{formatCost(grandTotal.totalCost)}</div>
        </div>
      </div>

      {/* Per-provider cards */}
      {groups.map((group) => (
        <div key={group.providerId} className="bg-bg-subtle/60 border border-border-subtle rounded-xl px-4 py-3">
          {/* Provider header */}
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-sm font-semibold text-text-main">{group.label}</div>
              <div className="text-[11px] text-text-muted/70">{group.modelRows.length} model{group.modelRows.length !== 1 ? "s" : ""} tracked</div>
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold text-text-main">{formatCost(group.totalCost)}</div>
              <div className="text-[11px] text-text-muted/70">{group.totalSessions} sessions</div>
            </div>
          </div>

          {/* Model rows */}
          <div className="space-y-0">
            {group.modelRows.map((model, idx) => {
              const pct = group.totalCost > 0 ? (model.cost / group.totalCost) * 100 : 0;
              return (
                <div key={idx} className="flex items-start justify-between py-2.5 border-t border-border-subtle/50 first:border-t-0">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-text-main font-mono">{model.modelName}</div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-[10px] text-text-muted/70 flex items-center gap-1">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9 6h9m-9 3h.01M9 21h.01M15 21h.01M5.25 12h16.5M5.25 9h16.5M5.25 15h16.5" />
                        </svg>
                        {model.sessions} sessions
                      </span>
                      <span className="text-[10px] text-text-muted/70 flex items-center gap-1">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
                        </svg>
                        {formatTokens(model.tokens)} tokens
                      </span>
                    </div>
                    {/* Sparkbar */}
                    <div className="h-0.5 w-20 bg-border-subtle rounded-full overflow-hidden mt-1.5">
                      <div
                        className={`h-full bg-gradient-to-r ${gradient} rounded-full`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                  <div className="ml-3 text-right flex-shrink-0">
                    <div className="text-xs font-semibold text-text-main">{formatCost(model.cost)}</div>
                    <div className="text-[10px] text-text-muted/70">{pct.toFixed(1)}% of cost</div>
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      ))}
    </div>
  );
});
