"use client";

import { memo, useState, useMemo, useCallback } from "react";
import type { ProviderUsage, NamedRateWindow } from "@/lib/types";
import { providerLogo, PROVIDER_DESCRIPTORS } from "@/lib/dataMapping";
import { formatTimeUntil } from "@/lib/utils";
import ProviderSubTabBar, { type SubTab } from "./ProviderSubTabBar";
import { useTheme } from "@/app/page";

interface OpenCodeDetailProps {
  provider: ProviderUsage;
}

interface SubTabData {
  id: string;
  label: string;
  /** Windows from the provider's API (real-time) */
  realTimeWindows: NamedRateWindow[];
  /** Windows from OpenCode's local DB (historical) */
  dbWindows: NamedRateWindow[];
}

/** Extract sub-tab ID from an extraRateWindow ID.
 * Window ID formats:
 * - "opencode-{service_id}"             → tabId = service_id (real-time primary)
 * - "opencode-{service_id}-weekly"      → tabId = service_id (real-time secondary)
 * - "opencode-{service_id}-model"       → tabId = service_id (real-time model-specific)
 * - "opencode-db-{provider_id}-{idx}"   → tabId = provider_id (DB model row)
 * - "opencode-db-summary-{provider_id}" → tabId = provider_id (DB provider total)
 * - other → null (not a sub-tab window)
 */
function extractSubTabId(windowId: string): { tabId: string; tabLabel: string; isDb: boolean } | null {
  if (!windowId.startsWith("opencode-")) return null;

  const rest = windowId.slice("opencode-".length);

  // DB windows: opencode-db-{provider_id}-... or opencode-db-summary-{provider_id}
  if (rest.startsWith("db-summary-")) {
    const provider = rest.slice("db-summary-".length);
    return { tabId: provider, tabLabel: provider.charAt(0).toUpperCase() + provider.slice(1), isDb: true };
  }
  if (rest.startsWith("db-")) {
    // opencode-db-{provider_id}-{idx}
    const dbRest = rest.slice("db-".length);
    // provider_id is the prefix before the first '-' that separates it from the numeric idx
    const firstDash = dbRest.indexOf("-");
    if (firstDash === -1) return null;
    const provider = dbRest.slice(0, firstDash);
    return { tabId: provider, tabLabel: provider.charAt(0).toUpperCase() + provider.slice(1), isDb: true };
  }

  // Real-time windows: opencode-{service_id}...
  // tabId = first segment (e.g. "minimax" from "opencode-minimax" or "opencode-minimax-weekly")
  const firstDash = rest.indexOf("-");
  const serviceId = firstDash === -1 ? rest : rest.slice(0, firstDash);
  return { tabId: serviceId, tabLabel: serviceId.charAt(0).toUpperCase() + serviceId.slice(1), isDb: false };
}

/** Derive the primary usedPercent for a tab from its real-time windows */
function tabUsedPercent(windows: NamedRateWindow[]): number | undefined {
  // Use the first window with a valid usedPercent
  for (const w of windows) {
    if (w.window.usedPercent > 0) return w.window.usedPercent;
  }
  return undefined;
}

