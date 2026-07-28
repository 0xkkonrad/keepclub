#!/usr/bin/env python3
"""Munin's own doodle set — the ravens — drawn clean and re-drawn by the same
`rough.py` every course set goes through, so Munin's line matches the courses'.

    python3 design/raven-doodles/build.py            # check: does it match what ships
    python3 design/raven-doodles/build.py --write    # write web/doodles-munin.js

The set was hand-assembled from `design/theme-picker/ravens.py` when the theme
was locked, and had no generator: redrawing one meant editing 1.5 KB of path
data in the shipped file by hand. The first ten entries here are that script's
geometry verbatim, and this rebuilds them byte-for-byte — rough.py is seeded, so
a diff in those ten means somebody changed a drawing.

WHY THERE ARE FOURTEEN. The hoard has fourteen entries and Munin's defaults are
drawn from this set, so ten drawings meant four visible duplicate pairs on every
imported deck. The four added on 28 Jul 2026 are the ones the character notes in
project.md already called for — prints, nest, worm, shell — and each takes over
the hoard entry it belongs to.

Legibility, learned the hard way: these are stroked at 2px in a 32-unit box, so
a loop or a gem below about r2.5 fills in and becomes a dot.
"""
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, os.path.join(REPO, "content", "day-skipper", "src"))
import rough  # noqa: E402

OUT = os.path.join(REPO, "web", "doodles-munin.js")

