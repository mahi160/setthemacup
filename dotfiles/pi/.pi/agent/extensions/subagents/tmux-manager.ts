import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export function isInsideTmux(): boolean {
  return !!process.env.TMUX;
}

/**
 * Creates a new tmux pane for the given command and ensures it closes automatically upon completion.
 */
export async function runInNewTmuxPane(
  command: string,
  windowName: string = "subagents"
): Promise<string> {
  // Ensure the target window exists
  try {
    await execAsync(`tmux select-window -t "${windowName}"`);
  } catch (e) {
    await execAsync(`tmux new-window -d -n "${windowName}"`);
  }

  // Create pane and get its ID
  const { stdout } = await execAsync(
    `tmux split-window -h -P -t "${windowName}" -F "#{pane_id}"`
  );
  const paneId = stdout.trim();

  // Run command, then kill pane when done
  // We use `&&` to ensure kill-pane runs even if the command fails
  await execAsync(
    `tmux send-keys -t "${paneId}" "${command.replace(/"/g, '\\"')} && tmux kill-pane -t ${paneId}" C-m`
  );

  return paneId;
}
