import { join } from 'node:path';
import { SKILLS_CLI, skills } from '../data/skills.ts';
import { exists } from '../lib/fs.ts';
import type { Ctx, Step } from '../types.ts';

const PI = '@earendil-works/pi-coding-agent';
const skillDir = (ctx: Ctx, name: string) => join(ctx.home, '.agents/skills', name);
const allSkills = () => skills.flatMap((s) => s.skills);

export const ai: Step = {
  id: 'ai',
  title: 'AI (pi + skills)',
  summary: 'pi coding agent (latest) and agent skills',
  details: [
    `\`pnpm add -g ${PI}\` (unpinned: always the latest); pi installs its own packages from settings.json on first start`,
    `Skills via \`npx ${SKILLS_CLI} add <repo> --skill … -g --agent pi\` into ~/.agents/skills:`,
    ...skills.map((s) => `${s.repo}: ${s.skills.join(', ')}`),
  ],

  async check(ctx) {
    const hasPi = await ctx.sh.has('pi');
    const missing = allSkills().filter((n) => !exists(skillDir(ctx, n)));
    if (hasPi && !missing.length) return { state: 'done', detail: `pi + ${allSkills().length} skills` };
    return {
      state: !hasPi && missing.length === allSkills().length ? 'missing' : 'partial',
      detail: [hasPi ? '' : 'pi missing', missing.length ? `${missing.length} skills missing` : ''].filter(Boolean).join(', '),
    };
  },

  async run(ctx) {
    await ctx.task('pi coding agent', async () => {
      await ctx.sh.run('pnpm', ['add', '--global', PI]);
    });
    for (const source of skills) {
      const todo = source.skills.filter((n) => !exists(skillDir(ctx, n)));
      await ctx.task(`Skills: ${source.repo}`, async () => {
        if (!todo.length) return 'installed';
        await ctx.sh.run('npx', ['--yes', SKILLS_CLI, 'add', source.repo, ...todo.flatMap((n) => ['--skill', n]), '--global', '--agent', 'pi', '--yes']);
        return todo.join(', ');
      });
    }
  },

  nextSteps: () => ['Run `a` (pi) and `/login` to connect your Claude account'],
};
