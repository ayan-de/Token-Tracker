# Linux npm AppImage Installer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `npm install -g @thisisayande/tokentracker` followed by `tokentracker` work on Linux by downloading and launching a cached AppImage from GitHub Releases.

**Architecture:** Keep `bin/tokentracker.js` as the CLI entrypoint, but move the npm-launcher logic into focused helper modules for release resolution, filesystem/runtime state, and process launching. The launcher performs a user-space bootstrap into `~/.local/share/tokentracker`, caches the current AppImage plus version metadata, and reuses or updates that artifact on later runs.

**Tech Stack:** Node.js ESM, Node built-in `node:test`, GitHub Releases HTTP API, Tauri AppImage release artifacts

---

## File Structure

- Create: `bin/lib/constants.js` - shared release URLs, app name, and asset naming helpers
- Create: `bin/lib/github.js` - latest-release lookup and download helper with redirect handling
- Create: `bin/lib/runtime.js` - user-space path resolution, atomic file moves, metadata read/write, executable permissions
- Create: `bin/lib/launcher.js` - orchestration for Linux checks, version resolution, install/update decision, and AppImage spawn
- Modify: `bin/tokentracker.js` - thin CLI entrypoint that delegates to the launcher module
- Create: `tests/npm-launcher/launcher.test.mjs` - unit tests for Linux-only behavior, cached install behavior, update behavior, and asset naming
- Modify: `package.json` - remove broken `postinstall`, add launcher test script, and include packaged helper files
- Modify: `README.md` - describe Linux npm behavior as AppImage bootstrapper
- Modify: `PUBLISH.md` - update publish checklist and npm package explanation around AppImage assets

### Task 1: Create a testable launcher module boundary

**Files:**
- Create: `bin/lib/constants.js`
- Create: `bin/lib/launcher.js`
- Create: `tests/npm-launcher/launcher.test.mjs`
- Modify: `bin/tokentracker.js`
- Modify: `package.json`

- [ ] **Step 1: Write the failing launcher tests**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { createLauncher } from "../../bin/lib/launcher.js";

test("rejects non-Linux platforms with a release URL", async () => {
  const launcher = createLauncher({
    os: { platform: () => "win32", arch: () => "x64" },
    runtime: {},
    github: {},
    spawnAppImage: async () => {},
  });

  await assert.rejects(() => launcher.run(), {
    message: /supports Linux only/i,
  });
});

