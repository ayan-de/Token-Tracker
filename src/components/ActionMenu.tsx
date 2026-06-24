"use client";

import type { ProviderUsage } from "@/lib/types";
import { invoke } from "@tauri-apps/api/core";
import { Key, BarChart3, Heart, Settings, Info, LogOut } from "@/lib/icons";

export const PROVIDER_URLS: Record<string, { dashboard: string; statusPage: string }> = {
  claude: { dashboard: "https://claude.ai/settings/usage", statusPage: "https://status.claude.com/" },
  gemini: { dashboard: "https://aistudio.google.com/", statusPage: "https://status.cloud.google.com/" },
  antigravity: { dashboard: "https://aistudio.google.com/", statusPage: "https://status.cloud.google.com/" },
  codex: { dashboard: "https://platform.openai.com/usage", statusPage: "https://status.openai.com/" },
  cursor: { dashboard: "https://www.cursor.com/settings", statusPage: "https://status.cursor.com/" },
  copilot: { dashboard: "https://github.com/settings/copilot", statusPage: "https://www.githubstatus.com/" },
  openrouter: { dashboard: "https://openrouter.ai/activity", statusPage: "https://status.openrouter.ai/" },
  deepseek: { dashboard: "https://platform.deepseek.com/usage", statusPage: "https://status.deepseek.com/" },
  groq: { dashboard: "https://console.groq.com/usage", statusPage: "https://status.groq.com/" },
  ollama: { dashboard: "http://localhost:11434/", statusPage: "https://github.com/ollama/ollama" },
};

interface ActionMenuProps {
  provider: ProviderUsage;
  onOpenAddAccountModal: (provider: string) => void;
  onOpenSettingsModal: () => void;
  onOpenAboutModal: () => void;
}

export default function ActionMenu({
  provider: p,
  onOpenAddAccountModal,
  onOpenSettingsModal,
  onOpenAboutModal,
}: ActionMenuProps) {
  const urls = PROVIDER_URLS[p.provider.toLowerCase()] || {
    dashboard: "https://github.com/steipete/CodexBar",
    statusPage: "https://github.com/steipete/CodexBar",
  };

  const handleOpenUrl = async (url: string) => {
    try {
      await invoke("plugin:opener|open", { path: url });
    } catch (err) {
      console.error("Failed to open URL via Tauri:", err);
    }
  };

  const handleQuit = async () => {
    try {
      await invoke("quit_app");
    } catch (err) {
      console.error("Failed to quit app:", err);
    }
  };

  return (
    <div className="py-2 space-y-1 text-xs">
      {/* Add Account... */}
      <button
        onClick={() => onOpenAddAccountModal(p.provider)}
        className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-hover-subtle text-text-muted hover:text-text-main transition-all text-left cursor-pointer focus:bg-hover-subtle focus:text-text-main focus:outline-none"
      >
        <Key className="w-3.5 h-3.5" />
        <span>Add Account</span>
      </button>

      {/* Usage Dashboard */}
      <button
        onClick={() => handleOpenUrl(urls.dashboard)}
        className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-hover-subtle text-text-muted hover:text-text-main transition-all text-left cursor-pointer focus:bg-hover-subtle focus:text-text-main focus:outline-none"
      >
        <BarChart3 className="w-3.5 h-3.5" />
        <span>Usage Dashboard</span>
      </button>

      {/* Status Page */}
      <button
        onClick={() => handleOpenUrl(urls.statusPage)}
        className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-hover-subtle text-text-muted hover:text-text-main transition-all text-left cursor-pointer focus:bg-hover-subtle focus:text-text-main focus:outline-none"
      >
        <Heart className="w-3.5 h-3.5" />
        <span>Status Page</span>
      </button>

      <div className="h-px bg-border-subtle my-1.5" />

      {/* Settings... */}
      <button
        onClick={onOpenSettingsModal}
        className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-hover-subtle text-text-muted hover:text-text-main transition-all text-left cursor-pointer focus:bg-hover-subtle focus:text-text-main focus:outline-none"
      >
        <Settings className="w-3.5 h-3.5" />
        <span>Settings</span>
      </button>

      {/* About TokenTracker */}
      <button
        onClick={onOpenAboutModal}
        className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-hover-subtle text-text-muted hover:text-text-main transition-all text-left cursor-pointer focus:bg-hover-subtle focus:text-text-main focus:outline-none"
      >
        <Info className="w-3.5 h-3.5" />
        <span>About TokenTracker</span>
      </button>

      {/* Quit */}
      <button
        onClick={handleQuit}
        className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-hover-subtle text-text-muted hover:text-status-danger transition-all text-left cursor-pointer focus:bg-hover-subtle focus:text-status-danger focus:outline-none"
      >
        <LogOut className="w-3.5 h-3.5" />
        <span>Quit</span>
      </button>
    </div>
  );
}
