export function formatTimeUntil(isoString: string | null): string {
  if (!isoString) return "";
  if (isoString === "Resetting...") return "Resetting...";
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

// Map provider keys to their logo filenames (checked at build-time via buildGradient)
const LOGO_FILE: Record<string, string> = {
  claude: "claude_code",
  gemini: "gemini",
  antigravity: "antigravity-color",
  codex: "codex",
  cursor: "cursor_light",
  ollama: "ollama-light",
  openrouter: "openrouter",
  copilot: "github-copilot",
  minimax: "minimax",
  mistral: "mistral",
  deepseek: "deepseek",
  openai: "openai",
  windsurf: "windsurf_light",
};

// Extracted at build-time via scripts/extract-logo-colors.js — do not edit manually
// Format: from-[#rrggbb] to-[#rrggbb]
const LOGO_GRADIENTS: Partial<Record<string, string>> = {
  antigravity: "from-[#00b95c] to-[#00944a]",
  claude: "from-[#d77655] to-[#ac5e44]",
  codex: "from-[#b1a7ff] to-[#8e86cc]",
  copilot: "from-[#9439d0] to-[#762ea6]",
  cursor: "from-[#c1d039] to-[#9aa62e]",
  deepseek: "from-[#4d6bfe] to-[#3e56cb]",
  freemodel: "from-[#19c37d] to-[#0f9c62]",
  gemini: "from-[#9168c0] to-[#74539a]",
  minimax: "from-[#e73562] to-[#b92a4e]",
  mistral: "from-[#ffaf00] to-[#cc8c00]",
  ollama: "from-[#d0395c] to-[#a62e4a]",
  openai: "from-[#b7d039] to-[#92a62e]",
  opencode: "from-[#CFCECD] to-[#211E1E]",
  openrouter: "from-[#d09139] to-[#a6742e]",
  windsurf: "from-[#d03970] to-[#a62e5a]",
};

// Fallback for providers with no SVG: deterministic hue from provider name
// ponytail: hue-only hash — upgrade to per-provider saturation/lightness map if needed
function hashFallbackGradient(provider: string): string {
  let h = 0;
  for (let i = 0; i < provider.length; i++) h = ((h << 5) - h + provider.charCodeAt(i)) | 0;
  const hue = Math.abs(h % 360);
  return `from-[hsl(${hue},62%,52%)] to-[hsl(${hue},52%,34%)]`;
}

export function getProviderGradient(provider: string): string {
  const key = provider.toLowerCase();
  return LOGO_GRADIENTS[key] ?? hashFallbackGradient(key);
}