test("uses cached AppImage when installed version matches", async () => {
  const events = [];
  const launcher = createLauncher({
    os: { platform: () => "linux", arch: () => "x64" },
    runtime: {
      getStatePaths: () => ({ currentAppImagePath: "/tmp/TokenTracker.AppImage" }),
      readInstalledVersion: async () => "0.1.11",
      hasInstalledAppImage: async () => true,
    },
    github: {
      getDesiredVersion: async () => "0.1.11",
      downloadReleaseAsset: async () => {
        throw new Error("download should not run");
      },
    },
    spawnAppImage: async (filePath) => events.push(filePath),
  });

  await launcher.run();
  assert.deepEqual(events, ["/tmp/TokenTracker.AppImage"]);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/npm-launcher/launcher.test.mjs`

Expected: FAIL with `Cannot find module '../../bin/lib/launcher.js'` or `createLauncher` not exported yet.

- [ ] **Step 3: Add the shared constants module**

```js
export const OWNER = "ayan-de";
export const REPO = "Token-Tracker";
export const APP_NAME = "TokenTracker";
export const RELEASES_URL = `https://github.com/${OWNER}/${REPO}/releases`;
export const GITHUB_API_LATEST_RELEASE = `https://api.github.com/repos/${OWNER}/${REPO}/releases/latest`;

export function getAppImageAssetName(version, arch) {
  return `${APP_NAME}_${version}_${arch}.AppImage`;
}
```

- [ ] **Step 4: Add the initial launcher boundary with dependency injection**

```js
import { RELEASES_URL } from "./constants.js";

export function createLauncher({ os, runtime, github, spawnAppImage }) {
  return {
    async run() {
      if (os.platform() !== "linux") {
        throw new Error(`TokenTracker npm package supports Linux only. See ${RELEASES_URL}`);
      }

      const desiredVersion = await github.getDesiredVersion();
      const statePaths = runtime.getStatePaths();
      const installedVersion = await runtime.readInstalledVersion(statePaths);
      const hasInstalledAppImage = await runtime.hasInstalledAppImage(statePaths);

      if (hasInstalledAppImage && installedVersion === desiredVersion) {
        await spawnAppImage(statePaths.currentAppImagePath);
        return;
      }

      throw new Error("install flow not implemented yet");
    },
  };
}
```

- [ ] **Step 5: Convert the CLI entrypoint into a thin wrapper**

```js
#!/usr/bin/env node
import os from "os";
import { createLauncher } from "./lib/launcher.js";

const launcher = createLauncher({
  os,
  runtime: {
    getStatePaths() {
      throw new Error("runtime.getStatePaths not implemented yet");
    },
    readInstalledVersion() {
      throw new Error("runtime.readInstalledVersion not implemented yet");
    },
    hasInstalledAppImage() {
      throw new Error("runtime.hasInstalledAppImage not implemented yet");
    },
  },
  github: {
    getDesiredVersion() {
      throw new Error("github.getDesiredVersion not implemented yet");
    },
  },
  spawnAppImage() {
    throw new Error("spawnAppImage not implemented yet");
  },
});

launcher.run().catch((error) => {
  console.error("Error:", error.message);
  process.exit(1);
});
```

- [ ] **Step 6: Add a focused launcher test script to `package.json`**

```json
{
  "scripts": {
    "test:npm-launcher": "node --test tests/npm-launcher/*.test.mjs"
  }
}
```

- [ ] **Step 7: Run the launcher tests again**

Run: `npm run test:npm-launcher`

Expected: FAIL with `install flow not implemented yet`, proving the test harness reaches the orchestration layer.

- [ ] **Step 8: Commit the scaffolding**

```bash
git add bin/tokentracker.js bin/lib/constants.js bin/lib/launcher.js tests/npm-launcher/launcher.test.mjs package.json
git commit -m "test: scaffold npm launcher module boundary"
```

### Task 2: Implement user-space runtime storage and cached launch behavior

**Files:**
- Create: `bin/lib/runtime.js`
- Modify: `bin/lib/launcher.js`
- Modify: `bin/tokentracker.js`
- Modify: `tests/npm-launcher/launcher.test.mjs`

- [ ] **Step 1: Add a failing test for first-time install paths and metadata storage**

```js
test("downloads into a user-owned runtime directory on first launch", async () => {
  const actions = [];
  const launcher = createLauncher({
    os: { platform: () => "linux", arch: () => "x64", homedir: () => "/home/tester" },
    runtime: {
      getStatePaths: () => ({
        baseDir: "/home/tester/.local/share/tokentracker",
        currentDir: "/home/tester/.local/share/tokentracker/current",
        downloadsDir: "/home/tester/.local/share/tokentracker/downloads",
        currentAppImagePath: "/home/tester/.local/share/tokentracker/current/TokenTracker.AppImage",
        versionFilePath: "/home/tester/.local/share/tokentracker/current/version.json",
      }),
      readInstalledVersion: async () => null,
      hasInstalledAppImage: async () => false,
      ensureStateDirs: async (paths) => actions.push(["ensureStateDirs", paths.baseDir]),
      installDownloadedAppImage: async ({ version }) => actions.push(["installDownloadedAppImage", version]),
    },
    github: {
      getDesiredVersion: async () => "0.1.11",
      downloadReleaseAsset: async () => "/tmp/TokenTracker_0.1.11_amd64.AppImage",
    },
    spawnAppImage: async (filePath) => actions.push(["spawn", filePath]),
  });

  await launcher.run();
  assert.deepEqual(actions, [
    ["ensureStateDirs", "/home/tester/.local/share/tokentracker"],
    ["installDownloadedAppImage", "0.1.11"],
    ["spawn", "/home/tester/.local/share/tokentracker/current/TokenTracker.AppImage"],
  ]);
});
```

- [ ] **Step 2: Run the launcher tests to verify the new case fails**

Run: `npm run test:npm-launcher`

Expected: FAIL because `ensureStateDirs` and `installDownloadedAppImage` are not called yet.

- [ ] **Step 3: Implement runtime path and metadata helpers**

```js
import fs from "fs/promises";
import os from "os";
import path from "path";

export function getStatePaths() {
  const baseDir = path.join(os.homedir(), ".local", "share", "tokentracker");
  const currentDir = path.join(baseDir, "current");
  const downloadsDir = path.join(baseDir, "downloads");

  return {
    baseDir,
    currentDir,
    downloadsDir,
    currentAppImagePath: path.join(currentDir, "TokenTracker.AppImage"),
    versionFilePath: path.join(currentDir, "version.json"),
  };
}

export async function ensureStateDirs(paths) {
  await fs.mkdir(paths.currentDir, { recursive: true });
  await fs.mkdir(paths.downloadsDir, { recursive: true });
}

export async function hasInstalledAppImage(paths) {
  try {
    await fs.access(paths.currentAppImagePath);
    return true;
  } catch {
    return false;
  }
}

export async function readInstalledVersion(paths) {
  try {
    const raw = await fs.readFile(paths.versionFilePath, "utf8");
    return JSON.parse(raw).version ?? null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Implement atomic install helpers for the downloaded AppImage**

```js
import fs from "fs/promises";

export async function installDownloadedAppImage({ tempFilePath, paths, version }) {
  await fs.chmod(tempFilePath, 0o755);
  await fs.rename(tempFilePath, paths.currentAppImagePath);

  const versionPayload = JSON.stringify({ version }, null, 2);
  await fs.writeFile(paths.versionFilePath, versionPayload);
}
```

- [ ] **Step 5: Extend the launcher to create directories, install downloaded files, and launch the cached path**

```js
export function createLauncher({ os, runtime, github, spawnAppImage }) {
  return {
    async run() {
      if (os.platform() !== "linux") {
        throw new Error(`TokenTracker npm package supports Linux only. See ${RELEASES_URL}`);
      }

      const statePaths = runtime.getStatePaths();
      const desiredVersion = await github.getDesiredVersion();
      const installedVersion = await runtime.readInstalledVersion(statePaths);
      const hasInstalledAppImage = await runtime.hasInstalledAppImage(statePaths);

      if (hasInstalledAppImage && installedVersion === desiredVersion) {
        await spawnAppImage(statePaths.currentAppImagePath);
        return;
      }

      await runtime.ensureStateDirs(statePaths);
      const tempFilePath = await github.downloadReleaseAsset({
        version: desiredVersion,
        arch: os.arch(),
        downloadsDir: statePaths.downloadsDir,
      });

      await runtime.installDownloadedAppImage({
        tempFilePath,
        paths: statePaths,
        version: desiredVersion,
      });

      await spawnAppImage(statePaths.currentAppImagePath);
    },
  };
}
```

- [ ] **Step 6: Wire the real runtime module into `bin/tokentracker.js`**

```js
#!/usr/bin/env node
import os from "os";
import { spawn } from "child_process";
import * as runtime from "./lib/runtime.js";
import { createLauncher } from "./lib/launcher.js";

async function spawnAppImage(filePath) {
  await new Promise((resolve, reject) => {
    const child = spawn(filePath, [], { stdio: "inherit", env: { ...process.env } });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0 || code === null) resolve();
      else reject(new Error(`TokenTracker exited with code ${code}`));
    });
  });
}

const launcher = createLauncher({
  os,
  runtime,
  github: {
    getDesiredVersion() {
      throw new Error("github.getDesiredVersion not implemented yet");
    },
    downloadReleaseAsset() {
      throw new Error("github.downloadReleaseAsset not implemented yet");
    },
  },
  spawnAppImage,
});

launcher.run().catch((error) => {
  console.error("Error:", error.message);
  process.exit(1);
});
```

- [ ] **Step 7: Run the launcher tests again**

Run: `npm run test:npm-launcher`

Expected: PASS for the non-Linux and cached-install tests, and PASS for the new first-run storage test.

- [ ] **Step 8: Commit the runtime storage work**

```bash
git add bin/lib/runtime.js bin/lib/launcher.js bin/tokentracker.js tests/npm-launcher/launcher.test.mjs
git commit -m "feat: cache Linux AppImage in user space"
```

### Task 3: Implement GitHub release lookup, AppImage downloads, and update behavior

**Files:**
- Create: `bin/lib/github.js`
- Modify: `bin/lib/launcher.js`
- Modify: `bin/tokentracker.js`
- Modify: `tests/npm-launcher/launcher.test.mjs`

- [ ] **Step 1: Add failing tests for asset naming, version override, and update downloads**

```js
test("maps x64 to amd64 AppImage assets", async () => {
  const downloads = [];
  const launcher = createLauncher({
    os: { platform: () => "linux", arch: () => "x64" },
    runtime: {
      getStatePaths: () => ({ currentAppImagePath: "/tmp/current.AppImage", downloadsDir: "/tmp/downloads" }),
      readInstalledVersion: async () => "0.1.10",
      hasInstalledAppImage: async () => true,
      ensureStateDirs: async () => {},
      installDownloadedAppImage: async () => {},
    },
    github: {
      getDesiredVersion: async () => "0.1.11",
      downloadReleaseAsset: async (input) => {
        downloads.push(input);
        return "/tmp/TokenTracker_0.1.11_amd64.AppImage";
      },
    },
    spawnAppImage: async () => {},
  });

  await launcher.run();
  assert.deepEqual(downloads, [
    { version: "0.1.11", arch: "amd64", downloadsDir: "/tmp/downloads" },
  ]);
});

test("uses TOKEN_TRACKER_VERSION when provided", async () => {
  assert.equal(
    await getDesiredVersion({ env: { TOKEN_TRACKER_VERSION: "0.1.15" }, getLatestVersion: async () => "0.1.11" }),
    "0.1.15"
  );
});
```

- [ ] **Step 2: Run the launcher tests to verify the update cases fail**

Run: `npm run test:npm-launcher`

Expected: FAIL because `x64` is still passed through unchanged and `getDesiredVersion` is not implemented.

- [ ] **Step 3: Implement GitHub API helpers and asset download logic**

```js
import fs from "fs";
import https from "https";
import http from "http";
import path from "path";
import { GITHUB_API_LATEST_RELEASE, RELEASES_URL, getAppImageAssetName } from "./constants.js";

export async function getLatestVersion() {
  return new Promise((resolve, reject) => {
    const req = https.get(GITHUB_API_LATEST_RELEASE, { headers: { "User-Agent": "tokentracker-npm" } }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          if (!json.tag_name) {
            reject(new Error(`Latest release did not include a tag. See ${RELEASES_URL}`));
            return;
          }
          resolve(json.tag_name.replace(/^v/, ""));
        } catch {
          reject(new Error("Failed to parse GitHub API response"));
        }
      });
    });

    req.on("error", reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error("Timeout reaching GitHub API"));
    });
  });
}

export async function getDesiredVersion({ env, getLatestVersion: latest }) {
  return env.TOKEN_TRACKER_VERSION || latest();
}

export async function downloadReleaseAsset({ version, arch, downloadsDir }) {
  const assetName = getAppImageAssetName(version, arch);
  const destination = path.join(downloadsDir, `${assetName}.download`);
  const url = `https://github.com/ayan-de/Token-Tracker/releases/download/v${version}/${assetName}`;

  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destination);
    const protocol = url.startsWith("https") ? https : http;
    const request = protocol.get(url, { headers: { "User-Agent": "tokentracker-npm" } }, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        file.close();
        reject(new Error("Redirect handling should be implemented before merging this step"));
        return;
      }
      if (response.statusCode !== 200) {
        file.close();
        reject(new Error(`Failed to download ${assetName}: HTTP ${response.statusCode}`));
        return;
      }
      response.pipe(file);
      file.on("finish", () => file.close(() => resolve(destination)));
    });

    request.on("error", reject);
    request.setTimeout(60000, () => {
      request.destroy();
      reject(new Error(`Download timeout for ${assetName}`));
    });
  });
}
```

- [ ] **Step 4: Normalize architecture before asset lookup and wire the GitHub module into the CLI**

```js
function normalizeLinuxArch(nodeArch) {
  if (nodeArch === "x64") return "amd64";
  throw new Error(`Unsupported Linux architecture: ${nodeArch}`);
}

