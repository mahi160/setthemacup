/**
 * The JSON manifests in this folder: what the installer installs. Edited by hand
 * and by the daily sync (`setup --sync`), so they are JSON, not TypeScript.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = import.meta.dirname;

export interface Package {
  /** Tap-qualified (owner/tap/name) for third-party taps */
  name: string;
  category: string;
  desc: string;
}

export interface SkillSource {
  repo: string;
  skills: string[];
  desc: string;
}

export interface Manifest {
  formulae: Package[];
  casks: Package[];
  /** pnpm global packages */
  pnpm: Package[];
  skills: SkillSource[];
}

export interface Ignore {
  formulae: string[];
  casks: string[];
  skills: string[];
  pnpm: string[];
}

/** Category for items the sync adds — re-file them by hand */
export const INBOX = 'Inbox';

const read = <T>(file: string): T => JSON.parse(readFileSync(join(DIR, file), 'utf8')) as T;

/** One entry per line keeps diffs readable when the sync edits a file. */
function write(file: string, obj: Record<string, object[]>): void {
  const body = Object.entries(obj)
    .map(([k, list]) => `  "${k}": [\n${list.map((o) => `    ${JSON.stringify(o)}`).join(',\n')}\n  ]`)
    .join(',\n');
  writeFileSync(join(DIR, file), `{\n${body}\n}\n`);
}

export function loadManifest(): Manifest {
  const apps = read<{ formulae: Package[]; casks: Package[] }>('apps.json');
  return {
    formulae: apps.formulae,
    casks: apps.casks,
    pnpm: read<{ globals: Package[] }>('pnpm.json').globals,
    skills: read<{ sources: SkillSource[] }>('skills.json').sources,
  };
}

export function saveManifest(m: Manifest): void {
  write('apps.json', { formulae: m.formulae, casks: m.casks });
  write('pnpm.json', { globals: m.pnpm });
  write('skills.json', { sources: m.skills });
}

export const loadIgnore = (): Ignore => read<Ignore>('sync-ignore.json');
