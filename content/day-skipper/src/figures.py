#!/usr/bin/env python3
"""Author the app's labelled doodles, and write them to web/figures.json.

These are not the same thing as the diagrams in `diagrams.py`. A diagram is a
reference page — a whole topic laid out to be pinch-zoomed. A figure is a small
drawing that belongs to a single card: it shows *where a thing is*, in the same
ink-and-currentColor idiom as the doodles in the app chrome, so it costs a few
hundred bytes, follows the theme into dark mode, and needs no second asset.

Two rules keep them honest:

1. A figure is only worth drawing when the answer is a place or a shape.
   Definitions and procedures get no figure; a picture of a sentence is
   decoration, and decoration on a flashcard is a cost with no recall to show
   for it.

2. Every label carries an id, and a card lights only the labels it asks for.
   The rest stay dimmed as context. That is what lets one drawing serve the
   draught, air-draught and freeboard cards without the first one answering
   the other two.

Colour carries meaning only: port red and starboard green because that is what
the lights are, the four flare colours because that is how you tell them apart
in a locker at night. Everything else is ink.
"""
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
WEB = os.path.join(ROOT, "build")
sys.path.insert(0, HERE)

import rough                                                        # noqa: E402

FIGS = {}
ERRS = []


# ── the small drawing vocabulary ────────────────────────────────────────────
# Everything below composes these. Keeping the primitives few is what stops
# twenty figures drifting into twenty styles.

def _cls(cls):
    return ' class="%s"' % cls if cls else ""


def p(d, cls=None):
    """A stroked path. No class means the 2px ink the whole look rests on."""
    return '<path%s d="%s"/>' % (_cls(cls), d)


def fill(d, cls):
    return f'<path class="{cls}" d="{d}"/>'


def circ(cx, cy, r, cls=None):
    return '<circle%s cx="%s" cy="%s" r="%s"/>' % (_cls(cls), cx, cy, r)


def txt(x, y, s, cls="", anchor="middle", size=None, rot=None, lid=None):
    # Small print is a note, not a name. A dimmed note is unreadable texture, so
    # notes disappear entirely unless their label is the one the card asks for.
    if size and size <= 12:
        cls = (cls + " f-note").strip()
    a = ['class="%s"' % ("f-lab " + cls).strip()]
    a.append(f'x="{x}" y="{y}"')
    if anchor != "start":
        a.append(f'text-anchor="{anchor}"')
    if size:
        a.append(f'font-size="{size}"')
    if rot:
        a.append(f'transform="rotate({rot} {x} {y})"')
    if lid:
        a.append(f'data-l="{lid}"')
    return f'<text {" ".join(a)}>{s}</text>'


def lead(d, lid, cls=""):
    """A leader line from a label to the thing it names."""
    return f'<path class="{("f-lead " + cls).strip()}" data-l="{lid}" d="{d}"/>'


def mark(d, lid, cls=""):
    """Any drawn element that should dim and light with a label."""
    return f'<path class="{cls}" data-l="{lid}" d="{d}"/>'


def vdim(x, y1, y2, lid, cls="f-meas"):
    """A vertical double-headed measure arrow, y1 above y2."""
    return (f'<path class="{cls}" data-l="{lid}" d="M{x} {y1}V{y2}'
            f'M{x - 5} {y1 + 8} {x} {y1}l5 8M{x - 5} {y2 - 8}l5 8 5-8"/>')


def hdim(y, x1, x2, lid, cls="f-meas"):
    """A horizontal double-headed measure arrow, x1 left of x2."""
    return (f'<path class="{cls}" data-l="{lid}" d="M{x1} {y}H{x2}'
            f'M{x1 + 8} {y - 5} {x1} {y}l8 5M{x2 - 8} {y - 5}l8 5-8 5"/>')


def arrow(d, lid=None, cls=""):
    """An open arrowhead is drawn into the path itself; this is just the shaft."""
    return mark(d, lid, cls) if lid else p(d, cls)


def fig(name, vb, caption, body, labels, note=""):
    """Register a figure. `labels` is the full set of ids a card may light."""
    # The caption is set with textContent, so an entity would show up as itself.
    if "&#" in caption or "&amp;" in caption:
        ERRS.append(f"{name}: caption is plain text, use the character not an entity")
    ids = set(re.findall(r'data-l="([^"]+)"', body))
    unknown = ids - set(labels)
    if unknown:
        ERRS.append(f"{name}: data-l ids with no entry in labels: {sorted(unknown)}")
    unused = set(labels) - ids
    if unused:
        ERRS.append(f"{name}: labels never drawn: {sorted(unused)}")
    FIGS[name] = {"vb": vb, "cap": caption, "b": body, "l": list(labels), "note": note}


# ═══════════════════════════ 01 — boat and terms ════════════════════════════

# ── the hull from above ──
def _plan():
    b = []
    # Faired so there is one unmistakable widest station: with parallel sides
    # and a transom nearly as wide as the beam, "the widest part of the hull"
    # has nothing to land on.
    b.append(p("M200 34C218 64 246 104 248 142C248 172 232 196 220 212L180 212"
               "C168 196 152 172 152 142C154 104 182 64 200 34Z"))
    b.append(p("M178 150h44v46h-44z"))
    b.append(p("M28 74c8-9 16-9 24 0s16 9 24 0", "f-thin"))
    b.append(p("M364 206c8-9 16-9 24 0s16 9 24 0", "f-thin"))
    b.append(mark("M174 212C164 200 152 176 152 140C152 100 182 66 200 34", "port", "c-red f-side"))
    b.append(mark("M200 34C218 66 248 100 248 140C248 176 236 200 226 212", "starboard",
                  "c-grn f-side"))
    b.append(lead("M200 20v10", "bow"))
    b.append(lead("M200 214v12", "stern"))
    b.append(lead("M118 180 154 176", "port", "c-red"))
    b.append(lead("M282 180 246 176", "starboard", "c-grn"))
    b.append(txt(200, 14, "bow", lid="bow"))
    b.append(txt(200, 244, "stern", lid="stern"))
    b.append(txt(112, 184, "port", "c-red", anchor="end", lid="port"))
    b.append(txt(288, 184, "starboard", "c-grn", anchor="start", lid="starboard"))
    # amidships: the middle both ways, and the point where the two middles meet
    b.append(mark("M156 123h88", "amidships", "c-acc f-cut"))
    b.append(mark("M200 36v174", "amidships", "c-acc f-cut"))
    b.append(circ(200, 123, 5, "c-acc"))
    b.append(lead("M114 106 150 120", "amidships", "c-acc"))
    b.append(txt(108, 102, "amidships", "c-acc", anchor="end", size=13, lid="amidships"))
    # beam, meaning one: her greatest breadth, dimensioned clear of the hull
    b.append(mark("M152 142v130M248 142v130", "beam", "f-dash"))
    b.append(mark("M144 142h14M242 142h14", "beam"))
    b.append(hdim(272, 152, 248, "beam"))
    b.append(txt(200, 296, "beam &#8212; her greatest breadth", size=13, lid="beam"))
    # beam, meaning two: the direction at right angles to her
    b.append(mark("M146 142H58M66 134 58 142 66 150", "beam", "f-meas"))
    b.append(mark("M254 142h110M356 134 364 142 356 150", "beam", "f-meas"))
    b.append(txt(10, 134, "abeam", anchor="start", size=13, lid="beam"))
    b.append(txt(368, 134, "abeam", anchor="start", size=13, lid="beam"))
    return "".join(b)


