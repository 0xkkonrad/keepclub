# Design notes

Decisions and constraints behind this deck, kept because they outlive the build.
The deck now ships in Munin; this was the migration plan for getting it out of
`_temp`, and the parts that were only about the move have been dropped.

## What this deck asks of the shared engine

`build/cards.json` is the same shape Day Skipper's `web/cards.json` uses, plus
three fields:

| field | meaning |
|---|---|
| `course` | `"competent-crew"` — what the picker switches on |
| `ds` | the Day Skipper commit the pointers resolved against |
| `r` (per card) | the Day Skipper section a pointer card came from |

Two things the shared engine has to decide, both of which are cheap now and a
migration later:

**Card ids are `sha1(question)[:10]`, unprefixed and unnamespaced — so a pointer
card and the Day Skipper card it points at have the *same id*.** In one app that
means one review history for the facts the two courses share: learn what a
bowline is for on Competent Crew, and Day Skipper counts it as learned. That is
the intended payoff of the pointer design. If it turns out to be unwanted, the
fix is to hash `course + question` instead, and it must happen **before** anyone
has review history, not after.

**Section keys are prefixed `cc-`; Day Skipper's are bare.** So the two decks'
sections can sit in one list with nothing to disambiguate. If Munin would rather
namespace by course, drop the prefix at the same time.

## Keeping the pointers honest

`ref()` matches a Day Skipper card by section key and exact question text, so
**editing a Day Skipper question breaks this build.** That is deliberate, and it
is the only maintenance cost the design has. The error names the card and
suggests the closest match:

```
cc-ropework#3: ref('ropework', 'Bowline'…) matches no Day Skipper card
               — did you mean 'Bowline — use'?
```

**Still worth doing:** a check in Day Skipper's own build, or a CI job, that
rebuilds this deck and fails if a pointer broke. Otherwise the breakage is found
by whoever next builds Competent Crew, which could be weeks after the edit that
caused it. Day Skipper's HEAD moved four times during the few hours this deck was
written (`aac7196` → `3b936ba` → `90d2192` → `de2efa3`), so this is not
hypothetical.

## Things deliberately not done

- **No figures of its own.** The deck attaches Day Skipper's 14 drawings and 4
  of its diagrams. Competent Crew has no topic needing a drawing that Day
  Skipper does not already have — a knot sequence would be the first candidate
  if anyone wants one, and `ds-knots-ropes.png` covers it for now.
- **No video.** Day Skipper's 54 clips are matched to its own cards; the
  matching pipeline in `rya-day-skipper/video/` could be pointed at this deck,
  but the rights question there is unresolved.
- **No Anki media copy step.** `build/decks/*.tsv` reference the Day Skipper
  PNGs by bare filename, so anyone importing needs Day Skipper's `media/*.png`
  in their Anki media folder. If this deck is ever shipped standalone to Anki,
  copy the four PNGs it actually uses.
