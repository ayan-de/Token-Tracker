import type { ProviderUsage, CostItem, RawCliUsageItem, RawCliCostItem, ProviderUsageDetails, PacingStage } from "./types";

export interface ProviderDescriptor {
  displayName: string;
  sessionLabel: string;
  weeklyLabel: string;
  opusLabel?: string | null;
}

export const PROVIDER_DESCRIPTORS: Record<string, ProviderDescriptor> = {
  claude: { displayName: "Claude", sessionLabel: "Session", weeklyLabel: "Weekly", opusLabel: "Sonnet" },
  gemini: { displayName: "Gemini", sessionLabel: "Pro", weeklyLabel: "Flash", opusLabel: "Flash Lite" },
  antigravity: { displayName: "Antigravity", sessionLabel: "Gemini Models", weeklyLabel: "Claude and GPT" },
  codex: { displayName: "Codex", sessionLabel: "Session", weeklyLabel: "Weekly" },
  cursor: { displayName: "Cursor", sessionLabel: "Total", weeklyLabel: "Auto", opusLabel: "API" },
  ollama: { displayName: "Ollama", sessionLabel: "Session", weeklyLabel: "Weekly" },
  openrouter: { displayName: "OpenRouter", sessionLabel: "Credits", weeklyLabel: "Usage" },
  perplexity: { displayName: "Perplexity", sessionLabel: "Credits", weeklyLabel: "Bonus credits", opusLabel: "Purchased" },
  mistral: { displayName: "Mistral", sessionLabel: "Monthly", weeklyLabel: "" },
  deepseek: { displayName: "DeepSeek", sessionLabel: "Balance", weeklyLabel: "Balance" },
  groq: { displayName: "Groq", sessionLabel: "Requests", weeklyLabel: "Tokens" },
  grok: { displayName: "Grok", sessionLabel: "Credits", weeklyLabel: "On-demand" },
  opencode: { displayName: "OpenCode", sessionLabel: "5-hour", weeklyLabel: "Weekly" },
  opencodego: { displayName: "OpenCode Go", sessionLabel: "5-hour", weeklyLabel: "Weekly" },
  factory: { displayName: "Factory", sessionLabel: "Standard", weeklyLabel: "Premium" },
  copilot: { displayName: "Copilot", sessionLabel: "Premium", weeklyLabel: "Chat" },
  zai: { displayName: "z.ai", sessionLabel: "Tokens", weeklyLabel: "MCP" },
  minimax: { displayName: "MiniMax", sessionLabel: "Prompts", weeklyLabel: "Window" },
  kimi: { displayName: "Kimi", sessionLabel: "Weekly", weeklyLabel: "Rate Limit" },
  kilo: { displayName: "Kilo", sessionLabel: "Credits", weeklyLabel: "Kilo Pass" },
  kiro: { displayName: "Kiro", sessionLabel: "Credits", weeklyLabel: "Bonus" },
  augment: { displayName: "Augment", sessionLabel: "Credits", weeklyLabel: "Usage" },
  kimik2: { displayName: "Kimi K2", sessionLabel: "Credits", weeklyLabel: "Credits" },
  moonshot: { displayName: "Moonshot", sessionLabel: "Balance", weeklyLabel: "Balance" },
  amp: { displayName: "Amp", sessionLabel: "Amp Free", weeklyLabel: "Balance" },
  synthetic: { displayName: "Synthetic", sessionLabel: "Five-hour quota", weeklyLabel: "Weekly tokens", opusLabel: "Search hourly" },
  warp: { displayName: "Warp", sessionLabel: "Credits", weeklyLabel: "Add-on credits" },
  windsurf: { displayName: "Windsurf", sessionLabel: "Daily", weeklyLabel: "Weekly" },
  zed: { displayName: "Zed", sessionLabel: "Credits", weeklyLabel: "" },
  mimo: { displayName: "MiMo", sessionLabel: "Credits", weeklyLabel: "Window" },
  doubao: { displayName: "Doubao", sessionLabel: "Requests", weeklyLabel: "Rate limit" },
  crof: { displayName: "Crof", sessionLabel: "Requests", weeklyLabel: "Credits" },
  venice: { displayName: "Venice", sessionLabel: "Usage", weeklyLabel: "Usage" },
  stepfun: { displayName: "StepFun", sessionLabel: "Credits", weeklyLabel: "Usage" },
  deepgram: { displayName: "Deepgram", sessionLabel: "Requests", weeklyLabel: "Usage" },
  poe: { displayName: "Poe", sessionLabel: "Points", weeklyLabel: "Points" },
  chutes: { displayName: "Chutes", sessionLabel: "4-hour quota", weeklyLabel: "Monthly quota" },
  commandcode: { displayName: "Command Code", sessionLabel: "Monthly credits", weeklyLabel: "Monthly" },
};

