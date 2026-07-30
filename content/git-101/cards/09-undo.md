# 09 Undo and recover

## How do you unstage a file but keep its edits?

Run <b>git restore --staged path/to/file</b>. The staged copy returns to <b>HEAD</b>; the working-tree edit remains.

![figure](fig:undo-map@unstage)

## How do you discard an unstaged edit to a tracked file?

Run <b>git restore path/to/file</b>. This overwrites the working copy and can destroy uncommitted work, so inspect the diff and exact path first.

![figure](fig:undo-map@discard)

## How do you undo a commit that has already been shared?

Run <b>git revert &lt;commit&gt;</b>. Revert adds a new commit that applies the inverse change, preserving the public history.

![figure](fig:undo-map@revert)

## How do you change the latest local commit?

Stage the intended content, then run <b>git commit --amend</b>. Amend replaces the commit with a new one, so avoid it after others have based work on the old identity.

## What does git reset --soft HEAD~1 do?

It moves the current branch back one commit while leaving that commit's changes staged. It is useful for rebuilding a local commit, but it rewrites the branch.

## What does git reset with no mode use?

The default is <b>--mixed</b>: it moves the branch and resets the staging area while leaving working files. Read the target carefully before using it.

## Why is git reset --hard dangerous?

It moves the branch and makes both staging area and tracked working files match the target. Uncommitted tracked changes can be lost.

![figure](fig:undo-map@danger)

## What is git clean -fd, and why is it dangerous?

It deletes untracked files and directories. Preview with <b>git clean -nd</b>, verify the exact scope, and prefer a recoverable move when the files may matter.

## What is git reflog?

A local log of recent movements of references such as <b>HEAD</b>. It can reveal commits lost after reset, amend, rebase, or branch deletion.

![figure](fig:undo-map@reflog)

## How do you rescue a commit found in reflog?

Create a name for it, for example <b>git branch rescue &lt;hash&gt;</b>. Naming it makes the commit reachable again while you inspect what should be kept.

## What is the first rule of Git recovery?

Stop making destructive changes. Run <b>git status</b>, preserve any working files, inspect <b>git reflog</b>, and create a rescue branch before experimenting.
