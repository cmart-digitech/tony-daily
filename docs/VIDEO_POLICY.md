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

## One event, one story

A video report and a written report of the same event are **two renditions
of one story**, not two cards. Clustering treats them accordingly, so the
feed does not show the same news twice because it arrived in two formats.

## Video is not a citable source

The AI answers only from text it actually retrieved. **A video we cannot
read is not evidence**, so video never enters the grounding context and is
never cited.

The description text that accompanies a video is publisher-written
promotional copy, not reporting — it may be indexed for search, but it is
not treated as a factual source.

Officially published, licensed captions could change this. That is a
separate decision requiring its own verification, never an assumption.

## Sources

Every channel is verified before it is committed: the channel id resolved
from its canonical URL, the feed fetched, and entries confirmed present.
The same rule as every RSS feed in the registry — **never a guessed URL**.

Verified 12 September 2026 (entry counts at time of check):

| Source | Channel | Entries |
|---|---|---|
| RTHK News 香港電台新聞 | `UCwuTCNZqSMfaiP63cGDb8LQ` | 15 |
| TVB News 無綫新聞 | `UC_ifDTtFAcsj-wJ5JfM27CQ` | 15 |
| Now News now新聞 | `UCnwaU7j34C92ywMHXJahHRA` | 15 |
| SCMP | `UC4SUWizzKc1tptprBkWjX2Q` | 15 |
| SCMP TV | `UCezZxnyyvF9Yv3qqfM1Gn7A` | 12 |
| BBC News | `UC16niRr50-MSBwiO3YDb3RA` | 15 |
| Reuters | `UChqUTb7kYRX8-EiaN3XFrSQ` | 15 |
| Bloomberg Markets | `UCIALMKvObZNtJ6AmdCLP7Lg` | 15 |
| Dezeen | `UCsWG9ANbrmgR0z-eFk_A3YQ` | 15 |
| ArchDaily | `UC3r_kdJocuqtDYb2GgM42Ng` | 15 |

Rejected during verification, and why:

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

**Only RTHK has been verified so far.** The other nine are assumed
embeddable until someone watches one. A channel found showing the block
message gets flipped to `embeddable: false` — it is a one-line change.

## Known limitation

**YouTube's feed does not carry duration.** Cards therefore do not show a
runtime, because we do not have one. Inventing or estimating it would
breach the absolute rule. If duration matters later it needs a legitimate
source, not a guess.
