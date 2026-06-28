#!/usr/bin/env node
import https from "https";
import http from "http";
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import os from "os";

const REPO = "ayan-de/Token-Tracker";
const OWNER = "ayan-de";
const APP_NAME = "TokenTracker";

function getAssetUrl(version, filename) {
  return `https://github.com/${OWNER}/${REPO}/releases/download/v${version}/${filename}`;
}

function getLatestVersion() {
  return new Promise((resolve, reject) => {
    const req = https.get(
      `https://api.github.com/repos/${REPO}/releases/latest`,
      { headers: { "User-Agent": "tokentracker-npm" } },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const json = JSON.parse(data);
            resolve(json.tag_name.replace("v", ""));
          } catch {
            reject(new Error("Failed to parse GitHub API response"));
          }
        });
      }
    );
    req.on("error", reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error("Timeout reaching GitHub API"));
    });
  });
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const protocol = url.startsWith("https") ? https : http;
    const req = protocol.get(url, { headers: { "User-Agent": "tokentracker-npm" } }, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        file.close();
        downloadFile(res.headers.location, dest).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        file.close();
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      res.pipe(file);
      file.on("finish", () => file.close(resolve));
    });
    req.on("error", (err) => {
      file.close();
      reject(err);
    });
    req.setTimeout(60000, () => {
      req.destroy();
      reject(new Error("Download timeout"));
    });
  });
}

async function ensureInstalled(version) {
  const platform = os.platform();
  if (platform !== "linux") {
    console.error("TokenTracker npm install only supports Linux currently.");
    console.error("Download from: https://github.com/ayan-de/Token-Tracker/releases");
    process.exit(1);
  }

  const arch = os.arch() === "x64" ? "amd64" : os.arch();
  const filename = `TokenTracker_${version}_${arch}.deb`;
  const url = getAssetUrl(version, filename);
  const tmpDir = path.join(os.tmpdir(), "tokentracker-install");
  const debPath = path.join(tmpDir, filename);

  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  if (!fs.existsSync(debPath)) {
    console.log(`Downloading TokenTracker v${version}...`);
    await downloadFile(url, debPath);
  }

  return debPath;
}

async function installAndRun() {
  try {
    const version = process.env.TOKEN_TRACKER_VERSION || await getLatestVersion();
    const debPath = await ensureInstalled(version);

    console.log(`Installing TokenTracker v${version}...`);
    const dpkg = spawn("sudo", ["dpkg", "-i", debPath], { stdio: "inherit" });
    dpkg.on("close", (code) => {
      if (code === 0) {
        console.log("TokenTracker installed successfully!");
        console.log('Run "tokentracker" to start.');
      } else {
        console.error("Installation failed. Try running with sudo.");
      }
    });
  } catch (err) {
    console.error("Error:", err.message);
    console.error("\nDownload manually: https://github.com/ayan-de/Token-Tracker/releases");
    process.exit(1);
  }
}

const args = process.argv.slice(2);

if (args.includes("--install") || args.includes("-i")) {
  installAndRun();
} else {
  // Direct execution path
  const tokentrackerBin = "/usr/lib/TokenTracker/_up_/target/release/backend";
  const tauriBin = "/usr/bin/tokentracker";

  let binPath = null;
  if (fs.existsSync(tauriBin)) binPath = tauriBin;
  else if (fs.existsSync(tokentrackerBin)) binPath = tokentrackerBin;

  if (!binPath) {
    console.log("TokenTracker not found. Installing...");
    installAndRun();
    return;
  }

  // Spawn the actual app
  const child = spawn(binPath, [], {
    stdio: "inherit",
    env: { ...process.env },
  });
  child.on("close", (code) => process.exit(code));
}
