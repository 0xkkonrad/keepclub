# 05 Branches

## What is a Git branch?

A movable name that points to a commit. New commits move the current branch forward; creating a branch does not copy the project.

![figure](fig:branch-merge@main,feature)

## How do you create and switch to a new branch?

Run <b>git switch -c feat/welcome-card</b>. The older equivalent is <b>git checkout -b feat/welcome-card</b>, but <b>switch</b> states the intention more clearly.

## How do you list branches?

Run <b>git branch</b> for local branches, <b>git branch -r</b> for remote-tracking branches, or <b>git branch -a</b> for both. The current local branch has an asterisk.

## How do you switch to an existing branch?

Run <b>git switch branch-name</b>. Commit, stash, or otherwise account for current edits first when the switch would overwrite them.

## What does git checkout map to in newer Git?

<b>git checkout</b> did two different jobs, so Git split it: <b>git switch</b> moves between branches and <b>git restore</b> puts file content back. Older tutorials still show <b>checkout</b> and it still works, but the newer pair says which job you mean.

## What happens to HEAD when you switch branches?

<b>HEAD</b> attaches to the selected branch, and Git updates the working tree and staging area to match that branch's commit.

![figure](fig:snapshots@head,branch)

## Why use a feature branch?

It isolates one task, gives its commits a reviewable boundary, and lets the default branch continue independently. A useful habit is one task per branch.

## How do you rename the current branch?

Run <b>git branch -m new-name</b>. If the old name was already pushed, publish the new branch and coordinate removal of the old remote name.

## How do you delete a merged local branch?

Run <b>git branch -d branch-name</b>. The lowercase <b>-d</b> refuses when Git believes commits would be lost; uppercase <b>-D</b> forces deletion.

## What is detached HEAD?

<b>HEAD</b> points directly to a commit instead of a branch. You can inspect or build there, but create a branch before making work you want to keep reachable by a name.

## Does deleting a branch immediately delete its commits?

No. Deleting the name does not immediately erase objects. Commits reachable from another branch or tag remain; recently unreachable commits can often be found through <b>git reflog</b>.
