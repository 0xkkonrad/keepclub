# German illustration visual review

All seven figures pass the final visual review. Reviewed on 2026-09-27 by the rig terminology agent. This is an independent visual check of the assembled course, including figures translated by the other agents. The reviewer opened all seven individual PNGs and `gallery-dark.png` with the image viewer and compared them with `content/sailing-in-german/illustrations.json`. The individual captures show narrow, phone-sized figure panels. After the rigging legend fix, the reviewer reopened the regenerated `rigging.png` and `gallery-dark.png` and confirmed the correction visually.

| Figure | Verdict | Visual checks |
| --- | --- | --- |
| `hull-plan` | Pass | Bug is at the top, Heck at the bottom, Backbord at the left, and Steuerbord at the right. Both querab arrows point across the boat. The Breite dimension spans the widest part. No cropped German labels. |
| `hull-profile` | Pass | Masthöhe über Wasser measures above the waterline; Tiefgang measures down to the keel rather than to the seabed. Freibord points to the deck-edge distance above the water. Rotated annotations remain inside the figure. |
| `deck-fittings` | Pass | Heckkorb and Spiegel identify the aft end at left; Bugkorb and Vorsteven identify the forward end at right. The Strecktau leader points to the deck safety attachment, separate from the Reling. Relingsstützen and Lippklampe point to their fittings. Long German terms fit. |
| `sail-parts` | Pass | Segelkopf points to the upper corner, Hals to the forward lower corner at right, and Schothorn to the aft lower corner at left. Vorliek, Achterliek, and Unterliek identify the correct edges. The repositioned Schothorn is fully visible with an unambiguous leader. |
| `rigging` | Pass after correction | All eight part labels point to the correct rigging. Both expanded legend lines now sit above the masthead with visible clearance. The legend is readable in light and dark mode. No label is clipped. |
| `windward-lee` | Pass | Wind arrows point left to right. Luv and Küste in Luv are at left; Lee and Küste in Lee are at right. The boat heels toward Lee and the boom lies to that side. The two shore descriptions preserve the correct wind direction. No cropped or overlapping words. |
| `mooring-lines` | Pass | The bow points right. Vorleine leads forward; Achterleine leads aft. Vorspring runs from forward aboard toward the aft shore cleat and is paired with verhindert Vorrutschen. Achterspring runs from aft aboard toward the forward shore cleat and is paired with verhindert Zurückrutschen. Querleine runs transversely to the berth. Both explanation columns remain distinct. |

The final dark gallery preserves all seven figures' labels, leader lines, and color distinctions. English-looking titles in this QA gallery are internal figure IDs; the illustrated labels and captions are German.

## Resolved finding: rigging legend space and contrast

In `rigging.png`, the second legend, “Laufendes Gut: setzt und trimmt Segel”, runs across the masthead where the rigging lines converge, around pixel (145, 97) in the phone capture. This collision involves drawing geometry, so a check limited to text bounding boxes does not detect it. In `gallery-dark.png`, both always-visible legend lines are substantially fainter than the part labels.

The fix extends the viewBox upward and places the two legend baselines at y=4 and y=28, above the masthead at y=44. A course-specific rule gives the always-visible legend full opacity. In the regenerated phone capture, the masthead begins below the second legend with a clear gap; both lines are readable in the dark gallery. The full nautical wording and all boat geometry are preserved. This finding is closed.

The rest of the captions and terminology agree with the source-grounded translation reviews. This visual review does not replace those dictionary checks.
