export type Device = {
    serial: string;
    state: string;
    kind: "emulator" | "device";
    model?: string;
    product?: string;
    device?: string;
    transportId?: string;
    raw: string;
};
export declare function validSerial(serial: string): boolean;
export declare function listDevices(): Promise<Device[]>;
export declare function parseAdbDevices(value: string): Device[];
export declare function pickDevice(input?: {
    serial?: string;
}): Promise<Device>;
export declare function adbShell(serial: string, args: string[], timeout?: number): Promise<import("../lib/run.js").Run>;
export declare function adbShellCommand(args: string[]): string;
export declare function isBootComplete(serial: string): Promise<boolean>;
//# sourceMappingURL=device.d.ts.map