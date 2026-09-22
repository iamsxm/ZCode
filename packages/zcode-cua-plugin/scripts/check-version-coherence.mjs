#!/usr/bin/env node
// CUA 版本一致性校验 —— 单一真相源 + CI gate，防止“多处版本记录漂移”。
//
// 背景：CUA 版本以前散落在多处且互不同步，极易忘改：
//   - bundled wrapper: package.json.version / .zcode-plugin/plugin.json.version
//   - producer 依赖锁: pnpm catalog（pnpm-workspace.yaml）里 @zcode/zcode-cua 的 #vX.Y.Z，
//                      被 zcode-cua-plugin + services 共用（catalog: 引用）
// 历史上只有 skill-sync.node-test.mjs 校验 wrapper 内部一致，**完全没覆盖依赖锁**，导致
// wrapper 标 0.3.17、而依赖锁已 #v0.5.1 的漂移一路漏到打包。upstream.json 已不再冗余存 version。
//
// 本脚本把“producer 版本”作为唯一基准（取依赖锁里出现的版本），断言上述全部记录相等。
// `--check`（CI 用）发现漂移即 exit 1，把“忘改”变成构建失败而不是静默发版。
// 默认（无 --check）会把 wrapper、官方插件定义和实现契约对齐到依赖锁（写回），
// 方便 bump 后一键同步。
//
// Usage:
//   node scripts/check-version-coherence.mjs --check   # CI / pre-push gate（只读，漂移则非零退出）
//   node scripts/check-version-coherence.mjs           # 写回：把版本记录和实现契约对齐到依赖锁

import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(packageRoot, "../../../..");
const checkOnly = process.argv.includes("--check");

const wrapperPackageJsonPath = resolve(packageRoot, "package.json");
const wrapperManifestPath = resolve(packageRoot, ".zcode-plugin", "plugin.json");
const servicesPackageJsonPath = resolve(repoRoot, "packages/services/package.json");
const upstreamJsonPath = resolve(packageRoot, "upstream.json");
const pipelineConfigArgIndex = process.argv.indexOf("--pipeline-config");
const pipelineConfigPath =
  pipelineConfigArgIndex >= 0 && process.argv[pipelineConfigArgIndex + 1]
    ? resolve(process.argv[pipelineConfigArgIndex + 1])
    : resolve(repoRoot, ".gitlab/ci/30-build.yml");
const workspaceArgIndex = process.argv.indexOf("--workspace");
const workspaceYamlPath =
  workspaceArgIndex >= 0 && process.argv[workspaceArgIndex + 1]
    ? resolve(process.argv[workspaceArgIndex + 1])
    : resolve(repoRoot, "pnpm-workspace.yaml");
const implementationContractArgIndex = process.argv.indexOf("--implementation-contract");
const implementationContractPath =
  implementationContractArgIndex >= 0 && process.argv[implementationContractArgIndex + 1]
    ? resolve(process.argv[implementationContractArgIndex + 1])
    : resolve(repoRoot, "docs/superpowers/specs/2026-08-14-cua-final-raster-integrity-contract.md");
const lockfileArgIndex = process.argv.indexOf("--lockfile");
const lockfilePath =
  lockfileArgIndex >= 0 && process.argv[lockfileArgIndex + 1]
    ? resolve(process.argv[lockfileArgIndex + 1])
    : resolve(repoRoot, "pnpm-lock.yaml");
const runtimePackageDirArgIndex = process.argv.indexOf("--runtime-package-dir");
const explicitRuntimePackageDir =
  runtimePackageDirArgIndex >= 0 && process.argv[runtimePackageDirArgIndex + 1]
    ? resolve(process.argv[runtimePackageDirArgIndex + 1])
    : null;
const officialPluginDefinitionsPath = resolve(
  repoRoot,
  "apps/zcode-cli/packages/bootstrap/src/app/official-plugin-definitions.ts",
);

