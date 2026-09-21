function text(value) {
    return { content: [{ type: "text", text: value }] };
}
export function json(value) {
    return text(JSON.stringify(value, null, 2));
}
export function fail(value) {
    return {
        isError: true,
        content: [
            { type: "text", text: typeof value === "string" ? value : JSON.stringify(value, null, 2) },
        ],
    };
}
export function image(value, data, mimeType = "image/png") {
    return {
        content: [
            { type: "text", text: JSON.stringify(value, null, 2) },
            { type: "image", data, mimeType },
        ],
    };
}
