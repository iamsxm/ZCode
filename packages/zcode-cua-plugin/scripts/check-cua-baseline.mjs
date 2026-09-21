#!/usr/bin/env node
// CUA pin/provenance 快速门禁 —— 不需要 pnpm install，秒级拒绝手工改 pin 造成的漂移。
//
// 背景（2026-08-20）：producer pin bump（catalog + lockfile + 实现契约）与 Skill/provenance
// 同步（upstream.json + bundled Skill + wrapper 版本）曾是两条可拆开提交的手工链路，
// 集成分支出现过 catalog=e38999b7 / upstream.json=0bf36086 的漂移；skill-sync.node-test.mjs
// 虽断言相等，但挂在重测试道，漂移能溜过早期 CI。本脚本挂在 build:desktop:app 的
// pnpm install 之前（与 ci-lint-pipeline.mjs 同层），把任何手工 producer SHA 修改
// 导致的不一致变成流水线第一站的硬失败。
//
// 唯一合法的修改路径：
//   node apps/zcode-cli/packages/zcode-cua-plugin/scripts/bump-zcode-cua-producer.mjs
//
// 本脚本只做“无需安装即可判定”的结构校验；安装后的深度校验（runtime 契约、
// installed producer 版本）仍由 check-version-coherence.mjs --check 在 build 阶段负责。

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(packageRoot, "../../../..");
const [
  workspaceText,
  lockfileText,
  provenanceText,
  skillBytes,
  contractText,
] = await Promise.all([
  readFile(resolve(repoRoot, "pnpm-workspace.yaml"), "utf8"),
  readFile(resolve(repoRoot, "pnpm-lock.yaml"), "utf8"),
  readFile(resolve(packageRoot, "upstream.json"), "utf8"),
  readFile(resolve(packageRoot, "skills/computer-use/SKILL.md")),
  readFile(
    resolve(
      repoRoot,
      "docs/superpowers/specs/2026-08-14-cua-final-raster-integrity-contract.md",
    ),
    "utf8",
  ),
]);

const failures = [];
const fail = (message) => failures.push(message);

// 1) catalog：两个别名必须各自恰好出现一次，且指向同一个 40 位 producer commit。
function readCatalogPin(alias) {
  const pattern = new RegExp(
    `^\\s+"${alias}":\\s+"git\\+https://dev\\.aminer\\.cn/codegeex/zcode-cua\\.git#([0-9a-f]{40})"\\s*$`,
    "gmu",
  );
  return [...workspaceText.matchAll(pattern)].map((match) => match[1]);
}
const mainPins = readCatalogPin("@zcode/zcode-cua");
const runtimePins = readCatalogPin("@zcode/zcode-cua-helper-runtime");
if (mainPins.length !== 1) {
  fail(
    `pnpm-workspace.yaml catalog 里 @zcode/zcode-cua 必须恰好 pin 一个 40 位 commit（当前 ${mainPins.length} 个）`,
  );
}
if (runtimePins.length !== 1) {
  fail(
    `pnpm-workspace.yaml catalog 里 @zcode/zcode-cua-helper-runtime 必须恰好 pin 一个 40 位 commit（当前 ${runtimePins.length} 个）`,
  );
}
if (
  mainPins.length === 1 &&
  runtimePins.length === 1 &&
  mainPins[0] !== runtimePins[0]
) {
  fail(
    `catalog 两个 producer 别名漂移：@zcode/zcode-cua=${mainPins[0]}，` +
      `@zcode/zcode-cua-helper-runtime=${runtimePins[0]}`,
  );
}
const catalogCommit = mainPins[0] ?? runtimePins[0] ?? null;
if (!catalogCommit) {
  // 前面已记录具体失败；这里只避免后续检查打出误导性噪声。
  reportAndExit();
}

// 2) lockfile：所有 zcode-cua.git#<sha> 引用（catalog resolution、importer 直连与
//    resolved version）必须全部等于 catalog commit。任何旧 SHA 残留都算漂移。
const lockCommits = [
  ...new Set(
    [...lockfileText.matchAll(/zcode-cua\.git#([0-9a-f]{40})/gu)].map(
      (match) => match[1],
    ),
  ),
];
if (lockCommits.length === 0) {
  fail("pnpm-lock.yaml 里找不到任何 zcode-cua.git#<sha> producer 引用");
} else if (lockCommits.length > 1 || lockCommits[0] !== catalogCommit) {
  fail(
    `pnpm-lock.yaml producer 引用与 catalog 漂移：lock={${lockCommits.join(",")}}，` +
      `catalog=${catalogCommit}`,
  );
}

// 3) upstream.json（provenance 第一事实源）：commit === ref === catalog commit，
//    且记录的 skillSha256 必须等于 bundled Skill 的实际字节摘要。
let provenance;
try {
  provenance = JSON.parse(provenanceText);
} catch (error) {
  fail(`upstream.json 不是合法 JSON：${error.message}`);
  reportAndExit();
}
if (provenance.repository !== "https://dev.aminer.cn/codegeex/zcode-cua.git") {
  fail(`upstream.json.repository 必须是 producer 仓库地址（当前 ${provenance.repository}）`);
}
if (provenance.commit !== catalogCommit || provenance.ref !== catalogCommit) {
  fail(
    `upstream.json 与 catalog 漂移：upstream commit=${provenance.commit}，` +
      `ref=${provenance.ref}，catalog=${catalogCommit}`,
  );
}
if (provenance.skillPath !== "plugin/skills/computer-use/SKILL.md") {
  fail(`upstream.json.skillPath 不是 producer Skill 路径（当前 ${provenance.skillPath}）`);
}
const skillSha256 = createHash("sha256").update(skillBytes).digest("hex");
if (skillSha256 !== provenance.skillSha256) {
  fail(
    `bundled Skill 字节与 upstream.json.skillSha256 不符：实际 ${skillSha256}，` +
      `记录 ${provenance.skillSha256}`,
  );
}

// 4) 实现契约：producer ref 必须与 catalog 一致（SHA pin 场景；该文档同时被
//    check-version-coherence.mjs 在安装后校验，这里让漂移在 install 前就暴露）。
const contractProducerRef = contractText.match(
  /producer 实现：`zcode-cua@([^`]+)`/u,
)?.[1];
if (contractProducerRef !== catalogCommit) {
  fail(
    `实现契约 producer ref 漂移：契约=${contractProducerRef ?? "<missing>"}，` +
      `catalog=${catalogCommit}`,
  );
}

function reportAndExit() {
  if (failures.length === 0) {
    console.log(`[cua-baseline] 一致：producer pin = ${catalogCommit}`);
    process.exit(0);
  }
  console.error("[cua-baseline] producer pin/provenance 漂移，拒绝继续：");
  for (const message of failures) console.error(`  - ${message}`);
  console.error(
    "修复：node apps/zcode-cli/packages/zcode-cua-plugin/scripts/bump-zcode-cua-producer.mjs" +
      "（原子更新 catalog/lock/upstream.json/Skill/wrapper 版本，禁止手改 producer SHA）",
  );
  process.exit(1);
}
reportAndExit();
