import { apps, names, taps, type AppKind } from '../data/apps.ts';
import * as brew from '../lib/brew.ts';
import type { Step } from '../types.ts';

function packages(id: string, title: string, kind: AppKind, summary: string): Step {
  const list = names(kind);
  return {
    id,
    title,
    summary,
    details: [
      `Installs ${list.length} ${kind === 'cask' ? 'casks' : 'formulae'} from installer/data/apps.ts in one batched \`brew install\``,
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

export const cliTools = packages('cli', 'CLI tools', 'formula', 'git, neovim, tmux, fzf, lazygit, gh, … (Homebrew formulae)');

export const guiApps = {
  ...packages('apps', 'GUI apps', 'cask', 'Ghostty, Brave, Tinycast, Slack, OrbStack, fonts, … (Homebrew casks)'),
  nextSteps: () => [
    'Open Tinycast → grant Accessibility → set its hotkey to ⌘Space',
    'Sign in: Slack, WhatsApp, Telegram, Brave sync, Tailscale; open OrbStack once',
  ],
} satisfies Step;
