import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir, hostname } from 'node:os';
import { join } from 'node:path';

/**
 * Private, machine-local values: identities, work paths, private repos.
 * Lives outside the (public) repo; template: private.env.example.
 */
export const PRIVATE_ENV = join(homedir(), '.config/setthemacup/private.env');

export interface Field {
  key: string;
  message: string;
  /** Default, with $HOME left literal */
  initial?: string;
  required?: boolean;
}

export const FIELDS: Field[] = [
  { key: 'GIT_NAME', message: 'GitHub username', required: true },
  { key: 'GIT_EMAIL', message: 'Personal git email', required: true },
  { key: 'WORK_GIT_NAME', message: 'Work git name (empty = no work identity)' },
  { key: 'WORK_GIT_EMAIL', message: 'Work git email' },
  { key: 'WORK_DIR', message: 'Folder that holds work repos', initial: '$HOME/Documents/Coding/Work' },
  { key: 'WORK_SSH_HOST', message: 'Work GitHub SSH host alias', initial: 'work.github.com' },
  { key: 'WORK_SSH_KEY', message: 'Work SSH key file name in ~/.ssh', initial: 'work_ed25519' },
  { key: 'NOTES_JOURNAL_DIR', message: 'Quick-notes folder', initial: '$HOME/Documents/Notes/QuickNotes' },
  { key: 'NOTES_PROJECT_DIR', message: 'Project notes vault (optional)' },
  { key: 'SMB_SHARES', message: 'SMB shares to auto-mount, "name=smb://host" space separated (optional)' },
  { key: 'FLOWD_JOURNAL_REMOTE', message: 'flowd journal repo, e.g. git@github.com:you/journal.git (optional)' },
  { key: 'FLOWD_MACHINE', message: 'flowd machine folder', initial: hostname().split('.')[0]?.toLowerCase() },
];

/** Source the file with bash so `$HOME` and quoting behave exactly as in the shell. */
export function loadPrivateEnv(path = PRIVATE_ENV): Record<string, string> {
  if (!existsSync(path)) return {};
  // Only variables the file defines: diff the variable list before and after sourcing
  const script = [
    'before=" $(compgen -v | tr "\\n" " ") "',
    'set -a; source "$1" >/dev/null; set +a',
    'for k in $(compgen -v); do',
    '  [[ $k =~ ^[A-Z][A-Z0-9_]*$ && $k != PIPESTATUS && $before != *" $k "* ]] && printf "%s=%s\\0" "$k" "${!k}"',
    'done; true',
  ].join('\n');
  const out = execFileSync('/bin/bash', ['-c', script, '_', path], {
    env: { HOME: homedir(), PATH: '/usr/bin:/bin' },
    encoding: 'utf8',
  });
  const env: Record<string, string> = {};
  for (const pair of out.split('\0')) {
    const i = pair.indexOf('=');
    if (i > 0) env[pair.slice(0, i)] = pair.slice(i + 1);
  }
  return env;
}

/** Render answers as a sourceable file; values under $HOME keep the literal `$HOME`. */
export function renderPrivateEnv(values: Record<string, string>): string {
  const home = homedir();
  const lines = ['# Private, machine-local values for setthemacup. Never committed.', '# Template: ~/.setup/private.env.example'];
  for (const { key } of FIELDS) {
    const v = (values[key] ?? '').replace(home, '$HOME').replace(/["\\`]/g, '\\$&');
    lines.push(`${key}="${v}"`);
  }
  return `${lines.join('\n')}\n`;
}
