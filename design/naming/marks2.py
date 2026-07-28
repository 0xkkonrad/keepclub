# -*- coding: utf-8 -*-
"""Doodle candidates for the two finalists: Keep Club and Understudy Club.

Same 32x32 conventions and the same seeded rough.py as the raven set, so anything
picked here already sits in the app's hand. Run with no args to rebuild
marks2.json and the _sheet2.png contact sheet — the small column is the one that
decides, an app icon has no wordmark to lean on.
"""
import os, sys, subprocess, json, re

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, os.path.join(REPO, "content", "day-skipper", "src"))
import rough  # noqa: E402

KEEP = {
 "tower":     ("the keep itself", "M8 12h16v16H8z M8 12v-3.6h3.2V12 M14.4 12V8.4h3.2V12 M20.8 12V8.4H24V12"
               " M13.2 28v-6.4c0-1.6 1.2-2.8 2.8-2.8s2.8 1.2 2.8 2.8V28"),
 "portcullis":("the gate that holds", "M6 27V9.6h20V27 M6 9.6h20"
               " M11 9.6V27 M16 9.6V27 M21 9.6V27 M6 16h20 M6 22h20 M4.4 27h23.2"),
 "cairn":     ("the pile that marks the place", "M8.6 27.4c0-1.6 3.4-2.8 7.4-2.8s7.4 1.2 7.4 2.8z"
               " M10.6 24.6c0-1.6 2.4-2.8 5.4-2.8s5.4 1.2 5.4 2.8 M11.8 21.8c0-1.4 1.8-2.6 4.2-2.6"
               "s4.2 1.2 4.2 2.6 M12.8 19.2c0-1.4 1.4-2.4 3.2-2.4s3.2 1 3.2 2.4"
               " M13.6 16.8c0-1.2 1-2 2.4-2s2.4.8 2.4 2"),
 "key":       ("what you keep it with", "M12.6 6.6a5 5 0 1 0 0 10 5 5 0 0 0 0-10z"
               " M17.6 11.6h9.8 M27.4 11.6v4.4 M23.4 11.6v3.6 M12.6 10.2a1.4 1.4 0 1 0 0 2.8"),
 "padlock":   ("kept shut", "M7.4 15h17.2v12.4H7.4z M11 15v-3.8c0-2.8 2.2-5 5-5s5 2.2 5 5V15"
               " M16 19.4v3.6"),
 "jar":       ("preserving is keeping", "M9.6 7.4h12.8v3.4H9.6z M10.8 10.8c-.6 2-1.2 3.6-1.2 5.6v11h12.8V16.4"
               " c0-2-.6-3.6-1.2-5.6 M9.6 20h12.8"),
 "tin":       ("the tin on the shelf", "M7 10.6c0-1.8 4-3.2 9-3.2s9 1.4 9 3.2-4 3.2-9 3.2-9-1.4-9-3.2z"
               " M7 10.6v13.2c0 1.8 4 3.2 9 3.2s9-1.4 9-3.2V10.6 M12 15.6h8"),
 "tally":     ("the count you keep", "M7 8.6v14.8 M12 8.6v14.8 M17 8.6v14.8 M22 8.6v14.8 M5.6 22.4 23.6 9.6"),
 "chest":     ("the lid you lift", "M5.6 13.4h20.8v13.2H5.6z M5.6 13.4c0-4 4.6-7 10.4-7s10.4 3 10.4 7"
               " M5.6 17.6h20.8 M14 17.6h4v4.4h-4z"),
 "acorn":     ("what a bird puts by", "M9.4 12.4c0-2.2 3-4 6.6-4s6.6 1.8 6.6 4z"
               " M9.8 12.4c0 5.6 2.6 10.4 6.2 12.6 3.6-2.2 6.2-7 6.2-12.6 M16 8.4V5.4"),
 "locket":    ("the one you kept", "M7.4 5.6c1.4 4.4 4.4 7.4 8.6 7.4s7.2-3 8.6-7.4"
               " M16 13c-4 0-7.2 3.4-7.2 7.6s3.2 7.6 7.2 7.6 7.2-3.4 7.2-7.6S20 13 16 13z"
               " M13.4 20.6h5.2"),
 "pocket":    ("kept close", "M6.4 8h19.2v20H6.4z M6.4 14.4h19.2 M11.6 14.4v4.6h8.8v-4.6"),
 "anchor":    ("holds fast", "M16 11.4V27 M12.4 13.4h7.2 M16 5.6a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6z"
               " M6.4 19.4c0 5 4.4 8 9.6 8s9.6-3 9.6-8 M4.6 19.6h3.6 M23.8 19.6h3.6"),
 "lighthouse":("the keeper's light", "M11.4 27 13 12.6h6L20.6 27z M13 12.6h6 M12.6 8.6h6.8L19 12.6h-6z"
               " M16 8.6V5.6 M22.6 9.4l3.4-2 M9.4 9.4 6 7.4 M12.4 19.8h7.2"),
 "hive":      ("the keeper's other one", "M7.6 26.6c0-2.4 3.8-4.2 8.4-4.2s8.4 1.8 8.4 4.2z"
               " M9.4 22.4c0-2.2 3-3.8 6.6-3.8s6.6 1.6 6.6 3.8"
               " M11 18.6c0-2 2.2-3.6 5-3.6s5 1.6 5 3.6"
               " M12.6 15c0-1.8 1.6-3.2 3.4-3.2s3.4 1.4 3.4 3.2"
               " M14.8 26.6v-2.4h2.4v2.4 M4.4 27.4h23.2"),
 "strongbox": ("kept somewhere solid", "M5.6 8.4h20.8v18.2H5.6z M9 11.8h14v11.4H9z"
               " M16 15a2.6 2.6 0 1 0 0 5.2 2.6 2.6 0 0 0 0-5.2z M16 17.6h4.6"),
 "binder":    ("everything in one ring", "M9.4 6.6h16v20.8h-16z M9.4 6.6c-2 0-3.4 1.4-3.4 3.4v14"
               " c0 2 1.4 3.4 3.4 3.4 M7.4 11.6h4 M7.4 16.4h4 M7.4 21.2h4"),
}

