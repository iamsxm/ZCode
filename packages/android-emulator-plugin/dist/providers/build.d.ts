type Build = {
    projectDir?: string;
    module?: string;
    variant?: string;
    applicationId?: string;
    serial?: string;
    avd?: string;
    timeoutMs?: number;
};
type RunApp = Build & {
    launchActivity?: string;
};
export declare function buildApp(input?: Build): Promise<{
    ok: boolean;
    root: string;
    module: string;
    variant: string;
    task: string;
    apkPath: string | undefined;
    applicationId: string;
    logPath: string;
    code: number;
    timedOut: boolean;
    output: string;
}>;
export declare function buildAndRun(input?: RunApp): Promise<{
    installed: boolean;
    launched: boolean;
    ok: boolean;
    root: string;
    module: string;
    variant: string;
    task: string;
    apkPath: string | undefined;
    applicationId: string;
    logPath: string;
    code: number;
    timedOut: boolean;
    output: string;
} | {
    device: import("./device.js").Device;
    installed: {
        installed: boolean;
        serial: string;
        apkPath: string;
        output: string;
    };
    launched: {
        launched: boolean;
        serial: string;
        applicationId: string;
        output: string;
    };
    ok: boolean;
    root: string;
    module: string;
    variant: string;
    task: string;
    apkPath: string | undefined;
    applicationId: string;
    logPath: string;
    code: number;
    timedOut: boolean;
    output: string;
}>;
export declare function pickApk(hits: string[], variant: string): string | undefined;
export {};
//# sourceMappingURL=build.d.ts.map