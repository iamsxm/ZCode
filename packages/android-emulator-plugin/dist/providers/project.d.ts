type Found = {
    root?: string;
    gradleRoots: string[];
    modules: string[];
    variants: string[];
    applicationIds: string[];
    manifests: string[];
    apks: string[];
    hasWrapper: boolean;
    hasGradleProperties: boolean;
    hasLocalProperties: boolean;
    warnings: string[];
};
export declare function discover(dir?: string): Promise<Found>;
export declare function create(input: {
    name: string;
    packageName?: string;
    dir?: string;
    minSdk?: number;
    compileSdk?: number;
    overwrite?: boolean;
}): Promise<{
    root: string;
    module: string;
    variant: string;
    applicationId: string;
    files: string[];
    createdBy: string;
    note: string;
}>;
export declare function findApks(root: string, modules?: string[]): Promise<string[]>;
export {};
//# sourceMappingURL=project.d.ts.map