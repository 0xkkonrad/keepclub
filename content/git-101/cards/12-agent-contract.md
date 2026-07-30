# 12 The agent contract

## What role should a coding agent's Git branch play?

It is a proposal boundary. The branch isolates the agent's changes, Git records what actually changed, and review plus project checks decide whether the proposal reaches the default branch.

![figure](fig:agent-loop@branch,review)

## Why is Git a control plane for agentic work?

It provides isolation, a diff, checkpoints, authorship metadata, recovery, and an accept-or-reject merge boundary. Those controls matter more when code can be produced quickly.

## What should every agent task specify?

The goal, in-scope files or systems, acceptance criteria, required checks, boundaries, and known risks. A bounded task produces a diff that can be judged.

## What is the 2026 one-task rule?

One task gets one branch and, when work runs in parallel, one worktree. This keeps ownership, status, commits, and cleanup legible to both people and agents.

![figure](fig:worktrees@branches)

## Should an agent treat a dirty worktree as disposable?

No. Existing changes may belong to the user or another process. The agent should inspect status, preserve unrelated work, and avoid destructive cleanup unless the exact action is authorized.

## Why ask an agent to make checkpoint commits?

A focused checkpoint is a recoverable state that can be inspected, reverted, cherry-picked, or handed off. It also limits how much work is at risk if the next experiment fails.

## What evidence should an agent return?

The files changed, the behavior implemented, exact checks run and their results, remaining risks, and the branch or commit containing the work.

## What is the difference between agent confidence and evidence?

Confidence is part of an explanation. Evidence is the actual diff, test output, build result, CI status, and reproducible behavior on the final commit.

## Who owns the merge of agent-generated code?

The project owner or designated integrator. An agent can prepare and validate a proposal, but normal review, security, and deployment authority still apply.
