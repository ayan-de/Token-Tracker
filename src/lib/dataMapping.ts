import type { ProviderUsage, CostItem, RawCliUsageItem, RawCliCostItem } from "./types";

function providerLabel(provider: string, explicitLabel?: string): string {
  return explicitLabel || provider.charAt(0).toUpperCase() + provider.slice(1);
}

export function mapCLIUsage(raw: RawCliUsageItem): ProviderUsage | null {
  const provider = raw.provider || "unknown";
  const errorMessage = raw.error?.message || "Usage is temporarily unavailable.";
  const hasUsage = Boolean(raw.usage?.primary);

  // Graceful fallback for Claude on Linux
  if (provider === "claude" && raw.error && !hasUsage) {
    const msg = errorMessage.includes("web support")
      ? "Requires --source cli on Linux"
      : errorMessage;
    return {
      provider: "claude",
      provider_label: "Claude",
      percentage: 0,
      used: null,
      limit: null,
      unit: "requests",
      resets_at: null,
      pacing: { stage: "onTrack" },
      status_message: msg,
      unavailable: true,
      error_message: errorMessage,
    };
  }

  // Graceful fallback for OpenCode Go on Linux
  if (
    provider === "opencodego" &&
    raw.error &&
    !hasUsage &&
    errorMessage.includes("not detected")
  ) {
    return {
      provider: "opencodego",
      provider_label: "OpenCode Go",
      percentage: 0,
      used: null,
      limit: null,
      unit: "requests",
      resets_at: null,
      pacing: { stage: "onTrack" },
      status_message: "Not active (Run 'opencode login')",
      unavailable: true,
      error_message: errorMessage,
    };
  }

  // Keep unavailable providers visible even when there is no successful snapshot yet.
  if (!hasUsage) {
    return {
      provider,
      provider_label: providerLabel(provider, raw.provider_label),
      percentage: 0,
      used: null,
      limit: null,
      unit: "requests",
      resets_at: null,
      pacing: { stage: "onTrack" },
      status_message: errorMessage,
      unavailable: true,
      error_message: errorMessage,
    };
  }

  const pri = raw.usage!.primary!;
  let pacingStage = "onTrack";
  if (pri.pacing?.stage) {
    pacingStage = pri.pacing.stage;
  } else if (raw.usage?.pacing?.stage) {
    pacingStage = raw.usage.pacing.stage;
  }

  return {
    provider,
    provider_label: providerLabel(provider, raw.provider_label),
    percentage: pri.usedPercent ?? 0,
    used: pri.used ?? null,
    limit: pri.limit ?? null,
    unit: pri.unit ?? "requests",
    resets_at: pri.resetsAt ?? null,
    pacing: { stage: pacingStage as ProviderUsage["pacing"]["stage"] },
    stale: raw.stale === true,
    last_successful_at: raw.lastSuccessfulAt ?? null,
    error_message: raw.error?.message || null,
  };
}

export function mapCLICost(raw: RawCliCostItem): CostItem {
  const provider = raw.provider || "unknown";
  const totalCostUSD = raw.sessionCostUSD || 0;
  const last30DaysCostUSD =
    raw.last30DaysCostUSD || raw.totals?.totalCost || 0;

  const modelMap: Record<
    string,
    { modelName: string; costUSD: number; totalTokens: number }
  > = {};
  if (raw.daily) {
    for (const day of raw.daily) {
      if (day.modelBreakdowns) {
        for (const m of day.modelBreakdowns) {
          const name = m.modelName || "unknown";
          const cost = m.cost ?? m.costUSD ?? 0;
          const tokens = m.totalTokens || 0;
          if (!modelMap[name]) {
            modelMap[name] = { modelName: name, costUSD: 0, totalTokens: 0 };
          }
          modelMap[name].costUSD += cost;
          modelMap[name].totalTokens += tokens;
        }
      }
    }
  }

  return {
    provider,
    totalCostUSD,
    last30DaysCostUSD,
    modelBreakdowns: Object.values(modelMap),
  };
}