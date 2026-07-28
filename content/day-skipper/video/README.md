# Video

54 clips from [@maritimemaster](https://www.tiktok.com/@maritimemaster) on TikTok,
attached to the 58 cards they plainly answer. Nothing here is hand-maintained —
the three scripts rebuild it all from the downloaded clips in
`_temp/tiktok-maritimemaster/`.

```bash
python3 video/transcribe.py   # audio -> transcripts.json  (Gemini, ~2 min)
python3 video/match.py        # transcripts -> matches.json (shortlist + judge)
python3 video/build.py        # matches -> web/video/*.mp4 + web/videos.json
```

`transcribe.py` and `match.py` are re-runnable and skip finished work.
`build.py --force` re-encodes everything.

## How the matching works

A lexical shortlist (idf-weighted overlap between the clip's transcript and each
card) puts about fourteen candidate cards in front of the model, which then keeps
only the ones the clip *plainly answers*. Topical overlap is not a match: a clip
about night navigation touches thirty cards and belongs to none of them. The
prompt caps it at four cards and tells it that an empty list is a valid answer —
54 of 82 clips ended up placed, on 58 cards, and 25 clips are promotional or
lifestyle and were dropped by the `teaches` flag during transcription.

## What ships

`web/video/*.mp4` — 432px wide, H.264 crf 32, AAC 40 kbps mono. 53 MB for 56
minutes. The service worker **never** caches these: the offline shell is 2.6 MB
and must stay that way, so a clip is fetched only when someone opens it.

## Attribution

Every player shows "Maritime Master · source" linking to the original TikTok, and
the home screen credits the account. These are someone else's videos: before this
is promoted anywhere, get their blessing or switch to embeds.
