#!/usr/bin/env python3
"""Build the RYA Competent Crew deck.

Run:  python3 src/build.py

Outputs, all under build/ and all generated — nothing in here is hand-edited:
  build/cards.json        the app's deck data, same shape as Day Skipper's
  build/decks/*.tsv       Anki-importable, one file per section plus a combined
  build/STUDY-GUIDE.md    the same content as a readable document
  build/REUSE.md          what is a pointer, what is original, per section

A Competent Crew card is either a tuple `(front, back[, fig])` — original
content — or a `ref(ds_section, front)` pointing at a Day Skipper card. The
pointer is resolved here and nowhere else; no Day Skipper wording is ever copied
into this repo, so there is exactly one place each shared fact is authored.

Card ids are `sha1(question)[:10]`, the same scheme Day Skipper uses. That is
deliberate: a pointer card and the card it points at get the *same id*, so when
the two decks eventually share one app they share one review history for the
facts they share. Learning what a bowline is for should not need doing twice.
"""
import hashlib
import json
import os
import re
import shutil
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)

import ds                                  # noqa: E402
from cards_cc import SECTIONS_CC           # noqa: E402

BUILD = os.path.join(ROOT, "build")
DECKS = os.path.join(BUILD, "decks")
TOP = "RYA Competent Crew"
COURSE = "competent-crew"

ALLOWED_TAGS = {"b", "i", "u", "br", "sub", "sup"}

# Topics the Competent Crew syllabus does not contain at any depth. A card that
# mentions one is not automatically wrong — "the skipper will work out the
# tides" is a legitimate crew-level sentence — so this warns rather than fails.
# It exists because the failure mode of this deck is scope creep back towards
# Day Skipper, and scope creep is invisible one card at a time.
OUT_OF_SCOPE = [
    "tidal curve", "secondary port", "rule of twelfths", "chart datum",
    "estimated position", "dead reckoning", "course to steer", "deviation",
    "cardinal mark", "isolated danger", "safe water mark", "lateral mark",
    "occulting", "isophase", "sectored light", "running fix", "transferred",
    # Not "shipping forecast": naming where a forecast comes from is half of
    # the Competent Crew meteorology bullet. It is *interpreting* the bulletin
    # that is out of scope, and the words below catch that.
    "mayday", "pan-pan", "dsc", "isobar", "occluded", "veering", "backing",
    "synoptic", "waypoint", "chartplotter", "impeller", "bleeding the fuel",
    "give-way vessel", "stand-on vessel", "day shape",
]


def card_id(question):
    return hashlib.sha1(question.encode("utf-8")).hexdigest()[:10]


def check_html(field, where, errs):
    """Keep the tag set tiny and known — the app renders these as HTML.

    Checking the tag *name* is not enough: `<b onmouseover=…>` has an allowed
    name and an event handler. Nothing but the name and an optional slash may
    appear between the angle brackets.
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
    if "\t" in field:
        errs.append(f"{where}: TAB")
    if "\n" in field:
        errs.append(f"{where}: NEWLINE")
    if not field.strip():
        errs.append(f"{where}: empty")


def parse_figure(spec, where, errs):
    """`fig:<name>` or `fig:<name>@<label>,<label>`, validated against Day
    Skipper's figure set — this deck draws nothing of its own yet."""
    name, _, on = spec[4:].partition("@")
    f = ds.FIGS.get(name)
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


# Words that carry no subject matter. Left in, a pair of long answers about
# unrelated things scores a respectable overlap on "the", "and", "you".
STOP = set("""a an and are as at be been but by can do does for from get go goes
has have how if in into is it its not of off on once one only or our out over so
that the their them then there they this to too under up use used uses very was
what when where which while who why will with without you your""".split())


def _words(s):
    w = re.sub(r"<[^>]+>|&[#\w]+;", " ", s).lower()
    return {t for t in re.findall(r"[a-z]+", w) if t not in STOP}


def _containment(a, b):
    """How much of the *smaller* answer is inside the larger one.

    Jaccard divides by the union, which is exactly wrong for this job: a long
    Competent Crew answer that swallows a short Day Skipper answer whole gets a
    low score because the union is dominated by the words it added. The five-word
    Day Skipper answer "one nautical mile per hour", copied verbatim into a
    longer card, scores 47% on Jaccard and 100% here. Containment is the question
    actually being asked — is somebody else's card inside this one?
    """
    if len(a) < 4 or len(b) < 4:
        return 0.0
    return len(a & b) / min(len(a), len(b))


