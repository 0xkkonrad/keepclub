# Keep Club minimal feedback placement review (02/03)

Verdict: keep the full `Help & feedback` wording only in Settings. Proposal 02 should remove the redundant shelf Theme switcher and reuse its existing 48px header slot for a visually tiny `?`; Share remains unchanged. Proposal 03 should put the same visual mark immediately before Close in the existing-card Edit sheet. Both marks use explicit accessible names and neither creates a new content row.

## Pre-flight

- Target: Keep Club `c702c0a6ab03ef245a509f720d6083c74e918801`, reviewed from detached worktree `/tmp/keepclub-feedback-minimal-review.jLmyUj/target`.
- In scope: proposals 02 and 03 only; shelf and Edit-card placement, narrow/Biggest/short-landscape geometry, keyboard order, accessible naming, modal ownership, privacy boundaries, and preservation of dirty edits.
- Out of scope: implementation, transport/backend selection, report-form copy, the full-text Settings entry, and blocking-error UI beyond its role as a separate contextual path.
- Ruling: the user accepted the layered approach and requested visually tiny, non-intrusive contextual duplicates; only the main Settings menu retains verbose copy.
- Ruling amendment (2026-08-24): Theme already lives in Settings and should not appear on these shelf screens. This supersedes the earlier assumption that Help had to coexist with Theme.
- Kill-list: `/tmp/keepclub-feedback-minimal-review.jLmyUj/kill-list.md`. RULING-grade entries keep full text in Settings, make contextual duplicates tiny `?` marks, preserve the layered approach, and retain one-tap Edit. The 48px target and imported-content privacy entries are RECORDED only; they were re-derived from source and did not close findings by themselves.
- Tooling deviation: the skill's Workflow runner was unavailable. Read-only finder/verifier waves ran against a pinned worktree, followed by main-loop Chromium probes. The pinned target stayed clean.
- Mockup: `preview/keepclub-feedback-minimal-02-03.html` (interactive states for cold/overlay shelf, Edit/feedback subview, 48px target overlay, and Biggest text).

## Confirmed

### C-01 · MED · Proposal 02 replaces Theme in the existing shelf header slot

Remove the 48×48 shelf Theme control and render Help in that exact slot. Cold shelf shows Help in the top-right header and keeps the existing 88×48 Share pill unchanged. The course overlay shows Help immediately before Close. Theme remains available from Settings. Anchors: `web/munin.js:1372-1384`, `web/munin.js:1882-1893`, and `web/munin.js:1965-2012`.

Failure scenario: adding Help without removing Theme creates a three-control Theme/Help/Close cluster and produces 7–8px content-box overflow at 320px/Biggest. Replacing Theme instead preserves the current two-control header geometry.

Repro status: main-loop Chromium confirmed the amended ruling. At 320px cold/default, Help reused the 48×48 Theme slot and the 280px header had zero overflow. At 320px overlay/Biggest, Help occupied x=194–242 and Close x=252–300; the 280px header had zero overflow, Close retained initial focus, and Shift+Tab reached Help.

### C-02 · MED · Proposal 03 belongs immediately before Close in the Edit-card bar

For an existing card only, insert a `type="button"` 48×48 `?` immediately before Close in the sticky card-sheet header. Its accessible name should be `Report a problem with this card`. Study and Browse keep their current one-tap Edit behavior; New card hides the control. Anchors: `web/index.html:480-486`, `web/app.css:1767-1795`, and `web/app.js:3971-4084`.

Failure scenario: a footer action begins below the 568px viewport at Biggest text, while a report control on every Browse row adds 40 repeated controls and expands the existing 58px action gutter.

Repro status: confirmed twice — verifier plus main-loop Chromium. At 320×568/Biggest, the bar stayed 316×74px with no overflow; title ended at x=186, Help occupied x=194–242, and Close x=250–298, leaving exact 8px gaps.

At 568×320/Biggest, the real sheet occupied 568×320, its sticky bar remained 74px high, Help and Close remained visible 48px targets with an 8px gap, and neither the bar nor document overflowed.

### C-03 · HIGH · Edit feedback must be an internal view, not another modal

Activating the Edit-sheet `?` must switch the existing card sheet into a feedback subview without calling `closeCardSheet()`. Keep the edit DOM/state alive, preserve both textareas and card identity, and give the subview its own history/focus mode so the first Back or Escape returns to Edit. Do not stack a second `aria-modal`. Anchors: `web/app.js:3971-3976`, `web/app.js:4041-4106`, `web/app.js:6271-6362`, and `web/app.js:7680-7686`.

Failure scenario: the user types an unsaved correction, taps `?`, then presses Escape or browser/Android Back. The current close path nulls `cardSheet` and clears both fields, so closing/reopening loses the edit.

Repro status: confirmed twice — verifier and main-loop browser repro. The actual Close → reopen path restored the original `What is Git?`, not the injected dirty draft. The interactive mock prototypes a separate history state: browser Back, Escape, or visible Back returns to Edit with the sentinel intact and focus restored to `?`.

### C-04 · MED · Shelf overlay feedback must also remain one-modal-at-a-time

