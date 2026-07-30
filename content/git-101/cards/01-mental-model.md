# 01 What Git is

## What is Git?

Git is a version-control system: it records snapshots of a project so you can inspect, compare, share, and recover its history. It works locally first &mdash; you can commit without being online.

![figure](fig:three-areas@working,staging,repository)

## Is Git the same thing as GitHub?

No. <b>Git</b> is the version-control tool. GitHub, GitLab, Bitbucket, and similar services host Git repositories and add collaboration features such as issues, pull requests, permissions, and CI.

## What is a repository?

A project folder whose history Git tracks. The hidden <b>.git</b> directory holds Git's objects, references, and configuration; the visible files are your working tree.

## What is a commit?

A named snapshot of the staged project plus metadata: its author, time, message, and parent commit or commits. A commit is local until you push it somewhere.

![figure](fig:snapshots@commits)

## Does Git continuously sync every edit?

No. You choose what enters the next snapshot with <b>git add</b>, then record that snapshot with <b>git commit</b>. Publishing it with <b>git push</b> is a separate choice.

## What does Git track: files or changes?

Git stores project snapshots. It can compare snapshots to describe additions, deletions, renames, and edits, but its core model is a history of complete states.

## What is the safest first command when you feel lost?

<b>git status</b>. It reports the current branch and separates staged, unstaged, and untracked work. Read it before guessing at a fix.

![figure](fig:three-areas@working)