/** 从 `git+https://...zcode-cua.git#vX.Y.Z` 里抽出 `X.Y.Z`；非 git 锁返回 null。 */
function readProducerPin(spec) {
  if (typeof spec !== "string") return null;
  const match = spec.match(/zcode-cua\.git#v(.+)$/);
  return match ? match[1] : null;
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function readInstalledRuntimePackage() {
  const candidates = explicitRuntimePackageDir
    ? [explicitRuntimePackageDir]
    : [
        resolve(repoRoot, "packages/services/node_modules/@zcode/zcode-cua"),
        resolve(repoRoot, "node_modules/@zcode/zcode-cua"),
      ];
  for (const packageDir of candidates) {
    try {
      return await readJson(resolve(packageDir, "package.json"));
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
  console.error(
    `[cua-version] installed Helper runtime package is unavailable: ${candidates.join(", ")}`,
  );
  process.exit(1);
}

function hasExactKeys(value, keys) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).sort().join("\0") === [...keys].sort().join("\0")
  );
}

function isCanonicalRuntimeArtifactPath(value) {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    !value.includes("\\") &&
    !value.startsWith("/") &&
    !/^[a-z]:/iu.test(value) &&
    !value.split("/").some((segment) => !segment || segment === "." || segment === "..")
  );
}

function assertWindowsHelperRuntimeContract(packageJson) {
  const contract = packageJson?.zcodeCuaRuntime;
  const windows = contract?.windows;
  if (
    packageJson?.name !== "@zcode/zcode-cua" ||
    !hasExactKeys(contract, ["schema", "windows"]) ||
    contract.schema !== 1 ||
    !hasExactKeys(windows, ["entry", "nativeAddon"]) ||
    !isCanonicalRuntimeArtifactPath(windows.entry) ||
    !isCanonicalRuntimeArtifactPath(windows.nativeAddon) ||
    windows.entry === windows.nativeAddon
  ) {
    // Bug 根因：同一 semver 下的旧评审 SHA 没有 Windows Helper 发布契约，
    // 仅校验版本号会在 macOS build-app 阶段假绿，直到 Windows 准备 runtime 才失败。
    console.error(
      "[cua-version] installed producer is missing the Windows Helper runtime contract",
    );
    process.exit(1);
  }
}

function assertFinalRasterFrameContract(packageJson) {
  const frameContract = packageJson?.exports?.["./frame-contract"];
  if (
    !hasExactKeys(frameContract, ["types", "import"]) ||
    frameContract.types !== "./dist/frame-contract/index.d.ts" ||
    frameContract.import !== "./dist/frame-contract/index.js"
  ) {
    // Bug 根因：v0.5.3 曾从未包含 frame-pixel 合约的旧主线创建，但 semver 更高，
    // 版本同步脚本仍把它当成新 producer 接受，最终让产品安装包静默丢失最终栅格契约。
    // 必须同时验证不可伪装的公开子路径，不能再用版本号替代实现存在性证明。
    console.error("[cua-version] installed producer is missing the final-raster frame contract");
    process.exit(1);
  }
}

const wrapperPackageJson = await readJson(wrapperPackageJsonPath);
const servicesPackageJson = await readJson(servicesPackageJsonPath);
const installedRuntimePackage = await readInstalledRuntimePackage();
assertWindowsHelperRuntimeContract(installedRuntimePackage);
assertFinalRasterFrameContract(installedRuntimePackage);

// 基准版本 = pnpm catalog（pnpm-workspace.yaml）里 @zcode/zcode-cua 的 #vX.Y.Z。
// producer 依赖现在统一走 catalog（package.json 里是 "catalog:"），单一声明处，不再两 pinner。
// 回退：如果 catalog 里没有，则读 package.json 里的直连 git 锁（兼容尚未迁移的状态）。
const workspaceYaml = await readFile(workspaceYamlPath, "utf8");
const lockfileYaml = await readFile(lockfilePath, "utf8");
const implementationContract = await readFile(implementationContractPath, "utf8");
function readCatalogRefs(pkg) {
  const pattern = new RegExp(
    `"?${pkg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"?\\s*:\\s*"[^"]*zcode-cua\\.git#([^"]+)"`,
    "gu",
  );
  return [...workspaceYaml.matchAll(pattern)].map((match) => match[1]);
}
function readDepPin(pkgJson, pkg) {
  return readProducerPin(pkgJson.dependencies?.[pkg]);
}

