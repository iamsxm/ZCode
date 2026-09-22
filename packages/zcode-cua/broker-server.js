import { randomBytes, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { createConnection } from "node:net";
import { join } from "node:path";
import { access } from "node:fs/promises";
import { CuaHelperError, probeHelperHealth } from "./broker.js";

export const HELPER_ADDON_ENV = "ZCODE_CUA_HELPER_ADDON";
export const WINDOWS_DEV_CONTROL_PROTOCOL = "zcode-cua-windows-dev/v1";

const UNAVAILABLE = "Computer Use is not available in this build.";
const DEFAULT_HELPER_ENTRY = "dist/windows-helper.js";
const DEFAULT_HELPER_ADDON = "build/Release/ax_native.node";

function unavailableReject() {
  return Promise.reject(new CuaHelperError(UNAVAILABLE));
}

export function buildHelperOpenArgs(_spec, _launcherPid) {
  if (!_spec?.socketPath || !_launcherPid) throw new CuaHelperError("Computer Use Helper launch parameters are missing.");
  return ["--no-warnings", _spec.entryPath, "--socket", _spec.socketPath, "--parent-pid", String(_launcherPid)];
}

export async function resolveHelperPermissionSubjectIdentity(_appPath) {
  throw new CuaHelperError(UNAVAILABLE);
}

export function isCuaLocalDevelopmentRuntime(_env, _compiledLocalDevelopmentRuntime) {
  return false;
}

export function createCuaHelperInstaller(_options) {
  return {
    ensureInstalled: async () => {
      const path = _options?.bundledAppPath ?? resolvePackagedNativeAddonPath(_options);
      if (!path) throw new CuaHelperError(UNAVAILABLE);
      await access(path);
      return path;
    },
    verifyInstalled: async (appPath) => { await access(appPath); },
  };
}

export const defaultCuaHelperVerifierDependencies = {
  readExecutableArchs: unavailableReject,
  verifyCodeSignature: unavailableReject,
  verifyTeamIdentifier: unavailableReject,
};

export function cuaBrokerRefreshMarkerPath(_socketPath) {
  return undefined;
}

export async function publishCuaBrokerRefreshMarker(_socketPath, _options) {
  return { path: undefined };
}

export function loadRealNativeAddon(_options) {
  throw new CuaHelperError(UNAVAILABLE);
}

export function resolvePackagedNativeAddonPath(_options) {
  const resourcesPath = _options?.resourcesPath ?? process.resourcesPath;
  if (!resourcesPath) return undefined;
  return join(resourcesPath, "tools", "cua-helper", DEFAULT_HELPER_ADDON);
}

export function resolveInTreeAddonPath(_options) {
  return undefined;
}

export function createAxReadOnlyMethods(_source, _registry, _options) {
  return {};
}

export const ROLE_TO_KIND = {};

export function roleToKind(_role) {
  return undefined;
}

export class CuaHelperLifecycleManager {
  #dispose;
  #current;
  #disposed = false;
  constructor(dispose) {
    this.#dispose = dispose;
    this.#current = undefined;
  }
  async acquire(options) {
    if (typeof options?.isAdmitted === "function" && !options.isAdmitted()) {
      return undefined;
    }
    const managed = options?.create?.();
    this.#current = managed;
    return managed;
  }
  peek() {
    return this.#current;
  }
  get disposed() {
    return this.#disposed;
  }
  async dispose(managed) {
    this.#disposed = true;
    await this.#dispose?.(managed ?? this.#current);
  }
}

export class CuaProductHelperWorkspaceRegistry {
  setEnabled(_context, _enabled) {}
}

export function createProductCuaHelperHost(_options) {
  const options = _options ?? {};
  const resourcesPath = options.resourcesPath ?? process.resourcesPath;
  const root = resourcesPath ? join(resourcesPath, "tools", "cua-helper") : undefined;
  const entryPath = options.entryPath ?? (root ? join(root, DEFAULT_HELPER_ENTRY) : undefined);
  let child;
  let socketPath;
  let authority;
  return {
    get running() { return Boolean(child && !child.killed); },
    get socketPath() { return socketPath ?? null; },
    get pluginAuthority() { return authority ?? null; },
    get reservedTransport() { return socketPath && authority ? { socketPath, pluginAuthority: authority } : undefined; },
    async start() {
      if (child && !child.killed && socketPath && authority) return { socketPath, pluginAuthority: authority };
      if (!entryPath) throw new CuaHelperError(UNAVAILABLE);
      await access(entryPath);
      socketPath = `\\\\.\\pipe\\zcode-cua-helper-${randomUUID().replaceAll("-", "").slice(0, 16)}`;
      authority = randomBytes(16).toString("hex");
      child = spawn(process.execPath, buildHelperOpenArgs({ entryPath, socketPath }, process.pid), {
        env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", [HELPER_ADDON_ENV]: options.addonPath ?? resolvePackagedNativeAddonPath(options) ?? "" },
        stdio: "ignore",
        windowsHide: true,
      });
      await waitForPipe(socketPath, options.startupTimeoutMs ?? 30_000);
      return { socketPath, pluginAuthority: authority, pid: child.pid };
    },
    async stop() { if (child && !child.killed) child.kill(); child = undefined; socketPath = undefined; authority = undefined; },
    async restart() { await this.stop(); return this.start(); },
    async restartAfterCurrentStart() { return this.restart(); },
    async waitForTransport(_timeoutMs = 30_000) { if (!socketPath || !authority) await this.start(); return { socketPath, pluginAuthority: authority }; },
    async checkHealth(timeoutMs = 5_000) { if (!socketPath) throw new CuaHelperError(UNAVAILABLE); return probeHelperHealth(socketPath, { timeoutMs }); },
    async queryScreenCaptureProbe() { return { ok: false, reason: UNAVAILABLE }; },
    async queryScreenRecordingPreflight() { return undefined; },
    async queryPermissionStatus() { return { grant_owner: null, accessibility: "unknown", screen_recording: "unknown" }; },
  };
}

async function waitForPipe(socketPath, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const connected = await new Promise((resolveConnected) => {
      const socket = createConnection(socketPath);
      const done = (value) => { socket.destroy(); resolveConnected(value); };
      socket.once("connect", () => done(true));
      socket.once("error", () => done(false));
      socket.setTimeout(200, () => done(false));
    });
    if (connected) return;
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 100));
  }
  throw new CuaHelperError(`Computer Use Helper did not open its transport within ${timeoutMs}ms.`, { code: "startup_timeout" });
}

export function isOfficialCuaPluginEnabledForWorkspace(_options) {
  return false;
}

export function createCuaProductMcpServerResolver(_host, _options) {
  return {
    async resolveMcpServers(servers, _context) {
      return servers;
    },
    async restart() {
      throw new Error(UNAVAILABLE);
    },
    async restartAfterPermissionGrant(_onboardingSessionId) {
      throw new Error(UNAVAILABLE);
    },
  };
}

export async function waitForCuaHelperStartup(startup, _deadlineMs) {
  return await startup;
}

export function isPotentialZCodeCuaAgentMcpServer(_server) {
  return false;
}

export function isScreenCaptureProbeSuccess(_probe) {
  return false;
}

export function markCuaProductHelperAgentEnvUnavailable(_host) {}

export function hasCuaProductHelperAgentEnvUnavailable(_host) {
  return false;
}

export function clearCuaProductHelperAgentEnvUnavailable(_host) {}

export async function reapOrphanedHelpers(_options) {}

export async function requestHelperAccessibilityPermissionViaLaunchServices(_options) {
  return { ok: false, reason: UNAVAILABLE };
}

export async function requestHelperScreenRecordingPermissionViaLaunchServices(_options) {
  return { ok: false, reason: UNAVAILABLE };
}
