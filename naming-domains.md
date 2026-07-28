# The name and the address — the idea maze

Where the app's public name and domain got to, and every road that was walked to get there.
Companion to [naming-research.md](naming-research.md), which sweeps mythology for *names*;
this one is about **names that can be bought and found**. The full candidate set with meanings,
collisions and risk notes is [design/naming/candidates.json](design/naming/candidates.json).

**DECIDED 28 Jul 2026: the name is KEEP CLUB.** Konrad's call, after the doodle sets. Nothing is
bought yet. The app still ships as Munin at `kkonrad.com/munin`.

**Buy `keepclub.app`** — $8.75 first year, $14.93 renewal. Re-confirmed free at decision time
(RDAP 404 against a control returning 200, and no NS records).

---

## Why this is even open

Not the domain. `munin.club` is free, so an address costs $4.12.

The real problem is that **[munin-monitoring.org](https://munin-monitoring.org) owns the search
term** — a 24-year-old open-source server-monitoring tool with a 24-year backlink head start.
"Munin" will not be ours on the open web at any budget. Munin's own domains are otherwise gone:
`.com/.app/.io/.dev/.ai/.co/.me/.net/.org/.xyz/.study/.wiki/.so/.fyi` are all registered, as are
`getmunin`, `usemunin`, `muninapp`, `trymunin` and `muninn.com/.app`.

So the question is narrow: **is being findable worth the rename?** Against it sits fourteen
raven drawings, a ten-drawing frieze, both loading screens, and an achievement set the app calls
*the hoard* — all of which mean *Munin* and nothing else.

---

## The road so far

**28 Jul 2026 — the wide sweep.** Thirteen subagents, one naming direction each: corvid lore ·
Norse & myth · memory science · study vernacular · Latin & Greek · craft & repetition · hoard &
keeping · club-first · coined · non-English · daily ritual · nautical · paper & print. 213
candidates, 197 unique, all availability-checked. Sorted into three tiers; the twelve that made
tier 1:

| domain | the pitch |
|---|---|
| `larder.club` | Everything you're keeping, in one place, ready when you come back for it |
| `garner.club` | Everything you've gathered, kept somewhere it won't rot |
| `muna.club` | The Old Norse verb *Munin* is built from — same raven, zero brand equity lost |
| `impress.club` | Press it in until it stays |
| `hornbook.club` | The oldest flashcard in English, five hundred years on |
| `bearings.club` | Open it and you know where you stand |
| `ringers.club` | "I'm in the ringers club" is the best sentence on the list |
| `whetstone.club` | The edge comes from going back to the stone |
| `scrubjay.club` | The bird that remembers where it put every single thing |
| `muster.club` | Daily muster — everything you know, called out and present |
| `krummi.club` | Icelandic nickname for the raven; same bird, offset |
| `understudy.club` | Know it cold long before anyone asks you to perform it |

Cut on review, worth not re-proposing: `offbook` (an actor line-memorising app — direct
competitor), `byheart` (infant formula), `quill` (Staples), `glean` (enterprise AI search),
`checkride` (aviation exam prep), `strop` (a tantrum, in British usage), `alala` (worry, in
Tagalog), `chest` (anatomical reading next to *.club*).

**Konrad's 12** → **short shortlist of 5**: understudy · flashbulb · shoebox · keep · ropes.

**The deep pass on those five** is in the picker (7 decisions, LS_KEY `munin-name-picker-v1`):
<https://claude.ai/code/artifact/67f72b79-9510-44d2-b05b-1a96f218e58f>

---

## What the five are actually worth

Apple's own index, searched per word, is most of the answer:

| name | what the App Store returns for it | who holds the word |
|---|---|---|
| understudy | top hit has **12** ratings; neighbours are actor line-memorisation apps | a Substack; Understudy Technologies |
| shoebox | Shoeboxed, receipts, 1.8k ratings, Finance | Shoeboxed |
| ropes | untangle-the-rope games, 46k–384k ratings | Ropes & Gray; ropes.ai (live) |
| flashbulb | **flashlight** utilities, 30k–46k, above the real Flashbulb apps | Flashbulb ApS; the psychology literature |
| keep | Google Keep first, then Keep (fitness), Keepsafe 379k | Google; keep.com |

Two findings decide it:

- **Flashbulb means the opposite of the product.** A flashbulb memory is psychology's textbook
  case of a memory that feels vivid and certain and is demonstrably unreliable — that
  inconsistency is the entire literature. Psych and med students are half this market.
- **Shoebox says storage; understudy says rehearsal.** The failure mode of every flashcard app
  is decks built and never reviewed. Shoebox is shorter and warmer, and it reinforces the wrong
  verb.

### Prices, checked at checkout (Konrad, 28 Jul)

| domain | price | standing |
|---|---|---|
| `keep.club` | **$1,000** | Registry-premium. **Parked as a someday-if-this-takes-off name** — not now. The premium suspicion in the picker was right. |
| `understudy.club` | **$30** | Normal. Viable today. |

Base .club is $4.12 first year / $15.96 renewal, so $1,000 is a premium tier and $30 is close to
standard. Paying premium for `keep` buys a word that Google Keep owns anyway — the worst trade
on this page. It only makes sense once the product is established enough that the name is
carrying nothing.

---

## The finding nobody had: .club is on an abused-TLD blocklist

**`.club` is blocked wholesale** by [HaGeZi's "World's Most Abused TLDs"](https://github.com/hagezi/dns-blocklists)
list — widely used in Pi-hole, AdGuard and uBlock — with 25 hand-added exceptions. `.quest` is
on it too, with 6. `.app`, `.com`, `.dev`, `.me`, `.io` and `.xyz` are **not** listed.

Weigh it honestly: it is one opt-in list used by a technical minority, and it has no effect on
Google ranking. But that minority overlaps hard with people who install an offline-first,
no-account, indie flashcard app — Anki refugees skew technical.

**It is also removable.** The exception list is `tilde.club`, `hack.club`, `1mb.club`,
`512kb.club`, `nocss.club`, `no-js.club`, `ctrl-c.club`, `debian.club`, `readme.club` — indie-web
projects, hand-added because real people use them. Munin is exactly that shape. The mitigation is
an issue on the blocklist repo, not a different TLD.

---

## Second shortlist — dodging the premium and the blocklist

All confirmed unregistered 28 Jul against each TLD's own registry, with a known-registered
control per TLD (`web.app`, `nic.quest`, `google.com` all answered 200).

| domain | price/yr | verdict |
|---|---|---|
| **`understudyclub.com`** | $11.08 | **Best of the four.** The recommended name, on the most trusted TLD, no blocklist exposure, no premium risk. Costs the domain hack — `understudy.club` *reads* as "Understudy Club"; this is the name with a TLD after it — and 18 characters is a mouthful. |
| `keepclub.app` | $8.75 / $14.93 | The sane way to have Keep Club at a normal price. `.app` is clean, HSTS-preloaded so HTTPS is mandatory (fine on Pages/Vercel, and a small trust signal), and it says "this is an app" to an app-shopping audience. Loses the hack, keeps every Google Keep problem. |
| `thekeepclub.app` | $8.75 | **Strictly dominated** — `keepclub.app` is free, so there is no reason to take the *the* version instead of it. A definite article announces that the name wasn't yours, and people drop it when typing. Worth $9 as a defensive companion, never as the primary. |
| `keepclub.quest` | $1.54 / $12.98 | **Don't.** Blocked TLD, and only 6 exceptions to appeal into. *Quest* is also gamification vocabulary — Duolingo's register — and this app is deliberately not that. The $1.54 price is exactly why the TLD is abused. |

Also free and worth registering defensively if that name wins: `understudyclub.app`,
`theunderstudyclub.com`. `keepclub.com` is taken (since 2002, currently dark).

**What the second shortlist really shows:** the name and the TLD are separable decisions. A
compound name on `.com` or `.app` sidesteps both the premium and the blocklist, and costs only
the domain hack — which was the single best thing `keep.club` and `understudy.club` had going
for them.

---

## Branding mockups

Twenty-five of them — five treatments for each of the five names, drawn through the same seeded
`rough.py` as the ravens, set in the app's own DM Mono and Architects Daughter, on the app's
palette: <https://claude.ai/code/artifact/d50adef5-8ba6-4d66-9e1e-f7a5a0e05435>

The treatments are identical across names so they compare down the column as well as across:
**the raven renamed** · **its own mark** · **both** · **wordmark on the frieze** · **the app icon**.
Mark geometry is in [design/naming/marks.py](design/naming/marks.py) — a curtain for understudy,
a lidded box for shoebox, a coil for ropes, a bulb for flashbulb, a crenellated tower for keep.
Two were redrawn after failing the small-size read: a spotlight read as a bell at 34px, and a
knot read as a squiggle. Nothing there ships; they exist so a name can be judged with a drawing
beside it.

### Doodles for the two finalists

Seventeen marks each, same seeded `rough.py`, shown at 64px, 22px and as a 26px filled icon:
<https://claude.ai/code/artifact/3f53d749-ae26-4c1d-81b0-56e9496775a8>
Geometry in [design/naming/marks2.py](design/naming/marks2.py).

**Keep**: tower · portcullis · cairn · key · padlock · jar · tin · tally · chest · acorn · locket ·
pocket · anchor · lighthouse · hive · strongbox · binder.
**Understudy**: curtain · spikemark · ghostlight · cuecard · sides · stagedoor · mask · chair ·
hanger · footlights · proscenium · star · dogeared · playbill · mirrorbulbs · promptbook · wings.

**What the drawings show that the words did not:** Keep keeps producing *containers* — tin, chest,
jar, pocket, strongbox — and a container says **stored**, which is the failure mode of every
flashcard app. The Keep marks that work are about **accumulation** (tally, cairn, acorn), not
enclosure. Understudy produces **readiness**: a mark on the floor, a card held up, a light left
burning. Same asymmetry the naming analysis found in words, arriving again in pictures.

Shortlist of three per name: `tally` / `tower` / `acorn`, and `spikemark` / `cuecard` /
`ghostlight`. Seven marks were redrawn after failing the 26px read — a portcullis came out a
globe, a reef knot a bowtie, a spotlight a bell.

## The buy list, now that the name is keep club

| domain | status | do |
|---|---|---|
| **`keepclub.app`** | free, $8.75 / $14.93 | **Buy this.** `.app` is not on the abused-TLD blocklist that `.club` and `.quest` are, it is HSTS-preloaded so HTTPS is enforced, and it says *app* to an audience that is shopping for one. |
| `thekeepclub.app` | free, $8.75 | Optional defensive companion. Never the primary — `keepclub.app` is free, so the definite article buys nothing but a word people drop when typing. |
| `keep.club` | free, **$1,000/yr** | Not now. Parked as a someday-if-this-takes-off name. Worth noting it would *also* carry the `.club` blocklist problem, so the premium buys a worse TLD. |
| `keepclub.com` | **taken** | Cannot be had. Held since 2002, Alibaba nameservers, NetEase mail configured, serves a "请稍等" holding page, runs to 2027. |
| `keepclub.quest` | free, $1.54 | No. Blocked TLD with six exceptions, and *quest* is gamification vocabulary this app avoids. |

**The known cost of this name, accepted going in:** there is no good `.com`. `keepclub.com` belongs
to someone else, and the fallbacks (`getkeepclub.com`, `keepclubapp.com`) are worse than the
`.app`. Say the name out loud and a share of listeners will type `.com` and land on a stranger's
redirector — the *verbal leak*. It is the price of the word, and it does not go away.

**Also still true and worth acting on:** `.app` sidesteps the blocklist entirely, so the
HaGeZi exception request that a `.club` would have needed is no longer necessary.

## Where it stands

The name is settled. What is still open, and is still live in the picker: whether **keep club**
replaces Munin outright or is the front door to it, what happens to the raven and the hoard, the
App Store title, and where acquisition traffic comes from. The `the-name` card is now decided —
option E — and the recommendation on it is superseded by Konrad's call.

The mark is not chosen. `tower` is mocked up in place at
<https://claude.ai/code/artifact/0334fbdc-9688-47cc-b5ab-8bc177828a48>; the other sixteen
candidates are in the doodle report above. `tally`, `cairn` and `acorn` remain the three that
say *accumulation* rather than *storage*, which is the objection the Keep marks have to survive.

---

## Method notes — how availability was actually checked

- **`whois` is not installed in the sandbox** and fails silently, returning empty for every
  domain, which reads as "available" for anything. It was used once here and produced five
  false positives before the mistake was caught.
- **`rdap.org` is not reliable per TLD** — it 404s where it has no server, which also reads as
  free. It false-positived on `.io/.co/.me/.so` in the first run and on `.com` in the second.
- **The correct ladder**: `dig +short NS` (any NS = registered) → the TLD's own RDAP server,
  resolved from the IANA bootstrap at <https://data.iana.org/rdap/dns.json> → **always run a
  known-registered control** against the same server, so a blocking or rate-limited endpoint
  cannot be mistaken for a free domain.
- Registry endpoints in use: `.club` → `rdap.nic.club`, `.com` → `rdap.verisign.com/com/v1`,
  `.app` → `pubapi.registry.google/rdap`, `.quest` → `rdap.centralnic.com/quest`.
- **Thirteen parallel agents exhausted the .club registry quota** (403 on RDAP, "Number of
  allowed queries exceeded" on whois:43). Fallback is querying the TLD's own nameservers
  (`dig @a.nic.club <name>.club NS`, NXDOMAIN = not in zone) — no quota, blind only to
  registered-but-undelegated names. Quota resets in about an hour.
- **Per-domain premium pricing cannot be read without registrar credentials.** Every API refused
  — GoDaddy returns Access Denied, Porkbun/Domainr/NameSilo need a key. Only checkout reveals it,
  which is how `keep.club` turned out to be $1,000.
- **Collision checking matters as much as availability**: fetch the `.com` and read its `<title>`,
  and search Apple's index (`itunes.apple.com/search?term=X&entity=software&country=us`) for
  what a user typing the word actually gets.
