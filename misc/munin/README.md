# Munin — the raven identity, kept

The app was called **Munin** from its first commit until 28 July 2026, after Odin's raven of
memory: the one who flies out each day and comes back each night. It is now **keep club**
(see [../../naming-domains.md](../../naming-domains.md)), and the bird is not part of the new
identity.

Nothing here is loaded by the app. This folder exists because the drawings were good and a
generator plus fourteen hand-tuned paths is not the sort of thing to leave in a diff.

| file | what it is |
|---|---|
| `doodles-munin.js` | the shipped set as of the rename: fourteen ravens + the two theme glyphs |
| `build.py` | the generator — clean 32×32 geometry through the seeded `rough.py`, which is what gave them their wobble |
| `ravens.png` | all sixteen rendered, in ink teal, so you can see them without running anything |
| `icon-*.png` | the app icons that carried the bird |

**The fourteen, and what each was for.** `perch` was the logo — the plain standing raven.
`peek` looked over the top edge of a flashcard. `flap`, `carry` and `roost` flew, carried a card
and slept. `hoard` bent over a shiny thing, which is what the achievement set was named after.
`puff`, `strut`, `quill` and `bow` filled out the frieze — ten drawings, never more, because ten
is what fits a 320px screen. `prints`, `nest`, `worm` and `shell` were added on 28 July so the
hoard's fourteen slots were fourteen distinct drawings; `nest` and `worm` each took four rounds
to read right at small sizes.

**To bring one back**, copy the path into `web/doodles-munin.js` — the format is unchanged — or
run `build.py` against the geometry in it. `rough.py` is seeded, so a rebuild is byte-identical
to what shipped.
