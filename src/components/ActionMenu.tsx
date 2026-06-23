"use client";

import type { ProviderUsage } from "@/lib/types";
import { invoke } from "@tauri-apps/api/core";

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
        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
        </svg>
        <span>Add Account...</span>
      </button>

      {/* Usage Dashboard */}
      <button
        onClick={() => handleOpenUrl(urls.dashboard)}
        className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-hover-subtle text-text-muted hover:text-text-main transition-all text-left cursor-pointer focus:bg-hover-subtle focus:text-text-main focus:outline-none"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <span>Usage Dashboard</span>
      </button>

      {/* Status Page */}
      <button
        onClick={() => handleOpenUrl(urls.statusPage)}
        className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-hover-subtle text-text-muted hover:text-text-main transition-all text-left cursor-pointer focus:bg-hover-subtle focus:text-text-main focus:outline-none"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
        <span>Status Page</span>
      </button>

      <div className="h-px bg-border-subtle my-1.5" />

      {/* Settings... */}
      <button
        onClick={onOpenSettingsModal}
        className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-hover-subtle text-text-muted hover:text-text-main transition-all text-left cursor-pointer focus:bg-hover-subtle focus:text-text-main focus:outline-none"
      >
        <span>Settings...</span>
      </button>

      {/* About TokenTracker */}
      <button
        onClick={onOpenAboutModal}
        className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-hover-subtle text-text-muted hover:text-text-main transition-all text-left cursor-pointer focus:bg-hover-subtle focus:text-text-main focus:outline-none"
      >
        <span>About TokenTracker</span>
      </button>

      {/* Quit */}
      <button
        onClick={handleQuit}
        className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-hover-subtle text-text-muted hover:text-status-danger transition-all text-left cursor-pointer focus:bg-hover-subtle focus:text-status-danger focus:outline-none"
      >
        <span>Quit</span>
      </button>
    </div>
  );
}
