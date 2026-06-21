export type CliStatusType = "available" | "not_installed" | "demo" | "connecting" | "error";

export interface CliStatus {
  status: CliStatusType;
}

export type PacingStage =
  | "onTrack"
  | "ahead"
  | "farAhead"
  | "behind"
  | "farBehind"
  | "stale"
  | "unavailable";

export interface ProviderUsage {
  provider: string;
  provider_label: string;
  percentage: number;
  used: number | null;
  limit: number | null;
  unit: string;
  resets_at: string | null;
  pacing: { stage: PacingStage };
  stale?: boolean;
  last_successful_at?: number | null;
  error_message: string | null;
  unavailable?: boolean;
  status_message?: string;
}

export interface ModelBreakdown {
  modelName: string;
  costUSD: number;
  totalTokens: number;
}

export interface CostItem {
  provider: string;
  totalCostUSD: number;
  last30DaysCostUSD: number;
  modelBreakdowns: ModelBreakdown[];
}

export interface CacheData {
  usage: ProviderUsage[];
  cost: CostItem[];
  installedProviders: string[];
  timestamp: string;
}

// Raw types matching what the Rust backend actually returns (serde_json::Value)
export interface RawCliUsageItem {
  provider?: string;
  provider_label?: string;
  cacheAccountKey?: string;
  account?: string;
  usage?: {
    primary?: {
      usedPercent?: number;
      resetsAt?: string;
      used?: number;
      limit?: number;
      unit?: string;
      pacing?: { stage?: string };
    };
    pacing?: { stage?: string };
  };
  stale?: boolean;
  lastSuccessfulAt?: number;
  error?: { message?: string };
}

export interface RawCliCostItem {
  provider?: string;
  sessionCostUSD?: number;
  last30DaysCostUSD?: number;
  totals?: { totalCost?: number };
  daily?: Array<{
    modelBreakdowns?: Array<{
      modelName?: string;
      cost?: number;
      costUSD?: number;
      totalTokens?: number;
    }>;
  }>;
}