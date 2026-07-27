#!/usr/bin/env python3
"""Assemble the Munin theme & shell picker from the html-picker template shape,
the roughened raven candidates, two Day Skipper doodles, and inlined DM Mono."""
import base64
import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
DS_WEB = "/workspaces/sandbox/projects/rya-day-skipper/web"

ravens = json.load(open(os.path.join(HERE, "ravens.json")))

doodles_js = open(os.path.join(DS_WEB, "doodles.js")).read()
def ds_doodle(name):
    return re.search(r"\b%s: '([^']*)'" % name, doodles_js).group(1)
BOAT = ds_doodle("boat")
LIFERING = ds_doodle("lifering")

def font_uri(fname):
    raw = open(os.path.join(DS_WEB, "fonts", fname), "rb").read()
    return "data:font/woff2;base64," + base64.b64encode(raw).decode()

def svg(path, size=32):
    return ('<svg viewBox="0 0 32 32" width="%d" height="%d" fill="none" '
            'stroke="currentColor" stroke-width="2" stroke-linecap="round" '
            'stroke-linejoin="round" aria-hidden="true"><path d="%s"/></svg>'
            % (size, size, path))

RAVEN = ravens["perch"]

# ── mockup fragments (all depict the app's light/paper theme on purpose) ─────

def mk_home(caption, accent, course, big, sub, chips):
    return f'''<figure class="mk" style="--ma:{accent}">
  <div class="mk-screen">
    <div class="mk-head">{svg(RAVEN, 18)}<span>{course}</span></div>
    <div class="mk-big">{big}</div>
    <div class="mk-sub">{sub}</div>
    <div class="mk-btn">start</div>
    <div class="mk-chips">{"".join(f"<span>{c}</span>" for c in chips)}</div>
  </div>
  <figcaption>{caption}</figcaption>
</figure>'''

def mk_shelf(caption, accent="#0f766b"):
    return f'''<figure class="mk" style="--ma:{accent}">
  <div class="mk-screen">
    <div class="mk-head">{svg(RAVEN, 18)}<span>munin</span></div>
    <div class="mk-tile" style="--ta:#3a30d8">{svg(BOAT, 24)}<span><b>day skipper</b><i>12 due</i></span></div>
    <div class="mk-tile" style="--ta:#c2551a">{svg(LIFERING, 24)}<span><b>competent crew</b><i>new</i></span></div>
    <div class="mk-tile mk-add"><span>+ your own deck</span></div>
  </div>
  <figcaption>{caption}</figcaption>
</figure>'''

def mk_accent(caption, light, note):
    return f'''<figure class="mk mk-small" style="--ma:{light}">
  <div class="mk-screen">
    <div class="mk-head">{svg(RAVEN, 18)}<span>munin</span></div>
    <div class="mk-swatchrow"><span class="mk-dot"></span><code>{light}</code></div>
    <div class="mk-btn">start</div>
    <div class="mk-chips"><span class="on">due</span><span>all</span></div>
  </div>
  <figcaption>{caption}<i>{note}</i></figcaption>
</figure>'''

def mk_cc(caption, light):
    return f'''<figure class="mk mk-small" style="--ma:{light}">
  <div class="mk-screen">
    <div class="mk-tile mk-cc" style="--ta:{light}">{svg(LIFERING, 26)}<span><b>competent crew</b><i>{light}</i></span></div>
    <div class="mk-btn">start</div>
  </div>
  <figcaption>{caption}</figcaption>
</figure>'''

def mk_icons(caption, icons):
    cells = "".join(
        f'<span class="mk-icon" style="--ta:{a}">{svg(p, 26)}<i>{label}</i></span>'
        for p, label, a in icons)
    return f'''<figure class="mk"><div class="mk-screen mk-homescreen">{cells}</div>
  <figcaption>{caption}</figcaption></figure>'''

