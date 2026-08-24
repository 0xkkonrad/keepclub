# Scheduler and learner-documentation contract

The learner-facing source of truth is the deployed
[How studying works](../web/docs/studying/index.html) page. It must describe the
behavior a learner can observe without exposing storage fields or asking them to
understand scheduler jargon. The dated progress audit is incident evidence, not
the general manual.

Keep Club currently ships a custom, simplified SM-2-inspired scheduler. It is
not Anki's legacy scheduler and it is not FSRS. Anki import brings cards and
media, not scheduling history.

## Learner contract

| Surface | Shipped rule | Source anchor |
|---|---|---|
| Again | Wrong or missing answer; established reviews enter relearning and retain 40% of proven spacing. | `web/app.js` `naturalPreview()` / `grade()` |
| Hard | Correct but slow; an established review holds the displayed actual gap and lowers ease. | `web/app.js` `naturalPreview()` / `preview()` / `grade()` |
| Good | Correct; ordinary-review spacing grows by the current ease. Learning or relearning can graduate at retained spacing. | `web/app.js` `naturalPreview()` |
| Easy | Immediate; in ordinary review it grows more than Good and raises ease. In learning or relearning it can graduate at the same retained spacing as Good and does not raise ease. | `web/app.js` `naturalPreview()` / `grade()` |
| Learning loop | Again is reinserted behind about four cards and Hard behind about eight. A new card starts at step 0 and leaves on its third Hard at roughly one day. Relearning starts at step 1, so the second uninterrupted Hard leaves at retained ordinary spacing. Again resets the step to 0, after which three Hards are required. | `web/app.js` `grade()` / answer queue |
| Interval spread | Intervals of at least three days receive about ±5%; the possible range extends at least one day in each direction but can still roll the unchanged day. An ordinary-review Hard is not spread; a graduating relearning Hard is. The exact day count behind a revealed label is applied once; month/year labels are rounded summaries. | `web/app.js` `fuzz()` / `fmtDays()` / `schedulePlan()` / grade-plan persistence |
| Daily new plan | The non-exam value is the automatic daily allowance. When recorded Study has no eligible cards in a section after daily limits, that section may introduce up to 20 extra counted cards even if due repeats remain outside a spent repeat cap. | `web/app.js` `newBudget()` / `startSession()` |
| Daily repeat limit | Caps the ordinary review queue. Excess due cards remain due but are left out of that day's recorded Study; a temporary exam projection may later expire. | `web/app.js` `buildSession()` / `effectiveDue()` |
| Practice Ahead | All learning and due cards in scope, including repeats left by a spent daily cap, plus up to 20 future reviews and up to 20 unseen cards. All answers are non-recording; unseen practice Hard does not retain a learning step between appearances. | `web/app.js` `buildSession()` / `grade()` |
| Repeated-miss flag | Three lifetime Again answers on established reviews; it persists after recovery. | `web/app.js` `LEECH_AT` / `leeches()` |
| Solid | Review state with ordinary/proven spacing of at least 21 days. Learning state takes precedence even when retained proof is still 21+ days. Seen cards receive no partial credit. | `web/app.js` `provenInterval()` / `stateOf()` / progress renderers |
| Maximum interval | 400 days. | `web/app.js` `MAX_IVL` |

## Exam overlay

A future exam changes the experienced plan in two independent ways:

1. `newBudget()` raises a non-zero new-card setting enough to introduce unseen
   cards within roughly the first 60% of the remaining whole days. Zero remains
   an absolute pause.
2. `examCeiling()` caps a newly answered review's experienced spacing at roughly
   20% of the whole days left on the answer date, with a one-day minimum. For an
   existing record, `effectiveDue()` projects that cap from `scheduleOrigin()`—
   the date its current interval was earned—so enabling an exam later can make
   the card immediately due. The projection never postpones it. Today and past
   dates are inactive.

“Inactive” applies to newly calculated plans. A valid grade plan revealed while
the date was still future remains answer-scoped and is committed exactly even if
the learner presses it after midnight on the exam day.

The data model deliberately separates:

- `ivl` / `due`: the answer's ordinary schedule;
- `pv`: the ordinary spacing retained as progress proof; and
- `effectiveDue()`: the earlier due date experienced under the active exam.

Exam mode can therefore make a solid card due soon. Clearing the date exposes
the unchanged ordinary schedule. A learner's explicit Hard or Again answer is
still evidence and can change the ordinary schedule/proof.

An exam projection only makes a card due. The daily repeat limit decides whether
ordinary Study serves it, so copy must never guarantee that every card will be
shown before the exam.

## Progress language

Use these terms whenever a surface names a progress status:

- **not started**
- **learning**
- **bedding in**
- **solid**

"Solid" means a card in ordinary review has at least 21 days of ordinary future
spacing. Learning/relearning takes precedence. Do not describe it as recall
already demonstrated after three weeks.
Contextual instructions may still call the card itself “new” or say it has been
seen, but do not give one progress status a different label such as “known well.”

Legacy progress that predates the 2026-08-22 repair falls back to surviving
per-card intervals. Answer totals cannot reconstruct longer intervals already
overwritten by the old exam scheduler.

## Documentation drift gate

When any rule above changes:

1. update the scheduler and focused behavior tests;
2. update `web/docs/studying/index.html` in learner language;
3. update this contract if the internal meaning changed;
4. update the learner-contract checks in `scripts/build-docs.mjs`; and
5. run `node scripts/build-docs.mjs --check`, `node tests/docs-site.mjs`, the
   relevant scheduler/browser suites, and `node tests/pwa.mjs` if availability
   or links changed.

The deploy preflight runs `build-docs.mjs --check`. Its code anchors, phrase
checks, and in-memory mutation probes are a drift tripwire, not a general
semantic proof. The probes specifically reject expanded Practice batches and
durable Practice counters before release; focused behavior suites remain
responsible for the complete rules, and both layers must pass review.
