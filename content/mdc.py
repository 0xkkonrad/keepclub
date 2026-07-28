# -*- coding: utf-8 -*-
"""The markdown course source — parser and compiler.

This is the format the schema rulings of 28 July 2026 produced (see
schema-research.md at the repo root, spec in course-source.md): a course's
cards are markdown files under `content/<id>/cards/`, and every build —
cards.json, the Anki TSVs, the study guide — reads them through this module.
One parser, so the formats cannot drift.

The layout:

  cards/deck.md          frontmatter `name:`; optional groups, one `##` each
  cards/NN-<key>.md      one file per section; `# <title>` then `##` cards

A section file:

  # 03 Ropework

  ## Bowline — what is it for?

  A fixed loop that neither slips nor jams &mdash; ...

  ![diagram](ds-knots-ropes.png)

  ## Bowline — use {ref=ropework}

A card is a `##` heading (the question) and everything under it (the answer).
Trailing `{...}` on the heading holds attributes: `{#a1b2c3d4e5}` pins the
card's id (it survives rewording — without a pin the id is sha1(question), and
rewording is a new card); `{ref=<section>}` makes the card a pointer into
another deck — the heading must match that deck's question exactly, the answer
is resolved at build time and never copied into the source; `nofig` on a
pointer drops the diagram it would inherit. A lone image paragraph declares
the card's media: a bare filename from the course's media/ set, or
`fig:<name>@<label>,<label>` for a labelled drawing.

Inline markup compiles to the same HTML the decks have always shipped —
`**bold**` → <b>, `*italic*` → <i>, `[text](https://…)` → a safe link — and
the six legacy tags plus entities pass through verbatim, which is what makes
the 2026 migration byte-faithful: a card whose source is its old HTML compiles
to exactly that HTML, so its id and its review history survive. Block markup:
paragraphs join with <br><br>, and `-`/`1.` runs become lists. The allowed
output vocabulary is WHITELIST below — widened from the original six tags to
lists and links by the 28 July ruling.
"""
import hashlib
import os
import re

# Tags a compiled field may contain. b/i/u/br/sub/sup are the original set;
# ul/ol/li and a arrived with the lists-and-links ruling. Only <a> may carry
# attributes, and only the exact ones compile_inline() emits.
WHITELIST = {"b", "i", "u", "br", "sub", "sup", "ul", "ol", "li", "a"}
A_TAG = re.compile(
    r'a href="(?:https?://|mailto:)[^"<>\s]+" target="_blank" rel="noopener"'
)

FRONTMATTER = re.compile(r"\A---\n(.*?)\n---\n", re.S)
HEADING_ATTRS = re.compile(r"\s*\{([^{}]*)\}\s*$")
MEDIA_LINE = re.compile(r"\A!\[[^\]]*\]\(([^()\s]+)\)\Z")
SECTION_FILE = re.compile(r"\A(\d\d)-([a-z][a-z0-9-]*)\.md\Z")

_LINK = re.compile(r"\[([^\]\n]+)\]\((https?://[^)\s]+|mailto:[^)\s]+)\)")
_BOLD = re.compile(r"\*\*(.+?)\*\*")
_ITAL = re.compile(r"(?<!\*)\*([^*\n]+)\*(?!\*)")
# The escapable set: emphasis and link characters anywhere, plus `.` and `-`
# so a line that genuinely starts "1. " or "- " can opt out of list detection
# the same way CommonMark's does (`1\. `).
_ESC = re.compile(r"\\([*\[\]_.\-])")
_OLI = re.compile(r"\d+\.\s+")
_GROUP_KEY = re.compile(r"\A#[a-z][a-z0-9-]*\Z")


class SourceError(SystemExit):
    def __init__(self, errs):
        self.errors = errs
        lines = "\n".join("  " + e for e in errs[:60])
        super().__init__(f"{len(errs)} PROBLEMS in the card source:\n{lines}")


class Card:
    """One `##` block. `q`/`a` are compiled HTML; a pointer has no `a` of its
    own until the build resolves it."""
    __slots__ = ("q", "a", "img", "fig", "pin", "ref", "ref_media", "where")

    def __init__(self):
        self.q = self.a = None
        self.img = self.fig = self.pin = self.ref = None
        self.ref_media = True          # False = nofig; str = replacement file
        self.where = ""

    @property
    def id(self):
        return self.pin or sha1_id(self.q)


