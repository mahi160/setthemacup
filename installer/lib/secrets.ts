/**
 * Secrets asked once at the start of a run (Mac password, SSH passphrases), so the rest
 * runs unattended. Each lives in a 0600 file inside a 0700 temp folder, read only by
 * lib/askpass, and the folder is removed when the process exits for any reason.
 */
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

let dir: string | undefined;

/** Remove the folder however the process ends (normal exit, Ctrl-C, closed terminal). */
function track(folder: string): string {
  dir = folder;
  const cleanup = () => rmSync(folder, { recursive: true, force: true });
  process.on('exit', cleanup);
  for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) {
    process.on(sig, () => {
      cleanup();
      process.exit(130);
    });
  }
  return folder;
}

const folder = (): string => {
  if (dir) return dir;
  const created = mkdtempSync(join(tmpdir(), 'setthemacup-'));
  chmodSync(created, 0o700);
  return track(created);
};

/** Store a secret for this run; returns its file path (for SETTHEMACUP_SECRET_FILE). */
export function storeSecret(name: string, value: string): string {
  const path = join(folder(), name);
  writeFileSync(path, `${value}\n`, { mode: 0o600 });
  return path;
}

/** Is this the Mac login password? Checked with `sudo -S`, which never prompts. */
export function checkSudoPassword(password: string): boolean {
  spawnSync('sudo', ['-k']);
  return spawnSync('sudo', ['-S', '-v'], { input: `${password}\n`, stdio: ['pipe', 'ignore', 'ignore'] }).status === 0;
}

/**
 * The password file bootstrap.sh created (it needed sudo for Xcode CLT). Taken over so
 * it's deleted with everything else when this run ends.
 */
export function adoptSecretFile(path: string | undefined): string | undefined {
  if (!path || !existsSync(path) || dir) return undefined;
  track(dirname(path));
  return path;
}
