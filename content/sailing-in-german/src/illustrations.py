"""Apply reviewed German lettering to the existing sailing SVG artwork."""

import html
import json
import re
import xml.etree.ElementTree as ET


TEXT = re.compile(r"<text\b([^>]*)>(.*?)</text>", re.DOTALL)
LAYOUT_ATTRIBUTES = {"x", "y", "text-anchor", "transform", "font-size"}


def translate_figures(figures, source):
    translations = json.loads(source.read_text(encoding="utf-8"))["figures"]
    if set(figures) != set(translations):
        raise ValueError("Every used diagram must have exactly one German translation")

    output = {}
    for name, original in figures.items():
        translation = translations[name]
        if (original["cap"], original["note"]) != (translation["sourceCap"], translation["sourceNote"]):
            raise ValueError(f"{name}: SVG caption changed; review the German translation")
        texts = translation["texts"]
        nodes = TEXT.findall(original["b"])
        if [html.unescape(text) for _, text in nodes] != [t["en"] for t in texts]:
            raise ValueError(f"{name}: SVG lettering changed; review the German translation")
        if not translation["cap"].strip():
            raise ValueError(f"{name}: missing German caption")
        if original["note"] and not translation["note"].strip():
            raise ValueError(f"{name}: missing German note")

        label_names = {}
        entries = iter(texts)

        def replace(match):
            entry = next(entries)
            if not entry["de"].strip() or not entry["sources"] or not entry["rationale"]:
                raise ValueError(f"{name}: every text needs German wording and sailing sources")
            attributes = match.group(1)
            node = ET.fromstring(f"<text{attributes}/>")
            label = node.get("data-l")
            if label and label not in label_names:
                label_names[label] = entry["de"]
            # Longer German terms sometimes need room beyond the English label's anchor.
            for key, value in entry.get("layout", {}).items():
                if key not in LAYOUT_ATTRIBUTES:
                    raise ValueError(f"{name}: unsupported layout attribute {key}")
                attributes = re.sub(rf'\s{key}="[^"]*"', "", attributes)
                attributes += f' {key}="{html.escape(str(value), quote=True)}"'
            return f"<text{attributes}>{html.escape(entry['de'])}</text>"

        figure = dict(original)
        figure["b"] = TEXT.sub(replace, original["b"])
        if "viewBox" in translation:
            figure["vb"] = translation["viewBox"]
        ET.fromstring(f"<svg>{figure['b']}</svg>")
        figure.update(cap=translation["cap"], note=translation["note"],
                      lang="de", labelNames=label_names, labelled="Beschriftet")
        output[name] = figure
    return output
