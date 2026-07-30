# 06 Merge and conflicts

## What does git merge feature do?

It integrates the history reachable from <b>feature</b> into the current branch. Switch to the receiving branch first, then merge the source branch.

![figure](fig:branch-merge@feature,merge)

## What is a fast-forward merge?

The current branch has no unique commits, so Git only moves its pointer forward to the other branch. No merge commit is required.

![figure](fig:branch-merge@fast-forward)

## What is a three-way merge?

Both branches changed since their common ancestor, so Git combines the two tips using that ancestor and usually creates a commit with two parents.

![figure](fig:branch-merge@diverge,merge)

## What is a merge conflict?

Git cannot safely choose the final content, often because both sides changed overlapping lines. It pauses so a person or agent can make an explicit decision.

![figure](fig:conflict@ours,theirs,resolved)

## What do conflict markers mean?

<b>&lt;&lt;&lt;&lt;&lt;&lt;&lt;</b> starts the current side, <b>=======</b> separates it from the incoming side, and <b>&gt;&gt;&gt;&gt;&gt;&gt;&gt;</b> ends the conflict. Edit the file into the intended result and remove all markers.

## How do you finish a merge conflict?

Resolve each file, run tests, stage resolved paths with <b>git add</b>, then run <b>git commit</b> or <b>git merge --continue</b> when Git requests it.

## How do you abandon a merge in progress?

Run <b>git merge --abort</b>. It attempts to restore the state from before the merge; inspect <b>git status</b> afterward.

## What should you inspect before resolving a conflict?

The task's intended behavior, both branch versions, and the common base. Do not mechanically keep both sides: syntactically combined code can still be logically wrong.

## Can a merge succeed without being correct?

Yes. Git detects textual overlap, not business logic. Changes in different lines or files may merge cleanly while contradicting each other, so run the relevant tests and review the combined diff.

## What is the difference between a merge and a squash merge?

A normal merge preserves the branch's commits and may add a merge commit. A squash combines the net change into one new commit, which gives a simpler history but discards the branch's internal commit structure.
