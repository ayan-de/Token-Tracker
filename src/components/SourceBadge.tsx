import { memo } from "react";
import type { ProviderSource } from "@/lib/types";

interface SourceConfig {
  label: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
}

const SOURCE_CONFIGS: Record<ProviderSource, SourceConfig> = {
  cli: {
    label: "CLI",
    bgColor: "bg-accent-cyan/10",
    textColor: "text-accent-cyan",
    borderColor: "border-accent-cyan/30",
  },
  web: {
    label: "Browser",
    bgColor: "bg-accent-purple/10",
    textColor: "text-accent-purple",
    borderColor: "border-accent-purple/30",
  },
  oauth: {
    label: "OAuth",
    bgColor: "bg-accent-green/10",
    textColor: "text-accent-green",
    borderColor: "border-accent-green/30",
  },
  auto: {
    label: "Auto",
    bgColor: "bg-text-muted/10",
    textColor: "text-text-muted",
    borderColor: "border-border-subtle",
  },
};

interface SourceBadgeProps {
  source: ProviderSource;
}

export default memo(function SourceBadge({ source }: SourceBadgeProps) {
  const config = SOURCE_CONFIGS[source] || SOURCE_CONFIGS.auto;

  return (
    <span
      className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-sm border ${config.bgColor} ${config.textColor} ${config.borderColor}`}
      title={`Data fetched via ${source.toUpperCase()}`}
    >
      {config.label}
    </span>
  );
});
