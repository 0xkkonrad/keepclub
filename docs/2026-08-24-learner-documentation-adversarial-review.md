# Keep Club learner-documentation adversarial review

Audit date: 2026-08-24. Baseline: `main` at
`10c63993a7c378815cb059d66db3197d46629e14` plus the scoped progress-logic
repairs described below.

Before the final freeze, the already-landed upstream commit `d6f45a2` (quiet
email feedback links) was inherited unchanged. It is not a finding or repair in
this scope.

The learner-facing result is simple: the old Home screen manufactured 50% by
giving every seen card half credit. Keep Club now shows the honest percentage
of cards with at least 21 days of earned ordinary spacing. A heavily used deck
can therefore move from 50% to 0% without losing a single answer: 0% means
“none of these cards has 21-day proof yet,” not “your work disappeared.” The
public guide also explains that Keep Club uses its own simplified,
SM-2-inspired scheduler; it is neither Anki's scheduler nor FSRS.

**Preflight.** The target was pinned at
`10c63993a7c378815cb059d66db3197d46629e14` in detached worktree
`/tmp/keepclub-docs-audit-20260824-zNhQIC/target`. In scope were learner-facing
progress and scheduling explanations; discovery from first run, Home,
Progress, Settings, and About; responsive and offline access; nearby Sync,
backup, import, and deck-file boundaries where they affect a learner's mental
model; and the maintainer drift contract. Scheduler replacement, sync-protocol
changes, course-authoring semantics, and unrelated copy were out of scope.
Evidence came from the UI, scheduler, importer, receipt, achievements, service
worker, generated references, browser hand reproductions at 320px and 375px,
mutation probes, and the complete repository test suite.

The exact reviewed product tree is the C-sorted `sha256sum` manifest of 577
tracked or unignored files, excluding this report, its verdict JSON, and the
two unrelated pre-existing `2026-08-22-feedback-minimal-placement` artifacts.
The manifest digest is
`d11a28660426d9c03073dd6f8b9ac5d38af768d1fda22af086ee77279c41cef1`.
The supplied Sync capability is deliberately absent from all persisted
artifacts and evidence.

Four independent finder/verifier lenses attacked learner comprehension,
behavioral truth, information architecture/accessibility, and offline/drift
resilience. The main loop deduplicated candidates, ran severity-gated hand
reproductions, and owned the final rulings. Six contexts were found in the
decision kill list; all were `RECORDED`, none was a named `RULING`, and none
could kill a finding. Repair observations that reopened an existing candidate
were retained as verification history rather than inflated into new findings.

found 63 · refuted 13 (20.6%) · killed-by-kill-list 0 · overturned-by-hand 0

Of 50 confirmed findings, 49 are fixed and one low-severity behavior is
explicitly documented while awaiting a product ruling. The canonical registry,
aliases, severities, evidence anchors, hand repros, reopen history, and wave
accounting are in
`docs/2026-08-24-learner-documentation-verdicts.json`.

## Confirmed

The initial learner-journey pass confirmed all 18 candidates:

