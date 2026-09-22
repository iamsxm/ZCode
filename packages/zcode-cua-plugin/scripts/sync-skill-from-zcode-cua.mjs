import { createHash } from "node:crypto";
import { execFile as execFileCallback } from "node:child_process";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workspacePath = resolve(packageRoot, "../../../../pnpm-workspace.yaml");
const execFile = promisify(execFileCallback);
const defaultRepositoryRoot = resolve(packageRoot, "../../../../../zcode-cua");
const repositoryRoot = resolve(
  process.argv[2] ?? process.env.ZCODE_CUA_REPO ?? defaultRepositoryRoot,
);
const sourceSkill = resolve(repositoryRoot, "plugin/skills/computer-use/SKILL.md");
const sourceManifest = resolve(repositoryRoot, "plugin/.zcode-plugin/plugin.json");
const targetSkill = resolve(packageRoot, "skills/computer-use/SKILL.md");
const provenancePath = resolve(packageRoot, "upstream.json");
// 修复：bundled wrapper 的 plugin.json / package.json 之前各自维护 0.1.0，
// 与实际 zcode-cua MCP server 版本割裂（UI 展示、缓存路径、marketplace 条目都对不上）。
// 这里把上游 manifest 的 version 作为单一真相源，回写到 bundled wrapper，避免再次漂移。
const bundledManifestPath = resolve(packageRoot, ".zcode-plugin", "plugin.json");
const bundledPackageJsonPath = resolve(packageRoot, "package.json");

const [skillBytes, manifestText, workspaceText, revision, sourceStatus] = await Promise.all([
  readFile(sourceSkill),
  readFile(sourceManifest, "utf8"),
  readFile(workspacePath, "utf8"),
  execFile("git", ["-C", repositoryRoot, "rev-parse", "HEAD"], {
    encoding: "utf8",
  }),
  execFile(
    "git",
    [
      "-C",
      repositoryRoot,
      "status",
      "--porcelain",
      "--untracked-files=all",
      "--",
      "plugin/skills/computer-use/SKILL.md",
      "plugin/.zcode-plugin/plugin.json",
    ],
    { encoding: "utf8" },
  ),
]);
const upstreamCommit = revision.stdout.trim();
// 不记录本地 worktree 的临时分支名；不可变 commit 同时是可重放的 ref。
const upstreamRef = upstreamCommit;
const pins = [
  ...workspaceText.matchAll(
    /^\s+"@zcode\/zcode-cua":\s+"git\+https:\/\/dev\.aminer\.cn\/codegeex\/zcode-cua\.git#([0-9a-f]{40})"\s*$/gmu,
  ),
].map((match) => match[1]);
if (pins.length !== 1) {
  throw new Error("The canonical zcode-cua catalog entry must pin one full producer commit");
}
if (!/^[0-9a-f]{40}$/u.test(upstreamCommit) || upstreamCommit !== pins[0]) {
  throw new Error(
    `Refusing to sync Skill from ${upstreamCommit || "unknown"}; catalog pins ${pins[0]}`,
  );
}
if (!/^(?!.*\.\.)(?!\/)(?!.*\/$)[A-Za-z0-9._/-]+$/u.test(upstreamRef)) {
  throw new Error(`Refusing to record invalid producer ref ${upstreamRef || "HEAD"}`);
}
if (sourceStatus.stdout.trim() !== "") {
  throw new Error("Refusing to sync Skill or plugin manifest from uncommitted producer content");
}
const manifest = JSON.parse(manifestText);
if (manifest.name !== "computer-use" || typeof manifest.version !== "string") {
  throw new Error(`Invalid computer-use plugin manifest at ${sourceManifest}`);
}

/**
 * Patch a JSON file's top-level `version` field in place, preserving key order and
 * 2-space indentation + trailing newline. Only rewrites when the value actually changes,
 * so a no-op sync leaves the working tree clean.
 */
async function syncVersionField(filePath, version) {
  const text = await readFile(filePath, "utf8");
  const parsed = JSON.parse(text);
  if (parsed.version === version) return false;
  parsed.version = version;
  await writeFile(filePath, `${JSON.stringify(parsed, null, 2)}\n`);
  return true;
}

// 重命名后目标目录可能尚不存在（skills/<name>/），copyFile 不会自动建目录，先确保它存在。
await mkdir(dirname(targetSkill), { recursive: true });
await copyFile(sourceSkill, targetSkill);
await writeFile(
  provenancePath,
  `${JSON.stringify(
    {
      repository: "https://dev.aminer.cn/codegeex/zcode-cua.git",
      ref: upstreamRef,
      commit: upstreamCommit,
      skillPath: "plugin/skills/computer-use/SKILL.md",
      skillSha256: createHash("sha256").update(skillBytes).digest("hex"),
    },
    null,
    2,
  )}\n`,
);

const manifestUpdated = await syncVersionField(bundledManifestPath, manifest.version);
const packageJsonUpdated = await syncVersionField(bundledPackageJsonPath, manifest.version);

console.log(`Synced computer-use skill from zcode-cua ${manifest.version}`);
if (manifestUpdated || packageJsonUpdated) {
  console.log(
    `Aligned bundled wrapper version to ${manifest.version} ` +
      `(plugin.json${manifestUpdated ? " updated" : ""}, package.json${packageJsonUpdated ? " updated" : ""})`,
  );
}
