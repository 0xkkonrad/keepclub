#!/usr/bin/env python3
"""Build the German sailing vocabulary deck and copy its reused diagrams."""

import hashlib
import json
from pathlib import Path
import shutil
import sys

ROOT = Path(__file__).resolve().parents[1]
CONTENT = ROOT.parent
REPO = CONTENT.parent
BUILD = ROOT / "build"
ART_SOURCE = REPO / "web/courses/competent-crew"

sys.path.insert(0, str(CONTENT))
import mdc


def write_json(name, value):
    (BUILD / name).write_text(
        json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n",
        encoding="utf-8",
    )


def main():
    deck = mdc.parse_course(str(ROOT / "cards"))
    available = json.loads((ART_SOURCE / "figures.json").read_text())
    figures, cards, sections, errors = {}, [], [], []
    terms = 0

    for section in deck.sections:
        for card in section.cards:
            entry = {"i": card.id, "s": section.key, "q": card.q, "a": card.a}
            terms += len(card.q.split(" / "))
            if card.img or card.ref:
                errors.append(f"{card.where}: use original text and labelled figures")
            if card.fig:
                figure = mdc.parse_figure(card.fig, available, card.where, errors)
                if figure:
                    entry["f"] = figure
                    figures[figure["n"]] = available[figure["n"]]
            cards.append(entry)
        sections.append({"k": section.key, "t": section.title,
                         "n": len(section.cards), "o": section.order})

    if errors:
        raise SystemExit("\n".join(errors))

    body = {"name": deck.name, "course": "sailing-in-german",
            "sections": sections, "groups": mdc.build_groups(deck, sections),
            "cards": cards}
    body["build"] = hashlib.sha1(
        json.dumps(body, ensure_ascii=False, sort_keys=True).encode()
    ).hexdigest()[:8]

    # This caption must describe this drawing without referring to other cards.
    figures["sail-parts"]["cap"] = "Triangular mainsail, with the bow to the right."
    BUILD.mkdir(exist_ok=True)
    write_json("cards.json", body)
    write_json("figures.json", figures)
    shutil.copyfile(ART_SOURCE / "figures.css", BUILD / "figures.css")
    print(f"{len(cards)} cards · {terms} terms · {len(sections)} sections")
    print(f"{len(figures)} reused diagrams · build {body['build']}")


if __name__ == "__main__":
    main()
