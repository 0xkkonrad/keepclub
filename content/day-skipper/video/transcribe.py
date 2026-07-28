#!/usr/bin/env python3
"""Transcribe the Maritime Master clips so they can be matched to cards.

Audio only — the clips are narrated, and their TikTok description already
carries whatever is written on screen. Gemini gets the audio plus the
description as context and returns a transcript and a short topic sketch.

    python3 video/transcribe.py            # transcribe anything not done yet
    python3 video/transcribe.py --force    # redo everything

Writes video/transcripts.json, keyed by clip id. Re-runnable: finished clips
are skipped, so a failed run costs only the clips it did not reach.
"""
import base64
import json
import os
import re
import sys
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CLIPS = "/workspaces/sandbox/_temp/tiktok-maritimemaster"
AUDIO = os.path.join(ROOT, "video", "audio")
OUT = os.path.join(ROOT, "video", "transcripts.json")
SECRETS = os.path.expanduser("~/.peanut/secrets.env")
MODEL = "gemini-3.6-flash"
FALLBACK = "gemini-2.5-flash"

PROMPT = """This is the audio of a short vertical video from the TikTok account
@maritimemaster, which teaches RYA/RYA-adjacent navigation and seamanship.

Its posted description is:
---
{desc}
---

Return JSON only, no markdown fence:
{{
  "transcript": "the spoken words, verbatim, punctuated. Empty string if there is no speech (music only).",
  "speech": true or false,
  "summary": "one sentence saying what a learner would take away",
  "topics": ["2-6 short syllabus topics, e.g. 'cardinal marks', 'anchor lights', 'IRPCS rule 12'"],
  "terms": ["up to 10 specific terms actually taught: mark names, light patterns, knot names, rule numbers"],
  "teaches": true or false
}}

"teaches" is false for promotional clips about the Maritime Master app, crew
recruitment, seasonal greetings or general seafaring lifestyle — anything a
revision deck would not attach to a question.
"""


def api_key():
    with open(SECRETS) as fh:
        keys = re.findall(r"^GEMINI_API_KEY=(.+)$", fh.read(), re.M)
    if not keys:
        sys.exit("no GEMINI_API_KEY in " + SECRETS)
    return keys[-1].strip().strip("\"'")          # the last one is the live key


KEY = api_key()


def call(model, audio_b64, desc):
    body = {
        "contents": [{"parts": [
            {"text": PROMPT.format(desc=desc[:1200])},
            {"inline_data": {"mime_type": "audio/ogg", "data": audio_b64}},
        ]}],
        "generationConfig": {"temperature": 0, "responseMimeType": "application/json"},
    }
    req = urllib.request.Request(
        f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={KEY}",
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=300) as r:
        d = json.loads(r.read())
    text = "".join(p.get("text", "") for p in d["candidates"][0]["content"]["parts"])
    return json.loads(text)


def one(cid):
    with open(os.path.join(AUDIO, cid + ".ogg"), "rb") as fh:
        audio = base64.b64encode(fh.read()).decode()
    with open(os.path.join(CLIPS, cid + ".info.json")) as fh:
        info = json.load(fh)
    desc = info.get("description") or info.get("title") or ""
    for model in (MODEL, FALLBACK):
        try:
            got = call(model, audio, desc)
            break
        except (urllib.error.HTTPError, urllib.error.URLError, KeyError, json.JSONDecodeError) as e:
            err = f"{type(e).__name__}: {e}"
    else:
        return cid, {"error": err}
    return cid, {
        "id": info.get("id"),
        "url": info.get("webpage_url"),
        "date": info.get("upload_date"),
        "duration": info.get("duration"),
        "size": [info.get("width"), info.get("height")],
        "description": desc,
        "transcript": (got.get("transcript") or "").strip(),
        "speech": bool(got.get("speech")),
        "summary": (got.get("summary") or "").strip(),
        "topics": got.get("topics") or [],
        "terms": got.get("terms") or [],
        "teaches": bool(got.get("teaches")),
        "model": model,
    }


def main():
    force = "--force" in sys.argv
    done = {}
    if os.path.exists(OUT) and not force:
        with open(OUT) as fh:
            done = json.load(fh)
    ids = sorted(f[:-4] for f in os.listdir(AUDIO) if f.endswith(".ogg"))
    todo = [c for c in ids if c not in done or "error" in done[c]]
    print(f"{len(ids)} clips, {len(todo)} to do")
    with ThreadPoolExecutor(max_workers=6) as pool:
        for i, (cid, rec) in enumerate(pool.map(one, todo), 1):
            done[cid] = rec
            flag = "ERR " + rec["error"][:60] if "error" in rec else \
                ("teaches" if rec["teaches"] else "off-topic")
            print(f"{i:>3}/{len(todo)} {cid[:24]} {flag}")
            with open(OUT, "w") as fh:
                json.dump(done, fh, indent=1, ensure_ascii=False)
    bad = [c for c, r in done.items() if "error" in r]
    print(f"wrote {OUT}: {len(done)} clips, {len(bad)} failed")


if __name__ == "__main__":
    main()
