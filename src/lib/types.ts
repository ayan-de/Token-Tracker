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

export interface RateWindow {
  usedPercent: number;
  windowMinutes?: number | null;
  resetsAt?: string | null;
  resetDescription?: string | null;
  used?: number | null;
  limit?: number | null;
  unit?: string | null;
  pacing?: { stage?: PacingStage } | null;
}

export interface NamedRateWindow {
  id: string;
  title: string;
  window: RateWindow;
  usageKnown: boolean;
}

export interface ProviderCostSnapshot {
  used: number;
  limit: number;
  currencyCode: string;
  period?: string | null;
  resetsAt?: string | null;
  nextRegenAmount?: number | null;
  personalUsed?: number | null;
  updatedAt: string;
}

export interface ProviderIdentity {
  providerID?: string | null;
  accountEmail?: string | null;
  accountOrganization?: string | null;
  loginMethod?: string | null;
}

export interface ProviderUsageDetails {
  primary?: RateWindow | null;
  secondary?: RateWindow | null;
  tertiary?: RateWindow | null;
  extraRateWindows?: NamedRateWindow[] | null;
  providerCost?: ProviderCostSnapshot | null;
  loginMethod?: string | null;
  accountEmail?: string | null;
  updatedAt?: string | null;
  identity?: ProviderIdentity | null;
}

export interface ProviderUsage {
  provider: string;
  provider_label: string;
  version?: string;
  usage?: ProviderUsageDetails | null;
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
  version?: string;
  usage?: {
    loginMethod?: string;
    accountEmail?: string;
    updatedAt?: string;
    primary?: {
      usedPercent?: number;
      windowMinutes?: number;
      resetsAt?: string;
      resetDescription?: string;
      used?: number;
      limit?: number;
      unit?: string;
      pacing?: { stage?: string };
    } | null;
    secondary?: {
      usedPercent?: number;
      windowMinutes?: number;
      resetsAt?: string;
      resetDescription?: string;
      used?: number;
      limit?: number;
      unit?: string;
      pacing?: { stage?: string };
    } | null;
    tertiary?: {
      usedPercent?: number;
      windowMinutes?: number;
      resetsAt?: string;
      resetDescription?: string;
      used?: number;
      limit?: number;
      unit?: string;
      pacing?: { stage?: string };
    } | null;
    extraRateWindows?: Array<{
      id: string;
      title: string;
      window: {
        usedPercent: number;
        windowMinutes?: number;
        resetsAt?: string;
        resetDescription?: string;
      };
      usageKnown?: boolean;
    }> | null;
    providerCost?: {
      used: number;
      limit: number;
      currencyCode: string;
      period?: string;
      resetsAt?: string;
      personalUsed?: number;
      updatedAt: string;
    } | null;
    identity?: {
      providerID?: string;
      accountEmail?: string;
      accountOrganization?: string;
      loginMethod?: string;
    } | null;
    pacing?: { stage?: string };
  } | null;
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