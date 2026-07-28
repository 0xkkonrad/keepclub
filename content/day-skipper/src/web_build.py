#!/usr/bin/env python3
"""Build the Day Skipper course data: build/cards.json and build/img/*.png.

Run:  python3 content/day-skipper/src/web_build.py

Munin ships what this writes — scripts/refresh-courses.sh copies build/ into
web/courses/day-skipper/. Nothing here knows about the app any more: the
service-worker cache key this used to stamp belonged to the standalone Day
Skipper app, which was retired on 28 July 2026, and Munin stamps its own.

The card source of truth is `cards/` — markdown, one file per section, parsed
and validated by content/mdc.py (the 28 July 2026 migration; the python card
modules this used to import are gone). This only re-shapes it for the browser
and shrinks the diagrams so the whole deck is a sane mobile download.

Card ids are a short hash of the question text, so a card keeps its review
history across rebuilds as long as its question is unchanged. Editing a
question is treated as making a new card unless the card pins its id — see
course-source.md at the repo root.
"""
import hashlib
import json
import os
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.dirname(ROOT))

import doodles                          # noqa: E402
import figures                          # noqa: E402
import mdc                              # noqa: E402

CARDS = os.path.join(ROOT, "cards")
MEDIA = os.path.join(ROOT, "media")
WEB = os.path.join(ROOT, "build")
IMG = os.path.join(WEB, "img")

# The diagrams are line art rendered at 2x, so a 192-colour palette is visually
# lossless and cuts the deck from 5.4 MB to about 2 MB.
# Resampling is deliberately not applied: it invents intermediate colours along
# every line and antialiased edge, which costs more in the palette than the
# pixels save. The diagrams stay at their rendered 2x size for pinch-zoom.
PALETTE_COLOURS = 192


def build_images():
    os.makedirs(IMG, exist_ok=True)
    for f in os.listdir(IMG):
        if f.endswith(".png"):
            os.remove(os.path.join(IMG, f))
    sizes = {}
    before = after = 0
    for name in sorted(os.listdir(MEDIA)):
        if not name.endswith(".png"):
            continue
        # `cc-*` are the Competent Crew cuts of shared diagrams, generated here
        # because that is where the drawing code lives, but read by that deck's
        # build. This app never shows them, and the shell is cache-first, so
        # shipping them would cost every user the download for nothing.
        if name.startswith("cc-"):
            continue
        src = os.path.join(MEDIA, name)
        im = Image.open(src).convert("RGB")
        out = os.path.join(IMG, name)
        im.quantize(colors=PALETTE_COLOURS, method=Image.MEDIANCUT).save(out, optimize=True)
        # the app reserves the right aspect ratio before the image loads, so the
        # answer text never jumps when a diagram arrives
        sizes[name] = [im.width, im.height]
        before += os.path.getsize(src)
        after += os.path.getsize(out)
    print(f"images   : {len(sizes)}  {before // 1024}K -> {after // 1024}K")
    return sizes


def main():
    os.makedirs(WEB, exist_ok=True)
    figures.main()
    doodles.main()
    sizes = build_images()

    deck = mdc.parse_course(CARDS)

    errs, sections, cards = [], [], []
    for s in deck.sections:
        for c in s.cards:
            figure = None
            if c.fig:
                figure = mdc.parse_figure(c.fig, figures.FIGS, c.where, errs)
            elif c.img and c.img not in sizes:
                errs.append(f"{c.where}: missing image {c.img}")
            entry = {"i": c.id, "s": s.key, "q": c.q, "a": c.a}
            if c.img:
                entry["m"] = c.img
                entry["d"] = sizes.get(c.img)
            if figure:
                entry["f"] = figure
            cards.append(entry)
        sections.append({"k": s.key, "t": s.title, "n": len(s.cards), "o": s.order})

    if errs:
        print(f"\n{len(errs)} PROBLEMS:")
        for e in errs[:40]:
            print("  " + e)
        sys.exit(1)

    body = {"name": deck.name, "sections": sections,
            "groups": mdc.build_groups(deck, sections), "cards": cards}
    # A content hash, not a number someone has to remember to bump.
    body["build"] = hashlib.sha1(
        json.dumps(body, ensure_ascii=False, sort_keys=True).encode("utf-8")
    ).hexdigest()[:8]
    path = os.path.join(WEB, "cards.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(body, f, ensure_ascii=False, separators=(",", ":"))

    print(f"sections : {len(sections)} in {len(body['groups'])} groups")
    print(f"cards    : {len(cards)}")
    print(f"cards.json: {os.path.getsize(path) // 1024}K")
    print("validation clean")


if __name__ == "__main__":
    main()
