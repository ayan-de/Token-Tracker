export function formatTimeUntil(isoString: string | null): string {
  if (!isoString) return "";
  const resetsAt = new Date(isoString);
  const now = new Date();
  const diffMs = resetsAt.getTime() - now.getTime();
  if (diffMs <= 0) return "Resetting...";

  const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (diffHrs > 24) {
    const days = Math.floor(diffHrs / 24);
    const hrs = diffHrs % 24;
    return `${days}d ${hrs}h`;
  }
  return `${diffHrs}h ${diffMins}m`;
}

export function formatPacingStage(stage: string): string {
  if (!stage) return "";
  return stage
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase());
}

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function providerLabel(provider: string, explicitLabel?: string): string {
  return explicitLabel || provider.charAt(0).toUpperCase() + provider.slice(1);
}

export const PROVIDER_GRADIENTS: Record<string, string> = {
  claude: "from-amber-500 to-orange-600",
  codex: "from-emerald-500 to-teal-600",
  gemini: "from-blue-500 to-indigo-600",
  openai: "from-teal-500 to-cyan-600",
  antigravity: "from-pink-500 to-rose-600",
  cursor: "from-violet-500 to-purple-600",
  opencode: "from-blue-600 to-cyan-600",
  opencodego: "from-blue-600 to-cyan-600",
  factory: "from-orange-500 to-red-600",
  copilot: "from-purple-500 to-blue-600",
  zai: "from-cyan-500 to-blue-600",
  minimax: "from-violet-500 to-indigo-600",
  kimi: "from-teal-500 to-blue-600",
  kilo: "from-pink-500 to-rose-500",
  kiro: "from-blue-500 to-indigo-500",
  augment: "from-emerald-500 to-teal-600",
  kimik2: "from-teal-500 to-blue-600",
  moonshot: "from-indigo-500 to-purple-600",
  amp: "from-cyan-500 to-blue-600",
  ollama: "from-green-500 to-emerald-600",
  synthetic: "from-pink-500 to-rose-600",
  warp: "from-red-500 to-orange-600",
  openrouter: "from-violet-500 to-purple-600",
  windsurf: "from-blue-500 to-cyan-600",
  zed: "from-orange-500 to-red-600",
  mimo: "from-teal-500 to-cyan-600",
  mistral: "from-red-500 to-pink-600",
  deepseek: "from-orange-500 to-amber-600",
  codebuff: "from-blue-500 to-indigo-600",
  crof: "from-cyan-500 to-blue-600",
  venice: "from-violet-500 to-purple-600",
  stepfun: "from-pink-500 to-rose-600",
  grok: "from-orange-500 to-yellow-600",
  groq: "from-teal-500 to-emerald-600",
  litellm: "from-blue-500 to-indigo-600",
  deepgram: "from-rose-500 to-pink-600",
  poe: "from-green-500 to-teal-600",
  chutes: "from-indigo-500 to-blue-600",
};

export function getProviderGradient(provider: string): string {
  return PROVIDER_GRADIENTS[provider] ?? "from-gray-500 to-gray-600";
}