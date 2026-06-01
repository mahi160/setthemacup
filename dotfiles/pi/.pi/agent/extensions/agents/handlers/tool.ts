/**
 * handlers/tool.ts — LLM tools for predefined templates.
 *
 * Registers: scout, review, tests, security, research, etc.
 * These are called by the LLM during conversation.
 * Each spawns a clean session with parameter injection ({task}, {paths}, {maxFiles}).
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { runWithWidget } from "../../shared/command-runner";
import { buildPromptWithParams, resolveModel, type SubagentConfig, type Model } from "../../shared/spawn-subagent";

export interface ToolHandlerOptions {
  subagents: SubagentConfig[];
  models: Model[];
}



/**
 * Register template tools (scout, review, tests, security, research, etc).
 * LLM can call these during conversation.
 */
export function registerTools(
  pi: ExtensionAPI,
  subagents: SubagentConfig[],
  models: Model[],
): void {
  let concurrentCount = 0;
  const MAX_CONCURRENT = 3;

  // All agents in subagents.json are templates (scout, review, tests, security)
  for (const agent of subagents) {

    pi.registerTool({
      name: agent.name,
      label: agent.label,
      description: agent.description,
      promptSnippet: agent.description,
      promptGuidelines: agent.promptGuidelines,
      parameters: Type.Object({
        task: Type.String({
          description: "Specific task or codebase question for this agent",
        }),
        paths: Type.Optional(
          Type.Array(Type.String(), {
            description: "Optional paths to focus on",
          }),
        ),
        maxFiles: Type.Optional(
          Type.Number({
            description: "Max relevant files to report. Default 20",
          }),
        ),
      }),
      async execute(toolCallId, params, signal, _onUpdate, ctx) {
        // Check concurrent limit
        if (concurrentCount >= MAX_CONCURRENT) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: `Max ${MAX_CONCURRENT} concurrent tools reached. Please wait.`,
              },
            ],
          };
        }

        concurrentCount++;

        try {
          const model = await resolveModel(ctx, models);
          if (!model) {
            return {
              isError: true,
              content: [{ type: "text", text: "No model available" }],
            };
          }

          const tools = agent.tools ?? ["read", "grep", "find", "ls"];
          const prompt = buildPromptWithParams(agent, params);

          const { exitCode, fullText } = await runWithWidget({
            agent,
            model,
            prompt,
            signal,
            ctx,
            tools,
          });

          if (exitCode === 0) {
            return {
              content: [{ type: "text", text: fullText }],
              details: { model, tools },
            };
          } else {
            return {
              isError: true,
              content: [
                {
                  type: "text",
                  text: fullText || `Tool failed with exit ${exitCode}`,
                },
              ],
              details: { exitCode, model },
            };
          }
        } finally {
          concurrentCount--;
        }
      },
    });
  }
}