| ID | What could mislead or block a learner | Resolution |
|---|---|---|
| V01 | There was no public guide for grades, progress, exams, Practice, repeated misses, interval spread, or daily limits. | Added `/docs/studying/` as the learner source of truth. |
| V02 | Help was hard to discover from the app itself. | Linked the guide from first run, Home/Progress, Settings, About, creator docs, and diagnostics. |
| V03 | Prose could drift from scheduler behavior with no canonical contract or release tripwire. | Added `docs/scheduler.md`, generation checks, mutation-tested anchors, and behavioral regression ownership. |
| V04 | Mobile documentation navigation was incomplete and its label understated what it opened. | Added complete, accurately labelled, keyboard-operable phone navigation. |
| V05 | Docs pointed to old locations for Sync, build data, and deck-file actions. | Updated every route to the shipped Settings/About locations. |
| V06 | Learner help could fail or become the app shell while offline. | Added exact-page docs caching and route-specific validation. |
| V07 | First-run copy said Hard always returned within minutes, although an ordinary review can return weeks later. | Defined Hard by recall quality and documented its context-specific schedule. |
| V08 | Again/Hard/Good/Easy had no plain-language definitions. | Added learner definitions beside the scheduling consequences. |
| V09 | New-card learning and retained-spacing relearning were presented as one path. | Documented both paths, including Hard sequences and resets. |
| V10 | Exam projection looked like it changed ordinary mastery proof. | Explained the two clocks: ordinary proof and an earlier experienced due date. |
| V11 | Exam mode can raise a non-zero new-card plan, while zero deliberately pauses new cards. | Explained both rules and the first-60%-of-days pacing window. |
| V12 | Copy promised every card before an exam even when repeat limits can exclude some. | Replaced the promise with truthful due-versus-served wording. |
| V13 | The old synthetic 50% and the new solid percentage were unexplained. | Added the concrete “old 50%, honest 0%, no answers lost” explanation. |
| V14 | “Known well” and “still there three weeks later” claimed demonstrated recall the app does not measure. | Standardized on “solid”: at least 21 days of earned ordinary spacing. |
| V15 | Practice looked like recorded Study and did not explain its selection. | Marked it non-recording before, during, and after a round; documented its queue. |
| V16 | “Slipping” sounded like current weakness, but the filter is three lifetime Again answers. | Renamed and explained it as cumulative repeated-miss history. |
| V17 | Slight interval variation and the persistence of a revealed plan were invisible. | Documented the roughly ±5% spread, possible unchanged midpoint, and committed shown choice. |
| V18 | The daily new-card number looked like a universal maximum. | Called it the daily plan and documented exam and empty-section additions. |

The first post-repair attack confirmed 14 more distinct defects:

| ID | Adversarial reproduction | Resolution |
|---|---|---|
| BTR01 | Relearning Hard retained old spacing and therefore did not behave like new-card Hard. | Split the explanations and added deterministic scheduler coverage. |
| BTR02 | A spent repeat cap could leave due backlog inside Practice while Home or the recorded-Study completion screen said nothing was due. | Named due backlog and capped unseen/future additions in Home, completion, and the guide. |
| BTR03 | Excess exam-due reviews did not universally “wait until tomorrow”; a temporary projection can expire. | Explained omission from today's plan without promising tomorrow. |
| GATE01 | Equivalent semantic mutations could pass the first token-only prose tripwire. | Broadened contract anchors, added mutation probes, and made behavioral tests authoritative. |
| OFF01 | Generic Keep Club markers allowed the wrong guide to poison the learner route. | Validate each document by its requested canonical identity. |
| OFF02 | Headerless portal bodies could be accepted as CSS, SVG, or schema. | Require exact asset MIME families and test impostors. |
| IA01 | Browse and Progress used competing state vocabularies. | Unified visible terms around solid, seen, learning, and not seen. |
| IA02 | The guide used undefined “ease” and “established” jargon. | Replaced it with observable plain language. |
| IA03 | Fragment headings landed under the wrapped phone header. | Added mobile scroll clearance and measured it at 320px/375px. |
| LC01 | A closed phone menu still overlaid the introduction. | Hide closed disclosure contents visually and from interaction. |
| LC04 | Relearning can temporarily outrank solid proof, while an achievement claimed “solid again” at seven days. | Explained state precedence and changed the achievement to “worked back to a week.” |
| LC07 | Browse called a recovered card one that “keeps slipping.” | Changed it to the historical fact: missed three or more times. |
| MOBILE01 | A long diagnostic code widened the page beyond a 320px viewport. | Made generated codes wrap safely. |
| PRACTICE01 | Unseen Practice cards do not retain temporary learning steps, so repeated Hard does not follow recorded Study's three-Hard exit. | Added an explicit warning; product behavior remains an open low-severity ruling. |

The immutable-completeness and final-acceptance reviews confirmed seven artifact
and service-worker defects, all fixed before the reviewed manifest was frozen:

