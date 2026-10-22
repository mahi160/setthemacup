import { join } from 'node:path';
import { BREW, BREW_PREFIX, brewEnv, hasBrew } from '../lib/brew.ts';
import { readText, writeFile } from '../lib/fs.ts';
import type { Step } from '../types.ts';

const SHELLENV = `eval "$(${BREW} shellenv)"`;

export const homebrew: Step = {
  id: 'homebrew',
  title: 'Homebrew',
  summary: 'Package manager everything else installs with',
  details: [
    'Installs Homebrew to /opt/homebrew (non-interactive, uses the sudo session)',
    'Adds `brew shellenv` to ~/.zprofile',
    `Removes group write on ${BREW_PREFIX}/share so oh-my-zsh's compaudit stays quiet`,
  ],
  required: true,

  async check() {
    return hasBrew() ? { state: 'done', detail: 'installed' } : { state: 'missing' };
  },

  async run(ctx) {
    if (!hasBrew()) {
      await ctx.task('Install Homebrew', async () => {
        await ctx.sh.bash('curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh | /bin/bash', {
          env: { NONINTERACTIVE: '1' },
        });
      });
    }
    brewEnv();

    await ctx.task('Load Homebrew in login shells', async () => {
      const zprofile = join(ctx.home, '.zprofile');
      const current = readText(zprofile) ?? '';
      if (current.includes('brew shellenv')) return 'already in ~/.zprofile';
      writeFile(ctx, zprofile, `${current}${current && !current.endsWith('\n') ? '\n' : ''}${SHELLENV}\n`);
      return 'added to ~/.zprofile';
    });

    await ctx.task('Fix completion directory permissions', async () => {
      await ctx.sh.run('chmod', ['g-w,o-w', `${BREW_PREFIX}/share`]);
    });
  },
};