UNDERSTUDY = {
 "curtain":   ("still closed", "M3.4 6.2h25.2 M7 6.6c.6 5.6.8 11.2.4 16.8 3-1.2 4.8-3.8 5.2-7.4.4-3.2.2-6.4-.4-9.4"
               " M25 6.6c-.6 5.6-.8 11.2-.4 16.8-3-1.2-4.8-3.8-5.2-7.4-.4-3.2-.2-6.4.4-9.4 M5.6 27.4h20.8"),
 "spikemark": ("where you will stand", "M8 9.6 24 24.4 M24 9.6 8 24.4 M4.6 28h22.8"),
 "ghostlight":("the light left on an empty stage",
               "M16 6.4a3.8 3.8 0 0 0-3.8 3.8c0 1.6.8 2.4 1.4 3.2.5.8.8 1.4.8 2.2h3.2c0-.8.3-1.4.8-2.2"
               ".6-.8 1.4-1.6 1.4-3.2A3.8 3.8 0 0 0 16 6.4z M14.4 17.6h3.2 M16 19v7.4"
               " M10.4 28.4c0-1.2 2.5-2 5.6-2s5.6.8 5.6 2z"),
 "cuecard":   ("a flashcard, held up", "M6.4 8.6 22.6 5.4l3 15.6-16.2 3.2z M10.6 11.4l10.4-2"
               " M11.2 15l7 -1.4 M9.4 24.2 7 28.6 M11 26l1.4 2.6"),
 "sides":     ("the actor's pages", "M8 5.6h12.4l4 4v17H8z M20.4 5.6v4h4 M11 13h9 M11 16.8h9 M11 20.6h5.4"),
 "stagedoor": ("the door you wait behind", "M8 4.6h16v23.4H8z M8 28h16"
               " M16 8.4l1.5 3 3.3.5-2.4 2.3.6 3.3-3-1.6-3 1.6.6-3.3-2.4-2.3 3.3-.5z M11 20.6h1.4"),
 "mask":      ("the part, not the person", "M6.6 9c0-1.6 4.2-2.8 9.4-2.8S25.4 7.4 25.4 9"
               " c0 8.4-4.2 16.8-9.4 16.8S6.6 17.4 6.6 9z M11 13.4c1.2-1.2 2.6-1.2 3.8 0"
               " M17.2 13.4c1.2-1.2 2.6-1.2 3.8 0 M13 20c1.8 1.2 4.2 1.2 6 0"),
 "chair":     ("waiting in the wings", "M9.4 7h13.2v11.6H9.4z M7.6 18.6h16.8 M10.6 18.6 8.4 28"
               " M21.4 18.6 23.6 28 M12.4 10.4h7.2"),
 "hanger":    ("the costume, not yet worn", "M16 9.6a2.2 2.2 0 1 1 2.2-2.2c0 1.6-2.2 1.6-2.2 3.4"
               " M16 11 5.4 20.4c-1 .9-.4 2.2 1 2.2h19.2c1.4 0 2-1.3 1-2.2z"),
 "footlights":("the row at the front", "M4 23.4h24v4H4z"
               " M7.4 23.4a3.4 3.4 0 0 1 6.8 0 M17.8 23.4a3.4 3.4 0 0 1 6.8 0"
               " M10.8 17.4v-3.6 M21.2 17.4v-3.6"),
 "proscenium":("the arch you step through", "M4.6 27.4V13.4C4.6 8.6 9.6 4.8 16 4.8s11.4 3.8 11.4 8.6v14"
               " M9.6 27.4V13.8c0-3.2 2.8-5.6 6.4-5.6s6.4 2.4 6.4 5.6v13.6 M3 27.4h26"),
 "star":       ("the one on the door", "M16 5.4l3.2 6.6 7.2 1-5.2 5.1 1.2 7.2-6.4-3.4-6.4 3.4 1.2-7.2-5.2-5.1 7.2-1z"),
 "dogeared":  ("the script you have actually used", "M7.4 5.6h13l5 5v16.8h-18z M20.4 5.6v5h5"
               " M25.4 22.4l-5 5v-5z M10.6 13h11 M10.6 17h11 M10.6 21h6"),
 "playbill":  ("your name is in it, small", "M10.6 6.6h13.8c-2.6 0-4.6 2-4.6 4.6v14.2"
               " c0 2.6-2 4.6-4.6 4.6h-4.6c2.6 0 4.6-2 4.6-4.6V11.2c0-2.6-2-4.6-4.6-4.6z"
               " M22 12.6h-1.4 M22 16.6h-1.4"),
 "mirrorbulbs":("the dressing room", "M9 8.6h14v14.8H9z M6.2 8.6h.1 M6.2 13.6h.1 M6.2 18.6h.1 M6.2 23.4h.1"
               " M25.8 8.6h.1 M25.8 13.6h.1 M25.8 18.6h.1 M25.8 23.4h.1"
               " M9 5.8h.1 M14 5.8h.1 M19 5.8h.1 M23 5.8h.1"),
 "promptbook":("the book that knows the words", "M16 9.6C13.4 7.4 9.6 6.6 5.6 7v16.8c4-.4 7.8.4 10.4 2.6"
               " M16 9.6c2.6-2.2 6.4-3 10.4-2.6v16.8c-4-.4-7.8.4-10.4 2.6 M16 9.6v16.8"
               " M19.4 7.4v9.2l1.8-1.6 1.8 1.6V6.8"),
 "wings":     ("stage left, waiting", "M4.6 4.8v22.6 M27.4 4.8v22.6"
               " M9 5.2c.8 6.6 1 13.2.4 19.8 3.4-1.4 5.4-4.4 5.8-8.6.4-3.8.2-7.6-.4-11.2"
               " M3 27.8h11.2 M20.4 12.6h6.6 M20.4 18.6h6.6"),
}
DOTS = {
 "key": [[12.4, 12.6, 1.0]],
 "mirrorbulbs": [[6.2, 8.6, 1.5], [6.2, 13.6, 1.5], [6.2, 18.6, 1.5], [6.2, 23.4, 1.5],
                 [25.8, 8.6, 1.5], [25.8, 13.6, 1.5], [25.8, 18.6, 1.5], [25.8, 23.4, 1.5],
                 [9, 5.8, 1.5], [14, 5.8, 1.5], [19, 5.8, 1.5], [23, 5.8, 1.5]],
}

