"use client";

import { useState, useRef, useEffect, memo } from "react";
import { ChevronDown, Check } from "@/lib/icons";

export interface LogoSelectOption {
  value: string;
  label: string;
  logo?: string;
}

interface LogoSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: LogoSelectOption[];
  disabled?: boolean;
  className?: string;
  logoPath?: (value: string) => string; // e.g. (v) => `/logos/${v}.svg`
  logoErrorHidden?: boolean; // hide img if src fails (e.g. for browser logos that may not exist)
}

export default memo(function LogoSelect({
  value,
  onChange,
  options,
  disabled = false,
  className = "",
  logoPath,
  logoErrorHidden = false,
}: LogoSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  return (
    <div ref={ref} className={`relative ${className}`}>
      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={`w-full flex items-center justify-between gap-2 bg-primary border border-border-subtle rounded-sm px-2.5 py-1.5 text-text-main text-xs focus:outline-none cursor-pointer ${
          disabled ? "opacity-40 cursor-not-allowed" : "hover:border-hover-subtle"
        }`}
      >
        <span className="flex items-center gap-2 min-w-0">
          {selected && (
            <>
              {selected.logo ? (
                <img
                  src={selected.logo}
                  alt=""
                  className="w-4 h-4 object-contain flex-shrink-0"
                  onError={logoErrorHidden ? (e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; } : undefined}
                />
              ) : selected.logo === "" ? null : (
                logoPath && (
                  <img
                    src={logoPath(selected.value)}
                    alt=""
                    className="w-4 h-4 object-contain flex-shrink-0"
                    onError={logoErrorHidden ? (e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; } : undefined}
                  />
                )
              )}
            </>
          )}
          <span className="truncate">{selected?.label ?? ""}</span>
        </span>
        <ChevronDown
          className={`w-3 h-3 flex-shrink-0 text-text-muted transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <ul className="absolute z-50 top-full left-0 right-0 mt-1 bg-secondary border border-border-subtle rounded-sm shadow-lg overflow-hidden max-h-48 overflow-y-auto scrollbar-thin">
          {options.map((option) => (
            <li key={option.value}>
              <button
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-left cursor-pointer border-0 outline-none focus:bg-hover-subtle transition-colors ${
                  option.value === value
                    ? "text-text-main bg-hover-subtle"
                    : "text-text-muted hover:text-text-main"
                }`}
              >
                {option.logo ? (
                  <img
                    src={option.logo}
                    alt=""
                    className="w-4 h-4 object-contain flex-shrink-0"
                    onError={logoErrorHidden ? (e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; } : undefined}
                  />
                ) : option.logo === "" ? null : (
                  logoPath && (
                    <img
                      src={logoPath(option.value)}
                      alt=""
                      className="w-4 h-4 object-contain flex-shrink-0"
                      onError={logoErrorHidden ? (e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; } : undefined}
                    />
                  )
                )}
                <span className="flex-1 truncate">{option.label}</span>
                {option.value === value && (
                  <Check className="w-3 h-3 text-accent-blue flex-shrink-0" />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
});
