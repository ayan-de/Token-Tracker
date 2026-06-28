import {
  INSTALL_FLOW_NOT_IMPLEMENTED_MESSAGE,
  LINUX_ONLY_MESSAGE,
} from "./constants.js";

export function createLauncher({ os, runtime, github, spawnAppImage }) {
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

      void github;
      throw new Error(INSTALL_FLOW_NOT_IMPLEMENTED_MESSAGE);
    },
  };
}