fig(
    "hull-plan", "0 0 440 312",
    "Seen from above, bow at the top \u2014 as if you were facing forward.",
    _plan(),
    ["bow", "stern", "port", "starboard", "amidships", "beam"],
)

# ── the hull in profile ──
def _profile():
    b = []
    # Drawn near true proportion: air draught on a cruising yacht is more than
    # her length, and a rig drawn at half her length teaches the wrong instinct
    # about the bridge she is about to go under.
    b.append(p("M20 286h420", "f-dash"))
    b.append(p("M110 262C170 272 260 268 310 242C314 258 310 272 300 284"
               "C250 306 160 306 120 290Z"))
    b.append(p("M196 296 190 352 226 352 220 294"))
    b.append(p("M142 292 138 326 154 324 156 290"))
    b.append(p("M232 266V40"))
    b.append(p("M232 40v-10", "f-rig"))           # the aerial the reference lands on
    b.append(circ(232, 28, 3))
    b.append(p("M232 246 168 254"))
    b.append(p("M232 40 308 244M232 40 114 264", "f-rig"))
    # the seabed: what a draught is actually about
    b.append(p("M20 380h420", "f-thin"))
    b.append(p("M28 380 20 392M60 380 52 392M92 380 84 392M124 380 116 392M156 380 148 392"
               "M188 380 180 392M220 380 212 392M252 380 244 392M284 380 276 392"
               "M316 380 308 392M348 380 340 392M380 380 372 392M412 380 404 392", "f-thin"))
    b.append(mark("M232 28H50", "air-draught", "f-dash"))
    b.append(vdim(50, 28, 286, "air-draught"))
    b.append(txt(36, 150, "air draught", rot=-90, lid="air-draught"))
    b.append(txt(74, 150, "masthead to waterline,", "c-mut", rot=-90, size=11, lid="air-draught"))
    b.append(txt(90, 150, "aerial included", "c-mut", rot=-90, size=11, lid="air-draught"))
    b.append(mark("M226 352h160M300 286h86", "draught", "f-dash"))
    b.append(vdim(380, 286, 352, "draught", "meas-on"))
    b.append(txt(400, 322, "draught", "c-acc", rot=-90, lid="draught"))
    
    b.append(vdim(160, 268, 286, "freeboard"))
    b.append(lead("M162 282 250 312", "freeboard"))
    b.append(txt(256, 316, "freeboard", anchor="start", lid="freeboard"))
    b.append(txt(256, 334, "deck edge to waterline", "c-mut", anchor="start", size=11,
                 lid="freeboard"))
    b.append(txt(20, 306, "waterline", anchor="start", size=13, lid="waterline"))
    b.append(txt(432, 372, "seabed", anchor="end", size=12, lid="draught"))
    return "".join(b)


fig(
    "hull-profile", "0 0 460 400",
    "In profile, afloat at her designed waterline.",
    _profile(),
    ["air-draught", "freeboard", "draught", "waterline"],
)

# ── relative bearings ──
def _bearings():
    b = []
    cx, cy, r = 200, 150, 120
    # the boat, small, at the centre, pointing up
    b.append(p("M200 96C208 112 222 130 222 152L220 190 180 190 178 152C178 130 192 112 200 96Z"))
    b.append(circ(cx, cy, r, "f-dash"))
    b.append(p("M80 150h240", "f-dash"))
    b.append(p("M200 30v240", "f-dash"))
    # the two sectors, as spans on the circle rather than words in a quadrant
    b.append(mark("M200 30A120 120 0 0 1 320 150", "forward-beam", "c-grn f-arc"))
    b.append(mark("M200 30A120 120 0 0 0 80 150", "forward-beam", "c-grn f-arc"))
    b.append(mark("M320 150A120 120 0 0 1 200 270", "abaft-beam", "c-amb f-arc"))
    b.append(mark("M80 150A120 120 0 0 0 200 270", "abaft-beam", "c-amb f-arc"))
    # 112.5 degrees from ahead: 22.5 degrees aft of the beam line, both sides
    b.append(mark("M200 150 310.9 195.9M200 150 89.1 195.9", "abaft-22", "c-acc f-cut"))
    b.append(mark("M320 150A120 120 0 0 1 310.9 195.9", "abaft-22", "c-acc f-arc-on"))
    b.append(mark("M80 150A120 120 0 0 0 89.1 195.9", "abaft-22", "c-acc f-arc-on"))
    b.append(txt(200, 22, "ahead", lid="ahead"))
    b.append(txt(200, 292, "astern", lid="astern"))
    b.append(txt(40, 146, "abeam", lid="abeam"))
    b.append(txt(360, 146, "abeam", lid="abeam"))
    b.append(txt(330, 84, "forward of", "c-grn", size=13, lid="forward-beam"))
    b.append(txt(330, 100, "the beam", "c-grn", size=13, lid="forward-beam"))
    b.append(txt(74, 226, "abaft", "c-amb", size=13, lid="abaft-beam"))
    b.append(txt(74, 242, "the beam", "c-amb", size=13, lid="abaft-beam"))
    b.append(txt(452, 232, "112.5&#176; from ahead", "c-acc", anchor="end", size=13, lid="abaft-22"))
    b.append(txt(452, 250, "= 22.5&#176; abaft the beam", "c-acc", anchor="end", size=12, lid="abaft-22"))
    b.append(txt(452, 266, "the after cut-off of each sidelight", "c-acc", anchor="end", size=12,
                 lid="abaft-22"))
    return "".join(b)


