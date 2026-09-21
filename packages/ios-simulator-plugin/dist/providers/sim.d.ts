type Sim = {
    name: string;
    udid: string;
    state: string;
    runtime: string;
    available: boolean;
};
export declare function list(): Promise<Sim[]>;
export declare function parseSimulators(value: string): Sim[];
export declare function isIosRuntime(runtime: string): boolean;
export declare function pick(input?: {
    udid?: string;
    name?: string;
    runtime?: string;
}): Promise<Sim>;
export declare function boot(input?: {
    udid?: string;
    name?: string;
    runtime?: string;
    open?: boolean;
}): Promise<{
    opened: boolean;
    name: string;
    udid: string;
    state: string;
    runtime: string;
    available: boolean;
}>;
export declare function show(udid?: string): Promise<{
    opened: boolean;
    udid: string | undefined;
    fallback?: undefined;
} | {
    opened: boolean;
    udid: string | undefined;
    fallback: boolean;
}>;
export declare function install(udid: string, app: string): Promise<{
    installed: boolean;
    udid: string;
    app: string;
}>;
export declare function launch(udid: string, bundle: string, args?: string[]): Promise<{
    launched: boolean;
    udid: string;
    bundle: string;
    output: string;
}>;
export declare function terminate(udid: string, bundle: string): Promise<{
    terminated: boolean;
    udid: string;
    bundle: string;
}>;
export declare function url(udid: string, value: string): Promise<{
    opened: boolean;
    udid: string;
    url: string;
}>;
export {};
//# sourceMappingURL=sim.d.ts.map