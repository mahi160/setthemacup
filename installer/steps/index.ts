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
import { privateSettings } from './private.ts';

/**
 * Run order. CLI tools first (gh is needed to restore private settings), then config, so the shell is usable early;
 * slow GUI installs go late; macOS settings last (they restart Dock/Finder).
 */
export const steps: Step[] = [homebrew, cliTools, privateSettings, dotfiles, gitSsh, neovim, ai, extras, flowd, guiApps, macos];
