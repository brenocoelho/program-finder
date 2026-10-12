---
name: ai-log
description: Add an entry to docs/AI_LOG.md about the AI work done in this session.
disable-model-invocation: true
allowed-tools: Bash(date *)
---
Run `date '+%Y-%m-%d %H:%M'` to get the date and time, then add one entry at the end of docs/AI_LOG.md about this session, using the template below. One or two lines per field. Quote my prompts briefly, don't paste outputs.

### <YYYY-MM-DD HH:MM> | <phase: Understanding, Scoping and planning, Building, Testing or Documentation> | <tool and model>
- Goal:
- Prompt (short):
- What the AI produced:
- What I kept:
- What I changed or threw away, and why:
- Key decision I made: <from my answers this session; link the docs/DECISIONS.md entry>
- Evidence: <file or transcript path>

If you don't know why I changed something, write "TODO(Breno)". Don't guess.
My notes: $ARGUMENTS
