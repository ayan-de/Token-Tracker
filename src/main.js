const { invoke } = window.__TAURI__.core;

let isRefreshing = false;
let isInstalling = false;

// Format countdown timers
function formatTimeUntil(isoString) {
  if (!isoString) return '';
  const resetsAt = new Date(isoString);
  const now = new Date();
  const diffMs = resetsAt - now;
  if (diffMs <= 0) return 'Resetting...';

  const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  
  if (diffHrs > 24) {
    const days = Math.floor(diffHrs / 24);
    const hrs = diffHrs % 24;
    return `${days}d ${hrs}h`;
  }
  return `${diffHrs}h ${diffMins}m`;
}

// Convert camelCase to space separated
function formatPacingStage(stage) {
  if (!stage) return '';
  return stage
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase());
}

// Normalize raw CLI usage data into UI-friendly structure
function mapCLIUsage(cliItem) {
  // Graceful fallback for Claude on Linux
  if (cliItem.provider === "claude" && cliItem.error) {
    const errorMsg = cliItem.error.message || "";
    const msg = errorMsg.includes("web support")
      ? "Requires --source cli on Linux"
      : "Active (No session data)";
    return {
      provider: "claude",
      provider_label: "Claude",
      percentage: 0,
      used: null,
      limit: null,
      unit: "requests",
      resets_at: null,
      pacing: { stage: "onTrack" },
      status_message: msg
    };
  }

  // Graceful fallback for OpenCode Go on Linux
  if (cliItem.provider === "opencodego" && cliItem.error && cliItem.error.message.includes("not detected")) {
    return {
      provider: "opencodego",
      provider_label: "OpenCode Go",
      percentage: 0,
      used: null,
      limit: null,
      unit: "requests",
      resets_at: null,
      pacing: { stage: "onTrack" },
      status_message: "Not active (Run 'opencode login')"
    };
  }

  // Skip other providers with errors (no usage data)
  if (!cliItem.usage || !cliItem.usage.primary) {
    return null;
  }

  const provider = cliItem.provider || "unknown";

  // Capitalize provider label
  let provider_label = cliItem.provider_label ||
    (provider.charAt(0).toUpperCase() + provider.slice(1));

  let percentage = 0;
  let used = null;
  let limit = null;
  let unit = "requests";
  let resets_at = null;
  let pacingStage = "onTrack";

  const pri = cliItem.usage.primary;
  percentage = pri.usedPercent ?? 0;
  resets_at = pri.resetsAt;
  used = pri.used ?? null;
  limit = pri.limit ?? null;
  unit = pri.unit ?? "requests";

  if (pri.pacing) {
    pacingStage = pri.pacing.stage || "onTrack";
  } else if (cliItem.usage.pacing) {
    pacingStage = cliItem.usage.pacing.stage || "onTrack";
  }

  return {
    provider,
    provider_label,
    percentage,
    used,
    limit,
    unit,
    resets_at,
    pacing: { stage: pacingStage }
  };
}

// Aggregate historical model data from CLI daily logs
function mapCLICost(cliItem) {
  const provider = cliItem.provider || "unknown";
  const totalCostUSD = cliItem.sessionCostUSD || 0;
  const last30DaysCostUSD = cliItem.last30DaysCostUSD || cliItem.totals?.totalCost || 0;
  
  const modelMap = {};
  if (cliItem.daily) {
    cliItem.daily.forEach(day => {
      if (day.modelBreakdowns) {
        day.modelBreakdowns.forEach(m => {
          const name = m.modelName || "unknown";
          const cost = m.cost || m.costUSD || 0;
          const tokens = m.totalTokens || 0;
          
          if (!modelMap[name]) {
            modelMap[name] = { modelName: name, costUSD: 0, totalTokens: 0 };
          }
          modelMap[name].costUSD += cost;
          modelMap[name].totalTokens += tokens;
        });
      }
    });
  }
  
  const modelBreakdowns = Object.values(modelMap);
  
  return {
    provider,
    totalCostUSD,
    last30DaysCostUSD,
    modelBreakdowns
  };
}

// Error presentation helpers
function showError(message) {
  const banner = document.getElementById("error-banner");
  banner.textContent = message;
  banner.style.display = "block";
}

function clearError() {
  const banner = document.getElementById("error-banner");
  banner.style.display = "none";
  banner.textContent = "";
}

