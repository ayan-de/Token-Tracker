"use client";

import type { ProviderUsage } from "@/lib/types";
import { PROVIDER_DESCRIPTORS, providerLogo } from "@/lib/dataMapping";
import { getProviderGradient } from "@/lib/utils";

interface ProviderTabBarProps {
  providers: ProviderUsage[];
  selectedProvider: string | null;
  onSelectProvider: (provider: string) => void;
  theme: 'dark' | 'light';
}

export default function ProviderTabBar({
  providers,
  selectedProvider,
  onSelectProvider,
  theme,
}: ProviderTabBarProps) {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto px-4 py-2.5 border-b border-border-subtle bg-secondary/10 scrollbar-none">
      {providers.map((p) => {
        const isSelected = selectedProvider === p.provider;
        const desc = PROVIDER_DESCRIPTORS[p.provider.toLowerCase()] || { displayName: p.provider_label };
        return (
          <button
            key={p.provider}
            onClick={() => onSelectProvider(p.provider)}
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
  );
}
