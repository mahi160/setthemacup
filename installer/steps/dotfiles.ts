import { join } from 'node:path';
import { exists, link, readText } from '../lib/fs.ts';
import { plan, stow, type StowOptions } from '../lib/stow.ts';
import type { Ctx, Step } from '../types.ts';

/** dotfiles/<pkg> → $HOME. ssh is linked by the Git + SSH step. */
const PACKAGES: [string, StowOptions?][] = [
  ['zsh', { noFolding: true }], // ~/.config/zsh stays real: OMZ plugins are cloned into it
  ['git'],
  ['ghostty'],
  ['tmux'],
  ['nvim'],
  ['lazygit'],
  ['fastfetch'],
  ['pi'],
  ['stow'],
];

const OMZ_PLUGINS = ['zsh-users/zsh-autosuggestions', 'zsh-users/zsh-syntax-highlighting', 'zsh-users/zsh-completions'];
const DEFAULT_THEME = 'kanagawa-wave';

const omzDir = (ctx: Ctx) => join(ctx.home, '.oh-my-zsh');
const pluginDir = (ctx: Ctx, repo: string) => join(ctx.home, '.config/zsh/plugins', repo.split('/')[1]!);
const clone = (ctx: Ctx, repo: string, dir: string) =>
  ctx.sh.run('git', ['clone', '--quiet', '--depth=1', `https://github.com/${repo}.git`, dir]);

export const dotfiles: Step = {
  id: 'dotfiles',
  title: 'Dotfiles + theme',
  summary: 'oh-my-zsh, then link zsh, git, ghostty, tmux, nvim, lazygit, fastfetch, pi configs',
  details: [
    'Clones oh-my-zsh to ~/.oh-my-zsh and zsh-autosuggestions, zsh-syntax-highlighting, zsh-completions into ~/.config/zsh/plugins',
    `Links dotfiles/{${PACKAGES.map(([p]) => p).join(',')}} into $HOME with GNU stow`,
    'Real files in the way are moved to ~/.setup-backup/<date>/ (paths kept), never overwritten',
    `Creates the theme links (\`theme\` state in ~/.config/theme, default ${DEFAULT_THEME})`,
  ],
  requires: ['stow', 'git'],

  async check(ctx) {
    const missing: string[] = [];
    if (!exists(omzDir(ctx))) missing.push('oh-my-zsh');
    for (const repo of OMZ_PLUGINS) if (!exists(pluginDir(ctx, repo))) missing.push(repo.split('/')[1]!);
    if (!(await ctx.sh.has('stow'))) return { state: 'missing', detail: 'stow not installed' };
    for (const [pkg, opts] of PACKAGES) {
      const p = await plan(ctx, pkg, opts);
      if (p.links || p.conflicts.length) missing.push(pkg);
    }
    if (!exists(join(ctx.home, '.config/theme'))) missing.push('theme');
    if (!missing.length) return { state: 'done', detail: 'all linked' };
    return { state: missing.length > PACKAGES.length ? 'missing' : 'partial', detail: `to do: ${missing.join(', ')}` };
  },

  async run(ctx) {
    await ctx.task('oh-my-zsh', async () => {
      if (exists(omzDir(ctx))) return 'already installed (updates itself every 14 days)';
      await clone(ctx, 'ohmyzsh/ohmyzsh', omzDir(ctx));
    });

    await ctx.task('oh-my-zsh plugins', async () => {
      const todo = OMZ_PLUGINS.filter((r) => !exists(pluginDir(ctx, r)));
      for (const repo of todo) await clone(ctx, repo, pluginDir(ctx, repo));
      return todo.length ? `cloned ${todo.length}` : 'all present';
    });

    for (const [pkg, opts] of PACKAGES) {
      await ctx.task(`Link ${pkg}`, () => stow(ctx, pkg, opts));
    }

    await ctx.task('Theme links', async () => {
      const current = readText(join(ctx.home, '.config/theme'))?.trim() || DEFAULT_THEME;
      await ctx.sh.run(join(ctx.repo, 'bin/theme'), [current, '--no-reload']);
      return current;
    });

    // `setup` itself, so it works before Extras links the rest of bin/
    link(ctx, join(ctx.repo, 'bin/setup'), join(ctx.home, '.local/bin/setup'));
  },

  nextSteps: () => [
    'Open a new Ghostty window to load oh-my-zsh and the prompt',
    'Allow Ghostty in System Settings → Privacy & Security → Accessibility, so `theme` can live-reload it',
  ],
};
