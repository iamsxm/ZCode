export function androidApiLevel() {
    return intEnv("ANDROID_PLUGIN_API_LEVEL", 35);
}
export function androidBuildToolsVersion() {
    return stringEnv("ANDROID_PLUGIN_BUILD_TOOLS_VERSION", "35.0.0");
}
export function androidSystemImageVariant() {
    return stringEnv("ANDROID_PLUGIN_SYSTEM_IMAGE_VARIANT", "default");
}
export function androidSystemImageAbi() {
    return stringEnv("ANDROID_PLUGIN_SYSTEM_IMAGE_ABI", process.arch === "arm64" ? "arm64-v8a" : "x86_64");
}
export function androidSystemImagePackage() {
    return `system-images;android-${androidApiLevel()};${androidSystemImageVariant()};${androidSystemImageAbi()}`;
}
export function javaMajorVersion() {
    return stringEnv("ANDROID_PLUGIN_JDK_MAJOR", "17");
}
function stringEnv(name, fallback) {
    const value = process.env[name]?.trim();
    return value || fallback;
}
function intEnv(name, fallback) {
    const value = process.env[name]?.trim();
    if (!value)
        return fallback;
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
