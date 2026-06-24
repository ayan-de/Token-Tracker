"use client";

import { useState, useEffect } from "react";
import { useCodexBar } from "@/hooks/useCodexBar";
import ErrorBanner from "@/components/ErrorBanner";
import ProviderDetail from "@/components/ProviderDetail";
import ProviderHeader from "@/components/ProviderHeader";
import ProviderTabBar from "@/components/ProviderTabBar";
import SettingsModal from "@/components/SettingsModal";
import AddAccountModal from "@/components/AddAccountModal";
import AboutModal from "@/components/AboutModal";

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
    installedProviders,
    refreshData,
    updateAppSettings,
    addCredential,
    removeCredential,
    importBrowserCookies,
    refetchBrowsers,
  } = useCodexBar();

  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Modals state
  const [addAccountProvider, setAddAccountProvider] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);

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
        <ProviderHeader
          cliStatus={cliStatus}
          isRefreshing={isRefreshing}
          theme={theme}
          onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          onRefresh={refreshData}
        />

        <ErrorBanner message={error} />

        {providers.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1">
            <div className="w-7 h-7 border-2 border-accent-blue border-t-transparent rounded-full animate-spin mb-3" />
            <span className="text-xs text-text-muted font-medium">Syncing quotas from backend...</span>
          </div>
        ) : (
          <>
            {/* Horizontal Tabs Switcher */}
            <ProviderTabBar
              providers={providers}
              selectedProvider={selectedProvider}
              onSelectProvider={setSelectedProvider}
              theme={theme}
            />

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
        <AddAccountModal
          provider={addAccountProvider}
          onClose={() => setAddAccountProvider(null)}
        />
      )}

      {/* Settings Modal */}
      {settingsOpen && (
        <SettingsModal
          settings={settings}
          credentials={credentials}
          browsers={browsers}
          installedProviders={installedProviders}
          theme={theme}
          onClose={() => setSettingsOpen(false)}
          onUpdateSettings={updateAppSettings}
          onAddCredential={addCredential}
          onRemoveCredential={removeCredential}
          onImportCookies={importBrowserCookies}
          onRefetchBrowsers={refetchBrowsers}
        />
      )}

      {/* About Modal */}
      {aboutOpen && (
        <AboutModal
          onClose={() => setAboutOpen(false)}
        />
      )}

    </div>
  );
}
