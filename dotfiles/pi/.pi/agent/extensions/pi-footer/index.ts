import { readFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import type {
	ExtensionAPI,
	ExtensionContext,
	ReadonlyFooterDataProvider,
	ToolCallEvent,
} from "@earendil-works/pi-coding-agent";

const MODEL_NAMES_PATH = resolve(
	dirname(fileURLToPath(import.meta.url)),
	"model-names.json",
);

function loadModelNames(): Record<string, string> {
	try {
		return JSON.parse(readFileSync(MODEL_NAMES_PATH, "utf8"));
	} catch {
		return {};
	}
}

const MODEL_NAMES = loadModelNames();

// only yolo mode shown above the editor.
const ALLOWED_STATUS_KEYS = new Set(["pi-permission-system"]);

const ANSI_RE = /\x1b\[[0-9;]*m/g;

function visibleWidth(s: string): number {
	return s.replace(ANSI_RE, "").length;
}

function truncateToWidth(s: string, width: number, ellipsis = ""): string {
	const stripped = s.replace(ANSI_RE, "");
	if (stripped.length <= width) return s;
	const keep = Math.max(0, width - ellipsis.length);
	return stripped.slice(0, keep) + ellipsis;
}

function fitLeftRight(
	left: string,
	right: string,
	width: number,
): { left: string; paddedRight: string } {
	const minPadding = 2;
	let leftPart = left;
	let leftWidth = visibleWidth(leftPart);
	if (leftWidth > width) {
		leftPart = truncateToWidth(leftPart, width, "...");
		leftWidth = visibleWidth(leftPart);
	}
	const rightWidth = visibleWidth(right);
	if (leftWidth + minPadding + rightWidth <= width) {
		return {
			left: leftPart,
			paddedRight: " ".repeat(width - leftWidth - rightWidth) + right,
		};
	}
	const availableForRight = width - leftWidth - minPadding;
	if (availableForRight <= 0) return { left: leftPart, paddedRight: "" };
	const truncatedRight = truncateToWidth(right, availableForRight, "");
	return {
		left: leftPart,
		paddedRight:
			" ".repeat(Math.max(0, width - leftWidth - visibleWidth(truncatedRight))) +
			truncatedRight,
	};
}

function formatTokens(count: number): string {
	if (count < 1000) return count.toString();
	if (count < 10000) return `${(count / 1000).toFixed(1)}k`;
	if (count < 1000000) return `${Math.round(count / 1000)}k`;
	if (count < 10000000) return `${(count / 1000000).toFixed(1)}M`;
	return `${Math.round(count / 1000000)}M`;
}

function shortenPath(path: string, maxSegments = 2): string {
	const parts = path.split(sep).filter(Boolean);
	if (parts.length <= maxSegments) return path;
	const prefix = path.startsWith(sep) ? sep : "";
	return `${prefix}…${sep}${parts.slice(-maxSegments).join(sep)}`;
}

function formatCwdForFooter(cwd: string, home: string | undefined): string {
	if (!home) return shortenPath(cwd);
	const resolvedCwd = resolve(cwd);
	const resolvedHome = resolve(home);
	const relativeToHome = relative(resolvedHome, resolvedCwd);
	const isInsideHome =
		relativeToHome === "" ||
		(relativeToHome !== ".." &&
			!relativeToHome.startsWith(`..${sep}`) &&
			!isAbsolute(relativeToHome));
	if (!isInsideHome) return shortenPath(cwd);
	return relativeToHome === "" ? "~" : `~${sep}${shortenPath(relativeToHome)}`;
}

function formatDuration(ms: number): string {
	const totalSeconds = Math.max(0, Math.floor(ms / 1000));
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;
	if (hours > 0) return `${hours}h${String(minutes).padStart(2, "0")}m`;
	if (minutes > 0) return `${minutes}m${String(seconds).padStart(2, "0")}s`;
	return `${seconds}s`;
}

function getSessionElapsed(ctx: ExtensionContext): string | undefined {
	const entries = ctx.sessionManager.getEntries();
	if (entries.length === 0) return undefined;
	const firstUser = entries.find(
		(entry) => entry.type === "message" && entry.message.role === "user",
	);
	if (!firstUser) return undefined;
	const lastEntry = entries[entries.length - 1];
	const start = Date.parse(firstUser.timestamp);
	const end = Date.parse(lastEntry.timestamp);
	if (Number.isNaN(start) || Number.isNaN(end)) return undefined;
	return formatDuration(end - start);
}

function sanitizeStatusText(text: string): string {
	return text
		.replace(/[\r\n\t]/g, " ")
		.replace(/ +/g, " ")
		.trim();
}

interface UsageTotals {
	input: number;
	output: number;
	cacheRead: number;
	cacheWrite: number;
	cost: number;
}

const READ_TOOLS = new Set(["read", "grep", "find", "ls"]);
const WRITE_TOOLS = new Set(["write", "edit"]);
const BASH_TOOLS = new Set(["bash", "powershell"]);
const WEB_TOOLS = new Set([
	"web_search",
	"fetch_content",
	"get_search_content",
	"source_check",
]);

interface ToolCallCounts {
	read: number;
	write: number;
	bash: number;
	web: number;
}

export default function (pi: ExtensionAPI) {
	let ctx: ExtensionContext | undefined;
	// setWidget's factory has no footerData param; capture it from setFooter instead.
	let footerData: ReadonlyFooterDataProvider | undefined;
	const toolCallCounts: ToolCallCounts = { read: 0, write: 0, bash: 0, web: 0 };

	pi.on("tool_call", (event: ToolCallEvent) => {
		if (READ_TOOLS.has(event.toolName)) toolCallCounts.read++;
		else if (WRITE_TOOLS.has(event.toolName)) toolCallCounts.write++;
		else if (BASH_TOOLS.has(event.toolName)) toolCallCounts.bash++;
		else if (WEB_TOOLS.has(event.toolName)) toolCallCounts.web++;
	});

	pi.on("session_start", (_event, eventCtx) => {
		ctx = eventCtx;
		toolCallCounts.read = 0;
		toolCallCounts.write = 0;
		toolCallCounts.bash = 0;
		toolCallCounts.web = 0;

		eventCtx.ui.setFooter((_tui, theme, data) => {
			footerData = data;
			return {
				invalidate() {},
				render(width: number): string[] {
					if (!ctx) return [];

					const usageTotals: UsageTotals = {
						input: 0,
						output: 0,
						cacheRead: 0,
						cacheWrite: 0,
						cost: 0,
					};
					let latestCacheHitRate: number | undefined;
					for (const entry of ctx.sessionManager.getEntries()) {
						let usage:
							| {
									input: number;
									output: number;
									cacheRead: number;
									cacheWrite: number;
									cost: { total: number };
							  }
							| undefined;
						if (entry.type === "message" && entry.message.role === "assistant") {
							usage = entry.message.usage;
						} else if (
							entry.type === "message" &&
							entry.message.role === "toolResult" &&
							entry.message.usage
						) {
							usage = entry.message.usage;
						} else if (
							(entry.type === "branch_summary" || entry.type === "compaction") &&
							entry.usage
						) {
							usage = entry.usage;
						}
						if (!usage) continue;
						usageTotals.input += usage.input;
						usageTotals.output += usage.output;
						usageTotals.cacheRead += usage.cacheRead;
						usageTotals.cacheWrite += usage.cacheWrite;
						usageTotals.cost += usage.cost.total;
						if (entry.type === "message" && entry.message.role === "assistant") {
							const promptTokens = usage.input + usage.cacheRead + usage.cacheWrite;
							latestCacheHitRate =
								promptTokens > 0 ? (usage.cacheRead / promptTokens) * 100 : undefined;
						}
					}

					const contextUsage = ctx.getContextUsage();
					const contextWindow =
						contextUsage?.contextWindow ?? ctx.model?.contextWindow ?? 0;
					const contextPercentValue = contextUsage?.percent ?? 0;
					const contextPercent =
						contextUsage?.percent == null ? "?" : contextPercentValue.toFixed(1);

					const upDown: string[] = [];
					if (usageTotals.input) upDown.push(`↑${formatTokens(usageTotals.input)}`);
					if (usageTotals.output)
						upDown.push(`↓${formatTokens(usageTotals.output)}`);

					const cache: string[] = [];
					if (usageTotals.cacheRead)
						cache.push(`R${formatTokens(usageTotals.cacheRead)}`);
					if (usageTotals.cacheWrite)
						cache.push(`W${formatTokens(usageTotals.cacheWrite)}`);

					let cacheHitStr = "";
					if (
						(usageTotals.cacheRead > 0 || usageTotals.cacheWrite > 0) &&
						latestCacheHitRate !== undefined
					) {
						cacheHitStr = `CH${latestCacheHitRate.toFixed(1)}%`;
					}

					const costStr = usageTotals.cost ? `$${usageTotals.cost.toFixed(3)}` : "";

					const contextDisplay =
						contextPercent === "?"
							? `?/${formatTokens(contextWindow)}`
							: `${contextPercent}%/${formatTokens(contextWindow)}`;
					let contextStr: string;
					if (contextPercentValue > 90)
						contextStr = theme.fg("error", contextDisplay);
					else if (contextPercentValue > 70)
						contextStr = theme.fg("warning", contextDisplay);
					else contextStr = contextDisplay;

					const statsLine = [
						upDown.join(" "),
						cache.join(" "),
						cacheHitStr,
						costStr,
						contextStr,
					]
						.filter((g) => g.length > 0)
						.join(" · ");

					const modelId = ctx.model?.id ?? "no-model";
					const displayName = MODEL_NAMES[modelId] ?? modelId;
					let modelInfo = `${ctx.model?.provider ?? "unknown"} · ${displayName}`;
					if (ctx.model?.reasoning) {
						modelInfo += ` · ${ctx.thinkingLevel ?? "off"}`;
					}

					const { left, paddedRight } = fitLeftRight(statsLine, modelInfo, width);
					return [theme.fg("dim", left) + theme.fg("dim", paddedRight), ""];
				},
			};
		});

		eventCtx.ui.setWidget(
			"pi-footer-pwd",
			(_tui, theme) => ({
				invalidate() {},
				render(width: number): string[] {
					if (!ctx) return [];

					let file = formatCwdForFooter(
						ctx.cwd,
						process.env.HOME || process.env.USERPROFILE,
					);
					const branch = footerData?.getGitBranch();
					if (branch) file = `${file} (${branch})`;
					const sessionName = ctx.sessionManager.getSessionName();
					if (sessionName) file = `${file} • ${sessionName}`;

					const elapsed = getSessionElapsed(ctx);
					const toolStats = [
						toolCallCounts.read ? `R${toolCallCounts.read}` : "",
						toolCallCounts.write ? `W${toolCallCounts.write}` : "",
						toolCallCounts.bash ? `B${toolCallCounts.bash}` : "",
						toolCallCounts.web ? `I${toolCallCounts.web}` : "",
					]
						.filter((g) => g.length > 0)
						.join(" ");

					const badges = [
						toolStats,
						elapsed,
						...Array.from(footerData?.getExtensionStatuses() ?? [])
							.filter(([key]) => ALLOWED_STATUS_KEYS.has(key))
							.map(([, text]) => sanitizeStatusText(text)),
					]
						.filter((g): g is string => Boolean(g))
						.join(" ");

					const right = badges
						? `${badges} ${theme.fg("dim", file)}`
						: theme.fg("dim", file);
					const { paddedRight } = fitLeftRight("", right, width);
					return [paddedRight];
				},
			}),
			{ placement: "aboveEditor" },
		);
	});
}
