#!/usr/bin/env node
// 唯一的原子 producer bump 命令 —— 一次调用完成全部 producer 记录的同步更新：
//   pnpm-workspace.yaml catalog（两个别名）
//   pnpm-lock.yaml（通过 pnpm install）
//   bundled Skill（skills/computer-use/SKILL.md）
//   upstream.json（commit/ref/skillSha256 provenance）
//   wrapper 版本三处记录 + 官方插件定义 + 实现契约（复用 check-version-coherence.mjs 写回）
// 成功后自动跑快速基线门禁与 skill-sync 不可变性测试自校验；--commit 直接产出单个
// chore(cua) 提交，从机制上消灭“改 catalog、更新 lock、同步 Skill/provenance、
// 改版本/契约”被拆成多个提交的漂移窗口。
//
// 背景（2026-08-20）：这两条链路此前是手工分开跑的（改 catalog+install 一个提交，
// sync:skill + sync:version 另一个提交，甚至漏跑），集成分支出现 catalog=e38999b7 /
// upstream.json=0bf36086 的漂移。CI（check-cua-baseline.mjs）现在直接拒绝这种状态，
// 本脚本是唯一合法修复/升级路径。
//
// 用法：
//   node scripts/bump-zcode-cua-producer.mjs                 # bump 到 producer origin/main
//   node scripts/bump-zcode-cua-producer.mjs <ref|sha>       # bump 到指定 ref/评审 SHA
//   node scripts/bump-zcode-cua-producer.mjs <ref> --commit  # 校验通过后直接产出单个提交
// 环境变量：ZCODE_CUA_REPO 指定 producer 本地克隆（默认同级 ../zcode-cua）。

import { createHash } from "node:crypto";
import { execFile as execFileCallback } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);
const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(packageRoot, "../../../..");
const workspacePath = resolve(repoRoot, "pnpm-workspace.yaml");
const producerRoot = resolve(
  process.env.ZCODE_CUA_REPO ?? resolve(packageRoot, "../../../../../zcode-cua"),
);
const skillPath = "plugin/skills/computer-use/SKILL.md";
const producerManifestPath = "plugin/.zcode-plugin/plugin.json";
const targetSkill = resolve(packageRoot, "skills/computer-use/SKILL.md");
const provenancePath = resolve(packageRoot, "upstream.json");
const doCommit = process.argv.includes("--commit");
const positionalArgs = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
const producerRefArg = positionalArgs[0] ?? "origin/main";

async function run(command, args, options = {}) {
  const result = await execFile(command, args, {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    ...options,
  });
  return result.stdout.trim();
}

// 二进制安全的变体：git show 的文件内容必须逐字节等于 producer 对象（含末尾换行），
// 任何 trim 都会造成 sha256 与不可变性校验漂移。
async function runBuffer(command, args, options = {}) {
  const result = await execFile(command, args, {
    encoding: "buffer",
    maxBuffer: 64 * 1024 * 1024,
    ...options,
  });
  return Buffer.from(result.stdout);
}

async function runOrThrow(label, command, args, options = {}) {
  try {
    return await run(command, args, options);
  } catch (error) {
    throw new Error(
      `${label} 失败：${error.stderr || error.stdout || error.message}`,
    );
  }
}