const normalizedArch = normalizeLinuxArch(os.arch());
const tempFilePath = await github.downloadReleaseAsset({
  version: desiredVersion,
  arch: normalizedArch,
  downloadsDir: statePaths.downloadsDir,
});
```

```js
import * as github from "./lib/github.js";

const launcher = createLauncher({
  os,
  runtime,
  github: {
    getDesiredVersion() {
      return github.getDesiredVersion({ env: process.env, getLatestVersion: github.getLatestVersion });
    },
    downloadReleaseAsset: github.downloadReleaseAsset,
  },
  spawnAppImage,
});
```

- [ ] **Step 5: Add redirect cleanup and partial-download cleanup before finalizing the GitHub module**

```js
export async function downloadReleaseAsset({ version, arch, downloadsDir, urlOverride }) {
  const assetName = getAppImageAssetName(version, arch);
  const destination = path.join(downloadsDir, `${assetName}.download`);
  const url = urlOverride || `https://github.com/ayan-de/Token-Tracker/releases/download/v${version}/${assetName}`;

  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destination);
    const protocol = url.startsWith("https") ? https : http;
    const request = protocol.get(url, { headers: { "User-Agent": "tokentracker-npm" } }, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        file.close(() => {
          fs.rmSync(destination, { force: true });
          downloadReleaseAsset({ version, arch, downloadsDir, urlOverride: response.headers.location })
            .then(resolve)
            .catch(reject);
        });
        return;
      }

      if (response.statusCode !== 200) {
        file.close(() => {
          fs.rmSync(destination, { force: true });
          reject(new Error(`Failed to download ${assetName}: HTTP ${response.statusCode}`));
        });
        return;
      }

      response.pipe(file);
      file.on("finish", () => file.close(() => resolve(destination)));
    });

    request.on("error", (error) => {
      file.close(() => {
        fs.rmSync(destination, { force: true });
        reject(error);
      });
    });
  });
}
```

- [ ] **Step 6: Run the launcher tests again**

Run: `npm run test:npm-launcher`

Expected: PASS for cached-launch, first-run install, architecture normalization, and version-override behavior.

- [ ] **Step 7: Commit the GitHub/AppImage download flow**

```bash
git add bin/lib/github.js bin/lib/launcher.js bin/tokentracker.js tests/npm-launcher/launcher.test.mjs
git commit -m "feat: download AppImage releases for npm launcher"
```

### Task 4: Fix npm packaging and verify the published tarball contents

**Files:**
- Modify: `package.json`
- Modify: `tests/npm-launcher/launcher.test.mjs`

- [ ] **Step 1: Add a failing packaging test for launcher helper inclusion assumptions**

```js
test("package metadata includes launcher helpers and no postinstall hook", async () => {
  const packageJson = JSON.parse(await readFile(new URL("../../package.json", import.meta.url), "utf8"));

  assert.equal(packageJson.scripts.postinstall, undefined);
  assert.deepEqual(packageJson.files, ["bin/"]);
  assert.match(packageJson.scripts["test:npm-launcher"], /node --test/);
});
```

- [ ] **Step 2: Run the launcher tests to verify the metadata test fails**

Run: `npm run test:npm-launcher`

Expected: FAIL because `postinstall` still exists and `files` still includes `dist/`.

- [ ] **Step 3: Update `package.json` to publish only the working launcher package**

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "tauri": "tauri",
    "tauri:dev": "tauri dev",
    "tauri:build": "next build && tauri build",
    "test:smoke": "playwright test",
    "test:smoke:ui": "playwright test --ui",
    "test:npm-launcher": "node --test tests/npm-launcher/*.test.mjs"
  },
  "files": [
    "bin/"
  ]
}
```

