type Shot = {
    serial?: string;
    avd?: string;
    path?: string;
    timeoutMs?: number;
};
export declare function shot(input?: Shot): Promise<{
    device: import("./device.js").Device;
    path: string;
    bytes: number;
    data: string;
}>;
export {};
//# sourceMappingURL=screenshot.d.ts.map