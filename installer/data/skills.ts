/**
 * Agent skills, installed with `npx skills add <repo> --skill … -g --agent pi`
 * into ~/.agents/skills (outside this repo).
 */

export interface SkillSource {
  repo: string;
  skills: string[];
  desc: string;
}

export const skills: SkillSource[] = [
  { repo: 'vercel-labs/skills', skills: ['find-skills'], desc: 'Find and install more skills' },
  { repo: 'Leonxlnx/taste-skill', skills: ['design-taste-frontend'], desc: 'Frontend design taste' },
  { repo: 'GoogleChrome/modern-web-guidance', skills: ['modern-web-guidance'], desc: "Chrome team's modern web guidance" },
  {
    repo: 'mattpocock/skills',
    skills: [
      'grill-me',
      'to-spec',
      'to-tickets',
      'tdd',
      'diagnosing-bugs',
      'triage',
      'implement',
      'code-review',
      'improve-codebase-architecture',
      'setup-matt-pocock-skills',
    ],
    desc: 'Agentic engineering workflow',
  },
];

/** Pinned so a CLI change can't silently alter installs */
export const SKILLS_CLI = 'skills@1.7.4';
