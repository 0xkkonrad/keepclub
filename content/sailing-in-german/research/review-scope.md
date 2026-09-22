# Adversarial review scope

Date: 2026-09-22. Source base: `5409495bca6a52de9973de02eab998c314082e66`.
The candidate is committed and read from a detached review worktree. Its SHA
and the final content hash are recorded in the review results.

## Pre-flight

- In scope: all 87 cards and 100 headwords; noun gender, spelling, translation,
  sailing meaning, examples, beginner usefulness, grouping size, and every
  referenced diagram/highlight. The main agent checks build, packaging,
  browser rendering and production deployment.
- Out of scope: changing the existing sailing courses, broad app refactoring,
  pronunciation audio, and teaching complete sailing procedures.
- Three finders cover sections 01–07, 08–14 and 15–20. There is no sampling or
  findings cap. Each returns an explicit verdict for every assigned card.
  A separate refute-framed pass checks any findings; the author independently
  checks every medium/high finding before resolving it.
- Tool adaptation: the skill's Claude Workflow/Opus tools are unavailable in
  this session. Available Codex subagents perform the independent passes.
  Progress is reported in the active conversation.
- Scoping inconsistencies: no conflict with the user's request was found.
  The existing compiler accepts only ten-character hexadecimal pinned IDs,
  so readable draft keys were converted to stable pinned IDs before review.
  The broad points-of-sail poster contains unrelated statements and is omitted;
  selected SVG drawings provide more focused answer-side illustration.

## Decision list

settles: course name, languages, size and grouped recall · ruling: call it Sailing in German, German-English, about 100 terms, small related sets only · by: user, 2026-09-22 · source: task request · grade: RULING

settles: reuse of existing course images · ruling: use existing sailing pictures where relevant and helpful · by: user, 2026-09-22 · source: task request · grade: RULING

settles: verification and publishing · ruling: adversarially verify every card with subagents, then deploy · by: user, 2026-09-22 · source: task request · grade: RULING

No prior terminology rulings were found. The author-selected headwords,
definitions and images are not rulings and may all be challenged.
