"use client";

import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import type { ProviderUsage } from "@/lib/types";
import { PROVIDER_DESCRIPTORS } from "@/lib/dataMapping";
import { getProviderGradient } from "@/lib/utils";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface LimitLineGraphProps {
  provider: ProviderUsage;
}

export default function LimitLineGraph({ provider: p }: LimitLineGraphProps) {
  const desc = PROVIDER_DESCRIPTORS[p.provider.toLowerCase()] || {
    displayName: p.provider_label,
    sessionLabel: "Session",
    weeklyLabel: "Weekly",
    opusLabel: null,
  };

  const u = p.usage;
  if (!u) return null;

  // Build labels and data for each rate window
  const labels: string[] = [];
  const datasets: any[] = [];

  // Primary window (Session)
  if (u.primary) {
    labels.push(desc.sessionLabel);
    const primaryPercent = u.primary.usedPercent;
    datasets.push({
      label: desc.sessionLabel,
      data: [primaryPercent],
      borderColor: getGradientColor(p.provider, 0),
      backgroundColor: getGradientColor(p.provider, 0, 0.1),
      fill: true,
      tension: 0.4,
      pointRadius: 6,
      pointBackgroundColor: getGradientColor(p.provider, 0),
    });
  }

  // Secondary window (Weekly)
  if (u.secondary) {
    labels.push(desc.weeklyLabel);
    const secondaryPercent = u.secondary.usedPercent;
    datasets.push({
      label: desc.weeklyLabel,
      data: [secondaryPercent],
      borderColor: getGradientColor(p.provider, 1),
      backgroundColor: getGradientColor(p.provider, 1, 0.1),
      fill: true,
      tension: 0.4,
      pointRadius: 6,
      pointBackgroundColor: getGradientColor(p.provider, 1),
    });
  }

  // Tertiary window (Sonnet/Opus)
  if (u.tertiary && desc.opusLabel) {
    labels.push(desc.opusLabel);
    const tertiaryPercent = u.tertiary.usedPercent;
    datasets.push({
      label: desc.opusLabel,
      data: [tertiaryPercent],
      borderColor: getGradientColor(p.provider, 2),
      backgroundColor: getGradientColor(p.provider, 2, 0.1),
      fill: true,
      tension: 0.4,
      pointRadius: 6,
      pointBackgroundColor: getGradientColor(p.provider, 2),
    });
  }

  if (datasets.length === 0) return null;

  const data = {
    labels,
    datasets,
  };

  const options: any = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 600,
      easing: "easeOutQuart",
    },
    plugins: {
      legend: {
        display: true,
        position: "bottom",
        labels: {
          color: "#64748b",
          font: { size: 10, family: "Outfit" },
          boxWidth: 12,
          padding: 8,
        },
      },
      tooltip: {
        backgroundColor: "#1e293b",
        titleColor: "#e2e8f0",
        bodyColor: "#94a3b8",
        borderColor: "rgba(255,255,255,0.1)",
        borderWidth: 1,
        padding: 10,
        displayColors: true,
        callbacks: {
          label: (context: any) => ` ${context.parsed.y.toFixed(1)}% used`,
        },
      },
    },
    scales: {
      x: {
        display: true,
        grid: { display: false },
        ticks: { color: "#64748b", font: { size: 10 } },
      },
      y: {
        display: true,
        min: 0,
        max: 100,
        grid: { color: "rgba(255,255,255,0.05)" },
        ticks: {
          color: "#64748b",
          font: { size: 10 },
          callback: (value: any) => `${value}%`,
        },
      },
    },
  };

  return (
    <div className="py-2.5 border-b border-border-subtle">
      <div className="text-xs font-semibold text-text-main mb-2">Usage Overview</div>
      <div className="h-[120px]">
        <Line data={data} options={options} />
      </div>
    </div>
  );
}

function getGradientColor(provider: string, index: number, alpha: number = 1): string {
  const colors: Record<number, string> = {
    0: `rgba(59, 130, 246, ${alpha})`, // blue
    1: `rgba(139, 92, 246, ${alpha})`, // purple
    2: `rgba(22, 211, 180, ${alpha})`,  // cyan/teal
  };
  return colors[index] || `rgba(59, 130, 246, ${alpha})`;
}
