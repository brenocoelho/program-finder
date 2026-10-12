# AI usage log

Started: TBD. Finished: TBD. Total: TBD.
I used Claude Code in VS Code during the timed work (the model is noted in each entry). Before the clock, I used Claude to research the company and SBA lending, get up to speed on React Router v8, and plan my approach and my Claude Code setup.
I reviewed every change before committing, and all the commits are mine.
Raw transcripts: attached to my submission email, one per phase. They include the assessment brief, so I kept them out of the repo.

## Entries (oldest first, added with /ai-log)

### 2026-10-12 12:20 | Understanding | Claude Code in VS Code, Claude Opus 5.5
- Goal: understand the problem and the data before writing a spec or code, and settle the open business rules.
- Prompt (short): "Read docs/private/brief.md and data/programs.csv. Don't write code yet. Write docs/UNDERSTANDING.md…", then "go through the 8 open questions".
- What the AI produced: docs/UNDERSTANDING.md (the rep's problem, a table of every column, unstated user expectations, 8 open questions with defaults, 5 test scenarios from real rows with expected results), "What this is" in CLAUDE.md, then 8 multiple-choice questions and the D1–D8 entries.
- What I kept: the column table, the scenarios, and its recommended answer on 6 of the 8 questions.
- What I changed or threw away, and why: rejected years + months for time in business and kept whole years with a "full years" hint (reason in D2). On stale data I first chose no warning, then switched to warn after 31 days once the AI pointed out that a rep could read an old rate as current (D8). I didn't edit the docs by hand.
- Key decision I made: credit matches on tier, plus the minimum score when the rep has one ([D1](DECISIONS.md)); all 8 are in [docs/DECISIONS.md](DECISIONS.md) D1–D8.
- Evidence: docs/UNDERSTANDING.md, docs/DECISIONS.md, CLAUDE.md; transcript: 01-understand.txt (attached to the email).
