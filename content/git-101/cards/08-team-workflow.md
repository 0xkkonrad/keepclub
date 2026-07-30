# 08 Team workflow

## What is a pull request or merge request?

A hosting-platform proposal to merge one branch into another. It presents the diff, discussion, approvals, and automated checks; it is not a core Git object.

## What is a simple feature workflow?

Update the default branch, create a task branch, make focused commits, push it, open a pull request, respond to review and CI, then merge through the team's normal gate.

## What should a pull request explain?

The problem, the chosen behavior, important tradeoffs, how it was validated, and any risk or follow-up. The diff remains the source of truth for what actually changed.

## Why should commits be focused?

A focused commit has one reason to exist. Reviewers can understand it, automated tools can test it, and maintainers can revert or cherry-pick it without dragging unrelated work along.

## What makes a useful commit message?

An imperative summary of the outcome, such as <b>Fix empty search state</b>, plus a body when the reason or tradeoff is not obvious from the diff.

## Should you rewrite commits that teammates already use?

Usually not. Rebase, amend, and reset create new commit identities. Rewriting a private task branch may be fine; rewriting shared history disrupts everyone based on the old commits.

## When is git push --force-with-lease appropriate?

After intentionally rewriting a branch you control. It refuses if the remote moved somewhere you have not seen, making it safer than plain <b>--force</b>, but it is still a history rewrite.

## How do protected branches help?

Repository hosts can require pull requests, approvals, passing checks, signed commits, or code-owner review before a protected branch moves. The exact rules belong to the host, not Git itself.

## What should you do before asking for review?

Inspect <b>git status</b>, the branch diff and commit list, run required checks on the final commit, remove unrelated files, and write an accurate summary.

## Why review a diff instead of trusting a summary?

Summaries are claims; the diff is the actual proposal. Check the changed code, tests, dependencies, generated files, migrations, and permissions yourself.
