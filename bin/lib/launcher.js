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

      const cachedAppImagePath = runtime.getCachedAppImagePath();
      if (cachedAppImagePath) {
        await spawnAppImage(cachedAppImagePath);
        return;
      }

      await installMissingAppImage({
        github,
        runtime,
      });
    },
  };
}
