type Logs = {
    serial?: string;
    avd?: string;
    applicationId?: string;
    lines?: number;
    limit?: number;
};
export declare function logs(input?: Logs): Promise<{
    device: import("./device.js").Device;
    applicationId: string | undefined;
    lines: number;
    output: string;
}>;
export {};
//# sourceMappingURL=logs.d.ts.map