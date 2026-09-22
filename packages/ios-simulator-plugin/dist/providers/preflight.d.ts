type Check = {
    name: string;
    ok: boolean;
    detail: string;
    fix?: string;
};
export declare function preflight(): Promise<{
    ok: boolean;
    checks: Check[];
}>;
export {};
//# sourceMappingURL=preflight.d.ts.map