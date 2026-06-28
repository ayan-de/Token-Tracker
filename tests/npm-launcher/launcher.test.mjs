import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";

import { createLauncher } from "../../bin/lib/launcher.js";

test("wrapper no longer encodes legacy installed system binary paths", () => {
  const wrapperSource = fs.readFileSync(
    new URL("../../bin/tokentracker.js", import.meta.url),
    "utf8"
  );

  assert.equal(wrapperSource.includes("/usr/bin/tokentracker"), false);
  assert.equal(
    wrapperSource.includes("/usr/lib/TokenTracker/_up_/target/release/backend"),
    false
  );
});

function createRuntime(overrides = {}) {
  const calls = {
    error: [],
    info: [],
    exit: [],
  };

  const runtime = {
    args: [],
    env: {},
    ensureStateDirectories: async () => {},
    getInstalledAppImagePath: () => null,
    installDownloadedAppImage: async () => {
      throw new Error("installDownloadedAppImage not stubbed");
    },
    readInstalledVersion: () => null,
    error: (message) => calls.error.push(message),
    info: (message) => calls.info.push(message),
    exit: (code) => {
      calls.exit.push(code);
      return code;
    },
    ...overrides,
  };

  return { runtime, calls };
}

test("rejects non-Linux platforms", async () => {
  const { runtime, calls } = createRuntime();
  const launcher = createLauncher({
    os: { platform: () => "darwin" },
    runtime,
    github: {},
    spawnAppImage: async () => {
      throw new Error("spawn should not be called");
    },
  });

  await launcher.run();

  assert.deepEqual(calls.error, [
    "TokenTracker npm launcher currently supports Linux only.",
  ]);
  assert.deepEqual(calls.exit, [1]);
});

test("uses cached AppImage when available", async () => {
  const { runtime } = createRuntime({
    getInstalledAppImagePath: () => "/tmp/TokenTracker.AppImage",
  });
  const spawnCalls = [];
  const launcher = createLauncher({
    os: { platform: () => "linux" },
    runtime,
    github: {},
    spawnAppImage: async (filePath) => {
      spawnCalls.push(filePath);
    },
  });

  await launcher.run();

  assert.deepEqual(spawnCalls, ["/tmp/TokenTracker.AppImage"]);
});

test("hands off missing AppImage installation through injected boundary", async () => {
  const runtimeInstallCalls = [];
  const { runtime } = createRuntime({
    ensureStateDirectories: async () => {},
    getInstalledAppImagePath: () => null,
    installDownloadedAppImage: async ({ sourcePath, version }) => {
      runtimeInstallCalls.push({ sourcePath, version });
      return "/tmp/state/current/TokenTracker.AppImage";
    },
    readInstalledVersion: () => null,
  });
  const installCalls = [];
  const spawnCalls = [];
  const launcher = createLauncher({
    os: { platform: () => "linux" },
    runtime,
    github: {},
    spawnAppImage: async (filePath) => {
      spawnCalls.push(filePath);
    },
    installMissingAppImage: async (input) => {
      installCalls.push(input);
      return {
        filePath: "/tmp/downloads/TokenTracker-0.1.11.AppImage",
        version: "0.1.11",
      };
    },
  });

  await launcher.run();

  assert.deepEqual(installCalls, [
    {
      github: {},
      runtime,
    },
  ]);
  assert.deepEqual(runtimeInstallCalls, [
    {
      sourcePath: "/tmp/downloads/TokenTracker-0.1.11.AppImage",
      version: "0.1.11",
    },
  ]);
  assert.deepEqual(spawnCalls, ["/tmp/state/current/TokenTracker.AppImage"]);
});

test("installs first downloaded AppImage into user runtime and stores metadata", async () => {
  const calls = [];
  const { runtime } = createRuntime({
    ensureStateDirectories: async () => {
      calls.push(["ensureStateDirectories"]);
    },
    getInstalledAppImagePath: () => null,
    readInstalledVersion: () => null,
    installDownloadedAppImage: async ({ sourcePath, version }) => {
      calls.push(["installDownloadedAppImage", sourcePath, version]);
      return "/tmp/state/current/TokenTracker.AppImage";
    },
  });
  const spawnCalls = [];
  const launcher = createLauncher({
    os: { platform: () => "linux" },
    runtime,
    github: {},
    spawnAppImage: async (filePath) => {
      spawnCalls.push(filePath);
    },
    installMissingAppImage: async () => ({
      filePath: "/tmp/state/downloads/TokenTracker-0.1.11.AppImage",
      version: "0.1.11",
    }),
  });

  await launcher.run();

  assert.deepEqual(calls, [
    ["ensureStateDirectories"],
    [
      "installDownloadedAppImage",
      "/tmp/state/downloads/TokenTracker-0.1.11.AppImage",
      "0.1.11",
    ],
  ]);
  assert.deepEqual(spawnCalls, ["/tmp/state/current/TokenTracker.AppImage"]);
});