# 32x32 boxes, same conventions as the course sets' doodles.py.
SOURCE = {
    # 1 — classic standing raven, side view, facing left. The app mark.
    "perch": "M9.2 10.6c.2-3 2.2-5 5-5 3 0 5.2 2.2 5.6 5.2l.6 4.4 7 3.6-7.2-.2c-.4 4-3 6.4-6.6 6.4-3.6 0-6.4-2.8-6.4-6.4 0-3.2 1.4-5.8 2-8.2z M9.2 10.6 4.6 12l4.8 1.2 M13.4 25v3.2 M17 25v3.2 M13.4 28.2l-1.6 1.2 M13.4 28.2l1.4 1.2 M17 28.2l-1.6 1.2 M17 28.2l1.4 1.2",
    # 2 — head peeking over the top edge of a flashcard
    "peek": "M5 15.2h22v11.4H5z M9.4 19.8h9.6 M9.4 22.6h6.6 M13 15.2c-.4-6 2.2-9.6 5.6-9.6 3.4 0 5.8 3.6 5.4 9.6 M13.4 9.4l-4 1.2 4.1 1.2",
    # 3 — flying, wings up
    "flap": "M8.8 19.6c1.4-2.8 4-4.4 7-4.4 3.4 0 6 1.6 7.6 4.4l4.6 3-5.6-.4c-1.8 1.6-4.2 2.4-6.6 2.4-3.4 0-6.4-1.8-7-5z M8.8 19.6l-4.6.8 4.8 1.4 M12.8 15.8C11 12.4 10.6 8.6 11.8 5c1.8 2.4 2.6 5.6 2.4 9.4 M18.2 15.8c1.8-3.4 2.2-7.2 1-10.8-1.8 2.4-2.6 5.6-2.4 9.4",
    # 4 — flying, carrying a flashcard in its claws
    "carry": "M12.7 10.6c.2-3 2.2-5 5-5 3 0 5.2 2.2 5.6 5.2l.6 4.4 7 3.6-7.2-.2c-.4 4-3 6.4-6.6 6.4-3.6 0-6.4-2.8-6.4-6.4 0-3.2 1.4-5.8 2-8.2z M12.7 10.6 8.1 12l4.8 1.2 M16.9 25v3.2 M20.5 25v3.2 M16.9 28.2l-1.6 1.2 M16.9 28.2l1.4 1.2 M20.5 28.2l-1.6 1.2 M20.5 28.2l1.4 1.2 M2.4 13.2h5.6v4.2H2.4z",
    # 5 — asleep on a branch, one z
    "roost": "M3 24.8h4.6 M24.6 24.8H29 M8.2 24.8c-1.2 1.4-1.8 2.8-2 4.4 M9.8 24.4c-1.6-2-2.4-4.2-2.4-6.6 0-5 3.6-8.6 8.6-8.6s8.6 3.6 8.6 8.6c0 2.6-.8 4.8-2.6 6.6z M7.5 14.2l-3.2 1.2 3.3 1 M11.8 14.6c1 1 2.4 1 3.4 0 M23.6 6.4h3.6l-3.6 3.6h3.6",
    # 6 — bent over a shiny thing (the hoard), facing right
    "hoard": "M22.8 10.6c-.2-3-2.2-5-5-5-3 0-5.2 2.2-5.6 5.2l-.6 4.4-7 3.6 7.2-.2c.4 4 3 6.4 6.6 6.4 3.6 0 6.4-2.8 6.4-6.4 0-3.2-1.4-5.8-2-8.2z M22.8 10.6l4.6 1.4-4.8 1.2 M15 25v3 M18.6 25v3 M23.4 24.6l3.2-3.6 3.2 3.6-3.2 4z",
    # 7 — round fluffball, front-facing
    "puff": "M14.9 17l1.1 1.8 1.1-1.8z M13 7.4l-1-2.4 M16 7V4.4 M19 7.4l1-2.4 M6.8 18.6c-.6 2.4 0 4.6 1.8 6.2 M25.2 18.6c.6 2.4 0 4.6-1.8 6.2 M13.2 26.6l-.4 2.6 M18.8 26.6l.4 2.6",
    # 8 — mid-strut, crow's-feet prints trailing behind
    "strut": "M24.6 11.4c-.2-2.8-2-4.6-4.6-4.6-2.8 0-4.8 2-5.2 4.8l-.6 4-6 3.2 6.2-.2c.4 3.6 2.8 6 6 6 3.4 0 6-2.6 6-6 0-3-1.4-5.4-1.8-7.2z M24.6 11.4l4.2 1.2-4.4 1.2 M19.2 24.4l-1.6 3.6 M23 24.4l1 3.4 M3.6 26.4l1.6 2.6 M5.8 26v3 M8 26.4l-1.6 2.6 M10.4 27l1.6 2.6 M12.6 26.6v3 M14.8 27l-1.6 2.6",
    # 9 — a single feather
    "quill": "M9.4 24.8c-.2-6.4 2.6-12.6 8-16.8 3.2-2.4 5.8-3.4 7.2-2.6-.2 1.6-1.6 4.4-4.2 7.4-4.4 5-8 8.4-11 12z M8 27.6C13.2 21 19 13 24.6 5.2 M13.8 17.6l3.2 1.2",
    # 10 — string tied round the leg: the reminder knot
    "bow": "M9.2 9.1c.2-3 2.2-5 5-5 3 0 5.2 2.2 5.6 5.2l.6 4.4 7 3.6-7.2-.2c-.4 4-3 6.4-6.6 6.4-3.6 0-6.4-2.8-6.4-6.4 0-3.2 1.4-5.8 2-8.2z M9.2 9.1 4.6 10.5l4.8 1.2 M12.6 23.4v3 M12.6 26.4l-1.6 1.2 M12.6 26.4l1.4 1.2 M17.4 23.4l.4 2.2 M17.8 26.6c-3.2-2.4-6-.4-4.2 1.9 1.4 1.7 3.4.6 4.2-1.9z M17.8 26.6c3.2-2.4 6-.4 4.2 1.9-1.4 1.7-3.4.6-4.2-1.9z M16.6 29l-1 1.6 M19 29l1 1.6",

    # ── added 28 Jul 2026, so the hoard's fourteen are fourteen drawings ──

    # 11 — a trail of crow's feet across the box. The character notes call these
    # the workhorse: a card seen, a day done, a section entered. Three prints
    # climbing left to right, so it reads as having been somewhere.
    "prints": "M5.4 25.2l2.4 3.4 M8.2 24.2v4.2 M11 25.2l-2.4 3.4 M12.6 17.2l2.4 3.4 M15.4 16.2v4.2 M18.2 17.2l-2.4 3.4 M19.8 9.2l2.4 3.4 M22.6 8.2v4.2 M25.4 9.2l-2.4 3.4",
    # 12 — the nest, with two eggs in it. Built, not found: a section finished.
    "nest": "M5.6 16.4c1.6 6.4 5.4 9.8 10.4 9.8s8.8-3.4 10.4-9.8 M3.8 16.4h24.4 M6.6 12.4l2.8 4 M12.4 11.8l2.4 4.6 M18.6 11.8l2.4 4.6 M24 12.4l-2.8 4 M10 19.6l2.8 2.6 M18.4 19.6l2.8 2.6",
    # 13 — the worm, out of the ground at last. What being stuck and then
    # unstuck looks like from the raven's side.
    "worm": "M3 26.4h26 M7.6 22.6c1.6-2.8 4-2.8 5.6 0 1.6 2.8 4 2.8 5.6 0 1.2-2 3-2.4 4.6-1.2 M10.4 20.4l.8 2.6 M16 20.4l.8 2.6",
    # 14 — a hatched shell, the cap lifted off. Every card in the deck met.
    "shell": "M9.4 17.6c0 4.6 3 7.6 6.6 7.6s6.6-3 6.6-7.6 M9.4 17.6l2.2-2.4 2.2 2.4 2.2-2.4 2.2 2.4 2.2-2.4 2 2.4 M11.6 10.2c1-3.2 3-4.8 4.4-4.8s3.4 1.6 4.4 4.8 M11.6 10.2l2.2 2.2 2.2-2.2 2.2 2.2 2.2-2.2",
}