function readLockCatalogEntries(pkg) {
  const escaped = pkg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `^\\s{4}['"]?${escaped}['"]?:\\r?\\n` +
      `\\s{6}specifier:\\s*['"]?[^\\r\\n'"]*zcode-cua\\.git#([^\\s'"]+)['"]?\\r?\\n` +
      `\\s{6}version:\\s*['"]?([^\\s'"]+)['"]?\\s*$`,
    "gmu",
  );
  return [...lockfileYaml.matchAll(pattern)].map((match) => ({
    ref: match[1],
    version: match[2],
  }));
}

function readLockImporterCommits(pkg) {
  const escaped = pkg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `^\\s{6}['"]?${escaped}['"]?:\\r?\\n` +
      `\\s{8}specifier:\\s*['"]?catalog:['"]?\\r?\\n` +
      `\\s{8}version:\\s*['"]?(?:@zcode/zcode-cua@)?git\\+https:\\/\\/` +
      `[^\\r\\n]+zcode-cua\\.git#([0-9a-f]{40})['"]?\\s*$`,
    "gmu",
  );
  return [...lockfileYaml.matchAll(pattern)].map((match) => match[1]);
}

function readLockProducerResolutionEntries(resolvedRef) {
  const packagesSection = lockfileYaml.match(/^packages:\r?\n([\s\S]*?)(?=^snapshots:)/mu)?.[1];
  if (!packagesSection) return [];
  const escapedRef = resolvedRef.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `^\\s{2}['"]?@zcode/zcode-cua@git\\+https:\\/\\/[^\\r\\n]+` +
      `zcode-cua\\.git#${escapedRef}['"]?:\\r?\\n` +
      `((?:\\s{4}[^\\r\\n]*(?:\\r?\\n|$))*)`,
    "gmu",
  );
  return [...packagesSection.matchAll(pattern)].map((match) => ({
    commits: [
      ...match[1].matchAll(
        /^\s{4}resolution:\s*\{[^\r\n}]*\bcommit:\s*([0-9a-f]{40})\b[^\r\n}]*\}/gmu,
      ),
    ].map((resolutionMatch) => resolutionMatch[1]),
    versions: [...match[1].matchAll(/^\s{4}version:\s*['"]?([^\s'"]+)['"]?\s*$/gmu)].map(
      (versionMatch) => versionMatch[1],
    ),
  }));
}

const catalogCuaRefs = readCatalogRefs("@zcode/zcode-cua");
const hasCatalog = catalogCuaRefs.length > 0;
if (hasCatalog && catalogCuaRefs.length !== 1) {
  console.error(
    `[cua-version] workspace catalog must contain exactly one canonical producer ref: ` +
      `${catalogCuaRefs.join(",") || "<missing>"}`,
  );
  process.exit(1);
}
const catalogCuaRef = catalogCuaRefs[0] ?? null;
// 测试包可精确锁到评审提交 SHA；这种 ref 不携带 semver，因此版本基准必须读取
// lockfile 的 catalog resolution。不能回退到 wrapper 自己，否则 wrapper、manifest
// 和官方定义一起写错时门禁仍会自洽通过。
const catalogRef = catalogCuaRef;
const lockCuaCatalogEntries = readLockCatalogEntries("@zcode/zcode-cua");
if (
  catalogRef &&
  (lockCuaCatalogEntries.length !== 1 || lockCuaCatalogEntries[0]?.ref !== catalogRef)
) {
  console.error(
    `[cua-version] lockfile catalog must contain one canonical producer entry: ` +
      `${lockCuaCatalogEntries.map((entry) => entry.ref).join(",") || "<missing>"} ` +
      `(expected ${catalogRef})`,
  );
  process.exit(1);
}
const lockCuaVersion = lockCuaCatalogEntries[0]?.version ?? null;
if (catalogRef && !lockCuaVersion) {
  console.error("[cua-version] lockfile canonical producer version is missing");
  process.exit(1);
}
if (catalogRef?.startsWith("v") && lockCuaVersion !== catalogRef.slice(1)) {
  console.error(
    `[cua-version] tag catalog must resolve to its matching package version: ` +
      `${catalogRef} != ${lockCuaVersion}`,
  );
  process.exit(1);
}
const lockCuaImporterCommits = readLockImporterCommits("@zcode/zcode-cua");
const importerCommitValues = [...new Set(lockCuaImporterCommits)];
if (catalogRef && (lockCuaImporterCommits.length === 0 || importerCommitValues.length !== 1)) {
  console.error(
    `[cua-version] lockfile catalog importers must resolve to one producer commit: ` +
      `${lockCuaImporterCommits.join(",") || "<missing>"}`,
  );
  process.exit(1);
}
const resolvedProducerCommit = importerCommitValues[0] ?? null;
const lockProducerResolutionEntries = resolvedProducerCommit
  ? readLockProducerResolutionEntries(resolvedProducerCommit)
  : [];
