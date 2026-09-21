import { ensureDevice } from "./avd.js";
import { packageName } from "./app.js";
import { brief, ok, run } from "../lib/run.js";
import { requireTool } from "./sdk.js";
export async function logs(input = {}) {
    const device = await ensureDevice(input);
    const adb = await requireTool("adb");
    const lines = Math.max(1, Math.min(input.lines ?? 500, 5000));
    const out = await run([adb, "-s", device.serial, "logcat", "-d", "-v", "time", "-t", String(lines)], { timeout: 60_000 });
    if (!ok(out))
        throw new Error(brief(out));
    const app = input.applicationId ? packageName(input.applicationId) : undefined;
    const value = app
        ? out.stdout
            .split(/\r?\n/)
            .filter((line) => line.includes(app) ||
            line.toLowerCase().includes(app.split(".").at(-1)?.toLowerCase() ?? app))
            .join("\n")
        : out.stdout;
    return {
        device,
        applicationId: app,
        lines,
        output: text(value, input.limit ?? 20_000),
    };
}
function text(value, limit) {
    if (value.length <= limit)
        return value;
    return value.slice(0, limit) + "\n...[truncated]";
}