class Section:
    __slots__ = ("key", "title", "order", "cards")

    def __init__(self, key, title, order):
        self.key, self.title, self.order = key, title, order
        self.cards = []


class Deck:
    __slots__ = ("name", "sections", "groups", "cards_dir")

    def __init__(self, name, sections, groups, cards_dir):
        self.name, self.sections, self.groups = name, sections, groups
        self.cards_dir = cards_dir

    def index(self):
        """(section_key, question_html) -> Card, for resolving pointers."""
        return {(s.key, c.q): c for s in self.sections for c in s.cards}

    def stamp(self):
        """A hash of the card wording, for pointer provenance — the same idea
        ds.commit() had: HEAD moves when anything in the repo does, the md
        files move only when the words do."""
        h = hashlib.sha1()
        for name in sorted(os.listdir(self.cards_dir)):
            if name.endswith(".md"):
                with open(os.path.join(self.cards_dir, name), "rb") as f:
                    h.update(f.read())
        return h.hexdigest()[:10]


def sha1_id(question_html):
    return hashlib.sha1(question_html.encode("utf-8")).hexdigest()[:10]


def compile_inline(text, where, errs):
    """Markdown sugar → the shipped HTML vocabulary. Passthrough for the
    vocabulary itself: a field that is already `<b>…</b> &mdash; …` compiles
    to itself, byte for byte. `\\*`, `\\[` and `\\_` escape their characters."""
    hidden = {}

    def hide(m):
        key = f"\x00{len(hidden)}\x00"
        hidden[key] = m.group(1)
        return key

    text = _ESC.sub(hide, text)
    text = _LINK.sub(
        lambda m: f'<a href="{m.group(2)}" target="_blank" rel="noopener">{m.group(1)}</a>',
        text,
    )
    text = _BOLD.sub(r"<b>\1</b>", text)
    text = _ITAL.sub(r"<i>\1</i>", text)
    for key, ch in hidden.items():
        text = text.replace(key, ch)
    return text


def compile_body(paragraphs, where, errs):
    """Answer paragraphs → one HTML string, the shape the app has always had:
    blocks joined with <br><br>, list runs as <ul>/<ol>."""
    blocks = []
    for para in paragraphs:
        lines = [ln.strip() for ln in para]
        if all(ln.startswith("- ") for ln in lines):
            items = "".join(
                f"<li>{compile_inline(ln[2:], where, errs)}</li>" for ln in lines
            )
            blocks.append(f"<ul>{items}</ul>")
        elif all(_OLI.match(ln) for ln in lines):
            items = "".join(
                f"<li>{compile_inline(_OLI.sub('', ln, count=1), where, errs)}</li>"
                for ln in lines
            )
            blocks.append(f"<ol>{items}</ol>")
        else:
            blocks.append(compile_inline(" ".join(lines), where, errs))
    return "<br><br>".join(blocks)


def check_html(field, where, errs):
    """The app injects these fields as HTML and trusts the build, so the tag
    set stays small and known. Only <a> may carry attributes, and only the
    exact safe ones this module emits — `<b onmouseover=…>` has an allowed
    name and an event handler."""
    for m in re.finditer(r"<([^>]*)>", field):
        inner = m.group(1).strip()
        if A_TAG.fullmatch(inner):
            continue
        if not re.fullmatch(r"/?\s*([a-zA-Z][a-zA-Z0-9]*)\s*/?", inner):
            errs.append(f"{where}: tag with attributes or junk: <{inner[:40]}>")
            continue
        tag = re.search(r"[a-zA-Z][a-zA-Z0-9]*", inner).group(0).lower()
        if tag not in WHITELIST:
            errs.append(f"{where}: unexpected tag <{tag}>")
    if field.count("<") != field.count(">"):
        errs.append(f"{where}: unbalanced angle brackets")
    for m in re.finditer(r"&(?!#?\w+;)", field):
        errs.append(f"{where}: bare '&' at char {m.start()}")
    if "\t" in field:
        errs.append(f"{where}: TAB")
    if not field.strip():
        errs.append(f"{where}: empty")