fig(
    "bearings", "0 0 460 306",
    "Relative bearings, from your own bow.",
    _bearings(),
    ["ahead", "astern", "abeam", "forward-beam", "abaft-beam", "abaft-22"],
)

# ── the parts of a mainsail ──
fig(
    "sail-parts", "0 0 440 326",
    "The mainsail, her bow to the right like every other drawing here.",
    "".join([
        # The mast clear of the luff and the boom clear of the foot: drawn on
        # the same line, the thick sail edge buries the spar, and the label for
        # the spar then points at the sail.
        p("M312 288V36"),
        p("M312 272 104 278", "f-boom"),
        # sail ties, so the offset reads as attached rather than flying free
        p("M160 262 158 276M212 260 210 274M264 257 262 272", "f-tie"),
        p("M292 50 114 258 292 254Z", "f-sail"),
        mark("M292 50 114 258", "leech", "c-acc f-edge"),
        mark("M292 50 292 254", "luff", "c-acc f-edge"),
        mark("M114 258 292 254", "foot", "c-acc f-edge"),
        lead("M286 48 230 26", "head"),
        lead("M292 258 258 296", "tack"),
        lead("M114 258 70 238", "clew"),
        txt(222, 22, "head", anchor="end", lid="head"),
        txt(250, 306, "tack", anchor="end", lid="tack"),
        txt(62, 234, "clew", anchor="end", lid="clew"),
        lead("M356 118 298 120", "luff", "c-acc"),
        txt(362, 124, "luff", "c-acc", anchor="start", lid="luff"),
        lead("M162 150 198 162", "leech", "c-acc"),
        txt(156, 146, "leech", "c-acc", anchor="end", lid="leech"),
        lead("M204 232 204 256", "foot", "c-acc"),
        txt(204, 226, "foot", "c-acc", lid="foot"),
        txt(332, 30, "mast", size=13, anchor="start", lid="mast"),
        txt(96, 298, "boom", size=13, anchor="start", lid="boom"),
    ]),
    ["head", "tack", "clew", "luff", "leech", "foot", "mast", "boom"],
)

# ── standing and running rigging ──
fig(
    "rigging", "0 0 500 320",
    "Standing rigging holds the mast up. Running rigging moves.",
    "".join([
        # Bow to the right. The mainsail and everything that trims it live
        # ABAFT the mast — drawn forward of it they are in the foretriangle,
        # which is a headsail's job, on the card that teaches the rig.
        p("M96 268C170 278 300 272 386 254C388 266 384 276 372 284 300 300 180 300 118 286Z"),
        p("M212 272V44"),
        p("M212 60C182 128 146 188 126 216L212 214Z", "f-sail"),
        p("M212 220 110 230", "f-boom"),
        # standing rigging — green
        mark("M212 44 384 256", "forestay", "c-grn"),
        mark("M212 44 104 266", "backstay", "c-grn"),
        mark("M212 44 158 270M212 44 266 268", "shrouds", "c-grn f-rig"),
        mark("M196 96h32", "spreaders", "c-grn"),
        # running rigging — indigo
        mark("M220 50 220 214", "halyard", "c-acc"),
        mark("M112 230 146 272", "sheet", "c-acc"),
        mark("M180 224 206 258", "kicker", "c-acc"),
        mark("M212 50 108 232", "topping-lift", "c-acc f-rig"),
        lead("M394 212 371 238", "forestay", "c-grn"),
        txt(400, 208, "forestay", "c-grn", anchor="start", size=13, lid="forestay"),
        lead("M96 242 128 224", "backstay", "c-grn"),
        txt(16, 246, "backstay", "c-grn", anchor="start", size=13, lid="backstay"),
        lead("M300 186 246 174", "shrouds", "c-grn"),
        txt(306, 190, "shrouds", "c-grn", anchor="start", size=13, lid="shrouds"),
        lead("M326 92 230 96", "spreaders", "c-grn"),
        txt(332, 90, "spreaders", "c-grn", anchor="start", size=13, lid="spreaders"),
        lead("M264 134 224 142", "halyard", "c-acc"),
        txt(270, 132, "halyard", "c-acc", anchor="start", size=13, lid="halyard"),
        lead("M112 300 140 274", "sheet", "c-acc"),
        txt(56, 306, "sheet", "c-acc", anchor="start", size=13, lid="sheet"),
        lead("M250 258 194 244", "kicker", "c-acc"),
        txt(256, 262, "kicker", "c-acc", anchor="start", size=13, lid="kicker"),
        lead("M112 112 156 142", "topping-lift", "c-acc"),
        txt(16, 108, "topping lift", "c-acc", anchor="start", size=13, lid="topping-lift"),
        # Each line is set in the colour it describes, so it demonstrates rather
        # than names one. It used to name them — and named indigo, which `c-acc`
        # is not: that class is the app's "this is what the card asks about"
        # colour, so every running-rigging label rendered in the text colour and
        # the only indigo on the drawing was the hull. Naming a colour would
        # break in dark mode anyway.
        # Keep these short: the mast is at x=212 and a longer line runs into it.
        txt(16, 28, "standing — holds the mast up", "c-grn", anchor="start", size=12),
        txt(16, 46, "running — moves the sails", "c-acc", anchor="start", size=12),
    ]),
    ["forestay", "backstay", "shrouds", "spreaders", "halyard", "sheet",
     "kicker", "topping-lift"],
)