// Fetch both Quota Usage & Cost Spend data from the local cache file
async function syncData() {
  const statusDot = document.getElementById("status-dot");
  const statusText = document.getElementById("status-text");
  const installOverlay = document.getElementById("install-overlay");
  
  try {
    const cliStatus = await invoke("get_cli_status");
    let usageData, costData;

    if (cliStatus.status === "available") {
      installOverlay.style.display = "none";
      statusDot.className = "badge-dot running";
      statusText.textContent = "CLI Connected";
      
      try {
        const rawUsage = await invoke("get_usage_data");
        const rawCost = await invoke("get_cost_data");
        
        usageData = rawUsage.map(mapCLIUsage).filter(p => p !== null);
        costData = rawCost.map(mapCLICost).filter(c => c !== null);
        
        clearError();
        renderUsage(usageData);
        renderCost(costData);
      } catch (err) {
        console.warn("Loading cached CLI data failed", err);
        showError("Failed to load cached data: " + err);
        renderUsage([]);
        renderCost([]);
      }
    } else if (cliStatus.status === "not_installed") {
      installOverlay.style.display = "flex";
      statusDot.className = "badge-dot";
      statusText.textContent = "Not Installed";
      renderUsage([]);
      renderCost([]);
    } else {
      installOverlay.style.display = "none";
      statusDot.className = "badge-dot";
      statusText.textContent = "CLI Error";
      showError("CodexBar CLI error. Verify CLI version using 'codexbar --version'.");
      renderUsage([]);
      renderCost([]);
    }

  } catch (error) {
    console.error("Sync error:", error);
    showError("Tauri backend sync error: " + error);
  } finally {
    document.getElementById("loader").style.display = "none";
    document.getElementById("providers-container").style.display = "block";
    document.getElementById("cost-container").style.display = "block";
  }
}

// Trigger background CLI sync
async function refreshData() {
  if (isRefreshing) return;
  
  const cliStatus = await invoke("get_cli_status");
  if (cliStatus.status !== "available") {
    // Only refresh if CLI is available
    return;
  }

  isRefreshing = true;
  const refreshBtn = document.getElementById("refresh-btn");
  refreshBtn.classList.add("spinning");

  try {
    await invoke("trigger_refresh");
  } catch (error) {
    console.error("Failed to trigger background refresh:", error);
    showError("Failed to trigger refresh: " + error);
    isRefreshing = false;
    refreshBtn.classList.remove("spinning");
  }
}

// Listen to data-synced event from Tauri backend
window.__TAURI__.event.listen("data-synced", (event) => {
  const payload = event.payload;
  const usageData = (payload.usage || []).map(mapCLIUsage).filter(p => p !== null);
  const costData = (payload.cost || []).map(mapCLICost).filter(c => c !== null);

  clearError();
  renderUsage(usageData);
  renderCost(costData);

  isRefreshing = false;
  document.getElementById("refresh-btn").classList.remove("spinning");
});

// Listen to sync-error event from Tauri backend
window.__TAURI__.event.listen("sync-error", (event) => {
  const errMsg = event.payload;
  showError("Failed to sync from CLI: " + errMsg);
  isRefreshing = false;
  document.getElementById("refresh-btn").classList.remove("spinning");
});