def _parse_attrs(heading, where, errs):
    """`## question {#pin ref=section nofig}` → (question, attrs dict)."""
    attrs = {"pin": None, "ref": None, "nofig": False}
    m = HEADING_ATTRS.search(heading)
    if not m:
        return heading.strip(), attrs
    for token in m.group(1).split():
        if re.fullmatch(r"#[0-9a-f]{10}", token):
            attrs["pin"] = token[1:]
        elif token.startswith("ref="):
            attrs["ref"] = token[4:]
        elif token == "nofig":
            attrs["nofig"] = True
        else:
            errs.append(f"{where}: unknown card attribute {token!r}")
    return heading[: m.start()].strip(), attrs


def _parse_section_file(path, order, key, errs):
    with open(path, encoding="utf-8") as f:
        lines = f.read().split("\n")
    fname = os.path.basename(path)

    title = None
    section = None
    card = None
    paragraphs, para = [], []

    def close_para():
        if para:
            paragraphs.append(list(para))
            para.clear()

    def close_card():
        nonlocal card
        if card is None:
            return
        close_para()
        media = None
        body = []
        for p in paragraphs:
            if len(p) == 1 and (m := MEDIA_LINE.match(p[0])):
                if media:
                    errs.append(f"{card.where}: two media declarations")
                media = m.group(1)
            else:
                body.append(p)
        if media and media.startswith("fig:"):
            card.fig = media
        elif media:
            card.img = media
        if card.ref:
            if body:
                errs.append(
                    f"{card.where}: a pointer card has no answer of its own — "
                    f"the body must be empty (its media line may override)"
                )
            if card.img:
                card.ref_media = card.img
                card.img = None
        else:
            card.a = compile_body(body, card.where, errs)
            check_html(card.a, card.where + " a", errs)
        paragraphs.clear()
        section.cards.append(card)
        card = None

    for n, raw in enumerate(lines, 1):
        line = raw.rstrip()
        if line.startswith("# ") and title is None:
            title = line[2:].strip()
            m = re.match(r"(\d+)\s", title)
            if not m or int(m.group(1)) != order:
                errs.append(
                    f"{fname}: title {title!r} does not carry the file's "
                    f"number {order:02d} — the two must agree"
                )
            section = Section(key, title, order)
        elif line.startswith("## "):
            if section is None:
                errs.append(f"{fname}:{n}: a card before the `# section` title")
                section = Section(key, key, order)
            close_card()
            card = Card()
            card.where = f"{key}#{len(section.cards) + 1}"
            q_src, attrs = _parse_attrs(line[3:], card.where, errs)
            card.q = compile_inline(q_src, card.where, errs)
            check_html(card.q, card.where + " q", errs)
            card.pin, card.ref = attrs["pin"], attrs["ref"]
            if attrs["nofig"]:
                card.ref_media = False
        elif not line:
            close_para()
        elif card is not None:
            para.append(line)
        elif line.startswith("<!--") or section is None:
            pass
        elif line.strip():
            errs.append(f"{fname}:{n}: prose outside any card")
    close_card()

    if section is None:
        errs.append(f"{fname}: no `# section` title")
        return Section(key, key, order)
    if not section.cards:
        errs.append(f"{fname}: no cards")
    return section


def _parse_deck_md(path, errs):
    name, groups = None, []
    if not os.path.isfile(path):
        errs.append("cards/deck.md is missing")
        return "", groups
    with open(path, encoding="utf-8") as f:
        text = f.read()
    m = FRONTMATTER.match(text)
    if m:
        for line in m.group(1).split("\n"):
            k, _, v = line.partition(":")
            if k.strip() == "name":
                name = v.strip()
        text = text[m.end():]
    if not name:
        errs.append("deck.md: no `name:` in the frontmatter")
    current = None
    for n, line in enumerate(text.split("\n"), 1):
        line = line.rstrip()
        if line.startswith("## "):
            m2 = HEADING_ATTRS.search(line)
            if not m2 or not _GROUP_KEY.match(m2.group(1).strip()):
                errs.append(f"deck.md:{n}: a group needs a {{#key}}")
                continue
            current = {
                "k": m2.group(1).strip()[1:],
                "t": line[3 : m2.start()].strip(),
                "s": [],
            }
            groups.append(current)
        elif line.startswith("- ") and current is not None:
            current["s"].append(line[2:].strip())
    return name or "", groups


