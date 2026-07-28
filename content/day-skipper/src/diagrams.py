#!/usr/bin/env python3
"""Author RYA Day Skipper study diagrams as SVG, then render to PNG.

All artwork is original (no third-party images), so the deck is safe to share.
Diagrams use a white background and dark strokes so they read in Anki's
default light theme.
"""
import math
import os
import re
import subprocess
import sys

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "media")
CHROME = os.path.expanduser(
    "~/.cache/ms-playwright/chromium_headless_shell-1217/chrome-headless-shell-linux64/chrome-headless-shell"
)

CSS = """
  text { font-family: 'DejaVu Sans', Helvetica, Arial, sans-serif; fill: #14202b; }
  .t   { font-size: 15px; }
  .s   { font-size: 12.5px; }
  .xs  { font-size: 11px; }
  .h   { font-size: 19px; font-weight: 700; }
  .b   { font-weight: 700; }
  .mono{ font-family: 'DejaVu Sans Mono', monospace; font-size: 12.5px; }
  .ln  { stroke: #14202b; stroke-width: 1.6; fill: none; }
  .lnf { stroke: #14202b; stroke-width: 1.1; fill: none; }
  .dash{ stroke: #14202b; stroke-width: 1.2; fill: none; stroke-dasharray: 6 4; }
  .grid{ stroke: #b9c6d1; stroke-width: 0.9; fill: none; }
  .red { fill: #d0342c; }
  .grn { fill: #1f8a4c; }
  .yel { fill: #e0a600; }
  .wht { fill: #ffffff; stroke: #14202b; stroke-width: 1.3; }
  .blk { fill: #14202b; }
  .sea { fill: #dbeaf5; }
  .land{ fill: #efe4cb; }
  .note{ font-size: 12px; fill: #4a5b6a; }
  .hdr { fill: #ffffff; font-size: 13px; font-weight: 700; }
"""

# Approximate advance width per character, as a fraction of the font size.
_ADV = {"t": 0.54, "s": 0.54, "xs": 0.54, "h": 0.60, "note": 0.54, "mono": 0.605, "hdr": 0.58}
_SIZE = {"t": 15, "s": 12.5, "xs": 11, "h": 19, "note": 12, "mono": 12.5, "hdr": 13}


def _est_width(classes, text):
    """Rough rendered width of a <text> element, for the overflow check."""
    key = "s"
    for c in classes.split():
        if c in _SIZE:
            key = c
            break
    size = _SIZE[key]
    adv = _ADV[key]
    if " b" in " " + classes:
        adv *= 1.06
    # entities render as one glyph
    t = re.sub(r"&[#\w]+;", "x", text)
    t = re.sub(r"<[^>]+>", "", t)
    return len(t) * size * adv

ARROWS = """
<defs>
  <marker id="a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
    <path d="M0,0 L10,5 L0,10 z" fill="#14202b"/>
  </marker>
  <marker id="ared" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
    <path d="M0,0 L10,5 L0,10 z" fill="#d0342c"/>
  </marker>
  <marker id="ablu" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
    <path d="M0,0 L10,5 L0,10 z" fill="#1d5f9e"/>
  </marker>
  <marker id="agrn" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
    <path d="M0,0 L10,5 L0,10 z" fill="#1f8a4c"/>
  </marker>
</defs>
"""


def pt(cx, cy, r, brg):
    """Point at bearing `brg` (deg, 0 = up/north) radius r from (cx,cy)."""
    a = math.radians(brg)
    return cx + r * math.sin(a), cy - r * math.cos(a)


def sector(cx, cy, r, b1, b2, fill, op=0.5):
    sweep = (b2 - b1) % 360
    x1, y1 = pt(cx, cy, r, b1)
    x2, y2 = pt(cx, cy, r, b2)
    large = 1 if sweep > 180 else 0
    return (
        f'<path d="M{cx},{cy} L{x1:.1f},{y1:.1f} A{r},{r} 0 {large} 1 {x2:.1f},{y2:.1f} Z" '
        f'fill="{fill}" fill-opacity="{op}" stroke="{fill}" stroke-width="1"/>'
    )


def ray(cx, cy, r, brg, cls="dash"):
    x, y = pt(cx, cy, r, brg)
    return f'<line class="{cls}" x1="{cx}" y1="{cy}" x2="{x:.1f}" y2="{y:.1f}"/>'


def hull(cx, cy, L=64, W=30, fill="#ffffff"):
    """Plan-view hull pointing up, centred on (cx,cy)."""
    b, s = cy - L / 2, cy + L / 2
    return (
        f'<path d="M{cx},{b} C{cx + W / 2},{b + L * 0.30} {cx + W / 2},{s - L * 0.12} {cx + W * 0.34},{s} '
        f'L{cx - W * 0.34},{s} C{cx - W / 2},{s - L * 0.12} {cx - W / 2},{b + L * 0.30} {cx},{b} Z" '
        f'fill="{fill}" stroke="#14202b" stroke-width="1.6"/>'
    )



def vector(x1, y1, x2, y2, heads, col="#14202b", w=2.4, dash=""):
    """A plot vector drawn with `heads` chevrons — the RYA convention:
    1 = water track, 2 = ground track, 3 = tidal stream."""
    dx, dy = x2 - x1, y2 - y1
    L = math.hypot(dx, dy) or 1
    ux, uy = dx / L, dy / L
    px, py = -uy, ux
    da = f' stroke-dasharray="{dash}"' if dash else ""
    o = [f'<line x1="{x1}" y1="{y1}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="{col}" stroke-width="{w}" fill="none"{da}/>']
    for i in range(heads):
        bx, by = x2 - ux * i * 9, y2 - uy * i * 9
        ax, ay = bx - ux * 10 + px * 6, by - uy * 10 + py * 6
        cx_, cy_ = bx - ux * 10 - px * 6, by - uy * 10 - py * 6
        o.append(
            f'<path d="M{ax:.1f},{ay:.1f} L{bx:.1f},{by:.1f} L{cx_:.1f},{cy_:.1f}" '
            f'fill="none" stroke="{col}" stroke-width="{w}" stroke-linecap="round"/>'
        )
    return "".join(o)


OVERFLOW = []


def svg(name, w, h, body, title=None):
    """Assemble a diagram, widening the canvas so no text runs off the right edge."""
    head = f'<text class="h" x="18" y="28">{title}</text>' if title else ""
    needed = w
    for m in re.finditer(
        r'<text class="([^"]*)" x="([-\d.]+)"[^>]*?>(.*?)</text>', head + body, re.S
    ):
        if "text-anchor" in m.group(0):
            continue
        end = float(m.group(2)) + _est_width(m.group(1), m.group(3))
        needed = max(needed, end + 18)
    w = int(math.ceil(needed / 2) * 2)
    if w > 1400:
        OVERFLOW.append((name, w, "canvas wider than 1400px — re-wrap this diagram's text"))
    doc = (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">'
        f"<style>{CSS}</style>{ARROWS}"
        f'<rect width="{w}" height="{h}" fill="#ffffff"/>{head}{body}</svg>'
    )
    return name, w, h, doc


def wrap_lines(text, chars):
    """The lines `wrap()` would emit, so a caller can advance y by the height it
    actually used rather than guessing it. Guessing is what put two of the
    Beaufort sheet's paragraphs on top of each other."""
    words, line, lines = text.split(), "", []
    for w in words:
        if len(line) + len(w) + 1 > chars and line:
            lines.append(line)
            line = w
        else:
            line = (line + " " + w).strip()
    if line:
        lines.append(line)
    return lines


def wrap(text, x, y, chars, cls="note", lh=19):
    """Emit <text> lines, wrapping at approximately `chars` characters."""
    return "".join(
        f'<text class="{cls}" x="{x}" y="{y + i * lh}">{ln}</text>'
        for i, ln in enumerate(wrap_lines(text, chars))
    )


def wrap_h(text, chars, lh=19):
    """The vertical space `wrap()` will take."""
    return len(wrap_lines(text, chars)) * lh


D = []

# ---------------------------------------------------------------- 1. light arcs
cx, cy, r = 220, 330, 165
b = []
b.append(sector(cx, cy, r, 0, 112.5, "#1f8a4c", 0.42))
b.append(sector(cx, cy, r, 247.5, 360, "#d0342c", 0.42))
b.append(sector(cx, cy, r, 112.5, 247.5, "#8a97a3", 0.34))
b.append(hull(cx, cy, 90, 40))
for brg in (0, 112.5, 247.5):
    b.append(ray(cx, cy, r + 26, brg))
b.append(f'<circle cx="{cx}" cy="{cy}" r="3" class="blk"/>')
b.append('<text class="s b grn" x="300" y="250">Starboard sidelight</text>')
b.append('<text class="s grn" x="300" y="267">green, 112.5&#176;</text>')
b.append('<text class="s b red" x="20" y="250">Port sidelight</text>')
b.append('<text class="s red" x="20" y="267">red, 112.5&#176;</text>')
b.append('<text class="s b" x="150" y="524">Sternlight: white, 135&#176;</text>')
b.append('<text class="xs" x="152" y="540">(67.5&#176; each side of right aft)</text>')
b.append('<text class="xs" x="196" y="140">ahead 000&#176;</text>')
b.append('<text class="xs" x="330" y="446">22.5&#176; abaft the</text>')
b.append('<text class="xs" x="330" y="460">starboard beam</text>')

cx2, cy2 = 640, 330
b.append(sector(cx2, cy2, r, 247.5, 112.5, "#f2c744", 0.55))
b.append(hull(cx2, cy2, 90, 40))
for brg in (0, 112.5, 247.5):
    b.append(ray(cx2, cy2, r + 26, brg))
b.append(f'<circle cx="{cx2}" cy="{cy2}" r="3" class="blk"/>')
b.append('<text class="s b" x="556" y="140">Masthead light</text>')
b.append('<text class="s" x="556" y="157">white, 225&#176;</text>')
b.append('<text class="xs" x="560" y="524">dark astern over 135&#176;</text>')
b.append(
    '<text class="note" x="18" y="580">225&#176; (masthead) + 135&#176; (stern) = 360&#176;. '
    'Each sidelight 112.5&#176;; both together = 225&#176;, matching the masthead arc.</text>'
)
D.append(svg("ds-light-arcs", 860, 600, "".join(b), "Navigation light arcs (Rule 21)"))

# ------------------------------------------------- 2. head-on light recognition
def lamp(x, y, col, rr=6.5):
    fills = {"R": "#d0342c", "G": "#1f8a4c", "W": "#ffffff", "Y": "#e0a600"}
    return (
        f'<circle cx="{x}" cy="{y}" r="{rr}" fill="{fills[col]}" stroke="#14202b" stroke-width="1.3"/>'
    )