const producerResolutionEntry = lockProducerResolutionEntries[0];
if (catalogRef && lockProducerResolutionEntries.length !== 1) {
  console.error(
    `[cua-version] expected exactly one lockfile producer resolution for ` +
      `${resolvedProducerCommit ?? "<missing>"}; found ${lockProducerResolutionEntries.length}`,
  );
  process.exit(1);
}
if (
  catalogRef &&
  (producerResolutionEntry?.commits.length !== 1 ||
    producerResolutionEntry.commits[0] !== resolvedProducerCommit ||
    producerResolutionEntry.versions.length !== 1 ||
    producerResolutionEntry.versions[0] !== lockCuaVersion)
) {
  console.error(
    `[cua-version] lockfile producer resolution metadata must match catalog: ` +
      `commit=${producerResolutionEntry?.commits.join(",") || "<missing>"}, ` +
      `version=${producerResolutionEntry?.versions.join(",") || "<missing>"}, ` +
      `expected=${resolvedProducerCommit}@${lockCuaVersion}`,
  );
  process.exit(1);
}
const contractProducerRef = implementationContract.match(
  /producer 实现：`zcode-cua@([^`]+)`/u,
)?.[1];
if (catalogRef && /^[0-9a-f]{40}$/u.test(catalogRef) && catalogRef !== resolvedProducerCommit) {
  console.error(
    `[cua-version] SHA catalog must resolve to itself: ${catalogRef} != ${resolvedProducerCommit}`,
  );
  process.exit(1);
}
const contractExpectedProducerRef = catalogRef ? resolvedProducerCommit : null;
const contractProducerMismatch =
  contractExpectedProducerRef !== null && contractProducerRef !== contractExpectedProducerRef;
// SG-03 根因：曾经 `.gitlab/ci/30-build.yml` 的 baseline bridge 是 GitLab trigger
// job，无法在运行时读取 upstream.json，ref/SHA 只能是 YAML 字面量，成为第二事实源
// （re-pin 漏改要到下游三平台基线才暴露）。bridge 随发布信任链剥离后 CI 只剩
// 运行时派生（从 pnpm-workspace.yaml 读取）。这里保留字面量守卫：一旦未来任何
// job 重新引入字面量 pin，它必须与 upstream.json（第一事实源）一致，否则在
// build:desktop:app 的 cua-version-check 就失败，防止第二事实源静默复活。
const upstreamJson = await readJson(upstreamJsonPath);
const pipelineConfigYaml = await readFile(pipelineConfigPath, "utf8");
function readPipelineProducerLiteral(key) {
  const match = pipelineConfigYaml.match(new RegExp(`^\\s*${key}:\\s*"([^"\\s]+)"`, "mu"));
  return match?.[1] ?? null;
}
const ciProducerRef = readPipelineProducerLiteral("ZCODE_CUA_PRODUCER_REF");
const ciProducerSha = readPipelineProducerLiteral("ZCODE_CUA_PRODUCER_SHA");
// baseline bridge 已剥离后 CI 不再持有 ref/SHA 字面量（运行时从 pnpm-workspace.yaml
// 派生）。校验只在字面量存在时生效：一旦未来任何 job 重新引入字面量 pin，
// 它必须与 upstream.json 一致，防止第二事实源静默复活。
const ciLiteralMismatch =
  (ciProducerSha !== null || ciProducerRef !== null) &&
  (upstreamJson.commit !== ciProducerSha || upstreamJson.ref !== ciProducerRef);
