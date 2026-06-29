"use client";

import { useRef, useCallback, memo, useMemo } from "react";
import type { ProviderUsage } from "@/lib/types";
import { PROVIDER_DESCRIPTORS, providerLogo } from "@/lib/dataMapping";
import { getProviderGradient } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "@/lib/icons";
import { useTheme } from "@/app/page";

interface ProviderTabBarProps {
  providers: ProviderUsage[];
  selectedProvider: string | null;
  onSelectProvider: (provider: string) => void;
}

const ProviderTab = memo(function ProviderTab({
  provider: p,
  isSelected,
  onSelect,
}: {
  provider: ProviderUsage;
  isSelected: boolean;
  onSelect: (provider: string) => void;
}) {
  const { theme } = useTheme();
  const desc = PROVIDER_DESCRIPTORS[p.provider.toLowerCase()] || { displayName: p.provider_label };

  return (
    <button
      onClick={() => onSelect(p.provider)}
      className={`flex flex-col items-center justify-center gap-1.5 px-3 py-2 rounded-sm text-[10px] font-semibold whitespace-nowrap cursor-pointer border-0 outline-none focus:outline-none flex-none ${
        isSelected
          ? `text-white shadow-lg shadow-[#3b82f6]/25`
          : "bg-transparent text-text-muted hover:text-text-main hover:bg-hover-subtle"
      }`}
      style={isSelected ? { backgroundColor: '#3b82f6' } : undefined}
    >
      <div className="relative flex items-center justify-center w-7 h-7">
        {isSelected && (
          <div className="absolute inset-0 rounded-full bg-white" style={{ boxShadow: '0 0 10px 3px rgba(255, 255, 255, 0.4), 0 0 25px 8px rgba(255, 255, 255, 0.3), 0 0 50px 15px rgba(255, 255, 255, 0.2), 0 0 100px 30px rgba(255, 255, 255, 0.1)' }} />
        )}
        {providerLogo(p.provider, isSelected ? 'light' : theme) ? (
          <img
            src={providerLogo(p.provider, isSelected ? 'light' : theme)}
            alt=""
            className={`w-5 h-5 object-contain relative z-10 ${isSelected ? 'opacity-100' : 'opacity-80'}`}
          />
        ) : (
          <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${getProviderGradient(p.provider)} relative z-10`} />
        )}
      </div>
      <span>{desc.displayName}</span>

      {/* Progress bar under the tab (only if NOT selected to match the design) */}
      {!isSelected ? (
        <div className="w-8 h-1 bg-border-subtle/50 rounded-full overflow-hidden mt-0.5">
          <div
            className={`h-full rounded-full transition-all duration-500 bg-gradient-to-r ${getProviderGradient(p.provider)}`}
            style={{ width: `${Math.min(Math.max(p.usage?.primary?.usedPercent || 0, 0), 100)}%` }}
          />
        </div>
      ) : (
        <div className="w-8 h-1 mt-0.5 opacity-0" />
      )}
    </button>
  );
});

function ProviderTabBar({
  providers,
  selectedProvider,
  onSelectProvider,
}: ProviderTabBarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = useCallback((dir: "left" | "right") => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({ left: dir === "right" ? 120 : -120, behavior: "smooth" });
  }, []);

  const scrollLeft = useCallback(() => scroll("left"), [scroll]);
  const scrollRight = useCallback(() => scroll("right"), [scroll]);

  // Stable callback for each provider
  const handleSelect = useCallback((provider: string) => {
    onSelectProvider(provider);
  }, [onSelectProvider]);

  // Memoize provider tabs to prevent re-renders when parent re-renders but data is same
  const tabs = useMemo(() => (
    providers.map((p) => (
      <ProviderTab
        key={p.provider}
        provider={p}
        isSelected={selectedProvider === p.provider}
        onSelect={handleSelect}
      />
    ))
  ), [providers, selectedProvider, handleSelect]);

  return (
    <div className="flex items-center border-b border-border-subtle bg-secondary/10 will-change-transform">
      <button
        onClick={scrollLeft}
        className="flex-shrink-0 p-1.5 text-text-muted hover:text-text-main hover:bg-hover-subtle rounded transition-all cursor-pointer border-0"
        aria-label="Scroll left"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
      </button>

      <div ref={scrollRef} className="flex-1 min-w-0 flex items-center overflow-x-auto px-1 py-2.5 scrollbar-none will-change-transform">
        {tabs}
      </div>

      <button
        onClick={scrollRight}
        className="flex-shrink-0 p-1.5 text-text-muted hover:text-text-main hover:bg-hover-subtle rounded transition-all cursor-pointer border-0"
        aria-label="Scroll right"
      >
        <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export default memo(ProviderTabBar);
