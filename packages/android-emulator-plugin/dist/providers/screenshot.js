import { spawn as spawnChild } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { data, inside, rel } from "../lib/path.js";
import { ensureDevice } from "./avd.js";
import { androidEnv, requireTool } from "./sdk.js";
export async function shot(input = {}) {
    const device = await ensureDevice(input);
    const file = input.path
        ? inside(process.cwd(), input.path)
        : path.join(await data("screenshots"), `${stamp()}-${device.serial}.png`);
    await mkdir(path.dirname(file), { recursive: true });
    const bytes = await screencap(device.serial, input.timeoutMs ?? 30_000);
    await writeFile(file, bytes);
    return {
        device,
        path: rel(file),
        bytes: bytes.byteLength,
        data: Buffer.from(bytes).toString("base64"),
    };
}
async function screencap(serial, timeoutMs) {
    const adb = await requireTool("adb");
    const env = await androidEnv();
    const child = spawnChild(adb, ["-s", serial, "exec-out", "screencap", "-p"], {
        env: Object.fromEntries(Object.entries({ ...process.env, ...env }).filter((item) => typeof item[1] === "string")),
        shell: false,
        stdio: ["ignore", "pipe", "pipe"],
    });
    let timed = false;
    let spawnError;
    const timer = setTimeout(() => {
        timed = true;
        child.kill("SIGTERM");
    }, timeoutMs);
    const out = collectBuffer(child.stdout);
    const err = collectText(child.stderr);
    const code = await new Promise((resolve) => {
        let settled = false;
        const settle = (exitCode) => {
            if (settled)
                return;
            settled = true;
            clearTimeout(timer);
            resolve(exitCode);
        };
        child.once("error", (error) => {
            spawnError = error instanceof Error ? error : new Error(String(error));
            settle(127);
        });
        child.once("close", (exitCode) => settle(exitCode ?? 1));
    });
    if (code !== 0 || timed) {
        const stderr = [await err, spawnError?.message].filter(Boolean).join("\n").trim();
        throw new Error(stderr || `screencap failed with exit ${code}${timed ? " after timeout" : ""}`);
    }
    return out;
}
async function collectBuffer(stream) {
    if (!stream)
        return Buffer.alloc(0);
    const chunks = [];
    for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
    }
    return Buffer.concat(chunks);
}
async function collectText(stream) {
    return (await collectBuffer(stream)).toString("utf8");
}
function stamp() {
    return new Date().toISOString().replaceAll(/[:.]/g, "-");
}
