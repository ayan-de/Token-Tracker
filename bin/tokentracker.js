#!/usr/bin/env node
import { spawn } from "child_process";
import os from "os";
import { INSTALL_FLOW_NOT_IMPLEMENTED_MESSAGE } from "./lib/constants.js";
import { createLauncher } from "./lib/launcher.js";
import {
  ensureStateDirectories,
  getInstalledAppImagePath,
  installDownloadedAppImage,
  readInstalledVersion,
} from "./lib/runtime.js";

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

async function installMissingAppImage() {
  throw new Error(INSTALL_FLOW_NOT_IMPLEMENTED_MESSAGE);
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
  github: {},
  spawnAppImage: spawnInstalledBinary,
  installMissingAppImage,
});

launcher.run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
