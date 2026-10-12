---
name: checkpoint
description: Run the checks and update the build order at the end of a task.
disable-model-invocation: true
allowed-tools: Bash(npm run typecheck) Bash(npm test) Bash(git status) Bash(git diff *)
---
1. Run `npm run typecheck`, then `npm test` if there's a test script in package.json. If something fails, stop and tell me what.
2. If the spec has a build order (see Project docs in CLAUDE.md), tick what's done and note anything that got pushed back.
3. Show me `git status` and `git diff --stat`, then list what I should look at closely before I commit: risky or non-obvious changes, and anything you're unsure about. Don't commit, I do that myself.
