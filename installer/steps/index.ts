import type { Step } from '../types.ts';
import { ai } from './ai.ts';
import { dotfiles } from './dotfiles.ts';
import { extras } from './extras.ts';
import { flowd } from './flowd.ts';
import { gitSsh } from './git-ssh.ts';
import { homebrew } from './homebrew.ts';
import { macos } from './macos.ts';
import { neovim } from './neovim.ts';
import { cliTools, guiApps } from './packages.ts';

/**
 * Run order. CLI tools and config come first so the shell is usable early;
 * slow GUI installs go late; macOS settings last (they restart Dock/Finder).
 */
export const steps: Step[] = [homebrew, cliTools, dotfiles, gitSsh, neovim, ai, extras, flowd, guiApps, macos];
