"use client";

import { useRef } from "react";
import type { ProviderUsage } from "@/lib/types";
import { PROVIDER_DESCRIPTORS, providerLogo } from "@/lib/dataMapping";
import { getProviderGradient } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "@/lib/icons";

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
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: "left" | "right") => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({ left: dir === "right" ? 120 : -120, behavior: "smooth" });
  };

  return (
    <div className="flex items-center border-b border-border-subtle bg-secondary/10">
      <button
        onClick={() => scroll("left")}
        className="flex-shrink-0 p-1.5 text-text-muted hover:text-text-main hover:bg-hover-subtle rounded transition-all cursor-pointer border-0"
        aria-label="Scroll left"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
      </button>

      <div ref={scrollRef} className="flex items-center overflow-x-auto px-1 py-2.5 scrollbar-none">
        {providers.map((p) => {
          const isSelected = selectedProvider === p.provider;
          const desc = PROVIDER_DESCRIPTORS[p.provider.toLowerCase()] || { displayName: p.provider_label };
          return (
            <button
              key={p.provider}
              onClick={() => onSelectProvider(p.provider)}
              className={`flex flex-col items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-semibold whitespace-nowrap transition-all duration-300 cursor-pointer border-0 outline-none focus:outline-none shrink-0 ${
                isSelected
                  ? `text-white shadow-lg shadow-[#3b82f6]/25`
                  : "bg-transparent text-text-muted hover:text-text-main hover:bg-hover-subtle"
              }`}
              style={isSelected ? { backgroundColor: '#3b82f6' } : undefined}
            >
              {providerLogo(p.provider, theme) ? (
                <img
                  src={providerLogo(p.provider, theme)}
                  alt=""
                  className={`w-5 h-5 object-contain transition-all ${isSelected ? 'opacity-100' : 'opacity-80 hover:opacity-100'}`}
                />
              ) : (
                <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${getProviderGradient(p.provider)}`} />
              )}
              <span>{desc.displayName}</span>
              
              {/* Progress bar under the tab (only if NOT selected to match the design) */}
              {!isSelected ? (
                <div className="w-8 h-1 bg-border-subtle/50 rounded-full overflow-hidden mt-0.5">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${getProviderGradient(p.provider)}`}
                    style={{ width: `${Math.min(Math.max(p.usage?.primary?.usedPercent || 0, 0), 100)}%` }}
                  />
                </div>
              ) : (
                // Invisible spacer to maintain identical height/layout between selected and non-selected states
                <div className="w-8 h-1 mt-0.5 opacity-0" />
              )}
            </button>
          );
        })}
      </div>

      <button
        onClick={() => scroll("right")}
        className="flex-shrink-0 p-1.5 text-text-muted hover:text-text-main hover:bg-hover-subtle rounded transition-all cursor-pointer border-0"
        aria-label="Scroll right"
      >
        <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
