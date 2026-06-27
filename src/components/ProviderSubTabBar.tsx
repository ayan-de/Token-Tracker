"use client";

import { memo, useRef, useCallback, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "@/lib/icons";
import { getProviderGradient } from "@/lib/utils";

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
  const gradient = tab.gradient || getProviderGradient(tab.id);

  return (
    <button
      onClick={() => onSelect(tab.id)}
      className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-sm text-[10px] font-semibold whitespace-nowrap cursor-pointer border-0 outline-none focus:outline-none flex-none transition-all ${
        isSelected
          ? "text-white"
          : "bg-transparent text-text-muted hover:text-text-main hover:bg-hover-subtle"
      }`}
      style={isSelected ? { backgroundColor: "rgba(59, 130, 246, 0.8)" } : undefined}
    >
      <span>{tab.label}</span>

      {/* Mini progress bar */}
      {!isSelected && tab.usedPercent !== undefined && (
        <div className="w-6 h-1 bg-border-subtle/50 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full bg-gradient-to-r ${gradient}`}
            style={{ width: `${Math.min(Math.max(tab.usedPercent, 0), 100)}%` }}
          />
        </div>
      )}
      {isSelected && <div className="w-6 h-1" />}
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
        className="flex-shrink-0 p-1 text-text-muted hover:text-text-main hover:bg-hover-subtle rounded transition-all cursor-pointer border-0"
        aria-label="Scroll left"
      >
        <ChevronLeft className="w-3 h-3" />
      </button>

      <div
        ref={scrollRef}
        className="flex-1 min-w-0 flex items-center overflow-x-auto px-1 py-2 scrollbar-none"
      >
        {tabElements}
      </div>

      <button
        onClick={() => scroll("right")}
        className="flex-shrink-0 p-1 text-text-muted hover:text-text-main hover:bg-hover-subtle rounded transition-all cursor-pointer border-0"
        aria-label="Scroll right"
      >
        <ChevronRight className="w-3 h-3" />
      </button>
    </div>
  );
}

export default memo(ProviderSubTabBar);
