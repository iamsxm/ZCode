#!/usr/bin/env node

import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import process from "node:process";

const desktopRoot = resolve(import.meta.dirname, "..");
const destination = resolve(desktopRoot, "dist-cua-helper");
const defaultSource =
  process.platform === "win32"
    ? join(
        process.env.LOCALAPPDATA || join(homedir(), "AppData", "Local"),
        "Programs",
        "ZCode",
        "resources",
        "tools",
        "cua-helper",
      )
    : undefined;
const source = process.env.ZCODE_CUA_HELPER_SOURCE?.trim() || defaultSource;

if (process.platform !== "win32") {
  console.log("[prepare-cua-helper-runtime] skip: Computer Use Helper runtime is Windows-only");
  process.exit(0);
}

if (!source || !existsSync(source)) {
  throw new Error(
    `[prepare-cua-helper-runtime] source runtime not found: ${source || "<unset>"}. ` +
      "Set ZCODE_CUA_HELPER_SOURCE to an installed cua-helper directory.",
  );
}

const manifestPath = join(source, "runtime-manifest.json");
const packagePath = join(source, "package.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const sourcePackage = JSON.parse(readFileSync(packagePath, "utf8"));
if (manifest.platform !== "win32" || manifest.packageName !== "@zcode/zcode-cua") {
  throw new Error(
    `[prepare-cua-helper-runtime] unsupported runtime manifest at ${manifestPath}: ` +
      `${manifest.packageName ?? "missing packageName"}/${manifest.platform ?? "missing platform"}`,
  );
}
if (!manifest.entry || !manifest.addon || !manifest.sha256?.entry || !manifest.sha256?.addon) {
  throw new Error(`[prepare-cua-helper-runtime] incomplete runtime manifest: ${manifestPath}`);
}

rmSync(destination, { recursive: true, force: true });
mkdirSync(destination, { recursive: true });
cpSync(source, destination, { recursive: true, force: true });

// windowsCuaDevRuntime deliberately accepts only the producer contract name.
// The installed helper uses a separate distribution package name, so the local
// staging copy receives a contract-only package.json rewrite; no runtime code is changed.
writeFileSync(
  join(destination, "package.json"),
  `${JSON.stringify(
    {
      ...sourcePackage,
      name: "@zcode/zcode-cua",
    },
    null,
    2,
  )}\n`,
);

console.log(
  `[prepare-cua-helper-runtime] staged ${manifest.packageVersion} ` +
    `(${manifest.arch}, Electron ${manifest.electronVersion}) at ${destination}`,
);
