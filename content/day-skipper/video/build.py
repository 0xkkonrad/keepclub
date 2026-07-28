#!/usr/bin/env python3
"""Turn the reviewed matches into what the app actually ships.

  - re-encodes every matched clip to 480px-wide H.264 (about a tenth of the
    original, which is what makes hosting 50-odd clips on a static site sane)
  - writes web/videos.json: card id -> clips, plus each clip's source URL

    python3 video/build.py            # encode what is missing, rewrite the map
    python3 video/build.py --force    # re-encode everything

The service worker deliberately does not precache any of this: the shell is
2.6 MB and must stay that way. A clip is fetched when someone opens it.
"""
import csv
import json
import os
import shutil
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HERE = os.path.join(ROOT, "video")
# The 54 encoded clips are committed, not generated: their originals are 156 MB
# of downloaded TikTok that has never lived in a repo, and losing the encodes
# would lose the material outright. Encoding runs only when a clip is missing
# and SRC actually holds the original — which is why SRC is an override rather
# than a path anybody is expected to have.
CLIPS = os.path.join(HERE, "clips")
SRC = os.environ.get("TIKTOK_SRC", "/workspaces/sandbox/_temp/tiktok-maritimemaster")
# In the repo, because every clip must carry a link back to the original and
# the uploader's name. Without it the deck ships other people's video unattributed.
SOURCES = os.path.join(HERE, "sources.csv")
DEST = os.path.join(ROOT, "build", "video")
OUT = os.path.join(ROOT, "build", "videos.json")
MATCHES = os.path.join(ROOT, "video", "matches.json")
TRANSCRIPTS = os.path.join(ROOT, "video", "transcripts.json")

# 432px wide is the smallest that keeps these clips' on-screen labels readable
# on a phone, and crf 32 halves the byte count against the source without the
# text going mushy. 56 minutes of video has to fit in a repo that was 2.6 MB.
FFMPEG = ["-vf", "scale=432:-2", "-c:v", "libx264", "-crf", "32", "-preset", "slow",
          "-profile:v", "main", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
          "-c:a", "aac", "-b:a", "40k", "-ac", "1"]


def main():
    force = "--force" in sys.argv
    matches = json.load(open(MATCHES))
    clips = json.load(open(TRANSCRIPTS))
    os.makedirs(DEST, exist_ok=True)
    os.makedirs(CLIPS, exist_ok=True)

    src_rows = {}
    if os.path.exists(SOURCES):
        for row in csv.DictReader(open(SOURCES)):
            src_rows[row["filename"].replace(".mp4", "")] = row

    used = sorted(c for c, r in matches.items() if r.get("matches"))
    print(f"{len(used)} clips are attached to at least one card")

    meta, by_card = {}, {}
    for cid in used:
        clip = clips[cid]
        row = src_rows.get(cid, {})
        kept = os.path.join(CLIPS, cid + ".mp4")
        out = os.path.join(DEST, cid + ".mp4")
        if force or not os.path.exists(kept):
            original = os.path.join(SRC, cid + ".mp4")
            if not os.path.exists(original):
                raise SystemExit(
                    f"{cid}.mp4 is neither in video/clips/ nor in {SRC}.\n"
                    "Point TIKTOK_SRC at the downloaded originals to re-encode it.")
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", original]
                           + FFMPEG + [kept], check=True)
            print(f"  encoded {cid} {os.path.getsize(kept) // 1024} KB")
        shutil.copy2(kept, out)
        meta[cid] = {
            "f": cid + ".mp4",
            "d": int(clip.get("duration") or row.get("duration_s") or 0),
            # What the clip teaches, in the app's own voice — the TikTok caption
            # is written for a feed and reads badly under a flashcard.
            "t": clip["summary"],
            "u": clip.get("url") or row.get("url", ""),
            "by": row.get("uploader") or "maritimemaster",
        }
        for m in matches[cid]["matches"]:
            by_card.setdefault(m["card"], []).append({"c": cid, "k": m["confidence"]})

    # High confidence first, and never more than two clips on one card.
    for card, lst in by_card.items():
        lst.sort(key=lambda x: (x["k"] != "high", x["c"]))
        by_card[card] = [x["c"] for x in lst[:2]]

    payload = {
        "clips": meta,
        "cards": by_card,
        "credit": {"name": "Maritime Master", "url": "https://www.tiktok.com/@maritimemaster"},
    }
    json.dump(payload, open(OUT, "w"), ensure_ascii=False, separators=(",", ":"))
    total = sum(os.path.getsize(os.path.join(DEST, m["f"])) for m in meta.values())
    print(f"wrote {OUT}: {len(meta)} clips on {len(by_card)} cards, {total / 1e6:.1f} MB of video")


if __name__ == "__main__":
    main()
