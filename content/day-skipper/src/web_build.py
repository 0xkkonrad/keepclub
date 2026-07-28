#!/usr/bin/env python3
"""Build the Day Skipper course data: build/cards.json and build/img/*.png.

Run:  python3 content/day-skipper/src/web_build.py

Munin ships what this writes — scripts/refresh-courses.sh copies build/ into
web/courses/day-skipper/. Nothing here knows about the app any more: the
service-worker cache key this used to stamp belonged to the standalone Day
Skipper app, which was retired on 28 July 2026, and Munin stamps its own.

The card source of truth stays cards_a|b|c.py — this only re-shapes it for the
browser and shrinks the diagrams so the whole deck is a sane mobile download.

Card ids are a short hash of the question text, so a card keeps its review
history across rebuilds as long as its question is unchanged. Editing a question
is treated as making a new card, which is the honest behaviour: if the prompt
changed, what you remembered about it no longer applies.
"""
import hashlib
import json
import os
import re
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)

import doodles                          # noqa: E402
import figures                          # noqa: E402
import groups                           # noqa: E402
from cards_a import SECTIONS_A          # noqa: E402
from cards_b import SECTIONS_B          # noqa: E402
from cards_c import SECTIONS_C          # noqa: E402

SECTIONS = SECTIONS_A + SECTIONS_B + SECTIONS_C
MEDIA = os.path.join(ROOT, "media")
WEB = os.path.join(ROOT, "build")
IMG = os.path.join(WEB, "img")

# The diagrams are line art rendered at 2x, so a 192-colour palette is visually
# lossless and cuts the deck from 5.4 MB to about 2 MB.
# Resampling is deliberately not applied: it invents intermediate colours along
# every line and antialiased edge, which costs more in the palette than the
# pixels save. The diagrams stay at their rendered 2x size for pinch-zoom.
PALETTE_COLOURS = 192

ALLOWED_TAGS = {"b", "i", "u", "br", "sub", "sup"}


def card_id(question):
    return hashlib.sha1(question.encode("utf-8")).hexdigest()[:10]


def check_html(field, where, errs):
    """The app renders these fields as HTML, so keep the tag set tiny and known.

    Checking the tag *name* is not enough — `<b onmouseover=…>` has an allowed
    name and an event handler. Nothing but the name and an optional slash may
    appear inside the angle brackets.
    """
    for m in re.finditer(r"<([^>]*)>", field):
        inner = m.group(1).strip()
        if not re.fullmatch(r"/?\s*([a-zA-Z][a-zA-Z0-9]*)\s*/?", inner):
            errs.append(f"{where}: tag with attributes or junk: <{inner[:40]}>")
            continue
        tag = re.search(r"[a-zA-Z][a-zA-Z0-9]*", inner).group(0).lower()
        if tag not in ALLOWED_TAGS:
            errs.append(f"{where}: unexpected tag <{tag}>")
    if field.count("<") != field.count(">"):
        errs.append(f"{where}: unbalanced angle brackets")
    for m in re.finditer(r"&(?!#?\w+;)", field):
        errs.append(f"{where}: bare '&' at char {m.start()}")


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


def parse_figure(spec, where, errs):
    """`fig:<name>` or `fig:<name>@<label>,<label>` from a card's third field.

    No `@` means every label on the drawing is lit, which is right when the
    card asks for all of them. With an `@` list, the other labels stay dimmed
    as context — that is how one drawing serves several cards without the
    first one answering the rest.
    """
    body = spec[4:]
    name, _, on = body.partition("@")
    f = figures.FIGS.get(name)
    if not f:
        errs.append(f"{where}: no such figure {name!r}")
        return None
    entry = {"n": name}
    if on:
        wanted = [s.strip() for s in on.split(",") if s.strip()]
        bad = [s for s in wanted if s not in f["l"]]
        if bad:
            errs.append(f"{where}: figure {name} has no label(s) {bad}")
            return None
        entry["on"] = wanted
    return entry


def main():
    os.makedirs(WEB, exist_ok=True)
    figures.main()
    doodles.main()
    sizes = build_images()

    errs, sections, cards, seen = [], [], [], {}
    for idx, (key, title, section_cards) in enumerate(SECTIONS, 1):
        for n, card in enumerate(section_cards, 1):
            q, a = card[0], card[1]
            img = card[2] if len(card) > 2 and card[2] else None
            where = f"{key}#{n}"
            check_html(q, where + " q", errs)
            check_html(a, where + " a", errs)
            cid = card_id(q)
            if cid in seen:
                errs.append(f"{where}: duplicate question, same as {seen[cid]}")
            seen[cid] = where
            figure = None
            if img and img.startswith("fig:"):
                figure = parse_figure(img, where, errs)
                img = None
            elif img and img not in sizes:
                errs.append(f"{where}: missing image {img}")
            entry = {"i": cid, "s": key, "q": q, "a": a}
            if img:
                entry["m"] = img
                entry["d"] = sizes[img]
            if figure:
                entry["f"] = figure
            cards.append(entry)
        sections.append({"k": key, "t": title, "n": len(section_cards), "o": idx})

    groups.check([s["k"] for s in sections], errs)

    if errs:
        print(f"\n{len(errs)} PROBLEMS:")
        for e in errs[:40]:
            print("  " + e)
        sys.exit(1)

    body = {"name": "RYA Day Skipper", "sections": sections,
            "groups": groups.build(sections), "cards": cards}
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