# ── roll, pitch and yaw ──
def _motions():
    """Each motion gets the view that shows it, and the axis it turns about.

    Drawn three times from the same angle they are three identical pictures with
    different captions, which is worse than no drawing at all."""
    b = []

    # roll — seen from astern, turning about the fore-and-aft axis
    b.append(p("M56 56C56 98 72 116 100 118C128 116 144 98 144 56"))
    b.append(p("M100 56h44M56 56h44", "f-thin"))
    b.append(p("M100 60V8"))
    b.append(circ(100, 92, 7, "c-acc"))
    b.append(circ(100, 92, 2, "c-acc"))
    b.append(mark("M34 104A70 44 0 0 0 166 104", "roll", "c-acc"))
    b.append(mark("M28 92 34 105 47 100M172 92 166 105 153 100", "roll", "c-acc"))
    b.append(txt(100, 176, "roll", "c-acc", lid="roll"))
    b.append(txt(100, 194, "seen from astern", "c-mut", size=12, lid="roll"))

    # pitch — seen from the side, turning about the athwartships axis
    b.append(p("M240 66C270 76 340 74 372 54C376 68 372 80 362 92C330 104 268 104 246 92Z"))
    b.append(p("M300 70V8"))
    b.append(circ(302, 84, 7, "c-acc"))
    b.append(circ(302, 84, 2, "c-acc"))
    b.append(mark("M232 118C266 100 340 100 374 118", "pitch", "c-acc"))
    b.append(mark("M232 104 231 119 244 122M374 104 375 119 362 122", "pitch", "c-acc"))
    b.append(txt(302, 176, "pitch", "c-acc", lid="pitch"))
    b.append(txt(302, 194, "seen from the side", "c-mut", size=12, lid="pitch"))

    # yaw — seen from above, turning about the vertical axis
    b.append(p("M500 12C512 34 528 56 528 86L526 122 474 122 472 86C472 56 488 34 500 12Z"))
    b.append(circ(500, 74, 7, "c-acc"))
    b.append(circ(500, 74, 2, "c-acc"))
    b.append(mark("M446 146A70 34 0 0 0 554 146", "yaw", "c-acc"))
    b.append(mark("M440 134 446 147 459 143M560 134 554 147 541 143", "yaw", "c-acc"))
    b.append(txt(500, 194, "seen from above", "c-mut", size=12, lid="yaw"))
    b.append(txt(500, 176, "yaw", "c-acc", lid="yaw"))
    return "".join(b)


fig(
    "motions", "0 0 600 208",
    "The three ways a hull turns about herself.",
    _motions(),
    ["roll", "pitch", "yaw"],
)

# ── windward, leeward and a lee shore ──
def _windward():
    b = []
    # the wind, once, across the top
    b.append(p("M20 44h214M226 36 234 44 226 52", "f-wind"))
    b.append(p("M20 68h174M186 60 194 68 186 76", "f-wind"))
    b.append(txt(20, 30, "wind", "c-blu", anchor="start", size=13, lid="wind"))
    # Seen from astern, because heel is the whole point: she leans away from
    # the wind, so the leeward side is the low side and the boom's side.
    b.append('<g transform="rotate(16 260 210)">'
             + p("M210 176C210 214 226 232 260 234C294 232 310 214 310 176")
             + p("M210 176h100")
             + p("M260 176V64")
             + p("M260 158 336 170", "f-boom")
             # seen from astern the mainsail is edge-on, not a triangle: drawn
             # face-on it reads as a boat pointing at you rather than away
             + p("M260 68C296 106 320 148 334 168C314 142 282 106 260 74Z", "f-sail")
             + p("M252 234 248 274 274 274 270 232")
             + '</g>')
    b.append(p("M96 216h330", "f-dash"))
    # the two sides of her
    b.append(mark("M140 206h54M186 198 194 206 186 214", "windward", "c-acc"))
    b.append(txt(10, 202, "windward", "c-acc", anchor="start", size=13, lid="windward"))
    b.append(txt(134, 218, "the wind\u2019s side", "c-mut", anchor="end", size=11, lid="windward"))
    b.append(txt(10, 234, "= the weather side", "c-mut", anchor="start", size=11, lid="windward"))
    b.append(mark("M336 214h54M382 206 390 214 382 222", "leeward", "c-grn"))
    b.append(txt(396, 210, "leeward", "c-grn", anchor="start", size=13, lid="leeward"))
    b.append(txt(396, 226, "the sheltered side,", "c-mut", anchor="start", size=11, lid="leeward"))
    b.append(txt(396, 242, "and the boom\u2019s side", "c-mut", anchor="start", size=11, lid="leeward"))
    # the shore the wind blows onto is the one downwind of her
    b.append(mark("M430 300c14-12 26-4 34-14 8-10 24-6 34-16", "lee-shore", "c-red f-shore"))
    b.append(mark("M424 302h96", "lee-shore", "c-red"))
    b.append(txt(516, 278, "lee shore", "c-red", anchor="end", size=13, lid="lee-shore"))
    b.append(txt(516, 294, "wind sets you onto it", "c-red", anchor="end", size=11, lid="lee-shore"))
    b.append(mark("M14 300c8-12 18-4 24-14 6-10 16-6 22-16", "weather-shore", "f-shore"))
    b.append(mark("M8 302h72", "weather-shore", "f-shore"))
    b.append(txt(10, 278, "weather shore", anchor="start", size=13, lid="weather-shore"))
    b.append(txt(10, 294, "wind blows off it: shelter", "c-mut", anchor="start", size=11,
                 lid="weather-shore"))
    return "".join(b)


fig(
    "windward-lee", "0 0 580 312",
    "Seen from astern. She heels away from the wind.",
    _windward(),
    ["wind", "windward", "leeward", "lee-shore", "weather-shore"],
)


# ── mooring lines ──
def _mooring():
    """Names below the berth, one column each.

    Stacked beside the lines, the sub-lines bind to the wrong head: a reader
    scanning down 'stern line / back spring / stops her surging astern' comes
    away believing a stern line stops her surging astern, which is backwards.
    A column per line, under the cleat it lands on, cannot be misread.
    """
    b = []
    b.append(p("M20 214h520", "f-pontoon"))
    b.append(p("M20 214v22h520v-22", "f-thin"))
    for x in (60, 210, 300, 380, 520):
        b.append(p(f"M{x - 10} 214h20M{x} 214v-8M{x - 7} 206h14"))
    # the boat, from above, bow to the right, lying close alongside
    b.append(p("M120 56C300 32 430 52 480 88C430 124 300 144 120 144Z"))
    b.append(p("M180 70h96v34h-96z"))
    for x in (220, 300, 380):
        b.append(circ(x, 158, 9, "f-fender"))
    b.append(lead("M158 164 208 159", "fenders"))
    b.append(txt(152, 168, "fenders", "c-mut", anchor="end", size=12, lid="fenders"))
    b.append(mark("M472 96 520 206", "bow-line", "c-acc f-warp"))
    b.append(mark("M122 140 60 206", "stern-line", "c-acc f-warp"))
    b.append(mark("M440 110 210 206", "fore-spring", "c-grn f-warp"))
    b.append(mark("M150 144 380 206", "back-spring", "c-grn f-warp"))
    b.append(mark("M300 150 300 206", "breast-line", "c-red f-warp"))
    b.append(txt(312, 178, "breast line", "c-red", anchor="start", size=13, lid="breast-line"))
    b.append(txt(312, 194, "square across, holds her in", "c-mut", anchor="start", size=11,
                 lid="breast-line"))
    # One column per line, under the cleat it lands on, and each column gets a
    # vertical band of its own: shared rows put one line's small print beside
    # another's heading, which is how a reader ends up binding the wrong two.
    b.append(txt(20, 264, "stern line", "c-acc", anchor="start", size=13, lid="stern-line"))
    b.append(txt(20, 282, "aft from the stern", "c-mut", anchor="start", size=11, lid="stern-line"))
    b.append(txt(540, 264, "bow line", "c-acc", anchor="end", size=13, lid="bow-line"))
    b.append(txt(540, 282, "forward from the bow", "c-mut", anchor="end", size=11, lid="bow-line"))
    b.append(txt(210, 264, "fore spring", "c-grn", size=13, lid="fore-spring"))
    b.append(txt(210, 306, "from the bow, led aft:", "c-mut", size=11, lid="fore-spring"))
    b.append(txt(210, 322, "stops her surging ahead", "c-mut", size=11, lid="fore-spring"))
    b.append(txt(380, 264, "back spring", "c-grn", size=13, lid="back-spring"))
    b.append(txt(380, 344, "from the stern, led forward:", "c-mut", size=11, lid="back-spring"))
    b.append(txt(380, 360, "stops her surging astern", "c-mut", size=11, lid="back-spring"))
    return "".join(b)


