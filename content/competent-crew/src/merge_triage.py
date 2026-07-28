#!/usr/bin/env python3
"""Fold the three triage passes into one manifest, grouped by Competent Crew section.

Run:  python3 src/merge_triage.py

Reads  research/reuse-{a,b,c}.json
Writes research/manifest.json  and  research/MANIFEST.md

The point is to check the triage before anybody writes a card against it. Three
agents read three files with the same instructions; this is where their answers
get held to the same standard — every `front` must resolve to a real Day Skipper
card, every `cc_section` must be one of the fourteen, and the same card must not
have been claimed twice.
"""
import json
import os
import sys
from collections import Counter, defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
RESEARCH = os.path.join(ROOT, "research")
sys.path.insert(0, HERE)

import ds                                  # noqa: E402

SECTIONS = [
    ("cc-seaterms", "01 Sea terms, parts of the boat, rigging and sails"),
    ("cc-sailhandling", "02 Sail handling"),
    ("cc-ropework", "03 Ropework"),
    ("cc-fire", "04 Fire precautions and firefighting"),
    ("cc-safetygear", "05 Personal safety equipment"),
    ("cc-mob", "06 Man overboard"),
    ("cc-emergency", "07 Emergency equipment"),
    ("cc-manners", "08 Manners and customs"),
    ("cc-lookout", "09 Rules of the road"),
    ("cc-tender", "10 Tender usage"),
    ("cc-weather", "11 Meteorology"),
    ("cc-seasickness", "12 Seasickness"),
    ("cc-helming", "13 Helmsmanship and sailing"),
    ("cc-duties", "14 General duties"),
]
KEYS = [k for k, _ in SECTIONS]


def main():
    rows, errs = [], []
    for part in "abc":
        path = os.path.join(RESEARCH, f"reuse-{part}.json")
        if not os.path.isfile(path):
            errs.append(f"missing {path}")
            continue
        data = json.load(open(path, encoding="utf-8"))
        for i, r in enumerate(data):
            r["_src"] = f"{part}[{i}]"
            rows.append(r)
    if errs:
        for e in errs:
            print("  " + e)
        sys.exit(1)

    claimed = defaultdict(list)
    for r in rows:
        where = r["_src"]
        v, sec, front = r.get("verdict"), r.get("ds_section"), r.get("front")

        if v not in ("reuse", "simplify", "cut"):
            errs.append(f"{where}: bad verdict {v!r}")
            continue

        # Every front must resolve, whatever the verdict — a front that does not
        # match means the agent paraphrased the question, and a paraphrase that
        # slipped into a `reuse` row would be a build failure later, when it is
        # much more expensive to work out which of three passes produced it.
        if (sec, front) not in ds.BY_KEY:
            elsewhere = ds.BY_FRONT.get(front)
            errs.append(
                f"{where}: {front[:60]!r} is not in ds section {sec!r}"
                + (f" (it is in {elsewhere[0]!r})" if elsewhere else " — no such card")
            )
            continue

        if v == "cut":
            if r.get("cc_section"):
                errs.append(f"{where}: cut card also assigned {r['cc_section']!r}")
            continue

        cc = r.get("cc_section")
        if cc not in KEYS:
            errs.append(f"{where}: cc_section {cc!r} is not one of the fourteen")
            continue
        claimed[(sec, front)].append(where)

    for k, v in claimed.items():
        if len(v) > 1:
            errs.append(f"{k[0]}/{k[1][:40]!r}: claimed by {', '.join(v)}")

    # Coverage: the triage must have seen every card, or something was skipped.
    seen = {(r["ds_section"], r["front"]) for r in rows}
    missed = sorted(set(ds.BY_KEY) - seen)
    for sec, front in missed[:20]:
        errs.append(f"never triaged: {sec}/{front[:60]!r}")
    if len(missed) > 20:
        errs.append(f"…and {len(missed) - 20} more never triaged")

    if errs:
        print(f"{len(errs)} PROBLEMS in the triage:")
        for e in errs[:50]:
            print("  " + e)
        sys.exit(1)

    out = {}
    for key, title in SECTIONS:
        out[key] = {"title": title, "reuse": [], "simplify": []}
    for r in rows:
        if r["verdict"] in ("reuse", "simplify"):
            out[r["cc_section"]][r["verdict"]].append({
                "ds_section": r["ds_section"],
                "front": r["front"],
                "note": r.get("note", ""),
            })

    with open(os.path.join(RESEARCH, "manifest.json"), "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)

    md = ["# Triage manifest\n",
          "What each Competent Crew section inherits from Day Skipper. "
          "**reuse** becomes a `ref()` pointer verbatim; **simplify** means the "
          "topic is in scope but the Day Skipper card is pitched too deep, so "
          "Competent Crew gets its own card and the Day Skipper one is left "
          "alone.\n"]
    for key, title in SECTIONS:
        s = out[key]
        md.append(f"\n## {title}  `{key}`\n")
        md.append(f"{len(s['reuse'])} to reuse, {len(s['simplify'])} to simplify.\n")
        for r in s["reuse"]:
            md.append(f"- **reuse** `ref({r['ds_section']!r}, …)` — {r['front']}  \n  {r['note']}")
        for r in s["simplify"]:
            md.append(f"- *simplify* from `{r['ds_section']}` — {r['front']}  \n  {r['note']}")
    with open(os.path.join(RESEARCH, "MANIFEST.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(md) + "\n")

    c = Counter(r["verdict"] for r in rows)
    print(f"triaged  : {len(rows)} of {len(ds.BY_KEY)} Day Skipper cards")
    print(f"verdicts : {c['reuse']} reuse, {c['simplify']} simplify, {c['cut']} cut")
    print()
    for key, title in SECTIONS:
        s = out[key]
        print(f"  {key:18s} {len(s['reuse']):3d} reuse  {len(s['simplify']):3d} simplify")
    print("\ntriage clean")


if __name__ == "__main__":
    main()
