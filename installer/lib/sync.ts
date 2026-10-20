/**
 * Daily sync: keep the manifests in step with what you install or remove by hand.
 *
 * Compares what's installed now with what was installed at the previous sync:
 *   added   = installed now, not at the last sync, not in the manifest  → appended (category Inbox)
 *   removed = in the manifest, installed at the last sync, gone now     → dropped
 * The first run only records a baseline, so packages already on the Mac (or
 * dropped from the manifest on purpose but not uninstalled) are never re-added.
 * It edits the JSON and notifies; committing is up to you.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { INBOX, loadIgnore, loadManifest, saveManifest, type Ignore, type Manifest, type Package } from '../data/manifest.ts';
import { BREW } from './brew.ts';
import type { Shell } from './sh.ts';

export interface Inventory {
  formulae: string[];
  casks: string[];
  pnpm: string[];
  /** skill name → source repo */
  skills: Record<string, string>;
}

type Kind = 'formulae' | 'casks' | 'pnpm' | 'skills';
const KINDS: Kind[] = ['formulae', 'casks', 'pnpm', 'skills'];

export type Changes = Record<Kind, { added: string[]; removed: string[] }>;

export const STATE = join(homedir(), '.local/state/setthemacup/sync-state.json');

const skillLock = () =>
  process.env.XDG_STATE_HOME ? join(process.env.XDG_STATE_HOME, 'skills/.skill-lock.json') : join(homedir(), '.agents/.skill-lock.json');

const lines = (s: string) => s.split('\n').map((l) => l.trim()).filter(Boolean);

export async function inventory(sh: Shell): Promise<Inventory> {
  const [leaves, casks, pnpm] = await Promise.all([
    sh.capture(BREW, ['leaves', '--installed-on-request']),
    sh.capture(BREW, ['list', '--cask', '--full-name']),
    sh.capture('pnpm', ['ls', '--global', '--depth=0', '--json']),
  ]);
  if (!leaves.ok || !casks.ok) throw new Error('could not list Homebrew packages');
  let globals: string[] = [];
  try {
    const parsed = JSON.parse(pnpm.stdout || '[]') as { dependencies?: Record<string, unknown> }[];
    globals = parsed.flatMap((e) => Object.keys(e.dependencies ?? {}));
  } catch {
    // pnpm missing or no globals
  }
  const skills: Record<string, string> = {};
  if (existsSync(skillLock())) {
    const lock = JSON.parse(readFileSync(skillLock(), 'utf8')) as { skills?: Record<string, { source?: string }> };
    for (const [name, entry] of Object.entries(lock.skills ?? {})) skills[name] = entry.source ?? '';
  }
  return { formulae: lines(leaves.stdout), casks: lines(casks.stdout), pnpm: globals, skills };
}

const inManifest = (m: Manifest, kind: Kind): Set<string> =>
  new Set(kind === 'skills' ? m.skills.flatMap((s) => s.skills) : m[kind].map((p) => p.name));

const listOf = (inv: Inventory, kind: Kind): string[] => (kind === 'skills' ? Object.keys(inv.skills) : inv[kind]);

/** Pure: what changed since the previous inventory. No previous = baseline only. */
export function diff(manifest: Manifest, current: Inventory, previous: Inventory | undefined, ignore: Ignore): Changes {
  const changes = {} as Changes;
  for (const kind of KINDS) {
    const now = new Set(listOf(current, kind));
    const before = new Set(previous ? listOf(previous, kind) : listOf(current, kind));
    const listed = inManifest(manifest, kind);
    const skip = new Set(ignore[kind]);
    changes[kind] = {
      added: [...now].filter((n) => !before.has(n) && !listed.has(n) && !skip.has(n)),
      removed: [...listed].filter((n) => before.has(n) && !now.has(n) && !skip.has(n)),
    };
  }
  return changes;
}

export type Describe = (kind: 'formulae' | 'casks' | 'pnpm', names: string[]) => Promise<Record<string, string>>;

/** Pure apart from `describe`: the manifest with changes applied. */
export async function apply(m: Manifest, c: Changes, current: Inventory, describe: Describe): Promise<Manifest> {
  const next: Manifest = structuredClone(m);
  for (const kind of ['formulae', 'casks', 'pnpm'] as const) {
    const gone = new Set(c[kind].removed);
    next[kind] = next[kind].filter((p) => !gone.has(p.name));
    if (c[kind].added.length) {
      const descs = await describe(kind, c[kind].added);
      next[kind].push(...c[kind].added.map((name): Package => ({ name, category: INBOX, desc: descs[name] ?? '' })));
    }
  }
  const goneSkills = new Set(c.skills.removed);
  next.skills = next.skills.map((s) => ({ ...s, skills: s.skills.filter((n) => !goneSkills.has(n)) })).filter((s) => s.skills.length);
  for (const name of c.skills.added) {
    const repo = current.skills[name] || 'unknown';
    const source = next.skills.find((s) => s.repo === repo);
    if (source) source.skills.push(name);
    else next.skills.push({ repo, skills: [name], desc: INBOX });
  }
  return next;
}

export const brewDescribe =
  (sh: Shell): Describe =>
  async (kind, names) => {
    const out: Record<string, string> = {};
    if (kind === 'pnpm') {
      for (const n of names) out[n] = (await sh.capture('npm', ['view', n, 'description'])).stdout.trim();
      return out;
    }
    const r = await sh.capture(BREW, ['info', '--json=v2', kind === 'casks' ? '--cask' : '--formula', ...names]);
    try {
      const info = JSON.parse(r.stdout) as {
        formulae?: { name: string; full_name: string; desc?: string }[];
        casks?: { token: string; full_token: string; desc?: string }[];
      };
      for (const f of info.formulae ?? []) out[f.full_name] = out[f.name] = f.desc ?? '';
      for (const c of info.casks ?? []) out[c.full_token] = out[c.token] = c.desc ?? '';
    } catch {
      // descriptions are best-effort
    }
    return out;
  };

export const summarize = (c: Changes): string => {
  const part = (label: string, key: 'added' | 'removed') => {
    const all = KINDS.flatMap((k) => c[k][key]);
    return all.length ? `${label} ${all.join(', ')}` : '';
  };
  return [part('Added', 'added'), part('Removed', 'removed')].filter(Boolean).join(' · ');
};

const readState = (): Inventory | undefined =>
  existsSync(STATE) ? (JSON.parse(readFileSync(STATE, 'utf8')) as Inventory) : undefined;

/** Run one sync. Returns the human summary ('' when nothing changed). */
export async function sync(sh: Shell, opts: { dryRun?: boolean } = {}): Promise<{ summary: string; baseline: boolean }> {
  const current = await inventory(sh);
  const previous = readState();
  const manifest = loadManifest();
  const changes = diff(manifest, current, previous, loadIgnore());
  const summary = summarize(changes);
  if (!opts.dryRun) {
    if (summary) saveManifest(await apply(manifest, changes, current, brewDescribe(sh)));
    mkdirSync(dirname(STATE), { recursive: true });
    writeFileSync(STATE, `${JSON.stringify(current, null, 2)}\n`);
  }
  return { summary, baseline: !previous };
}
