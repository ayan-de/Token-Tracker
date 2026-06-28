import fs from "fs";
import os from "os";
import path from "path";

import { APP_NAME, APPIMAGE_EXT } from "./constants.js";

export function getRuntimePaths(homedir = os.homedir()) {
  const stateDir = path.join(homedir, ".local", "share", "tokentracker");
  const currentDir = path.join(stateDir, "current");
  const downloadsDir = path.join(stateDir, "downloads");
  const currentAppImagePath = path.join(currentDir, `${APP_NAME}${APPIMAGE_EXT}`);
  const currentVersionPath = path.join(currentDir, "version.json");

  return {
    stateDir,
    currentDir,
    downloadsDir,
    currentAppImagePath,
    currentVersionPath,
  };
}

export async function ensureStateDirectories(homedir = os.homedir()) {
  const { stateDir, currentDir, downloadsDir } = getRuntimePaths(homedir);

  await fs.promises.mkdir(stateDir, { recursive: true });
  await fs.promises.mkdir(currentDir, { recursive: true });
  await fs.promises.mkdir(downloadsDir, { recursive: true });
}

export function getInstalledAppImagePath(homedir = os.homedir()) {
  const { currentAppImagePath } = getRuntimePaths(homedir);

  if (!fs.existsSync(currentAppImagePath)) {
    return null;
  }

  return currentAppImagePath;
}

export function readInstalledVersion(homedir = os.homedir()) {
  const { currentVersionPath } = getRuntimePaths(homedir);

  if (!fs.existsSync(currentVersionPath)) {
    return null;
  }

  let metadata;
  try {
    metadata = JSON.parse(fs.readFileSync(currentVersionPath, "utf8"));
  } catch {
    return null;
  }
  return typeof metadata.version === "string" ? metadata.version : null;
}

export async function installDownloadedAppImage({ sourcePath, version, homedir = os.homedir() }) {
  const { currentDir, currentAppImagePath, currentVersionPath } = getRuntimePaths(homedir);

  await fs.promises.mkdir(currentDir, { recursive: true });

  const tmpAppImagePath = `${currentAppImagePath}.tmp.${Date.now()}`;
  const tmpVersionPath = `${currentVersionPath}.tmp.${Date.now()}`;

  try {
    await fs.promises.copyFile(sourcePath, tmpAppImagePath);
    await fs.promises.chmod(tmpAppImagePath, 0o755);
    await fs.promises.writeFile(
      tmpVersionPath,
      JSON.stringify({ version }, null, 2) + "\n",
      "utf8"
    );

    await fs.promises.rename(tmpAppImagePath, currentAppImagePath);
    await fs.promises.rename(tmpVersionPath, currentVersionPath);
  } catch (err) {
    await fs.promises.rm(tmpAppImagePath, { force: true });
    await fs.promises.rm(tmpVersionPath, { force: true });
    throw err;
  }

  return currentAppImagePath;
}