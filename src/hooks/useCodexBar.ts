"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  getProviders,
  getCost,
  triggerRefresh,
  getHealth,
  getSettings,
  updateSettings,
  getCredentials,
  storeCredential,
  deleteCredential,
  getBrowsers,
  importCookies,
} from "@/lib/apiClient";
import { mapCLIUsage, mapCLICost } from "@/lib/dataMapping";
import type { CliStatus, ProviderUsage, CostItem } from "@/lib/types";

interface UseCodexBarReturn {
  providers: ProviderUsage[];
  costData: CostItem[];
  installedProviders: string[];
  cliStatus: CliStatus;
  error: string | null;
  isRefreshing: boolean;
  settings: any | null;
  credentials: any[];
  browsers: any[];
  refreshData: () => Promise<void>;
  updateAppSettings: (newSettings: any) => Promise<boolean>;
  addCredential: (provider: string, secret: string, type: "key" | "cookie") => Promise<boolean>;
  removeCredential: (provider: string) => Promise<boolean>;
  importBrowserCookies: (browserId: string, profileId: string, providerId: string) => Promise<boolean>;
  refetchSettings: () => Promise<void>;
  refetchCredentials: () => Promise<void>;
  refetchBrowsers: () => Promise<void>;
}

export function useCodexBar(): UseCodexBarReturn {
  const [providers, setProviders] = useState<ProviderUsage[]>([]);
  const [costData, setCostData] = useState<CostItem[]>([]);
  const [cliStatus, setCliStatus] = useState<CliStatus>({ status: "connecting" });
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [settings, setSettings] = useState<any | null>(null);
  const [credentials, setCredentials] = useState<any[]>([]);
  const [browsers, setBrowsers] = useState<any[]>([]);
  const [installedProviders, setInstalledProviders] = useState<string[]>([]);

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
      setInstalledProviders(payload.installedProviders ?? []);
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

  const refetchSettings = useCallback(async () => {
    try {
      const data = await getSettings();
      setSettings(data);
    } catch (err) {
      console.error("Failed to load settings:", err);
    }
  }, []);

  const refetchCredentials = useCallback(async () => {
    try {
      const data = await getCredentials();
      setCredentials(data);
    } catch (err) {
      console.error("Failed to load credentials:", err);
    }
  }, []);

  const refetchBrowsers = useCallback(async () => {
    try {
      const data = await getBrowsers();
      setBrowsers(data);
    } catch (err) {
      console.error("Failed to load browsers:", err);
    }
  }, []);

  const updateAppSettings = useCallback(async (newSettings: any) => {
    try {
      await updateSettings(newSettings);
      setSettings(newSettings);
      return true;
    } catch (err) {
      console.error("Failed to update settings:", err);
      setError(`Failed to update settings: ${err}`);
      return false;
    }
  }, []);

  const addCredential = useCallback(async (provider: string, secret: string, type: "key" | "cookie", fields?: Record<string, string>) => {
    try {
      await storeCredential(provider, secret, type, fields);
      await refetchCredentials();
      // Refresh to fetch the newly-added provider's data
      await refreshData();
      return true;
    } catch (err) {
      console.error("Failed to add credential:", err);
      setError(`Failed to add credential: ${err}`);
      return false;
    }
  }, [refetchCredentials, refreshData]);

  const removeCredential = useCallback(async (provider: string) => {
    try {
      await deleteCredential(provider);
      await refetchCredentials();
      return true;
    } catch (err) {
      console.error("Failed to remove credential:", err);
      setError(`Failed to remove credential: ${err}`);
      return false;
    }
  }, [refetchCredentials]);

  const importBrowserCookies = useCallback(async (browserId: string, profileId: string, providerId: string) => {
    try {
      await importCookies(browserId, profileId, providerId);
      await refetchCredentials();
      await refreshData();
      return true;
    } catch (err) {
      console.error("Failed to import cookies:", err);
      setError(`Failed to import cookies: ${err}`);
      return false;
    }
  }, [refetchCredentials, refreshData]);

  // Initial load
  useEffect(() => {
    syncData().then(() => {
      refreshData();
    });
    refetchSettings();
    refetchCredentials();
    refetchBrowsers();
  }, [syncData, refreshData, refetchSettings, refetchCredentials, refetchBrowsers]);

  // Dynamic polling based on settings
  useEffect(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

    const intervalSecs = settings?.refresh_interval_secs ?? 60;
    if (intervalSecs > 0) {
      pollingRef.current = setInterval(() => {
        refreshData();
      }, intervalSecs * 1000);
    }

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [settings?.refresh_interval_secs, refreshData]);

  return {
    providers,
    costData,
    installedProviders,
    cliStatus,
    error,
    isRefreshing,
    settings,
    credentials,
    browsers,
    refreshData,
    updateAppSettings,
    addCredential,
    removeCredential,
    importBrowserCookies,
    refetchSettings,
    refetchCredentials,
    refetchBrowsers,
  };
}