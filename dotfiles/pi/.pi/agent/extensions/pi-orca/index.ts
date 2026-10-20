/**
 * pi-orca: the main session (orchestrator) keeps every tool and gains `delegate`, which hands one
 * self-contained subtask to a child pi on a cheaper model. The orchestrator picks the role; each
 * role has a fixed model, thinking level, and tool set (no router model in between, see docs/adr/0007).
 *
 * On by default. `/orca` toggles the `delegate` tool (and the prompt guidelines that come with it).
 * Children get PI_CHILD=1 and skip this extension, so delegation never nests.
 */

import { StringEnum } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { type AskAnswer, type AskRequest, CHILD_ENV, runChildPi, showAskDialog } from "../lib/child-pi.ts";

const TOOL = "delegate";
const MAX_OUTPUT_CHARS = 20_000;

interface Role {
	model: string;
	thinking: string;
	tools?: string; // omit for full tool access
	prompt: string;
}

const ROLES = {
	scout: {
		model: "anthropic/claude-haiku-5-5",
		thinking: "low",
		tools: "read,grep,find,ls",
		prompt: `Read-only investigation. Do not modify files.
Return only what the caller needs: file paths with line numbers, relevant signatures or short snippets, direct answers.
No process narration. If evidence is missing, say so instead of guessing.`,
	},
	tester: {
		model: "anthropic/claude-haiku-5-5",
		thinking: "medium",
		tools: "read,grep,find,ls,bash",
		prompt: `Run the checks the task names (tests, lint, typecheck). Do not modify files.
Report each command you ran and whether it passed.
For each failure: check or test name, file:line, and the shortest decisive error line. Never paste full logs.`,
	},
	coder: {
		model: "anthropic/claude-sonnet-5-5",
		thinking: "high",
		prompt: `Implement exactly the change the task specifies. Read a file before editing it. Follow the existing repo style.
Add no scope, refactors, or comments the task does not ask for. Do not commit.
When done, report the changed files with one line per change, and anything you could not do and why.`,
	},
	reviewer: {
		model: "anthropic/claude-sonnet-5-5",
		thinking: "high",
		tools: "read,grep,find,ls,bash",
		prompt: `Review the uncommitted changes (\`git diff\` and \`git diff --staged\`) against the intent stated in the task. Do not modify files.
Report only real problems, most severe first: bugs, missed requirements, broken edge cases, security issues.
For each: file:line, the problem, a concrete fix. If there are none, reply "no issues".`,
	},
} satisfies Record<string, Role>;

type RoleName = keyof typeof ROLES;

const DelegateParams = Type.Object({
	role: StringEnum(Object.keys(ROLES) as RoleName[], {
		description: "scout: read-only search; tester: run checks; coder: implement a spec; reviewer: review the diff",
	}),
	task: Type.String({
		description:
			"Self-contained task. The worker sees none of this conversation: include goal, file paths, constraints, and how to check the result.",
	}),
});

/** Run `fn` after every earlier call on the same queue has settled. */
function makeQueue() {
	let tail: Promise<unknown> = Promise.resolve();
	return <T>(fn: () => Promise<T>): Promise<T> => {
		const next = tail.then(fn);
		tail = next.catch(() => {});
		return next;
	};
}

export default function (pi: ExtensionAPI) {
	if (process.env[CHILD_ENV]) return;

	// coders share the working tree; dialogs share the screen
	const coderQueue = makeQueue();
	const askQueue = makeQueue();

	pi.registerTool({
		name: TOOL,
		label: "Delegate",
		description:
			"Hand one self-contained subtask to a cheaper worker in a separate pi process. Returns the worker's final report.",
		promptSnippet: "delegate: hand a subtask to a cheaper worker (scout, tester, coder, reviewer)",
		promptGuidelines: [
			"Use `delegate` scout for reading-heavy exploration: many files, large files, unknown layout. Read yourself only the code you will edit.",
			"Use `delegate` tester to run tests, lint, or typecheck; it returns failures only.",
			"Use `delegate` coder for routine, well-specified changes: renames, boilerplate, mechanical multi-file edits. Make small or tricky edits yourself.",
			"Workers see none of this conversation. Give each task its goal, file paths, constraints, and acceptance check.",
			"After a non-trivial change: tester once, then one reviewer on the final diff. Skip the reviewer for trivial changes.",
			"Check a coder's work with `git diff`; never trust its summary alone.",
			"If a worker fails the same task twice, do it yourself.",
			"Independent scout, tester, and reviewer calls can run in parallel. Coder calls run one at a time.",
		],
		parameters: DelegateParams,

		async execute(_toolCallId, params, signal, onUpdate, ctx) {
			const role: Role = ROLES[params.role];
			const header = `${params.role} · ${role.model.split("/").pop()} · ${role.thinking}`;
			const progress = (line: string) =>
				onUpdate?.({ content: [{ type: "text", text: `${header}: ${line}` }], details: undefined });

			const run = () =>
				runChildPi({
					task: `${role.prompt}\n\nTask:\n${params.task}`,
					cwd: ctx.cwd,
					model: role.model,
					thinking: role.thinking,
					tools: role.tools,
					signal,
					onLog: progress,
					onTool: (label) => label && progress(label),
					onText: () => {},
					onAsk: (req: AskRequest): Promise<AskAnswer> =>
						ctx.hasUI ? askQueue(() => showAskDialog(ctx.ui, req)) : Promise.resolve({ cancelled: true }),
				});

			const { text, error, usage } = params.role === "coder" ? await coderQueue(run) : await run();
			const body = error ? `${header} failed: ${error}` : text || "(no output)";
			const output =
				body.length > MAX_OUTPUT_CHARS
					? `${body.slice(0, MAX_OUTPUT_CHARS)}\n\n[truncated: ${body.length - MAX_OUTPUT_CHARS} chars omitted]`
					: body;
			return { content: [{ type: "text", text: output }], details: undefined, usage, isError: !!error };
		},
	});

	pi.registerCommand("orca", {
		description: "Toggle orca delegation (the delegate tool)",
		handler: async (_args, ctx) => {
			const active = pi.getActiveTools();
			const on = active.includes(TOOL);
			pi.setActiveTools(on ? active.filter((t) => t !== TOOL) : [...active, TOOL]);
			ctx.ui.notify(`orca ${on ? "off" : "on"}`, "info");
		},
	});
}
