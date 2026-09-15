# Video policy

Written before the first video source was added, as
`ART_SOURCE_POLICY.md` was. These rules are not preferences; a change that
breaks one gets sent back.

## The rule underneath everything: embed, never re-host

Video is the most rights-encumbered content The Daily touches. Re-hosting
it — or extracting the media file and playing it through our own player —
is straightforward infringement, and a far harder breach than the
metadata-and-excerpt rule that text already lives under.

So:

- **Play through the publisher's own embed.** Their branding, their
  pre-roll, their player. Stripping any of it circumvents the monetisation
  that pays for the journalism.
- **Store metadata only**: title, description excerpt, thumbnail URL,
  provider, video id, canonical watch URL, publish time. Never the file,
  never a copy of the stream, never a re-encoded clip.
- **Never** work around age gates, region blocks, paywalls or
  "embedding disabled". A video we may not embed is a video we do not
  frame — it is linked to instead.

## Privacy: nothing loads until the reader presses play

A page with ten video cards that mounts ten iframes has made ten requests
to Google before the reader has decided to watch anything. For a private
dashboard that is unacceptable.

- Cards render **thumbnail and play button only** — plain markup, no iframe.
- The iframe mounts **on click**, and not before.
- Embeds use **`youtube-nocookie.com`**, never `youtube.com`.
- **Playback never begins without an explicit press.** The mounted iframe
  does carry `autoplay=1` — because the reader has just asked for the video
  by pressing the button — but nothing plays, and nothing loads, before
  that press.

## Ranking: video earns its place

Video is an **attribute of a story, not a category of its own**. It is
scored by exactly the same transparent weights as everything else —
relevance, authority, recency, geography, corroboration, novelty.

A video is never promoted for being a video. If a written report is the
better story, the written report leads.

Three rules keep that true in practice, each added after the 15 September
audit found the opposite happening:

- **Authority matches the publisher's text feed**, or the nearest
  comparable one where there is no text feed. SCMP video had been set at 85
  against SCMP text at 82; Reuters and Bloomberg at 88 and 86 above BBC at
  85. All now match.
- **At most one video per Daily Brief section.** Broadcasters post clips far
  faster than newsrooms publish articles — Bloomberg's channel posted 30 in
  a day — and ranked on score alone the Greater China and Global sections
  were entirely video. The cap stops a format taking a section by volume; it
  does not demote any single video.
- **Classified by title, never description.** A channel description is
  promotional copy (below). Classifying on it put 31 of 250 videos on the
  wrong beat: a Fashion Week clip in Infrastructure, architecture tours and
  a bank CEO interview in Property.

A feed lists a channel's latest 15 uploads whatever their age, so **video
older than seven days is not ingested**. News RSS carries no such risk.

The Video page shelves channels as **Hong Kong**, **International** and
**Architecture & Design**, newest first, three per channel. A single
newest-first list gave its first 30 places to the wire channels and showed
no TVB, Now, SCMP or architecture video at all.

## One event, one story

A video report and a written report of the same event are **two renditions
of one story**, not two cards. Clustering treats them accordingly, so the
feed does not show the same news twice because it arrived in two formats.

## Video is not a citable source

The AI answers only from text it actually retrieved. **A video we cannot
read is not evidence**, so video never enters the grounding context and is
never cited.

Enforced in code by `isGroundable()` / `groundingContext()` in
`src/lib/retrieval.ts`, at every point the AI is handed stories: Ask The
Daily, the brief overview, audio scripts (whose stored source ids exclude
video), story summaries and project facts. A story that exists only as
video shows a plain note in place of the summary buttons.

Two quieter paths are closed too. **A video never corroborates**: RTHK's
YouTube channel clustering with RTHK's own text feed does not make the
article `CORROBORATED`, and that status is shown to the AI with every
source. And **written reporting represents a cluster in the brief**, so a
higher-scoring clip cannot stand in for — and, under the video cap, drop —
the written report the overview and audio are allowed to use. The policy was
written before the first video source but, until the 15 September audit,
not enforced — video descriptions were reaching all five.

The description text that accompanies a video is publisher-written
promotional copy, not reporting — it may be indexed for search, but it is
not treated as a factual source.

Officially published, licensed captions could change this. That is a
separate decision requiring its own verification, never an assumption.

## Sources

Every channel is verified before it is committed: the channel id resolved
from its canonical URL, the feed fetched, and entries confirmed present.
The same rule as every RSS feed in the registry — **never a guessed URL**.

