# 10 Next-step tools

## What does git stash do?

It stores your tracked working-tree and index changes and leaves a clean tree behind. Untracked files stay where they are unless you add <b>-u</b>. Use <b>git stash push -m "why"</b>, inspect with <b>git stash list</b>, and restore with <b>git stash pop</b> or <b>apply</b>.

## Is a stash a durable backup?

No. Stashes are local, easy to forget, and eventually removable. A named branch with a checkpoint commit is clearer and safer for work that matters.

## What does git rebase main do on a feature branch?

It replays the feature branch's commits onto the current <b>main</b> tip, creating new commit identities and a linear shape. Rebase work you control, not shared public history.

![figure](fig:branch-merge@diverge,rebase)

## How do you continue or abandon a conflicted rebase?

Resolve and stage the file, then run <b>git rebase --continue</b>. Run <b>git rebase --abort</b> to return to the pre-rebase state. The side labels invert during a rebase: <b>ours</b> is the new base and <b>theirs</b> is your commit being replayed onto it.

## What does git rebase -i HEAD~4 enable?

Interactive rebase can reorder, combine, edit, or drop the latest four commits. It rewrites those commits, so use it only on history you are allowed to replace.

## What does git cherry-pick &lt;commit&gt; do?

It applies one commit's change onto the current branch as a new commit. Use it for a focused change that belongs on another branch, not as a default replacement for merging.

## What does git mv old.md new.md do?

It moves the path and stages the deletion and addition. Git ultimately detects renames by similarity, so ordinary file-system moves followed by <b>git add -A</b> can produce the same history.

## What does git rm path/to/file do?

It removes the working file and stages its deletion. Use <b>git rm --cached</b> to stop tracking while keeping the local copy.

## What is the safest way to learn a risky command?

Use a disposable repository, commit a known starting point, run <b>git status</b> before and after, and inspect the result. Do not make production history your practice ground.
