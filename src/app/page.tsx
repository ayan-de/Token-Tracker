"use client";

import { useState, useEffect } from "react";
import { useCodexBar } from "@/hooks/useCodexBar";
import ErrorBanner from "@/components/ErrorBanner";
import ProviderDetail from "@/components/ProviderDetail";
import { getProviderGradient } from "@/lib/utils";
import { PROVIDER_DESCRIPTORS, providerLogo } from "@/lib/dataMapping";

export default function HomePage() {
  const {
    providers,
    costData,
    cliStatus,
    error,
    isRefreshing,
    settings,
    credentials,
    browsers,
    refreshData,
    updateAppSettings,
    addCredential,
    removeCredential,
    importBrowserCookies,
  } = useCodexBar();

  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Modals state
  const [addAccountProvider, setAddAccountProvider] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);

  // Settings Modal states
  const [activeSettingsTab, setActiveSettingsTab] = useState<'general' | 'providers' | 'credentials' | 'import'>('general');
  const [credProvider, setCredProvider] = useState<string>("claude");
  const [credType, setCredType] = useState<'key' | 'cookie'>('key');
  const [credSecret, setCredSecret] = useState<string>("");
  const [importBrowserId, setImportBrowserId] = useState<string>("");
  const [importProfileId, setImportProfileId] = useState<string>("");
  const [importProviderId, setImportProviderId] = useState<string>("claude");

  // Load theme preference on mount and settings load
  useEffect(() => {
    if (settings?.theme) {
      let resolvedTheme: 'dark' | 'light' = 'dark';
      if (settings.theme === 'light') {
        resolvedTheme = 'light';
      } else if (settings.theme === 'dark') {
        resolvedTheme = 'dark';
      } else {
        resolvedTheme = window.matchMedia("(prefers-color-scheme: light)").matches ? 'light' : 'dark';
      }
      setTheme(resolvedTheme);
    } else {
      const savedTheme = localStorage.getItem("theme") as 'dark' | 'light' | null;
      if (savedTheme) {
        setTheme(savedTheme);
      }
    }
  }, [settings?.theme]);

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

  // Populate browser importer defaults when browsers list changes
  useEffect(() => {
    if (browsers && browsers.length > 0) {
      setImportBrowserId((prev) => prev || browsers[0].id);
    }
  }, [browsers]);

  useEffect(() => {
    if (importBrowserId && browsers) {
      const selectedBrowser = browsers.find(b => b.id === importBrowserId);
      if (selectedBrowser && selectedBrowser.profiles && selectedBrowser.profiles.length > 0) {
        setImportProfileId(selectedBrowser.profiles[0].id);
      } else {
        setImportProfileId("");
      }
    }
  }, [importBrowserId, browsers]);

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
        <div className="flex items-center justify-between px-4 pt-3 pb-1 border-b border-border-subtle bg-secondary/20 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <h1 className="text-xs font-black tracking-wider bg-gradient-to-r from-accent-cyan via-accent-blue to-accent-purple bg-clip-text text-transparent font-outfit uppercase">
              TokenTracker
            </h1>
            <span 
              className={`w-1.5 h-1.5 rounded-full ${
                cliStatus.status === "available" ? "bg-status-ok" : "bg-status-warning"
              } animate-pulse`} 
              title={cliStatus.status === "available" ? "Backend Connected" : "Connecting..."}
            />
          </div>
          
          <div className="flex items-center gap-1.5">
            {/* Theme Mode Toggle Button */}
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-1 rounded-lg bg-bg-subtle hover:bg-hover-subtle text-text-muted hover:text-text-main transition-all cursor-pointer border-0 outline-none focus:outline-none focus:bg-bg-subtle focus:text-text-main"
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
              className={`p-1 rounded-lg bg-bg-subtle hover:bg-hover-subtle text-text-muted hover:text-text-main transition-all cursor-pointer border-0 outline-none focus:outline-none focus:bg-bg-subtle focus:text-text-main ${
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

        <ErrorBanner message={error} />

        {providers.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1">
            <div className="w-7 h-7 border-2 border-accent-blue border-t-transparent rounded-full animate-spin mb-3" />
            <span className="text-xs text-text-muted font-medium">Syncing quotas from backend...</span>
          </div>
        ) : (
          <>
            {/* Horizontal Tabs Switcher */}
            <div className="flex items-center gap-1.5 overflow-x-auto px-4 py-2.5 border-b border-border-subtle bg-secondary/10 scrollbar-none">
              {providers.map((p) => {
                const isSelected = selectedProvider === p.provider;
                const desc = PROVIDER_DESCRIPTORS[p.provider.toLowerCase()] || { displayName: p.provider_label };
                return (
                  <button
                    key={p.provider}
                    onClick={() => setSelectedProvider(p.provider)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-300 cursor-pointer border-0 outline-none focus:outline-none ${
                      isSelected
                        ? `bg-accent-blue ${theme === 'light' ? 'text-black' : 'text-white'} shadow-md shadow-accent-blue/15 scale-[1.03] focus:bg-accent-blue ${theme === 'light' ? 'focus:text-black' : 'focus:text-white'}`
                        : "bg-bg-subtle text-text-muted hover:text-text-main hover:bg-hover-subtle focus:bg-bg-subtle focus:text-text-main"
                    }`}
                  >
                    {providerLogo(p.provider, theme) ? (
                      <img
                        src={providerLogo(p.provider, theme)}
                        alt=""
                        className="w-4 h-4 object-contain"
                      />
                    ) : (
                      <div className={`w-1.5 h-1.5 rounded-full bg-gradient-to-r ${getProviderGradient(p.provider)}`} />
                    )}
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
                theme={theme}
                onOpenAddAccountModal={(prov) => setAddAccountProvider(prov)}
                onOpenSettingsModal={() => setSettingsOpen(true)}
                onOpenAboutModal={() => setAboutOpen(true)}
              />
            )}
          </>
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
                After exporting variables, run a refresh or restart TokenTracker to apply.
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
          <div className="w-[480px] h-[450px] bg-secondary border border-border-subtle rounded-xl p-4.5 shadow-2xl flex flex-col overflow-hidden">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border-subtle pb-2">
              <h3 className="text-sm font-bold text-text-main font-outfit">Settings</h3>
              
              {/* Tab Selector */}
              <div className="flex text-[11px] font-bold gap-3 font-outfit">
                <button
                  onClick={() => setActiveSettingsTab('general')}
                  className={`pb-1.5 border-b-2 transition-all cursor-pointer ${
                    activeSettingsTab === 'general'
                      ? "border-accent-blue text-accent-blue"
                      : "border-transparent text-text-muted hover:text-text-main"
                  }`}
                >
                  General
                </button>
                <button
                  onClick={() => setActiveSettingsTab('providers')}
                  className={`pb-1.5 border-b-2 transition-all cursor-pointer ${
                    activeSettingsTab === 'providers'
                      ? "border-accent-blue text-accent-blue"
                      : "border-transparent text-text-muted hover:text-text-main"
                  }`}
                >
                  Providers
                </button>
                <button
                  onClick={() => setActiveSettingsTab('credentials')}
                  className={`pb-1.5 border-b-2 transition-all cursor-pointer ${
                    activeSettingsTab === 'credentials'
                      ? "border-accent-blue text-accent-blue"
                      : "border-transparent text-text-muted hover:text-text-main"
                  }`}
                >
                  Credentials
                </button>
                <button
                  onClick={() => setActiveSettingsTab('import')}
                  className={`pb-1.5 border-b-2 transition-all cursor-pointer ${
                    activeSettingsTab === 'import'
                      ? "border-accent-blue text-accent-blue"
                      : "border-transparent text-text-muted hover:text-text-main"
                  }`}
                >
                  Cookie Import
                </button>
              </div>
            </div>
            
            {/* Scrollable Tab Content */}
            <div className="flex-1 min-h-0 overflow-y-auto py-4 text-xs font-outfit">
              {activeSettingsTab === 'general' && (
                <div className="space-y-4">
                  {/* Theme Mode */}
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-text-muted">Theme Mode</span>
                    <select 
                      value={settings?.theme || "auto"}
                      onChange={async (e) => {
                        if (settings) {
                          await updateAppSettings({ ...settings, theme: e.target.value });
                        }
                      }}
                      className="bg-primary border border-border-subtle rounded-lg px-2.5 py-1.5 text-text-main focus:outline-none text-xs w-[140px]"
                    >
                      <option value="auto">Auto / System</option>
                      <option value="light">Light Theme</option>
                      <option value="dark">Dark Theme</option>
                    </select>
                  </div>

                  {/* Refresh Interval */}
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-text-muted">Refresh Interval</span>
                    <select 
                      value={settings?.refresh_interval_secs ?? 300}
                      onChange={async (e) => {
                        if (settings) {
                          await updateAppSettings({ ...settings, refresh_interval_secs: parseInt(e.target.value) });
                        }
                      }}
                      className="bg-primary border border-border-subtle rounded-lg px-2.5 py-1.5 text-text-main focus:outline-none text-xs w-[140px]"
                    >
                      <option value="60">Every 1 minute</option>
                      <option value="300">Every 5 minutes</option>
                      <option value="900">Every 15 minutes</option>
                      <option value="0">Manual only</option>
                    </select>
                  </div>

                  {/* Desktop Notifications */}
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-text-muted">Desktop Notifications</span>
                    <input
                      type="checkbox"
                      checked={settings?.show_notifications ?? true}
                      onChange={async (e) => {
                        if (settings) {
                          await updateAppSettings({ ...settings, show_notifications: e.target.checked });
                        }
                      }}
                      className="rounded border-border-subtle bg-primary accent-accent-blue focus:ring-0 w-4 h-4 cursor-pointer"
                    />
                  </div>

                  {/* Sound Alerts */}
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-text-muted">Sound Alerts</span>
                    <input
                      type="checkbox"
                      checked={settings?.sound_enabled ?? true}
                      onChange={async (e) => {
                        if (settings) {
                          await updateAppSettings({ ...settings, sound_enabled: e.target.checked });
                        }
                      }}
                      className="rounded border-border-subtle bg-primary accent-accent-blue focus:ring-0 w-4 h-4 cursor-pointer"
                    />
                  </div>

                  {/* Cache Path */}
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-text-muted">Cache Path</span>
                    <span className="text-[10px] font-fira bg-primary/40 px-2 py-1 rounded border border-border-subtle text-text-muted">
                      ~/.config/CodexBar
                    </span>
                  </div>
                </div>
              )}

              {activeSettingsTab === 'providers' && (
                <div className="space-y-3 max-h-[260px] overflow-y-auto pr-1 scrollbar-thin">
                  <p className="text-[11px] text-text-muted pb-1.5 border-b border-border-subtle leading-tight">
                    Select which AI providers to show in the switcher tabs:
                  </p>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    {Object.entries(PROVIDER_DESCRIPTORS).map(([id, desc]) => {
                      const isEnabled = settings?.enabled_providers?.includes(id) ?? false;
                      return (
                        <label key={id} className="flex items-center gap-2 p-2 rounded-lg bg-primary/20 border border-border-subtle hover:border-hover-subtle transition-all cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isEnabled}
                            onChange={async (e) => {
                              if (settings) {
                                let updatedEnabled = [...(settings.enabled_providers || [])];
                                if (e.target.checked) {
                                  if (!updatedEnabled.includes(id)) updatedEnabled.push(id);
                                } else {
                                  updatedEnabled = updatedEnabled.filter(p => p !== id);
                                }
                                await updateAppSettings({ ...settings, enabled_providers: updatedEnabled });
                              }
                            }}
                            className="rounded border-border-subtle bg-primary accent-accent-blue focus:ring-0 w-3.5 h-3.5"
                          />
                          {providerLogo(id, theme) ? (
                            <img src={providerLogo(id, theme)} alt="" className="w-3.5 h-3.5 object-contain" />
                          ) : (
                            <div className="w-1.5 h-1.5 rounded-full bg-accent-blue" />
                          )}
                          <span className="text-[11px] font-medium text-text-main truncate">{desc.displayName}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {activeSettingsTab === 'credentials' && (
                <div className="space-y-4">
                  {/* Saved Credentials List */}
                  <div className="space-y-2">
                    <h4 className="text-[11px] font-bold text-text-main uppercase tracking-wider">Active Credentials</h4>
                    <div className="max-h-[140px] overflow-y-auto border border-border-subtle rounded-lg divide-y divide-border-subtle bg-primary/10">
                      {credentials.length === 0 ? (
                        <div className="p-3 text-center text-text-muted text-[10px]">No credentials configured. Add one below.</div>
                      ) : (
                        credentials.map((cred) => (
                          <div key={`${cred.providerId}-${cred.type}`} className="flex items-center justify-between p-2 text-xs">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="px-1.5 py-0.5 rounded bg-accent-blue/15 text-accent-blue text-[9px] font-semibold uppercase">
                                {cred.type}
                              </span>
                              <span className="font-bold text-text-main truncate">{cred.provider}</span>
                              <span className="text-[10px] text-text-muted truncate max-w-[140px] font-fira">{cred.maskedSecret}</span>
                            </div>
                            <button
                              onClick={() => removeCredential(cred.providerId)}
                              className="p-1 text-status-error hover:bg-status-error/10 rounded transition-colors cursor-pointer border-0 outline-none"
                              title="Delete credential"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Add New Form */}
                  <div className="p-3 bg-primary/20 border border-border-subtle rounded-lg space-y-2.5">
                    <h4 className="text-[10px] font-bold text-text-main uppercase tracking-wider">Add Credential</h4>
                    <div className="flex gap-2">
                      <select
                        value={credProvider}
                        onChange={(e) => setCredProvider(e.target.value)}
                        className="bg-primary border border-border-subtle rounded-lg px-2 py-1.5 text-text-main text-xs focus:outline-none flex-1"
                      >
                        {Object.entries(PROVIDER_DESCRIPTORS).map(([id, desc]) => (
                          <option key={id} value={id}>{desc.displayName}</option>
                        ))}
                      </select>
                      <select
                        value={credType}
                        onChange={(e) => setCredType(e.target.value as 'key' | 'cookie')}
                        className="bg-primary border border-border-subtle rounded-lg px-2 py-1.5 text-text-main text-xs focus:outline-none flex-1"
                      >
                        <option value="key">API Key</option>
                        <option value="cookie">Manual Cookie</option>
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        placeholder={credType === "key" ? "Paste API Key..." : "Paste Cookie Header (e.g. session=...)"}
                        value={credSecret}
                        onChange={(e) => setCredSecret(e.target.value)}
                        className="bg-primary border border-border-subtle rounded-lg px-3 py-1.5 text-text-main text-xs focus:outline-none flex-1 font-fira"
                      />
                      <button
                        onClick={async () => {
                          if (!credSecret.trim()) return;
                          const success = await addCredential(credProvider, credSecret.trim(), credType);
                          if (success) {
                            setCredSecret("");
                          }
                        }}
                        className="px-3 bg-accent-blue hover:bg-hover-subtle hover:text-text-main text-xs font-semibold rounded-lg text-white transition-colors cursor-pointer border-0"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeSettingsTab === 'import' && (
                <div className="space-y-4">
                  <p className="text-[11px] text-text-muted leading-relaxed">
                    Import session cookies automatically from your installed desktop browsers to authenticate providers without typing passwords.
                  </p>

                  {browsers.length === 0 ? (
                    <div className="p-6 text-center border border-dashed border-border-subtle rounded-xl text-text-muted text-[11px]">
                      No compatible Chromium or Firefox browsers detected on your system.
                    </div>
                  ) : (
                    <div className="space-y-3.5 p-3 bg-primary/20 border border-border-subtle rounded-lg">
                      {/* Browser Selector */}
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-text-main uppercase tracking-wide">1. Select Browser</label>
                        <select
                          value={importBrowserId}
                          onChange={(e) => setImportBrowserId(e.target.value)}
                          className="bg-primary border border-border-subtle rounded-lg px-2.5 py-1.5 text-text-main text-xs focus:outline-none"
                        >
                          {browsers.map((b) => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                          ))}
                        </select>
                      </div>

                      {/* Profile Selector */}
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-text-main uppercase tracking-wide">2. Select Profile</label>
                        <select
                          value={importProfileId}
                          onChange={(e) => setImportProfileId(e.target.value)}
                          className="bg-primary border border-border-subtle rounded-lg px-2.5 py-1.5 text-text-main text-xs focus:outline-none"
                          disabled={!importBrowserId || !browsers.find(b => b.id === importBrowserId)?.profiles?.length}
                        >
                          {browsers.find(b => b.id === importBrowserId)?.profiles?.map((p: any) => (
                            <option key={p.id} value={p.id}>
                              {p.name} {p.isDefault ? "(Default)" : ""}
                            </option>
                          )) || <option>No profiles found</option>}
                        </select>
                      </div>

                      {/* Provider Selector */}
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-text-main uppercase tracking-wide">3. Target AI Provider</label>
                        <select
                          value={importProviderId}
                          onChange={(e) => setImportProviderId(e.target.value)}
                          className="bg-primary border border-border-subtle rounded-lg px-2.5 py-1.5 text-text-main text-xs focus:outline-none"
                        >
                          {Object.entries(PROVIDER_DESCRIPTORS)
                            .filter(([id]) => ["claude", "codex", "cursor", "gemini", "copilot"].includes(id))
                            .map(([id, desc]) => (
                              <option key={id} value={id}>{desc.displayName}</option>
                            ))}
                        </select>
                      </div>

                      <button
                        onClick={async () => {
                          if (!importBrowserId || !importProfileId || !importProviderId) return;
                          await importBrowserCookies(importBrowserId, importProfileId, importProviderId);
                        }}
                        className="w-full py-2 bg-gradient-to-r from-accent-cyan via-accent-blue to-accent-purple text-white hover:opacity-90 active:opacity-100 transition-opacity text-xs font-bold rounded-lg shadow-lg shadow-accent-blue/10 cursor-pointer border-0 mt-1"
                      >
                        Import & Sync Cookies
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {/* Footer */}
            <div className="border-t border-border-subtle pt-2.5">
              <button
                onClick={() => setSettingsOpen(false)}
                className="w-full py-1.5 bg-bg-subtle hover:bg-hover-subtle text-xs font-semibold rounded-lg text-text-main border border-border-subtle transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* About Modal */}
      {aboutOpen && (
        <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-[320px] bg-secondary border border-border-subtle rounded-xl p-4 shadow-2xl text-center space-y-4">
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-accent-cyan via-accent-blue to-accent-purple flex items-center justify-center shadow-lg shadow-accent-blue/20 text-white font-extrabold text-lg tracking-wider mb-2 font-outfit">
                TT
              </div>
              <h3 className="text-sm font-bold text-text-main leading-tight">TokenTracker Desktop</h3>
              <span className="text-[10px] text-text-muted">v0.1.0 (Beta) - Linux client</span>
            </div>
            
            <p className="text-xs text-text-muted/85 leading-relaxed font-outfit max-w-[260px] mx-auto">
              A premium cross-platform port of CodexBar (TokenTracker) for monitoring LLM quota, rate limit, and spend statistics. Original macOS app by Peter Steinberger.
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