fig(
    "mooring-lines", "0 0 560 372",
    "Alongside, seen from above. Bow to the right.",
    _mooring(),
    ["bow-line", "stern-line", "fore-spring", "back-spring", "breast-line", "fenders"],
)

# ── the gear along the deck ──
def _deck():
    b = []
    # A near-symmetric hull leaves "bow to the right" to the caption, on a card
    # whose whole content is which end is which. Flat transom aft, raked stem
    # and an anchor roller forward.
    b.append(p("M74 150 74 190C200 210 380 206 486 180C500 164 506 146 498 128"
               "C380 160 200 166 74 150Z"))
    b.append(p("M496 128h18v10h-16"))
    b.append(p("M74 150h26", "f-thin"))
    # pushpit aft, pulpit forward — and the pulpit wraps past the stem
    b.append(mark("M84 150v-42M110 152v-42M84 108h26M84 126h26", "pushpit", "c-acc"))
    b.append(mark("M462 132v-40M492 124v-38M462 92C478 80 498 82 504 92M462 110 502 100",
                  "pulpit", "c-acc"))
    for x, y in ((170, 160), (250, 162), (330, 158), (410, 148)):
        b.append(mark(f"M{x} {y}v-40", "stanchions", "c-grn"))
    b.append(mark("M110 110 170 120 250 122 330 118 410 108 462 92", "guardrails", "c-red"))
    b.append(mark("M110 128 170 138 250 140 330 136 410 126 462 110", "guardrails", "c-red"))
    # the jackstay runs inboard of the sheer, on a deck eye at each end
    b.append(mark("M120 152 452 130", "jackstay", "c-amb f-jack"))
    b.append(circ(120, 152, 5, "c-amb"))
    b.append(circ(452, 130, 5, "c-amb"))
    b.append(mark("M148 156h26M161 156v-14M148 142c0-6 8-8 12-2M174 142c0-6-8-8-12-2", "cleat"))
    b.append(mark("M356 152c0-12 10-18 18-14M390 148c0-12-10-18-18-14M356 152h6M384 148h6",
                  "fairlead"))
    b.append(lead("M78 96 92 106", "pushpit", "c-acc"))
    b.append(txt(20, 92, "pushpit", "c-acc", anchor="start", size=13, lid="pushpit"))
    b.append(lead("M524 90 506 90", "pulpit", "c-acc"))
    b.append(txt(530, 94, "pulpit", "c-acc", anchor="start", size=13, lid="pulpit"))
    b.append(lead("M300 60 300 116", "guardrails", "c-red"))
    b.append(txt(300, 52, "guardrails", "c-red", size=13, lid="guardrails"))
    b.append(lead("M110 68 236 140", "jackstay", "c-amb"))
    b.append(txt(20, 42, "jackstay", "c-amb", anchor="start", size=13, lid="jackstay"))
    b.append(txt(20, 60, "clip your tether to it", "c-mut", anchor="start", size=11,
                 lid="jackstay"))
    b.append(lead("M296 212 256 166", "stanchions", "c-grn"))
    b.append(txt(302, 222, "stanchions", "c-grn", anchor="start", size=13, lid="stanchions"))
    b.append(lead("M118 188 152 160", "cleat"))
    b.append(txt(112, 192, "cleat", anchor="end", size=12, lid="cleat"))
    b.append(lead("M416 184 378 156", "fairlead"))
    b.append(txt(422, 188, "fairlead", anchor="start", size=12, lid="fairlead"))
    b.append(txt(74, 232, "transom", "c-mut", anchor="start", size=11, lid="pushpit"))
    b.append(lead("M516 158 502 138", "pulpit"))
    b.append(txt(510, 172, "stem", "c-mut", anchor="start", size=11, lid="pulpit"))
    return "".join(b)


fig(
    "deck-fittings", "0 0 600 240",
    "Along the side deck. Flat transom aft, stem and anchor roller forward.",
    _deck(),
    ["pulpit", "pushpit", "stanchions", "guardrails", "jackstay", "cleat", "fairlead"],
)

