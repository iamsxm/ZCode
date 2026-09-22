import { brief, ok, run } from "../lib/run.js";
import { boot } from "./sim.js";
export async function status() {
    const idb = await run(["idb", "--version"], { timeout: 5000 });
    return {
        backend: "idb",
        available: ok(idb),
        detail: ok(idb) ? brief(idb) : "idb is not installed or not on PATH",
        reservedBackends: ["xcodebuildmcp"],
    };
}
export async function tap(input) {
    const sim = await target(input);
    return exec(sim.udid, [
        "ui",
        "tap",
        String(input.x),
        String(input.y),
        ...(input.duration === undefined ? [] : ["--duration", String(input.duration)]),
    ]);
}
export async function swipe(input) {
    const sim = await target(input);
    return exec(sim.udid, [
        "ui",
        "swipe",
        String(input.x1),
        String(input.y1),
        String(input.x2),
        String(input.y2),
        ...(input.delta === undefined ? [] : ["--delta", String(input.delta)]),
    ]);
}
export async function typeText(input) {
    const sim = await target(input);
    return exec(sim.udid, ["ui", "text", input.text]);
}
export async function button(input) {
    const sim = await target(input);
    return exec(sim.udid, [
        "ui",
        "button",
        input.button,
        ...(input.duration === undefined ? [] : ["--duration", String(input.duration)]),
    ]);
}
export async function describe(input = {}) {
    const sim = await target(input);
    return exec(sim.udid, ["ui", "describe-all", "--json"]);
}
async function target(input) {
    return boot({ udid: input.udid, name: input.device, runtime: input.runtime });
}
async function exec(udid, args) {
    const found = await status();
    if (!found.available) {
        throw new Error("UI automation backend unavailable. Install idb and idb-companion, or use build/run/screenshot tools only.");
    }
    const out = await run(["idb", ...args, "--udid", udid], { timeout: 60_000 });
    if (!ok(out))
        throw new Error(brief(out));
    return {
        backend: "idb",
        udid,
        output: brief(out, 20_000),
    };
}
