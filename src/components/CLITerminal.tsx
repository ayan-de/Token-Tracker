"use client";

import { useState, KeyboardEvent } from "react";
import { runCodexBarCommand } from "@/lib/tauri";

interface CLITerminalProps {
  onCommandExecuted?: () => void;
}

export default function CLITerminal({ onCommandExecuted }: CLITerminalProps) {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleExecute(cmdText: string) {
    if (!cmdText.trim()) return;

    let cleanCmd = cmdText.trim();
    if (cleanCmd.startsWith("codexbar ")) {
      cleanCmd = cleanCmd.substring(9);
    }
    const args = cleanCmd.split(/\s+/).filter((a) => a.length > 0);

    setLoading(true);
    setOutput("Executing...");
    setError(false);

    try {
      const result = await runCodexBarCommand(args);
      setOutput(result || "Command completed successfully (no output).");
      setError(false);
      onCommandExecuted?.();
    } catch (err) {
      setOutput(String(err));
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && input.trim() !== "") {
      handleExecute(input);
      setInput("");
    }
  }

  return (
    <div className="border-t border-white/5">
      <div className="px-4 py-2">
        <div className="flex items-center gap-2 bg-secondary rounded-lg px-3 py-2 border border-white/5">
          <span className="text-accent-cyan text-xs font-fira font-semibold">codexbar</span>
          <input
            id="console-input"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="--help"
            disabled={loading}
            className="flex-1 bg-transparent text-text-main text-xs font-fira outline-none placeholder:text-text-muted/50"
          />
        </div>
      </div>

      {output && (
        <div
          id="console-output"
          className={`mx-4 mb-3 px-3 py-2 rounded-lg font-fira text-xs ${
            error
              ? "bg-status-danger/10 text-status-danger border border-status-danger/20"
              : "bg-secondary text-status-ok border border-white/5"
          }`}
        >
          <pre className="whitespace-pre-wrap break-all">{output}</pre>
        </div>
      )}
    </div>
  );
}