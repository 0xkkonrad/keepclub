"""The 24 sections gathered into the seven things the course is actually about.

Browse used to open on 537 questions in one column, with the section named once
at the top of each run. Twenty-four sections in a dropdown is not much better:
you have to already know which one holds "what does a south cardinal look like"
before the list can help you.

So the sections are grouped, and the grouping lives here rather than in the app
because it is a claim about the syllabus, not about layout — and because
`check()` can then refuse to build a deck that has a section in no group, in two
groups, or in a group that does not exist. That check is the whole point of
keeping it in Python: the failure it prevents is a section quietly disappearing
from Browse the day someone adds one.

Order inside a group is deck order, which is teaching order. The drawing each
group is marked with is in app.js next to SECTION_ART, with the rest of the art.
"""

# (key, title, [section keys])
#
# Keys are the group's own namespace — `pilotage` is a section, and the group it
# belongs to is `landfall`. The app writes group scopes into the section filter
# as "g:<key>", so the two can never be confused for one another.
GROUPS = [
    ("hull", "The boat and how she handles",
     ["terms", "ropework", "anchoring", "engine", "handling"]),
    ("rules", "Rules of the road",
     ["colregs", "lights", "sound", "fog"]),
    ("fix", "Working out where you are",
     ["position", "charts", "compass", "chartwork", "electronics"]),
    ("weather", "Tides and weather",
     ["tides", "streams", "meteo"]),
    ("landfall", "Finding the way in",
     ["buoyage", "lightchar", "pilotage"]),
    ("trouble", "When it goes wrong",
     ["safety", "emergencies"]),
    ("plan", "Planning and responsibility",
     ["passage", "environment"]),
]


def check(section_keys, errs):
    """Every section in exactly one group, and every group made of real sections.

    `section_keys` is the deck's own order, which is also the order the app
    shows a group's tiles in.
    """
    known = set(section_keys)
    seen = {}
    for key, title, members in GROUPS:
        if not members:
            errs.append(f"group {key}: no sections in it")
        for s in members:
            if s not in known:
                errs.append(f"group {key}: no such section {s!r}")
            elif s in seen:
                errs.append(f"section {s!r} is in both {seen[s]!r} and {key!r}")
            else:
                seen[s] = key
    for s in section_keys:
        if s not in seen:
            errs.append(f"section {s!r} is in no group — it would vanish from Browse")


def build(sections):
    """The groups as the app wants them, with each group's card total.

    The total is worked out here rather than in the browser because the app
    offers a whole group as a browsing scope, and a heading that says "95 cards"
    over a list of four sections is only trustworthy if one thing counted both.
    """
    by_key = {s["k"]: s for s in sections}
    order = {s["k"]: s["o"] for s in sections}
    out = []
    for key, title, members in GROUPS:
        inside = sorted(members, key=lambda s: order.get(s, 0))
        out.append({
            "k": key,
            "t": title,
            "s": inside,
            "n": sum(by_key[s]["n"] for s in inside if s in by_key),
        })
    return out
