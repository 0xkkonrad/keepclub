# Keep Club progress plateau audit

Verdict: the reported 50% plateau is reproducible and is a product/code smell, not a corrupt-state symptom. Exam mode intentionally shortens review spacing, but the implementation uses that shortened spacing as the only mastery signal and Home then presents a synthetic half-credit score as “known well.”

## Pre-flight

- Target: Keep Club `c702c0a6ab03ef245a509f720d6083c74e918801`, audited from detached worktree `/tmp/keepclub-audit-20260822-qScH5I`; production `app.js` had the same SHA-256 (`f9e55c41fc290d3be9544b1fc6d390eb5a8e691006c2c0e79ea6090a2ab71408`) during the audit.
- Case: supplied Competent Crew export at `2026-08-22T11:18:43.458Z`, deck build `7cf550d2`; the current read-only sync snapshot matched it. The supplied secret is not copied into this report or verdict data.
- In scope: state ingestion/sanitation; the scheduler’s exam ceiling; section/deck progress; Home, Progress, accessibility, and mastery achievements; relevant sync behavior; regression coverage.
- Out of scope: course-content correctness, unrelated media/import/offline behavior, backend authorization/security, visual redesign, implementation, and unrelated generic sync/practice-session bugs surfaced by broad finders.
- Lenses: scheduling/math/reachability; state/persistence/sync integrity; UI semantics/accessibility/tests.
- Stakes: MED for false/stalled/backwards progress; LOW for secondary presentation/test gaps. MED findings require an independent verifier and main-loop browser reproduction.
- Kill-list: `keepclub-progress-audit/kill-list.md`. It contains RULING-grade decisions that the exam clamp itself and the exact 21-day solid threshold are intentional; neither ruling approves their interaction, the 50% label, or destructive mastery demotion.
- Tooling deviation: the required Claude Code Workflow runner was unavailable. Three isolated read-only finder agents and fresh claim-by-claim verifier agents preserved finder/verifier separation; the pinned target remained clean after every wave.

Scoping inconsistencies identified before finder launch:

1. The exam ceiling is `round(days remaining × 0.2)`, while solid/mature requires an interval of at least 21 days. The ceiling first reaches 21 only at 103 days; at 102 days or closer the threshold cannot be scheduled.
2. Home awards young cards 50% credit and labels the result “known well,” while Progress and achievements reserve known well/solid for the 21-day state.
3. The supplied identity contains state only for Competent Crew. The concrete symptom is all 14 sections of that one 200-card course; no conclusion is possible about unsupplied device-local state for the other built-ins.

## Confirmed

### C-01 · MED · Exam mode can persistently erase visible mastery

The scheduler and mastery model share the mutable `ivl` field. Setting a valid exam no more than 102 days away rewrites every larger review-card interval down below 21; clearing or postponing the exam does not restore it. A later correct, scheduled Good/Easy answer under the cap also stores the shorter interval and can demote a mature card. Anchors: `web/app.js:848-901`, `web/app.js:904-970`, `web/app.js:988-992`, `web/app.js:7043-7071`.

Failure scenario: at 2026-08-22, start with `ivl=30`, due 2026-09-21, and no exam. The card is mature. Set 2026-09-19: ceiling 6, stored `ivl=6`, due 2026-08-28, state young. Progress changes from 1 solid to 0; clearing the date leaves the card at 6/young. In a separate run, Good and Easy each displayed “6 days max,” persisted `ivl=6`, and demoted the correctly answered mature card.

Repro status: confirmed twice — an independent verifier and main-loop Chromium repro, with no page errors. The source comment at `web/app.js:7049-7052` explicitly acknowledges that clearing cannot undo an interval rewrite.

### C-02 · MED · The supplied deck cannot advance beyond its 50% all-young plateau before the exam

