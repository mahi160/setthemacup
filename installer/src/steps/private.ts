import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import * as p from '@clack/prompts';
import { exists, link } from '../lib/fs.ts';
import { FIELDS, PRIVATE_ENV, loadPrivateEnv, renderPrivateEnv } from '../lib/private.ts';
import type { Ctx, Step } from '../types.ts';

/** Private settings live in their own private GitHub repo, cloned here */
export const PRIVATE_DIR = dirname(PRIVATE_ENV);
export const PRIVATE_REPO_NAME = 'setthemacup-private';

/** Files in the private repo that are linked to where tools read them */
const LINKS: [string, string][] = [['local.zsh', '.config/zsh/local.zsh']];

/** git with gh as the credential helper: works over HTTPS before any SSH key is on GitHub */
const git = (ctx: Ctx, args: string[], progress?: (m: string) => void) =>
  ctx.sh.run('git', ['-c', 'credential.helper=', '-c', 'credential.helper=!gh auth git-credential', ...args], { onLine: progress });

async function ghLogin(ctx: Ctx): Promise<string> {
  if (!(await ctx.sh.ok('gh', ['auth', 'status', '--hostname', 'github.com']))) {
    await ctx.interactive('Log in to GitHub (personal account) to restore your private settings', () =>
      ctx.sh.run('gh', ['auth', 'login', '--hostname', 'github.com', '--git-protocol', 'ssh', '--skip-ssh-key', '--web', '--scopes', 'admin:public_key'], {
        interactive: true,
      }),
    );
  }
  return (await ctx.sh.capture('gh', ['api', 'user', '--jq', '.login'])).stdout.trim();
}

/** No private repo yet: ask for the values, write private.env, publish it as a new private repo. */
async function createFromPrompts(ctx: Ctx, repo: string): Promise<void> {
  if (ctx.yes) throw new Error(`no ${repo} on GitHub and --yes can't ask for values; run \`setup --only private\``);
  p.note(`No ${repo} on GitHub yet. Answer once; it's saved privately and restored on every other Mac.`, 'Private settings');
  const values: Record<string, string> = {};
  for (const f of FIELDS) {
    const answer = await p.text({
      message: f.message,
      initialValue: f.initial?.replace('$HOME', ctx.home) ?? '',
      validate: (v) => (f.required && !v?.trim() ? 'Required' : undefined),
    });
    if (p.isCancel(answer)) throw new Error('cancelled');
    values[f.key] = answer.trim();
  }
  if (ctx.dryRun) return;
  mkdirSync(PRIVATE_DIR, { recursive: true });
  writeFileSync(PRIVATE_ENV, renderPrivateEnv(values), { mode: 0o600 });
  await ctx.sh.run('git', ['init', '-q', '-b', 'main'], { cwd: PRIVATE_DIR });
  await ctx.sh.run('git', ['add', '-A'], { cwd: PRIVATE_DIR });
  await ctx.sh.run('git', ['commit', '-qm', 'Initial private settings'], { cwd: PRIVATE_DIR });
  await ctx.sh.run('gh', ['repo', 'create', repo, '--private', '--description', 'Private values for setthemacup', '--source', PRIVATE_DIR, '--remote', 'origin', '--push']);
}

export const privateSettings: Step = {
  id: 'private',
  title: 'Private settings',
  summary: 'Restore private.env, VPN gateways and local aliases from your private GitHub repo',
  details: [
    `Logs in with gh, then clones <you>/${PRIVATE_REPO_NAME} (private) to ~/.config/setthemacup over HTTPS`,
    'No such repo yet: asks for each value once, then creates the private repo from your answers',
    'Already cloned: pulls the latest',
    'Links local.zsh into ~/.config/zsh; the daily sync commits and pushes any changes',
  ],
  requires: ['gh', 'git'],

  async check(ctx) {
    if (!exists(PRIVATE_ENV)) return { state: 'missing', detail: 'no private.env' };
    if (!exists(join(PRIVATE_DIR, '.git'))) return { state: 'partial', detail: 'private.env not backed by a repo' };
    return { state: 'done', detail: 'cloned' };
  },

  /** Question phase: GitHub login, then clone the private repo (or ask once and create it). */
  async prepare(ctx) {
    if (exists(join(PRIVATE_DIR, '.git'))) return;
    if (ctx.yes) return ctx.warn('Private settings need a GitHub login; skipped under --yes. Run `setup --only private`.');
    const login = await ghLogin(ctx);
    const repo = `${login}/${PRIVATE_REPO_NAME}`;
    if (await ctx.sh.ok('gh', ['repo', 'view', repo, '--json', 'name'])) {
      await ctx.task(`Clone ${repo}`, async (progress) => {
        if (exists(PRIVATE_DIR)) {
          // A local private.env without a repo: adopt the repo, the repo wins
          await ctx.sh.run('git', ['init', '-q', '-b', 'main'], { cwd: PRIVATE_DIR });
          await ctx.sh.run('git', ['remote', 'add', 'origin', `https://github.com/${repo}.git`], { cwd: PRIVATE_DIR, allowFail: true });
          await git(ctx, ['-C', PRIVATE_DIR, 'fetch', '--quiet', 'origin'], progress);
          await ctx.sh.run('git', ['checkout', '-f', '-B', 'main', 'origin/main'], { cwd: PRIVATE_DIR });
        } else {
          await git(ctx, ['clone', '--progress', `https://github.com/${repo}.git`, PRIVATE_DIR], progress);
        }
      });
    } else {
      await createFromPrompts(ctx, repo);
    }
    // Later pushes (daily sync) authenticate through gh as well
    await ctx.sh.run('git', ['config', 'credential.helper', '!gh auth git-credential'], { cwd: PRIVATE_DIR, allowFail: true });
    if (!ctx.dryRun) ctx.env = loadPrivateEnv();
  },

  async run(ctx) {
    if (exists(join(PRIVATE_DIR, '.git'))) {
      await ctx.task('Pull private settings', async (progress) => {
        await git(ctx, ['-C', PRIVATE_DIR, 'pull', '--ff-only', '--quiet'], progress);
        return 'up to date';
      });
    }
    await ctx.task('Link private files', async () => {
      const linked = LINKS.filter(([file]) => exists(join(PRIVATE_DIR, file))).filter(([file, to]) => link(ctx, join(PRIVATE_DIR, file), join(ctx.home, to)));
      return linked.length ? linked.map(([f]) => f).join(', ') : 'all linked';
    });
    if (!ctx.dryRun) ctx.env = loadPrivateEnv();
  },
};