- [ ] **Step 4: Extend the tests to assert that helper modules are importable from the packaged layout**

```js
import { getAppImageAssetName } from "../../bin/lib/constants.js";

test("launcher helper modules are importable from the published bin tree", () => {
  assert.equal(getAppImageAssetName("0.1.11", "amd64"), "TokenTracker_0.1.11_amd64.AppImage");
});
```

- [ ] **Step 5: Run tests and inspect the tarball contents**

Run: `npm run test:npm-launcher && npm pack --dry-run`

Expected:
- `npm run test:npm-launcher` shows all launcher tests passing
- `npm pack --dry-run` lists `bin/tokentracker.js` and every file under `bin/lib/`
- no `scripts/postinstall.js` reference remains in package metadata

- [ ] **Step 6: Commit the package metadata fixes**

```bash
git add package.json tests/npm-launcher/launcher.test.mjs
git commit -m "fix: publish working npm launcher package"
```

### Task 5: Update documentation for the Linux AppImage npm flow

**Files:**
- Modify: `README.md`
- Modify: `PUBLISH.md`

- [ ] **Step 1: Add a failing docs review checklist to the working notes and compare against current docs**

```md
- README must say Linux npm installs use an AppImage bootstrapper
- README must not imply Windows npm install support
- PUBLISH must require an AppImage release asset for every npm-targeted release
- PUBLISH must describe `.deb` as a direct-download artifact, not the npm runtime
```

