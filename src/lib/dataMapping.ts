import type { ProviderUsage, CostItem, ProviderUsageDetails, PacingStage } from "./types";

export interface ProviderDescriptor {
  displayName: string;
  logo: string;
  logoDark?: string;
  sessionLabel: string;
  weeklyLabel: string;
  opusLabel?: string | null;
  importable?: boolean;
  /** Schema for dynamic credential fields (e.g., MiniMax needs api_key + group_id) */
  credentialFields?: Record<string, CredentialField>;
}

export interface CredentialField {
  key: string;
  label: string;
  placeholder: string;
  type: 'password' | 'text';
  required: boolean;
}

export const PROVIDER_DESCRIPTORS: Record<string, ProviderDescriptor> = {
  claude:     { displayName: "Claude",     logo: "/logos/claude_code.svg",       sessionLabel: "Session", weeklyLabel: "Weekly", opusLabel: "Sonnet", importable: true },
  gemini:     { displayName: "Gemini",     logo: "/logos/gemini.svg",          sessionLabel: "Pro", weeklyLabel: "Flash", opusLabel: "Flash Lite", importable: true },
  antigravity:{ displayName: "Antigravity",logo: "/logos/antigravity-color.svg",          sessionLabel: "Gemini Models", weeklyLabel: "Claude and GPT" },
  codex:      { displayName: "Codex",      logo: "/logos/codex.svg",           sessionLabel: "Session", weeklyLabel: "Weekly", importable: true },
  cursor:     { displayName: "Cursor",     logo: "/logos/cursor_light.svg",    logoDark: "/logos/cursor_dark.svg",    sessionLabel: "Total", weeklyLabel: "Auto", opusLabel: "API", importable: true },
  ollama:     { displayName: "Ollama",     logo: "/logos/ollama-light.svg",     logoDark: "/logos/ollama-dark.svg", sessionLabel: "Session", weeklyLabel: "Weekly" },
  openrouter: { displayName: "OpenRouter",logo: "/logos/openrouter.svg",      sessionLabel: "Credits", weeklyLabel: "Usage" },
  perplexity: { displayName: "Perplexity",logo: "/logos/perplexity-ai-dark.svg", logoDark: "/logos/perplexity-ai-light.svg", sessionLabel: "Credits", weeklyLabel: "Bonus credits", opusLabel: "Purchased" },
  mistral:    { displayName: "Mistral",    logo: "/logos/mistral.svg",         sessionLabel: "Monthly", weeklyLabel: "" },
  deepseek:   { displayName: "DeepSeek",  logo: "/logos/deepseek.svg",        sessionLabel: "Balance", weeklyLabel: "Balance" },
  groq:       { displayName: "Groq",       logo: "/logos/groq.svg",           sessionLabel: "Requests", weeklyLabel: "Tokens" },
  grok:       { displayName: "Grok",       logo: "/logos/grok.svg",       logoDark: "/logos/grok-dark.svg", sessionLabel: "Weekly", weeklyLabel: "Credits", opusLabel: "Monthly", importable: true },
  opencode:   { displayName: "OpenCode",   logo: "/logos/opencode.svg",                          sessionLabel: "5-hour", weeklyLabel: "Weekly" },
  opencodego: { displayName: "OpenCode Go",logo: "/logos/opencode.svg",      sessionLabel: "5-hour", weeklyLabel: "Weekly" },
  factory:    { displayName: "Factory",    logo: "/logos/favicon.svg",                          sessionLabel: "Standard", weeklyLabel: "Premium" },
  freemodel: { displayName: "FreeModel",  logo: "/logos/freemodel.svg",   sessionLabel: "Session", weeklyLabel: "Weekly", importable: true, credentialFields: {
    bm_session: { key: 'bm_session', label: 'Session Cookie (bm_session)', placeholder: 'bm_session=...', type: 'password', required: true },
  }},
  copilot:   { displayName: "Copilot",    logo: "/logos/github-copilot.svg",   logoDark: "/logos/github-copilot-dark.svg", sessionLabel: "Premium", weeklyLabel: "Chat", importable: true },
  zai:        { displayName: "z.ai",        logo: "/logos/zai-light.svg", logoDark: "/logos/zai-dark.svg", sessionLabel: "Tokens", weeklyLabel: "MCP" },
  minimax:   { displayName: "MiniMax",     logo: "/logos/minimax.svg",        sessionLabel: "5-hour", weeklyLabel: "Weekly", importable: true, credentialFields: {
    api_key:   { key: 'api_key',   label: 'API Key',    placeholder: 'sk-cp-...',      type: 'password', required: true },
    group_id: { key: 'group_id', label: 'Group ID',  placeholder: 'Your Group ID',  type: 'text',      required: true },
  }},
  kimi:       { displayName: "Kimi",       logo: "/logos/kimi-ai.svg",        sessionLabel: "Weekly", weeklyLabel: "Rate Limit" },
  kilo:       { displayName: "Kilo",       logo: "/logos/kilocode-light.svg", logoDark: "/logos/kilocode-dark.svg", sessionLabel: "Credits", weeklyLabel: "Kilo Pass" },
  kiro:       { displayName: "Kiro",       logo: "/logos/kiro-color.svg",     sessionLabel: "Credits", weeklyLabel: "Bonus" },
  augment:    { displayName: "Augment",    logo: "/logos/Augment Code.svg",                          sessionLabel: "Credits", weeklyLabel: "Usage" },
  kimik2:     { displayName: "Kimi K2",   logo: "/logos/kimi-ai.svg",                          sessionLabel: "Credits", weeklyLabel: "Credits" },
  moonshot:   { displayName: "Moonshot",   logo: "/logos/moonshot.svg",       sessionLabel: "Balance", weeklyLabel: "Balance" },
  amp:        { displayName: "Amp",         logo: "/logos/amp-color.svg",       sessionLabel: "Amp Free", weeklyLabel: "Balance" },
  synthetic:  { displayName: "Synthetic", logo: "/logos/svgexport-2.svg",                          sessionLabel: "Five-hour quota", weeklyLabel: "Weekly tokens", opusLabel: "Search hourly" },
  warp:       { displayName: "Warp",       logo: "/logos/warp-light.svg",     logoDark: "/logos/warp-dark.svg", sessionLabel: "Credits", weeklyLabel: "Add-on credits" },
  windsurf:   { displayName: "Windsurf",   logo: "/logos/windsurf_light.svg", logoDark: "/logos/windsurf_dark.svg", sessionLabel: "Daily", weeklyLabel: "Weekly" },
  zed:        { displayName: "Zed",         logo: "/logos/zed-dark.svg", logoDark: "/logos/zed-light.svg", sessionLabel: "Credits", weeklyLabel: "" },
  mimo:       { displayName: "MiMo",       logo: "/logos/xiaomimimo.svg",     sessionLabel: "Credits", weeklyLabel: "Window" },
  doubao:     { displayName: "Doubao",     logo: "/logos/douboo.svg",          sessionLabel: "Requests", weeklyLabel: "Rate limit" },
  crof:       { displayName: "Crof",       logo: "/logos/Crof.svg",                          sessionLabel: "Requests", weeklyLabel: "Credits" },
  venice:     { displayName: "Venice",     logo: "/logos/venice-color.svg",   sessionLabel: "Usage", weeklyLabel: "Usage" },
  stepfun:    { displayName: "StepFun",   logo: "/logos/stepfun-color.svg",                          sessionLabel: "Credits", weeklyLabel: "Usage" },
  deepgram:   { displayName: "Deepgram",   logo: "/logos/deepseek.svg",       sessionLabel: "Requests", weeklyLabel: "Usage" },
  poe:        { displayName: "Poe",         logo: "/logos/poe-color.svg",      sessionLabel: "Points", weeklyLabel: "Points" },
  chutes:     { displayName: "Chutes",     logo: "/logos/chutes.svg",          sessionLabel: "4-hour quota", weeklyLabel: "Monthly quota" },
  commandcode:{ displayName: "Command Code",logo: "/logos/command-code.svg",                        sessionLabel: "Monthly credits", weeklyLabel: "Monthly" },
};

function providerLabel(provider: string, explicitLabel?: string): string {
  const desc = PROVIDER_DESCRIPTORS[provider.toLowerCase()];
  if (desc) return desc.displayName;
  return explicitLabel || provider.charAt(0).toUpperCase() + provider.slice(1);
}

export function providerLogo(provider: string, theme: 'dark' | 'light' = 'dark'): string {
  const desc = PROVIDER_DESCRIPTORS[provider.toLowerCase()];
  if (!desc) return "";
  if (theme === 'dark' && desc.logoDark) return desc.logoDark;
  return desc.logo || "";
}

export function mapProviderUsage(raw: any): ProviderUsage | null {
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
      source: raw.source,
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
      source: raw.source,
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
      source: raw.source,
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
    extraRateWindows: usageRaw.extraRateWindows ? usageRaw.extraRateWindows.map((ew: any) => ({
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
    accountEmail: usageRaw.usage?.accountEmail ?? usageRaw.accountEmail,
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
    source: raw.source,
    usage,
    stale: raw.stale === true,
    last_successful_at: raw.lastSuccessfulAt ?? null,
    error_message: raw.error?.message || null,
  };
}

export function mapProviderCost(raw: any): CostItem {
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