// 1) 解析 producer commit：fetch 后 rev-parse；40 位 SHA 额外要求它已存在于某个远端
//    ref 上，防止把本地实验提交 pin 进产品依赖锁。
console.log(`[cua-bump] producer 仓库：${producerRoot}`);
await runOrThrow("producer git fetch", "git", [
  "-C",
  producerRoot,
  "fetch",
  "origin",
  "--prune",
]);
let producerCommit;
try {
  producerCommit = await run("git", [
    "-C",
    producerRoot,
    "rev-parse",
    "--verify",
    `${producerRefArg}^{commit}`,
  ]);
} catch {
  if (/^[0-9a-f]{40}$/u.test(producerRefArg)) {
    await runOrThrow("按 SHA 精确拉取", "git", [
      "-C",
      producerRoot,
      "fetch",
      "origin",
      producerRefArg,
    ]);
    producerCommit = producerRefArg;
  } else {
    throw new Error(`producer 仓库里找不到 ref：${producerRefArg}`);
  }
}
if (!/^[0-9a-f]{40}$/u.test(producerCommit)) {
  throw new Error(`producer commit 不是 40 位 SHA：${producerCommit}`);
}
if (/^[0-9a-f]{40}$/u.test(producerRefArg)) {
  const containing = await run("git", [
    "-C",
    producerRoot,
    "branch",
    "-r",
    "--contains",
    producerCommit,
  ]);
  if (containing === "") {
    throw new Error(
      `${producerCommit} 不在任何远端 ref 上；先推送 producer 提交再 pin（禁止 pin 本地实验提交）`,
    );
  }
}
const producerSubject = await run("git", [
  "-C",
  producerRoot,
  "log",
  "-1",
  "--format=%s",
  producerCommit,
]);
console.log(`[cua-bump] 目标 producer：${producerCommit}（${producerSubject}）`);

// 2) 从 producer commit 的 git 对象里直接取 Skill 字节与插件 manifest 版本
//    （不 checkout producer 工作区，冻结中的工作分支不受影响）。
let skillBytes;
try {
  skillBytes = await runBuffer("git", [
    "-C",
    producerRoot,
    "show",
    `${producerCommit}:${skillPath}`,
  ]);
} catch (error) {
  throw new Error(
    `读取 producer Skill 失败：${error.stderr || error.stdout || error.message}`,
  );
}
const producerManifestText = await runOrThrow("读取 producer 插件 manifest", "git", [
  "-C",
  producerRoot,
  "show",
  `${producerCommit}:${producerManifestPath}`,
]);
const producerVersion = JSON.parse(producerManifestText).version;
if (typeof producerVersion !== "string" || producerVersion.length === 0) {
  throw new Error(`producer 插件 manifest 缺少合法 version：${producerManifestText}`);
}
console.log(`[cua-bump] producer 版本：${producerVersion}`);

// 3) 原子更新 catalog 两个别名（各自必须恰好一处，保持 YAML 字节布局不变）。
const aliases = ["@zcode/zcode-cua", "@zcode/zcode-cua-helper-runtime"];
let workspaceText = await readFile(workspacePath, "utf8");
for (const alias of aliases) {
  const pattern = new RegExp(
    `^(\\s+"${alias}":\\s+"git\\+https://dev\\.aminer\\.cn/codegeex/zcode-cua\\.git#)([0-9a-f]{40})("\\s*)$`,
    "gmu",
  );
  const matches = [...workspaceText.matchAll(pattern)];
  if (matches.length !== 1) {
    throw new Error(
      `pnpm-workspace.yaml catalog 里 ${alias} 必须恰好 pin 一个 40 位 commit（当前 ${matches.length} 个）`,
    );
  }
  workspaceText = workspaceText.replace(
    pattern,
    `$1${producerCommit}$3`,
  );
}
await writeFile(workspacePath, workspaceText);

// 4) 更新 lockfile 与 node_modules（coherence 写回要读 installed producer 契约）。
console.log("[cua-bump] 运行 pnpm install（更新 lockfile 与 installed producer）…");
await runOrThrow("pnpm install", "pnpm", ["install", "--prefer-offline"], {
  cwd: repoRoot,
});

// 5) 写 bundled Skill 与 upstream.json provenance。
await mkdir(dirname(targetSkill), { recursive: true });
await writeFile(targetSkill, skillBytes);
await writeFile(
  provenancePath,
  `${JSON.stringify(
    {
      repository: "https://dev.aminer.cn/codegeex/zcode-cua.git",
      ref: producerCommit,
      commit: producerCommit,
      skillPath,
      skillSha256: createHash("sha256").update(skillBytes).digest("hex"),
    },
    null,
    2,
  )}\n`,
);

