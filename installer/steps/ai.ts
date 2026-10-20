import { join } from 'node:path';
import { SKILLS_CLI, skills } from '../data/skills.ts';
import { exists } from '../lib/fs.ts';
import type { Ctx, Step } from '../types.ts';

const skillDir = (ctx: Ctx, name: string) => join(ctx.home, '.agents/skills', name);
const allSkills = () => skills.flatMap((s) => s.skills);

export const ai: Step = {
  id: 'ai',
  title: 'AI skills',
  summary: 'Agent skills for pi (pi itself is a pnpm global under CLI tools)',
  details: [
    `Skills via \`npx ${SKILLS_CLI} add <repo> --skill … -g --agent pi\` into ~/.agents/skills:`,
    ...skills.map((s) => `${s.repo}: ${s.skills.join(', ')}`),
  ],

  async check(ctx) {
    const missing = allSkills().filter((n) => !exists(skillDir(ctx, n)));
    if (!missing.length) return { state: 'done', detail: `${allSkills().length} skills` };
    return { state: missing.length === allSkills().length ? 'missing' : 'partial', detail: `${missing.length} of ${allSkills().length} missing` };
  },

  async run(ctx) {
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
