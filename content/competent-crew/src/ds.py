# -*- coding: utf-8 -*-
"""A read-only view of the Day Skipper course source.

Nothing here writes into the Day Skipper tree, and nothing here is copied out
of it. The Competent Crew deck *points* at Day Skipper cards; this module is
the only thing that knows where they live. Since the markdown migration
(28 July 2026) the cards themselves are parsed by content/mdc.py — the same
parser every build reads through — and this module only finds the tree and
loads its figure set. Pointer resolution, hints and the provenance stamp all
live in mdc, keyed on the parsed deck.
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

# Search order, first hit wins. Day Skipper's source moved into this repo on
# 28 July 2026, alongside this one, when its standalone app was retired — so a
# clone of Munin can rebuild this deck on its own. The old external checkouts
# stay in the list: they are harmless if absent, and anyone with one lying
# around gets the same answer either way.
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
        if os.path.isdir(os.path.join(p, "cards")):
            return p
    raise SystemExit(
        "cannot find the Day Skipper course source — set DS_ROOT to it.\n"
        "  tried: " + ", ".join(os.path.abspath(c) for c in CANDIDATES if c)
    )


DS_ROOT = _find_root()
DS_SRC = os.path.join(DS_ROOT, "src")
DS_CARDS = os.path.join(DS_ROOT, "cards")
DS_MEDIA = os.path.join(DS_ROOT, "media")


def _load_figs():
    """Import the Day Skipper figure set without polluting our own imports.

    `sys.path` is restored afterwards so a later import in this repo cannot
    silently resolve to Day Skipper's modules.
    """
    saved = list(sys.path)
    sys.path.insert(0, DS_SRC)
    try:
        import figures
        return figures.FIGS
    finally:
        sys.path[:] = saved


FIGS = _load_figs()
