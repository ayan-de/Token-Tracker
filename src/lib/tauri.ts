import { invoke } from "@tauri-apps/api/core";
import type { CliStatus, RawCliUsageItem, RawCliCostItem } from "./types";

export async function getCliStatus(): Promise<CliStatus> {
  return invoke<CliStatus>("get_cli_status");
}

export async function getUsageData(): Promise<RawCliUsageItem[]> {
  return invoke<RawCliUsageItem[]>("get_usage_data");
}

export async function getCostData(): Promise<RawCliCostItem[]> {
  return invoke<RawCliCostItem[]>("get_cost_data");
}

export async function triggerRefresh(): Promise<void> {
  return invoke("trigger_refresh");
}

export async function runCodexBarCommand(args: string[]): Promise<string> {
  return invoke<string>("run_codexbar_command", { args });
}

export async function installCli(): Promise<string> {
  return invoke<string>("install_cli");
}