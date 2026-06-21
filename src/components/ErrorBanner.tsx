"use client";

interface ErrorBannerProps {
  message: string | null;
}

export default function ErrorBanner({ message }: ErrorBannerProps) {
  if (!message) return null;
  return (
    <div
      id="error-banner"
      className="mx-3 mb-2 px-3 py-2 rounded-lg bg-status-danger/10 border border-status-danger/30 text-status-danger text-xs hidden"
      role="alert"
    >
      {message}
    </div>
  );
}