# Git 101

A Keep Club memory course that starts with Git's local mental model and ends
with safe, branch-isolated agentic workflows.

## Shape

- 15 sections in four groups
- 144 independently answerable cards
- 10 reusable labelled SVG figures
- Basics first: repository, staging, commits, diffs, branches, merges, remotes,
  team workflow, recovery, and investigation
- Agentic track last: task contracts, repository instructions, worktrees,
  parallel roles, evidence-based review, integration, permissions, and secrets

The source of truth is `cards/`. `src/build.py` parses it through the shared
`content/mdc.py` compiler, validates figure references, and writes the compact
built-in deck currently consumed by the app.

## Build

From the repository root:

```bash
python3 content/git-101/src/build.py
./scripts/refresh-courses.sh --write
node tests/separation.mjs
```

The first command writes ignored build artifacts under `content/git-101/build/`.
The refresh command copies those artifacts into the committed, self-contained
`web/courses/git-101/` package.

## Reference basis

Checked on 2026-07-30:

- [Pro Git and the official Git reference](https://git-scm.com/book/en/v2)
- [git-worktree manual](https://git-scm.com/docs/git-worktree)
- [GitHub's agent-driven parallel workspace model](https://docs.github.com/en/copilot/concepts/agents/github-copilot-app)
- [GitHub coding-agent task guidance](https://docs.github.com/en/copilot/using-github-copilot/using-copilot-coding-agent-to-work-on-tasks/best-practices-for-using-copilot-to-work-on-tasks)
- [GitHub protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)

Vendor-specific UI details stay out of the cards. The 2026 section teaches the
durable control pattern visible across current tools: one scoped task per
branch or worktree, explicit repository context, small checkpoints, review of
the real diff, checks on the final commit, and a human-owned merge boundary.
