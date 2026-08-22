# Keep Club progress plateau audit and repair

Verdict: the reported 50% plateau was a real code smell, not expected progress behavior and not corrupt user data. The app awarded every merely-seen card half credit while exam mode kept overwriting the same interval used as the mastery signal. The progress-only repair is deployed.

- Case: supplied Competent Crew export from `2026-08-22T11:18:43.458Z`, build `7cf550d2`; 200 cards across 14 sections and 903 internally consistent answers. The supplied Sync secret is omitted from every artifact.
- Audited baseline: `c702c0a6ab03ef245a509f720d6083c74e918801`.
- Repaired source: `ce0046eb6969d2ca7410f224f0d0456f9c044f8b`; Pages deployment: `e40bdaa348ed32707cac0901cd13997f55ffae6a`.
- Scope: scheduling proof, exam due projection, Home/Progress semantics and accessibility, progress ingestion/backup/sync, revealed-plan reload safety, and the progress-sync rollout fence. No course content, visual redesign, or unrelated app subsystem was changed.
- Review method: isolated read-only finder/verifier waves against detached clean worktrees, a RULING-grade kill-list, main-loop browser reproductions for material claims, a final immutable completeness review, and production end-to-end QA. Claude Workflow was unavailable, so collaboration agents preserved the required role separation.

## Confirmed

### C-01 · The 50% display was synthetic, not earned mastery — fixed

Home used `(mature + young × 0.5) / total` and labelled the result “known well.” The supplied deck had 200 young cards and zero mature cards, so all 14 fully seen sections were forced to exactly 50% even though expanded Progress correctly said `0 solid`. No render freeze was required: the formula itself manufactured the plateau.

Home and Progress now use the same definition: `known well = proven interval ≥ 21 days`. An all-young section is therefore honestly 0%, a real fraction below 1% is announced as “less than 1%,” and milestone percentages floor instead of rounding up early. Partial meters put the value once in the section button’s accessible name and leave the visual bar decorative. Anchors: `web/app.js:1197-1215`, `web/app.js:2671-2709`, `web/app.js:6337-6362`, `web/achievements.js:682-717`.

For the supplied state, the immediate visible change is 14 rows at 0% known well rather than 14 false rows at 50%. That is deliberately honest: the app cannot prove historical mastery that the old scheduler already erased. Future correct answers can now build the underlying proof past 21 days even while the next review remains pulled forward for the exam.

### C-02 · Exam scheduling destructively rewrote mastery — fixed

The old scheduler stored the exam-capped gap in `ivl`, and `ivl` was also the only mastery signal. With 28 days to the supplied exam, the cap was six days, below the intentional 21-day solid threshold. Setting the date or pressing Good/Easy could therefore rewrite a 30-day mature card to six days, demote it to young, and leave it demoted after the exam was cleared.

The repaired model separates three ideas:

- `ivl`/`due` hold the ordinary schedule produced by the answer.
- `pv` holds proven stability and does not fall merely because an exam asks for an earlier review.
- `effectiveDue()` projects the active exam cap without mutating the canonical record. Every due consumer—counts, ordinary sessions, study-ahead selection, completion copy, and forecast—uses that projection.

Good and Easy preserve the same-roll uncapped result as proof; Hard keeps the exact displayed actual gap without lowering existing proof; Again remains real evidence of forgetting and retains 40% of proof. Today or past exam dates are inactive. An answer revealed before midnight commits the interval printed on its button, including its accessible label, even if it is pressed after midnight. Anchors: `web/app.js:931-1008`, `web/app.js:1019-1093`, `web/app.js:1111-1183`.

### C-03 · Reload, merge, and rollout seams could have reintroduced loss — fixed before release

Adversarial implementation waves found additional progress-only seams: capped provenance could attach to a different merge winner, malformed schedule revisions could poison proof, a revealed button promise could be rerolled on reload or across midnight, an exam-setting change could leave a stale promise visible, and a legacy sync writer could race the v2 transition.

The repair now validates and bounds `pv`, `sr`, `lp`, and the answer-scoped exam-commit map; joins proof only within the winning lapse/schedule epoch; persists an already-revealed four-button plan in tab-local session storage; binds it to the exact card record and literal exam setting; and falls back visibly to an unrevealed question when that bundle is legacy, malformed, or stale. One clock snapshot builds all four grade plans. Anchors: `web/app.js:315-439`, `web/app.js:2134-2278`, `web/app.js:4731-4777`, `web/sync.js:225-348`.

