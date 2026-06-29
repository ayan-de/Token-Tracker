"use client";

import { useState, useEffect } from "react";
import { PROVIDER_DESCRIPTORS, providerLogo, CredentialField } from "@/lib/dataMapping";
import { Trash2, Check } from "@/lib/icons";
import { useTheme } from "@/app/page";

interface SettingsModalProps {
  settings: any | null;
  credentials: any[];
  browsers: any[];
  installedProviders: string[];
  onClose: () => void;
  onUpdateSettings: (newSettings: any) => Promise<boolean>;
  onAddCredential: (provider: string, secret: string, type: "key" | "cookie", fields?: Record<string, string>) => Promise<boolean>;
  onRemoveCredential: (provider: string) => Promise<boolean>;
  onImportCookies: (browserId: string, profileId: string, providerId: string) => Promise<boolean>;
  onRefetchBrowsers: () => Promise<void>;
}

export default function SettingsModal({
  settings,
  credentials,
  browsers,
  installedProviders,
  onClose,
  onUpdateSettings,
  onAddCredential,
  onRemoveCredential,
  onImportCookies,
  onRefetchBrowsers,
}: SettingsModalProps) {
  const { theme } = useTheme();
  const [activeSettingsTab, setActiveSettingsTab] = useState<'general' | 'providers' | 'credentials' | 'import'>('general');
  const [credProvider, setCredProvider] = useState<string>("claude");
  const [credType, setCredType] = useState<'key' | 'cookie'>('key');
  const [credSecret, setCredSecret] = useState<string>("");

  // Auto-select cookie type for cookie-only providers (no api_key field)
  useEffect(() => {
    const desc = PROVIDER_DESCRIPTORS[credProvider];
    const fields = desc?.credentialFields;
    const hasApiKey = fields ? Object.values(fields as unknown as CredentialField[]).some(f => f.key === 'api_key') : false;
    if (!hasApiKey) {
      setCredType('cookie');
    }
  }, [credProvider]);
  const [credExtraFields, setCredExtraFields] = useState<Record<string, string>>({});
  const [importBrowserId, setImportBrowserId] = useState<string>("");
  const [importProfileId, setImportProfileId] = useState<string>("");
  const [importProviderId, setImportProviderId] = useState<string>("claude");

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

  // Auto-check all installed providers on first run when enabled_providers is empty
  useEffect(() => {
    if (settings && Array.isArray(settings.enabled_providers) && settings.enabled_providers.length === 0) {
      onUpdateSettings({ ...settings, enabled_providers: [...installedProviders] });
    }
  }, [settings, installedProviders]);

  // Reset extra credential fields when provider changes
  useEffect(() => {
    setCredExtraFields({});
    setCredSecret("");
  }, [credProvider]);

  return (
    <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-[480px] h-[450px] bg-secondary border border-border-subtle rounded-sm p-4.5 shadow-2xl flex flex-col overflow-hidden">

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
                      await onUpdateSettings({ ...settings, theme: e.target.value });
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
                      await onUpdateSettings({ ...settings, refresh_interval_secs: parseInt(e.target.value) });
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
                      await onUpdateSettings({ ...settings, show_notifications: e.target.checked });
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
                      await onUpdateSettings({ ...settings, sound_enabled: e.target.checked });
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
                    <label key={id} className="flex items-center gap-2 p-2 rounded-sm bg-primary/20 border border-border-subtle hover:border-hover-subtle transition-all cursor-pointer">
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
                            await onUpdateSettings({ ...settings, enabled_providers: updatedEnabled });
                          }
                        }}
                        className="rounded border-border-subtle bg-primary accent-accent-blue focus:ring-0 w-3 h-3"
                      />
                      {providerLogo(id, theme) ? (
                        <img src={providerLogo(id, theme)} alt="" className="w-3.5 h-3.5 object-contain" />
                      ) : (
                        <div className="w-1.5 h-1.5 rounded-full bg-accent-blue" />
                      )}
                      <div className="flex items-center justify-between flex-1 min-w-0">
                        <span className="text-[11px] font-medium text-text-main truncate">
                          {desc.displayName}
                        </span>
                        {installedProviders.includes(id) && (
                          <Check className="w-3 h-3 text-accent-blue flex-shrink-0" />
                        )}
                      </div>
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
                          onClick={() => onRemoveCredential(cred.providerId)}
                          className="p-1 text-status-error hover:bg-status-error/10 rounded transition-colors cursor-pointer border-0 outline-none"
                          title="Delete credential"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
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
                  {(() => {
                    const desc = PROVIDER_DESCRIPTORS[credProvider];
                    if (desc?.credentialFields) {
                      const fieldEntries = Object.values(desc.credentialFields) as CredentialField[];
                      const hasApiKey = fieldEntries.some(f => f.key === 'api_key');
                      // If no api_key field, it's cookie-only — skip type dropdown
                      if (!hasApiKey) return null;
                      return (
                        <select
                          value={credType}
                          onChange={(e) => setCredType(e.target.value as 'key' | 'cookie')}
                          className="bg-primary border border-border-subtle rounded-lg px-2 py-1.5 text-text-main text-xs focus:outline-none flex-1"
                        >
                          <option value="key">API Key</option>
                          <option value="cookie">Manual Cookie</option>
                        </select>
                      );
                    }
                    return null;
                  })()}
                </div>

                {(() => {
                  const desc = PROVIDER_DESCRIPTORS[credProvider];
                  const fields = desc?.credentialFields;
                  if (fields && credType === 'key') {
                    const fieldEntries = Object.values(fields) as CredentialField[];
                    const apiKeyField = fieldEntries.find(f => f.key === 'api_key');
                    // If no api_key field, show nothing for key branch
                    if (!apiKeyField) return null;
                    const extraFields = fieldEntries.filter(f => f.key !== 'api_key');
                    return (
                      <>
                        {extraFields.map((field) => (
                          <div key={field.key} className="flex gap-2">
                            <input
                              type={field.type}
                              placeholder={field.placeholder}
                              value={credExtraFields[field.key] ?? ''}
                              onChange={(e) => setCredExtraFields(prev => ({ ...prev, [field.key]: e.target.value }))}
                              className="bg-primary border border-border-subtle rounded-lg px-3 py-1.5 text-text-main text-xs focus:outline-none flex-1 font-fira"
                            />
                          </div>
                        ))}
                        <div className="flex gap-2">
                          <input
                            type="password"
                            placeholder={apiKeyField?.placeholder ?? "API Key..."}
                            value={credSecret}
                            onChange={(e) => setCredSecret(e.target.value)}
                            className="bg-primary border border-border-subtle rounded-lg px-3 py-1.5 text-text-main text-xs focus:outline-none flex-1 font-fira"
                          />
                          <button
                            onClick={async () => {
                              const missingField = extraFields.find(f => f.required && !credExtraFields[f.key]?.trim());
                              if (missingField) return;
                              if (!credSecret.trim()) return;
                              const allExtraFields: Record<string, string> = {};
                              for (const f of extraFields) {
                                allExtraFields[f.key] = credExtraFields[f.key] ?? '';
                              }
                              const success = await onAddCredential(credProvider, credSecret.trim(), credType, allExtraFields);
                              if (success) {
                                setCredSecret("");
                                setCredExtraFields({});
                              }
                            }}
                            className="px-3 bg-accent-blue hover:bg-hover-subtle hover:text-text-main text-xs font-semibold rounded-sm text-white transition-colors cursor-pointer border-0"
                          >
                            Add
                          </button>
                        </div>
                      </>
                    );
                  }
                  return (
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
                          const success = await onAddCredential(credProvider, credSecret.trim(), credType);
                          if (success) {
                            setCredSecret("");
                          }
                        }}
                        className="px-3 bg-accent-blue hover:bg-hover-subtle hover:text-text-main text-xs font-semibold rounded-sm text-white transition-colors cursor-pointer border-0"
                      >
                        Add
                      </button>
                    </div>
                  );
                })()}
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
                        .filter(([, desc]) => desc.importable)
                        .map(([id, desc]) => (
                          <option key={id} value={id}>{desc.displayName}</option>
                        ))}
                    </select>
                  </div>

                  <button
                    onClick={async () => {
                      if (!importBrowserId || !importProfileId || !importProviderId) return;
                      await onImportCookies(importBrowserId, importProfileId, importProviderId);
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
            onClick={onClose}
            className="w-full py-1.5 bg-accent-blue hover:bg-hover-subtle text-xs font-semibold rounded-sm text-white border border-border-subtle transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
