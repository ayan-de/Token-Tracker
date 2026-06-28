import fs from "fs";
import os from "os";
import path from "path";

import { APP_NAME, APPIMAGE_EXT } from "./constants.js";

const STATE_DIR = path.join(os.homedir(), ".local", "share", "tokentracker");
const CURRENT_DIR = path.join(STATE_DIR, "current");
const DOWNLOADS_DIR = path.join(STATE_DIR, "downloads");
const CURRENT_APPIMAGE_PATH = path.join(CURRENT_DIR, `${APP_NAME}${APPIMAGE_EXT}`);
const CURRENT_VERSION_PATH = path.join(CURRENT_DIR, "version.json");

export function getRuntimePaths() {
  return {
    stateDir: STATE_DIR,
    currentDir: CURRENT_DIR,
    downloadsDir: DOWNLOADS_DIR,
    currentAppImagePath: CURRENT_APPIMAGE_PATH,
    currentVersionPath: CURRENT_VERSION_PATH,
  };
}

export async function ensureStateDirectories() {
  const { stateDir, currentDir, downloadsDir } = getRuntimePaths();

  await fs.promises.mkdir(stateDir, { recursive: true });
  await fs.promises.mkdir(currentDir, { recursive: true });
  await fs.promises.mkdir(downloadsDir, { recursive: true });
}

export function getInstalledAppImagePath() {
  const { currentAppImagePath } = getRuntimePaths();

  if (!fs.existsSync(currentAppImagePath)) {
    return null;
  }

  return currentAppImagePath;
}

export function readInstalledVersion() {
  const { currentVersionPath } = getRuntimePaths();

  if (!fs.existsSync(currentVersionPath)) {
    return null;
  }

  const metadata = JSON.parse(fs.readFileSync(currentVersionPath, "utf8"));
  return typeof metadata.version === "string" ? metadata.version : null;
}

export async function installDownloadedAppImage({ sourcePath, version }) {
  const { currentAppImagePath, currentVersionPath } = getRuntimePaths();

  await fs.promises.copyFile(sourcePath, currentAppImagePath);
  await fs.promises.chmod(currentAppImagePath, 0o755);
  await fs.promises.writeFile(
    currentVersionPath,
    JSON.stringify({ version }, null, 2) + "\n",
    "utf8"
  );

  return currentAppImagePath;
}