# ── the engine's two water circuits ──
def _cooling():
    """The raw water's whole path, including the bit the card is really about.

    Drawn without an exhaust, this diagram shows raw water going overboard on
    its own — while the card asks you to check that water is coming out *with*
    the exhaust. The mixer elbow is the point of the picture.
    """
    b = []
    b.append(p("M20 300h580", "f-thin"))
    # the seacock, on the skin fitting rather than floating above it
    b.append(mark("M74 300v-30M62 270h24M74 270v-16M64 254 84 268M84 254 64 268",
                  "seacock", "c-blu"))
    b.append(txt(74, 322, "seacock", "c-blu", size=13, lid="seacock"))
    b.append(txt(20, 338, "shut it before you open the pump", "c-mut", anchor="start", size=11, lid="seacock"))
    # raw water: strainer, pump, heat exchanger
    b.append(mark("M74 238h46M104 232 112 238 104 244", "strainer", "c-blu"))
    b.append(mark("M120 214h64v48h-64z", "strainer", "c-blu"))
    b.append(mark("M132 222v32M146 222v32M160 222v32M174 222v32", "strainer", "c-blu f-rig"))
    b.append(txt(152, 284, "strainer", "c-blu", size=13, lid="strainer"))
    b.append(mark("M184 238h44M214 232 222 238 214 244", "impeller", "c-blu"))
    b.append(circ(254, 238, 26, "c-blu"))
    b.append(mark("M254 238C254 224 268 216 276 222M254 238C266 246 264 262 254 264"
                  "M254 238C242 230 244 214 254 212M254 238C242 246 228 240 230 230",
                  "impeller", "c-blu"))
    b.append(txt(254, 296, "impeller pump", "c-blu", size=13, lid="impeller"))
    b.append(mark("M280 238h40v-52h56M362 180 370 186 362 192", "heat-exchanger", "c-blu"))
    b.append(mark("M376 152h124v68H376z", "heat-exchanger"))
    b.append(txt(438, 190, "heat exchanger", size=13, lid="heat-exchanger"))
    b.append(txt(438, 208, "the circuits meet, never mix", "c-mut", size=11, lid="heat-exchanger"))
    # fresh water: the sealed loop round the block
    b.append(mark("M116 60h204v64H116z", "fresh"))
    b.append(txt(218, 98, "engine block", size=13, lid="fresh"))
    b.append(mark("M320 78h118v74M320 106h96v46", "fresh", "c-red"))
    b.append(txt(400, 62, "fresh water and antifreeze, sealed", "c-red", size=12, lid="fresh"))
    # the exhaust: dry off the block, wet after the elbow, out through the transom
    b.append(mark("M320 118h108v40", "exhaust"))
    b.append(mark("M500 186h32v-24h-96", "exhaust", "c-blu"))
    b.append(mark("M532 162 532 138 512 138", "exhaust"))
    b.append(circ(536, 158, 5, "c-red"))
    b.append(lead("M536 130 536 150", "exhaust"))
    b.append(txt(536, 124, "mixer elbow", "c-red", size=12, lid="exhaust"))
    b.append(mark("M532 190v72h44M566 256 578 262 566 268", "exhaust", "c-blu"))
    b.append(mark("M586 254c6 8 6 14 0 20M596 250c8 10 8 18 0 28", "exhaust", "c-blu"))
    b.append(txt(524, 274, "out with the exhaust", "c-blu", anchor="end", size=13, lid="exhaust"))
    b.append(txt(524, 290, "no water here, stop the engine", "c-red", anchor="end", size=11,
                 lid="exhaust"))
    b.append(txt(20, 26, "blue = raw water, straight from the sea", "c-blu", anchor="start",
                 size=12))
    b.append(txt(20, 44, "red = the sealed fresh-water side", "c-red", anchor="start", size=12))
    return "".join(b)


fig(
    "engine-cooling", "0 0 620 350",
    "Raw water in, heat out with the exhaust. The two circuits never mix.",
    _cooling(),
    ["seacock", "strainer", "impeller", "heat-exchanger", "fresh", "exhaust"],
)

# ── the four pyrotechnics ──
def _flares():
    """Four uses, not four canisters.

    Drawn as four identical tubes with different coloured caps, the picture
    carries nothing the answer has not already said. What tells them apart in
    the locker is what each is *for* — how high it goes, how it is held, where
    it floats, who it is aimed at. Each scene gets its own column, and its
    words sit under it: side by side in one band they overprint each other.
    """
    b = []
    sea = 300
    b.append(p(f"M20 {sea}h700", "f-thin"))
    b.append(p(f"M28 {sea + 10}c9-9 18-9 27 0M356 {sea + 10}c9-9 18-9 27 0"
               f"M690 {sea + 10}c9-9 18-9 27 0", "f-thin"))

    # 1. red parachute rocket — the one that goes over the horizon
    b.append(mark("M106 296 106 264 116 264 116 296Z", "parachute", "fill-pap"))
    b.append(mark("M112 258C120 210 132 148 150 104", "parachute", "c-red f-cut"))
    b.append(mark("M128 84a22 22 0 0 1 44 0", "parachute", "c-red"))
    b.append(mark("M128 84 150 104 172 84M150 104v8", "parachute", "c-red"))
    b.append(circ(150, 118, 7, "fill-red"))
    b.append(vdim(48, 76, 300, "parachute", "meas-on"))
    b.append(txt(34, 188, "up to 1,000 ft", "c-red", rot=-90, size=12, lid="parachute"))

    # 2. red hand flare — held out over the rail, downwind
    b.append(mark("M250 296 258 252 276 238", "handheld", "f-arm"))
    b.append(mark("M232 272h48M244 272v24M272 272v24", "handheld"))
    b.append(mark("M276 238 304 222", "handheld"))
    b.append(mark("M304 222 320 213", "handheld", "c-red f-side"))
    b.append(mark("M318 211c10-10 24-12 32-8-11 2-17 8-19 16", "handheld", "c-red"))

    # 3. orange smoke — floats, and the plume lies down the wind
    b.append(mark("M438 292h36v-16h-36z", "smoke", "fill-amb"))
    b.append(mark("M474 278c28-6 44-20 52-38 10-22 22-30 36-30", "smoke", "c-amb f-side"))
    b.append(mark("M562 210c-2-16 4-28 14-36", "smoke", "c-amb f-side"))
    b.append(mark("M496 196h56M544 190 554 196 544 202", "smoke", "f-meas"))
    b.append(txt(492, 200, "wind", "c-mut", anchor="end", size=11, lid="smoke"))

    # 4. white — aimed at the ship that has not seen you
    b.append(mark("M606 296 606 280", "white"))
    b.append(mark("M600 296h14", "white"))
    b.append(mark("M612 274C636 260 656 258 672 264M660 256 674 264 662 272", "white"))
    b.append(mark("M676 292h56l-8 10h-44zM698 280h16v12h-16zM706 268v12", "white", "fill-pap"))
    b.append(mark("M666 296c6-4 8-8 8-14", "white"))

    # each scene's words, under its own scene
    blocks = [(112, "parachute", "red parachute", "c-red",
               ["distress, offshore", "burns 40s", "seen far off"]),
              (298, "handheld", "red hand", "c-red",
               ["distress, close in", "held over the rail", "at arm&#8217;s length"]),
              (476, "smoke", "orange smoke", "c-amb",
               ["distress by day", "floats and smokes", "shows the wind"]),
              (656, "white", "white", "",
               ["NOT distress", "to a ship that has", "not seen you"])]
    for x, lid, name, colour, lines in blocks:
        b.append(txt(x, 330, name, colour, size=13, lid=lid))
        for i, line in enumerate(lines):
            cls = "c-red" if line.startswith("NOT") else "c-mut"
            b.append(txt(x, 350 + i * 16, line, cls, size=11, lid=lid))
    return "".join(b)


