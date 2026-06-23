"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  getProviders,
  getCost,
  triggerRefresh,
  getHealth,
} from "@/lib/apiClient";
import { mapCLIUsage, mapCLICost } from "@/lib/dataMapping";
import type { CliStatus, ProviderUsage, CostItem } from "@/lib/types";

interface UseCodexBarReturn {
  providers: ProviderUsage[];
  costData: CostItem[];
  cliStatus: CliStatus;
  error: string | null;
  isRefreshing: boolean;
  refreshData: () => Promise<void>;
}

export function useCodexBar(): UseCodexBarReturn {
  const [providers, setProviders] = useState<ProviderUsage[]>([]);
  const [costData, setCostData] = useState<CostItem[]>([]);
  const [cliStatus, setCliStatus] = useState<CliStatus>({ status: "connecting" });
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const syncData = useCallback(async () => {
    try {
      const health = await getHealth();
      if (health.status === "healthy") {
        setCliStatus({ status: "available" });
        try {
          const rawUsage = await getProviders();
          const rawCost = await getCost();
          const usage = rawUsage.map(mapCLIUsage).filter((p): p is ProviderUsage => p !== null);
          const costs = rawCost.map(mapCLICost).filter((c) => c !== null);
          setProviders(usage);
          setCostData(costs);
          setError(null);
        } catch (err) {
          console.warn("Loading cached data failed", err);
          setError(`Failed to load cached data: ${err}`);
        }
      } else {
        setCliStatus({ status: "error" });
      }
    } catch (err) {
      console.error("Sync error:", err);
      setCliStatus({ status: "error" });
      setError(`Backend sync error: ${err}`);
    }
  }, []);

  const refreshData = useCallback(async () => {
    if (isRefreshing) return;

    setIsRefreshing(true);
    try {
      const payload = await triggerRefresh();
      const rawUsage = payload.usage ?? [];
      const rawCost = payload.cost ?? [];
      const usage = rawUsage.map(mapCLIUsage).filter((p): p is ProviderUsage => p !== null);
      const costs = rawCost.map(mapCLICost).filter((c) => c !== null);
      setProviders(usage);
      setCostData(costs);
      setError(null);
    } catch (err) {
      console.error("Failed to trigger refresh:", err);
      setError(`Failed to trigger refresh: ${err}`);
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing]);

  useEffect(() => {
    syncData().then(() => {
      refreshData();
    });

    pollingRef.current = setInterval(() => {
      refreshData();
    }, 60000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [syncData, refreshData]);

  return {
    providers,
    costData,
    cliStatus,
    error,
    isRefreshing,
    refreshData,
  };
}