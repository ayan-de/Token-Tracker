"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  getCliStatus,
  getUsageData,
  getCostData,
  triggerRefresh,
} from "@/lib/tauri";
import { onDataSynced, onSyncError } from "@/lib/tauriEvents";
import { mapCLIUsage, mapCLICost } from "@/lib/dataMapping";
import type { CliStatus, ProviderUsage, CostItem } from "@/lib/types";

interface UseCodexBarReturn {
  providers: ProviderUsage[];
  costData: CostItem[];
  cliStatus: CliStatus;
  error: string | null;
  isRefreshing: boolean;
  isInstalling: boolean;
  setIsInstalling: (v: boolean) => void;
  setError: (e: string | null) => void;
  refreshData: () => Promise<void>;
}

export function useCodexBar(): UseCodexBarReturn {
  const [providers, setProviders] = useState<ProviderUsage[]>([]);
  const [costData, setCostData] = useState<CostItem[]>([]);
  const [cliStatus, setCliStatus] = useState<CliStatus>({ status: "connecting" });
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const syncData = useCallback(async () => {
    try {
      const status = await getCliStatus();
      setCliStatus(status);

      if (status.status === "available") {
        try {
          const rawUsage = await getUsageData();
          const rawCost = await getCostData();
          const usage = rawUsage.map(mapCLIUsage).filter((p): p is ProviderUsage => p !== null);
          const costs = rawCost.map(mapCLICost).filter((c) => c !== null);
          setProviders(usage);
          setCostData(costs);
          setError(null);
        } catch (err) {
          console.warn("Loading cached CLI data failed", err);
          setError(`Failed to load cached data: ${err}`);
        }
      }
    } catch (err) {
      console.error("Sync error:", err);
      setError(`Tauri backend sync error: ${err}`);
    }
  }, []);

  const refreshData = useCallback(async () => {
    if (isRefreshing) return;

    try {
      const status = await getCliStatus();
      if (status.status !== "available") return;
    } catch {
      return;
    }

    setIsRefreshing(true);
    try {
      await triggerRefresh();
    } catch (err) {
      console.error("Failed to trigger background refresh:", err);
      setError(`Failed to trigger refresh: ${err}`);
      setIsRefreshing(false);
    }
  }, [isRefreshing]);

  useEffect(() => {
    syncData().then(() => {
      refreshData();
    });

    let unlistenSynced: (() => void) | undefined;
    let unlistenError: (() => void) | undefined;

    onDataSynced((payload) => {
      const rawUsage = payload.usage ?? [];
      const rawCost = payload.cost ?? [];
      const usage = rawUsage.map(mapCLIUsage).filter((p): p is ProviderUsage => p !== null);
      const costs = rawCost.map(mapCLICost).filter((c) => c !== null);
      setProviders(usage);
      setCostData(costs);
      setError(null);
      setIsRefreshing(false);
    }).then((fn) => {
      unlistenSynced = fn;
    });

    onSyncError((errMsg) => {
      setError(`Failed to sync from CLI: ${errMsg}`);
      setIsRefreshing(false);
    }).then((fn) => {
      unlistenError = fn;
    });

    pollingRef.current = setInterval(() => {
      refreshData();
    }, 60000);

    return () => {
      unlistenSynced?.();
      unlistenError?.();
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [syncData, refreshData]);

  return {
    providers,
    costData,
    cliStatus,
    error,
    isRefreshing,
    isInstalling,
    setIsInstalling,
    setError,
    refreshData,
  };
}