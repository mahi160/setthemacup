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

import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { runCommand } from "../../shared/command-runner";
import { spawnCleanSession, buildMessage as buildSubagentMessage, type SubagentConfig, type Model } from "../../shared/spawn-subagent";

export interface FastCommand {
  name: string;
  label: string;
  icon: string;
  description: string;
  thinking: string;
  tools: string[];
  role: string;
  prompt: string | string[];
  output?: "notify" | "file";
}

export interface CustomHandlerOptions {
  subagents: SubagentConfig[];
  models: Model[];
}

// Helper: replace {task}, {paths}, {maxFiles} in prompt
function buildPromptWithParams(
  agent: SubagentConfig,
  params: { task: string; paths?: string[]; maxFiles?: number },
): string {
  const body = Array.isArray(agent.prompt)
    ? agent.prompt.join("\n")
    : agent.prompt;
  let result = body;
  result = result.replaceAll("{task}", params.task);
  result = result.replaceAll(
    "{paths}",
    params.paths?.length ? params.paths.join(", ") : "none provided",
  );
  result = result.replaceAll("{maxFiles}", String(params.maxFiles ?? 20));
  return `Role: ${agent.role}.\n\n${result}`;
}

// Helper: parse /sub command args
function parseSubCommand(args: string): { template?: string; task?: string; model?: string } {
  const parts = args.trim().split(/\s+/);
  let template = "";
  let task = "";
  let model = "";

  let i = 0;
  while (i < parts.length) {
    if (parts[i] === "--model" && i + 1 < parts.length) {
      model = parts[++i];
      i++;
    } else if (!template) {
      template = parts[i];
      i++;
    } else {
      task += (task ? " " : "") + parts[i];
      i++;
    }
  }

  return { template, task, model };
}

// Helper: resolve model
async function resolveModel(
  ctx: ExtensionCommandContext,
  models: Model[],
  modelOverride?: string,
): Promise<Model | undefined> {
  if (modelOverride) {
    const [provider, id] = modelOverride.split("/");
    if (provider && id) {
      return models.find((m) => m.provider === provider && m.id === id);
    }
  }

  for (const candidate of models) {
    const key = await ctx.modelRegistry.getApiKeyForProvider(
      candidate.provider,
    );
    if (key) {
      return candidate;
    }
  }

  return models[0];
}

/**
 * Register /sub command and custom_agent tool.
 * Can invoke agents from both fast-commands.json and subagents.json.
 */
