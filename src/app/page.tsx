"use client";

import { useState, useEffect } from "react";
import { useCodexBar } from "@/hooks/useCodexBar";
import ErrorBanner from "@/components/ErrorBanner";
import ProviderDetail from "@/components/ProviderDetail";
import CLITerminal from "@/components/CLITerminal";
import InstallOverlay from "@/components/InstallOverlay";
import { getProviderGradient } from "@/lib/utils";
import { PROVIDER_DESCRIPTORS } from "@/lib/dataMapping";

export default function HomePage() {
  const {
    providers,
    costData,
    cliStatus,
    error,
    isRefreshing,
    refreshData,
  } = useCodexBar();

  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Modals state
  const [addAccountProvider, setAddAccountProvider] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);

  const showInstallOverlay = cliStatus.status === "not_installed";

  // Load theme preference on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") as 'dark' | 'light' | null;
    if (savedTheme) {
      setTheme(savedTheme);
    }
  }, []);

  // Update theme class on HTML element when theme changes
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'light') {
      root.classList.add('light-mode');
    } else {
      root.classList.remove('light-mode');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Default select first provider when data loads
  useEffect(() => {
    if (providers.length > 0 && !selectedProvider) {
      setSelectedProvider(providers[0].provider);
    }
  }, [providers, selectedProvider]);

  const activeProviderObj = providers.find((p) => p.provider === selectedProvider);
  const activeCostItem = costData.find(
    (c) => c.provider.toLowerCase() === selectedProvider?.toLowerCase()
  );

  return (
    <div className="relative flex flex-col h-screen w-screen bg-primary text-text-main overflow-hidden font-outfit select-none">
      
      {/* Premium background gradient blobs */}
      <div className="absolute top-[-10%] left-[-15%] w-[70%] h-[50%] bg-accent-blue/10 rounded-full blur-[90px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-15%] w-[70%] h-[50%] bg-accent-purple/10 rounded-full blur-[90px] pointer-events-none" />

      {/* Main Container */}
      <div className="relative flex flex-col flex-1 min-h-0 z-10">
        
        {/* App Title & Refresh Bar */}
        {!showInstallOverlay && (
          <div className="flex items-center justify-between px-4 pt-3 pb-1 border-b border-border-subtle bg-secondary/20 backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <h1 className="text-xs font-black tracking-wider bg-gradient-to-r from-accent-cyan via-accent-blue to-accent-purple bg-clip-text text-transparent font-outfit uppercase">
                CodexBar
              </h1>
              <span 
                className={`w-1.5 h-1.5 rounded-full ${
                  cliStatus.status === "available" ? "bg-status-ok" : "bg-status-warning"
                } animate-pulse`} 
                title={cliStatus.status === "available" ? "CLI Connected" : "Connecting..."}
              />
            </div>
            
            <div className="flex items-center gap-1.5">
              {/* Theme Mode Toggle Button */}
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="p-1 rounded-lg bg-bg-subtle hover:bg-hover-subtle text-text-muted hover:text-text-main transition-all cursor-pointer"
                title={theme === 'dark' ? "Switch to Light Mode" : "Switch to Dark Mode"}
              >
                {theme === 'dark' ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m12.728 12.728l.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                )}
              </button>

              {/* Refresh Button */}
              <button
                onClick={refreshData}
                disabled={isRefreshing}
                className={`p-1 rounded-lg bg-bg-subtle hover:bg-hover-subtle text-text-muted hover:text-text-main transition-all cursor-pointer ${
                  isRefreshing ? "animate-spin text-accent-blue" : ""
                }`}
                title="Refresh AI quotas"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
          </div>
        )}

        <ErrorBanner message={error} />

        {showInstallOverlay ? (
          <InstallOverlay onInstalled={refreshData} />
        ) : providers.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1">
            <div className="w-7 h-7 border-2 border-accent-blue border-t-transparent rounded-full animate-spin mb-3" />
            <span className="text-xs text-text-muted font-medium">Syncing quotas from CLI...</span>
          </div>
        ) : (
          <>
            {/* Horizontal Tabs Switcher (like macOS popover top tab list) */}
            <div className="flex items-center gap-1.5 overflow-x-auto px-4 py-2.5 border-b border-border-subtle bg-secondary/10 scrollbar-none">
              {providers.map((p) => {
                const isSelected = selectedProvider === p.provider;
                const desc = PROVIDER_DESCRIPTORS[p.provider.toLowerCase()] || { displayName: p.provider_label };
                return (
                  <button
                    key={p.provider}
                    onClick={() => setSelectedProvider(p.provider)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-300 cursor-pointer ${
                      isSelected
                        ? "bg-accent-blue text-white shadow-md shadow-accent-blue/15 scale-[1.03]"
                        : "bg-bg-subtle text-text-muted hover:text-text-main hover:bg-hover-subtle"
                    }`}
                  >
                    <div className={`w-1.5 h-1.5 rounded-full bg-gradient-to-r ${getProviderGradient(p.provider)}`} />
                    <span>{desc.displayName}</span>
                  </button>
                );
              })}
            </div>

            {/* Provider detail area */}
            {activeProviderObj && (
              <ProviderDetail
                provider={activeProviderObj}
                costItem={activeCostItem}
                onOpenAddAccountModal={(prov) => setAddAccountProvider(prov)}
                onOpenSettingsModal={() => setSettingsOpen(true)}
                onOpenAboutModal={() => setAboutOpen(true)}
              />
            )}
          </>
        )}

        {/* Collapsible Terminal Drawer */}
        {!showInstallOverlay && (
          <div className="flex flex-col border-t border-border-subtle bg-secondary/20 backdrop-blur-md">
            <button
              onClick={() => setTerminalOpen(!terminalOpen)}
              className="flex items-center justify-center gap-1.5 py-1.5 text-text-muted hover:text-text-main text-[10px] font-bold tracking-wide uppercase transition-colors cursor-pointer"
            >
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className={`w-3 h-3 transition-transform duration-300 ${terminalOpen ? "rotate-180 text-accent-cyan" : ""}`} 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor" 
                strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
              <span>CLI Console drawer</span>
            </button>
            
            {terminalOpen && (
              <div className="max-h-[180px] overflow-y-auto pb-2">
                <CLITerminal onCommandExecuted={refreshData} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* --- Modals / Interactive Overlay Dialogs --- */}

      {/* Add Account Modal */}
      {addAccountProvider && (
        <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-[320px] bg-secondary border border-border-subtle rounded-xl p-4 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 border-b border-border-subtle pb-2">
              <span className={`w-3 h-3 rounded-full bg-gradient-to-br ${getProviderGradient(addAccountProvider)}`} />
              <h3 className="text-sm font-bold text-text-main">
                Configure {PROVIDER_DESCRIPTORS[addAccountProvider.toLowerCase()]?.displayName || addAccountProvider}
              </h3>
            </div>
            
            <div className="text-xs text-text-muted space-y-2 leading-relaxed font-outfit">
              <p>To configure this provider, you can set the environment credentials or login via the CLI.</p>
              
              <div className="bg-primary/50 p-2 rounded-lg border border-border-subtle font-fira text-[11px] text-accent-cyan break-all">
                {addAccountProvider.toLowerCase() === "claude" && (
                  <>
                    export ANTHROPIC_API_KEY="..."<br />
                    # Or run:<br />
                    claude login
                  </>
                )}
                {addAccountProvider.toLowerCase() === "gemini" && (
                  <>
                    export GEMINI_API_KEY="..."<br />
                    # Or run:<br />
                    gemini login
                  </>
                )}
                {addAccountProvider.toLowerCase() === "antigravity" && (
                  <>
                    export GEMINI_API_KEY="..."
                  </>
                )}
                {addAccountProvider.toLowerCase() === "openai" && (
                  <>
                    export OPENAI_API_KEY="..."<br />
                    # Or run:<br />
                    codex login
                  </>
                )}
                {!["claude", "gemini", "antigravity", "openai"].includes(addAccountProvider.toLowerCase()) && (
                  <>
                    # Set the provider's API key<br />
                    # e.g., export DEEPSEEK_API_KEY="..."
                  </>
                )}
              </div>
              <p className="text-[10px] text-text-muted/70">
                After exporting variables, run a refresh or restart CodexBar to apply.
              </p>
            </div>
            
            <button
              onClick={() => setAddAccountProvider(null)}
              className="w-full py-1.5 bg-bg-subtle hover:bg-hover-subtle text-xs font-semibold rounded-lg text-text-main border border-border-subtle transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {settingsOpen && (
        <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-[320px] bg-secondary border border-border-subtle rounded-xl p-4 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-text-main border-b border-border-subtle pb-2">Settings</h3>
            
            <div className="space-y-3 text-xs text-text-muted font-outfit">
              <div className="flex items-center justify-between">
                <span>Theme Mode</span>
                <select 
                  value={theme}
                  onChange={(e) => setTheme(e.target.value as 'dark' | 'light')}
                  className="bg-primary border border-border-subtle rounded px-2 py-1 text-text-main focus:outline-none"
                >
                  <option value="dark">Dark Theme</option>
                  <option value="light">Light Theme</option>
                </select>
              </div>
              <div className="flex items-center justify-between">
                <span>Refresh Interval</span>
                <select className="bg-primary border border-border-subtle rounded px-2 py-1 text-text-main focus:outline-none">
                  <option>Every 1 minute</option>
                  <option>Every 5 minutes</option>
                  <option>Manual only</option>
                </select>
              </div>
              <div className="flex items-center justify-between">
                <span>Cache Path</span>
                <span className="text-[10px] font-fira text-text-muted/80">~/.codexbar-desktop</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Show CLI Terminal</span>
                <input 
                  type="checkbox" 
                  checked={terminalOpen} 
                  onChange={(e) => setTerminalOpen(e.target.checked)}
                  className="rounded border-border-subtle bg-primary accent-accent-blue focus:ring-0 w-3.5 h-3.5"
                />
              </div>
            </div>
            
            <button
              onClick={() => setSettingsOpen(false)}
              className="w-full py-1.5 bg-bg-subtle hover:bg-hover-subtle text-xs font-semibold rounded-lg text-text-main border border-border-subtle transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* About Modal */}
      {aboutOpen && (
        <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-[320px] bg-secondary border border-border-subtle rounded-xl p-4 shadow-2xl text-center space-y-4">
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-accent-cyan via-accent-blue to-accent-purple flex items-center justify-center shadow-lg shadow-accent-blue/20 text-white font-extrabold text-lg tracking-wider mb-2 font-outfit">
                CB
              </div>
              <h3 className="text-sm font-bold text-text-main leading-tight">CodexBar Desktop</h3>
              <span className="text-[10px] text-text-muted">v0.1.0 (Beta) - Linux client</span>
            </div>
            
            <p className="text-xs text-text-muted/85 leading-relaxed font-outfit max-w-[260px] mx-auto">
              A premium cross-platform port of CodexBar for monitoring LLM quota, rate limit, and spend statistics. Original macOS app by Peter Steinberger.
            </p>
            
            <button
              onClick={() => setAboutOpen(false)}
              className="w-full py-1.5 bg-bg-subtle hover:bg-hover-subtle text-xs font-semibold rounded-lg text-text-main border border-border-subtle transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}

    </div>
  );
}