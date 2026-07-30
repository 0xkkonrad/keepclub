# 14 Parallel agents and worktrees

## What problem does git worktree solve?

It gives another branch its own working directory, <b>HEAD</b>, and index while sharing the repository's object database. Multiple tasks can be checked out at once without swapping one folder back and forth.

![figure](fig:worktrees@shared,branches)

## How do you create a worktree with a new task branch?

Run <b>git worktree add -b agent/search ../project-search origin/main</b>. The new directory checks out <b>agent/search</b> from the chosen base.

## How do you list linked worktrees?

Run <b>git worktree list</b>. It shows each path, checked-out commit, and branch so an integrator can see which lanes are active.

## Can one branch be checked out in two worktrees?

Normally no. Git prevents it because two independent indexes and working directories moving the same branch would be ambiguous.

## Why assign non-overlapping work to parallel agents?

Separate ownership reduces merge conflicts and, more importantly, semantic collisions where two clean diffs make incompatible decisions in the same subsystem.

![figure](fig:worktrees@scope)

## Do linked worktrees share uncommitted files?

No. Their working files and staging areas are separate. They do share Git objects and repository-level data, so commits created in one worktree are immediately known to the repository.

## How should you remove a finished worktree?

From a safe directory, run <b>git worktree remove ../project-search</b>, then delete the branch only after its work is integrated or deliberately abandoned.

## What does git worktree prune do?

It removes stale administrative records for worktrees that no longer exist. Prefer <b>git worktree remove</b> for normal cleanup instead of deleting a directory by hand.

## What should an integrator compare before combining agent branches?

Each branch's commits and diff against the intended base, touched-file overlap, test evidence, dependency or schema changes, and assumptions shared across the tasks.

## What is a simple parallel-agent topology?

A scout maps the problem, bounded builders own independent branches or worktrees, a reviewer challenges the result, and one integrator owns the final combined branch.

![figure](fig:worktrees@scout,builder,reviewer,integrator)
