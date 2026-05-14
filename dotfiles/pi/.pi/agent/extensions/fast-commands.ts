/**
 * fast-commands.ts
 *
 * Registers fast-model commands that switch to a cheap model,
 * run the task, then restore the original model.
 * Tries Haiku first, falls back to Gemini Flash Lite.
 * On error: notifies user, then restores regardless.
 *
 * Commands:
 *   /commit      — generate conventional commit message and commit
 *   /pr          — create a pull request via gh
 *   /standup     — generate standup from recent git activity
 *   /explain     — explain a file or symbol
 */

import type { AssistantMessage, Model } from "@earendil-works/pi-ai";
import type {
  ExtensionAPI,
  ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent";

const FAST_MODELS = [
  { provider: "anthropic", id: "claude-haiku-4-5" },
  { provider: "google",    id: "gemini-3.1-flash-lite-preview" },
];

// ── shared helper ─────────────────────────────────────────────────────────────

function registerFastCommand(
  pi: ExtensionAPI,
  name: string,
  description: string,
  buildPrompt: (args: string) => string,
) {
  pi.registerCommand(name, {
    description: `${description} (haiku → gemini fallback)`,
    handler: async (args: string, ctx: ExtensionCommandContext) => {
      await ctx.waitForIdle();

      // Try each fast model in order
      let fastModel: Model | undefined;
      let fastModelId = "";
      for (const candidate of FAST_MODELS) {
        const found = ctx.modelRegistry.find(candidate.provider, candidate.id);
        if (!found) continue;

        const switched = await pi.setModel(found);
        if (switched) {
          fastModel = found;
          fastModelId = found.id;
          break;
        }
        ctx.ui.notify(`No API key for ${candidate.id}, trying next…`, "info");
      }

      if (!fastModel) {
        ctx.ui.notify(
          `No fast model available. Tried: ${FAST_MODELS.map(m => m.id).join(", ")}`,
          "error",
        );
        return;
      }

      const previousModel = ctx.model;
      ctx.ui.notify(`⚡ Switched to ${fastModelId} for /${name}`, "info");

      // Register one-time listener to restore after agent completes
      const handleRestore = async (event: any, restoreCtx: any) => {
        pi.off("agent_end", handleRestore);
        
        // Check for errors before restoring
        const errMsg = (event.messages as AssistantMessage[])
          .filter(m => m.role === "assistant")
          .find(m => m.stopReason === "error" || m.stopReason === "aborted");

        if (errMsg) {
          restoreCtx.ui.notify(
            `/${name} failed: ${errMsg.errorMessage ?? errMsg.stopReason}`,
            "error",
          );
        }

        // Restore original model
        const success = await pi.setModel(previousModel);
        if (success) {
          restoreCtx.ui.notify(`↩ Restored model: ${previousModel.id}`, "info");
        }
      };
      pi.on("agent_end", handleRestore);

      pi.sendUserMessage(buildPrompt(args));
    },
  });
}

// ── extension ─────────────────────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {

  // /commit
  registerFastCommand(pi, "commit", "Generate and apply a conventional commit", (_args) => `
Role: Tech Lead.

Task:

1. Run \`git diff --cached\` to get the staged changes.
2. If result is empty, ask the user to stage changes and stop there.
3. If not, only then analyze the staged diff via \`git diff --cached\`
4. Generate a conventional commit message following the specification:
   - Format: \`type(scope): subject\`
   - Types allowed: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert
   - Subject: Imperative mood, lowercase, no period, max 50 characters
   - Body (if needed): Wrap at 72 characters, explain _why_ not _how_. Keep it short. Preferably one liner
   - Footer: Flag breaking changes with \`BREAKING CHANGE:\`
5. If you see multiple completely different scopes, use your best judgement to decide which one to commit.
6. Commit the changes with the generated message and body
`);

  // /pr
  registerFastCommand(pi, "pr", "Create a pull request", (_args) => `
Role: Senior Engineer.

Task:

1. Run \`git remote get-url origin\` to identify the repo.
2. Run \`git diff main...HEAD\` to get all changes on this branch.
3. Run \`git log main...HEAD --oneline\` to get the commit history.
4. Generate a pull request with:
   - **Title**: Concise, imperative, max 72 chars
   - **Body**:
     - ## What
       One paragraph summary of what changed
     - ## Why
       Why this change was needed
     - ## How
       Key implementation decisions worth noting (skip if obvious)
     - ## Testing
       How to verify the changes work
5. Run \`gh pr create --title "..." --body "..."\` to create the PR.
`);

  // /standup
  registerFastCommand(pi, "standup", "Generate daily standup from git activity", (_args) => `
Role: Engineer writing a daily standup.

Task:

1. Run \`git log --since="24 hours ago" --oneline --author="$(git config user.name)"\`.
2. Run \`git diff HEAD~5...HEAD --stat\` for recent file changes.
3. Summarize into standup format:
   - **Yesterday**: what was done (from commits)
   - **Today**: what's next (infer from WIP or last commit direction)
   - **Blockers**: none unless context suggests otherwise
4. Keep it short — 3-5 bullet points max. No fluff.
`);

  // /explain
  registerFastCommand(pi, "explain", "Explain a file or symbol", (args) => `
Role: Senior Engineer explaining to a smart peer.

Task:

1. ${args ? `Read or find: ${args}` : "Explain the last code discussed in context."}
2. Explain:
   - **What it does** — one sentence summary
   - **How it works** — key logic, data flow, important decisions
   - **Why it exists** — the problem it solves
   - **Gotchas** — non-obvious behavior, edge cases, performance traps
3. Keep it tight. No padding. Use code snippets only when they clarify.
`);

}
