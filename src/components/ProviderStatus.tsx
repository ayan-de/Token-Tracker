"use client";

import { memo } from "react";
import type { ProviderUsage } from "@/lib/types";
import { PROVIDER_DESCRIPTORS, providerLogo } from "@/lib/dataMapping";
import LoginMethodBadge from "@/components/LoginMethodBadge";
import SourceBadge from "@/components/SourceBadge";
import { useTheme } from "@/app/page";

interface ProviderStatusProps {
  provider: ProviderUsage;
  onOpenAddAccountModal: (provider: string) => void;
}

function formatRelativeTime(sec: number | null | undefined): string {
  if (!sec) return "Updated recently";
  const now = Math.floor(Date.now() / 1000);
  const diff = now - sec;
  if (diff < 10) return "Updated just now";
  if (diff < 60) return `Updated ${diff}s ago`;
  const mins = Math.floor(diff / 60);
  if (mins < 60) return `Updated ${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Updated ${hrs}h ago`;
  return `Updated on ${new Date(sec * 1000).toLocaleDateString()}`;
}

export default memo(function ProviderStatus({
  provider: p,
  onOpenAddAccountModal,
}: ProviderStatusProps) {
  const { theme } = useTheme();
  const desc = PROVIDER_DESCRIPTORS[p.provider.toLowerCase()] || {
    displayName: p.provider_label,
    sessionLabel: "Session",
    weeklyLabel: "Weekly",
  };

  const lastUpdatedText = formatRelativeTime(p.last_successful_at);

  if (p.unavailable) {
    return (
      <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
        <div className="flex items-center gap-3">
          {providerLogo(p.provider, theme) && (
            <img src={providerLogo(p.provider, theme)} alt="" className="w-8 h-8 object-contain" />
          )}
          <div className="flex flex-col">
            <h2 className="text-lg font-bold text-text-main leading-tight flex items-center gap-1">{desc.displayName}{p.usage?.accountEmail && <span className="text-[11px] font-normal text-text-muted/75 border border-border-subtle px-1 py-0.5 rounded align-middle ml-1">{p.usage.accountEmail}</span>}</h2>
            <span className="text-[11px] text-text-muted/75">{lastUpdatedText}</span>
          </div>
        </div>
        {p.source && (
          <SourceBadge source={p.source} />
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
      <div className="flex items-center gap-3">
        {providerLogo(p.provider, theme) && (
          <img src={providerLogo(p.provider, theme)} alt="" className="w-8 h-8 object-contain" />
        )}
        <div className="flex flex-col">
          <h2 className="text-lg font-bold text-text-main leading-tight flex items-center gap-1">{desc.displayName}{p.usage?.accountEmail && <span className="text-[11px] font-normal text-text-muted/75 border border-border-subtle px-1 py-0.5 rounded align-middle ml-1">{p.usage.accountEmail}</span>}</h2>
          <span className="text-[11px] text-text-muted/75">{lastUpdatedText}</span>
        </div>
      </div>
      {p.usage?.loginMethod && (
        <LoginMethodBadge loginMethod={p.usage.loginMethod} />
      )}
      {p.source && (
        <SourceBadge source={p.source} />
      )}
    </div>
  );
});
