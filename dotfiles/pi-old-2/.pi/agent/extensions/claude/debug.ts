import { appendFileSync } from "node:fs";

const debugLogPath = process.env.PI_CLAUDE_CODE_USE_DEBUG_LOG;

export function writeDebugLog(payload: unknown): void {
	if (!debugLogPath) return;
	try {
		appendFileSync(
			debugLogPath,
			`${new Date().toISOString()}\n${JSON.stringify(payload, null, 2)}\n---\n`,
			"utf-8",
		);
	} catch {
		// Debug logging must never break actual requests
	}
}
