import { access, rename, rm } from "node:fs/promises";

export const ASAR_UNPACK_NATIVE_GLOB = "*.{node,dll,dylib,exe}";

async function pathExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export function createAppAsarPackArgs({ sourceDir, destinationPath, targetPlatformKey }) {
  return [
    "pack",
    sourceDir,
    destinationPath,
    "--unpack",
    ASAR_UNPACK_NATIVE_GLOB,
    "--unpack-dir",
    `node_modules/node-pty/prebuilds/${targetPlatformKey}`,
  ];
}

async function rmWithRetry(targetPath, options = {}) {
  for (let i = 0; i < 10; i++) {
    try {
      await rm(targetPath, { force: true, recursive: true, maxRetries: 3, retryDelay: 100, ...options });
      return;
    } catch (err) {
      if ((err.code === "EBUSY" || err.code === "EPERM") && i < 9) {
        await new Promise((r) => setTimeout(r, 500));
        continue;
      }
      throw err;
    }
  }
}

async function renameWithRetry(from, to) {
  for (let i = 0; i < 10; i++) {
    try {
      await rename(from, to);
      return;
    } catch (err) {
      if ((err.code === "EBUSY" || err.code === "EPERM") && i < 9) {
        await new Promise((r) => setTimeout(r, 500));
        continue;
      }
      throw err;
    }
  }
}

export async function replaceAppAsarFromStaging({
  sourceDir,
  appAsarPath,
  targetPlatformKey,
  runAsarCommand,
}) {
  const candidateAsarPath = `${appAsarPath}.next`;
  const candidateUnpackedPath = `${candidateAsarPath}.unpacked`;
  const unpackedPath = `${appAsarPath}.unpacked`;

  await Promise.all([
    rmWithRetry(candidateAsarPath),
    rmWithRetry(candidateUnpackedPath),
  ]);

  try {
    runAsarCommand(
      createAppAsarPackArgs({
        sourceDir,
        destinationPath: candidateAsarPath,
        targetPlatformKey,
      }),
    );

    if (!(await pathExists(candidateAsarPath)) || !(await pathExists(candidateUnpackedPath))) {
      // CI 的 TMPDIR 位于隐藏目录 `.tmp`。旧 glob 含 `**/`，@electron/asar 用绝对路径
      // 匹配时不会跨过隐藏目录，导致 native 被写回 asar，同时遗留旧 unpacked 形成物理双份。
      throw new Error(`重打包结果缺少 app.asar 或 app.asar.unpacked: ${candidateAsarPath}`);
    }

    // 先完整生成候选文件，再替换旧 archive 和 sidecar；不会把上一次打包的跨平台 native 留在 unpacked。
    await rmWithRetry(unpackedPath);
    await renameWithRetry(candidateUnpackedPath, unpackedPath);
    await rmWithRetry(appAsarPath);
    await renameWithRetry(candidateAsarPath, appAsarPath);
  } finally {
    await Promise.all([
      rmWithRetry(candidateAsarPath),
      rmWithRetry(candidateUnpackedPath),
    ]);
  }
}
