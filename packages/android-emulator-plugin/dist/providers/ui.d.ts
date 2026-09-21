type UiTarget = {
    serial?: string;
    avd?: string;
    timeoutMs?: number;
};
type UiElement = {
    index: number;
    text?: string;
    contentDescription?: string;
    resourceId?: string;
    className?: string;
    bounds?: Bounds;
    clickable?: boolean;
    enabled?: boolean;
};
type Bounds = {
    left: number;
    top: number;
    right: number;
    bottom: number;
    centerX: number;
    centerY: number;
};
declare const KEY_EVENTS: {
    readonly BACK: "KEYCODE_BACK";
    readonly HOME: "KEYCODE_HOME";
    readonly ENTER: "KEYCODE_ENTER";
    readonly APP_SWITCH: "KEYCODE_APP_SWITCH";
    readonly MENU: "KEYCODE_MENU";
    readonly SEARCH: "KEYCODE_SEARCH";
};
export declare function status(): Promise<{
    backend: string;
    adb: string | undefined;
    adbInput: boolean;
    uiAutomator: boolean;
    available: boolean;
    implementedBackends: string[];
}>;
export declare function describe(input?: UiTarget): Promise<{
    device: import("./device.js").Device;
    elements: UiElement[];
}>;
export declare function resolve(input: UiTarget & {
    query: string;
}): Promise<{
    device: import("./device.js").Device;
    element: UiElement;
    x: number;
    y: number;
}>;
export declare function tap(input: UiTarget & {
    x: number;
    y: number;
}): Promise<{
    tapped: boolean;
    serial: string;
    x: number;
    y: number;
}>;
export declare function swipe(input: UiTarget & {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    durationMs?: number;
}): Promise<{
    swiped: boolean;
    serial: string;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
}>;
export declare function typeText(input: UiTarget & {
    text: string;
}): Promise<{
    typed: boolean;
    serial: string;
    length: number;
}>;
export declare function keyevent(input: UiTarget & {
    key: keyof typeof KEY_EVENTS;
}): Promise<{
    pressed: boolean;
    serial: string;
    key: "BACK" | "HOME" | "ENTER" | "APP_SWITCH" | "MENU" | "SEARCH";
}>;
export declare function parseUiAutomator(value: string): UiElement[];
export declare function inputText(value: string): string;
export {};
//# sourceMappingURL=ui.d.ts.map