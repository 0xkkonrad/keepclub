# 03 Edit, stage, commit

## What are Git's three local areas?

The <b>working tree</b> holds the files you edit. The <b>staging area</b>, also called the index, holds the exact next snapshot. The <b>repository</b> holds committed snapshots.

![figure](fig:three-areas@working,staging,repository)

## What does git add README.md do?

It copies the current content of <b>README.md</b> into the staging area. It does not commit or upload the file.

![figure](fig:three-areas@add)

## What does git commit -m "Add project overview" do?

It records the staged snapshot as a new local commit and moves the current branch to it. Unstaged edits are not included.

![figure](fig:three-areas@commit)

## What does git push do in the everyday loop?

It sends reachable local commits to a remote repository and asks a remote branch to advance. It does not automatically include uncommitted edits.

![figure](fig:remote-loop@push)

## Why can one file be both staged and unstaged?

You staged one version, then edited the file again. The next commit contains the staged version; the newer edit remains in the working tree.

## How do you stage every tracked and untracked change under the current folder?

Run <b>git add .</b>. It is convenient, but inspect <b>git status</b> and <b>git diff --staged</b> before committing so unrelated files do not slip in.

## How do you stage only selected hunks from a file?

Run <b>git add -p path/to/file</b>. Git shows one hunk at a time so you can include, skip, split, or edit it.

## What makes a useful commit?

One coherent change, a message that explains its purpose, and a state that passes the relevant checks. Small focused commits are easier to review, revert, and give to another contributor.

## What is a clear beginner commit loop?

Edit; run <b>git status</b> and <b>git diff</b>; stage intended paths; run <b>git diff --staged</b>; commit; then run <b>git status</b> again.

![figure](fig:three-areas@working,staging,repository)