| ID | Failure | Resolution |
|---|---|---|
| SEC-01 | A draft audit artifact retained the supplied Sync capability. | Removed the contaminated artifact, scanned source and review outputs, and excluded the value from all evidence. |
| AUDIT-01 | The reviewed product lacked a reproducible immutable digest. | Added the 577-file product-manifest scope and digest above and in the verdict JSON. |
| AUDIT-02 | Findings had no canonical registry or reconciled statistics. | Added a unique 63-candidate registry with aliases, histories, evidence, and exact wave accounting. |
| AUDIT-03 | Recorded defaults were incorrectly labelled “by design.” | Reserved that category for ruling-grade decisions; moved recorded contexts to Open rulings. |
| AUDIT04 | Exact candidate, kill-list, and deploy-test evidence pointers became stale or were misattributed. | Followed every challenged pointer, corrected lines/symbols, cited the docs-site preflight-order assertion, and aligned machine-readable negatives. |
| SWUPDATE01 | A same-build worker could overwrite an active shell cache before validating the replacement. | Stage and validate the candidate generation before replacing the active complete generation. |
| SWASSET01 | A correct-MIME impostor could poison documentation assets. | Validate expected body identity as well as status and MIME. |

The final user-copy critic confirmed 11 boundary and precision defects:

| ID | Misleading edge | Resolution |
|---|---|---|
| SYNC_SCOPE_01 | Settings understated what one Sync key can access. | Says one key covers synced progress, settings, notes, and written/edited cards for every built-in course. |
| LOCAL_BACKUP_01 | A local-deck backup sounded portable or disaster-recoverable. | Says it restores only into that exact local deck while it still exists in the browser profile. |
| SHOWN_GAP_01 | Rounded month/year labels were called exact intervals. | Exact under 30 days; longer labels are summaries of exact stored days. |
| RELEARN_EASY_01 | Generic Easy copy promised an ease increase that learning/relearning does not make. | Describes Good/Easy graduation truthfully and names the contexts where ease changes. |
| EXAM_ANCHOR_01 | Exam projection prose omitted the original-answer-date anchor. | Explains that existing schedules project from their original answer date and can become immediately due. |
| STORAGE_BOUNDARY_01 | Local state was described as “on this device.” | Uses the real boundary: this browser profile on this site. |
| IMPORTED_ACHIEVEMENT_01 | An import achievement said “reviews” although it counts local-deck answer events. | Names local-deck answers. |
| DECK_FILE_COPY_01 | Local-deck help hid or denied the separate card export. | Separates Deck file (cards) from Backup (history, notes, edits) throughout creation/import/Settings flows. |
| RELEARN_RESET_01 | The guide omitted that another Again restarts relearning. | Documents the reset to step zero and three uninterrupted Hards afterward. |
| FUZZ_ZERO_01 | “At least one day” implied interval spread must change the result. | Says the range extends each way but can land on the unchanged midpoint. |
| ACHIEVEMENT_LUNCH_01 | Any lunch-hour answer was described as retained memory. | Uses the measurable claim: “studied over lunch.” |

Wave reconciliation: 18 initial confirmed + 14 post-repair confirmed + 7 first
refutations + 6 immutable confirmed + 6 immutable refutations + 11 final-copy
confirmed + 1 final-acceptance artifact finding = 63 unique candidates. Seven repair observations reopened V13, V02,
V04, GATE01, V18, and BTR02 twice; they are histories of those candidates, not
seven additional findings.

## Refuted with evidence

These 13 refute-framed attacks did not survive verification:

