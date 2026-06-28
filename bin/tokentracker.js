#!/usr/bin/env node
import fs from "fs";
import { spawn } from "child_process";
import os from "os";
import { createLauncher } from "./lib/launcher.js";

function getCachedAppImagePath() {
  const tokentrackerBin = "/usr/lib/TokenTracker/_up_/target/release/backend";
  const tauriBin = "/usr/bin/tokentracker";

  if (fs.existsSync(tauriBin)) return tauriBin;
  if (fs.existsSync(tokentrackerBin)) return tokentrackerBin;
  return null;
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
