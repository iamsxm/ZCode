import { type Device } from "./device.js";
type Avd = {
    name: string;
};
type StartInput = {
    serial?: string;
    avd?: string;
    timeoutMs?: number;
};
type StartResult = Device & {
    reused: boolean;
    started: boolean;
};
export declare function listAvds(): Promise<Avd[]>;
export declare function parseAvds(value: string): Avd[];
export declare function ensureDevice(input?: StartInput): Promise<Device>;
export declare function startEmulator(input?: StartInput): Promise<StartResult>;
export declare function stopEmulator(input: {
    serial: string;
}): Promise<{
    stopped: boolean;
    serial: string;
}>;
export declare function createAvd(input?: {
    name?: string;
    packageId?: string;
    device?: string;
    force?: boolean;
}): Promise<{
    created: boolean;
    name: string;
    packageId: string;
    output: string;
}>;
export declare function startedEmulatorCandidates(devices: Device[], before: Set<string>): Device[];
export {};
//# sourceMappingURL=avd.d.ts.map