export default memo(function OpenCodeDetail({ provider }: OpenCodeDetailProps) {
  const { theme } = useTheme();
  const [selectedTab, setSelectedTab] = useState<string | null>(null);

  // Build sub-tab data from extraRateWindows
  const { tabs, subTabMap } = useMemo(() => {
    const windows = provider.usage?.extraRateWindows || [];
    const tabMap = new Map<string, SubTabData>();

    for (const w of windows) {
      const parsed = extractSubTabId(w.id);
      if (!parsed) continue;

      if (!tabMap.has(parsed.tabId)) {
        tabMap.set(parsed.tabId, {
          id: parsed.tabId,
          label: parsed.tabLabel,
          realTimeWindows: [],
          dbWindows: [],
        });
      }

      const entry = tabMap.get(parsed.tabId)!;
      if (parsed.isDb) {
        entry.dbWindows.push(w);
      } else {
        entry.realTimeWindows.push(w);
      }
    }

    const tabs: SubTab[] = Array.from(tabMap.values())
      .map((t) => ({
        id: t.id,
        label: t.label,
        usedPercent: tabUsedPercent(t.realTimeWindows),
      }))
      .sort((a, b) => a.label.localeCompare(b.label));

    return { tabs, subTabMap: tabMap };
  }, [provider.usage?.extraRateWindows]);

  // Auto-select first tab
  const activeTabId = selectedTab ?? tabs[0]?.id ?? null;

  // Auto-select first available tab when tabs change
  const handleSelectTab = useCallback((id: string) => {
    setSelectedTab(id);
  }, []);

  const activeTab = activeTabId ? subTabMap.get(activeTabId) : null;

  // Count total provider windows (for badge)
  const providerCount = tabs.length;

  const logoUrl = providerLogo("opencode", theme);

  // Build a "configure" message for sub-tabs with no real-time data
  const renderWindowRow = (w: NamedRateWindow) => {
    const pct = w.window.usedPercent;
    const resetsIn = w.window.resetsAt
      ? formatTimeUntil(w.window.resetsAt)
      : null;
    const fillPercent = Math.min(Math.max(pct || 0, 0), 100);

    return (
      <div key={w.id} className="py-2 border-b border-border-subtle space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-text-main">{w.title}</span>
          <span className="text-[11px] text-text-muted">{pct > 0 ? `${pct.toFixed(1)}%` : "—"}</span>
        </div>
        {pct > 0 && (
          <div className="h-1 w-full bg-bg-subtle rounded-full overflow-hidden">
            <div
              className="h-full bg-accent-blue rounded-full transition-all"
              style={{ width: `${fillPercent}%` }}
            />
          </div>
        )}
        {resetsIn && (
          <div className="text-[10px] text-text-muted/70">Resets {resetsIn}</div>
        )}
        {w.window.resetDescription && !resetsIn && (
          <div className="text-[10px] text-text-muted/70">{w.window.resetDescription}</div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* OpenCode Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
        <div className="flex items-center gap-3">
          {logoUrl && (
            <img src={logoUrl} alt="" className="w-8 h-8 object-contain" />
          )}
          <div className="flex flex-col">
            <h2 className="text-base font-bold text-text-main leading-tight flex items-center gap-2">
              OpenCode
              {providerCount > 0 && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-sm bg-accent-blue/20 text-accent-blue border border-accent-blue/20">
                  {providerCount} provider{providerCount !== 1 ? "s" : ""} found
                </span>
              )}
            </h2>
            <span className="text-[11px] text-text-muted/75">
              BYOK aggregator — usage via each provider&apos;s API
            </span>
          </div>
        </div>
      </div>

      {/* Nested Sub-Tab Bar */}
      {tabs.length > 0 && (
        <ProviderSubTabBar
          tabs={tabs}
          selectedTab={activeTabId}
          onSelectTab={handleSelectTab}
        />
      )}

      {/* Sub-Tab Content */}
      <div className="flex-1 overflow-y-auto px-4 py-2">
        {activeTab ? (
          <div className="space-y-4">
            {/* Real-time usage from provider APIs */}
            {activeTab.realTimeWindows.length > 0 && (
              <div>
                <h3 className="text-[11px] font-semibold text-text-muted/80 uppercase tracking-wider mb-1">
                  Real-time
                </h3>
                <div className="space-y-0">
                  {activeTab.realTimeWindows.map(renderWindowRow)}
                </div>
              </div>
            )}

            {/* OpenCode local DB tracked history */}
            {activeTab.dbWindows.length > 0 && (
              <div>
                <h3 className="text-[11px] font-semibold text-text-muted/80 uppercase tracking-wider mb-1">
                  OpenCode Tracked History
                </h3>
                <div className="space-y-0">
                  {activeTab.dbWindows.map(renderWindowRow)}
                </div>
              </div>
            )}

            {/* No real-time data — prompt to configure */}
            {activeTab.realTimeWindows.length === 0 && activeTab.dbWindows.length === 0 && (
              <div className="py-8 flex flex-col items-center justify-center text-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 text-text-muted/40 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.582.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="text-xs font-semibold text-text-main mb-1">{activeTab.label}</span>
                <span className="text-[11px] text-text-muted max-w-[240px]">
                  Configure this provider in CodexBar settings to see real-time usage.
                </span>
              </div>
            )}
          </div>
        ) : (
          /* No sub-tabs at all */
          <div className="py-12 flex flex-col items-center justify-center text-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-text-muted/30 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m6 4.125l2.25 2.25m0 0l2.25 2.25M12 13.875l2.25-2.25M12 13.875l-2.25 2.25M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
            </svg>
            <span className="text-xs font-semibold text-text-main mb-1">No Providers Found</span>
            <span className="text-[11px] text-text-muted max-w-[260px]">
              OpenCode is installed but no providers are configured. Add API keys in OpenCode settings.
            </span>
          </div>
        )}
      </div>
    </div>
  );
});
