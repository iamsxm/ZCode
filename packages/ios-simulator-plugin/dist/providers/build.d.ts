type Build = {
    project?: string;
    workspace?: string;
    scheme?: string;
    configuration?: string;
    device?: string;
    udid?: string;
    runtime?: string;
    derivedDataPath?: string;
    bundleId?: string;
    openSimulator?: boolean;
    timeoutMs?: number;
};
type RunApp = Build & {
    launchArgs?: string[];
};
export declare function app(input?: Build): Promise<{
    ok: boolean;
    source: {
        flag: "-workspace";
        file: string;
        scheme: string | undefined;
    } | {
        flag: "-project";
        file: string;
        scheme: string | undefined;
    };
    simulator: {
        opened: boolean;
        name: string;
        udid: string;
        state: string;
        runtime: string;
        available: boolean;
    };
    derivedDataPath: string;
    appPath: string | undefined;
    bundleId: string | undefined;
    logPath: string;
    code: number;
    timedOut: boolean;
    output: string;
}>;
export declare function runApp(input?: RunApp): Promise<{
    installed: boolean;
    launched: boolean;
    ok: boolean;
    source: {
        flag: "-workspace";
        file: string;
        scheme: string | undefined;
    } | {
        flag: "-project";
        file: string;
        scheme: string | undefined;
    };
    simulator: {
        opened: boolean;
        name: string;
        udid: string;
        state: string;
        runtime: string;
        available: boolean;
    };
    derivedDataPath: string;
    appPath: string | undefined;
    bundleId: string | undefined;
    logPath: string;
    code: number;
    timedOut: boolean;
    output: string;
} | {
    installed: {
        installed: boolean;
        udid: string;
        app: string;
    };
    launched: {
        launched: boolean;
        udid: string;
        bundle: string;
        output: string;
    };
    ok: boolean;
    source: {
        flag: "-workspace";
        file: string;
        scheme: string | undefined;
    } | {
        flag: "-project";
        file: string;
        scheme: string | undefined;
    };
    simulator: {
        opened: boolean;
        name: string;
        udid: string;
        state: string;
        runtime: string;
        available: boolean;
    };
    derivedDataPath: string;
    appPath: string | undefined;
    bundleId: string | undefined;
    logPath: string;
    code: number;
    timedOut: boolean;
    output: string;
}>;
export declare function pickAppProduct(hits: string[], config: string): string | undefined;
export {};
//# sourceMappingURL=build.d.ts.map