def duplication_pass(cards, warns):
    """Find a fact taught twice — against Day Skipper, and inside this deck.

    Comparing originals to Day Skipper is the obvious half. The half that
    actually caught things is comparing every card to every other card *in this
    deck, pointers included*: fourteen sections were written by five people at
    once, and the seams between them are where the same fact gets taught twice.
    A pointer is not exempt — two pointers can carry the same fact, and a pointer
    and an original certainly can.
    """
    wc = [(c, _words(c["a"])) for c in cards]

    for c, mine in wc:
        if c.get("r"):                      # pointers are Day Skipper's own words
            continue
        for (k, front), (_f, theirs, _i) in ds.BY_KEY.items():
            # 0.65, not 0.7: the closest surviving card sits at 69.8%, and a
            # threshold a known card clears by 0.3 points will not catch it
            # drifting further.
            score = _containment(mine, _words(theirs))
            if score > 0.65:
                warns.append(
                    f"{c['s']}/{c['q'][:40]!r}: {score:.0%} of the shorter answer "
                    f"is shared with Day Skipper {k}/{front[:40]!r} — point at it "
                    f"with ref(), or make the crew-level card genuinely different"
                )
                break

    for i, (c, a) in enumerate(wc):
        for d, b in wc[i + 1:]:
            score = _containment(a, b)
            if score > 0.7:
                warns.append(
                    f"{c['s']}/{c['q'][:36]!r} and {d['s']}/{d['q'][:36]!r}: "
                    f"{score:.0%} shared — the same fact is taught twice"
                )


def scope_check(front, back, where, warns):
    blob = (front + " " + back).lower()
    hits = [t for t in OUT_OF_SCOPE if t in blob]
    if hits:
        warns.append(f"{where}: out-of-scope wording: {', '.join(hits)}")


def main():
    errs, warns = [], []
    sections, cards, seen = [], [], {}
    stats = []

    ds_fronts = {f for (_k, f) in ds.BY_KEY}

    for idx, (key, title, section_cards) in enumerate(SECTIONS_CC, 1):
        n_ref = n_new = 0
        for n, card in enumerate(section_cards, 1):
            where = f"{key}#{n}"

            if isinstance(card, ds.Ref):
                resolved = card.resolve(where, errs)
                if not resolved:
                    continue
                front, back, img = resolved
                if card.media is False:
                    img = None                  # out of scope; see ds.Ref
                elif isinstance(card.media, str):
                    img = card.media            # the Competent Crew cut
                origin = card.section
                n_ref += 1
            else:
                front, back = card[0], card[1]
                img = card[2] if len(card) > 2 and card[2] else None
                origin = None
                n_new += 1
                # An original card must not restate a Day Skipper card.
                if front in ds_fronts:
                    errs.append(
                        f"{where}: this question already exists in Day Skipper "
                        f"— use ref() so there is one copy of the answer"
                    )
                scope_check(front, back, where, warns)

            check_html(front, where + " q", errs)
            check_html(back, where + " a", errs)

            cid = card_id(front)
            if cid in seen:
                errs.append(f"{where}: duplicate question, same as {seen[cid]}")
            seen[cid] = where

            figure = None
            if img and img.startswith("fig:"):
                figure = parse_figure(img, where, errs)
                img = None
            elif img and not os.path.isfile(os.path.join(ds.DS_MEDIA, img)):
                errs.append(f"{where}: missing image {img}")

            entry = {"i": cid, "s": key, "q": front, "a": back}
            if img:
                entry["m"] = img
            if figure:
                entry["f"] = figure
            if origin:
                entry["r"] = origin      # provenance: which DS section it came from
            cards.append(entry)

        sections.append({"k": key, "t": title, "n": len(section_cards), "o": idx})
        stats.append((key, title, n_ref, n_new))

    if errs:
        print(f"{len(errs)} PROBLEMS:")
        for e in errs[:60]:
            print("  " + e)
        sys.exit(1)

    duplication_pass(cards, warns)

    write_json(sections, cards)
    used = copy_media(cards)
    write_decks(stats, cards)
    write_guide(stats, cards)
    write_reuse(stats)

    total_ref = sum(s[2] for s in stats)
    total_new = sum(s[3] for s in stats)
    print(f"day skipper : {ds.DS_ROOT} @ {ds.commit()}")
    print(f"sections    : {len(sections)}")
    print(f"cards       : {len(cards)}  ({total_ref} pointers, {total_new} original)")
    print(f"media       : {len(used)} copied from Day Skipper")
    if warns:
        print(f"\n{len(warns)} WARNINGS:")
        for w in warns[:40]:
            print("  " + w)
    else:
        print("\nvalidation clean")


def write_json(sections, cards):
    os.makedirs(BUILD, exist_ok=True)
    body = {"name": TOP, "course": COURSE, "sections": sections, "cards": cards}
    body["ds"] = ds.commit()
    body["build"] = hashlib.sha1(
        json.dumps(body, ensure_ascii=False, sort_keys=True).encode("utf-8")
    ).hexdigest()[:8]
    with open(os.path.join(BUILD, "cards.json"), "w", encoding="utf-8") as f:
        json.dump(body, f, ensure_ascii=False, separators=(",", ":"))


