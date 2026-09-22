import { callBrokerMethod } from "./broker.js";

export function createComputerUseRuntime(options = {}) {
  return {
    async execute(input) {
      const socketPath = options.brokerSocketPath?.trim();
      if (!socketPath) throw new Error("Computer Use is unavailable for this node_repl session");
      const raw = input.arguments;
      const params = raw && typeof raw === "object" && !Array.isArray(raw)
        ? { ...raw, context: input.context }
        : { input: raw, context: input.context };
      const result = await callBrokerMethod({ socketPath, method: input.toolName, params });
      return result && typeof result === "object" && Array.isArray(result.content)
        ? result
        : { content: [{ type: "text", text: JSON.stringify(result ?? null) }], structuredContent: result };
    },
    async closeSession() {},
    async dispose() {},
  };
}
