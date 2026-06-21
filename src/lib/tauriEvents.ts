import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { RawCliUsageItem, RawCliCostItem } from "./types";

export interface DataSyncedPayload {
  usage: RawCliUsageItem[];
  cost: RawCliCostItem[];
  installedProviders?: string[];
  timestamp?: string;
}

export function onDataSynced(cb: (data: DataSyncedPayload) => void): Promise<UnlistenFn> {
  return listen<DataSyncedPayload>("data-synced", (event) => {
    cb(event.payload);
  });
}

export function onSyncError(cb: (error: string) => void): Promise<UnlistenFn> {
  return listen<string>("sync-error", (event) => {
    cb(event.payload);
  });
}

export function onInstallProgress(cb: (msg: string) => void): Promise<UnlistenFn> {
  return listen<string>("install-progress", (event) => {
    cb(event.payload);
  });
}