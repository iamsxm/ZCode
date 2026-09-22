type Logs = {
    udid?: string;
    device?: string;
    runtime?: string;
    bundleId?: string;
    seconds?: number;
    limit?: number;
};
export declare function logs(input?: Logs): Promise<{
    simulator: {
        name: string;
        udid: string;
        state: string;
        runtime: string;
        available: boolean;
    };
    seconds: number;
    output: string;
}>;
export {};
//# sourceMappingURL=logs.d.ts.map