- [ ] **Step 2: Update `README.md` installation language**

```md
## Getting Started

### Linux npm install

~~~bash
npm install -g @thisisayande/tokentracker
tokentracker
~~~

The npm package installs a Linux launcher. On first run, the launcher downloads the latest TokenTracker AppImage from GitHub Releases into the user's local app data directory and starts it. This npm flow is intended for Linux only.

### Direct release downloads

GitHub Releases continue to provide native artifacts such as `.deb` for users who prefer direct installation.
```

- [ ] **Step 3: Update `PUBLISH.md` to require AppImage release assets and explain the npm flow accurately**

```md
## Overview

TokenTracker is published in two Linux-facing forms:
- **GitHub Releases** — direct-download artifacts including `.deb` and `AppImage`
- **npm** — `@thisisayande/tokentracker` Linux launcher for `npm install -g`

## Release Workflow

### 1. Build the app

~~~bash
npm run tauri:build
~~~

This produces Linux artifacts under `target/release/bundle/`, including the AppImage required by the npm launcher.

### 4. Upload Linux release artifacts

~~~bash
gh release upload v0.x.x \
  target/release/bundle/deb/TokenTracker_<VERSION>_amd64.deb \
  target/release/bundle/appimage/TokenTracker_<VERSION>_amd64.AppImage \
  --repo ayan-de/Token-Tracker \
  --clobber
~~~

## npm Package

On first run, the launcher downloads the latest AppImage from GitHub Releases into user space and starts it. The npm flow does not install `.deb` packages.
```

