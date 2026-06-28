#!/usr/bin/env node
import { spawn } from "child_process";
import os from "os";
import { createLauncher } from "./lib/launcher.js";

function getCachedAppImagePath() {
  return process.env.TOKEN_TRACKER_CACHED_APPIMAGE_PATH ?? null;
}

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

const launcher = createLauncher({
  os,
  runtime: {
    args: process.argv.slice(2),
    env: process.env,
    getCachedAppImagePath,
    error: (message) => console.error(message),
    info: (message) => console.log(message),
    exit: (code) => process.exit(code),
  },
  github: {},
  spawnAppImage: spawnInstalledBinary,
});

launcher.run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
