const { invoke } = window.__TAURI__.core;

// Mock Data for Demo Mode
const MOCK_USAGE = [
  {
    "provider": "claude",
    "provider_label": "Claude",
    "used": 42,
    "limit": 100,
    "unit": "requests",
    "percentage": 42.0,
    "resets_at": new Date(Date.now() + 3.4 * 60 * 60 * 1000).toISOString(),
    "pacing": {
      "stage": "onTrack",
      "deltaPercent": -1.5
    }
  },
  {
    "provider": "codex",
    "provider_label": "Codex",
    "used": 38200,
    "limit": 50000,
    "unit": "tokens",
    "percentage": 76.4,
    "resets_at": new Date(Date.now() + 8.1 * 60 * 60 * 1000).toISOString(),
    "pacing": {
      "stage": "slightlyBehind",
      "deltaPercent": 4.2
    }
  },
  {
    "provider": "gemini",
    "provider_label": "Gemini",
    "used": 14,
    "limit": 15,
    "unit": "requests",
    "percentage": 93.3,
    "resets_at": new Date(Date.now() + 0.4 * 60 * 60 * 1000).toISOString(),
    "pacing": {
      "stage": "behind",
      "deltaPercent": 15.3
    }
  },
  {
    "provider": "openai",
    "provider_label": "OpenAI",
    "used": 1250,
    "limit": 10000,
    "unit": "tokens",
    "percentage": 12.5,
    "resets_at": new Date(Date.now() + 24.5 * 60 * 60 * 1000).toISOString(),
    "pacing": {
      "stage": "ahead",
      "deltaPercent": -12.4
    }
  }
];

const MOCK_COST = [
  {
    "provider": "claude",
    "totalCostUSD": 2.45,
    "last30DaysCostUSD": 14.82,
    "modelBreakdowns": [
      {
        "modelName": "claude-3-5-sonnet",
        "costUSD": 11.24,
        "totalTokens": 320000
      },
      {
        "modelName": "claude-3-opus",
        "costUSD": 3.58,
        "totalTokens": 45000
      }
    ]
  },
  {
    "provider": "codex",
    "totalCostUSD": 0.85,
    "last30DaysCostUSD": 4.12,
    "modelBreakdowns": [
      {
        "modelName": "codex-flash",
        "costUSD": 3.12,
        "totalTokens": 624000
      },
      {
        "modelName": "codex-pro",
        "costUSD": 1.00,
        "totalTokens": 50000
      }
    ]
  }
];

let isRefreshing = false;

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
  
  if (cliItem.usage && cliItem.usage.primary) {
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

// Fetch both Quota Usage & Cost Spend data
async function syncData() {
  if (isRefreshing) return;
  isRefreshing = true;
  
  const refreshBtn = document.getElementById("refresh-btn");
  refreshBtn.classList.add("spinning");

  const statusDot = document.getElementById("status-dot");
  const statusText = document.getElementById("status-text");
  
  try {
    const cliStatus = await invoke("get_cli_status");
    let usageData, costData;

    if (cliStatus.status === "available") {
      statusDot.className = "badge-dot running";
      statusText.textContent = "CLI Active";
      
      try {
        const rawUsage = await invoke("get_usage_data");
        const rawCost = await invoke("get_cost_data");
        
        usageData = rawUsage.map(mapCLIUsage);
        costData = rawCost.map(mapCLICost);
      } catch (err) {
        console.warn("Direct CLI fetch failed, falling back to demo mode", err);
        statusDot.className = "badge-dot demo";
        statusText.textContent = "Demo Mode";
        usageData = MOCK_USAGE;
        costData = MOCK_COST;
      }
    } else {
      statusDot.className = "badge-dot demo";
      statusText.textContent = "Demo Mode";
      usageData = MOCK_USAGE;
      costData = MOCK_COST;
    }

    renderUsage(usageData);
    renderCost(costData);

  } catch (error) {
    console.error("Sync error:", error);
    renderUsage(MOCK_USAGE);
    renderCost(MOCK_COST);
  } finally {
    document.getElementById("loader").style.display = "none";
    document.getElementById("providers-container").style.display = "block";
    document.getElementById("cost-container").style.display = "block";
    
    isRefreshing = false;
    refreshBtn.classList.remove("spinning");
  }
}

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

    const labelText = (p.used !== null && p.limit !== null)
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
    setTimeout(syncData, 500);
  } catch (error) {
    outputEl.className = "console-output error";
    outputEl.textContent = error;
  }
}

// Startup Initialization
window.addEventListener("DOMContentLoaded", () => {
  // Sync immediately
  syncData();

  // Polling loop (every 60 seconds)
  setInterval(syncData, 60000);

  // Bind Actions
  document.getElementById("refresh-btn").addEventListener("click", syncData);

  // Command input handler
  const consoleInput = document.getElementById("console-input");
  consoleInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && consoleInput.value.trim() !== "") {
      executeCLICommand(consoleInput.value);
      consoleInput.value = "";
    }
  });
});