// 6) 对齐 wrapper 版本三处记录 + 官方插件定义 + 实现契约（复用既有写回逻辑）。
console.log("[cua-bump] 对齐 wrapper 版本与实现契约…");
const coherenceOutput = await runOrThrow(
  "check-version-coherence 写回",
  "node",
  ["scripts/check-version-coherence.mjs"],
  { cwd: packageRoot },
);
console.log(coherenceOutput);

// 7) 自校验：快速基线门禁 + Skill 不可变性测试必须全绿，否则拒绝产出提交。
console.log("[cua-bump] 自校验：check-cua-baseline + skill-sync…");
await runOrThrow("check-cua-baseline", "node", [
  "scripts/check-cua-baseline.mjs",
], { cwd: packageRoot });
await runOrThrow("skill-sync node test", "node", [
  "--test",
  "tests/skill-sync.node-test.mjs",
], { cwd: packageRoot });

// 8) 汇总变更并（可选）产出单个原子提交。
const commitFileSet = [
  "pnpm-workspace.yaml",
  "pnpm-lock.yaml",
  "apps/zcode-cli/packages/zcode-cua-plugin/upstream.json",
  "apps/zcode-cli/packages/zcode-cua-plugin/skills/computer-use/SKILL.md",
  "apps/zcode-cli/packages/zcode-cua-plugin/package.json",
  "apps/zcode-cli/packages/zcode-cua-plugin/.zcode-plugin/plugin.json",
  "apps/zcode-cli/packages/bootstrap/src/app/official-plugin-definitions.ts",
  "docs/superpowers/specs/2026-08-14-cua-final-raster-integrity-contract.md",
];
// 注意不能用 trim()：porcelain 每行以 "XY " 两列状态开头，未暂存改动的首列是空格，
// 整体 trim 会吃掉第一行的前导空格，把路径错切 3 个字符。
const statusOutput = await execFile(
  "git",
  ["-C", repoRoot, "status", "--porcelain"],
  { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
);
const statusLines = statusOutput.stdout
  .split("\n")
  .filter((line) => line !== "");
const relevant = statusLines.filter((line) =>
  commitFileSet.some((path) => line.slice(3).replace(/^"|"$/gu, "") === path),
);
const unexpected = statusLines.filter(
  (line) =>
    // 未跟踪文件不属于任何提交，不阻塞原子 bump；已跟踪文件的意外改动才阻塞。
    !line.startsWith("??") &&
    !commitFileSet.some((path) => line.slice(3).replace(/^"|"$/gu, "") === path),
);
console.log("[cua-bump] 本次原子变更：");
for (const line of relevant) console.log(`  ${line}`);
if (unexpected.length > 0) {
  console.log("[cua-bump] 工作区里的其他未提交改动（不属于本次 bump，不会被提交）：");
  for (const line of unexpected) console.log(`  ${line}`);
}
const refLabel =
  producerRefArg === "origin/main" ? "main" : producerRefArg;
const commitMessage = `chore(cua): pin producer to ${refLabel} ${producerCommit.slice(0, 9)}（${producerSubject}）`;
if (!doCommit) {
  console.log(`[cua-bump] 完成。建议提交信息：\n  ${commitMessage}`);
  console.log("[cua-bump] 加 --commit 可直接产出这个原子提交。");
  process.exit(0);
}
if (unexpected.length > 0) {
  throw new Error(
    "工作区存在不属于本次 bump 的未提交改动；为保持原子性拒绝自动提交，请先处理它们。",
  );
}
if (relevant.length === 0) {
  // 幂等重跑：目标 producer 与工作区已一致（例如修复漂移后重复执行），
  // 不能让 git commit 以 "nothing to commit" 报错。
  console.log(`[cua-bump] 工作区已与目标 producer ${producerCommit} 一致，无需提交。`);
  process.exit(0);
}
await runOrThrow("git add", "git", ["-C", repoRoot, "add", ...commitFileSet]);
await runOrThrow("git commit", "git", [
  "-C",
  repoRoot,
  "commit",
  "-m",
  commitMessage,
]);
console.log(`[cua-bump] 已提交：${commitMessage}`);
