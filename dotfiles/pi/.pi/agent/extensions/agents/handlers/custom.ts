/**
 * handlers/custom.ts — Custom subagent invocation.
 *
 * Two entry points:
 * 1. User: /sub <template> "task" [--model provider/id]
 * 2. LLM: custom_agent tool with task, paths, maxFiles, model?
 *
 * /sub without args lists available templates.
 * Can invoke agents from both fast-commands.json and subagents.json.
 */

import type { ExtensionAPI, ExtensionCommandContext, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { runCommand, runWithWidget } from "../../shared/command-runner";
import {
  buildMessage,
  buildPromptWithParams,
  resolveModelWithOverride,
  type SubagentConfig,
  type Model,
} from "../../shared/spawn-subagent";
import type { FastCommand } from "./command";

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseSubCommand(args: string): { template: string; task: string; model?: string } {
  const parts = args.trim().split(/\s+/);
  let template = "";
  let task = "";
  let model: string | undefined;

  let i = 0;
  while (i < parts.length) {
    if (parts[i] === "--model" && i + 1 < parts.length) {
      model = parts[++i];
      i++;
    } else if (!template) {
      template = parts[i++]!;
    } else {
      task += (task ? " " : "") + parts[i++];
    }
  }

  return { template, task, model };
}

// ── Extension ─────────────────────────────────────────────────────────────────

export function registerCustom(
  pi: ExtensionAPI,
  fastCommands: FastCommand[],
  subagents: SubagentConfig[],
  models: Model[],
): void {
  // Built once at registration — not per invocation
  const allAgents = [
    ...fastCommands.map((fc) => ({ name: fc.name, label: fc.label, description: fc.description })),
    ...subagents.map((sa) => ({ name: sa.name, label: sa.label, description: sa.description })),
  ];

  function findAgent(name: string): { cmd?: FastCommand; subagent?: SubagentConfig } {
    return {
      cmd: fastCommands.find((fc) => fc.name === name),
      subagent: subagents.find((sa) => sa.name === name),
    };
  }

  // ── /sub command ─────────────────────────────────────────────────────────────

  pi.registerCommand("sub", {
    description: "Run any agent template manually: /sub <template> \"task\" [--model provider/id]",
    handler: async (args: string, ctx: ExtensionCommandContext) => {
      const { template, task, model: modelOverride } = parseSubCommand(args);

      if (!template) {
        ctx.ui.notify(
          `Available agents:\n${allAgents.map((a) => `• ${a.name}: ${a.description}`).join("\n")}\n\nUsage: /sub <template> "task" [--model provider/id]`,
          "info",
        );
        return;
      }

      const agent = findAgent(template);
      if (!agent.cmd && !agent.subagent) {
        ctx.ui.notify(`Agent "${template}" not found`, "error");
        return;
      }
      if (!task) {
        ctx.ui.notify(`Usage: /sub ${template} "task" [--model provider/id]`, "error");
        return;
      }

      await ctx.waitForIdle();

      const model = await resolveModelWithOverride(ctx, models, modelOverride);
      if (!model) {
        ctx.ui.notify("No model available", "error");
        return;
      }

      try {
        const src = agent.cmd ?? agent.subagent!;
        const prompt = agent.cmd
          ? buildMessage(agent.cmd)
          : buildPromptWithParams(agent.subagent!, { task });

        const { exitCode, fullText } = await runCommand({ agent: src, model, prompt, ctx });

        if (exitCode === 0) {
          ctx.ui.notify(`✓ ${template}: ${fullText.split("\n")[0]?.slice(0, 100)}`, "success");
        } else {
          ctx.ui.notify(`✗ ${template} failed`, "error");
        }
      } catch (err) {
        ctx.ui.notify(`Error running ${template}: ${String(err)}`, "error");
      }
    },
  });

  // ── custom_agent tool ─────────────────────────────────────────────────────────

  pi.registerTool({
    name: "custom_agent",
    label: "Custom Agent",
    description: "Run any agent (fast command or template) with a custom task and optional model override",
    promptSnippet: "Use to spawn an agent for analysis, review, exploration, or any configured template",
    parameters: Type.Object({
      template: Type.String({
        description: 'Agent name (e.g., "scout", "review", "security", "commit", "pr"). See available agents.',
      }),
      task: Type.String({ description: "Task or question for the agent to execute" }),
      paths: Type.Optional(Type.Array(Type.String(), { description: "Optional paths to focus on" })),
      maxFiles: Type.Optional(Type.Number({ description: "Max files to report. Default 20" })),
      model: Type.Optional(Type.String({ description: 'Override model: "provider/id"' })),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const { template, task, paths, maxFiles, model: modelOverride } = params as {
        template: string;
        task: string;
        paths?: string[];
        maxFiles?: number;
        model?: string;
      };

      const agent = findAgent(template);
      if (!agent.cmd && !agent.subagent) {
        return {
          isError: true,
          content: [{ type: "text", text: `Agent "${template}" not found. Available: ${allAgents.map((a) => a.name).join(", ")}` }],
        };
      }

      const model = await resolveModelWithOverride(ctx as unknown as ExtensionContext, models, modelOverride);
      if (!model) {
        return { isError: true, content: [{ type: "text", text: "No model available" }] };
      }

      const src = agent.cmd ?? agent.subagent!;
      const prompt = agent.cmd
        ? buildMessage(agent.cmd)
        : buildPromptWithParams(agent.subagent!, { task, paths, maxFiles });

      const { exitCode, fullText } = await runWithWidget({
        agent: src,
        model,
        prompt,
        signal,
        ctx: ctx as unknown as { ui: { setWidget(...a: unknown[]): void } },
        tools: src.tools,
      });

      if (exitCode === 0) {
        return { content: [{ type: "text", text: fullText }], details: { model, template } };
      }
      return {
        isError: true,
        content: [{ type: "text", text: fullText || `Agent "${template}" failed with exit ${exitCode}` }],
        details: { exitCode, model, template },
      };
    },
  });
}
