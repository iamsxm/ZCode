type Shot = {
    udid?: string;
    device?: string;
    runtime?: string;
    path?: string;
    openSimulator?: boolean;
};
export declare function shot(input?: Shot): Promise<{
    simulator: {
        opened: boolean;
        name: string;
        udid: string;
        state: string;
        runtime: string;
        available: boolean;
    };
    path: string;
    bytes: number;
    data: string;
}>;
export {};
//# sourceMappingURL=screenshot.d.ts.map