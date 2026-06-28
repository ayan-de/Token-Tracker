import fs from "fs";
import { APP_NAME, REPO, APPIMAGE_EXT } from "./constants.js";

export function normalizeArch(arch) {
  if (arch === "x64") return "amd64";
  if (arch === "amd64") return "amd64";
  throw new Error(`Unsupported architecture: ${arch}`);
}

export async function getLatestVersion({ https = globalThis.https } = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "api.github.com",
      path: `/repos/${REPO}/releases/latest`,
      method: "GET",
      headers: {
        "User-Agent": `${APP_NAME}-npm-launcher`,
        "Accept": "application/vnd.github+json",
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        if (res.statusCode !== 200) {
          reject(new Error(`GitHub API returned ${res.statusCode}`));
          return;
        }
        try {
          const release = JSON.parse(data);
          const tag = release.tag_name;
          resolve(tag.startsWith("v") ? tag.slice(1) : tag);
        } catch {
          reject(new Error("Failed to parse GitHub release response"));
        }
      });
    });

    req.on("error", reject);
    req.end();
  });
}

export async function getDesiredVersion({ env, getLatestVersion }) {
  if (env.TOKEN_TRACKER_VERSION) {
    return env.TOKEN_TRACKER_VERSION;
  }
  return getLatestVersion();
}

export async function downloadReleaseAsset({
  version,
  arch,
  downloadsDir,
  https: httpsMod = globalThis.https,
  followRedirect,
}) {
  const normalizedArch = normalizeArch(arch);
  const fileName = `${APP_NAME}_${version}_${normalizedArch}${APPIMAGE_EXT}`;
  const partialPath = `${downloadsDir}/${fileName}.download`;
  const finalPath = `${downloadsDir}/${fileName}`;

  let downloadedPath;
  try {
    const redirectUrl = await new Promise((resolve, reject) => {
      const options = {
        hostname: "api.github.com",
        path: `/repos/${REPO}/releases/assets/${encodeURIComponent(fileName)}`,
        method: "GET",
        headers: {
          "User-Agent": `${APP_NAME}-npm-launcher`,
          "Accept": "application/vnd.github+json",
        },
      };

      const req = httpsMod.request(options, (res) => {
        if (res.statusCode === 302 && res.headers.location) {
          resolve(res.headers.location);
        } else {
          reject(new Error(`Expected redirect, got ${res.statusCode}`));
        }
      });

      req.on("error", reject);
      req.end();
    });

    downloadedPath = await followRedirect(redirectUrl);

    const writeStream = fs.createWriteStream(partialPath);
    const readStream = fs.createReadStream(downloadedPath);

    await new Promise((resolve, reject) => {
      readStream.pipe(writeStream);
      writeStream.on("finish", resolve);
      writeStream.on("error", reject);
      readStream.on("error", reject);
    });

    await fs.promises.rename(partialPath, finalPath);
  } catch (err) {
    try {
      await fs.promises.rm(partialPath, { force: true });
    } catch {}
    if (downloadedPath && downloadedPath !== finalPath) {
      try {
        await fs.promises.rm(downloadedPath, { force: true });
      } catch {}
    }
    throw err;
  }

  return { filePath: finalPath, version };
}