import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createConnection } from "node:net";

export const BROKER_SOCKET_ENV = "ZCODE_CUA_PERMISSION_BROKER_SOCKET";
export const BROKER_UNAVAILABLE_ENV = "ZCODE_CUA_PERMISSION_BROKER_UNAVAILABLE";

export class BrokerError extends Error {
  constructor(message, options = {}) {
    super(message ?? "Computer Use broker is unavailable.");
    this.name = "BrokerError";
    this.code = options.code ?? "unavailable";
    if (options.details !== undefined) this.details = options.details;
  }
}

export class CuaHelperError extends Error {
  constructor(message, options = {}) {
    super(message ?? "Computer Use Helper is unavailable.");
    this.name = "CuaHelperError";
    this.code = options.code ?? "helper_unavailable";
  }
}

export function isCuaHelperError(value) {
  return value instanceof CuaHelperError;
}

const brokerErrorFactory = (code) => (message, details) =>
  new BrokerError(message ?? code, { code, details });

export const notAuthorized = brokerErrorFactory("not_authorized");
export const notSelectable = brokerErrorFactory("not_selectable");
export const notSettable = brokerErrorFactory("not_settable");
export const elementUnavailable = brokerErrorFactory("element_unavailable");
export const actionUnavailable = brokerErrorFactory("action_unavailable");
export const foregroundRequired = brokerErrorFactory("foreground_required");

export async function callBrokerMethod(args) {
  if (!args || typeof args.socketPath !== "string" || !args.socketPath.trim()) {
    throw new BrokerError("Computer Use broker socket is missing.", { code: "broker_unavailable" });
  }
  const timeoutMs = Number.isFinite(args.timeoutMs) ? Math.max(1, args.timeoutMs) : 15_000;
  const authRequestId = 1;
  const businessRequestId = 2;
  const socket = createConnection(args.socketPath);
  let settled = false;
  let buffer = "";
  let timer;
  let phase = "authenticate";
  const finish = (error, value) => {
    if (settled) return;
    settled = true;
    if (timer) clearTimeout(timer);
    socket.destroy();
    if (error) throwOrReject(error);
    else resolvePromise(value);
  };
  let resolvePromise;
  let rejectPromise;
  const promise = new Promise((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });
  const throwOrReject = (error) => rejectPromise(error);
  timer = setTimeout(() => finish(new BrokerError(`Computer Use broker timed out after ${timeoutMs}ms`, { code: "timeout" })), timeoutMs);
  socket.once("connect", () => {
    socket.write(`${JSON.stringify({ id: authRequestId, method: "authenticate", params: { clientApiVersion: 2, client_type: "zcode_cua_mcp" } })}\n`);
  });
  socket.on("data", (chunk) => {
    buffer += chunk.toString("utf8");
    while (!settled) {
      const newline = buffer.indexOf("\n");
      if (newline < 0) return;
      const line = buffer.slice(0, newline);
      buffer = buffer.slice(newline + 1);
      let response;
      try {
        response = JSON.parse(line);
      } catch {
        finish(new BrokerError("Computer Use broker returned invalid JSON.", { code: "invalid_response" }));
        return;
      }
      if (phase === "authenticate") {
        if (response?.id !== authRequestId || response?.ok !== true) {
          finish(new BrokerError(response?.error?.message ?? "Computer Use broker authentication failed.", {
            code: response?.error?.code ?? "not_authorized",
            details: response?.error?.details,
          }));
          return;
        }
        phase = "request";
        socket.write(`${JSON.stringify({ id: businessRequestId, method: args.method, params: args.params ?? {} })}\n`);
        continue;
      }
      if (response?.id !== businessRequestId || response?.ok !== true) {
        finish(new BrokerError(response?.error?.message ?? "Computer Use broker request failed.", {
          code: response?.error?.code ?? "broker_failed",
          details: response?.error?.details,
        }));
        return;
      }
      finish(undefined, response.result);
    }
  });
  socket.once("error", (error) => finish(new BrokerError(error.message, { code: "broker_unavailable" })));
  socket.once("close", () => {
    if (!settled) finish(new BrokerError("Computer Use broker closed before returning a response.", { code: "broker_unavailable" }));
  });
  return await promise;
}

export async function probeHelperHealth(_socketPath, _options) {
  const result = await callBrokerMethod({ socketPath: _socketPath, method: "broker_info", timeoutMs: _options?.timeoutMs });
  return {
    bundleId: typeof result?.bundleId === "string" ? result.bundleId : typeof result?.bundle_id === "string" ? result.bundle_id : null,
    pid: Number.isInteger(result?.pid) ? result.pid : null,
  };
}

export function mintBrokerSocketPath(options = {}) {
  const dir = typeof options.dir === "string" ? options.dir : tmpdir();
  return join(dir, `zcode-cua-broker-${randomUUID()}.sock`);
}

export function resolveBrokerSocketPath(options = {}) {
  const env = options.env ?? process.env;
  const fromEnv = env[BROKER_SOCKET_ENV];
  if (typeof fromEnv === "string" && fromEnv.trim()) return fromEnv;
  return mintBrokerSocketPath(options);
}

export function parseRequestLine(line) {
  try {
    const value = JSON.parse(line);
    if (!value || typeof value !== "object" || typeof value.method !== "string") return undefined;
    return value;
  } catch {
    return undefined;
  }
}

export function okResponse(result) {
  return { ok: true, result };
}

export function errorResponse(message, options = {}) {
  return {
    ok: false,
    error: { message, ...(options.code ? { code: options.code } : {}) },
  };
}

export function errorResponseFromException(error) {
  return errorResponse(error instanceof Error ? error.message : String(error));
}

export function serializeResponse(response) {
  return `${JSON.stringify(response)}\n`;
}

export async function dispatchRequest(_backend, _request) {
  throw new CuaHelperError("Computer Use is not available in this build.");
}

export async function handleRequestLine(_backend, _line) {
  throw new CuaHelperError("Computer Use is not available in this build.");
}

export function isBrokerMethod(method) {
  return typeof method === "string" && method.length > 0;
}

export function isReadOnlyBrokerMethod(method) {
  return new Set(["broker_info", "ping", "controller_status", "permission_status", "input_permission_status", "screen_capture_status", "screen_capture_probe", "supports_accessibility", "list_applications", "application_info", "list_windows", "capture_app", "element_at_point", "read_element", "is_focus_steal_prevented"]).has(method);
}