def panel(x, y, w, h, label, sub, lamps, extra=""):
    o = [f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="7" class="lnf" fill="#fbfdff"/>']
    o.append(f'<text class="s b" x="{x + 10}" y="{y + 19}">{label}</text>')
    o.append(f'<text class="xs" x="{x + 10}" y="{y + 35}">{sub}</text>')
    for lx, ly, col in lamps:
        o.append(lamp(x + lx, y + ly, col))
    o.append(extra)
    return "".join(o)


b = []
PW, PH = 232, 164
cols = [18, 268, 518, 768]
rows = [80, 258, 436]
specs = [
    ("Power-driven &lt;50 m", "1 masthead, sidelights, sternlight", [(98, 62, "W"), (58, 96, "G"), (138, 96, "R")]),
    ("Power-driven &#8805;50 m", "2 masthead, aft one higher", [(98, 52, "W"), (98, 78, "W"), (58, 104, "G"), (138, 104, "R")]),
    ("Sailing vessel underway", "sidelights + stern, NO masthead", [(58, 92, "G"), (138, 92, "R")]),
    ("Vessel at anchor", "all-round white; &#8805;50 m: 2, fwd higher", [(98, 62, "W")]),
    ("Not under command", "2 all-round RED vertical", [(98, 52, "R"), (98, 76, "R"), (58, 112, "G"), (138, 112, "R")]),
    ("Restricted in ability", "RED &#8211; WHITE &#8211; RED vertical", [(98, 52, "R"), (98, 74, "W"), (98, 96, "R"), (58, 122, "G"), (138, 122, "R")]),
    ("Constrained by draught", "3 all-round RED (optional) + normal",  [(98, 52, "R"), (98, 72, "R"), (98, 92, "R"), (98, 114, "W"), (58, 136, "G"), (138, 136, "R")]),
    ("Trawler", "GREEN over WHITE all-round", [(98, 46, "G"), (98, 70, "W"), (58, 104, "G"), (138, 104, "R")]),
    ("Fishing, not trawling", "RED over WHITE all-round", [(98, 46, "R"), (98, 70, "W"), (58, 104, "G"), (138, 104, "R")]),
    ("Vessel towing, tow &lt;200 m", "2 masthead vertical + sidelights", [(98, 44, "W"), (98, 68, "W"), (58, 104, "G"), (138, 104, "R")]),
    ("Pilot vessel on duty", "WHITE over RED all-round", [(98, 46, "W"), (98, 70, "R"), (58, 104, "G"), (138, 104, "R")]),
    ("Vessel aground", "anchor light + 2 all-round RED", [(98, 52, "W"), (98, 78, "R"), (98, 100, "R")]),
]
i = 0
for rw in rows:
    for cl in cols:
        lab, sub, lm = specs[i]
        b.append(panel(cl, rw, PW, PH, lab, sub, lm))
        i += 1
b.append('<text class="s b" x="18" y="60">As seen from directly ahead of the vessel: her GREEN starboard light is on YOUR LEFT, her RED port light on YOUR RIGHT.</text>')
b.append(wrap(
    'Mnemonics — NUC: "Red over red, the captain is dead." RAM: "Red, white, red — restricted ahead." '
    'Constrained by draught: "Red over red over red, the deep draught vessel ahead." Trawler: "Green over white, trawling tonight." '
    'Fishing: "Red over white, fishing at night." Pilot: "White over red, pilot ahead."',
    18, 638, 158))
b.append(wrap(
    "Identity lights are shown here together with the sidelights that a vessel making way also carries. A vessel that is underway but "
    "not making way (NUC, or a fishing vessel not moving) shows the identity lights without sidelights or sternlight. The yellow towing "
    "light sits above the STERNLIGHT, so it is not visible from ahead and is not drawn here.",
    18, 682, 158))
D.append(svg("ds-lights-recognition", 1020, 756, "".join(b), "Light recognition — as seen from ahead"))

# ------------------------------------------------------- 3. IALA lateral marks
def can(x, y, col, band=None, s=1.0):
    """Cylindrical (can) buoy, flat top = port hand in Region A."""
    w, h = 34 * s, 40 * s
    o = [f'<rect x="{x - w / 2}" y="{y - h}" width="{w}" height="{h}" fill="{col}" stroke="#14202b" stroke-width="1.4"/>']
    if band:
        o.append(f'<rect x="{x - w / 2}" y="{y - h * 0.62}" width="{w}" height="{h * 0.3}" fill="{band}" stroke="none"/>')
        o.append(f'<rect x="{x - w / 2}" y="{y - h}" width="{w}" height="{h}" fill="none" stroke="#14202b" stroke-width="1.4"/>')
    o.append(f'<line class="ln" x1="{x - w * 0.8}" y1="{y}" x2="{x + w * 0.8}" y2="{y}"/>')
    return "".join(o)


_CLIP = [0]


def cone(x, y, col, band=None, s=1.0, down=False):
    """Conical buoy, point up = starboard hand in Region A."""
    w, h = 34 * s, 42 * s
    if down:
        p = f"M{x - w / 2},{y - h} L{x + w / 2},{y - h} L{x},{y} Z"
    else:
        p = f"M{x},{y - h} L{x + w / 2},{y} L{x - w / 2},{y} Z"
    o = [f'<path d="{p}" fill="{col}" stroke="#14202b" stroke-width="1.4"/>']
    if band:
        _CLIP[0] += 1
        cid = f"clip{_CLIP[0]}"
        o.append(f'<clipPath id="{cid}"><path d="{p}"/></clipPath>')
        o.append(
            f'<rect x="{x - w / 2}" y="{y - h * 0.52}" width="{w}" height="{h * 0.26}" fill="{band}" '
            f'clip-path="url(#{cid})"/>'
        )
        o.append(f'<path d="{p}" fill="none" stroke="#14202b" stroke-width="1.4"/>')
    o.append(f'<line class="ln" x1="{x - w * 0.8}" y1="{y}" x2="{x + w * 0.8}" y2="{y}"/>')
    return "".join(o)


def topmark(x, y, kind, col):
    """Small topmark on a staff above a buoy: 'can' or 'cone'."""
    o = [f'<line class="ln" x1="{x}" y1="{y}" x2="{x}" y2="{y - 14}"/>']
    if kind == "can":
        o.append(f'<rect x="{x - 8}" y="{y - 28}" width="16" height="14" fill="{col}" stroke="#14202b" stroke-width="1.1"/>')
    else:
        o.append(f'<path d="M{x},{y - 30} L{x + 9},{y - 14} L{x - 9},{y - 14} Z" fill="{col}" stroke="#14202b" stroke-width="1.1"/>')
    return "".join(o)


RED, GRN, YEL, BLK, WHT = "#d0342c", "#1f8a4c", "#e0a600", "#14202b", "#ffffff"
b = []
b.append('<text class="s b" x="18" y="56">IALA Region A (UK, Europe, most of the world)</text>')
xs = [110, 300, 490, 680]
ys = 220
b.append(topmark(xs[0], ys - 40, "can", RED))
b.append(topmark(xs[1], ys - 42, "cone", GRN))
b.append(topmark(xs[2], ys - 40, "can", RED))
b.append(topmark(xs[3], ys - 42, "cone", GRN))
b.append(can(xs[0], ys, RED))
b.append('<text class="s b red" x="' + str(xs[0] - 56) + '" y="' + str(ys + 26) + '">Port hand</text>')
b.append(f'<text class="xs" x="{xs[0] - 60}" y="{ys + 44}">Red can / cylinder</text>')
b.append(f'<text class="xs" x="{xs[0] - 60}" y="{ys + 60}">Red topmark can</text>')
b.append(f'<text class="mono" x="{xs[0] - 60}" y="{ys + 80}">Fl R (any red rhythm)</text>')
b.append(f'<text class="xs b" x="{xs[0] - 60}" y="{ys + 100}">Keep to port going</text>')
b.append(f'<text class="xs b" x="{xs[0] - 60}" y="{ys + 114}">with buoyage direction</text>')
b.append(cone(xs[1], ys, GRN))
b.append(f'<text class="s b grn" x="{xs[1] - 60}" y="{ys + 26}">Starboard hand</text>')
b.append(f'<text class="xs" x="{xs[1] - 60}" y="{ys + 44}">Green conical</text>')
b.append(f'<text class="xs" x="{xs[1] - 60}" y="{ys + 60}">Green topmark cone &#9650;</text>')
b.append(f'<text class="mono" x="{xs[1] - 60}" y="{ys + 80}">Fl G (any green rhythm)</text>')
b.append(f'<text class="xs b" x="{xs[1] - 60}" y="{ys + 100}">Keep to starboard</text>')
b.append(can(xs[2], ys, RED, GRN))
b.append(f'<text class="s b" x="{xs[2] - 66}" y="{ys + 26}">Preferred channel</text>')
b.append(f'<text class="s b" x="{xs[2] - 66}" y="{ys + 42}">to STARBOARD</text>')
b.append(f'<text class="xs" x="{xs[2] - 66}" y="{ys + 60}">Red, green band</text>')
b.append(f'<text class="mono" x="{xs[2] - 66}" y="{ys + 80}">Fl(2+1) R</text>')
b.append(f'<text class="xs b" x="{xs[2] - 66}" y="{ys + 100}">Treat as port hand</text>')
b.append(cone(xs[3], ys, GRN, RED))
b.append(f'<text class="s b" x="{xs[3] - 66}" y="{ys + 26}">Preferred channel</text>')
b.append(f'<text class="s b" x="{xs[3] - 66}" y="{ys + 42}">to PORT</text>')
b.append(f'<text class="xs" x="{xs[3] - 66}" y="{ys + 60}">Green, red band</text>')
b.append(f'<text class="mono" x="{xs[3] - 66}" y="{ys + 80}">Fl(2+1) G</text>')
b.append(f'<text class="xs b" x="{xs[3] - 66}" y="{ys + 100}">Treat as stbd hand</text>')

b.append('<line class="lnf" x1="18" y1="376" x2="842" y2="376"/>')
b.append('<text class="s b" x="18" y="408">IALA Region B (the Americas, Japan, Korea, the Philippines) — colours reversed</text>')
b.append(topmark(110, 460, "can", GRN))
b.append(can(110, 500, GRN))
b.append('<text class="xs b grn" x="58" y="526">Port hand: GREEN can</text>')
b.append(topmark(300, 458, "cone", RED))
b.append(cone(300, 500, RED))
b.append('<text class="xs b red" x="240" y="526">Starboard hand: RED cone</text>')
b.append('<text class="s" x="440" y="466">Shapes and topmarks stay the same; only the colours swap.</text>')
b.append('<text class="s b" x="440" y="490">"Red Right Returning" is a Region B rule only —</text>')
b.append('<text class="s b" x="440" y="510">it is wrong in the UK, where red is left when returning.</text>')
b.append(wrap(
    "Buoyage direction is the direction a vessel takes when approaching a harbour, river or estuary from seaward, "
    "or, in other places, the direction marked on the chart by a broad arrow symbol. The convention is clockwise around "
    "continental land masses. Around the British Isles it runs NORTH up the west coast and through the Irish Sea, EAST "
    "through the English Channel, and NORTH through the North Sea — so it is not a clockwise circuit of the islands.",
    18, 560, 132))
D.append(svg("ds-iala-lateral", 860, 632, "".join(b), "IALA lateral marks"))

# ------------------------------------------------------------ 4. cardinal marks
def cardinal(x, ybase, quad):
    """Pillar buoy with black/yellow bands and two black cone topmarks.

    N both cones point up; S both point down; E base to base; W point to point.
    """
    w, h = 36, 52
    top = ybase - h
    o = []
    if quad == "N":
        bands = [(top, h / 2, BLK), (top + h / 2, h / 2, YEL)]
    elif quad == "S":
        bands = [(top, h / 2, YEL), (top + h / 2, h / 2, BLK)]
    elif quad == "E":
        bands = [(top, h * 0.36, BLK), (top + h * 0.36, h * 0.28, YEL), (top + h * 0.64, h * 0.36, BLK)]
    else:
        bands = [(top, h * 0.36, YEL), (top + h * 0.36, h * 0.28, BLK), (top + h * 0.64, h * 0.36, YEL)]
    for by, bh, col in bands:
        o.append(f'<rect x="{x - w / 2}" y="{by:.1f}" width="{w}" height="{bh:.1f}" fill="{col}"/>')
    o.append(
        f'<rect x="{x - w / 2}" y="{top}" width="{w}" height="{h}" fill="none" stroke="#14202b" stroke-width="1.4"/>'
    )
    # two black cone topmarks on a short staff above the buoy
    cw, ch, gap = 22, 22, 5
    base = top - 9                       # bottom of the topmark stack
    o.append(f'<line class="ln" x1="{x}" y1="{top}" x2="{x}" y2="{base}"/>')

    def up(bot):   # apex at top, base at the bottom
        return (f'<path d="M{x},{bot - ch} L{x + cw / 2},{bot} L{x - cw / 2},{bot} Z" '
                f'fill="{BLK}" stroke="#14202b" stroke-width="1"/>')

    def dn(topy):  # base at the top, apex at the bottom
        return (f'<path d="M{x - cw / 2},{topy} L{x + cw / 2},{topy} L{x},{topy + ch} Z" '
                f'fill="{BLK}" stroke="#14202b" stroke-width="1"/>')

    if quad == "N":                       # both cones point up
        o += [up(base - ch - gap), up(base)]
    elif quad == "S":                     # both cones point down
        o += [dn(base - 2 * ch - gap), dn(base - ch)]
    elif quad == "E":                     # bases meet — a diamond
        o += [up(base - ch), dn(base - ch)]
    else:                                 # W: points meet — an hourglass / wine glass
        o += [dn(base - 2 * ch), up(base)]
    o.append(f'<line class="ln" x1="{x - w * 0.9}" y1="{ybase}" x2="{x + w * 0.9}" y2="{ybase}"/>')
    return "".join(o)


b = []
info = [
    ("N", 118, "NORTH cardinal", "BLACK above YELLOW", "Both cones point UP", ["Q", "or VQ"], "Pass to the NORTH of it"),
    ("E", 342, "EAST cardinal", "BLACK, YELLOW band, BLACK", "Cones BASE to BASE", ["Q(3) 10s", "or VQ(3) 5s"], "Pass to the EAST of it"),
    ("S", 566, "SOUTH cardinal", "YELLOW above BLACK", "Both cones point DOWN", ["Q(6)+LFl 15s", "or VQ(6)+LFl 10s"], "Pass to the SOUTH of it"),
    ("W", 790, "WEST cardinal", "YELLOW, BLACK band, YELLOW", "Cones POINT to POINT", ["Q(9) 15s", "or VQ(9) 10s"], "Pass to the WEST of it"),
]
for q, x, nm, colour, tm, lt, act in info:
    b.append(cardinal(x, 214, q))
    b.append(f'<text class="s b" x="{x - 96}" y="248">{nm}</text>')
    b.append(f'<text class="xs" x="{x - 96}" y="266">{colour}</text>')
    b.append(f'<text class="xs" x="{x - 96}" y="282">{tm}</text>')
    b.append(f'<text class="xs mono" x="{x - 96}" y="304">{lt[0]}</text>')
    b.append(f'<text class="xs mono" x="{x - 96}" y="320">{lt[1]}</text>')
    b.append(f'<text class="xs b" x="{x - 96}" y="344">{act}</text>')
b.append(wrap(
    "Topmark rule: the cones point the way the black band sits — N = black on top and cones up, "
    "S = black on the bottom and cones down. E and W are the two in-between cases: E base to base (a diamond), "
    "W point to point (an hourglass, or a wine glass — W is for Wine).",
    18, 384, 132))
b.append(wrap(
    "Light rule (clock face): E = 3 o'clock = 3 flashes; S = 6 o'clock = 6 flashes plus a long flash to confirm you counted six; "
    "W = 9 o'clock = 9 flashes; N = 12 o'clock = continuous. All cardinal lights are WHITE, quick (Q) or very quick (VQ).",
    18, 442, 132))
b.append('<text class="s b" x="18" y="510">Cardinal marks say where the SAFE water is, relative to the mark</text>')
ccx, ccy, crr = 150, 650, 82
b.append(f'<circle cx="{ccx}" cy="{ccy}" r="{crr}" class="lnf" fill="#f4f9fd"/>')
for br, lab, dx, dy in ((0, "N", -6, -12), (90, "E", 10, 5), (180, "S", -6, 22), (270, "W", -24, 5)):
    x, y = pt(ccx, ccy, crr, br)
    b.append(f'<text class="s b" x="{x + dx:.0f}" y="{y + dy:.0f}">{lab}</text>')
for br in (45, 135, 225, 315):
    x, y = pt(ccx, ccy, crr, br)
    b.append(f'<line class="dash" x1="{ccx}" y1="{ccy}" x2="{x:.1f}" y2="{y:.1f}"/>')
b.append(f'<circle cx="{ccx}" cy="{ccy}" r="9" fill="{BLK}"/>')
b.append(f'<text class="xs b" x="{ccx + 16}" y="{ccy - 14}">danger</text>')
b.append('<text class="s" x="290" y="556">A NORTH cardinal is laid to the NORTH of the danger, so the safe water</text>')
b.append('<text class="s" x="290" y="578">is north of the mark and you pass to the north of it. The same holds for</text>')
b.append('<text class="s" x="290" y="600">the other three: the name of the mark is the side you pass.</text>')
b.append('<text class="s b" x="290" y="632">Quadrant boundaries are NW, NE, SE and SW — 315°, 045°, 135° and 225°</text>')
b.append('<text class="s" x="290" y="654">true, measured FROM the danger.</text>')
b.append('<text class="s b" x="290" y="686">Cardinal marks are identical in IALA Region A and Region B.</text>')
D.append(svg("ds-cardinal-marks", 950, 796, "".join(b), "IALA cardinal marks (Region A and B)"))

# ------------------------------------------------- 5. other marks + wreck buoy
b = []
# isolated danger: black with red band(s), 2 black spheres
x, y = 110, 190
b.append(f'<rect x="{x - 17}" y="{y - 46}" width="34" height="46" fill="{BLK}"/>')
b.append(f'<rect x="{x - 17}" y="{y - 32}" width="34" height="14" fill="{RED}"/>')
b.append(f'<rect x="{x - 17}" y="{y - 46}" width="34" height="46" fill="none" stroke="#14202b" stroke-width="1.4"/>')
b.append(f'<circle cx="{x}" cy="{y - 62}" r="9" fill="{BLK}"/>')
b.append(f'<circle cx="{x}" cy="{y - 82}" r="9" fill="{BLK}"/>')
b.append(f'<line class="ln" x1="{x - 29}" y1="{y}" x2="{x + 29}" y2="{y}"/>')
b.append('<text class="s b" x="46" y="222">Isolated danger</text>')
b.append('<text class="xs" x="46" y="240">Black, red band(s)</text>')
b.append('<text class="xs" x="46" y="256">2 black spheres</text>')
b.append('<text class="mono" x="46" y="276">Fl(2) white</text>')
b.append('<text class="xs b" x="46" y="296">Stands ON a danger with</text>')
b.append('<text class="xs b" x="46" y="310">navigable water all round</text>')
# safe water: red/white vertical stripes, red sphere topmark
x = 300
b.append(f'<rect x="{x - 17}" y="{y - 46}" width="34" height="46" fill="{WHT}" stroke="#14202b" stroke-width="1.4"/>')
for i, xx in enumerate((x - 17, x - 5.5, x + 6)):
    if i % 2 == 0:
        b.append(f'<rect x="{xx}" y="{y - 46}" width="11.5" height="46" fill="{RED}"/>')
b.append(f'<rect x="{x - 17}" y="{y - 46}" width="34" height="46" fill="none" stroke="#14202b" stroke-width="1.4"/>')
b.append(f'<circle cx="{x}" cy="{y - 57}" r="10" fill="{RED}" stroke="#14202b" stroke-width="1.2"/>')
b.append(f'<line class="ln" x1="{x - 29}" y1="{y}" x2="{x + 29}" y2="{y}"/>')
b.append('<text class="s b" x="238" y="222">Safe water / mid-channel</text>')
b.append('<text class="xs" x="238" y="240">Red &amp; white vertical stripes</text>')
b.append('<text class="xs" x="238" y="256">Single red sphere topmark</text>')
b.append('<text class="mono" x="238" y="292">Iso, Oc, LFl 10s or Mo(A)</text>')
b.append('<text class="xs b" x="238" y="296">Navigable water all round;</text>')
b.append('<text class="xs b" x="238" y="310">often a landfall mark</text>')
# special mark: yellow, X topmark
x = 500
b.append(f'<rect x="{x - 13}" y="{y - 48}" width="26" height="48" rx="3" fill="{YEL}" stroke="#14202b" stroke-width="1.4"/>')
b.append(f'<path d="M{x - 8},{y - 68} L{x + 8},{y - 52} M{x + 8},{y - 68} L{x - 8},{y - 52}" stroke="{YEL}" stroke-width="4"/>')
b.append(f'<path d="M{x - 8},{y - 68} L{x + 8},{y - 52} M{x + 8},{y - 68} L{x - 8},{y - 52}" stroke="#14202b" stroke-width="1"/>')
b.append(f'<line class="ln" x1="{x - 29}" y1="{y}" x2="{x + 29}" y2="{y}"/>')
b.append('<text class="s b" x="440" y="222" fill="#a37800">Special mark</text>')
b.append('<text class="xs" x="440" y="240">Yellow; any shape that does not</text>')
b.append('<text class="xs" x="440" y="256">conflict with a navigation mark.</text>')
b.append('<text class="xs" x="440" y="272">Yellow &#215; topmark</text>')
b.append('<text class="mono" x="440" y="292">Fl Y (any yellow rhythm)</text>')
b.append('<text class="xs b" x="440" y="316">Marks a special area:</text>')
b.append('<text class="xs b" x="440" y="332">spoil ground, outfall,</text>')
b.append('<text class="xs b" x="440" y="348">racing buoy, cable, ODAS</text>')
# emergency wreck marking buoy: blue/yellow vertical, yellow cross topmark
x = 700
for i in range(6):
    col = "#1d5f9e" if i % 2 == 0 else YEL
    b.append(f'<rect x="{x - 18 + i * 6}" y="{y - 46}" width="6" height="46" fill="{col}"/>')
b.append(f'<rect x="{x - 18}" y="{y - 46}" width="36" height="46" fill="none" stroke="#14202b" stroke-width="1.4"/>')
b.append(f'<path d="M{x},{y - 72} L{x},{y - 52} M{x - 10},{y - 62} L{x + 10},{y - 62}" stroke="{YEL}" stroke-width="4.5"/>')
b.append(f'<path d="M{x},{y - 72} L{x},{y - 52} M{x - 10},{y - 62} L{x + 10},{y - 62}" stroke="#14202b" stroke-width="0.9"/>')
b.append(f'<line class="ln" x1="{x - 30}" y1="{y}" x2="{x + 30}" y2="{y}"/>')
b.append('<text class="s b" x="640" y="222">Emergency wreck marking</text>')
b.append('<text class="xs" x="640" y="240">Blue &amp; yellow vertical stripes</text>')
b.append('<text class="xs" x="640" y="256">Yellow upright cross topmark</text>')
b.append('<text class="mono" x="640" y="276">Al Oc BuY 3s</text>')
b.append('<text class="xs b" x="640" y="296">Temporary, on a new wreck</text>')
b.append('<text class="xs b" x="640" y="310">until charted &amp; marked normally</text>')
b.append(wrap('Isolated danger versus safe water: the isolated danger mark sits ON the hazard, so stay clear of it; the safe water mark has navigable water all round and may be passed on either side.', 18, 392, 128))
D.append(svg("ds-other-marks", 900, 448, "".join(b), "Isolated danger, safe water, special and wreck marks"))

# ------------------------------------------------- 6. light characteristics
b = []
rows = [
    ("F", "Fixed", "continuous steady light", [(0, 12.6)]),
    ("Fl 5s", "Flashing", "one flash every 5 s; light shorter than dark", [(0, 0.7), (5, 0.7), (10, 0.7)]),
    ("Fl(3) 10s", "Group flashing", "a group of 3 flashes each period", [(0, 0.5), (1.2, 0.5), (2.4, 0.5), (10, 0.5), (11.2, 0.5), (12.4, 0.5)]),
    ("LFl 10s", "Long flashing", "flash of 2 s or more", [(0, 2.4), (10, 2.4)]),
    ("Oc 4s", "Occulting", "light LONGER than dark", [(0, 3.1), (4, 3.1), (8, 3.1)]),
    ("Iso 2s", "Isophase", "light and dark exactly equal", [(0, 1), (2, 1), (4, 1), (6, 1), (8, 1), (10, 1)]),
    ("Q", "Quick flashing", "50–79 flashes per minute", [(i * 1.05, 0.35) for i in range(12)]),
    ("VQ", "Very quick", "80–159 flashes per minute", [(i * 0.55, 0.2) for i in range(23)]),
    ("Mo(A) 6s", "Morse A", "dot-dash — short then long", [(0, 0.35), (0.9, 1.4), (6, 0.35), (6.9, 1.4)]),
]
X0, W = 250, 500
SC = W / 12.6
y = 62
for code, name, desc, flashes in rows:
    b.append(f'<text class="mono b" x="18" y="{y + 16}">{code}</text>')
    b.append(f'<text class="xs" x="18" y="{y + 32}">{name}</text>')
    b.append(f'<rect x="{X0}" y="{y}" width="{W}" height="24" fill="#e9eef3" stroke="#b9c6d1" stroke-width="0.9"/>')
    for st, dur in flashes:
        if st * SC > W:
            continue
        w = min(dur * SC, W - st * SC)
        b.append(f'<rect x="{X0 + st * SC:.1f}" y="{y}" width="{w:.1f}" height="24" fill="#e0a600"/>')
    b.append(f'<text class="xs" x="{X0 + W + 12}" y="{y + 16}">{desc}</text>')
    y += 46
b.append(f'<line class="lnf" x1="{X0}" y1="{y + 2}" x2="{X0 + W}" y2="{y + 2}"/>')
for t in range(0, 13, 2):
    if t * SC <= W:
        b.append(f'<line class="lnf" x1="{X0 + t * SC:.1f}" y1="{y + 2}" x2="{X0 + t * SC:.1f}" y2="{y + 8}"/>')
        b.append(f'<text class="xs" x="{X0 + t * SC - 5:.0f}" y="{y + 24}">{t}s</text>')
b.append('<text class="note" x="18" y="' + str(y + 52) + '">Yellow = light showing. The period is the time for one complete cycle. '
         'Al = alternating colours; a colour letter (R, G, Bu, Y) after the rhythm gives the light colour, none means white.</text>')
b.append('<text class="note" x="18" y="' + str(y + 72) + '">Chart example: Fl(2)WRG 10s 15m 11-8M — 2 flashes every 10 s, white/red/green sectors, '
         '15 m elevation, range 11 M white down to 8 M green.</text>')
D.append(svg("ds-light-characteristics", 860, y + 96, "".join(b), "Light characteristics"))

# ---------------------------------------------------------- 7. tidal datums
def varrow(x, y1, y2, label, col="#14202b", side="right", cls="xs b"):
    o = [
        f'<line x1="{x}" y1="{y1}" x2="{x}" y2="{y2}" stroke="{col}" stroke-width="1.5" '
        f'marker-start="url(#a)" marker-end="url(#a)"/>'
    ]
    tx = x + 7 if side == "right" else x - 7
    anchor = "start" if side == "right" else "end"
    o.append(
        f'<text class="{cls}" x="{tx}" y="{(y1 + y2) / 2 + 4}" text-anchor="{anchor}" fill="{col}">{label}</text>'
    )
    return "".join(o)


b = []
L, R = 150, 700
MHWS, MHWN, NOW, MLWN, MLWS, CD = 112, 140, 172, 262, 296, 336
SEABED, BOT = 432, 486
SEAFLOOR = f"M{L},{SEABED} C240,424 320,446 400,442 C480,438 560,452 640,446 L{R},442"
b.append(f'<path d="{SEAFLOOR} L{R},{NOW} L{L},{NOW} Z" class="sea"/>')
b.append(f'<path d="{SEAFLOOR} L{R},{BOT} L{L},{BOT} Z" class="land"/>')
# a rock that dries: its top stands above chart datum
b.append('<path d="M556,446 C572,392 590,300 604,300 C618,300 636,394 652,446 Z" fill="#d8c7a0" stroke="#14202b" stroke-width="1.2"/>')
for yy, lab, col, dash in [
    (MHWS, "MHWS", "#1d5f9e", 1), (MHWN, "MHWN", "#5d87b0", 1),
    (NOW, "sea level now", "#14202b", 0), (MLWN, "MLWN", "#5d87b0", 1),
    (MLWS, "MLWS", "#1d5f9e", 1), (CD, "CHART DATUM (LAT)", "#d0342c", 1),
]:
    da = ' stroke-dasharray="7 4"' if dash else ""
    b.append(f'<line x1="{L}" y1="{yy}" x2="{R}" y2="{yy}" stroke="{col}" stroke-width="1.7"{da}/>')
    b.append(f'<text class="xs b" x="{R + 10}" y="{yy + 4}" fill="{col}">{lab}</text>')
# each measurement gets its own vertical lane so no two labels can collide
b.append(varrow(190, MHWS, MLWS, "spring range", "#8a5cd0"))
b.append(varrow(286, MHWN, MLWN, "neap range", "#c07a1f"))
b.append(varrow(366, NOW, CD, "height of tide"))
b.append(varrow(452, CD, 440, "charted depth", "#1d5f9e"))
b.append(varrow(516, NOW, 442, "depth of water", "#1f8a4c", "left"))
b.append(varrow(604, CD, 302, "drying height", "#d0342c"))
b.append('<text class="xs" x="613" y="356">printed underlined</text>')
b.append('<text class="xs" x="613" y="372">on the chart</text>')
b.append(f'<line x1="{L + 8}" y1="62" x2="{L + 8}" y2="{MHWS}" stroke="#4a5b6a" stroke-width="1.3" marker-start="url(#a)" marker-end="url(#a)"/>')
b.append(f'<text class="xs b" x="{L + 18}" y="86">charted HEIGHTS of lights and bridges are measured above MHWS</text>')
b.append(f'<text class="xs b" x="{L}" y="{BOT + 26}">charted DEPTHS and DRYING HEIGHTS are measured from chart datum</text>')

b.append('<rect x="800" y="52" width="376" height="264" rx="7" fill="#fbfdff" stroke="#14202b" stroke-width="1.2"/>')
b.append('<text class="s b" x="816" y="78">The five equations</text>')
yy = 104
for e in [
    "depth of water", "  = charted depth + height of tide",
    "depth over a drying patch", "  = height of tide - drying height",
    "clearance under the keel", "  = depth of water - draught",
    "range = HW height - LW height",
    "clearance under a bridge", "  = charted height + MHWS - height of tide",
]:
    b.append(f'<text class="{"mono b" if not e.startswith("  ") else "mono"}" x="816" y="{yy}">{e}</text>')
    yy += 22
b.append(wrap(
    "Chart datum in UK waters is approximately Lowest Astronomical Tide (LAT), so the sea almost never falls below the charted depth — "
    "charted depths are the pessimistic case. Heights of lights and bridges are given above MHWS, which is also the pessimistic case: "
    "real clearance is usually more than charted. A negative tidal height is possible but rare.",
    150, 552, 148))
D.append(svg("ds-tidal-datums", 1200, 636, "".join(b), "Tidal heights and chart datums"))

# ------------------------------------------------------ 8. rule of twelfths
b = []
tw = [1, 2, 3, 3, 2, 1]
X0, Y0, BW, GAP = 90, 400, 90, 18
maxh = 260
for i, n in enumerate(tw):
    h = maxh * n / 3
    x = X0 + i * (BW + GAP)
    b.append(f'<rect x="{x}" y="{Y0 - h}" width="{BW}" height="{h}" fill="#5d87b0" stroke="#14202b" stroke-width="1.2"/>')
    b.append(f'<text class="t b" x="{x + BW / 2 - 16}" y="{Y0 - h - 12}" fill="#14202b">{n}/12</text>')
    b.append(f'<text class="s" x="{x + BW / 2 - 22}" y="{Y0 + 22}">hour {i + 1}</text>')
cum = 0
for i, n in enumerate(tw):
    cum += n
    x = X0 + i * (BW + GAP)
    b.append(f'<text class="xs" x="{x + BW / 2 - 24}" y="{Y0 + 42}">total {cum}/12</text>')
b.append(f'<line class="ln" x1="{X0 - 14}" y1="{Y0}" x2="{X0 + 6 * (BW + GAP)}" y2="{Y0}"/>')
b.append(wrap("The tide rises, or falls, by these fractions of the range in each of the six hours between low water and high water.", 90, 74, 82, "s", 20))
b.append('<text class="mono b" x="90" y="140">1 &#8211; 2 &#8211; 3 &#8211; 3 &#8211; 2 &#8211; 1 twelfths</text>')
b.append('<text class="s b" x="90" y="486">Worked example</text>')
b.append(wrap("LW 1.2 m at 0600, HW 5.4 m at 1215. Range = 5.4 − 1.2 = 4.2 m, so one twelfth = 0.35 m. The duration is 6 h 15 min, so each \"hour\" is about 62 min, "
              "which puts 0900 close to 3 hours after LW.", 90, 510, 82, "s", 20))
b.append('<text class="mono" x="90" y="576">1.2 + (1 + 2 + 3)/12 × 4.2 = 1.2 + 2.1 = 3.3 m above chart datum</text>')
b.append(wrap("It is only an estimate: it assumes a symmetrical, roughly sinusoidal curve and a six-hour rise. Use the almanac's tidal curve for anything tight, "
              "and never use it in the Solent or other double-high-water ports.", 90, 610, 88))
D.append(svg("ds-rule-of-twelfths", 820, 660, "".join(b), "The rule of twelfths"))

# ------------------------------------------------------- 9. tidal curve method
b = []
GX, GY, GW, GH = 300, 110, 430, 250
b.append(f'<rect x="{GX}" y="{GY}" width="{GW}" height="{GH}" fill="#fbfdff" stroke="#14202b" stroke-width="1.3"/>')
for i in range(1, 12):
    b.append(f'<line class="grid" x1="{GX + i * GW / 12}" y1="{GY}" x2="{GX + i * GW / 12}" y2="{GY + GH}"/>')
for i in range(1, 10):
    b.append(f'<line class="grid" x1="{GX}" y1="{GY + i * GH / 10}" x2="{GX + GW}" y2="{GY + i * GH / 10}"/>')
# spring & neap curves (HW at centre)
def curve(k, col, dash):
    pts = []
    for i in range(0, 61):
        t = -6 + i * 0.2
        f = math.cos(math.pi * t / (6.2 if k else 6.2)) * 0.5 + 0.5
        f = f ** (1.0 if k else 1.25)
        x = GX + GW / 2 + t * GW / 12
        y = GY + GH - f * GH * 0.94 - GH * 0.03
        if GX <= x <= GX + GW:
            pts.append(f"{x:.1f},{y:.1f}")
    return f'<polyline points="{" ".join(pts)}" fill="none" stroke="{col}" stroke-width="2" {dash}/>'


b.append(curve(True, "#1d5f9e", ""))
b.append(curve(False, "#d0342c", 'stroke-dasharray="6 4"'))
b.append(f'<text class="xs b" x="{GX + GW - 96}" y="{GY + 20}" fill="#1d5f9e">spring curve</text>')
b.append(f'<text class="xs b" x="{GX + GW - 96}" y="{GY + 36}" fill="#d0342c">neap curve (dashed)</text>')
for i, lab in enumerate(["−6", "−4", "−2", "HW", "+2", "+4", "+6"]):
    x = GX + i * GW / 6
    b.append(f'<text class="xs" x="{x - 8:.0f}" y="{GY + GH + 18}">{lab}</text>')
b.append(f'<text class="xs" x="{GX + GW / 2 - 60}" y="{GY + GH + 38}">hours before / after HW</text>')
b.append(f'<text class="xs" x="{GX - 66}" y="{GY + 12}">1.0</text>')
b.append(f'<text class="xs" x="{GX - 66}" y="{GY + GH}">0.0</text>')
b.append(f'<text class="xs b" x="{GX - 92}" y="{GY + GH / 2}">factor</text>')
# HW/LW boxes
b.append(f'<rect x="{GX - 250}" y="{GY}" width="220" height="150" class="lnf" fill="#fbfdff"/>')
b.append(f'<text class="s b" x="{GX - 238}" y="{GY + 22}">HW / LW height scale</text>')
b.append(f'<text class="xs" x="{GX - 238}" y="{GY + 44}">Plot HW height on the top scale,</text>')
b.append(f'<text class="xs" x="{GX - 238}" y="{GY + 60}">LW height on the bottom scale,</text>')
b.append(f'<text class="xs" x="{GX - 238}" y="{GY + 76}">join them with a straight line.</text>')
b.append(f'<text class="xs" x="{GX - 238}" y="{GY + 98}">That line converts a factor into</text>')
b.append(f'<text class="xs" x="{GX - 238}" y="{GY + 114}">a height, and back again.</text>')
b.append(f'<text class="xs b" x="{GX - 238}" y="{GY + 138}">Interpolate between the spring</text>')
b.append(f'<text class="xs b" x="{GX - 238}" y="{GY + 152}">and neap curves by range.</text>')
b.append('<text class="s b" x="50" y="410">Standard port method — height at a given time</text>')
b.append('<text class="s" x="50" y="434">1. From the tide tables, note HW and LW times and heights for the day.</text>')
b.append('<text class="s" x="50" y="454">2. Fill in the hour boxes along the bottom, HW time in the centre box.</text>')
b.append('<text class="s" x="50" y="474">3. Draw the sloping line joining LW height (bottom scale) to HW height (top scale).</text>')
b.append('<text class="s" x="50" y="494">4. Enter the graph at the time wanted, go up to the curve (spring, neap, or interpolated by range).</text>')
b.append('<text class="s" x="50" y="514">5. Go across to the sloping line, then down to read the height. Reverse the steps to find the time for a given height.</text>')
b.append('<text class="s b" x="50" y="548">Secondary ports: apply the almanac time and height differences to the standard port, interpolating for the actual HW time and height.</text>')
b.append('<text class="note" x="50" y="576">Add a safety margin. A "clearance" answer that is only 0.2 m is not a clearance — allow for swell, squat and barometric pressure.</text>')
D.append(svg("ds-tidal-curve", 800, 600, "".join(b), "Using a tidal curve"))

# ----------------------------------------------- 10. course to steer triangle
b = []
b.append('<text class="s b" x="18" y="56">Course to steer: you know the track you want to make good, and you solve for what to steer.</text>')
Ax, Ay = 90, 300
Tx, Ty = 150, 176
Cx, Cy = 560, 232
b.append(vector(Ax, Ay, Tx, Ty, 3, "#1d5f9e"))
b.append(vector(Tx, Ty, Cx, Cy, 1, "#14202b"))
b.append(vector(Ax, Ay, Cx, Cy, 2, "#1f8a4c"))
b.append(f'<circle cx="{Ax}" cy="{Ay}" r="5" class="blk"/>')
b.append(f'<circle cx="{Ax}" cy="{Ay}" r="10" fill="none" stroke="#14202b" stroke-width="1.6"/>')
b.append(f'<text class="s b" x="{Ax - 26}" y="{Ay + 32}">fix</text>')
b.append(f'<circle cx="{Cx}" cy="{Cy}" r="5" class="blk"/>')
b.append(f'<text class="s b" x="{Cx + 14}" y="{Cy + 5}">towards the destination</text>')
b.append('<text class="s b" x="18" y="132" fill="#1d5f9e">1. TIDE &#8212; three arrowheads</text>')
b.append('<text class="xs" x="18" y="148" fill="#1d5f9e">set and drift for one hour,</text>')
b.append('<text class="xs" x="18" y="164" fill="#1d5f9e">plotted from the fix</text>')
b.append('<text class="s b" x="300" y="120">2. WATER TRACK = course to steer &#8212; one arrowhead</text>')
b.append('<text class="xs" x="300" y="136">dividers set to one hour of boat speed, swung from the end</text>')
b.append('<text class="xs" x="300" y="152">of the tide vector to cut the ground track</text>')
b.append('<text class="s b grn" x="150" y="330">3. GROUND TRACK &#8212; two arrowheads</text>')
b.append('<text class="xs grn" x="150" y="346">the line you want to make good; its length is your speed over the ground</text>')
b.append('<text class="s b" x="18" y="392">Method</text>')
for k, t in enumerate([
    "Plot the ground track you want, from the fix towards the destination.",
    "From the fix, plot the hour's tide: set is the direction it flows TOWARDS, drift is the distance it runs in that hour.",
    "Set the dividers to boat speed &#215; one hour. From the END of the tide vector, cut the ground track.",
    "The direction of that cut, measured at the compass rose, is the water track &#8212; your course to steer, in TRUE.",
    "Apply leeway UPWIND of it, then variation, then deviation, to get the compass course to give the helm.",
]):
    b.append(wrap(f"{chr(97 + k)}. {t}", 18, 416 + k * 24, 122, "s", 20))
b.append(wrap(
    "Both vectors must cover the SAME period. Estimated position is the same triangle run the other way: plot the water "
    "track from the fix, then apply the tide from its end to arrive at the EP.",
    18, 550, 122))
D.append(svg("ds-cts-triangle", 900, 608, "".join(b), "The course-to-steer vector triangle"))

# ---------------------------------------------------- 11. EP plot & plot symbols
b = []
Fx, Fy = 96, 250
Dx, Dy = 400, 138
Ex, Ey = 512, 208
b.append(f'<circle cx="{Fx}" cy="{Fy}" r="9" fill="none" stroke="#14202b" stroke-width="1.8"/>')
b.append(f'<circle cx="{Fx}" cy="{Fy}" r="2.6" class="blk"/>')
b.append(f'<text class="s b" x="{Fx - 16}" y="{Fy + 32}">FIX 0900</text>')
b.append(vector(Fx, Fy, Dx, Dy, 1, "#14202b"))
b.append('<text class="s b" x="130" y="98">water track &#8212; one arrowhead</text>')
b.append('<text class="xs" x="130" y="114">course steered, corrected for leeway; length = log distance run</text>')
b.append(f'<line x1="{Dx - 11}" y1="{Dy - 11}" x2="{Dx + 11}" y2="{Dy + 11}" class="ln"/>')
b.append(f'<line x1="{Dx + 11}" y1="{Dy - 11}" x2="{Dx - 11}" y2="{Dy + 11}" class="ln"/>')
b.append(f'<text class="s b" x="{Dx - 30}" y="{Dy - 24}">DR</text>')
b.append(vector(Dx, Dy, Ex, Ey, 3, "#1d5f9e"))
b.append(f'<text class="s b" x="{Dx + 34}" y="{Dy + 46}" fill="#1d5f9e">tide &#8212; three arrowheads</text>')
b.append(f'<text class="xs" x="{Dx + 34}" y="{Dy + 62}" fill="#1d5f9e">set and drift since the fix</text>')
b.append(f'<path d="M{Ex - 12},{Ey + 10} L{Ex + 12},{Ey + 10} L{Ex},{Ey - 12} Z" fill="none" stroke="#14202b" stroke-width="1.8"/>')
b.append(f'<text class="s b" x="{Ex + 18}" y="{Ey + 6}">EP 1000</text>')
b.append(vector(Fx, Fy, Ex, Ey, 2, "#1f8a4c", 2.2, "9 5"))
b.append('<text class="s b grn" x="110" y="296">ground track &#8212; two arrowheads (fix to EP)</text>')
b.append('<text class="s b" x="18" y="342">Standard chartwork symbols</text>')
yy = 368
for a, c in [
    ("Fix &#8212; two or more position lines crossed, or a confirmed GNSS position", "a circle with a dot, time alongside"),
    ("DR &#8212; dead reckoning: course steered and log distance only, no tide, no leeway", "a cross"),
    ("EP &#8212; estimated position: the DR corrected for leeway and tide", "a triangle"),
    ("Water track &#8212; the course through the water", "ONE arrowhead"),
    ("Ground track &#8212; the course over the ground", "TWO arrowheads"),
    ("Tidal stream vector", "THREE arrowheads"),
    ("Waypoint", "a square or a circled cross, labelled"),
]:
    b.append(f'<text class="s" x="18" y="{yy}">&#8226; {a} &#8212; <tspan class="b">{c}</tspan></text>')
    yy += 22
b.append(wrap(
    "Log every fix in the deck log with the time, the position and the log reading. A fix is only as good as the marks "
    "you used, so label the bearings and sketch the cocked hat.",
    18, yy + 14, 122))
D.append(svg("ds-ep-plot", 900, yy + 62, "".join(b), "Dead reckoning and estimated position"))

# ------------------------------------------------------ 12. fixes & pilotage
b = []
PY_, PH_ = 46, 300
# ---- left panel: three-bearing fix
b.append(f'<rect x="18" y="{PY_}" width="430" height="{PH_}" rx="7" class="lnf" fill="#fbfdff"/>')
b.append('<text class="s b" x="32" y="70">Three-bearing fix and the cocked hat</text>')
Px, Py = 232, 210
marks = [((80, 120), "church", 6, -14), ((398, 106), "lighthouse", -70, -10), ((146, 314), "water tower", 6, 20)]
off = [(7, -5), (-8, 6), (4, 9)]
for ((mx, my), lab, lx, ly), (ox, oy) in zip(marks, off):
    b.append(f'<line class="lnf" x1="{mx}" y1="{my}" x2="{Px + ox}" y2="{Py + oy}"/>')
for (mx, my), lab, lx, ly in marks:
    b.append(f'<polygon points="{mx},{my - 9} {mx + 8},{my + 6} {mx - 8},{my + 6}" fill="#e0a600" stroke="#14202b" stroke-width="1.1"/>')
    b.append(f'<text class="xs b" x="{mx + lx}" y="{my + ly}">{lab}</text>')
b.append(f'<polygon points="{Px + 7},{Py - 5} {Px - 8},{Py + 6} {Px + 4},{Py + 9}" fill="#d0342c" fill-opacity="0.55" stroke="#d0342c"/>')
b.append(f'<text class="xs b red" x="{Px + 18}" y="{Py - 10}">cocked hat</text>')

# ---- right panel: the leading line, drawn through both marks
b.append(f'<rect x="470" y="{PY_}" width="430" height="{PH_}" rx="7" class="lnf" fill="#fbfdff"/>')
b.append('<text class="s b" x="484" y="70">A transit, or leading line</text>')
b.append('<path d="M470,84 L900,84 L900,146 C820,154 760,136 690,142 C620,148 540,132 470,138 Z" class="land"/>')
FMx, FMy = 700, 146
RMx, RMy = 736, 100
b.append(f'<circle cx="{RMx}" cy="{RMy}" r="6" class="wht"/>')
b.append(f'<text class="xs b" x="{RMx + 12}" y="{RMy + 4}">rear mark</text>')
b.append(f'<circle cx="{FMx}" cy="{FMy}" r="6" class="wht"/>')
b.append(f'<text class="xs b" x="{FMx + 12}" y="{FMy + 4}">front mark</text>')
dxm, dym = FMx - RMx, FMy - RMy
Lm = math.hypot(dxm, dym)
ex, ey = FMx + dxm / Lm * 170, FMy + dym / Lm * 170
b.append(f'<line x1="{RMx}" y1="{RMy}" x2="{ex:.1f}" y2="{ey:.1f}" stroke="#1f8a4c" stroke-width="2.4" stroke-dasharray="9 5"/>')
b.append(f'<g transform="rotate(-38, {ex:.1f}, {ey:.1f})">{hull(ex, ey, 44, 20)}</g>')
b.append(f'<text class="xs b grn" x="{ex - 186:.0f}" y="{ey - 6:.0f}">on the leading line &#8212;</text>')
b.append(f'<text class="xs" x="{ex - 186:.0f}" y="{ey + 10:.0f}">the two marks are exactly in line,</text>')
b.append(f'<text class="xs" x="{ex - 186:.0f}" y="{ey + 26:.0f}">one above the other</text>')

# ---- captions outside the panels, so nothing can be painted over
yy = PY_ + PH_ + 30
b.append(f'<text class="s b" x="18" y="{yy}">Taking the fix</text>')
b.append(wrap("Choose marks 60&#8211;120&#176; apart. Take the slowest-changing bearing first and the fastest-changing one last, "
              "and note the time and the log. If the three lines leave a triangle, assume you are at the corner NEAREST the "
              "danger; a large cocked hat means an error, so take it again.", 18, yy + 22, 60, "s", 19))
b.append(f'<text class="s b" x="490" y="{yy}">Why a transit beats a bearing</text>')
b.append(wrap("It has no variation, no deviation and no reading error, and it shows instantly whether you are slipping off the "
              "line. A CLEARING BEARING is the same idea used as a limit: 'keep the front mark bearing MORE than 070 degrees' "
              "keeps you on the safe side of a hazard, and it is one number the helm can hold without looking at the chart.",
              490, yy + 22, 60, "s", 19))
yy += 19 * 6 + 24
b.append(f'<text class="s b" x="18" y="{yy}">A pilotage plan is a sketch you can use one-handed, in the dark</text>')
yy += 26
for t in [
    "Waypoints and courses leg by leg, with distances and the time each leg should take",
    "Transits, leading lines and clearing bearings for every hazard",
    "A depth contour to stay outside, and the height of tide needed over any bar or sill",
    "Buoy names, light characteristics, and the order in which you will see them",
    "An abort plan: where you turn round to, and the course that takes you there",
]:
    b.append(f'<text class="s" x="18" y="{yy}">&#8226; {t}</text>')
    yy += 22
b.append(wrap("Brief the crew before you go in, not while you are in. Allocate lookout, helm, fenders and lines before the entrance.",
              18, yy + 14, 122))
D.append(svg("ds-fix-pilotage", 920, yy + 58, "".join(b), "Fixing, transits and pilotage"))

# ------------------------------------------------------ 13. true/mag/compass
b = []
rows = [
    ("True", "as printed on the chart, referenced to the true (geographic) North Pole"),
    ("Variation", "the angle between true and magnetic north at this place and date — read from the chart's compass rose"),
    ("Magnetic", "referenced to magnetic north"),
    ("Deviation", "error caused by the boat's own magnetism; varies with the boat's heading — from the deviation card"),
    ("Compass", "what you actually read on the steering compass"),
]
yy = 70
for i, (a, c) in enumerate(rows):
    fill = "#e9eef3" if i % 2 == 0 else "#f7fbfe"
    b.append(f'<rect x="18" y="{yy}" width="824" height="42" fill="{fill}" stroke="#b9c6d1" stroke-width="0.9"/>')
    b.append(f'<text class="t b" x="30" y="{yy + 26}">{a}</text>')
    b.append(f'<text class="s" x="180" y="{yy + 26}">{c}</text>')
    yy += 42
b.append(f'<text class="s b" x="18" y="{yy + 34}">Going down this list (chart to compass) you APPLY each error; going up it you take each one off again.</text>')
b.append(f'<text class="mono" x="18" y="{yy + 62}">True  +/− Variation  =  Magnetic  +/− Deviation  =  Compass</text>')
b.append(f'<text class="s b" x="18" y="{yy + 96}">The only rule you need</text>')
b.append(f'<text class="s" x="18" y="{yy + 120}">Error WEST, compass BEST — the compass number is bigger, so going True → Compass you ADD a westerly error.</text>')
b.append(f'<text class="s" x="18" y="{yy + 142}">Error EAST, compass LEAST — the compass number is smaller, so going True → Compass you SUBTRACT an easterly error.</text>')
b.append(f'<text class="s b" x="18" y="{yy + 176}">Worked example</text>')
b.append(f'<text class="mono" x="18" y="{yy + 200}">Chart course 145° T,  variation 3° W,  deviation 2° E</text>')
b.append(f'<text class="mono" x="18" y="{yy + 222}">145 + 3 (var W)  = 148° M</text>')
b.append(f'<text class="mono" x="18" y="{yy + 244}">148 − 2 (dev E)  = 146° C  ← steer this</text>')
b.append(f'<text class="s b" x="18" y="{yy + 280}">Leeway</text>')
b.append(f'<text class="s" x="18" y="{yy + 302}">The boat is pushed sideways downwind, so the ground/water track sits downwind of the heading.</text>')
b.append(f'<text class="s" x="18" y="{yy + 324}">To make good the track you want, steer UPWIND of it by the leeway angle (typically 5–10° close-hauled, less off the wind).</text>')
b.append(f'<text class="note" x="18" y="{yy + 356}">Leeway is applied to the heading, not to the tide vector. There is no leeway when running dead downwind or motoring in flat water.</text>')
D.append(svg("ds-variation-deviation", 860, yy + 384, "".join(b), "True, magnetic and compass"))

# ---------------------------------------------------------- 14. points of sail
b = []
cx, cy = 400, 380
b.append(sector(cx, cy, 168, 315, 45, "#8a97a3", 0.30))
b.append(f'<text class="s b" x="{cx - 46}" y="{cy - 196}">NO-GO ZONE</text>')
b.append(f'<text class="xs" x="{cx - 96}" y="{cy - 178}">roughly 45° either side of the wind</text>')
b.append(f'<text class="xs b" x="18" y="{cy - 250}" fill="#1d5f9e">The boom is drawn in blue. It always lies on the LEEWARD side — the opposite side to the wind — so the boom tells you the tack.</text>')
b.append(f'<line x1="{cx}" y1="{cy - 320}" x2="{cx}" y2="{cy - 262}" stroke="#1d5f9e" stroke-width="3" marker-end="url(#ablu)"/>')
b.append(f'<text class="s b" x="{cx - 24}" y="{cy - 330}" fill="#1d5f9e">WIND</text>')
poses = [
    (45, "Close hauled", "sails hard in"),
    (70, "Close reach", "sails eased slightly"),
    (90, "Beam reach", "sails about half out"),
    (135, "Broad reach", "sails well out"),
    (180, "Run", "sails right out, boom out"),
]
for brg, name, trim in poses:
    for sgn in (1, -1):
        if brg == 180 and sgn == -1:
            continue                      # dead run is a single position
        bb = (brg * sgn) % 360
        b.append(ray(cx, cy, 232, bb, "lnf"))
        hx, hy = pt(cx, cy, 190, bb)
        # the boom lies on the leeward side: to starboard on port tack, to port on starboard tack
        side = 1 if 0 < bb < 180 else (-1 if bb > 180 else 1)
        boom = math.radians(min(78, 0.44 * min(bb, 360 - bb)))
        ex = hx + side * 26 * math.sin(boom)
        ey = (hy - 5) + 26 * math.cos(boom)
        b.append(
            f'<g transform="rotate({bb}, {hx:.1f}, {hy:.1f})">{hull(hx, hy, 44, 20)}'
            f'<line x1="{hx}" y1="{hy - 5}" x2="{ex:.1f}" y2="{ey:.1f}" stroke="#1d5f9e" stroke-width="2.6"/>'
            f'<circle cx="{hx}" cy="{hy - 5}" r="2.4" fill="#14202b"/></g>'
        )
        tx, ty = pt(cx, cy, 258, bb)
        if brg == 180:
            b.append(f'<text class="s b" x="{cx}" y="{ty + 26:.0f}" text-anchor="middle">{name}</text>')
            b.append(f'<text class="xs" x="{cx}" y="{ty + 42:.0f}" text-anchor="middle">{trim}</text>')
            continue
        anchor = "start" if sgn > 0 else "end"
        b.append(f'<text class="s b" x="{tx:.0f}" y="{ty:.0f}" text-anchor="{anchor}">{name}</text>')
        b.append(f'<text class="xs" x="{tx:.0f}" y="{ty + 16:.0f}" text-anchor="{anchor}">{trim}</text>')
# Head to wind is a position on the wheel and was the only one not drawn — the
# card that names the points "from head to wind round to dead downwind" showed a
# picture with the first one missing. It sits inside the no-go wedge, so it gets
# the boat and a label rather than a ray.
_htw = []
_hx, _hy = cx, cy - 132
_htw.append(f'<g transform="rotate(0, {_hx}, {_hy})">{hull(_hx, _hy, 44, 20)}'
            f'<line x1="{_hx}" y1="{_hy - 5}" x2="{_hx}" y2="{_hy + 21}" stroke="#1d5f9e" stroke-width="2.6"/>'
            f'<circle cx="{_hx}" cy="{_hy - 5}" r="2.4" fill="#14202b"/></g>')
# Below the boat, inside the wedge — to the side it lands on the close-hauled
# boat and its ray.
_htw.append(f'<text class="s b" x="{cx}" y="{_hy + 48}" text-anchor="middle">Head to wind</text>')
_htw.append(f'<text class="xs" x="{cx}" y="{_hy + 64}" text-anchor="middle">sails flapping, no drive</text>')
b.extend(_htw)

# The two tack blocks split in half: what a tack IS belongs on both sheets, who
# gives way belongs only to Day Skipper. Competent Crew's syllabus excludes the
# steering-and-sailing rules, and this sheet was teaching them in red and green.
b.append(f'<text class="s b red" x="{cx + 208}" y="{cy + 66}">PORT TACK</text>')
b.append(f'<text class="xs" x="{cx + 208}" y="{cy + 84}">wind over the PORT side,</text>')
b.append(f'<text class="xs" x="{cx + 208}" y="{cy + 100}">boom out to starboard.</text>')
b.append(f'<text class="s b grn" x="{cx - 208}" y="{cy + 66}" text-anchor="end">STARBOARD TACK</text>')
b.append(f'<text class="xs" x="{cx - 208}" y="{cy + 84}" text-anchor="end">wind over the STARBOARD side,</text>')
b.append(f'<text class="xs" x="{cx - 208}" y="{cy + 100}" text-anchor="end">boom out to port.</text>')
_row = [
    f'<text class="xs b red" x="{cx + 208}" y="{cy + 118}">You GIVE WAY to a boat</text>',
    f'<text class="xs b red" x="{cx + 208}" y="{cy + 134}">on starboard tack.</text>',
    f'<text class="xs b grn" x="{cx - 208}" y="{cy + 118}" text-anchor="end">You have RIGHT OF WAY</text>',
    f'<text class="xs b grn" x="{cx - 208}" y="{cy + 134}" text-anchor="end">over a boat on port tack.</text>',
]
b.append('<text class="s b" x="18" y="742">Tacking</text><text class="s" x="110" y="742">turning the BOW through the wind. "Ready about" — "Lee-oh".</text>')
b.append('<text class="s b" x="18" y="766">Gybing</text><text class="s" x="110" y="766">turning the STERN through the wind. Control the boom. "Stand by to gybe" — "Gybe-oh".</text>')
b.append(wrap(
    "The tack you are on is named for the side the wind comes from — which is always the opposite side to the boom. "
    "Wind from starboard means starboard tack, whatever your heading. Pinching or luffing = sailing too close to the wind, "
    "so the sails flutter and the boat slows; bearing away = turning away from the wind.",
    18, 798, 132))
# Competent Crew gets the same sheet without the right-of-way lines.
D.append(svg("cc-points-of-sail", 900, 872, "".join(b), "Points of sail"))
D.append(svg("ds-points-of-sail", 900, 872, "".join(b + _row), "Points of sail"))

# ------------------------------------------------- 15. COLREGs power situations
b = []
def boat(x, y, hdg, col="#ffffff", label=None, lab_dy=-40, red=False):
    o = [f'<g transform="rotate({hdg}, {x}, {y})">{hull(x, y, 56, 26, col)}</g>']
    if label:
        o.append(f'<text class="s b" x="{x}" y="{y + lab_dy}" text-anchor="middle" fill="{"#d0342c" if red else "#14202b"}">{label}</text>')
    return "".join(o)


for bx, title in ((18, "Head-on — Rule 14"), (300, "Crossing — Rule 15"), (582, "Overtaking — Rule 13")):
    b.append(f'<rect x="{bx}" y="52" width="260" height="316" rx="7" class="lnf" fill="#fbfdff"/>')
    b.append(f'<text class="s b" x="{bx + 12}" y="76">{title}</text>')

# --- head-on: both alter to starboard, pass port to port
b.append(boat(148, 322, 0, "#ffffff", "A", 44))
b.append(boat(148, 122, 180, "#ffffff", "B", -34))
b.append('<line class="dash" x1="148" y1="300" x2="148" y2="146"/>')
b.append('<path d="M148,292 C176,268 196,248 208,222" stroke="#1f8a4c" stroke-width="2.2" fill="none" stroke-dasharray="7 4" marker-end="url(#agrn)"/>')
b.append('<path d="M148,152 C120,176 100,196 88,222" stroke="#1f8a4c" stroke-width="2.2" fill="none" stroke-dasharray="7 4" marker-end="url(#agrn)"/>')
b.append('<text class="xs b" x="196" y="212">A alters to starboard</text>')
b.append('<text class="xs b" x="34" y="212">B alters to starboard</text>')
b.append('<text class="xs b" x="32" y="352">Each alters to STARBOARD, so they</text>')
b.append('<text class="xs b" x="32" y="366">diverge and pass PORT to PORT.</text>')

# --- crossing: the one with the other on her starboard side gives way
b.append(boat(360, 316, 0, "#ffffff", "GIVE WAY", 46, True))
b.append(boat(534, 186, 250, "#ffffff", "STAND ON", -32))
b.append('<line class="dash" x1="360" y1="290" x2="360" y2="150"/>')
b.append('<text class="xs" x="366" y="146">my course</text>')
b.append('<line class="dash" x1="360" y1="300" x2="504" y2="208"/>')
b.append('<text class="xs" x="404" y="256">her bearing</text>')
b.append('<path d="M336,300 C312,278 306,250 320,224" stroke="#1f8a4c" stroke-width="2.2" fill="none" stroke-dasharray="7 4" marker-end="url(#agrn)"/>')
b.append('<text class="xs b" x="314" y="352">She is on MY starboard side,</text>')
b.append('<text class="xs b" x="314" y="366">so I alter to starboard and pass astern.</text>')

# --- overtaking: the overtaker keeps clear
b.append(boat(648, 318, 0, "#ffffff", "GIVE WAY", 46, True))
b.append(boat(648, 140, 0, "#ffffff", "STAND ON", -32))
b.append('<path d="M648,288 C712,272 724,204 692,158 C684,146 672,138 660,130" stroke="#1f8a4c" stroke-width="2.2" fill="none" stroke-dasharray="7 4" marker-end="url(#agrn)"/>')
b.append(wrap("The overtaker keeps clear until finally past and clear.", 596, 352, 34, "xs b", 14))

y = 396
for t in [
    "Rule 5 — keep a proper look-out at all times, by sight and hearing and by all available means. Rule 6 — proceed at a safe speed. "
    "Rule 7 — use all available means to determine whether risk of collision exists; a constant compass bearing on another vessel means you are on a collision course. "
    "Rule 2 — nothing in the rules excuses you from the ordinary practice of seamen, and you may depart from the rules to avoid immediate danger.",
    "Rule 8 — action to avoid collision must be POSITIVE, taken in AMPLE TIME and be OBVIOUS to the other vessel. Prefer a course alteration to a speed change, "
    "and make it big enough to be seen on radar or by eye. If necessary, slacken speed, stop, or go astern.",
    "Rule 17 — the stand-on vessel holds her course and speed, but must take action as soon as it is clear the give-way vessel is not acting. "
    "When she does act in a crossing situation she should not alter to port for a vessel on her own port side.",
    "Rule 9 — in a narrow channel keep to the starboard side of the fairway. A vessel under 20 m, or a sailing vessel, must not impede a vessel that can only navigate "
    "safely within the channel. Rule 10 — cross a traffic separation scheme on a heading as nearly as practicable at right angles to the traffic flow.",
]:
    block = wrap(t, 18, y, 138, "s", 20)
    b.append(block)
    y += 20 * (block.count("<text") ) + 12
D.append(svg("ds-colregs-power", 900, y + 12, "".join(b), "COLREGs — power-driven vessel encounters"))

# ------------------------------------------------------ 16. sailing rules + order
b = []
b.append('<rect x="18" y="52" width="404" height="300" rx="7" class="lnf" fill="#fbfdff"/>')
b.append('<text class="s b" x="30" y="76">Rule 12 — two sailing vessels</text>')
b.append('<text class="s" x="30" y="104">1. Different tacks: the vessel on PORT tack keeps clear.</text>')
b.append('<text class="s" x="30" y="130">2. Same tack: the WINDWARD vessel keeps clear.</text>')
b.append('<text class="s" x="30" y="156">3. On port tack, seeing a vessel to windward and unsure</text>')
b.append('<text class="s" x="30" y="176">   which tack she is on: keep clear.</text>')
b.append('<text class="xs b" x="30" y="208">Windward side = the side opposite the mainsail/boom.</text>')
b.append('<text class="xs" x="30" y="232">A sailing vessel using her engine is, in law, a power-driven</text>')
b.append('<text class="xs" x="30" y="250">vessel — she must show the correct lights (masthead light)</text>')
b.append('<text class="xs" x="30" y="268">and by day a black cone, point down, if motor-sailing.</text>')
b.append('<text class="xs b" x="30" y="300">Rule 12 does not apply between a sailing vessel and a</text>')
b.append('<text class="xs b" x="30" y="318">power-driven vessel — Rule 18 does.</text>')
b.append('<text class="xs" x="30" y="342">Racing rules are a private agreement; they never override IRPCS.</text>')

b.append('<rect x="438" y="52" width="404" height="300" rx="7" class="lnf" fill="#fbfdff"/>')
b.append('<text class="s b" x="450" y="76">Rule 18 — the pecking order</text>')
order = [
    "Vessel NOT UNDER COMMAND",
    "Vessel RESTRICTED IN ABILITY TO MANOEUVRE",
    "Vessel CONSTRAINED BY HER DRAUGHT*",
    "Vessel ENGAGED IN FISHING",
    "SAILING vessel",
    "POWER-DRIVEN vessel",
    "SEAPLANE / WIG craft",
]
yy = 104
for i, o in enumerate(order):
    b.append(f'<text class="s" x="450" y="{yy}">{i + 1}. {o}</text>')
    yy += 24
b.append('<text class="xs" x="450" y="' + str(yy + 6) + '">Each gives way to those above it. *Constrained by draught</text>')
b.append('<text class="xs" x="450" y="' + str(yy + 24) + '">appears only in the international rules, and other vessels</text>')
b.append('<text class="xs" x="450" y="' + str(yy + 42) + '">must merely "avoid impeding" her.</text>')
b.append('<text class="xs b" x="450" y="' + str(yy + 70) + '">Mnemonic: "New Reels Catch Fish So Purchase Some"</text>')
b.append('<text class="s b" x="18" y="392">Rule 19 — restricted visibility: it applies to ALL vessels, every one has a duty to avoid collision, and there is no stand-on vessel</text>')
b.append(wrap("Proceed at a safe speed with the engines ready for immediate manoeuvre, sound the fog signals, and post extra lookouts to listen as well as look.", 30, 418, 128, "s", 20))
b.append(wrap("If a close-quarters situation cannot be avoided with a vessel detected by radar alone: avoid altering course TOWARDS a vessel abeam or abaft the beam, and avoid altering TO PORT for a vessel forward of the beam, other than one being overtaken.", 30, 462, 128, "s", 20))
b.append(wrap("If you hear a fog signal apparently forward of your beam, or cannot avoid a close-quarters situation, reduce to bare steerage way — and if necessary take all way off and navigate with extreme caution.", 30, 526, 128, "s", 20))
b.append('<text class="s b" x="18" y="418">•</text><text class="s b" x="18" y="462">•</text><text class="s b" x="18" y="526">•</text>')
b.append(wrap("Practical Day Skipper answer: fix your position while you still can, slow down, hoist the radar reflector, show navigation lights, sound the signal, get the crew into lifejackets as extra lookouts, and get out of the shipping lanes — consider anchoring in shallow water clear of the channel.", 18, 588, 132))
D.append(svg("ds-colregs-sail", 900, 654, "".join(b), "COLREGs — sailing vessels, priority and fog"))

# ------------------------------------------------------------ 17. sound signals
b = []
X0, W = 380, 400
SC = W / 26.0
def sig(y, code, desc, blasts):
    o = [f'<text class="s b" x="18" y="{y + 17}">{code}</text>', f'<text class="xs" x="18" y="{y + 33}">{desc}</text>']
    o.append(f'<rect x="{X0}" y="{y}" width="{W}" height="22" fill="#e9eef3" stroke="#b9c6d1" stroke-width="0.9"/>')
    for st, dur in blasts:
        o.append(f'<rect x="{X0 + st * SC:.1f}" y="{y}" width="{max(dur * SC, 2):.1f}" height="22" fill="#1d5f9e"/>')
    return "".join(o)


S, P = 1.0, 5.0
sigs = [
    ("1 short blast", "I am altering course to STARBOARD", [(0, S)]),
    ("2 short blasts", "I am altering course to PORT", [(0, S), (2, S)]),
    ("3 short blasts", "My engines are going ASTERN", [(0, S), (2, S), (4, S)]),
    ("5 or more short", "I do not understand your intentions / I doubt you are taking sufficient action", [(i * 2, S) for i in range(5)]),
    ("2 long + 1 short", "I intend to overtake you on YOUR STARBOARD side (Rule 34(c), narrow channel)", [(0, P), (6, P), (12, S)]),
    ("2 long + 2 short", "I intend to overtake you on YOUR PORT side", [(0, P), (6, P), (12, S), (14, S)]),
    ("1 long + 1 short × 2", "Agreement to be overtaken: long-short-long-short", [(0, P), (6, S), (8, P), (14, S)]),
    ("1 long blast", "Warning on approaching a bend or obstruction where vessels may be hidden (Rule 34(e))", [(0, P)]),
]
y = 62
for c, d, bl in sigs:
    b.append(sig(y, c, d, bl))
    y += 42
b.append(wrap('All of the above are Rule 34 manoeuvring and warning signals, sounded by a power-driven vessel underway when vessels are IN SIGHT of one another. They are not fog signals.', 18, y + 26, 128))
y += 48
b.append(f'<line class="lnf" x1="18" y1="{y + 4}" x2="842" y2="{y + 4}"/>')
b.append(f'<text class="s b" x="18" y="{y + 30}">In or near restricted visibility (Rule 35) — at intervals of not more than 2 minutes</text>')
y += 44
fogs = [
    ("Power-driven, making way", "1 prolonged blast", [(0, P)]),
    ("Power-driven, underway but stopped", "2 prolonged, about 2 s apart", [(0, P), (7, P)]),
    ("Sailing vessel, fishing, NUC, RAM, CBD, towing", "1 prolonged + 2 short", [(0, P), (6, S), (8, S)]),
    ("Vessel at anchor", "rapid ringing of the bell for about 5 s, at intervals of ≤ 1 min", [(i * 0.7, 0.4) for i in range(8)]),
    ("Vessel aground", "3 separate bell strokes, rapid ringing, 3 strokes", [(0, 0.4), (1.4, 0.4), (2.8, 0.4)] + [(6 + i * 0.7, 0.4) for i in range(6)] + [(12, 0.4), (13.4, 0.4), (14.8, 0.4)]),
    ("Vessel &lt; 12 m", "may make any efficient sound signal at intervals of ≤ 2 min", [(0, S), (3, S)]),
    ("Pilot vessel on duty (optional)", "4 short blasts", [(0, S), (2, S), (4, S), (6, S)]),
]
for c, d, bl in fogs:
    b.append(sig(y, c, d, bl))
    y += 42
b.append(f'<text class="note" x="18" y="{y + 24}">Short blast ≈ 1 second. Prolonged blast = 4 to 6 seconds. A vessel under 12 m is not obliged to carry a bell, '
         'but must be able to make some efficient sound signal.</text>')
D.append(svg("ds-sound-signals", 860, y + 48, "".join(b), "Sound signals"))

# ------------------------------------------------------------- 18. Beaufort
b = []
head = ["Force", "Description", "Mean wind (kn)", "Sea state at sea", "Wave ht (m)"]
rows = [
    ("0", "Calm", "&lt; 1", "Sea like a mirror", "–"),
    ("1", "Light air", "1–3", "Ripples, no foam crests", "0.1"),
    ("2", "Light breeze", "4–6", "Small wavelets, glassy crests", "0.2"),
    ("3", "Gentle breeze", "7–10", "Large wavelets, crests begin to break, scattered white horses", "0.6"),
    ("4", "Moderate breeze", "11–16", "Small waves, fairly frequent white horses", "1.0"),
    ("5", "Fresh breeze", "17–21", "Moderate waves, many white horses, some spray. First reef.", "2.0"),
    ("6", "Strong breeze", "22–27", "Large waves, white foam crests everywhere, spray", "3.0"),
    ("7", "Near gale", "28–33", "Sea heaps up, foam blown in streaks", "4.0"),
    ("8", "Gale", "34–40", "Moderately high waves, well-marked streaks of foam", "5.5"),
    ("9", "Strong gale", "41–47", "High waves, dense foam, crests topple, spray affects visibility", "7.0"),
    ("10", "Storm", "48–55", "Very high waves, sea surface white, heavy tumbling, visibility affected", "9.0"),
    ("11", "Violent storm", "56–63", "Exceptionally high waves, sea covered in long foam patches", "11.5"),
    ("12", "Hurricane force", "64+", "Air filled with foam and spray, sea completely white", "14+"),
]
cw = [70, 152, 132, 486, 152]
x = 18
yy = 56
for i, h in enumerate(head):
    b.append(f'<rect x="{x}" y="{yy}" width="{cw[i]}" height="30" fill="#14202b"/>')
    b.append(f'<text class="hdr" x="{x + 8}" y="{yy + 20}">{h}</text>')
    x += cw[i]
yy += 30
for j, r in enumerate(rows):
    x = 18
    fill = "#ffffff" if j % 2 == 0 else "#f2f6fa"
    if r[0] in ("8", "9", "10", "11", "12"):
        fill = "#fbe9e7" if j % 2 == 0 else "#f7ded9"
    for i, cell in enumerate(r):
        b.append(f'<rect x="{x}" y="{yy}" width="{cw[i]}" height="28" fill="{fill}" stroke="#cdd8e1" stroke-width="0.8"/>')
        cls = "s b" if i == 0 else "s"
        b.append(f'<text class="{cls}" x="{x + 8}" y="{yy + 19}">{cell}</text>')
        x += cw[i]
    yy += 28
# Competent Crew's meteorology bar is the Beaufort scale and where to get a
# forecast. Everything below this line is Shipping Forecast interpretation,
# which that syllabus excludes by name — so the table alone is its sheet.
D.append(svg("cc-beaufort", 18 + sum(cw) + 18, yy + 18, "".join(b),
             "Beaufort scale"))

# Flowed, not placed: each paragraph starts where the last one ended. These
# were at fixed offsets, and two of them wrapped onto the one below.
fy = yy + 28
for para in [
    "Forecast and warning terms, which differ from the scale names: Gale = force 8, or gusts 43–51 kn • SEVERE gale = force 9 (the scale calls force 9 a STRONG gale), gusts 52–60 kn • Storm = force 10, gusts 61–68 kn • Violent storm = force 11 • Hurricane force = force 12.",
    "Timing: Imminent = within 6 hours of the time of issue • Soon = 6 to 12 hours • Later = more than 12 hours.",
    "Visibility: Good = more than 5 M • Moderate = 2 to 5 M • Poor = 1,000 m to 2 M • VERY POOR = less than 1,000 m. Fog is a term in the weather element, and means visibility below 1,000 m.",
    "Pressure change over the 3 hours before the observation, in hPa (= mb): rising or falling slowly = 0.1–1.5 • rising or falling = 1.6–3.5 • QUICKLY = 3.6–6.0 • VERY RAPIDLY = more than 6.0.",
]:
    b.append(wrap(para, 18, fy, 116, "s", 22))
    fy += wrap_h(para, 116, 22) + 8
foot = "Wind is always named for the direction it blows FROM, and the shipping forecast gives a MEAN speed — gusts run roughly 40% higher, and more in squalls or over land. BACKING means the direction changes anticlockwise; VEERING means clockwise."
fy += 24
b.append(wrap(foot, 18, fy, 122))
# The canvas has to clear the table, which is wider than it used to be — the
# last column header was being cut off mid-word.
D.append(svg("ds-beaufort", 18 + sum(cw) + 18, fy + wrap_h(foot, 122) + 18, "".join(b),
             "Beaufort scale and forecast terminology"))

# ------------------------------------------------------- 19. depression & fronts
b = []
b.append('<text class="s b" x="18" y="52">Plan view: a mid-latitude depression in the northern hemisphere</text>')
LCX, LCY = 230, 210
for rr in (36, 74, 112, 150):
    b.append(f'<ellipse cx="{LCX}" cy="{LCY}" rx="{rr}" ry="{rr * 0.82}" class="grid" fill="none"/>')
b.append(f'<text class="h" x="{LCX - 7}" y="{LCY + 7}">L</text>')
# warm front (red, semicircles) trailing SE, cold front (blue, triangles) trailing SW
b.append(f'<path d="M{LCX},{LCY} C{LCX + 60},{LCY + 40} {LCX + 96},{LCY + 76} {LCX + 130},{LCY + 130}" stroke="#d0342c" stroke-width="3" fill="none"/>')
for i in range(4):
    t = 0.22 + i * 0.24
    px = LCX + 130 * t + 20 * t
    py = LCY + 130 * t
    b.append(f'<path d="M{px - 7:.0f},{py + 4:.0f} A7,7 0 0 1 {px + 7:.0f},{py + 4:.0f} Z" fill="#d0342c"/>')
b.append(f'<path d="M{LCX},{LCY} C{LCX - 50},{LCY + 46} {LCX - 66},{LCY + 90} {LCX - 76},{LCY + 140}" stroke="#1d5f9e" stroke-width="3" fill="none"/>')
for i in range(4):
    t = 0.2 + i * 0.25
    px = LCX - 76 * t - 14 * t
    py = LCY + 140 * t
    b.append(f'<path d="M{px - 6:.0f},{py + 5:.0f} L{px + 6:.0f},{py + 5:.0f} L{px:.0f},{py - 7:.0f} Z" fill="#1d5f9e"/>')
b.append(f'<text class="xs b red" x="{LCX + 106}" y="{LCY + 156}">warm front</text>')
b.append(f'<text class="xs b" x="{LCX - 150}" y="{LCY + 160}" fill="#1d5f9e">cold front</text>')
b.append(f'<text class="xs b" x="{LCX + 8}" y="{LCY + 118}">warm sector</text>')
b.append(f'<path d="M{LCX},{LCY} C{LCX - 46},{LCY - 20} {LCX - 94},{LCY - 52} {LCX - 126},{LCY - 92}" stroke="#8a5cd0" stroke-width="3" fill="none"/>')
for _i in range(3):
    _t = 0.32 + _i * 0.26
    _px = LCX - 126 * _t
    _py = LCY - 92 * _t
    if _i % 2 == 0:
        b.append(f'<path d="M{_px - 7:.0f},{_py + 4:.0f} A7,7 0 0 1 {_px + 7:.0f},{_py + 4:.0f} Z" fill="#8a5cd0"/>')
    else:
        b.append(f'<path d="M{_px - 6:.0f},{_py + 5:.0f} L{_px + 6:.0f},{_py + 5:.0f} L{_px:.0f},{_py - 7:.0f} Z" fill="#8a5cd0"/>')
b.append(f'<text class="xs b" x="{LCX - 186}" y="{LCY - 96}" fill="#8a5cd0">occlusion</text>')
b.append(f'<line x1="{LCX + 140}" y1="{LCY - 40}" x2="{LCX + 200}" y2="{LCY - 100}" stroke="#1f8a4c" stroke-width="2.4" marker-end="url(#agrn)"/>')
b.append(f'<text class="xs b grn" x="{LCX + 128}" y="{LCY - 112}">system tracks NE</text>')
b.append(wrap("Buys Ballot's law in the northern hemisphere: stand with your back to the wind and low pressure is on your LEFT.", 18, 392, 58, "xs", 16))
b.append(wrap("Wind circulates anticlockwise around a low and clockwise around a high, angled slightly in towards the low.", 18, 428, 58, "xs", 16))
b.append(wrap("Isobars close together mean strong wind. A backing wind with a falling barometer means it is deteriorating.", 18, 464, 58, "xs", 16))

b.append('<line class="lnf" x1="470" y1="40" x2="470" y2="440"/>')
b.append('<text class="s b" x="490" y="52">What you feel as the fronts pass (system moving over you, left to right)</text>')
seq = [
    ("Ahead of the warm front", "Cirrus then thickening cloud, pressure falling steadily, wind freshening and backing (SW towards SE), continuous rain as the front nears."),
    ("Warm front passes", "Rain eases to drizzle, wind VEERS (S–SW), pressure steadies, temperature rises, visibility falls — often fog or poor visibility."),
    ("In the warm sector", "Overcast, low stratus, drizzle, mild and muggy, poor visibility, pressure steady."),
    ("Cold front passes", "Squall line, heavy showers, cumulonimbus, wind VEERS sharply (SW–NW) and gusts, pressure rises sharply, temperature drops."),
    ("Behind the cold front", "Clear polar air, good visibility, bright with cumulus and showers, gusty, pressure rising."),
]
yy = 78
for t, d in seq:
    b.append(f'<text class="s b" x="490" y="{yy}">{t}</text>')
    words = d.split()
    line, lines = "", []
    for w in words:
        if len(line) + len(w) > 52:
            lines.append(line)
            line = w
        else:
            line = (line + " " + w).strip()
    lines.append(line)
    yy += 18
    for ln in lines:
        b.append(f'<text class="xs" x="490" y="{yy}">{ln}</text>')
        yy += 15
    yy += 8
b.append('<text class="note" x="490" y="424">In the northern hemisphere the wind VEERS as each front passes — the classic exam giveaway.</text>')
D.append(svg("ds-fronts", 900, 460, "".join(b), "Depressions and fronts"))

# ------------------------------------------------------------ 20. anchoring
b = []
b.append(f'<rect x="18" y="60" width="500" height="150" class="sea"/>')
b.append('<path d="M18,210 L518,210 L518,250 L18,250 Z" class="land"/>')
b.append('<line x1="18" y1="60" x2="518" y2="60" stroke="#1d5f9e" stroke-width="2"/>')
b.append(hull(150, 78, 46, 22))
b.append('<path d="M150,86 C220,120 300,180 420,206" stroke="#14202b" stroke-width="2.4" fill="none"/>')
b.append('<path d="M414,200 l16,10 m-8,-14 l-4,16" stroke="#14202b" stroke-width="2.4" fill="none"/>')
b.append(varrow(70, 60, 210, "depth of water"))
b.append('<text class="xs b" x="240" y="128">scope = length of cable let out</text>')
b.append('<text class="xs" x="240" y="146">chain: 4 × max depth  •  rope: 6 × max depth</text>')
b.append('<text class="xs" x="240" y="164">more in strong wind, swell or poor holding</text>')
b.append('<text class="xs" x="330" y="234">good holding: mud, sand, clay</text>')
b.append('<text class="xs" x="330" y="250">poor: rock, weed, shingle</text>')

b.append('<text class="s b" x="560" y="80">Choosing the spot</text>')
for i, t in enumerate([
    "Shelter from the wind now AND after the forecast shift",
    "Good holding ground — read the chart's seabed symbol",
    "Enough depth at LOW water, and enough swinging room",
    "Out of the fairway, cables and prohibited anchorages",
    "Tidal stream not too strong; a lee shore is not shelter",
]):
    b.append(f'<text class="s" x="560" y="{104 + i * 20}">• {t}</text>')
b.append('<text class="s b" x="560" y="234">Depth to plan for</text>')
b.append('<text class="mono" x="560" y="256">max depth = charted depth + height of tide at HW</text>')
b.append('<text class="mono" x="560" y="276">min depth = charted depth + height of tide at LW</text>')
b.append(wrap("Take the scope from the MAXIMUM depth, then check the MINIMUM still clears your keel.", 560, 298, 54, "xs", 16))

b.append('<text class="s b" x="18" y="340">Anchoring drill</text>')
_y = 364
for i, t in enumerate([
    "Brief the crew, prepare the anchor, and measure and mark the cable.",
    "Motor slowly up-wind or up-tide to the chosen spot and stop over the ground.",
    "Lower the anchor — never throw it — as the boat starts to make way astern, paying out cable steadily so it lies in a line and not in a heap.",
    "Snub the cable to let the anchor dig in, then go gently astern on the engine to set it.",
    "Take two transits or bearings, or set a GNSS anchor alarm, and watch that they hold.",
    "By day hoist a black ball forward; by night show an all-round white anchor light.",
    "Log the position and the depth, and keep an anchor watch if the weather is at all doubtful.",
]):
    blk = wrap(f"{i + 1}. {t}", 18, _y, 118, "s", 20)
    b.append(blk)
    _y += 20 * blk.count("<text") + 4
b.append(f'<text class="s b" x="18" y="{_y + 22}">Anchor types</text>')
_y += 44
for t in [
    "CQR / plough — a good all-rounder in mud and sand, slow to set",
    "Danforth / Fortress — stows flat, excellent in sand, poor in weed",
    "Bruce / claw — sets and resets readily, awkward to stow",
    "Delta and modern scoop types (Rocna, Spade) — high holding for their weight",
    "Fisherman — the one that hooks into rock and heavy weed",
]:
    b.append(f'<text class="s" x="18" y="{_y}">• {t}</text>')
    _y += 20
b.append(wrap("Chain holds through the catenary of its own weight and resists chafe on the bottom; rope needs more scope and a length of chain at the anchor end. "
              "To weigh, motor slowly up to the anchor as the cable comes in — do not winch the boat up to the anchor.", 18, _y + 16, 118))
D.append(svg("ds-anchoring", 940, _y + 66, "".join(b), "Anchoring"))

# ---------------------------------------------------------------- 21. MOB
b = []
b.append('<text class="s b" x="18" y="52">Immediate actions — shout, throw, point</text>')
steps = [
    "SHOUT “Man overboard!” — get everyone on deck and keep the casualty in sight.",
    "THROW buoyancy immediately: danbuoy, horseshoe, lifebuoy with light.",
    "POINT — one crew member does nothing but point at the casualty, continuously.",
    "Press the MOB button on the GNSS / chart plotter to mark the position.",
    "Start the engine (check for lines over the side) and take the sails down or heave to as the plan requires.",
    "If the casualty is lost from sight, or you need help: DSC distress alert and MAYDAY on VHF channel 16.",
    "Recover on the LEEWARD side, boat stopped, engine in neutral before anyone goes near the water.",
    "Get them out horizontally if you can — vertical lifting can cause post-immersion collapse.",
    "Treat for cold-water shock and hypothermia: keep flat, insulate, no alcohol, no rubbing, handle gently, get medical help.",
]
yy = 78
for i, _s in enumerate(steps):
    blk = wrap(f"{i + 1}. {_s}", 18, yy, 116, "s", 20)
    b.append(blk)
    yy += 20 * blk.count("<text") + 4
b.append(f'<line class="lnf" x1="18" y1="{yy + 2}" x2="882" y2="{yy + 2}"/>')
yy += 30
b.append(f'<text class="s b" x="18" y="{yy}">Recovery under sail — reach, tack, reach</text>')
yy2 = yy + 24
b.append(wrap("Bear away onto a BEAM REACH and sail on for about four to six boat lengths. TACK — do not gybe — and bear away onto the reciprocal beam reach. "
              "Then turn up to approach on a CLOSE REACH, so you can spill or trim the sails to control your speed, and stop with the casualty just to leeward of the bow.",
              18, yy2, 62, "s", 20))
b.append(f'<text class="s b" x="500" y="{yy}">Recovery under power</text>')
b.append(wrap("Turn TOWARDS the casualty's side, so the stern and the propeller swing away from them. Come back and approach slowly, stopping with the casualty on the leeward bow or amidships. "
              "The engine must be OUT OF GEAR before anyone is near the hull. Rig a lifting strop, a halyard on a winch, the boarding ladder or the mainsail used as a scoop.",
              500, yy2, 62, "s", 20))
# small diagram
gy = yy2 + 100
b.append(f'<line x1="80" y1="{gy + 130}" x2="820" y2="{gy + 130}" stroke="none"/>')
b.append(f'<line x1="120" y1="{gy + 34}" x2="120" y2="{gy + 6}" stroke="#1d5f9e" stroke-width="2.6" marker-start="url(#ablu)"/>')
b.append(f'<text class="xs b" x="132" y="{gy + 16}" fill="#1d5f9e">wind</text>')
b.append(f'<circle cx="300" cy="{gy + 40}" r="7" fill="#d0342c"/><text class="xs b red" x="286" y="{gy + 26}">MOB</text>')
b.append(f'<path d="M300,{gy + 48} C360,{gy + 90} 420,{gy + 110} 470,{gy + 112}" stroke="#14202b" stroke-width="2" fill="none" stroke-dasharray="7 4" marker-end="url(#a)"/>')
b.append(f'<text class="xs" x="336" y="{gy + 104}">1. beam reach away</text>')
b.append(f'<path d="M470,{gy + 112} C520,{gy + 112} 540,{gy + 88} 520,{gy + 72}" stroke="#1f8a4c" stroke-width="2" fill="none" marker-end="url(#agrn)"/>')
b.append(f'<text class="xs grn" x="486" y="{gy + 66}">2. tack</text>')
b.append(f'<path d="M520,{gy + 72} C450,{gy + 60} 370,{gy + 46} 316,{gy + 42}" stroke="#14202b" stroke-width="2" fill="none" marker-end="url(#a)"/>')
b.append(f'<text class="xs" x="368" y="{gy + 34}">3. close reach in, spill the sails, stop</text>')
b.append(wrap(
    "Practise it in flat water before you need it in a seaway. The RYA also expects you to know the quick-stop — tack immediately, leave the headsail backed, "
    "then motor or sail the last few lengths — and to know that prevention beats recovery: harnesses, jackstays, and clipping on at night or in rough weather.",
    18, gy + 156, 132))
D.append(svg("ds-mob", 940, gy + 210, "".join(b), "Man overboard"))

# ------------------------------------------------------------ 22. VHF & distress
b = []
b.append('<rect x="18" y="52" width="424" height="286" rx="7" class="lnf" fill="#fff6f5"/>')
b.append('<text class="s b red" x="30" y="76">MAYDAY — grave and imminent danger</text>')
b.append('<text class="mono" x="30" y="102">MAYDAY MAYDAY MAYDAY</text>')
b.append('<text class="mono" x="30" y="122">THIS IS yacht Seabird, Seabird, Seabird</text>')
b.append('<text class="mono" x="30" y="142">MMSI 232012345, callsign MABC1</text>')
b.append('<text class="mono" x="30" y="162">MAYDAY yacht Seabird, MMSI 232012345</text>')
b.append('<text class="mono" x="30" y="182">MY POSITION IS 50°42′.3 N 001°18′.7 W</text>')
b.append('<text class="mono" x="30" y="202">I am holed and sinking</text>')
b.append('<text class="mono" x="30" y="222">I require immediate assistance</text>')
b.append('<text class="mono" x="30" y="242">4 persons on board, taking to the liferaft</text>')
b.append('<text class="mono" x="30" y="262">White hull, 11 metres, EPIRB activated</text>')
b.append('<text class="mono" x="30" y="282">OVER</text>')
b.append('<text class="xs b" x="30" y="312">Send the DSC distress alert FIRST (press and hold for 5 s),</text>')
b.append('<text class="xs b" x="30" y="328">then the voice MAYDAY on channel 16.</text>')

b.append('<text class="s b" x="470" y="76">The other two urgency levels</text>')
b.append('<text class="s b" x="470" y="102">PAN-PAN</text>')
b.append('<text class="s" x="470" y="122">Urgency: a serious situation concerning the safety of the</text>')
b.append('<text class="s" x="470" y="140">vessel or a person, but not grave and imminent danger —</text>')
b.append('<text class="s" x="470" y="158">engine failure in a safe position, a broken arm.</text>')
b.append('<text class="s b" x="470" y="184">SÉCURITÉ</text>')
b.append('<text class="s" x="470" y="204">Safety: a navigational or meteorological warning —</text>')
b.append('<text class="s" x="470" y="222">a container adrift, an unlit buoy, a gale warning.</text>')
b.append('<text class="s b" x="470" y="252">Ch 16 is the distress, safety and calling channel.</text>')
b.append('<text class="s" x="470" y="272">Ch 70 carries DSC data only — never speak on it.</text>')
b.append('<text class="s" x="470" y="292">A MAYDAY RELAY is sent on behalf of another vessel.</text>')
b.append('<text class="s" x="470" y="312">SEELONCE MAYDAY imposes radio silence; SEELONCE FEENEE lifts it.</text>')

b.append('<text class="s b" x="18" y="372">Recognised distress signals (Annex IV)</text>')
sigs2 = [
    "Continuous sounding of any fog-signalling apparatus",
    "A gun or other explosive signal at about one-minute intervals",
    "Rockets or shells throwing red stars, fired one at a time at short intervals",
    "Red parachute or hand flare; orange smoke signal",
    "SOS by any signalling method (··· ——— ···); the spoken word “Mayday”",
    "Code flags NC; a square flag with a ball above or below it",
    "Flames on the vessel (burning tar barrel)",
    "Slowly and repeatedly raising and lowering the arms outstretched to each side",
    "DSC alert, EPIRB / PLB, SART, INMARSAT alert",
]
_y = 396
_col2 = 396
for _i, _sig in enumerate(sigs2):
    _x = 18 if _i < 5 else 492
    if _i < 5:
        _blk = wrap(f"&#8226; {_sig}", _x, _y, 56, "s", 18)
        _y += 18 * _blk.count("<text") + 6
    else:
        _blk = wrap(f"&#8226; {_sig}", _x, _col2, 52, "s", 18)
        _col2 += 18 * _blk.count("<text") + 6
    b.append(_blk)
b.append(wrap("Flares: RED = distress. ORANGE smoke = distress by day. WHITE = a collision warning, NOT distress. "
              "Hold a hand flare at arm's length over the side, downwind and to leeward; fire a parachute rocket near vertically, "
              "back to the wind, never out over the water.", 18, max(_y, _col2) + 20, 128))
D.append(svg("ds-vhf-distress", 940, max(_y, _col2) + 84, "".join(b), "VHF, DSC and distress"))

# ------------------------------------------------------ 23. passage planning
b = []
items = [
    ("Weather", "Forecast for the whole passage plus a margin; sources and when you will update it; your crew's and boat's limits."),
    ("Tides", "Tidal heights at departure, en route and arrival (gates, sills, bars, bridges); tidal streams hour by hour; times of HW and LW."),
    ("Limitations of the vessel", "Draught, air draught, fuel and water range, sail wardrobe, gear condition, self-steering, navigation kit."),
    ("Crew", "Experience, fitness, seasickness, watch system, hours of darkness, food and hot drinks."),
    ("Navigational dangers", "Overfalls, races, shoals, rocks, wrecks, TSS, firing ranges, ferry routes, lobster pots."),
    ("Contingency plan", "Bolt holes and ports of refuge for every leg, and the conditions in which you would use them."),
    ("Information ashore", "Someone ashore knows your plan, your ETA and what to do if you are overdue."),
]
yy = 68
b.append('<text class="s b" x="18" y="52">SOLAS Chapter V requires every small craft skipper to plan the passage. The RYA checklist:</text>')
for t, d in items:
    b.append(f'<text class="s b" x="18" y="{yy}">{t}</text>')
    b.append(f'<text class="s" x="210" y="{yy}">{d}</text>')
    yy += 30
b.append(f'<text class="xs b" x="18" y="{yy + 8}">Mnemonic: "Wet Tides Leave Crews Needing Coffee Inland" — or simply remember the RYA order above.</text>')
yy += 40
b.append(f'<text class="s b" x="18" y="{yy}">Before you leave — the skipper\'s checks</text>')
yy += 24
checks = [
    "Engine: oil, coolant, belt, fuel, raw-water filter, seacock open, exhaust cooling water after start",
    "Bilges dry, bilge pump works, seacocks known and reachable, softwood bungs aboard",
    "Safety gear located and briefed: lifejackets, harnesses, flares, fire extinguishers, fire blanket, first aid, liferaft, danbuoy, radar reflector, grab bag",
    "Navigation lights and instruments tested; VHF radio check; GNSS and paper chart both ready; almanac and tide times noted",
    "Gear stowed for sea, hatches and lockers secure, anchor ready, sails and reefing lines rigged, headsail sheets led",
    "Crew brief: heads, galley, gas, lifejackets, harness clipping points, MOB drill, VHF distress, where everything is, who does what",
    "Log the departure: time, log reading, position, weather, crew, fuel",
]
for c in checks:
    b.append(f'<text class="s" x="18" y="{yy}">• {c}</text>')
    yy += 22
b.append(f'<text class="note" x="18" y="{yy + 16}">Passage planning is a decision to go or not to go, taken before you leave the dock — not something you finish once you are at sea.</text>')
D.append(svg("ds-passage-planning", 900, yy + 40, "".join(b), "Passage planning"))

# ------------------------------------------------------------- 24. knots
b = []
knots = [
    ("Figure of eight", "Stopper knot in the end of a sheet or halyard so it cannot run out through a block."),
    ("Bowline", "A fixed loop that will not slip and unties easily — sheet to a clew, loop over a post, jib sheet."),
    ("Clove hitch", "Attaching a fender lanyard to a guard rail or a line to a rail or post. Slips under uneven load."),
    ("Round turn and two half hitches", "Securing a mooring line to a ring, post or bollard under load; can be tied and untied under tension."),
    ("Rolling hitch", "Grips along another rope or a spar — taking the load off a jammed sheet or riding turn on a winch."),
    ("Reef knot", "Joining two ends of the SAME line of equal size — tying in a reef, lashing a sail. Not for joining two ropes under load."),
    ("Sheet bend / double sheet bend", "Joining two ropes, especially of different diameter; double it for security."),
    ("Single and double sheet bend", "See sheet bend — the double turn is for ropes of unequal size or slippery rope."),
]
yy = 68
for n, d in knots[:7]:
    b.append(f'<text class="s b" x="18" y="{yy}">{n}</text>')
    b.append(f'<text class="s" x="300" y="{yy}">{d}</text>')
    yy += 30
yy += 14
b.append(f'<text class="s b" x="18" y="{yy}">Rope: synthetic fibres</text>')
yy += 26
ropes = [
    ("Polyester (Terylene, Dacron)", "Low stretch, good UV and abrasion resistance, sinks — the standard for sheets and halyards."),
    ("Nylon (polyamide)", "Strong and very stretchy, absorbs shock — mooring lines, anchor warps. Loses some strength when wet."),
    ("Polypropylene", "Cheap, light, FLOATS, poor UV resistance and low strength — heaving lines, dinghy painters, not for load."),
    ("Aramid / HMPE (Dyneema, Spectra)", "Very high strength, almost no stretch, expensive — racing halyards, running rigging."),
]
for n, d in ropes:
    b.append(f'<text class="s b" x="18" y="{yy}">{n}</text>')
    b.append(f'<text class="s" x="300" y="{yy}">{d}</text>')
    yy += 26
yy += 14
b.append(f'<text class="s b" x="18" y="{yy}">Care and terms</text>')
yy += 24
for t in [
    "Whip or heat-seal every end. Coil laid rope clockwise; braid can be flaked into a figure of eight to avoid kinks.",
    "Rinse in fresh water, dry before stowing, keep out of sunlight, avoid sharp bends and chafe — chafe is what actually breaks lines.",
    "Never load a rope over a sharp edge; use a fairlead. Knots reduce a rope’s strength (a bowline by roughly 40%); a splice much less.",
    "Terms: standing part • bight • working end • bitter end • to make fast • to belay • to surge • riding turn • snub • chafe.",
]:
    b.append(f'<text class="s" x="18" y="{yy}">• {t}</text>')
    yy += 22
D.append(svg("ds-knots-ropes", 900, yy + 24, "".join(b), "Knots and rope — quick reference"))


def _wrap(t, n):
    return [t]


# ------------------------------------------------------------------- render
def main():
    if not os.path.isfile(CHROME):
        sys.exit(f"chrome-headless-shell not found at {CHROME}")
    os.makedirs(OUT, exist_ok=True)
    tmp = "/tmp/claude-1000/-workspaces-sandbox/rya-svg"
    os.makedirs(tmp, exist_ok=True)
    made = []
    for name, w, h, doc in D:
        svgp = os.path.join(tmp, name + ".svg")
        with open(svgp, "w") as f:
            f.write(doc)
        htmlp = os.path.join(tmp, name + ".html")
        with open(htmlp, "w") as f:
            f.write(
                f"<!doctype html><html><body style='margin:0;background:#fff'>"
                f"<img src='{name}.svg' width='{w}' height='{h}'></body></html>"
            )
        png = os.path.join(OUT, name + ".png")
        r = subprocess.run(
            [
                CHROME,
                "--headless",
                "--no-sandbox",
                "--disable-gpu",
                "--hide-scrollbars",
                "--force-device-scale-factor=2",
                f"--window-size={w},{h}",
                f"--screenshot={png}",
                "file://" + htmlp,
            ],
            capture_output=True,
            text=True,
        )
        # A valid diagram is always tens of KB. A tiny file means the SVG failed to
        # parse — usually markup split across lines by wrap() — and rendered blank.
        ok = os.path.isfile(png) and os.path.getsize(png) > 30000
        made.append((name, w, h, ok, os.path.getsize(png) if os.path.isfile(png) else 0))
        if not ok:
            print("FAIL", name, r.stderr[-300:])
    for n, w, h, ok, sz in made:
        print(f"{'ok ' if ok else 'BAD'} {n}.png  {w}x{h}  {sz // 1024} KB")
    print(f"\n{sum(1 for m in made if m[3])}/{len(made)} rendered into {OUT}")
    if OVERFLOW:
        print(f"\n{len(OVERFLOW)} text elements overflow the right edge:")
        for n, over, txt in sorted(OVERFLOW, key=lambda r: -r[1]):
            print(f"  {n:26s} +{over:4d}px  {txt}")


if __name__ == "__main__":
    main()
