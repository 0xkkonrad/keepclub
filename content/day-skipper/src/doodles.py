#!/usr/bin/env python3
"""The app's chrome doodles: the pristine drawings, and the file the app loads.

These are the small 32x32 drawings that mark progress — the frieze, the section
art, the achievement icons, the boot screen. They used to live as a literal
inside `web/app.js`. They live here now because they are drawn twice: the
geometry below is what a person edits, and `web/doodles.js` is what the app
loads, re-drawn by `rough.py` so the line looks like a hand made it rather than
a plotter. Editing the generated file is pointless — the next build overwrites
it.

Run: python3 src/doodles.py   (or let web_build.py do it)
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
WEB = os.path.join(ROOT, "build")
sys.path.insert(0, HERE)

import rough                                          # noqa: E402

# ── the drawings, as authored ────────────────────────────────────────────────
# One path set each, stroked in currentColor. Coordinates are in a 32x32 box.

SOURCE = {
    "boat": "M4 22c6 3.6 18 3.6 24 0l-2.6 4.6c-5.6 2.4-13.2 2.4-18.8 0z M16 3v19 M17.4 5.6c6.2 4.8 8 11 7.4 16.4h-7.4z M14.6 8.4c-4.6 3.6-6.4 9-6 13.6h6z",
    "buoy": "M16 27V13 M10.4 13h11.2l-1.8 7.4h-7.6z M12 4.6l-2.4-2 M20 4.6l2.4-2",
    "anchor": "M16 8.2v18.6 M9.6 12.4h12.8 M6.4 18.6c.4 6.4 4.6 9 9.6 9s9.2-2.6 9.6-9 M4.4 19.8l2-1.2 2 1.4 M27.6 19.8l-2-1.2-2 1.4",
    "wave": "M2 12c3.4-4.4 6.6-4.4 10 0s6.6 4.4 10 0 6.6-4.4 8-1.6 M2 19c3.4-4.4 6.6-4.4 10 0s6.6 4.4 10 0 6.6-4.4 8-1.6",
    "gull": "M3 16c4.6-6.4 9-6.4 12.4 0 M15.4 16c3.4-6.4 7.8-6.4 12.4 0",
    "lighthouse": "M11.4 28h9.2l-1.8-13.4h-5.6z M12.6 7.4h6.8l.8 7.2h-8.4z M16 3.2v4.2 M22.6 9.4l5-2.6 M9.4 9.4l-5-2.6 M12.4 21.4h7.2",
    "knot": "M11 22c-6.6-4.8-4.4-14 5-14s11.6 9.2 5 14 M9.6 12.4c5 5.4 7.8 5.4 12.8 0 M11 22l-3 6 M21 22l3 6",
    "fish": "M4 16c5-6.4 12-6.4 17 0-5 6.4-12 6.4-17 0z M21 16l6-4.6v9.2z",
    "compass": "M16 2.6l3.2 10.2L29.4 16l-10.2 3.2L16 29.4l-3.2-10.2L2.6 16l10.2-3.2z",
    "wheel": "M16 5.6v20.8 M5.6 16h20.8 M8.6 8.6l14.8 14.8 M23.4 8.6L8.6 23.4",
    "moon": "M21.4 4.6a12 12 0 1 0 6 15.4 9.6 9.6 0 0 1-6-15.4z M25.4 6.4l1 2.6 2.6 1-2.6 1-1 2.6-1-2.6-2.6-1 2.6-1z",
    "sun": "M16 3v4 M16 25v4 M3 16h4 M25 16h4 M7 7l2.8 2.8 M22.2 22.2 25 25 M25 7l-2.8 2.8 M9.8 22.2 7 25",
    "chart": "M4 8.4c4-2.4 8-2.4 12 0s8 2.4 12 0v15.2c-4 2.4-8 2.4-12 0s-8-2.4-12 0z M16 8.4v15.2 M4 16c4-2.4 8-2.4 12 0s8 2.4 12 0",
    "flag": "M8 28V4 M8 5.4h16l-3.4 5 3.4 5H8",
    "lifering": "M16 5.6v4.4 M16 22v4.4 M5.6 16H10 M22 16h4.4",
    "crossing": "M6 27c3 1.6 7 1.6 10 0l-1.2 3c-2.6 1.2-5 1.2-7.6 0z M11 8v19 M12 10c3.4 2.6 4.4 6.6 4 11h-4z M20 17c2.4 1.2 5.6 1.2 8 0l-1 2.4c-2 1-4 1-6 0z M24 6v11 M25 7.6c2.6 2 3.4 5 3 8.4h-3z",
    "lamp": "M12 26h8 M13 14h6l1 12h-8z M13 14V9h6v5 M16 9V5 M23 8l4-2.4 M9 8L5 5.6 M24 15h4 M8 15H4",
    "horn": "M5 13h6l10-6v18l-10-6H5z M5 13v6 M24 11c2.4 3 2.4 7 0 10 M27.4 8c3.4 4.6 3.4 11.4 0 16",
    "dividers": "M16 5.6v3 M15 8.6 8 26.4 M17 8.6 24 26.4 M11.2 18.6h9.6 M8 26.4l-1.6 2.4 M24 26.4l1.6 2.4",
    "plotter": "M4 24h24L4 8z M9.6 21.4v-6 M14.6 21.4v-4 M19.6 21.4v-2",
    "current": "M2 11c3.4-4.2 6.6-4.2 10 0s6.6 4.2 10 0 6.4-4 8-1.6 M2 20c3.4-4.2 6.6-4.2 10 0s6.6 4.2 10 0 6.4-4 8-1.6 M26 6.4 30 9.4l-4 3 M26 15.4l4 3-4 3",
    "flash": "M16 4v6 M16 22v6 M4.6 16h6 M21.4 16h6 M8 8l4 4 M20 20l4 4 M24 8l-4 4 M12 20l-4 4",
    "cloud": "M10 22a5.4 5.4 0 0 1 0-10.8 7.4 7.4 0 0 1 14-1.6 5.2 5.2 0 0 1-1.4 12.4z M11 25.4l-1.4 3 M17 25.4l-1.4 3 M23 25.4l-1.4 3",
    "fogbank": "M4 22c5 2.6 15 2.6 20 0l-2 4c-4.6 2-11.4 2-16 0z M14 6v16 M15.4 8c4.6 3.6 6 8.2 5.6 12.4h-5.6z M2 12h8 M18 12h12 M2 17h5 M24 17h6",
    "flare": "M16 28V15 M11.6 15h8.8L16 4z M13 20.6l-4 4 M19 20.6l4 4 M9.4 12 5 9.4 M22.6 12 27 9.4",
    "propeller": "M16 13.4c-3.4-4.6-8.6-6.6-11-4.4s0 7.4 5 10 M16 13.4c4.4-3.6 10-4 11.4-1s-2.6 7-8.2 8.2 M16 18.6c-1 5.6 1 10.6 4.2 10.6",
    "route": "M5 26.4 11 17l5 4 6-11.4 M24 5.6v9 M24 6.4h5l-2 2.4 2 2.4h-5",
    "radar": "M16 16 24 8 M16 16v11.4 M9 9l3 3 M23 9l-3 3 M9 23l3-3",
}

# A few need a circle, which cannot live in a path list. They are folded into
# the path set on the way out: a roughened circle is not a circle any more.
DOTS = {
    "lifering": [[16, 16, 10.4], [16, 16, 5.2]],
    "lamp": [[16, 11.4, 1.4]],
    "flash": [[16, 16, 4.6]],
    "propeller": [[16, 16, 2.4]],
    "radar": [[16, 16, 12], [16, 16, 6], [20.4, 11.6, 1.4]],
    "route": [[5, 26.4, 1.6], [11, 17, 1.4], [16, 21, 1.4]],
    "buoy": [[16, 8.6, 2.6]],
    "anchor": [[16, 5.4, 2.8]],
    "fish": [[9.6, 14.6, 1.1]],
    "compass": [[16, 16, 13]],
    "wheel": [[16, 16, 10.4]],
    "sun": [[16, 16, 5.4]],
}

# ── generate ─────────────────────────────────────────────────────────────────

def main():
    out = []
    for name, d in SOURCE.items():
        circles = "".join('<circle cx="%s" cy="%s" r="%s"/>' % (cx, cy, r)
                          for cx, cy, r in DOTS.get(name, ()))
        drawn = rough.redraw(circles + '<path d="%s"/>' % d, rough.DOODLE, 32)
        # Back to one flat path string, which is all `doodle()` in app.js wants.
        paths = rough.re.findall(r'\bd="([^"]*)"', drawn)
        out.append('  %s: \'%s\',' % (name, " ".join(paths)))

    js = ("/* Generated by src/doodles.py — do not edit; edit the drawings there.\n"
          " *\n"
          " * Every drawing in the app's chrome, as one path set each, stroked in\n"
          " * currentColor. Inline rather than files: they are a few hundred bytes each,\n"
          " * they have to inherit the theme colour, and an <img> would want a second copy\n"
          " * for dark mode. Loaded before app.js because the boot screen draws one before\n"
          " * anything is fetched.\n"
          " *\n"
          " * The line is re-drawn by rough.py, so nothing here is a straight line or a\n"
          " * true circle. That is the point. */\n"
          "const DOODLE = {\n%s\n};\n" % "\n".join(out))

    path = os.path.join(WEB, "doodles.js")
    with open(path, "w", encoding="utf-8") as f:
        f.write(js)
    print("doodles : %d  %dK" % (len(SOURCE), os.path.getsize(path) // 1024))


if __name__ == "__main__":
    main()
