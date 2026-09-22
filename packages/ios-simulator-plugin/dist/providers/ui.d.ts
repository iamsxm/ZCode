type Target = {
    udid?: string;
    device?: string;
    runtime?: string;
};
type Tap = Target & {
    x: number;
    y: number;
    duration?: number;
};
type Swipe = Target & {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    delta?: number;
};
type Text = Target & {
    text: string;
};
type Button = Target & {
    button: "APPLE_PAY" | "HOME" | "LOCK" | "SIDE_BUTTON" | "SIRI";
    duration?: number;
};
export declare function status(): Promise<{
    backend: string;
    available: boolean;
    detail: string;
    reservedBackends: string[];
}>;
export declare function tap(input: Tap): Promise<{
    backend: string;
    udid: string;
    output: string;
}>;
export declare function swipe(input: Swipe): Promise<{
    backend: string;
    udid: string;
    output: string;
}>;
export declare function typeText(input: Text): Promise<{
    backend: string;
    udid: string;
    output: string;
}>;
export declare function button(input: Button): Promise<{
    backend: string;
    udid: string;
    output: string;
}>;
export declare function describe(input?: Target): Promise<{
    backend: string;
    udid: string;
    output: string;
}>;
export {};
//# sourceMappingURL=ui.d.ts.map