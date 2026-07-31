# 04 See changes and history

## What does git diff show by default?

Unstaged differences between the working tree and the staging area. It does not show changes already staged for the next commit.

## What does git diff --staged show?

Differences between the staging area and <b>HEAD</b> &mdash; the content that the next commit would record.

## What does git diff HEAD show?

All tracked working-tree differences from the current commit, staged and unstaged together.

## How do you see a compact commit history?

Run <b>git log --oneline</b>. Branch and tag names are decorated by default; add <b>--graph --all</b> to draw the shape of the history and include every ref, remote-tracking branches included.

![figure](fig:snapshots@commits,head)

## What does HEAD mean?

<b>HEAD</b> identifies what you currently have checked out. Normally it points to a branch, and that branch points to the current commit.

![figure](fig:snapshots@head,branch)

## How do you inspect one commit?

Run <b>git show &lt;commit&gt;</b>. Git prints the commit metadata and its patch; <b>git show HEAD</b> inspects the current commit.

## What is a commit hash?

An object identifier derived from the commit's content and metadata. Commands accept a unique short prefix, but store or share the full hash when ambiguity would be costly.

## What do HEAD~1 and HEAD^ mean?

Both name the first parent of <b>HEAD</b>. <b>~2</b> walks back two first-parent steps; <b>^2</b> selects a merge commit's second parent.

## What does .gitignore do?

It tells Git which untracked paths should stay untracked. It does not remove a file that is already tracked.

## How do you stop tracking a file but keep the local copy?

Add it to <b>.gitignore</b>, then run <b>git rm --cached path/to/file</b> and commit the change. If the file contained a secret, rotate the secret; ignoring it does not erase old commits.

## What belongs in .gitignore?

Generated outputs, dependency folders, caches, editor or OS clutter, and local configuration that is not meant to be shared. Commit an example configuration when teammates need to know the required shape.
