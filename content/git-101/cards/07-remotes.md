# 07 Remotes

## What is a Git remote?

A saved name and address for another repository. <b>origin</b> is the usual name created by clone, but it has no special power.

![figure](fig:remote-loop@local,remote)

## How do you list configured remotes and their addresses?

Run <b>git remote -v</b>. It shows the URLs used for fetching and pushing.

## What does git fetch origin do?

It downloads objects and updates remote-tracking references such as <b>origin/main</b>. It does not merge them into your current branch or overwrite working files.

![figure](fig:remote-loop@fetch)

## What is origin/main?

A local, read-only-style record of where the remote's <b>main</b> branch was at the last successful fetch. It can be stale until you fetch again.

## What does git pull do?

It fetches and then integrates the configured upstream branch, using merge or rebase according to configuration and options. Use <b>git pull --ff-only</b> when you want pull to refuse anything except a fast-forward.

## What does git push -u origin feat/search do?

It publishes the local branch as <b>feat/search</b> on <b>origin</b> and records it as the branch's upstream, so later <b>git push</b> and <b>git pull</b> know the default pair.

![figure](fig:remote-loop@push)

## What is an upstream branch?

The remote-tracking branch associated with a local branch for comparison, pull, and push defaults. See it with <b>git branch -vv</b>.

## Why can a push be rejected as non-fast-forward?

The remote branch contains commits your local branch does not include. Fetch, inspect, and integrate that work before pushing again; do not reflexively force-push.

## How do you add a remote?

Run <b>git remote add origin https://host.example/team/project.git</b>. Use a different name when <b>origin</b> already exists or when tracking multiple repositories.

## How do you remove a branch from a remote?

Run <b>git push origin --delete branch-name</b>. This removes the remote reference, not teammates' local copies.