Database migrations `20260822152000`, `20260822170000`, and `20260822183000` add the writer capability and close the read/adoption/conflict races. The final GET uses one locked snapshot; PUT adopts legacy rows before CAS, commits the fence on a stale conflict, and preserves throttling for existing v2 rows. The deployment script refuses to copy web files unless non-mutating production fingerprints prove that exact boundary is installed.

## Refuted with evidence

### R-01 · The user’s records were lost, capped by storage, malformed, stale, or from the wrong deck

REFUTED. Export and shipped build both equal `7cf550d2`; each has the same 200 unique card IDs. There were zero missing, orphaned, malformed, or sanitizer-dropped records. Restore, cold load, and a self sync merge retained all 200. The 23,079-byte blob was only 8.8% of the 262,144-byte limit. Counters reconcile: 903 answers equal both summed card repetitions and summed daily history, while eight repeat misses equal eight lapses.

The stronger explanation was the intact state itself: all 200 records had surviving intervals of 2–7 days, so the old Home formula gave each exactly half credit.

### R-02 · The final repair still contains a reachable progress regression

REFUTED on the immutable `ce0046e` tree. Three independent final lenses attacked 31 scheduler, UI/session, merge, migration, and rollout claims; all 31 were refuted and no high, medium, or low implementation finding survived. Independent seeded checks covered 100,000 projection records, 50,000 capped grades, 250 whole-deck states/50,000 due-consumer checks, and 200,000 merge triples with zero invariant failure.

Material boundary reproductions also passed: the exact 200-card/14-section plateau rendered 14 honest 0% Home rows and 14 `0 solid` Progress rows; a reveal at 23:59 followed by reload/grade after midnight kept its exact displayed promise while storing 75-day ordinary proof and a one-day exam commitment; malformed, legacy, settings-mismatched, and record-stale plans resumed at the question with grades hidden.

### R-03 · The repair expanded into unrelated product behavior

REFUTED. Production changes are confined to progress scheduling/presentation/session/backup hooks, progress merge/transport capability, achievement proof derivation, additive sync migrations, and the DB-first deployment gate. All other touched files are progress-focused tests or these audit artifacts.

## By design — do not fix

1. Keep the exam-date clamp. Cramming mode must change when cards are reviewed; it now does so as a derived due-date projection instead of erasing mastery.
2. Keep the 21-day solid/known-well threshold. The repair makes it reachable under exam mode without weakening its meaning.
3. Hard holds the actual scheduled gap while retaining stronger proof. It does not jump from a displayed six-day choice to a hidden 38-day schedule.
4. Again is evidence of forgetting and may reduce proof, currently to 40%; a near exam by itself may not.
5. Once a row is adopted by v2, old sync clients fail closed. Allowing them to keep writing could erase `pv`, `sr`, or exam provenance.
6. Browser session storage is not a security boundary. Malformed/stale shapes are rejected, but a deliberate same-origin actor able to rewrite it can also rewrite durable local progress.

## Reassuring negatives

- The complete local `npm test` command passed all 34 suites at the pinned SHA. Focused totals included progress 51/51, sync merge 110/110, QA regressions 73/73, front-only UI 27/27, notes 77/77, and deployment preflight 9/9.
- All final browser and hand reproductions reported zero page errors. The detached target was clean before and after every final verifier.
- Production received all three migrations before the frontend. The live readiness checker confirms locked read/conflict fences and public grants.
- A disposable production row completed the legacy-write → v2-adoption → legacy-refusal → v2 proof/provenance write → stale-CAS path. It was deleted through the linked management boundary; a follow-up database query found zero probe rows.
- Live `app.js` SHA-256 is `1ea4db4a7fa5f1fb8832d48755fccd2cc7aac8bcfda2760c412aec7c402c0300`; live `sync.js` is `bb52be6dcd7573160ba7b7ebf11b19a44b42cd0419fc4863aa39c5c3457c699b`; the service-worker shell generation is `ffd6488ead`. These match the reviewed source and Pages tree.
- Production E2E passed progress 51/51, QA regressions 73/73, and front-only UI 27/27 against `https://keepclub.app/`.
- The supplied state’s 903 answers, 14 study dates, ten-day streak, 573 repeats, 565 repeat successes, and eight lapses were coherent. This was never a storage-loss incident.

## Open rulings

There is no blocking product or deployment ruling left.

One historical limitation remains: old capped intervals contain no trustworthy record of the larger interval they overwrote, so exact past mastery cannot be reconstructed. The repair is forward-only: retain the surviving evidence, stop erasing it, and let future correct answers establish uncapped proof. Automatically awarding 21-day mastery from repetition count would invent evidence and is intentionally not done.

Final immutable adversarial wave: found 31 · refuted 31 (100%) · killed-by-kill-list 0 · overturned-by-hand 0 · surviving findings 0.
