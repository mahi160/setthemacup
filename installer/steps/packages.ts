import { apps, names, pnpmGlobals, taps, type AppKind } from '../data/apps.ts';
import * as brew from '../lib/brew.ts';
import type { Shell } from '../lib/sh.ts';
import type { Step } from '../types.ts';

/** pnpm global packages that aren't installed */
export async function missingGlobals(sh: Shell): Promise<string[]> {
  const r = await sh.capture('pnpm', ['ls', '--global', '--depth=0', '--json']);
  let have = new Set<string>();
  try {
    have = new Set((JSON.parse(r.stdout || '[]') as { dependencies?: Record<string, unknown> }[]).flatMap((e) => Object.keys(e.dependencies ?? {})));
  } catch {
    // treat as none installed
  }
  return pnpmGlobals.map((p) => p.name).filter((n) => !have.has(n));
}

function packages(id: string, title: string, kind: AppKind, summary: string): Step {
  const list = names(kind);
  return {
    id,
    title,
    summary,
    details: [
      `Installs ${list.length} ${kind === 'cask' ? 'casks' : 'formulae'} from installer/data/apps.json in one batched \`brew install\``,
      'Taps third-party taps first; retries one by one if the batch fails',
      ...[...new Set(apps.filter((a) => a.kind === kind).map((a) => a.category))].map(
        (c) => `${c}: ${apps.filter((a) => a.kind === kind && a.category === c).map((a) => brew.shortName(a.name)).join(', ')}`,
      ),
    ],

    async check(ctx) {
      const todo = await brew.missing(ctx.sh, kind, list);
      if (!todo.length) return { state: 'done', detail: `${list.length} installed` };
      return {
        state: todo.length === list.length ? 'missing' : 'partial',
        detail: `${todo.length} of ${list.length} missing`,
      };
    },

    async run(ctx) {
      await brew.update(ctx);
      await brew.tap(ctx, taps(kind));
      await brew.install(ctx, kind, list, `Install ${kind === 'cask' ? 'apps' : 'tools'}`);
    },
  };
}

const formulae = packages('cli', 'CLI tools', 'formula', 'git, neovim, tmux, fzf, lazygit, gh, … (Homebrew formulae) + pnpm globals (pi)');

/** Formulae plus pnpm global packages (pnpm.json): both are "tools on PATH". */
export const cliTools: Step = {
  ...formulae,
  details: [...formulae.details, `pnpm globals (latest, \`pnpm add -g\`): ${pnpmGlobals.map((p) => p.name).join(', ')}`],

  async check(ctx) {
    const [brew, globals] = await Promise.all([formulae.check(ctx), missingGlobals(ctx.sh)]);
    if (!globals.length) return brew;
    return { state: brew.state === 'missing' ? 'missing' : 'partial', detail: [brew.state === 'done' ? '' : brew.detail, `${globals.length} pnpm globals missing`].filter(Boolean).join(', ') };
  },

  async run(ctx) {
    await formulae.run(ctx);
    await ctx.task('pnpm globals', async (progress) => {
      // Always `add`: unpinned globals (pi) should move to the latest on every run
      await ctx.sh.run('pnpm', ['add', '--global', ...pnpmGlobals.map((p) => p.name)], { onLine: progress });
      return pnpmGlobals.map((p) => p.name).join(', ');
    });
  },
};

export const guiApps = {
  ...packages('apps', 'GUI apps', 'cask', 'Ghostty, Brave, Tinycast, Slack, OrbStack, fonts, … (Homebrew casks)'),
  nextSteps: () => [
    'Open Tinycast → grant Accessibility → set its hotkey to ⌘Space',
    'Sign in: Slack, WhatsApp, Telegram, Brave sync, Tailscale; open OrbStack once',
  ],
} satisfies Step;