fig(
    "flares", "0 0 760 404",
    "Three of these mean distress. The white one does not.",
    _flares(),
    ["parachute", "handheld", "smoke", "white"],
)

# ── latitude, longitude and the mile that comes out of them ──
def _latlong():
    """Rows spaced the way a Mercator chart spaces them.

    Drawn with even rows, the picture quietly asserts that the latitude scale
    is linear up the chart — which is the exact opposite of the rule the card
    exists to teach. The two brackets are the whole lesson: the same one minute
    is longer higher up, so you take it off the side scale beside you.
    """
    b = []
    rows = [(260, "40&#8242;"), (223, "41&#8242;"), (180, "42&#8242;"),
            (131, "43&#8242;"), (76, "44&#8242;")]
    cols = [(110, "20&#8242;"), (182, "19&#8242;"), (254, "18&#8242;"),
            (326, "17&#8242;"), (398, "16&#8242;")]
    b.append(p("M110 76h360v184H110z"))
    for y, lab in rows:
        if 76 < y < 260:
            b.append(p(f"M110 {y}h360", "f-thin"))
        b.append(txt(102, y + 5, lab, "c-acc", anchor="end", size=12))
    for x, lab in cols:
        if x > 110:
            b.append(p(f"M{x} 76v184", "f-thin"))
        b.append(txt(x, 282, lab, "c-grn", size=12))
    b.append(txt(60, 316, "50&#176;N", "c-acc", anchor="start", size=12))
    b.append(txt(478, 300, "001&#176;W", "c-grn", anchor="start", size=12))
    b.append(mark("M110 76v184", "latitude", "c-acc f-side"))
    b.append(mark("M110 260h360", "longitude", "c-grn f-side"))
    b.append(txt(52, 168, "latitude", "c-acc", anchor="middle", size=13, rot=-90, lid="latitude"))
    b.append(txt(290, 306, "longitude", "c-grn", size=13, lid="longitude"))
    # the position, read off both scales
    b.append(mark("M194 155 214 175M194 175 214 155", "position", "c-red"))
    b.append(mark("M104 165h366M204 76v210", "position", "c-red f-cut"))
    b.append(txt(478, 152, "50&#176;42&#8242;.3 N", "c-red", anchor="start", size=13,
                 lid="position"))
    b.append(txt(478, 170, "001&#176;18&#8242;.7 W", "c-red", anchor="start", size=13,
                 lid="position"))
    b.append(txt(478, 190, "latitude first, then longitude", "c-mut", anchor="start", size=11,
                 lid="position"))
    b.append(txt(478, 206, "three digits for the degrees", "c-mut", anchor="start", size=11,
                 lid="position"))
    # the same minute, twice, at two heights
    b.append(vdim(560, 223, 260, "mile", "meas-on"))
    b.append(mark("M470 223h96M470 260h96", "mile", "f-dash"))
    b.append(txt(576, 248, "1&#8242; down here", "c-mut", anchor="start", size=11, lid="mile"))
    b.append(vdim(560, 76, 131, "mile", "meas-on"))
    b.append(mark("M470 76h96M470 131h96", "mile", "f-dash"))
    b.append(txt(576, 100, "1&#8242; up here &#8212; longer", "c-acc", anchor="start", size=12,
                 lid="mile"))
    b.append(txt(576, 118, "same one nautical mile", "c-acc", anchor="start", size=12,
                 lid="mile"))
    b.append(txt(110, 330, "one minute of latitude = one nautical mile, so measure distance",
                 "c-acc", anchor="start", size=12, lid="mile"))
    b.append(txt(110, 348, "on the side scale beside you &#8212; never on the top or bottom",
                 "c-acc", anchor="start", size=12, lid="mile"))
    return "".join(b)


fig(
    "latlong", "0 0 800 368",
    "A chart's two scales. Only one of them measures distance.",
    _latlong(),
    ["latitude", "longitude", "position", "mile"],
)

# ── prop walk ──
def _propwalk():
    b = []
    # the boat, from above, bow up
    b.append(p("M230 40C246 70 276 104 276 148L273 236 187 236 184 148C184 104 214 70 230 40Z"))
    b.append(p("M206 108h48v56h-48z"))
    # rudder and propeller, under the stern
    b.append(p("M222 236h16v34h-16z"))
    b.append(circ(230, 214, 16, "c-acc"))
    b.append(mark("M230 198v32M214 214h32", "prop", "c-acc"))
    b.append(lead("M300 214 248 214", "prop", "c-acc"))
    b.append(txt(306, 218, "right-handed prop", "c-acc", anchor="start", size=13, lid="prop"))
    b.append(txt(306, 236, "clockwise, seen from astern", "c-mut", anchor="start", size=11,
                 lid="prop"))
    # astern: the boat goes backwards and the stern is pushed bodily to port.
    # A curved arrow off the quarter reads as wake; a straight one off the
    # transom reads as the shove it actually is.
    b.append(mark("M178 246H96M110 236 96 246 110 256", "astern", "c-red f-walk"))
    b.append(mark("M230 252v56M220 296 230 310 240 296", "astern", "c-red f-dash-red"))
    b.append(txt(246, 300, "she goes this way", "c-mut", anchor="start", size=11, lid="astern"))
    b.append(txt(30, 286, "the stern", "c-red", anchor="start", size=13, lid="astern"))
    b.append(txt(30, 304, "walks to PORT", "c-red", anchor="start", size=13, lid="astern"))
    b.append(txt(30, 340, "so back her into a berth", "c-mut", anchor="start", size=11,
                 lid="astern"))
    b.append(txt(30, 356, "that is on your port side", "c-mut", anchor="start", size=11,
                 lid="astern"))
    # ahead: barely anything
    b.append(mark("M230 30v-26M222 14 230 4 238 14", "ahead", "c-grn"))
    b.append(txt(258, 22, "going ahead, prop walk is there", "c-grn", anchor="start", size=12,
                 lid="ahead"))
    b.append(txt(258, 40, "but the rudder wash beats it", "c-mut", anchor="start", size=11,
                 lid="ahead"))
    b.append(txt(20, 116, "port", "c-red", anchor="start", size=12, lid="sides"))
    b.append(txt(360, 100, "starboard", "c-grn", anchor="start", size=12, lid="sides"))
    b.append(mark("M184 148 184 104C184 70 214 40 230 40", "sides", "c-red f-side"))
    b.append(mark("M230 40C246 70 276 104 276 148", "sides", "c-grn f-side"))
    return "".join(b)


