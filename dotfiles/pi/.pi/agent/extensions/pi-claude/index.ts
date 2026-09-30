import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { writeDebugLog } from "./debug.js";
import { isPlainObject } from "./helpers.js";
import { transformPayload, unaliasToolCalls } from "./payload.js";

export default function piClaudeCodeUse(pi: ExtensionAPI): void {
	// Wire alias → pi tool name before the agent loop resolves the tool.
	pi.on("message_end", (event) => {
		const rewritten = unaliasToolCalls(event.message);
		if (!rewritten) return undefined;
		return { message: rewritten };
	});

	pi.on("before_provider_request", (event, ctx) => {
		const model = ctx.model;
		if (!model || model.provider !== "anthropic" || !ctx.modelRegistry.isUsingOAuth(model)) return undefined;
		if (!isPlainObject(event.payload)) return undefined;

		writeDebugLog({ stage: "before", payload: event.payload });
		const renameEnabled = process.env.PI_CLAUDE_CODE_USE_DISABLE_TOOL_RENAME !== "1";
		const transformed = transformPayload(event.payload, renameEnabled);
		writeDebugLog({ stage: "after", payload: transformed });
		return transformed;
	});
}