// Render quota progress bars
function renderUsage(providers) {
  const container = document.getElementById("providers-list");
  container.innerHTML = "";

  if (!providers || providers.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding: 15px; color: var(--text-muted); font-size: 13px;">No active providers configured.</div>`;
    return;
  }

  providers.forEach(p => {
    const card = document.createElement("div");
    card.className = "provider-card";

    const fillPercent = Math.min(Math.max(p.percentage || 0, 0), 100);
    let fillClass = "";
    if (fillPercent >= 95) fillClass = "danger";
    else if (fillPercent >= 80) fillClass = "warning";

    const resetsIn = formatTimeUntil(p.resets_at);
    const resetsHtml = resetsIn 
      ? `<span class="time-reset">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          resets in ${resetsIn}
         </span>`
      : "";

    const labelText = p.status_message 
      ? p.status_message
      : (p.used !== null && p.limit !== null)
        ? `${p.used.toLocaleString()} / ${p.limit.toLocaleString()} ${p.unit}`
        : `${fillPercent.toFixed(1)}% used`;

    const pacingStage = p.pacing?.stage || "onTrack";
    const pacingClass = pacingStage.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

    card.innerHTML = `
      <div class="provider-meta">
        <div class="provider-name">
          <div class="provider-avatar ${p.provider}">${p.provider.substring(0,2)}</div>
          <span>${p.provider_label}</span>
        </div>
        <span class="pacing-badge ${pacingClass}">${formatPacingStage(pacingStage)}</span>
      </div>
      <div class="progress-container">
        <div class="progress-track">
          <div class="progress-fill ${fillClass}" style="width: ${fillPercent}%"></div>
        </div>
        <div class="progress-labels">
          <span>${labelText}</span>
          ${resetsHtml}
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

// Render cost histories
function renderCost(costData) {
  const card = document.getElementById("cost-card");
  card.innerHTML = "";

  if (!costData || costData.length === 0) {
    card.innerHTML = `<div style="text-align:center; padding: 10px; color: var(--text-muted); font-size: 13px;">No cost summaries available.</div>`;
    return;
  }

  // Aggregate stats
  let totalCurrentUSD = 0;
  let total30dUSD = 0;
  let allModels = [];

  costData.forEach(c => {
    totalCurrentUSD += c.totalCostUSD || 0;
    total30dUSD += c.last30DaysCostUSD || 0;
    if (c.modelBreakdowns) {
      allModels.push(...c.modelBreakdowns);
    }
  });

  // Sort models by spent descending
  allModels.sort((a, b) => (b.costUSD || 0) - (a.costUSD || 0));

  let modelsHtml = "";
  if (allModels.length > 0) {
    modelsHtml = `
      <div class="model-list">
        ${allModels.slice(0, 3).map(m => `
          <div class="model-item">
            <span class="model-name">${m.modelName}</span>
            <span class="model-spend">$${(m.costUSD || 0).toFixed(2)}</span>
          </div>
        `).join("")}
      </div>
    `;
  }

  card.innerHTML = `
    <div class="cost-summary-row">
      <span class="cost-total-label">Total Spend</span>
      <span class="cost-total-value">$${total30dUSD.toFixed(2)}</span>
    </div>
    ${modelsHtml}
  `;
}

// Execute terminal command
async function executeCLICommand(cmdText) {
  const outputEl = document.getElementById("console-output");
  outputEl.style.display = "block";
  outputEl.className = "console-output";
  outputEl.textContent = "Executing...";

  // Parse command arguments, skipping the "codexbar " prefix if added
  let cleanCmd = cmdText.trim();
  if (cleanCmd.startsWith("codexbar ")) {
    cleanCmd = cleanCmd.substring(9);
  }
  
  const args = cleanCmd.split(/\s+/).filter(a => a.length > 0);

  try {
    const result = await invoke("run_codexbar_command", { args });
    outputEl.textContent = result || "Command completed successfully (no output).";
    // Sync data again in case configurations changed (e.g., enabled a provider)
    setTimeout(refreshData, 500);
  } catch (error) {
    outputEl.className = "console-output error";
    outputEl.textContent = error;
  }
}

// Run CLI installation helper
async function startInstaller() {
  if (isInstalling) return;
  isInstalling = true;

  const installBtn = document.getElementById("install-cli-btn");
  const progressContainer = document.getElementById("install-progress-container");
  const progressText = document.getElementById("install-progress-text");
  const logEl = document.getElementById("install-log");

  installBtn.disabled = true;
  progressContainer.style.display = "flex";
  logEl.textContent = "";

  // Listen to install-progress events from Tauri backend
  const unlisten = await window.__TAURI__.event.listen("install-progress", (event) => {
    const msg = event.payload;
    progressText.textContent = msg;
    logEl.textContent += `[installer] ${msg}\n`;
    logEl.scrollTop = logEl.scrollHeight;
  });

  try {
    const result = await invoke("install_cli");
    logEl.textContent += `[installer] Success: ${result}\n`;
    progressText.textContent = "Successfully installed!";
    
    // Hide overlay after a brief delay and trigger data sync
    setTimeout(() => {
      document.getElementById("install-overlay").style.display = "none";
      isInstalling = false;
      installBtn.disabled = false;
      progressContainer.style.display = "none";
      unlisten();
      refreshData();
    }, 1500);

  } catch (error) {
    console.error("Installation failed:", error);
    logEl.className = "install-log error";
    logEl.textContent += `[installer] Error: ${error}\n`;
    progressText.textContent = "Installation failed. Please retry.";
    
    installBtn.disabled = false;
    isInstalling = false;
    unlisten();
  }
}

// Startup Initialization
window.addEventListener("DOMContentLoaded", () => {
  // Load cache immediately
  syncData().then(() => {
    // Trigger fresh sync in background
    refreshData();
  });

  // Polling loop (every 60 seconds)
  setInterval(refreshData, 60000);

  // Bind Actions
  document.getElementById("refresh-btn").addEventListener("click", refreshData);
  document.getElementById("install-cli-btn").addEventListener("click", startInstaller);

  // Command input handler
  const consoleInput = document.getElementById("console-input");
  consoleInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && consoleInput.value.trim() !== "") {
      executeCLICommand(consoleInput.value);
      consoleInput.value = "";
    }
  });
});


