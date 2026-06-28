import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import https from "node:https";

import { createLauncher } from "../../bin/lib/launcher.js";
import { getLatestVersion, getDesiredVersion, downloadReleaseAsset, normalizeArch } from "../../bin/lib/github.js";

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

test("stores downloaded AppImage at concrete ~/.local/share/tokentracker/current/ path and writes version.json", async () => {
  const os = await import("os");
  const path = await import("path");
  const fs = await import("fs");

  const tmpDir = await fs.promises.mkdtemp(
    path.join(os.tmpdir(), "tokentracker-runtime-test-")
  );
  const fakeHome = path.join(tmpDir, "fakehome");
  await fs.promises.mkdir(fakeHome, { recursive: true });

  let runtimeModule;
  try {
    const { ensureStateDirectories, installDownloadedAppImage, getRuntimePaths, readInstalledVersion } =
      await import("../../bin/lib/runtime.js");
    runtimeModule = { ensureStateDirectories, installDownloadedAppImage, getRuntimePaths, readInstalledVersion };

    const srcAppImage = path.join(tmpDir, "TokenTracker-0.1.11.AppImage");
    await fs.promises.writeFile(srcAppImage, "#!/bin/sh\necho fake\n");
    await fs.promises.chmod(srcAppImage, 0o755);

    await runtimeModule.ensureStateDirectories(fakeHome);

    const result = await runtimeModule.installDownloadedAppImage({
      sourcePath: srcAppImage,
      version: "0.1.11",
      homedir: fakeHome,
    });

    const { currentAppImagePath, currentVersionPath } = runtimeModule.getRuntimePaths(fakeHome);

    assert.equal(result, currentAppImagePath);

    const stat = await fs.promises.stat(currentAppImagePath);
    assert.equal(stat.mode & 0o777, 0o755);

    const versionContent = JSON.parse(
      await fs.promises.readFile(currentVersionPath, "utf8")
    );
    assert.equal(versionContent.version, "0.1.11");

    assert.equal(runtimeModule.readInstalledVersion(fakeHome), "0.1.11");
  } finally {
    await fs.promises.rm(tmpDir, { recursive: true, force: true });
  }
});

test("normalizeArch maps x64 to amd64", () => {
  assert.equal(normalizeArch("x64"), "amd64");
});

test("normalizeArch throws on unsupported architecture", () => {
  assert.throws(() => normalizeArch("arm64"), /unsupported architecture/i);
});

test("normalizeArch passes through already-normalized arch", () => {
  assert.equal(normalizeArch("amd64"), "amd64");
});

test("getDesiredVersion returns TOKEN_TRACKER_VERSION from env when set", async () => {
  const env = { TOKEN_TRACKER_VERSION: "0.2.0" };
  const getLatestVersion = async () => {
    throw new Error("getLatestVersion should not be called");
  };
  const result = await getDesiredVersion({ env, getLatestVersion });
  assert.equal(result, "0.2.0");
});

test("getDesiredVersion calls getLatestVersion when TOKEN_TRACKER_VERSION not set", async () => {
  const env = {};
  let getLatestCalled = false;
  const getLatestVersion = async () => {
    getLatestCalled = true;
    return "0.1.11";
  };
  const result = await getDesiredVersion({ env, getLatestVersion });
  assert.equal(result, "0.1.11");
  assert.equal(getLatestCalled, true);
});

test("getLatestVersion fetches latest release tag from GitHub API", async () => {
  const fakeHttps = {
    request: (opts, callback) => {
      assert.equal(opts.hostname, "api.github.com");
      assert.equal(opts.path, "/repos/ayan-de/Token-Tracker/releases/latest");
      const mockRes = {
        statusCode: 200,
        on: (event, cb) => {
          if (event === "data") cb(JSON.stringify({ tag_name: "v0.1.11" }));
          if (event === "end") cb();
        },
      };
      callback(mockRes);
      return { on: () => {}, end: () => {}, destroy: () => {} };
    },
  };
  const version = await getLatestVersion({ https: fakeHttps });
  assert.equal(version, "0.1.11");
});

test("downloadReleaseAsset constructs correct asset name TokenTracker_<version>_<arch>.AppImage", async () => {
  const tmpDir = await fs.promises.mkdtemp(
    import.meta.filename.includes("://") ? "/tmp/tokentracker-test-" : (await import("path")).join((await import("os")).tmpdir(), "tokentracker-test-")
  );
  try {
    const fakeHttps = {
      request: (opts, callback) => {
        assert.match(opts.path, /TokenTracker_0\.1\.11_amd64\.AppImage/);
        const mockRes = {
          statusCode: 302,
          headers: { location: "https://example.com/fake-download" },
          on: () => {},
        };
        callback(mockRes);
        return { on: () => {}, end: () => {}, destroy: () => {} };
      },
    };
    const redirectsFollowed = [];
    const fakeFollowRedirect = async (url) => {
      redirectsFollowed.push(url);
      const dlPath = import.meta.filename.includes("://") ? "/tmp/test.AppImage" : (await import("path")).join(tmpDir, "TokenTracker_0.1.11_amd64.AppImage");
      await fs.promises.writeFile(dlPath, "#!/bin/sh\necho fake\n");
      return dlPath;
    };
    const result = await downloadReleaseAsset({
      version: "0.1.11",
      arch: "amd64",
      downloadsDir: tmpDir,
      https: fakeHttps,
      followRedirect: fakeFollowRedirect,
    });
    assert.equal(result.version, "0.1.11");
    assert.match(result.filePath, /TokenTracker_0\.1\.11_amd64\.AppImage$/);
  } finally {
    await fs.promises.rm(tmpDir, { recursive: true, force: true });
  }
});

test("downloadReleaseAsset cleans up partial download on failure", async () => {
  const tmpDir = await fs.promises.mkdtemp(
    import.meta.filename.includes("://") ? "/tmp/tokentracker-test-" : (await import("path")).join((await import("os")).tmpdir(), "tokentracker-test-")
  );
  try {
    const fakeHttps = {
      request: (opts, callback) => {
        const mockRes = {
          statusCode: 302,
          headers: { location: "https://example.com/fake-download" },
          on: () => {},
        };
        callback(mockRes);
        return { on: () => {}, end: () => {}, destroy: () => {} };
      },
    };
    const fakeFollowRedirect = async () => {
      throw new Error("download failed");
    };
    const partialPath = import.meta.filename.includes("://") ? "/tmp/test.AppImage.download" : (await import("path")).join(tmpDir, "TokenTracker_0.1.11_amd64.AppImage.download");
    await fs.promises.writeFile(partialPath, "partial");
    await assert.rejects(
      async () =>
        downloadReleaseAsset({
          version: "0.1.11",
          arch: "amd64",
          downloadsDir: tmpDir,
          https: fakeHttps,
          followRedirect: fakeFollowRedirect,
        }),
      /download failed/
    );
    assert.equal(fs.existsSync(partialPath), false);
  } finally {
    await fs.promises.rm(tmpDir, { recursive: true, force: true });
  }
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