// 2026-08-20：pin bump（catalog/lock/契约）与 Skill/provenance 同步曾是两条可拆开的
// 手工链路，出现过 catalog=e38999b7 / upstream.json=0bf36086 的漂移（skill-sync 测试
// 有断言但挂在重测试道）。upstream.json 是 provenance 第一事实源：commit/ref 必须与
// 依赖锁解析出的 producer commit 严格相等。--check 与写回模式都硬失败——写回只对齐
// 版本记录，provenance 只能由 bump-zcode-cua-producer.mjs 原子更新。
if (resolvedProducerCommit) {
  if (upstreamJson.commit !== resolvedProducerCommit) {
    console.error(
      `[cua-version] upstream.json provenance 与依赖锁漂移：upstream=${upstreamJson.commit}，` +
        `lock=${resolvedProducerCommit}。修复：node apps/zcode-cli/packages/zcode-cua-plugin/scripts/bump-zcode-cua-producer.mjs`,
    );
    process.exit(1);
  }
  if (upstreamJson.ref !== upstreamJson.commit) {
    console.error(
      `[cua-version] upstream.json.ref 必须等于不可变 commit（ref=${upstreamJson.ref}，` +
        `commit=${upstreamJson.commit}）`,
    );
    process.exit(1);
  }
}
const catalogVersion = catalogRef?.startsWith("v")
  ? catalogRef.slice(1)
  : catalogRef
    ? lockCuaVersion
    : null;
const catalogCua = catalogCuaRef ? catalogVersion : null;
const producerPins = {};
if (catalogCua) {
  producerPins["catalog @zcode/zcode-cua"] = catalogCua;
  // catalog 模式下 package.json 依赖必须是 "catalog:"，否则有人手改回了直连锁。
  for (const [where, pkg, pkgJson] of [
    ["zcode-cua-plugin/package.json", "@zcode/zcode-cua", wrapperPackageJson],
    ["services/package.json", "@zcode/zcode-cua", servicesPackageJson],
  ]) {
    const spec = pkgJson.dependencies?.[pkg];
    if (spec && spec !== "catalog:") {
      producerPins[`${where} ${pkg} (应为 catalog:)`] = readProducerPin(spec) ?? `<${spec}>`;
    }
  }
} else {
  // 回退：直连 git 锁模式。
  producerPins["zcode-cua-plugin/package.json @zcode/zcode-cua"] = readDepPin(
    wrapperPackageJson,
    "@zcode/zcode-cua",
  );
  producerPins["services/package.json @zcode/zcode-cua"] = readDepPin(
    servicesPackageJson,
    "@zcode/zcode-cua",
  );
}
const pinValues = [...new Set(Object.values(producerPins))];
if (pinValues.length !== 1 || !pinValues[0]) {
  console.error("[cua-version] producer 版本记录自相矛盾——catalog / 依赖锁必须指向同一个版本：");
  for (const [where, v] of Object.entries(producerPins)) {
    console.error(`  ${where}: ${v ?? "<未声明>"}`);
  }
  process.exit(1);
}
const expected = pinValues[0];

function readOfficialPluginVersion(source) {
  const block = source.match(/name:\s*"computer-use"[\s\S]*?version:\s*"([^"]+)"[\s\S]*?\n\s*\},/u);
  return block?.[1] ?? null;
}

