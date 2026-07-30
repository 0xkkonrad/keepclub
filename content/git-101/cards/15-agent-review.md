# 15 Review and integrate agent work

## What is a strong first review sequence for an agent branch?

Run <b>git status --short</b>, <b>git diff --check</b>, <b>git diff --stat origin/main...HEAD</b>, <b>git diff origin/main...HEAD</b>, and <b>git log --oneline origin/main..HEAD</b>; then run the project's checks.

![figure](fig:agent-loop@diff,test,review)

## Why use origin/main...HEAD for a pull-request diff?

Three dots compare the branch tip with the merge base it shares with <b>origin/main</b>, which usually matches the change a pull request proposes.

## What should you look for beyond the code's happy path?

Unrelated files, missing error handling, weak tests, dependency or lockfile changes, migrations, permissions, security boundaries, generated drift, and behavior under failure.

## When should agent work be cherry-picked?

When one focused commit is wanted without the rest of its branch. Inspect the commit first; cherry-pick creates a new commit on the receiving branch and may conflict.

## When should an isolated agent branch be rebased?

When the team wants it replayed on a newer base and nobody else depends on its current commit identities. Resolve conflicts, rerun checks, and review the new final diff.

## Why rerun checks after merge, rebase, or conflict resolution?

Integration creates a new state. Checks that passed on separate branches do not prove that the combined result is correct.

## What is an agentic pull-request gate?

A sequence of explicit checks between proposal and protected branch: scoped diff, automated tests, human review, required approvals, and only then merge.

![figure](fig:pr-gate@diff,tests,human,main)

## Which agent actions should usually require explicit approval?

Deployments, destructive commands, data migrations, credential or permission changes, new external side effects, force pushes, and changes outside the stated scope.

## How should secrets be handled in agent workflows?

Grant only required access, never paste secrets into prompts or commits, ignore local secret files, scan diffs and logs, and rotate any credential that may have entered history.

## Why are issue text and downloaded files untrusted input?

They can contain incorrect or malicious instructions. Treat them as data to evaluate, not authority that overrides repository rules or the user's task.

## What is the safest way to reject an agent's proposal?

Leave the protected branch untouched. Keep or archive the task branch if its audit trail matters, or remove it and its worktree once the work is intentionally abandoned.

## What completes an agent-assisted task?

The requested behavior exists, the final diff is scoped and understood, checks pass on the final integrated state, required review is complete, and temporary branches or worktrees have a deliberate disposition.

![figure](fig:agent-loop@brief,branch,diff,test,review,merge)