function providerLabel(provider: string, explicitLabel?: string): string {
  const desc = PROVIDER_DESCRIPTORS[provider.toLowerCase()];
  if (desc) return desc.displayName;
  return explicitLabel || provider.charAt(0).toUpperCase() + provider.slice(1);
}

export function mapCLIUsage(raw: RawCliUsageItem): ProviderUsage | null {
  const provider = raw.provider || "unknown";
  const errorMessage = raw.error?.message || "Usage is temporarily unavailable.";
  const hasUsage = Boolean(raw.usage);

  // Graceful fallback for Claude on Linux
  if (provider === "claude" && raw.error && !hasUsage) {
    const msg = errorMessage.includes("web support")
      ? "Requires --source cli on Linux"
      : errorMessage;
    return {
      provider: "claude",
      provider_label: "Claude",
      usage: null,
      stale: raw.stale === true,
      last_successful_at: raw.lastSuccessfulAt ?? null,
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
      usage: null,
      stale: raw.stale === true,
      last_successful_at: raw.lastSuccessfulAt ?? null,
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
      usage: null,
      stale: raw.stale === true,
      last_successful_at: raw.lastSuccessfulAt ?? null,
      status_message: errorMessage,
      unavailable: true,
      error_message: errorMessage,
    };
  }

  const usageRaw = raw.usage!;
  const usage: ProviderUsageDetails = {
    primary: usageRaw.primary ? {
      usedPercent: usageRaw.primary.usedPercent ?? 0,
      windowMinutes: usageRaw.primary.windowMinutes,
      resetsAt: usageRaw.primary.resetsAt,
      resetDescription: usageRaw.primary.resetDescription,
      used: usageRaw.primary.used,
      limit: usageRaw.primary.limit,
      unit: usageRaw.primary.unit ?? "requests",
      pacing: usageRaw.primary.pacing ? { stage: usageRaw.primary.pacing.stage as PacingStage } : null,
    } : null,
    secondary: usageRaw.secondary ? {
      usedPercent: usageRaw.secondary.usedPercent ?? 0,
      windowMinutes: usageRaw.secondary.windowMinutes,
      resetsAt: usageRaw.secondary.resetsAt,
      resetDescription: usageRaw.secondary.resetDescription,
      used: usageRaw.secondary.used,
      limit: usageRaw.secondary.limit,
      unit: usageRaw.secondary.unit ?? "requests",
      pacing: usageRaw.secondary.pacing ? { stage: usageRaw.secondary.pacing.stage as PacingStage } : null,
    } : null,
    tertiary: usageRaw.tertiary ? {
      usedPercent: usageRaw.tertiary.usedPercent ?? 0,
      windowMinutes: usageRaw.tertiary.windowMinutes,
      resetsAt: usageRaw.tertiary.resetsAt,
      resetDescription: usageRaw.tertiary.resetDescription,
      used: usageRaw.tertiary.used,
      limit: usageRaw.tertiary.limit,
      unit: usageRaw.tertiary.unit ?? "requests",
      pacing: usageRaw.tertiary.pacing ? { stage: usageRaw.tertiary.pacing.stage as PacingStage } : null,
    } : null,
    extraRateWindows: usageRaw.extraRateWindows ? usageRaw.extraRateWindows.map((ew) => ({
      id: ew.id,
      title: ew.title,
      window: {
        usedPercent: ew.window.usedPercent ?? 0,
        windowMinutes: ew.window.windowMinutes,
        resetsAt: ew.window.resetsAt,
        resetDescription: ew.window.resetDescription,
      },
      usageKnown: ew.usageKnown !== false,
    })) : null,
    providerCost: usageRaw.providerCost ? {
      used: usageRaw.providerCost.used,
      limit: usageRaw.providerCost.limit,
      currencyCode: usageRaw.providerCost.currencyCode,
      period: usageRaw.providerCost.period,
      resetsAt: usageRaw.providerCost.resetsAt,
      personalUsed: usageRaw.providerCost.personalUsed,
      updatedAt: usageRaw.providerCost.updatedAt,
    } : null,
    loginMethod: usageRaw.loginMethod,
    accountEmail: usageRaw.accountEmail,
    updatedAt: usageRaw.updatedAt,
    identity: usageRaw.identity ? {
      providerID: usageRaw.identity.providerID,
      accountEmail: usageRaw.identity.accountEmail,
      accountOrganization: usageRaw.identity.accountOrganization,
      loginMethod: usageRaw.identity.loginMethod,
    } : null,
  };

  return {
    provider,
    provider_label: providerLabel(provider, raw.provider_label),
    version: raw.version,
    usage,
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