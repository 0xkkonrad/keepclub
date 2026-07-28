# -*- coding: utf-8 -*-
"""A read-only view of the Day Skipper card source.

Nothing here writes into the Day Skipper tree, and nothing here is copied out of
it. The Competent Crew deck *points* at Day Skipper cards; this module is the
only thing that knows where they live.

The pointer is `(section_key, front_text)` rather than an index, because an
index silently re-points at a different card the moment somebody inserts a card
above it, and a wrong-but-plausible card is the worst possible failure for a
deck. Matching on the question text fails loudly instead: edit a Day Skipper
question and the Competent Crew build stops until somebody looks at it. That is
the honest behaviour, and it is the same bet `web_build.py` makes when it hashes
the question into the card id.
"""
import hashlib
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

# Search order, first hit wins. Day Skipper's source moved into this repo on
# 28 July 2026, alongside this one, when its standalone app was retired — so a
# clone of Munin can now rebuild this deck on its own, which it could not before.
# The old external checkouts stay in the list: they are harmless if absent, and
# anyone with one lying around gets the same answer either way.
CANDIDATES = [
    os.environ.get("DS_ROOT"),
    # content/competent-crew → content → content/day-skipper
    os.path.join(ROOT, "..", "day-skipper"),
    # the standalone repo, wherever it was kept
    os.path.join(ROOT, "..", "..", "..", "rya-day-skipper"),
    os.path.join(ROOT, "..", "..", "projects", "rya-day-skipper"),
    os.path.join(ROOT, "..", "rya-day-skipper"),
]


def _find_root():
    for c in CANDIDATES:
        if not c:
            continue
        p = os.path.abspath(c)
        if os.path.isfile(os.path.join(p, "src", "cards_a.py")):
            return p
    raise SystemExit(
        "cannot find the Day Skipper checkout — set DS_ROOT to it.\n"
        "  tried: " + ", ".join(os.path.abspath(c) for c in CANDIDATES if c)
    )


DS_ROOT = _find_root()
DS_SRC = os.path.join(DS_ROOT, "src")
DS_MEDIA = os.path.join(DS_ROOT, "media")


def _load():
    """Import the Day Skipper card modules without polluting our own imports.

    `sys.path` is restored afterwards so a later `import figures` in this repo
    cannot silently resolve to Day Skipper's.
    """
    saved = list(sys.path)
    sys.path.insert(0, DS_SRC)
    try:
        from cards_a import SECTIONS_A
        from cards_b import SECTIONS_B
        from cards_c import SECTIONS_C
        import figures
        return SECTIONS_A + SECTIONS_B + SECTIONS_C, figures.FIGS
    finally:
        sys.path[:] = saved


SECTIONS, FIGS = _load()

# (section_key, front) -> (front, back, img_or_none)
BY_KEY = {}
# front -> [section_key, ...], for the "you meant this one" error message
BY_FRONT = {}
# section_key -> title
TITLES = {}

for _key, _title, _cards in SECTIONS:
    TITLES[_key] = _title
    for _c in _cards:
        _front, _back = _c[0], _c[1]
        _img = _c[2] if len(_c) > 2 and _c[2] else None
        BY_KEY[(_key, _front)] = (_front, _back, _img)
        BY_FRONT.setdefault(_front, []).append(_key)


def commit():
    """What this build resolved its pointers against, as a hash of the cards.

    Recorded in the built deck so a deck can be traced back to the exact card
    wording it inherited, which is the one thing a pointer costs you.

    A hash of the three card files rather than the repo's HEAD, which is what
    this was while Day Skipper lived in a repo of its own. Since it moved in
    here, HEAD moves every time anything in Munin is committed — a boot-screen
    tweak would have changed this stamp, made the shipped cards.json differ from
    a rebuild, and had refresh-courses.sh report DIFF on a deck nobody touched.
    The wording is what the stamp is about; hash the wording.
    """
    h = hashlib.sha1()
    for name in ("cards_a.py", "cards_b.py", "cards_c.py"):
        try:
            h.update(open(os.path.join(DS_ROOT, "src", name), "rb").read())
        except OSError:
            return "unknown"
    return h.hexdigest()[:10]


class Ref:
    """A pointer to a Day Skipper card. Resolved at build time, never inlined.

    `at` is the Competent Crew section it lands in; it is separate from the Day
    Skipper section because the two decks group the same facts differently — a
    Day Skipper `handling` card about winches is Competent Crew `sail handling`.

    `media` handles the diagram the pointed-at card carries. The cards were
    triaged against the Competent Crew exclusion list and the diagrams were not,
    so a pointer can inherit an answer that is in scope under a picture that is
    not — `ds-mob.png` teaches a Mayday, `ds-points-of-sail.png` teaches right of
    way. `media=False` drops it and keeps the words; `media="cc-…png"` swaps in
    the Competent Crew cut of the same sheet. Say why at the call site.
    """

    __slots__ = ("section", "front", "at", "why", "media")

    def __init__(self, section, front, at=None, why="", media=True):
        self.section = section
        self.front = front
        self.at = at
        self.why = why
        self.media = media

    def resolve(self, where, errs):
        card = BY_KEY.get((self.section, self.front))
        if card:
            return card
        # Wrong section but the question exists — say so, it is the common typo.
        elsewhere = BY_FRONT.get(self.front)
        if elsewhere:
            errs.append(
                f"{where}: ref({self.section!r}, …) — that question is in "
                f"section {elsewhere[0]!r}, not {self.section!r}"
            )
        else:
            hint = _hint(self.section, self.front)
            errs.append(
                f"{where}: ref({self.section!r}, {self.front[:60]!r}…) "
                f"matches no Day Skipper card{hint}"
            )
        return None


def _hint(section, front):
    """Suggest the card that was probably meant. Only ever an error message.

    Character-level rather than word-level: the likeliest way to break a pointer
    is a one-character difference in a short question — `Draft` for `Draught`,
    a missing `&mdash;` — and word-set overlap scores those at zero, which is
    precisely backwards. `difflib` is right for both long and short.
    """
    import difflib
    pool = [f for (k, f) in BY_KEY if k == section]
    near = difflib.get_close_matches(front, pool, n=1, cutoff=0.6)
    if near:
        return f" — did you mean {near[0][:70]!r}?"
    # Nothing close in that section: maybe the section is wrong too.
    near = difflib.get_close_matches(front, list(BY_FRONT), n=1, cutoff=0.75)
    if near:
        return (f" — the closest card anywhere is {near[0][:60]!r} "
                f"in section {BY_FRONT[near[0]][0]!r}")
    return ""


def ref(section, front, why="", media=True):
    return Ref(section, front, why=why, media=media)
