"use client";

import { useCodexBar } from "@/hooks/useCodexBar";
import Header from "@/components/Header";
import ErrorBanner from "@/components/ErrorBanner";
import ProviderCard from "@/components/ProviderCard";
import CostCard from "@/components/CostCard";
import CLITerminal from "@/components/CLITerminal";
import InstallOverlay from "@/components/InstallOverlay";

export default function HomePage() {
  const { providers, costData, cliStatus, error, isRefreshing, refreshData } =
    useCodexBar();

  const showInstallOverlay = cliStatus.status === "not_installed";

  return (
    <div className="relative flex flex-col h-screen w-screen bg-primary overflow-hidden">
      <Header
        cliStatus={cliStatus}
        onRefresh={refreshData}
        isRefreshing={isRefreshing}
      />

      <ErrorBanner message={error} />

      {showInstallOverlay && <InstallOverlay onInstalled={refreshData} />}

      <main className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {providers.length === 0 && !showInstallOverlay ? (
          <div className="flex items-center justify-center h-32">
            <div className="flex flex-col items-center gap-2">
              <div className="w-6 h-6 border-2 border-accent-cyan border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-text-muted">Syncing AI quotas...</span>
            </div>
          </div>
        ) : (
          <>
            <div
              id="providers-container"
              className="space-y-2"
              style={{ display: providers.length === 0 ? "none" : undefined }}
            >
              {providers.map((p) => (
                <ProviderCard key={p.provider} provider={p} />
              ))}
            </div>

            <div
              id="cost-container"
              className="space-y-2"
              style={{ display: providers.length === 0 ? "none" : undefined }}
            >
              <CostCard costData={costData} />
            </div>
          </>
        )}
      </main>

      <CLITerminal />
    </div>
  );
}