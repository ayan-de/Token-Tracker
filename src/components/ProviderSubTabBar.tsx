"use client";

import { memo, useRef, useCallback, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "@/lib/icons";
import { getProviderGradient } from "@/lib/utils";
import { PROVIDER_DESCRIPTORS, providerLogo } from "@/lib/dataMapping";
import { useTheme } from "@/app/page";

export interface SubTab {
  id: string;
  label: string;
  /** Progress percent for mini bar (0-100) */
  usedPercent?: number;
  gradient?: string;
}

interface ProviderSubTabBarProps {
  tabs: SubTab[];
  selectedTab: string | null;
  onSelectTab: (tabId: string) => void;
}

const SubTabButton = memo(function SubTabButton({
  tab,
  isSelected,
  onSelect,
}: {
  tab: SubTab;
  isSelected: boolean;
  onSelect: (id: string) => void;
}) {
  const { theme } = useTheme();
  const gradient = tab.gradient || getProviderGradient(tab.id);
  const desc = PROVIDER_DESCRIPTORS[tab.id.toLowerCase()] || { displayName: tab.label };

  return (
    <button
      onClick={() => onSelect(tab.id)}
      className={`flex flex-col items-center justify-center gap-0.5 px-2 py-1.5 rounded-sm text-[9px] font-semibold whitespace-nowrap cursor-pointer border-0 outline-none focus:outline-none flex-none transition-all ${
        isSelected
          ? `text-white shadow-lg shadow-[#3b82f6]/25`
          : "bg-transparent text-text-muted hover:text-text-main hover:bg-hover-subtle"
      }`}
      style={isSelected ? { backgroundColor: "#3b82f6" } : undefined}
    >
      {/* Logo */}
      <div className="relative flex items-center justify-center w-5 h-5">
        {isSelected && (
          <div
            className="absolute inset-0 rounded-full bg-white"
            style={{
              boxShadow:
                "0 0 6px 2px rgba(255, 255, 255, 0.35), 0 0 15px 5px rgba(255, 255, 255, 0.25), 0 0 30px 10px rgba(255, 255, 255, 0.15)",
            }}
          />
        )}
        {providerLogo(tab.id, theme) ? (
          <img
            src={providerLogo(tab.id, theme)}
            alt=""
            className={`w-4 h-4 object-contain relative z-10 ${
              isSelected ? "opacity-100" : "opacity-80"
            }`}
          />
        ) : (
          <div
            className={`w-1.5 h-1.5 rounded-full bg-gradient-to-r ${gradient} relative z-10`}
          />
        )}
      </div>

      <span>{desc.displayName}</span>

      {/* Progress bar under the label */}
      {!isSelected ? (
        <div className="w-6 h-1 bg-border-subtle/50 rounded-full overflow-hidden mt-0.5">
          <div
            className={`h-full rounded-full transition-all duration-500 bg-gradient-to-r ${gradient}`}
            style={{
              width: `${Math.min(Math.max(tab.usedPercent || 0, 0), 100)}%`,
            }}
          />
        </div>
      ) : (
        <div className="w-6 h-1 mt-0.5 opacity-0" />
      )}
    </button>
  );
});

function ProviderSubTabBar({
  tabs,
  selectedTab,
  onSelectTab,
}: ProviderSubTabBarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = useCallback((dir: "left" | "right") => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({ left: dir === "right" ? 120 : -120, behavior: "smooth" });
  }, []);

  const handleSelect = useCallback(
    (id: string) => onSelectTab(id),
    [onSelectTab]
  );

  const tabElements = useMemo(
    () =>
      tabs.map((tab) => (
        <SubTabButton
          key={tab.id}
          tab={tab}
          isSelected={selectedTab === tab.id}
          onSelect={handleSelect}
        />
      )),
    [tabs, selectedTab, handleSelect]
  );

  return (
    <div className="flex items-center bg-secondary/5 border-b border-border-subtle">
      <button
        onClick={() => scroll("left")}
        className="flex-shrink-0 p-0.5 text-text-muted hover:text-text-main hover:bg-hover-subtle rounded transition-all cursor-pointer border-0"
        aria-label="Scroll left"
      >
        <ChevronLeft className="w-3 h-3" />
      </button>

      <div
        ref={scrollRef}
        className="flex-1 min-w-0 flex items-center overflow-x-auto px-1 py-1 scrollbar-none"
      >
        {tabElements}
      </div>

      <button
        onClick={() => scroll("right")}
        className="flex-shrink-0 p-0.5 text-text-muted hover:text-text-main hover:bg-hover-subtle rounded transition-all cursor-pointer border-0"
        aria-label="Scroll right"
      >
        <ChevronRight className="w-3 h-3" />
      </button>
    </div>
  );
}

export default memo(ProviderSubTabBar);