| ID | Claim attacked | Why it was refuted |
|---|---|---|
| R01 | The repaired app still uses standard Anki or FSRS scheduling. | Runtime, importer boundary, project overview, learner guide, and maintainer contract all identify the custom simplified SM-2-inspired model. |
| R02 | Merely seeing a card still earns half progress. | Home and Progress share the solid predicate; the concrete 200-seen-card fixture is 0%, never 50%. |
| R03 | Exam mode still overwrites ordinary mastery proof. | Ordinary interval/proof and effective exam due date remain separate across set, clear, reload, and sync-merge tests. |
| R04 | Practice mutates durable schedules, totals, streaks, or achievements. | A complete browser round leaves those durable facts byte-equivalent. |
| R05 | Repeated-miss means currently weak and clears after recovery. | It is intentionally derived from the cumulative Again counter; revised copy says so. |
| R06 | A revealed interval rerolls after reload or midnight. | The answer-scoped plan persists and the browser resumes the same shown choice. |
| R07 | Offline learner help can silently become the app, another guide, or a portal. | Exact-route page identity and typed/body-identified assets survive adversarial offline tests. |
| R08 | Keyboard users cannot skip repeated navigation or operate phone docs navigation. | Skip links, native disclosure controls, focus order, and automated keyboard journeys all pass. |
| R09 | A shipped docs link, fragment, canonical, or local asset route is broken. | The docs crawler and 320px/375px browser journeys resolve every checked target. |
| R10 | The persisted audit lacks the required five-section topology or parseable JSON. | This report has exactly the five required sections in order; the registry parses and reconciles 63 unique IDs. |
| R11 | A partial new-generation update deletes the last complete offline generation. | Failed-update tests retain the complete old shell/course generation while removing only partial candidates. |
| R12 | Deployment copies files before checking generated documentation. | The docs-site preflight-order check proves generation and drift checks precede the copy step. |
| R13 | Checked-in schema or diagnostic references are stale. | `node scripts/build-docs.mjs --check` reports the scheduler contract, schema, and generated errors current. |

## By design — do not fix

None. No named-human, ruling-grade decision was found. The review therefore
does not use “by design” to freeze a behavior or suppress future evidence.

## Reassuring negatives

- No card question, card answer, media, scheduler formula, solid threshold,
  sync protocol, or course-authoring rule changed in this scoped pass.
- Home, Progress, and achievements use the same ordinary proven-spacing source
  for solid counts.
- A future exam can pull a card forward without manufacturing or erasing solid
  proof; clearing the exam exposes the unchanged ordinary schedule.
- Practice remains deliberately non-recording; the change is explanation and
  truthful queue/summary behavior, not a hidden progress write.
- Every learner entry point resolves to the same canonical guide. Phone pages
  neither overflow nor bury fragment targets under the header.
- Offline docs retain exact page and asset identity across wrong-page, portal,
  correct-MIME impostor, same-build update, and partial-generation attacks.
- The supplied Sync capability is absent from the source diff, review
  artifacts, and frozen product snapshot. The contaminated temporary snapshot
  was removed before commit or deployment.
- The final tree passed `git diff --check`, generated-doc drift checks, the 270
  authoring checks, 129 import/deck checks, 59 progress checks, 105 achievement
  checks, 73 broad QA checks, 19 PWA/offline checks, and the complete sequential
  `npm test` release gate with exit code 0.

## Open rulings

One candidate is counted as a confirmed but intentionally unimplemented product
choice:

1. **PRACTICE01 — unseen Practice cards do not retain temporary learning
   steps.** Repeated Hard therefore does not use recorded Study's three-Hard
   exit. The guide now says this before the behavior can surprise a learner.
   Recommendation: keep the warning in this progress-logic-scoped release and,
   if smoother Practice is desired later, evaluate session-only ephemeral
   learning state with proof that it never persists. Default without a ruling:
   keep current behavior and warning.

The kill-list audit also found six contextual defaults. They are not additional
candidate findings and cannot kill future proposals because their provenance is
`RECORDED`, not a named product `RULING`:

1. **21-day solid threshold (K02).** Keep because all repaired surfaces agree;
   allow a future explicit threshold proposal.
2. **Exam mode as a derived due-date overlay (K01).** Keep the non-destructive
   overlay pending explicit product review.
3. **Ordinary-review Hard holds its displayed gap (K03).** Keep the honest
   displayed-gap behavior pending an explicit scheduler decision.
4. **Again retains roughly 40% of proven spacing (K04).** Keep the current
   retention rule pending an explicit scheduler decision.
5. **Custom simplified SM-2-inspired scheduling rather than FSRS (K05).**
   Document what ships; treat any scheduler migration as a separate decision.
6. **Exam-focused planning posture (K06).** Keep the learner explanation while
   leaving future product changes open.
