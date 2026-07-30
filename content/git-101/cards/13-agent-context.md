# 13 Make repos legible to agents

## Why keep agent instructions inside the repository?

Versioned instructions travel with the code, can be reviewed like code, and give every agent the same setup, validation, conventions, and boundaries.

## What belongs in an AGENTS.md-style instruction file?

Short, testable rules: how to set up, which checks to run, architectural conventions, generated-file commands, sensitive paths, and actions that require approval.

## What makes an agent instruction weak?

Vague wishes such as 'write good code', obsolete commands, contradictory rules, or a huge unranked handbook. Prefer concrete commands and boundaries the agent can verify.

## What should acceptance criteria look like?

Observable outcomes, for example: 'the empty state appears when results are zero', 'keyboard focus remains visible', and 'the existing test plus a new regression test pass'.

## Why document generated files?

An agent must know which file is the source of truth, which command regenerates outputs, and whether generated artifacts are committed. Otherwise it may hand-edit an output or leave source and build drifting apart.

## Why give agents repository-local validation commands?

They turn 'looks done' into repeatable evidence and reduce guesswork across environments. Keep the commands current in both documentation and CI.

## What should an agent do before editing?

Read applicable instructions, inspect repository status and nearby conventions, identify the validation path, and confirm that the task can be completed within its scope.

## What is a good handoff when an agent stops mid-task?

A clean description of completed and remaining work, changed files, current status, commands already run, failures or uncertainties, and a checkpoint commit when appropriate.
