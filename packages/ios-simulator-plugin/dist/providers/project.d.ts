type Found = {
    projects: string[];
    workspaces: string[];
    schemes: string[];
    bundleIds: string[];
};
export declare function discover(dir?: string): Promise<Found>;
export declare function create(input: {
    name: string;
    bundleId?: string;
    dir?: string;
    deployment?: string;
    overwrite?: boolean;
}): Promise<{
    project: string;
    scheme: string;
    bundle: string;
    files: string[];
}>;
export declare function bundle(flag: "-project" | "-workspace", file: string, scheme: string): Promise<string | undefined>;
export declare function source(input: {
    project?: string;
    workspace?: string;
    scheme?: string;
}, found: Found): {
    flag: "-workspace";
    file: string;
    scheme: string | undefined;
} | {
    flag: "-project";
    file: string;
    scheme: string | undefined;
};
export {};
//# sourceMappingURL=project.d.ts.map