**A feed with entries is not proof of the right channel.** Also confirm the
channel page's own title and handle belong to the publisher, and that its
newest entry is recent. The first round skipped this, and two of ten
channels were wrong (see *Removed* below).

Verified 15 September 2026 — title and handle as shown on the channel page,
newest entry the same or previous day except where noted:

| Source | Channel | Channel page title · handle |
|---|---|---|
| RTHK News 香港電台新聞 | `UCwuTCNZqSMfaiP63cGDb8LQ` | 香港電台新聞 RTHK News · @RTHK_news |
| TVB News 無綫新聞 | `UC_ifDTtFAcsj-wJ5JfM27CQ` | TVB NEWS Official 無綫新聞 · @tvbnewsofficial |
| Now Finance News Now財經新聞 | `UCChMBgirwM2nnT3Bbe8METQ` | Now 財經 新聞 · @nowbnc — linked from news.now.com |
| SCMP | `UC4SUWizzKc1tptprBkWjX2Q` | South China Morning Post · @SouthChinaMorningPost |
| BBC News | `UC16niRr50-MSBwiO3YDb3RA` | BBC News · @BBCNews |
| Reuters | `UChqUTb7kYRX8-EiaN3XFrSQ` | Reuters · @Reuters |
| Bloomberg Television | `UCIALMKvObZNtJ6AmdCLP7Lg` | Bloomberg Television · @markets |
| Dezeen | `UCsWG9ANbrmgR0z-eFk_A3YQ` | Dezeen · @dezeen (posts every few days) |
| ArchDaily | `UC3r_kdJocuqtDYb2GgM42Ng` | ArchDaily · @ArchDaily (posts every few days) |

Removed after the 15 September audit:

- **"Now News"** (`UCnwaU7j34C92ywMHXJahHRA`) — actually **NOW** (@NOWTV),
  a UK entertainment streaming service. Its entries were drama promos and a
  golf advert, the newest four months old. Replaced by Now TV's own business
  news channel above.
- **"SCMP TV"** (`UCezZxnyyvF9Yv3qqfM1Gn7A`) — actually **@SCMPtv**, an
  unrelated account whose newest upload is from 2017. SCMP's real channel
  is already listed.

Rejected during the first verification, and why:

- **HK01** (`UCoIAynJyPEM1s9-nssdlUQQ`) — channel resolves, feed returns
  200 with zero entries. Not added on the assumption it will fill up.
- **`@scmp`** (`UCyWH3nbNsDlaxx3C0PPInwg`) — same: resolves, empty feed.
  `@southchinamorningpost` is the channel that actually publishes.
- **Bloomberg Television** (`UCdK2BueKxC9VxXh7e1Ne4oQ`) — empty feed;
  `@markets` is the one carrying items.

## Channels that disable off-site playback

Some publishers turn off playback on other websites. Their embed then shows
YouTube's own "Playback on other websites has been disabled by the video
owner" where a video should be — which is both a broken card and a frame we
were asked not to make.

Those channels carry `embeddable: false` in the registry and render as a
thumbnail linking to the publisher instead of a player. **RTHK is marked
this way**, verified in the running app on 12 Sept 2026.

This cannot be detected cheaply before showing a card: oEmbed returns 200
whether or not embedding is allowed, and fetching an embed outside a page
context fails with a referrer error (`Error 153`) that looks identical for
embeddable and non-embeddable videos alike. The paid YouTube Data API
exposes `status.embeddable`; without it, the check is to watch a card play
in the running app and record the answer per channel.

**Only RTHK has been verified so far.** The other eight are assumed
embeddable until someone watches one. A channel found showing the block
message gets flipped to `embeddable: false` — it is a one-line change.

The 15 September audit tried to settle the other eight and could not: the
in-app browser does not capture the contents of a cross-origin player
frame in screenshots, and YouTube's internal player endpoint rejected every
request identically — RTHK, the known-blocked control, included — so its
answer says nothing. Pressing play once per channel in a normal browser
remains the check.

SCMP publishes much of its channel as **Shorts** (vertical, `/shorts/`
URLs). They embed and play, letterboxed in the 16:9 card.

## Known limitation

**YouTube's feed does not carry duration.** Cards therefore do not show a
runtime, because we do not have one. Inventing or estimating it would
breach the absolute rule. If duration matters later it needs a legitimate
source, not a guess.
