import { join } from 'node:path';
import { exists } from '../lib/fs.ts';
import type { Step } from '../types.ts';

export const neovim: Step = {
  id: 'nvim',
  title: 'Neovim',
  summary: 'LazyVim plugins synced headlessly',
  details: ['Runs `nvim --headless "+Lazy! sync"` then `"+Lazy! clean"` against the stowed LazyVim config', 'Mason installs language servers on first interactive start'],
  requires: ['neovim', 'git', 'ripgrep', 'fd', 'tree-sitter-cli'],

  async check(ctx) {
    return exists(join(ctx.home, '.local/share/nvim/lazy/LazyVim'))
      ? { state: 'done', detail: 'plugins installed' }
      : { state: 'missing' };
  },

  async run(ctx) {
    await ctx.task('Sync plugins (first run takes a few minutes)', async (progress) => {
      await ctx.sh.run('nvim', ['--headless', '+Lazy! sync', '+qa'], { onLine: progress });
    });
    await ctx.task('Clean removed plugins', async () => {
      await ctx.sh.run('nvim', ['--headless', '+Lazy! clean', '+qa']);
    });
  },

  nextSteps: () => ['Run `v` once and let Mason finish installing language servers'],
};