MOCKS_S1 = '<div class="mocks">' + mk_home(
    "A — cold open = the course you left off in", "#3a30d8", "day skipper ⌄",
    "12", "cards due today", ["all", "colregs", "lights"]) + mk_shelf(
    "B — the shelf greets you every time") + mk_home(
    "C — one global session across courses", "#0f766b", "munin",
    "17", "due across 2 courses", ["day skipper 12", "competent crew 5"]) + "</div>"

MOCKS_I2 = '<div class="mocks">' + \
    mk_accent("A — deep sheen", "#14524a", "dark: #3fa894") + \
    mk_accent("B — ink teal", "#0e3f39", "dark: #35917f") + \
    mk_accent("C — black-green", "#0a2c28", "dark: #2c7f6f") + "</div>"

MOCKS_C1 = '<div class="mocks">' + \
    mk_cc("A — lifejacket orange", "#c2551a") + \
    mk_cc("B — sea green", "#1f7a4d") + \
    mk_cc("C — harbor slate", "#33608d") + "</div>"

MOCKS_S2 = '<div class="mocks">' + mk_icons(
    "A — one app on the home screen",
    [(RAVEN, "munin", "#0f766b")]) + mk_icons(
    "B — each course installable on its own",
    [(ds_doodle("boat"), "day skipper", "#3a30d8"),
     (LIFERING, "comp. crew", "#c2551a"),
     (RAVEN, "munin", "#0f766b")]) + "</div>"

# ── logo options ─────────────────────────────────────────────────────────────

LOGO_META = [
    ("perch",  True,  "The plain raven. The default bird every other pose is a variation of; survives 16&nbsp;px favicon duty."),
    ("puff",   False, "Front-facing fluffball. Strongest tiny-icon read; maximum cute, minimum corvid."),
    ("peek",   False, "Peeking over a flashcard. The most literal about what the app is; needs room for the card to read."),
    ("carry",  False, "Bringing you a card. Nice story (Munin fetches what's due); busiest silhouette."),
    ("roost",  False, "Asleep with one z — it remembers while you rest. Best empty-state, sleepy as a brand mark."),
    ("strut",  False, "Mid-strut with crow's-feet prints — the progress mark built into the logo."),
    ("hoard",  False, "Eyeing a shiny thing. Ties to the badge system (the hoard); gem can read as generic."),
    ("flap",   False, "Mid-flap. Energetic; wings flirt with reading as ears."),
    ("bow",    False, "String tied round the leg — the reminder knot. Deepest memory metaphor, subtlest raven."),
    ("quill",  False, "A single feather. The abstract grown-up option; loses the character entirely."),
]
LOGO_OPTS = ",\n          ".join(
    '{ k: "%s"%s, t: "%s", d: "%s", svg: %s }' % (
        chr(65 + i), ", rec: true" if rec else "", name, desc.replace('"', '&quot;'),
        json.dumps(ravens[name]))
    for i, (name, rec, desc) in enumerate(LOGO_META))

# ── page ─────────────────────────────────────────────────────────────────────

html = open(os.path.join(HERE, "picker-body.html")).read()
html = (html
        .replace("@@FONT400@@", font_uri("dm-mono-400.woff2"))
        .replace("@@FONT500@@", font_uri("dm-mono-500.woff2"))
        .replace("@@LOGO_OPTS@@", LOGO_OPTS)
        .replace("@@MOCKS_S1@@", json.dumps(MOCKS_S1))
        .replace("@@MOCKS_I2@@", json.dumps(MOCKS_I2))
        .replace("@@MOCKS_C1@@", json.dumps(MOCKS_C1))
        .replace("@@MOCKS_S2@@", json.dumps(MOCKS_S2))
        .replace("@@RAVEN_HEADER@@", svg(RAVEN, 26)))
out = os.path.join(HERE, "munin-picker.html")
open(out, "w").write(html)
print("picker:", len(html) // 1024, "K ->", out)
