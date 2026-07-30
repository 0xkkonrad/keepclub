#!/usr/bin/env python3
"""Compile the Markdown-authored Git 101 course for Keep Club."""

import hashlib
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
CONTENT = os.path.dirname(ROOT)
CARDS_DIR = os.path.join(ROOT, "cards")
BUILD = os.path.join(ROOT, "build")

sys.path.insert(0, HERE)
sys.path.insert(0, CONTENT)

import figures  # noqa: E402
import mdc  # noqa: E402


def write_json(name, value):
    os.makedirs(BUILD, exist_ok=True)
    path = os.path.join(BUILD, name)
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(value, handle, ensure_ascii=False, separators=(",", ":"))
        handle.write("\n")


def main():
    deck = mdc.parse_course(CARDS_DIR)
    errors = []
    sections = []
    cards = []

    for section in deck.sections:
        for card in section.cards:
            entry = {
                "i": card.id,
                "s": section.key,
                "q": card.q,
                "a": card.a or "",
            }
            if card.fig:
                parsed = mdc.parse_figure(
                    card.fig, figures.FIGURES, card.where, errors
                )
                if parsed:
                    entry["f"] = parsed
            cards.append(entry)
        sections.append(
            {
                "k": section.key,
                "t": section.title,
                "n": len(section.cards),
                "o": section.order,
            }
        )

    if errors:
        raise SystemExit("\n".join(errors))

    body = {
        "name": deck.name,
        "course": "git-101",
        "sections": sections,
        "groups": mdc.build_groups(deck, sections),
        "cards": cards,
    }
    body["build"] = hashlib.sha1(
        json.dumps(body, ensure_ascii=False, sort_keys=True).encode("utf-8")
    ).hexdigest()[:8]

    write_json("cards.json", body)
    write_json("figures.json", figures.FIGURES)
    print(f"sections : {len(sections)}")
    print(f"cards    : {len(cards)}")
    print(f"build    : {body['build']}")


if __name__ == "__main__":
    main()
