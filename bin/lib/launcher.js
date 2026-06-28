import {
  LINUX_ONLY_MESSAGE,
} from "./constants.js";

export function createLauncher({
  os,
  runtime,
  github,
  spawnAppImage,
  installMissingAppImage,
}) {
  return {
    async run() {
      if (os.platform() !== "linux") {
        runtime.error(LINUX_ONLY_MESSAGE);
        runtime.exit(1);
        return;
      }

      await runtime.ensureStateDirectories();

      const cachedAppImagePath = runtime.getInstalledAppImagePath();
      if (cachedAppImagePath) {
        await spawnAppImage(cachedAppImagePath);
        return;
      }

      const download = await installMissingAppImage({
        github,
        runtime,
      });

      const installedAppImagePath = await runtime.installDownloadedAppImage({
        sourcePath: download.filePath,
        version: download.version,
      });

      await spawnAppImage(installedAppImagePath);
    },
  };
}