def copy_media(cards):
    """Copy in the Day Skipper diagrams this deck actually references.

    The cards name images by bare filename, which is what Anki wants and what
    the app wants — but it means the built deck is only complete if the files
    are next to it. Without this the study guide's image links and the TSV
    `<img>` tags all point at nothing, which is invisible until somebody opens
    the guide, because a missing image in markdown renders as a shrug.

    Only what is used: this deck references 4 of Day Skipper's 24 diagrams, and
    copying the other 20 would ship a megabyte of chartwork the course excludes.
    """
    dest = os.path.join(BUILD, "media")
    if os.path.isdir(dest):
        shutil.rmtree(dest)
    used = sorted({c["m"] for c in cards if c.get("m")})
    if not used:
        return used
    os.makedirs(dest, exist_ok=True)
    for name in used:
        shutil.copy2(os.path.join(ds.DS_MEDIA, name), os.path.join(dest, name))
    return used


def write_decks(stats, cards):
    os.makedirs(DECKS, exist_ok=True)
    for f in os.listdir(DECKS):
        if f.endswith(".tsv"):
            os.remove(os.path.join(DECKS, f))

    by_section = {}
    for c in cards:
        by_section.setdefault(c["s"], []).append(c)

    all_rows = []
    for idx, (key, title, _r, _n) in enumerate(stats, 1):
        deck = f"{TOP}::{title}"
        rows = []
        for c in by_section.get(key, []):
            body = c["a"]
            if c.get("m"):
                body = f'{body}<br><br><img src="{c["m"]}">'
            tags = f"RYA CompetentCrew {key}"
            rows.append(f"{c['q']}\t{body}\t{tags}")
            all_rows.append(f"{c['q']}\t{body}\t{tags}\t{deck}")
        with open(os.path.join(DECKS, f"{idx:02d}-{key}.tsv"), "w", encoding="utf-8") as f:
            f.write("#separator:tab\n#html:true\n#notetype:Basic\n")
            f.write(f"#deck:{deck}\n#tags column:3\n")
            f.write("\n".join(rows) + "\n")

    with open(os.path.join(DECKS, "rya-competent-crew-all.tsv"), "w", encoding="utf-8") as f:
        f.write("#separator:tab\n#html:true\n#notetype:Basic\n")
        f.write("#tags column:3\n#deck column:4\n")
        f.write("\n".join(all_rows) + "\n")


def write_guide(stats, cards):
    by_section = {}
    for c in cards:
        by_section.setdefault(c["s"], []).append(c)

    out = [
        "# RYA Competent Crew — study guide\n",
        f"{len(cards)} question-and-answer items across {len(stats)} sections, "
        "following the RYA Competent Crew practical syllabus (G158).\n",
        "This is revision material, not a substitute for the course. Competent "
        "Crew is assessed continuously by your instructor on the water; there is "
        "no written exam.\n",
    ]
    for key, title, _r, _n in stats:
        out.append(f"\n## {title}\n")
        for c in by_section.get(key, []):
            out.append(f"**{c['q']}**\n")
            plain = c["a"].replace("<b>", "**").replace("</b>", "**")
            plain = plain.replace("<u>", "_").replace("</u>", "_")
            plain = re.sub(r"<br\s*/?>", "  \n", plain)
            out.append(f"{plain}\n")
            if c.get("m"):
                out.append(f"![{key} diagram](media/{c['m']})\n")
    with open(os.path.join(BUILD, "STUDY-GUIDE.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(out) + "\n")


def write_reuse(stats):
    total_r = sum(s[2] for s in stats)
    total_n = sum(s[3] for s in stats)
    out = [
        "# What this deck reuses\n",
        f"Resolved against Day Skipper at `{ds.commit()}`.\n",
        f"**{total_r + total_n} cards: {total_r} pointers into the Day Skipper "
        f"deck, {total_n} written for Competent Crew.**\n",
        "A pointer means the answer is authored once, in Day Skipper, and this "
        "deck shows it unchanged. An original card exists where Competent Crew "
        "needs something Day Skipper does not cover, or covers at a depth a crew "
        "member is not expected to reach.\n",
        "| # | Section | Pointers | Original | Total |",
        "|---|---------|---------:|---------:|------:|",
    ]
    for idx, (key, title, r, n) in enumerate(stats, 1):
        out.append(f"| {idx:02d} | {title} | {r} | {n} | {r + n} |")
    out.append(f"| | **Total** | **{total_r}** | **{total_n}** | **{total_r + total_n}** |")
    with open(os.path.join(BUILD, "REUSE.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(out) + "\n")


if __name__ == "__main__":
    main()