With the supplied exam date unchanged and reviews graded Hard/Good/Easy through 2026-09-19, every scheduled interval is below the 21-day solid threshold. Home’s fully-seen, non-learning formula then gives every section exactly 50%, while all solid-derived course milestones remain locked. Anchors: `web/app.js:848-901`, `web/app.js:988-1026`, `web/app.js:2390-2406`, `web/achievements.js:160-197`, and `web/achievements.js:684-710`.

Case evidence: 28 days remained, so the ceiling was 6. All 200 shipped cards had valid review records, every interval was 2–7, and zero cards were mature. All 14 sections were fully seen and had no learning cards. Browser restoration rendered fourteen 50% meters, `0 solid`, `200 seen, not solid yet`, `0% solid`, zero kept sections, and no solid/kept unlocks. Enumerating every successful grade preview produced a maximum of 6.

Boundary: Again can temporarily push a section below 50%; the exact 50% invariant is for successful grades. The cap returns to normal on the day after the exam. Club-wide solid-count milestones could be supplied by another locally stored course, but none exists in the isolated supplied state.

Repro status: confirmed twice — an independent verifier and main-loop Chromium restoration of the supplied export.

### C-03 · MED · Home calls a hybrid familiarity score “known well” while exact Progress says zero

Home computes `(mature + young × 0.5) / total` and then prints `% known well`. Elsewhere, `known well`, `mature`, and `solid` all mean `ivl >= 21`. At the export timestamp, every one of the 200 cards was young and none known well, yet each Home row and accessible button name said `50% known well`; expanded Progress said `0 known well` in every section. Anchors: `web/app.js:981-1026`, `web/app.js:2390-2419`, and `web/app.js:5948-6035`.

This is not a rounding oddity: with an all-young section, the formula is algebraically fixed at exactly one half. The literal Home sentence is time-dependent because pending cards replace it with a card count, but the half-width meter remains.

Repro status: confirmed twice — an independent verifier restored the actual file through the browser UI, and the main loop independently rendered the same state.

### C-04 · LOW · Some visible Home meters have no accessible progress value

When a section has positive progress plus pending or unseen cards, Home draws a meter but replaces the metadata with a pending/new/card count. The enclosing button’s accessible name therefore omits the percentage, while the meter span has no progress role, name, or value. Anchor: `web/app.js:2390-2419`.

Failure scenario: in the real 34-card Sea terms section, one mature card, one young/due card, and 32 unseen cards produced a visible 4% meter. Chromium exposed the button as `1 to review. 34 cards. Study this section.` and the meter as an unnamed generic node with no value. A fresh-only variant behaved the same. Fully scheduled/no-pending rows are a counterexample because their button name includes the percentage.

Repro status: confirmed twice — independent verifier plus main-loop Chromium repro.

### C-05 · LOW · A displayed milestone percentage can be reached while its achievement stays locked

Progress rounds titled-group solid percentages to a whole number, while achievement evaluation compares the unrounded course fraction. A valid one-group 101-card imported course with 25 solid cards therefore displays `25% solid`, but evaluates `24.752… < 25` and leaves `25% kept` locked. Anchors: `web/app.js:6028-6034` and `web/achievements.js:180-197,444-446,475-490`.

This is reachable within the supported schema and uses identical group/course denominators. Shipped multi-group examples alone would not prove it because their displayed group denominator differs from the course achievement denominator. A previously unlocked achievement also stays earned, so the mismatch applies before the threshold has ever truly been crossed.

Repro status: independently verified with schema validation and the real achievement evaluator; LOW severity, so no main-loop browser gate was required.

## Refuted with evidence

### R-01 · The plateau is caused by lost, capped, stale, or deck-mismatched review data

REFUTED. Export build and shipped build both equal `7cf550d2`; the export and deck each contain 200 unique cards with an exact ID-set match: 0 missing, 0 orphan, 0 malformed, 0 sanitizer-dropped. Restoring the file left 200 records in memory and durable storage. The review-record set has no 200-entry cap; the sync blob was 23,079 bytes, 8.8% of its 262,144-byte limit. Counters reconcile exactly: `answers=903`, sum of per-card repetitions `=903`, sum of 14 daily counts `=903`, and 8 repeat misses equal 8 total lapses. An empty/self sync merge preserves all records.

