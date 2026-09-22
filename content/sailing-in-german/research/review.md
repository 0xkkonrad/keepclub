# Sailing in German: adversarial review

All 87 cards, covering 100 terms, passed after one article correction.
Three independent reviewers checked every card; a fourth independently
verified the finding and the final correction. No cards were sampled or omitted.
A final completeness critic confirmed all 87 IDs and all 25 diagram uses are
covered, with no unresolved findings or missing review work.

The original candidate was `a6df992c05d2fa669f0eb74c3909f92a705d8a88`;
the corrected candidate was `1ca2a160ff40f37c4a4514288ecc934c05d2e65c`.
The final deck's SHA-256 is
`19635742cfe81cf0159d65cb836d67c515b19603b59dac5cdb470f5e54971143`.
See [review-scope.md](review-scope.md) for scope, exclusions, tool adaptations
and the human decision list. [review.json](review.json) records a rationale,
reference links and verdict for each card, plus the verification evidence.

## Confirmed

- **MEDIUM, resolved:** card `d553c9df09` taught **das Freibord**.
  A learner would memorize the wrong noun gender. [Duden](https://www.duden.de/rechtschreibung/Freibord)
  specifies **der Freibord**. The finder, independent verifier and author
  checked this separately. The source and compiled card now use **der Freibord**,
  retaining the same ID, answer and diagram. Confirmed twice: verifier and
  author checked the exact source, dictionary entry and compiled prompt.

## Refuted with evidence

No submitted findings were refuted. The verifier explicitly looked for a
recognized neuter variant of *Freibord* and found no dictionary support.

## By design — do not fix

The user's request permits small related sets and reused sailing pictures.
The course has 78 single-term cards, six pairs, two three-term sets and one
four-term points-of-sail set. The seven reused drawings highlight only the
terms named on the current card. No finding was dismissed under these rulings.

## Reassuring negatives

- Sections 01–07: 31 cards and 15 diagram uses checked.
- Sections 08–14: 28 cards and seven diagram uses checked.
- Sections 15–20: 28 cards and three diagram uses checked.
- The combined reviewer ledger covers exactly the 87 final card IDs once each.
  The independent verifier compared both complete snapshots: all 100 unique
  headwords remain, all answers and figure references are preserved, and no
  unexplained content change exists.
- *Flaute* moved from navigation to wind during the author's editorial reread;
  its ID, wording and answer are unchanged. All 20 sections contain two to
  five cards.
- Every card was opened at 320px, 390px and 1280px widths. All 25 diagram uses
  displayed highlighted labels. No horizontal overflow, missing requests or
  JavaScript errors occurred. Three cards per viewport were revealed, graded
  and confirmed in this course's stored progress.
- A final browser check confirmed the corrected article and the *Flaute* move.
  The generated source and shipped files agree; the existing four decks are
  byte-for-byte unchanged.
- Course separation, schema migration evidence, public documentation freshness
  and the production sync preflight passed. All app regression stages passed.
  The initial run lost its local preview server during `qa-regressions.mjs`;
  after restarting the server, that stage and the remaining migration/PWA
  stages passed on rerun. No app code change was needed.

## Open rulings

None. Content review has no unresolved findings.

found 1 · refuted 0 (0%) · killed-by-kill-list 0 · overturned-by-hand 0
