import test from "node:test";
import assert from "node:assert/strict";

import { createLauncher } from "../../bin/lib/launcher.js";
import { INSTALL_FLOW_NOT_IMPLEMENTED_MESSAGE } from "../../bin/lib/constants.js";

function createRuntime(overrides = {}) {
  const calls = {
    error: [],
    info: [],
    exit: [],
  };

  const runtime = {
    args: [],
    env: {},
    getCachedAppImagePath: () => null,
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
    getCachedAppImagePath: () => "/tmp/TokenTracker.AppImage",
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

test("starts install orchestration when no cached AppImage exists", async () => {
  const { runtime } = createRuntime();
  const launcher = createLauncher({
    os: { platform: () => "linux" },
    runtime,
    github: {},
    spawnAppImage: async () => {
      throw new Error("spawn should not be called");
    },
  });

  await launcher.run();

  assert.equal(runtime.installFlowStarted, true);
});
