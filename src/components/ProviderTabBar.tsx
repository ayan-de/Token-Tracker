"use client";

import { Fragment, useRef } from "react";
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
        {providers.map((p, i) => {
          const isSelected = selectedProvider === p.provider;
          const desc = PROVIDER_DESCRIPTORS[p.provider.toLowerCase()] || { displayName: p.provider_label };
          return (
            <Fragment key={p.provider}>
              <button
                onClick={() => onSelectProvider(p.provider)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-300 cursor-pointer border-0 outline-none focus:outline-none shrink-0 ${
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
              {i < providers.length - 1 && (
                <span className="shrink-0 w-px h-4 bg-border-subtle mx-1" aria-hidden />
              )}
            </Fragment>
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