# Round things the redraw would otherwise turn into wobbly polygons.
DOTS = {
    "perch": [[12.2, 10, 1.0]],
    "peek": [[16.4, 10.2, 1.2]],
    "flap": [[11.8, 18, 1.0]],
    "carry": [[15.7, 10, 1.0]],
    "hoard": [[20, 10, 1.0]],
    "puff": [[16, 17, 9.8], [12.6, 14.2, 1.1], [19.4, 14.2, 1.1]],
    "strut": [[21.8, 10.8, 1.0]],
    "quill": [[6.4, 29, 0.9]],
    "bow": [[12.2, 8.5, 1.0]],
    # The eggs. r2.7 — below about 2.5 a circle at this stroke weight fills in
    # and reads as a full stop.

    "worm": [[23.6, 21, 1.0]],
}

HEAD = """/* Munin's own doodles — the raven set, drawn through the same rough.py
 * pipeline as every course set. Used by the shelf, by the hoard's own
 * defaults, and as the theme for any course that brings no drawings of its
 * own. perch is the app mark.
 *
 * Generated by design/raven-doodles/build.py — do not edit; edit the clean
 * geometry there and re-run it.
 */
const MUNIN_DOODLE = {
"""

TAIL = """};

/* `const` at the top level of a classic script does not become a property of
 * globalThis, so import.js — which is a module, with its own scope — cannot see
 * this set at all. Every doodle on the importer drew as an empty path until
 * this line existed. */
globalThis.MUNIN_DOODLE = MUNIN_DOODLE;
"""


def build():
    out = {}
    for name, d in SOURCE.items():
        circles = "".join('<circle cx="%s" cy="%s" r="%s"/>' % (cx, cy, r)
                          for cx, cy, r in DOTS.get(name, ()))
        drawn = rough.redraw(circles + '<path d="%s"/>' % d, rough.DOODLE, 32)
        out[name] = " ".join(rough.re.findall(r'\bd="([^"]*)"', drawn))
    return out


def render(paths):
    body = "".join(
        '<div class="c"><svg viewBox="0 0 32 32" fill="none" stroke="#121214" '
        'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
        '<path d="%s"/></svg><b>%s</b></div>' % (d, n) for n, d in paths.items())
    return ("<!doctype html><meta charset=utf-8><style>body{margin:0;background:#f0eee7;"
            "font:12px monospace;display:flex;flex-wrap:wrap;gap:4px;padding:8px}"
            ".c{width:120px;text-align:center}svg{width:110px;height:110px}"
            "b{display:block;font-weight:400;color:#55555e}</style>" + body)


if __name__ == "__main__":
    paths = build()
    js = HEAD + "".join("  %s: '%s',\n" % (n, d) for n, d in paths.items()) + TAIL

    if "--png" in sys.argv:
        html = os.path.join(HERE, "_sheet.html")
        png = os.path.join(HERE, "_sheet.png")
        with open(html, "w", encoding="utf-8") as f:
            f.write(render(paths))
        chrome = os.path.expanduser(
            "~/.cache/ms-playwright/chromium_headless_shell-1217/"
            "chrome-headless-shell-linux64/chrome-headless-shell")
        subprocess.run([chrome, "--headless", "--disable-gpu", "--no-sandbox",
                        "--screenshot=" + png, "--window-size=880,560",
                        "file://" + html], check=True,
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        print("sheet  :", png)

    if "--write" in sys.argv:
        with open(OUT, "w", encoding="utf-8") as f:
            f.write(js)
        print("wrote  :", OUT, "(%d drawings)" % len(paths))
    else:
        with open(OUT, encoding="utf-8") as f:
            shipped = f.read()
        same = [n for n, d in paths.items() if ("  %s: '%s',\n" % (n, d)) in shipped]
        print("drawings:", len(paths), " already shipped byte-identical:", len(same))
        missing = [n for n in paths if n not in same]
        if missing:
            print("differ or new:", ", ".join(missing))
