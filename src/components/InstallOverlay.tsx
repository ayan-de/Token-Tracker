"use client";

import { useEffect, useState } from "react";
import { installCli } from "@/lib/tauri";
import { onInstallProgress } from "@/lib/tauriEvents";

interface InstallOverlayProps {
  onInstalled?: () => void;
}

export default function InstallOverlay({ onInstalled }: InstallOverlayProps) {
  const [isInstalling, setIsInstalling] = useState(false);
  const [progressText, setProgressText] = useState("");
  const [logs, setLogs] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    onInstallProgress((msg) => {
      setProgressText(msg);
      setLogs((prev) => prev + `[installer] ${msg}\n`);
    }).then((fn) => {
      unlisten = fn;
    });
    return () => {
      unlisten?.();
    };
  }, []);

  async function handleInstall() {
    if (isInstalling) return;
    setIsInstalling(true);
    setLogs("");
    setError(false);
    setProgressText("Starting installation...");

    try {
      const result = await installCli();
      setLogs((prev) => prev + `[installer] Success: ${result}\n`);
      setProgressText("Successfully installed!");
      setError(false);

      setTimeout(() => {
        onInstalled?.();
      }, 1500);
    } catch (err) {
      console.error("Installation failed:", err);
      setLogs((prev) => prev + `[installer] Error: ${err}\n`);
      setProgressText("Installation failed. Please retry.");
      setError(true);
      setIsInstalling(false);
    }
  }

  return (
    <div
      id="install-overlay"
      className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-primary/95 backdrop-blur-sm p-6 rounded-xl"
    >
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent-cyan to-accent-purple flex items-center justify-center mb-4">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="w-8 h-8 text-white"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
          />
        </svg>
      </div>

      <h2 className="text-base font-semibold text-text-main mb-1 font-outfit">
        CodexBar CLI Not Found
      </h2>
      <p className="text-xs text-text-muted text-center mb-5 leading-relaxed">
        Install the CodexBar CLI to monitor your AI provider quotas and costs.
      </p>

      <button
        id="install-cli-btn"
        onClick={handleInstall}
        disabled={isInstalling}
        className="w-full max-w-[200px] py-2 rounded-lg bg-gradient-to-r from-accent-cyan to-accent-purple text-white text-xs font-semibold font-outfit hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
      >
        {isInstalling ? "Installing..." : "Install CodexBar CLI"}
      </button>

      {(isInstalling || logs) && (
        <div
          id="install-progress-container"
          className="w-full max-w-[240px] mt-3"
        >
          <div
            id="install-progress-text"
            className={`text-xs mb-1.5 font-fira ${
              error ? "text-status-danger" : "text-accent-cyan"
            }`}
          >
            {progressText}
          </div>
          <div className="w-full h-1 rounded-full bg-secondary overflow-hidden">
            {isInstalling && (
              <div className="h-full bg-gradient-to-r from-accent-cyan to-accent-purple animate-pulse rounded-full" />
            )}
          </div>
          {logs && (
            <pre
              id="install-log"
              className={`mt-2 text-xs font-fira p-2 rounded-lg bg-secondary overflow-auto max-h-24 ${
                error ? "text-status-danger" : "text-text-muted"
              }`}
            >
              {logs}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}