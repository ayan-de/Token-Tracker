"use client";

import { PROVIDER_DESCRIPTORS } from "@/lib/dataMapping";
import { getProviderGradient } from "@/lib/utils";

interface AddAccountModalProps {
  provider: string;
  onClose: () => void;
}

export default function AddAccountModal({ provider, onClose }: AddAccountModalProps) {
  return (
    <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-[320px] bg-secondary border border-border-subtle rounded-xl p-4 shadow-2xl space-y-4">
        <div className="flex items-center gap-2 border-b border-border-subtle pb-2">
          <span className={`w-3 h-3 rounded-full bg-gradient-to-br ${getProviderGradient(provider)}`} />
          <h3 className="text-sm font-bold text-text-main">
            Configure {PROVIDER_DESCRIPTORS[provider.toLowerCase()]?.displayName || provider}
          </h3>
        </div>

        <div className="text-xs text-text-muted space-y-2 leading-relaxed font-outfit">
          <p>To configure this provider, you can set the environment credentials or login via the CLI.</p>

          <div className="bg-primary/50 p-2 rounded-lg border border-border-subtle font-fira text-[11px] text-accent-cyan break-all">
            {provider.toLowerCase() === "claude" && (
              <>
                export ANTHROPIC_API_KEY="..."<br />
                # Or run:<br />
                claude login
              </>
            )}
            {provider.toLowerCase() === "gemini" && (
              <>
                export GEMINI_API_KEY="..."<br />
                # Or run:<br />
                gemini login
              </>
            )}
            {provider.toLowerCase() === "antigravity" && (
              <>
                export GEMINI_API_KEY="..."
              </>
            )}
            {provider.toLowerCase() === "openai" && (
              <>
                export OPENAI_API_KEY="..."<br />
                # Or run:<br />
                codex login
              </>
            )}
            {!["claude", "gemini", "antigravity", "openai"].includes(provider.toLowerCase()) && (
              <>
                # Set the provider's API key<br />
                # e.g., export DEEPSEEK_API_KEY="..."
              </>
            )}
          </div>
          <p className="text-[10px] text-text-muted/70">
            After exporting variables, run a refresh or restart TokenTracker to apply.
          </p>
        </div>

        <button
          onClick={onClose}
          className="w-full py-1.5 bg-bg-subtle hover:bg-hover-subtle text-xs font-semibold rounded-lg text-text-main border border-border-subtle transition-colors cursor-pointer"
        >
          Done
        </button>
      </div>
    </div>
  );
}
