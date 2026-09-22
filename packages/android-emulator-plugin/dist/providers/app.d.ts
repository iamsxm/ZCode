type Target = {
    serial?: string;
    avd?: string;
    timeoutMs?: number;
};
export declare function install(input: Target & {
    apkPath: string;
}): Promise<{
    installed: boolean;
    serial: string;
    apkPath: string;
    output: string;
}>;
export declare function launch(input: Target & {
    applicationId: string;
    activity?: string;
}): Promise<{
    launched: boolean;
    serial: string;
    applicationId: string;
    output: string;
}>;
export declare function terminate(input: Target & {
    applicationId: string;
}): Promise<{
    terminated: boolean;
    serial: string;
    applicationId: string;
}>;
export declare function openUrl(input: Target & {
    url: string;
}): Promise<{
    opened: boolean;
    serial: string;
    url: string;
}>;
export declare function packageName(value: string): string;
export {};
//# sourceMappingURL=app.d.ts.map