// Self-contained esbuild bundle for the M4 slim shell.
//
// Why this exists: `tsc` emits raw ESM that keeps `import { main } from "@zcode/zcode-cua"`
// as a bare specifier. The bundled-agent staging tree
// (packages/desktop/bundled-agents/<plat>/glm/packages/zcode-cua-plugin/) ships only the
// plugin's dist/ + package.json — no node_modules/@zcode/zcode-cua. Loading the raw tsc
// server.js there throws ERR_MODULE_NOT_FOUND for '@zcode/zcode-cua', the MCP stdio socket
// closes immediately, and the dev app shows "Connection closed / 0 tools". DEV works only
// because the workspace's hoisted node_modules/@zcode/zcode-cua is resolvable from source.
//
// Fix: bundle the slim shell so @zcode/zcode-cua (and its pure-JS deps) are inlined into a
// single dist/mcp/server.js. `sharp` stays external — it's native (.node prebuilt) and
// cannot be inlined into a JS bundle; @zcode/zcode-cua's own bundle already externalizes
// it the same way. In-repo runs resolve sharp via the hoisted root node_modules.
//
// Mirrors apps/zcode-cli/packages/android-emulator-plugin/scripts/build-mcp.mjs.

import { chmod } from "node:fs/promises";
import { resolve } from "node:path";
import { build } from "esbuild";

const packageRoot = resolve(import.meta.dirname, "..");
const serverOutputPath = resolve(packageRoot, "dist", "mcp", "server.js");

// sharp is native: esbuild cannot inline `.node` binaries into a JS bundle.
// Matches @zcode/zcode-cua/scripts/build.mjs's external list.
// koffi 同样是原生模块：平台分发会引用多个 `.node` 文件，必须像 sharp 一样
// 留给目标平台运行时加载，避免 esbuild 解析所有平台的二进制路径。
const external = ["koffi", "sharp"];
const localRuntimePackageDir = process.env.ZCODE_CUA_RUNTIME_PACKAGE_DIR?.trim();

await build({
  bundle: true,
  entryPoints: [resolve(packageRoot, "src", "mcp", "server.ts")],
  format: "esm",
  legalComments: "none",
  outfile: serverOutputPath,
  platform: "node",
  target: "node24",
  external,
  // 本地 Helper/插件联合回归必须内联同一份刚 build 的 zcode-cua。
  // 未设置覆盖时，发布构建仍解析 lockfile 固定的 workspace 依赖。
  ...(localRuntimePackageDir
    ? {
        alias: {
          "@zcode/zcode-cua": resolve(localRuntimePackageDir),
        },
      }
    : {}),
  // @zcode/zcode-cua v0.4.0 ships a CJS dist; esbuild inlining it into this ESM bundle
  // emits a `__require(...)` shim that throws "Dynamic require of X is not supported" because
  // `require` is undefined in ESM. Define `require` via createRequire so the shim resolves to
  // the real CJS loader (node builtins + any CJS deps). esbuild places the entry shebang on
  // line 1 and the banner after it, so the shebang stays valid.
  banner: {
    js: "import { createRequire as __zcodeCreateRequire } from 'node:module';\nconst require = __zcodeCreateRequire(import.meta.url);",
  },
});

await chmod(serverOutputPath, 0o755);
