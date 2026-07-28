"""Candidate name-marks, drawn through the same seeded rough.py as the ravens.

One mark per shortlisted name, for the branding mockups. Same 32x32 conventions as
design/raven-doodles/build.py: clean geometry here, the hand comes from rough.py.
Nothing here ships — these exist so a name can be judged with a drawing beside it.
Two were redrawn after failing the small-size read: a spotlight became a curtain
(it read as a bell at 34px) and a knot became a coil (it read as a squiggle).
Run with no args to rebuild marks.json and a _marks.png contact sheet.
"""
import os, sys, subprocess
REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(REPO, "content", "day-skipper", "src"))
import rough, json, re

# 32x32, same conventions as SOURCE in design/raven-doodles/build.py:
# clean geometry in, rough.py puts the hand into it.
MARKS = {
    # understudy — a spotlight waiting on an empty mark. The pool is where you
    # will stand; nobody is standing there yet.
    # understudy — the curtain, still closed. Two swags and the rail.
    "curtain": "M3.4 6.2h25.2"
               " M7 6.6c.6 5.6.8 11.2.4 16.8 3-1.2 4.8-3.8 5.2-7.4.4-3.2.2-6.4-.4-9.4"
               " M25 6.6c-.6 5.6-.8 11.2-.4 16.8-3-1.2-4.8-3.8-5.2-7.4-.4-3.2-.2-6.4.4-9.4"
               " M5.6 27.4h20.8",
    # shoebox — lid ajar, two cards standing up out of it
    "shoebox": "M6 14.4h20v12H6z M4.4 12.2 27.6 9.8l.8 3.4L5.2 15.6z"
               " M11.6 14V6.6l4.4-1.6V14 M19.4 14V7.6l3.4-1.2V14",
    # ropes — an overhand knot, the "learn the ropes" mark
    # ropes — a coil of rope, side on. Three turns and the working end.
    "ropecoil": "M5.6 11.4c0-2.4 4.6-4.4 10.4-4.4s10.4 2 10.4 4.4-4.6 4.4-10.4 4.4-10.4-2-10.4-4.4z"
                " M5.6 11.4v4.4c0 2.4 4.6 4.4 10.4 4.4s10.4-2 10.4-4.4v-4.4"
                " M5.6 15.8v4.4c0 2.4 4.6 4.4 10.4 4.4s10.4-2 10.4-4.4v-4.4"
                " M26.4 20.2c1.8 2 2.4 4.6 1.8 7.4",
    # flashbulb — bulb + the flash. Kept for completeness, not recommended.
    "bulb": "M16 6c-3.6 0-6.4 2.8-6.4 6.2 0 2.4 1.2 3.8 2.2 5.2.8 1.2 1.2 2 1.2 3.2h6"
            "c0-1.2.4-2 1.2-3.2 1-1.4 2.2-2.8 2.2-5.2C22.4 8.8 19.6 6 16 6z"
            " M13 23.4h6 M13.8 26.4h4.4 M4.8 8.2 7.4 10 M27.2 8.2 24.6 10 M16 2.2v-.2",
    # keep — the tower that holds what matters, crenellated, one arched door
    "keep": "M8 12h16v16H8z M8 12v-3.6h3.2V12 M14.4 12V8.4h3.2V12 M20.8 12V8.4H24V12"
            " M13.2 28v-6.4c0-1.6 1.2-2.8 2.8-2.8s2.8 1.2 2.8 2.8V28",
}
DOTS = {}

out = {}
for n, d in MARKS.items():
    circles = "".join('<circle cx="%s" cy="%s" r="%s"/>' % (c[0], c[1], c[2]) for c in DOTS.get(n, ()))
    drawn = rough.redraw(circles + '<path d="%s"/>' % d, rough.DOODLE, 32)
    out[n] = " ".join(re.findall(r'\bd="([^"]*)"', drawn))

S = os.path.dirname(os.path.abspath(__file__))
json.dump(out, open(S + "/marks.json", "w"), indent=1)

body = "".join('<div class=c><svg viewBox="0 0 32 32" fill=none stroke="#121214" stroke-width=2 '
               'stroke-linecap=round stroke-linejoin=round><path d="%s"/></svg>'
               '<svg viewBox="0 0 32 32" fill=none stroke="#121214" stroke-width=2 '
               'stroke-linecap=round stroke-linejoin=round class=sm><path d="%s"/></svg>'
               '<b>%s</b></div>' % (d, d, n) for n, d in out.items())
html = ("<!doctype html><meta charset=utf-8><style>body{margin:0;background:#f0eee7;"
        "font:12px monospace;display:flex;flex-wrap:wrap;gap:6px;padding:10px}"
        ".c{width:150px;text-align:center}svg{width:120px;height:120px}"
        "svg.sm{width:34px;height:34px}b{display:block;font-weight:400;color:#55555e}</style>" + body)
open(S + "/_marks.html", "w").write(html)
chrome = os.path.expanduser("~/.cache/ms-playwright/chromium_headless_shell-1217/"
                            "chrome-headless-shell-linux64/chrome-headless-shell")
subprocess.run([chrome, "--headless", "--disable-gpu", "--no-sandbox",
                "--screenshot=" + S + "/_marks.png", "--window-size=820,340",
                "file://" + S + "/_marks.html"], check=True,
               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
print("drew", len(out), "marks ->", S + "/_marks.png")
