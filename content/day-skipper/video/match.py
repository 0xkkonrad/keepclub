#!/usr/bin/env python3
"""Match transcribed clips to cards.

Two stages, because neither alone is good enough: a cheap lexical stage puts
the plausible cards in front of the model, then the model decides which of them
the clip *plainly answers*. Loose topical overlap is not a match — a clip about
night navigation touches thirty cards and belongs to none of them.

    python3 video/match.py            # propose matches
    python3 video/match.py --report   # print the proposal for review

Writes video/matches.json. Nothing is wired into the app from here; that is a
separate, reviewed step.
"""
import json
import math
import os
import re
import sys
import urllib.request
from collections import Counter
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CARDS = os.path.join(ROOT, "web", "cards.json")
TRANSCRIPTS = os.path.join(ROOT, "video", "transcripts.json")
OUT = os.path.join(ROOT, "video", "matches.json")
SECRETS = os.path.expanduser("~/.peanut/secrets.env")
MODEL = "gemini-3.6-flash"
FALLBACK = "gemini-2.5-flash"
TOP_N = 14

STOP = set("""a an the and or of to in on at for with without is are was were be been being
this that these those it its as by from into over under than then so if not no yes you your
what which when where how why does do did can could should would may might will shall must
one two three four five six seven eight nine ten each other more most less least same""".split())


def words(s):
    s = re.sub(r"<[^>]+>", " ", s.lower())
    return [w for w in re.findall(r"[a-z][a-z'-]{2,}", s) if w not in STOP]


def api_key():
    with open(SECRETS) as fh:
        keys = re.findall(r"^GEMINI_API_KEY=(.+)$", fh.read(), re.M)
    return keys[-1].strip().strip("\"'")


KEY = api_key()

JUDGE = """You are attaching short teaching videos to flashcards in an RYA Day
Skipper revision deck. A video may only be attached to a card when watching it
would plainly help someone answer THAT card — same object, same rule, same
procedure. Being in the same chapter is not enough.

THE VIDEO
Summary: {summary}
Topics: {topics}
Terms taught: {terms}
Transcript: {transcript}

CANDIDATE CARDS
{cards}

Return JSON only:
{{"matches": [{{"card": "<card id>", "confidence": "high"|"medium", "why": "under 15 words"}}]}}

Rules:
- Return only cards the video plainly answers. An empty list is the right answer
  for a video that teaches something the deck does not ask about.
- "high" means the video is about exactly this question. "medium" means it
  covers it as part of something wider.
- Never return more than 4 cards. Prefer precision: a wrong attachment costs a
  learner more than a missing one.
"""


def call(model, prompt):
    body = {"contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0, "responseMimeType": "application/json"}}
    req = urllib.request.Request(
        f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={KEY}",
        data=json.dumps(body).encode(), headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=240) as r:
        d = json.loads(r.read())
    return json.loads("".join(p.get("text", "") for p in d["candidates"][0]["content"]["parts"]))


def main():
    deck = json.load(open(CARDS))
    clips = json.load(open(TRANSCRIPTS))
    sections = {s["k"]: s["t"] for s in deck["sections"]}

    # ── lexical stage: idf-weighted overlap, enough to shortlist ──
    docs = {c["i"]: words(c["q"] + " " + c["a"]) for c in deck["cards"]}
    df = Counter()
    for ws in docs.values():
        df.update(set(ws))
    n = len(docs)
    idf = {w: math.log(n / (1 + c)) for w, c in df.items()}
    tf = {i: Counter(ws) for i, ws in docs.items()}
    byid = {c["i"]: c for c in deck["cards"]}

    def shortlist(clip):
        q = Counter(words(" ".join(clip["topics"] + clip["terms"]) * 3 + " "
                          + clip["summary"] + " " + clip["transcript"]))
        scores = {}
        for cid, counts in tf.items():
            s = sum(idf.get(w, 0) * math.log(1 + counts[w]) * math.log(1 + q[w])
                    for w in q if w in counts)
            if s:
                scores[cid] = s
        return [c for c, _ in sorted(scores.items(), key=lambda kv: -kv[1])[:TOP_N]]

    teaching = {k: v for k, v in clips.items() if v.get("teaches") and "error" not in v}
    print(f"{len(teaching)} teaching clips of {len(clips)}")

    def judge(item):
        cid, clip = item
        cand = shortlist(clip)
        if not cand:
            return cid, {"matches": []}
        listed = "\n".join(
            f"- id {i} [{sections.get(byid[i]['s'], byid[i]['s'])}] Q: {byid[i]['q']}\n"
            f"  A: {re.sub('<[^>]+>', '', byid[i]['a'])[:220]}" for i in cand)
        prompt = JUDGE.format(summary=clip["summary"], topics=", ".join(clip["topics"]),
                              terms=", ".join(clip["terms"]),
                              transcript=clip["transcript"][:2500], cards=listed)
        for model in (MODEL, FALLBACK):
            try:
                got = call(model, prompt)
                break
            except Exception as e:                      # noqa: BLE001 - report and move on
                err = f"{type(e).__name__}: {e}"
        else:
            return cid, {"error": err}
        ms = [m for m in got.get("matches", []) if m.get("card") in byid][:4]
        return cid, {"matches": ms, "candidates": len(cand)}

    out = {}
    with ThreadPoolExecutor(max_workers=6) as pool:
        for i, (cid, rec) in enumerate(pool.map(judge, teaching.items()), 1):
            out[cid] = rec
            print(f"{i:>3}/{len(teaching)} {cid[:22]} → {len(rec.get('matches', []))}")
    json.dump(out, open(OUT, "w"), indent=1, ensure_ascii=False)

    hits = sum(len(r.get("matches", [])) for r in out.values())
    placed = sum(1 for r in out.values() if r.get("matches"))
    print(f"wrote {OUT}: {placed} clips placed on {hits} card slots")


if __name__ == "__main__":
    main()
