export type Run = {
    cmd: string[];
    code: number;
    stdout: string;
    stderr: string;
    timed: boolean;
};
type RunOpts = {
    cwd?: string;
    env?: Record<string, string | undefined>;
    timeout?: number;
};
export declare function run(cmd: string[], opts?: RunOpts): Promise<Run>;
export declare function ok(item: Run): boolean;
export declare function brief(item: Run, limit?: number): string;
export {};
//# sourceMappingURL=run.d.ts.map