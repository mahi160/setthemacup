Review the staged changes (`git diff --cached`). Empty → review the current branch's diff against `main` instead.

Delegate bulk reading and other non-thinking work (reading many files, grepping usages, collecting context) to a cheap child: `pi -p --no-session --model anthropic/claude-haiku-5-5:high --tools read,grep,find,ls "<task>"`. Keep judgment and the final findings in this session.

Focus on:
- Bugs and logic errors
- Security issues
- Error handling gaps

Report findings as a short list: file, line, problem. No praise, no summary of what the diff does.
