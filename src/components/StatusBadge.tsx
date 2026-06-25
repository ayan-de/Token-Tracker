"use client";

import type { BackendStatus } from "@/lib/types";

const STATUS_CONFIG: Record<
  string,
  { label: string; dotClass: string; textClass: string }
> = {
  available: {
    label: "Backend Connected",
    dotClass: "bg-status-ok",
    textClass: "text-status-ok",
  },
  not_installed: {
    label: "Not Installed",
    dotClass: "bg-status-warning",
    textClass: "text-status-warning",
  },
  demo: {
    label: "Demo Mode",
    dotClass: "bg-accent-blue",
    textClass: "text-accent-blue",
  },
  connecting: {
    label: "Connecting...",
    dotClass: "bg-status-warning animate-pulse",
    textClass: "text-status-warning",
  },
  error: {
    label: "Backend Error",
    dotClass: "bg-status-danger",
    textClass: "text-status-danger",
  },
};

interface StatusBadgeProps {
  status: BackendStatus;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const config =
    STATUS_CONFIG[status.status] ?? STATUS_CONFIG["connecting"];
  return (
    <div className="flex items-center gap-1.5">
      <span className={`w-2 h-2 rounded-full ${config.dotClass}`} />
      <span className={`text-xs font-medium ${config.textClass}`}>
        {config.label}
      </span>
    </div>
  );
}