export function registerCustom(
  pi: ExtensionAPI,
  fastCommands: FastCommand[],
  subagents: SubagentConfig[],
  models: Model[],
): void {
  // All available agents: fast commands + templates
  const allAgents = [
    ...fastCommands.map((fc) => ({ name: fc.name, label: fc.label, description: fc.description })),
    ...subagents.map((sa) => ({ name: sa.name, label: sa.label, description: sa.description })),
  ];

  // Helper to find agent in either config
  function findAgent(name: string): { cmd?: FastCommand; subagent?: SubagentConfig } {
    return {
      cmd: fastCommands.find((fc) => fc.name === name),
      subagent: subagents.find((sa) => sa.name === name),
    };
  }

  // /sub command
  pi.registerCommand("sub", {
    description: "Run any agent template manually: /sub <template> \"task\" [--model provider/id]",
    handler: async (args: string, ctx: ExtensionCommandContext) => {
      const { template, task, model: modelOverride } = parseSubCommand(args);

      if (!template) {
        // List all available agents
        const templates = allAgents
          .map((a) => `• ${a.name}: ${a.description}`)
          .join("\n");
        ctx.ui.notify(
          `Available agents:\n${templates}\n\nUsage: /sub <template> "task" [--model provider/id]`,
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
        ctx.ui.notify(
          `Usage: /sub ${template} "task" [--model provider/id]`,
          "error",
        );
        return;
      }

      await ctx.waitForIdle();

      const resolvedModel = await resolveModel(ctx, models, modelOverride);
      if (!resolvedModel) {
        ctx.ui.notify(`No model available`, "error");
        return;
      }

      try {
        if (agent.cmd) {
          // Fast command agent
          const prompt = buildMessage({
            name: agent.cmd.name,
            label: agent.cmd.label,
            description: agent.cmd.description,
            role: agent.cmd.role,
            prompt: agent.cmd.prompt,
            thinking: agent.cmd.thinking,
            tools: agent.cmd.tools,
            icon: agent.cmd.icon,
          });
          const { exitCode, fullText } = await runCommand({
            agent: {
              name: agent.cmd.name,
              label: agent.cmd.label,
              description: agent.cmd.description,
              role: agent.cmd.role,
              prompt: agent.cmd.prompt,
              thinking: agent.cmd.thinking,
              tools: agent.cmd.tools,
              icon: agent.cmd.icon,
            },
            model: resolvedModel,
            prompt,
            ctx,
          });
          if (exitCode === 0) {
            ctx.ui.notify(
              `✓ ${template}: ${fullText.split("\n")[0]?.slice(0, 100)}`,
              "success",
            );
          } else {
            ctx.ui.notify(`✗ ${template} failed`, "error");
          }
        } else if (agent.subagent) {
          // Template agent
          const prompt = buildPromptWithParams(agent.subagent, { task });
          const { exitCode, fullText } = await runCommand({
            agent: agent.subagent,
            model: resolvedModel,
            prompt,
            ctx,
          });
          if (exitCode === 0) {
            ctx.ui.notify(
              `✓ ${template}: ${fullText.split("\n")[0]?.slice(0, 100)}`,
              "success",
            );
          } else {
            ctx.ui.notify(`✗ ${template} failed`, "error");
          }
        }
      } catch (err) {
        ctx.ui.notify(`Error running ${template}: ${String(err)}`, "error");
      }
    },
  });

  // custom_agent tool (for LLM)
  pi.registerTool({
    name: "custom_agent",
    label: "Custom Agent",
    description:
      "Run any agent (fast command or template) with a custom task and optional model override",
    promptSnippet:
      "Use to spawn an agent for analysis, review, exploration, or any configured template",
    parameters: Type.Object({
      template: Type.String({
        description:
          'Agent name (e.g., "scout", "review", "security", "commit", "pr"). See available agents.',
      }),
      task: Type.String({
        description: "Task or question for the agent to execute",
      }),
      paths: Type.Optional(
        Type.Array(Type.String(), {
          description: "Optional paths to focus on",
        }),
      ),
      maxFiles: Type.Optional(
        Type.Number({
          description: "Max files to report. Default 20",
        }),
      ),
      model: Type.Optional(
        Type.String({
          description: 'Override model: "provider/id" (e.g., "google/gemini-flash-lite-latest")',
        }),
      ),
    }),
    async execute(toolCallId, params, signal, _onUpdate, ctx) {
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
          content: [
            {
              type: "text",
              text: `Agent "${template}" not found. Available: ${allAgents.map((a) => a.name).join(", ")}`,
            },
          ],
        };
      }

      const model = await (async () => {
        if (modelOverride) {
          const [provider, id] = modelOverride.split("/");
          if (provider && id) {
            return models.find((m) => m.provider === provider && m.id === id);
          }
        }
        for (const candidate of models) {
          const key = await ctx.modelRegistry.getApiKeyForProvider(
            candidate.provider,
          );
          if (key) {
            return candidate;
          }
        }
        return models[0];
      })();

      if (!model) {
        return {
          isError: true,
          content: [{ type: "text", text: "No model available" }],
        };
      }

      const widgetState = {
        spinnerFrame: 0,
        elapsedMs: 0,
        currentTool: "",
        toolCount: 0,
        recentText: [] as string[],
        retrying: false,
        retryAttempt: 0,
      };

      if (agent.cmd) {
        // Fast command agent
        const prompt = buildMessage({
          name: agent.cmd.name,
          label: agent.cmd.label,
          description: agent.cmd.description,
          role: agent.cmd.role,
          prompt: agent.cmd.prompt,
          thinking: agent.cmd.thinking,
          tools: agent.cmd.tools,
          icon: agent.cmd.icon,
        });
        const { exitCode, fullText } = await spawnCleanSession(
          `${model.provider}/${model.id}`,
          agent.cmd.thinking ?? "low",
          prompt,
          signal,
          widgetState,
          () => {},
          agent.cmd.tools,
        );

        if (exitCode === 0) {
          return {
            content: [{ type: "text", text: fullText }],
            details: { model, template, tools: agent.cmd.tools },
          };
        } else {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: fullText || `Agent "${template}" failed with exit ${exitCode}`,
              },
            ],
            details: { exitCode, model, template },
          };
        }
      } else if (agent.subagent) {
        // Template agent
        const tools = agent.subagent.tools ?? ["read", "grep", "find", "ls"];
        const prompt = buildPromptWithParams(agent.subagent, { task, paths, maxFiles });
        const { exitCode, fullText } = await spawnCleanSession(
          `${model.provider}/${model.id}`,
          agent.subagent.thinking ?? "low",
          prompt,
          signal,
          widgetState,
          () => {},
          tools,
        );

        if (exitCode === 0) {
          return {
            content: [{ type: "text", text: fullText }],
            details: { model, template, tools },
          };
        } else {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: fullText || `Agent "${template}" failed with exit ${exitCode}`,
              },
            ],
            details: { exitCode, model, template },
          };
        }
      }

      return {
        isError: true,
        content: [{ type: "text", text: `Unknown error for agent "${template}"` }],
      };
    },
  });
}

// Helper to build SubagentConfig from FastCommand
function buildMessage(cmd: {
  name: string;
  label: string;
  description: string;
  role: string;
  prompt: string | string[];
  thinking: string;
  tools: string[];
  icon: string;
}): string {
  const body = Array.isArray(cmd.prompt) ? cmd.prompt.join("\n") : cmd.prompt;
  return `Role: ${cmd.role}.\n\n${body}`;
}