const officialPluginDefinitions = await readFile(officialPluginDefinitionsPath, "utf8");

// wrapper 两处记录 + 官方插件定义 + 依赖锁，全部必须 == expected。
const records = {
  "wrapper package.json.version": wrapperPackageJson.version,
  "wrapper .zcode-plugin/plugin.json.version": (await readJson(wrapperManifestPath)).version,
  "official-plugin-definitions computer-use.version":
    readOfficialPluginVersion(officialPluginDefinitions),
  "installed producer package.json.version": installedRuntimePackage.version,
  ...producerPins,
};

const drifted = Object.entries(records).filter(([, v]) => v !== expected);

if (drifted.length === 0 && !contractProducerMismatch && !ciLiteralMismatch) {
  console.log(`[cua-version] 一致：全部记录 = ${expected}`);
  process.exit(0);
}

if (checkOnly) {
  console.error(
    `[cua-version] 版本漂移（基准 = 依赖锁 producer ${expected}）。CUA 版本必须全部对齐到 ${expected}：`,
  );
  for (const [where, v] of drifted) console.error(`  ${where}: ${v}`);
  if (contractProducerMismatch) {
    console.error(
      `  implementation contract producer ref: ${contractProducerRef ?? "<missing>"} ` +
        `(expected ${contractExpectedProducerRef})`,
    );
  }
  if (ciLiteralMismatch) {
    console.error(
      `  .gitlab/ci/30-build.yml baseline bridge literals: ` +
        `ZCODE_CUA_PRODUCER_SHA=${ciProducerSha ?? "<missing>"} ` +
        `(expected ${upstreamJson.commit}), ZCODE_CUA_PRODUCER_REF=${ciProducerRef ?? "<missing>"} ` +
        `(expected ${upstreamJson.ref})`,
    );
  }
  console.error(
    "修复：node apps/zcode-cli/packages/zcode-cua-plugin/scripts/check-version-coherence.mjs（写回版本记录和实现契约），并确认依赖锁一致。",
  );
  process.exit(1);
}

// 写回模式：把 wrapper 三处记录和实现契约对齐到依赖锁
// （依赖锁本身不动——改锁要配套 bump + tag + install）。
async function writeVersionField(path, version) {
  const parsed = await readJson(path);
  if (parsed.version === version) return false;
  parsed.version = version;
  await writeFile(path, `${JSON.stringify(parsed, null, 2)}\n`);
  return true;
}

const wrote = [];
if (await writeVersionField(wrapperPackageJsonPath, expected)) wrote.push("package.json");
if (await writeVersionField(wrapperManifestPath, expected)) wrote.push(".zcode-plugin/plugin.json");
const officialVersionPattern =
  /(name:\s*"computer-use"[\s\S]*?version:\s*")([^"]+)("[\s\S]*?\n\s*\},)/u;
if (!officialVersionPattern.test(officialPluginDefinitions)) {
  throw new Error("[cua-version] 未找到 official-plugin-definitions 中的 computer-use version");
}
const updatedOfficialPluginDefinitions = officialPluginDefinitions.replace(
  officialVersionPattern,
  `$1${expected}$3`,
);
if (updatedOfficialPluginDefinitions !== officialPluginDefinitions) {
  await writeFile(officialPluginDefinitionsPath, updatedOfficialPluginDefinitions);
  wrote.push("official-plugin-definitions.ts");
}
if (contractProducerMismatch) {
  const producerRefPattern = /producer 实现：`zcode-cua@([^`]+)`/u;
  if (!producerRefPattern.test(implementationContract)) {
    throw new Error("[cua-version] 未找到实现契约中的 producer ref");
  }
  await writeFile(
    implementationContractPath,
    implementationContract.replace(
      producerRefPattern,
      `producer 实现：\`zcode-cua@${contractExpectedProducerRef}\``,
    ),
  );
  wrote.push("implementation contract");
}
console.log(
  `[cua-version] 已把版本记录对齐到 ${expected}（写回：${wrote.join(", ") || "无变更"}）`,
);
