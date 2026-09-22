export type Check = {
    name: string;
    ok: boolean;
    detail: string;
    fix?: string;
};
export declare function preflightOk(checks: Check[], input: {
    hasReadyTarget: boolean;
}): boolean;
export declare function preflight(): Promise<{
    ok: boolean;
    backend: string;
    checks: Check[];
}>;
//# sourceMappingURL=preflight.d.ts.map