def parse_course(cards_dir):
    """Read `cards/` and return a Deck, or exit loudly listing every problem.

    Structural validation happens here — ids collide, pointers dangle, a group
    names a section that does not exist. What a *particular* build considers a
    problem on top of this (missing image files, out-of-scope wording) stays
    with that build.
    """
    errs = []
    name, groups = _parse_deck_md(os.path.join(cards_dir, "deck.md"), errs)

    sections = []
    for fname in sorted(os.listdir(cards_dir)):
        if fname == "deck.md" or not fname.endswith(".md"):
            continue
        m = SECTION_FILE.match(fname)
        if not m:
            errs.append(f"{fname}: section files are NN-<key>.md")
            continue
        order, key = int(m.group(1)), m.group(2)
        sections.append(
            _parse_section_file(os.path.join(cards_dir, fname), order, key, errs)
        )
    sections.sort(key=lambda s: s.order)
    for a, b in zip(sections, sections[1:]):
        if a.order == b.order:
            errs.append(f"two sections share the number {a.order:02d}")

    seen = {}
    for s in sections:
        for c in s.cards:
            if c.id in seen:
                errs.append(
                    f"{c.where}: duplicate question, same as {seen[c.id]}"
                    + (" (pinned twice?)" if c.pin else "")
                )
            seen[c.id] = c.where

    keys = {s.key for s in sections}
    grouped = set()
    for g in groups:
        for k in g["s"]:
            if k not in keys:
                errs.append(f"group {g['k']}: no such section {k!r}")
            elif k in grouped:
                errs.append(f"section {k!r} is in two groups")
            grouped.add(k)
    if groups:
        for s in sections:
            if s.key not in grouped:
                errs.append(
                    f"section {s.key!r} is in no group — it would vanish from Browse"
                )

    if errs:
        raise SourceError(errs)
    return Deck(name, sections, groups, cards_dir)


def resolve_refs(deck, other, other_name, errs):
    """Fill in every pointer card in `deck` from `other`'s cards.

    The pointer is (section key, exact question) — an index would silently
    re-point when a card is inserted; the text fails loudly instead. On a
    miss, difflib suggests the card that was probably meant: the likeliest
    break is a one-character difference in a short question, which word-level
    overlap scores at zero.
    """
    index = other.index()
    by_front = {}
    for sec, q in index:
        by_front.setdefault(q, []).append(sec)

    for s in deck.sections:
        for c in s.cards:
            if not c.ref:
                continue
            hit = index.get((c.ref, c.q))
            if hit is None:
                elsewhere = by_front.get(c.q)
                if elsewhere:
                    errs.append(
                        f"{c.where}: ref={c.ref} — that question is in "
                        f"section {elsewhere[0]!r}, not {c.ref!r}"
                    )
                else:
                    errs.append(
                        f"{c.where}: ref={c.ref} {c.q[:60]!r} matches no "
                        f"{other_name} card{_hint(index, by_front, c.ref, c.q)}"
                    )
                continue
            c.a = hit.a
            if c.ref_media is False:
                pass                           # inherited diagram dropped
            elif isinstance(c.ref_media, str):
                c.img = c.ref_media            # this course's own cut
            else:
                c.img = hit.img
                if hit.fig and not c.fig:
                    c.fig = hit.fig


def _hint(index, by_front, section, front):
    import difflib

    pool = [q for (k, q) in index if k == section]
    near = difflib.get_close_matches(front, pool, n=1, cutoff=0.6)
    if near:
        return f" — did you mean {near[0][:70]!r}?"
    near = difflib.get_close_matches(front, list(by_front), n=1, cutoff=0.75)
    if near:
        return (
            f" — the closest card anywhere is {near[0][:60]!r} "
            f"in section {by_front[near[0]][0]!r}"
        )
    return ""


def parse_figure(spec, figs, where, errs):
    """`fig:<name>` or `fig:<name>@<label>,<label>` → the card's `f` entry,
    validated against the course's figure set."""
    name, _, on = spec[4:].partition("@")
    f = figs.get(name)
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


def build_groups(deck, section_entries):
    """deck.md's groups as cards.json wants them, with each group's card total
    counted here — a heading that says "95 cards" over four sections is only
    trustworthy if one thing counted both."""
    by_key = {s["k"]: s for s in section_entries}
    order = {s["k"]: s["o"] for s in section_entries}
    out = []
    for g in deck.groups:
        inside = sorted(g["s"], key=lambda k: order.get(k, 0))
        out.append(
            {
                "k": g["k"],
                "t": g["t"],
                "s": inside,
                "n": sum(by_key[k]["n"] for k in inside if k in by_key),
            }
        )
    return out
