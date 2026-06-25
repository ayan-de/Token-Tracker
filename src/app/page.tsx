"use client";

import { useState, useEffect, useMemo, useCallback, createContext, useContext } from "react";
import { useCodexBar } from "@/hooks/useCodexBar";
import ErrorBanner from "@/components/ErrorBanner";
import ProviderDetail from "@/components/ProviderDetail";
import ProviderHeader from "@/components/ProviderHeader";
import ProviderTabBar from "@/components/ProviderTabBar";
import SettingsModal from "@/components/SettingsModal";
import AddAccountModal from "@/components/AddAccountModal";
import AboutModal from "@/components/AboutModal";

// Theme Context - industry standard pattern
interface ThemeContextValue {
  theme: 'dark' | 'light';
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  toggleTheme: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

// Modal Context - decouples modal state from components
interface ModalContextValue {
  openAddAccount: (provider: string) => void;
  openSettings: () => void;
  openAbout: () => void;
}

const ModalContext = createContext<ModalContextValue>({
  openAddAccount: () => {},
  openSettings: () => {},
  openAbout: () => {},
});

export function useModals() {
  return useContext(ModalContext);
}

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

  // Memoize filtered providers to avoid recomputation on every render
  const enabledProviders = useMemo(() =>
    providers.filter(p => settings?.enabled_providers?.includes(p.provider)),
    [providers, settings?.enabled_providers]
  );

  // Create a stable Map for O(1) provider lookup by name - prevents .find() creating new refs
  const providersMap = useMemo(() => {
    const map = new Map<string, typeof providers[0]>();
    for (const p of providers) {
      map.set(p.provider, p);
    }
    return map;
  }, [providers]);

  // Create a stable Map for cost lookup
  const costMap = useMemo(() => {
    const map = new Map<string, typeof costData[0]>();
    for (const c of costData) {
      map.set(c.provider.toLowerCase(), c);
    }
    return map;
  }, [costData]);

  // Auto-select first enabled provider if current selection is disabled
  useEffect(() => {
    if (enabledProviders.length > 0 && selectedProvider && !enabledProviders.some(p => p.provider === selectedProvider)) {
      setSelectedProvider(enabledProviders[0].provider);
    }
  }, [enabledProviders, selectedProvider]);

  // Stable provider reference via Map lookup - same reference even after re-renders
  const activeProviderObj = selectedProvider ? providersMap.get(selectedProvider) ?? null : null;

  // Stable cost reference via Map lookup
  const activeCostItem = selectedProvider ? costMap.get(selectedProvider.toLowerCase()) ?? undefined : undefined;

  // Stable callback for provider selection
  const handleSelectProvider = useCallback((provider: string) => {
    setSelectedProvider(provider);
  }, []);

  // Stable callbacks for modal handlers
  const handleOpenAddAccountModal = useCallback((prov: string) => {
    setAddAccountProvider(prov);
  }, []);

  const handleOpenSettingsModal = useCallback(() => {
    setSettingsOpen(true);
  }, []);

  const handleOpenAboutModal = useCallback(() => {
    setAboutOpen(true);
  }, []);

  const handleCloseAddAccountModal = useCallback(() => {
    setAddAccountProvider(null);
  }, []);

  const handleCloseSettingsModal = useCallback(() => {
    setSettingsOpen(false);
  }, []);

  const handleCloseAboutModal = useCallback(() => {
    setAboutOpen(false);
  }, []);

  // Stable callback for theme toggle
  const handleToggleTheme = useCallback(() => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  }, []);

  // Theme context value - only changes when theme actually changes
  const themeContextValue = useMemo(() => ({
    theme,
    toggleTheme: handleToggleTheme,
  }), [theme, handleToggleTheme]);

  // Modal context value - stable callbacks for modal management
  const modalContextValue = useMemo(() => ({
    openAddAccount: handleOpenAddAccountModal,
    openSettings: handleOpenSettingsModal,
    openAbout: handleOpenAboutModal,
  }), [handleOpenAddAccountModal, handleOpenSettingsModal, handleOpenAboutModal]);

  return (
    <ThemeContext.Provider value={themeContextValue}>
      <ModalContext.Provider value={modalContextValue}>
      <div className="relative flex flex-col h-screen w-screen bg-primary text-text-main overflow-hidden font-outfit select-none">

        {/* Premium background gradient blobs */}
        <div className="absolute top-[-10%] left-[-15%] w-[70%] h-[50%] bg-accent-blue/10 rounded-full blur-[90px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-15%] w-[70%] h-[50%] bg-accent-purple/10 rounded-full blur-[90px] pointer-events-none" />

        {/* Main Container */}
        <div className="relative flex flex-col flex-1 min-h-0 z-10">

          {/* App Title & Refresh Bar */}
          {/* <ProviderHeader
            cliStatus={cliStatus}
            isRefreshing={isRefreshing}
            onRefresh={refreshData}
          /> */}

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
                providers={enabledProviders}
                selectedProvider={selectedProvider}
                onSelectProvider={handleSelectProvider}
              />

              {/* Provider detail area */}
              {activeProviderObj && (
                <ProviderDetail
                  provider={activeProviderObj}
                  costItem={activeCostItem}
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
            onClose={handleCloseAddAccountModal}
          />
        )}

        {/* Settings Modal */}
        {settingsOpen && (
          <SettingsModal
            settings={settings}
            credentials={credentials}
            browsers={browsers}
            installedProviders={installedProviders}
            onClose={handleCloseSettingsModal}
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
            onClose={handleCloseAboutModal}
          />
        )}

      </div>
      </ModalContext.Provider>
    </ThemeContext.Provider>
  );
}
