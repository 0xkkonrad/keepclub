# 11 Investigate and release

## What does git blame path/to/file show?

For each line, the most recent commit that changed it. It is a navigation aid into history, not proof of who designed, approved, or caused a behaviour.

## How do you search commits for a changed string?

Run <b>git log -S"needle" -- path/to/file</b>. The <b>-S</b> pickaxe finds commits where the number of occurrences changed.

## What does git bisect help find?

The first commit that introduced a regression. Mark one commit good and another bad; Git checks out midpoint commits until the faulty boundary is identified.

## What is the core git bisect loop?

Run <b>git bisect start</b>, mark <b>bad</b> and a known <b>good &lt;commit&gt;</b>, test each midpoint, mark it good or bad, then finish with <b>git bisect reset</b>.

## What is a Git tag?

A name for one specific object, usually a release commit. Unlike a branch, a tag does not move when new commits are created.

## How do you create an annotated release tag?

Run <b>git tag -a v1.0.0 -m "Version 1.0.0"</b>, then publish it with <b>git push origin v1.0.0</b>. An annotated tag is its own object carrying a tagger, a date, and a message; a lightweight tag is only a name for a commit. Pushing a branch does not necessarily push tags.

## What does git diff --check detect?

Whitespace errors such as conflict-marker-shaped lines or trailing whitespace in the proposed diff. It is a fast pre-review check, not a substitute for tests.

## What does git log --left-right --graph main...feature show?

The commits unique to each side of the branch comparison, marked left or right, with their graph. It helps explain divergence before merge or rebase.