The course shelf overlay already owns `aria-modal`, focus trapping, Escape, and history behavior. Its `?` must replace the shelf content or enter an internal feedback mode; a sibling feedback modal would create two active modal/focus handlers. On return, restore focus to the shelf Help button. Anchors: `web/munin.js:1874-1880`, `web/munin.js:1953-2012`, and `web/app.js:6322-6362`.

Failure scenario: open the course overlay, then stack a sibling feedback modal and focus it. Two visible `aria-modal=true` nodes coexist; pressing Escape triggers the shelf handler, removes the shelf, and leaves the feedback modal orphaned.

Repro status: confirmed twice — verifier/source review plus main-loop Chromium injection. The mockup now uses an internal shelf view and restores focus to `?` on visible Back, Escape, and browser Back.

### C-05 · HIGH · The shelf entry is shell-owned

The cold shelf renders before `app.js` is loaded, so its markup and entry wiring must live in `munin.js` (or a shell module explicitly loaded by it). An `app.js`-only control will never exist on a fresh cold shelf. Anchors: `web/munin.js:1-8`, `web/munin.js:1831-1951`, and `web/index.html:746-754`.

Failure scenario: launch a fresh profile with no selected course and implement Help only in `app.js`. The shelf renders, but the Help control and handler never exist because `app.js` is absent.

Repro status: confirmed twice — independent verifier plus main-loop fresh-profile resource inspection. The loaded scripts were `sync.js`, `doodles-munin.js`, `achievements.js`, `share.js`, `notifications.js`, and `munin.js`; `app.js` was absent.

## Refuted with evidence

### R-01 · Convert Share into an icon to make room

REFUTED. The icon-pair geometry fits, but it is not the smallest architectural change. `shareShelf()` temporarily replaces the control's contents with `shared`, `copied`, or `try again`, then restores the literal `share`; a fixed 48px glyph button clips those state labels and silently changes an unrelated, explicit affordance. Keeping the current Share pill plus `?` has the same reachable-state height and no overflow.

### R-02 · Settings covers non-card problems during Study

REFUTED. Active Study has no Settings control. Leaving Study to reach Settings clears the session and its current queue. A permanent Study-header `?` does fit, but reduces the progress area from 236px to 176px at Biggest text and adds persistent chrome. Omitting it is a deliberate scope tradeoff, not full coverage.

### R-03 · Every absolute-corner implementation necessarily breaks focus order

REFUTED. Absolute positioning does not itself change DOM order. A reserved, collision-tested absolute slot could be accessible, though it would require new responsive/safe-area rules and offers no advantage over reusing the existing Theme slot.

## By design — do not fix

1. Keep verbose `Help & feedback` copy in the main Settings menu only. Contextual duplicates are visually tiny `?` marks with accessible names. Ruling: `kill-list.md:3-4`.
2. Keep Study and Browse Edit as one-tap actions. Reporting is added inside the sheet; it does not replace or demote Edit. Ruling: `kill-list.md:6`.
3. Theme configuration belongs in Settings, not the shelf header. Ruling amendment: user, 2026-08-24.

## Reassuring negatives

- The surviving shelf placement adds no control, width, or layout height: the 48px Theme target becomes the 48px Help target.
- The surviving Edit placement adds zero sheet-bar height and zero horizontal overflow at 320×568/Biggest.
- At 568×320/Biggest, the Edit header and both 48px controls remain visible and overflow-free; the sticky form body remains the scrolling surface.
- Each painted glyph can remain 15–17px while the hit target stays 48×48px with the existing visible focus treatment.
- Close remains the edge-most Edit-sheet control; DOM and visual order can match `Report → Close → form`.
- Share remains text-labelled and retains its existing transient status behavior.
- The mockup preserves dirty Edit text while switching to and from the feedback subview.
- The mockup hides `?` in its New-card state and prototypes browser Back as well as visible Back/Escape.
- Automatic context is a built-in card reference only. Imported cards attach no identifier, question, answer, deck title, note, or other content.
- No Keep Club product source was edited; only preview and review artifacts were created/updated.
- Real VoiceOver/TalkBack, physical touch exploration, safe-area modes, localization expansion, and browser zoom beyond Keep Club's Biggest setting were not tested.

## Open rulings

1. **Should active Study eventually gain a permanent Help icon?** Evidence: it is the only uncovered non-card session state, and reaching Settings ends the session; the icon fits but permanently reduces the progress area by 60px. Recommendation: omit it in this minimal pass and learn from actual reports. Default: no Study-header icon unless the uncovered path produces real support friction.
2. **Should the sighted mark stay `?` after usability feedback?** Evidence: `?` is quiet and familiar for Help, but it does not itself say “bug report.” Recommendation: use `?` for the entry and make the destination title explicit (`report a problem`), with `aria-label="Help and feedback"` on the shelf and `aria-label="Report a problem with this card"` in Edit. Default: ship the `?` in any future implementation, then revisit only with evidence of failed discovery.

found 11 · refuted 3 (27.3%) · killed-by-kill-list 0 · overturned-by-hand 0