fig(
    "prop-walk", "0 0 600 376",
    "A right-handed propeller, seen from above.",
    _propwalk(),
    ["prop", "astern", "ahead", "sides"],
)


# ── turning her round in her own length ──
def _standing_turn():
    b = []
    hull = ("M230 40C246 70 276 104 276 148L273 236 187 236 184 148C184 104 214 70 230 40Z")
    # where she started
    b.append(mark('<ghost>', "turn", "f-dash"))
    b.append(p(hull))
    b.append(p("M206 108h48v56h-48z"))
    # helm hard over to starboard and left there
    b.append(mark("M224 238 246 264 258 258 236 234Z", "turn", "c-acc"))
    b.append(lead("M300 302 254 268", "turn", "c-acc"))
    b.append(txt(306, 306, "helm hard over, and left there", "c-acc", anchor="start", size=13,
                 lid="turn"))
    # a burst ahead: wash off the propeller over the rudder throws the stern round
    b.append(circ(230, 214, 14, "c-grn"))
    b.append(mark("M230 200v28M216 214h28", "wash", "c-grn f-rig"))
    # the water leaving the blade, drawn as water so it cannot be mistaken for
    # the hull's own movement
    b.append(mark("M248 244c14 10 26 22 30 36c8-6 16-6 24 2M300 274 314 288 296 292",
                  "wash", "c-grn f-wash"))
    # and the hull's reaction: the stern goes the other way, to port — the same
    # way prop walk takes it astern, which is the whole reason to turn this way
    b.append(mark("M212 246H160M172 238 160 246 172 254", "wash", "c-grn f-walk"))
    b.append(txt(306, 216, "short burst AHEAD", "c-grn", anchor="start", size=13, lid="wash"))
    b.append(txt(306, 234, "wash off the blade goes to starboard,", "c-mut", anchor="start",
                 size=11, lid="wash"))
    b.append(txt(306, 250, "so the stern is pushed to port", "c-mut", anchor="start", size=11,
                 lid="wash"))
    # a burst astern kills the headway, and prop walk pushes the same way
    b.append(mark("M176 250C140 258 116 274 104 292M116 282 102 293 116 300", "back", "c-red"))
    b.append(txt(20, 320, "short burst ASTERN", "c-red", anchor="start", size=13, lid="back"))
    b.append(txt(20, 338, "kills the headway; the rudder does almost", "c-mut", anchor="start",
                 size=11, lid="back"))
    b.append(txt(20, 354, "nothing astern and prop walk takes over,", "c-mut", anchor="start",
                 size=11, lid="back"))
    b.append(txt(20, 370, "so turn the way prop walk helps you", "c-mut", anchor="start",
                 size=11, lid="back"))
    # the bow comes round, and she stays where she is
    b.append(mark("M240 30C286 22 320 34 340 58M330 42 342 60 322 62", "swing", "c-acc"))
    b.append(txt(346, 40, "the bow swings to starboard", "c-acc", anchor="start", size=13,
                 lid="swing"))
    b.append(txt(346, 58, "alternate the bursts and she pivots", "c-mut", anchor="start", size=11,
                 lid="swing"))
    b.append(txt(346, 74, "almost on the spot. Dashed shows", "c-mut", anchor="start",
                 size=11, lid="swing"))
    b.append(txt(346, 90, "where she is heading", "c-mut", anchor="start", size=11,
                 lid="swing"))
    ghost = ('<path class="f-dash" data-l="turn" transform="rotate(34 230 150)" d="%s"/>' % hull)
    return "".join(b).replace(mark('<ghost>', "turn", "f-dash"), ghost)


fig(
    "standing-turn", "0 0 660 388",
    "Turning her in her own length, seen from above.",
    _standing_turn(),
    ["turn", "wash", "back", "swing"],
)


# ═══════════════════════════ write it out ═══════════════════════════════════

_TEXT = re.compile(r"<text[\s\S]*?</text>")
_FONT = re.compile(r'font-size="([\d.]+)"')

# A label's size is written in user units, and a user unit is a different number
# of pixels in every figure: these viewBoxes run from 440 to 800 wide, all drawn
# into the same ~340px card. Taken literally, `size=11` is 8.5px on hull-plan and
# 4.7px on latlong — the same instruction, one readable and one not.
#
# So the authored number is a wish, granted only where it can be afforded. A
# label may not render below MIN_PX on a card of CARD_PX, and it never grows past
# the size of a full-strength name. On the narrow figures that gives the
# hierarchy the sizes were written for; on the wide ones everything sits at the
# name size, which is the largest the figure can carry and what shipped before.
MIN_PX = 9.0
CARD_PX = 340.0
NAME = 15.0


def _fit_labels(labels, unit):
    floor = MIN_PX * unit / CARD_PX

    def fit(m):
        want = float(m.group(1))
        got = min(NAME, max(want, floor))
        return 'font-size="%s"' % f"{got:.1f}".rstrip("0").rstrip(".")
    return _FONT.sub(fit, labels)


def _draw_by_hand():
    """Re-draw every figure's strokes so the line looks made by a hand.

    Only the strokes. The labels come through untouched and are re-appended
    afterwards: a displaced label is a label you cannot read, and they are
    lettered rather than drawn — see `.figure text` in app.css.

    This runs on the finished figure set rather than inside `fig()` so that
    everything above stays honest geometry. What is authored is what the
    drawing means; what ships is that, drawn by hand.
    """
    for name, f in FIGS.items():
        labels = "".join(_TEXT.findall(f["b"]))
        strokes = _TEXT.sub("", f["b"])
        unit = float(f["vb"].split()[2])
        f["b"] = rough.redraw(strokes, rough.FIGURE, unit) + _fit_labels(labels, unit)


def main():
    if ERRS:
        for e in ERRS:
            print("ERROR", e)
        raise SystemExit(f"{len(ERRS)} figure error(s)")
    _draw_by_hand()
    out = os.path.join(WEB, "figures.json")
    with open(out, "w", encoding="utf-8") as f:
        json.dump(FIGS, f, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
    size = os.path.getsize(out)
    print(f"figures  : {len(FIGS)}  {size // 1024}K")


if __name__ == "__main__":
    main()
