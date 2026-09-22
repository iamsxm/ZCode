type TemplateInput = {
    compileSdk: number;
    minSdk: number;
    name: string;
    pkg: string;
};
type TemplateFile = {
    body: (input: TemplateInput) => string;
    path: string;
};
export declare function templateFiles(root: string, pkg: string, sdk?: string): TemplateFile[];
export {};
//# sourceMappingURL=project-template.d.ts.map