The stronger explanation is the intact state itself: all 200 records are young, and Home gives each exactly half credit. This also refutes a literal frozen-render theory: the UI recomputes from current records; it is deterministically pinned by the scheduler/metric interaction.

## By design — do not fix

1. Do not remove exam/cramming spacing wholesale. The named project decision says the exam-date clamp is what makes cramming mode materially different (`project.md:295-302`, 0xkkonrad, 2026-07-27). Fix the state model and progress semantics around it.
2. Do not lower the 21-day solid threshold merely to make this meter move. The exact threshold is a named, tested product decision (`web/achievements.js:18,160-197,684-695`; 0xkkonrad, 2026-07-29).

## Reassuring negatives

- No critical/high-severity defect was confirmed in the scoped audit; the three material findings are MED.
- The supplied state is substantial and internally coherent: 903 answers over 14 study dates, a 10-day streak, 573 repeats, 565 repeat successes, 8 lapses, and 2–11 answers per card (mean 4.515).
- The live sync snapshot matched the supplied course state at revision 1. No state for Day Skipper, Git 101, or Toki Pona was present under the supplied identity.
- Production `app.js` byte-for-byte matched the pinned audited file; production and local Competent Crew were both build `7cf550d2`, 200 cards, 14 sections.
- Sanitization, restore, merge, and browser boot retained all 200 records; all browser repros had zero page errors.
- Progress’s exact stacked bars and accessible labels agree with the underlying buckets: 0 mature, 200 young, 0 learning, 0 new. The fault is Home’s incompatible synthetic metric, not those exact counts.
- The `100% started` headline and Progress’s `0 solid / 200 seen / 0 not started` are each internally correct.
- Relevant existing suites all passed: achievements 96/96, shell/courses 104/104, sync merge 82/82, QA regressions 68/68, and achievement UI 17/17 (367 checks). None combines a near-term exam ceiling, the 21-day threshold, Home’s half-credit score, and destructive interval rewrite.
- Finder and verifier tree sweeps left the pinned and original Keep Club worktrees clean. The mono workspace showed unrelated modified gitlinks during those sweeps; no audit agent targeted them.

## Open rulings

1. **What should the Home meter mean?** Evidence: Home says 50% known well while exact Progress says 0 known well. Recommendation: stop presenting a synthetic `young × 0.5` score as mastery; show honest, named buckets or two explicit measures (`100% started`, `0% solid`). Default if unanswered: use mature/total for “known well” and retain started/total separately.
2. **Should exam spacing be allowed to decrease mastery?** Evidence: setting the date or giving a correct answer can persistently move `ivl` 30→6 and solid→young. Recommendation: separate the scheduling constraint (`due`/next gap) from an intrinsic mastery/stability field that does not fall merely because an exam pulls the next review forward. Default: preserve the maximum demonstrated stability across correct early reviews; decrease it only on failure/evidence of forgetting.
3. **How should already-clamped users recover?** Evidence: there is no per-review log, so the former uncapped interval cannot be reconstructed exactly after `ivl` is overwritten. Recommendation: keep existing due dates, stop further mastery erasure, begin storing stability independently, and avoid inventing historical precision. Default: forward-only repair with explicit migration notes; do not infer 21-day mastery merely from repetition count.
4. **Should repair validation cover Competent Crew only or every course?** Evidence: this identity contains only Competent Crew state; the observed 14/14 plateau is across sections. Recommendation: if other devices/courses show the symptom, collect their exports before generalizing. Default: validate the concrete repair against Competent Crew plus a synthetic cross-course regression fixture, without claiming unsupplied local course states were audited.

found 6 · refuted 1 (16.7%) · killed-by-kill-list 0 · overturned-by-hand 0
