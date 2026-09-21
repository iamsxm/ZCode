type ToolCheck = {
    name: string;
    path?: string;
    ok: boolean;
    detail: string;
};
export declare function sdkRoot(): Promise<string | undefined>;
export declare function findTool(name: string): Promise<string | undefined>;
export declare function requireTool(name: string): Promise<string>;
export declare function checkTool(name: string, versionArgs?: string[]): Promise<ToolCheck>;
export declare function androidEnv(): Promise<Record<string, string | undefined>>;
export declare function javaHome(): Promise<string | undefined>;
export {};
//# sourceMappingURL=sdk.d.ts.map