def draw(src):
    out = {}
    for n, (why, d) in src.items():
        circles = "".join('<circle cx="%s" cy="%s" r="%s"/>' % (c[0], c[1], c[2])
                          for c in DOTS.get(n, ()))
        drawn = rough.redraw(circles + '<path d="%s"/>' % d, rough.DOODLE, 32)
        out[n] = {"why": why, "d": " ".join(re.findall(r'\bd="([^"]*)"', drawn))}
    return out

if __name__ == "__main__":
    data = {"keep": draw(KEEP), "understudy": draw(UNDERSTUDY)}
    json.dump(data, open(os.path.join(HERE, "marks2.json"), "w"), indent=1)

    def col(title, marks):
        cells = "".join(
            '<div class=c><svg viewBox="0 0 32 32" fill=none stroke="#121214" stroke-width=2 '
            'stroke-linecap=round stroke-linejoin=round class=lg><path d="%s"/></svg>'
            '<svg viewBox="0 0 32 32" fill=none stroke="#121214" stroke-width=2 '
            'stroke-linecap=round stroke-linejoin=round class=sm><path d="%s"/></svg>'
            '<b>%s</b></div>' % (m["d"], m["d"], n) for n, m in marks.items())
        return "<h2>%s (%d)</h2><div class=g>%s</div>" % (title, len(marks), cells)

    html = ("<!doctype html><meta charset=utf-8><style>body{margin:0;background:#f0eee7;"
            "font:12px monospace;padding:12px;color:#55555e}h2{font-size:13px;font-weight:400}"
            ".g{display:flex;flex-wrap:wrap;gap:8px}.c{width:104px;text-align:center}"
            "svg.lg{width:88px;height:88px}svg.sm{width:26px;height:26px}"
            "b{display:block;font-weight:400}</style>"
            + col("KEEP", data["keep"]) + col("UNDERSTUDY", data["understudy"]))
    open(os.path.join(HERE, "_sheet2.html"), "w").write(html)
    chrome = os.path.expanduser("~/.cache/ms-playwright/chromium_headless_shell-1217/"
                                "chrome-headless-shell-linux64/chrome-headless-shell")
    subprocess.run([chrome, "--headless", "--disable-gpu", "--no-sandbox",
                    "--screenshot=" + os.path.join(HERE, "_sheet2.png"),
                    "--window-size=980,900", "file://" + os.path.join(HERE, "_sheet2.html")],
                   check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    print("keep:", len(data["keep"]), " understudy:", len(data["understudy"]),
          "->", os.path.join(HERE, "_sheet2.png"))
