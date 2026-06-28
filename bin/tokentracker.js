#!/usr/bin/env node
import { spawn } from "child_process";
import https from "node:https";
import fs from "node:fs";
import os from "os";
import path from "path";
import { createLauncher } from "./lib/launcher.js";
import {
  ensureStateDirectories,
  getInstalledAppImagePath,
  installDownloadedAppImage,
  readInstalledVersion,
  getRuntimePaths,
} from "./lib/runtime.js";
import {
  getLatestVersion,
  getDesiredVersion,
  downloadReleaseAsset,
  normalizeArch,
} from "./lib/github.js";

function spawnInstalledBinary(binPath) {
  return new Promise((resolve) => {
    const child = spawn(binPath, [], {
      stdio: "inherit",
      env: { ...process.env },
    });

    child.on("close", (code) => {
      process.exit(code ?? 0);
      resolve();
    });
  });
}

function followRedirect(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    https.get(url, (res) => {
      if (res.statusCode === 200) {
        res.pipe(file);
        file.on("finish", () => {
          file.close();
          resolve(destPath);
        });
      } else {
        file.close();
        fs.promises.rm(destPath, { force: true }).catch(() => {});
        reject(new Error(`Download failed with status ${res.statusCode}`));
      }
    }).on("error", (err) => {
      file.close();
      fs.promises.rm(destPath, { force: true }).catch(() => {});
      reject(err);
    });
  });
}

async function installMissingAppImage({ github, runtime }) {
  const archStr = os.arch() === "x64" ? "x64" : os.arch();
  const arch = github.normalizeArch(archStr);
  const version = await github.getDesiredVersion({
    env: process.env,
    getLatestVersion: () => github.getLatestVersion({ https }),
  });
  const { downloadsDir } = getRuntimePaths();
  const normalizedArch = arch === "x64" ? "amd64" : arch;
  const destPath = path.join(downloadsDir, `TokenTracker_${version}_${normalizedArch}.AppImage`);

  const result = await github.downloadReleaseAsset({
    version,
    arch,
    downloadsDir,
    https,
    followRedirect: (url) => followRedirect(url, destPath),
  });

  return { filePath: destPath, version };
}

const launcher = createLauncher({
  os,
  runtime: {
    args: process.argv.slice(2),
    env: process.env,
    ensureStateDirectories,
    getInstalledAppImagePath,
    installDownloadedAppImage,
    readInstalledVersion,
    error: (message) => console.error(message),
    info: (message) => console.log(message),
    exit: (code) => process.exit(code),
  },
  github: {
    getLatestVersion,
    getDesiredVersion,
    downloadReleaseAsset,
    normalizeArch,
  },
  spawnAppImage: spawnInstalledBinary,
  installMissingAppImage,
});

launcher.run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});