"use client";

interface ProgressBarProps {
  percent: number;
}

export default function ProgressBar({ percent }: ProgressBarProps) {
  const clamped = Math.min(Math.max(percent, 0), 100);
  const fillClass =
    clamped >= 95
      ? "bg-status-danger"
      : clamped >= 80
        ? "bg-status-warning"
        : "bg-gradient-to-r from-accent-cyan to-accent-purple";

  return (
    <div className="relative w-full h-2 rounded-full bg-secondary overflow-hidden">
      <div
        className={`absolute left-0 top-0 h-full rounded-full transition-all duration-500 ${fillClass}`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}