- [ ] **Step 4: Review docs for contradictions and adjust wording in-place**

Run: `git diff -- README.md PUBLISH.md`

Expected: docs consistently describe npm as Linux-only AppImage bootstrapper and `.deb` as a separate direct-download option.

- [ ] **Step 5: Commit the docs changes**

```bash
git add README.md PUBLISH.md
git commit -m "docs: describe Linux AppImage npm flow"
```

### Task 6: Verify the end-to-end launcher flow before publishing

**Files:**
- Modify: `bin/lib/github.js` if verification exposes missing cleanup
- Modify: `bin/lib/runtime.js` if verification exposes atomic-write issues
- Modify: `PUBLISH.md` if the verification steps need clearer release instructions

- [ ] **Step 1: Run the focused launcher test suite**

Run: `npm run test:npm-launcher`

Expected: PASS for non-Linux rejection, cached launch, first-run install, architecture normalization, version override, and package metadata assertions.

- [ ] **Step 2: Inspect the npm tarball layout**

Run: `npm pack --dry-run`

Expected: package contents include `package.json`, `bin/tokentracker.js`, and the `bin/lib/` helper modules only.

- [ ] **Step 3: Smoke-test the launcher locally against a pinned version**

Run: `TOKEN_TRACKER_VERSION=0.1.11 node bin/tokentracker.js`

Expected: on Linux, the launcher either downloads and starts `TokenTracker_0.1.11_amd64.AppImage` or exits with a clear release-asset error if the asset is missing.

- [ ] **Step 4: Record any verification fixes immediately if the results differ**

```js
if (!response.headers.location) {
  throw new Error(`Missing redirect location for ${assetName}`);
}
```

- [ ] **Step 5: Commit any verification-only fixes**

```bash
git add bin/lib/github.js bin/lib/runtime.js PUBLISH.md
git commit -m "fix: harden npm launcher verification path"
```

## Self-Review

- Spec coverage check: the tasks cover Linux-only npm behavior, AppImage-only runtime downloads, user-space storage, cached launches, release asset naming, package publishing fixes, and docs updates.
- Placeholder scan: no `TODO`, `TBD`, or implied "handle this later" instructions remain in the task steps.
- Type consistency check: the plan consistently uses `createLauncher`, `getDesiredVersion`, `downloadReleaseAsset`, `installDownloadedAppImage`, `getStatePaths`, and `currentAppImagePath` across all tasks.
