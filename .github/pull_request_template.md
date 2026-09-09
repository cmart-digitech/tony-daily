## What this changes

<!-- One or two sentences. What is different after this merges, and why. -->

## How it was verified

<!-- What you actually ran or observed — not what you expect to be true.
     If you measured something, say what the numbers were. -->

## Checks

- [ ] `npm run lint && npm run typecheck && npm test && npm run build` all pass
- [ ] Ran it locally and looked at the result

## Rules this change keeps

Tick only what applies — see [CLAUDE.md](../CLAUDE.md).

- [ ] **No invented production data.** Missing data shows an honest empty or
      error state; any mock data is labelled and test-only.
- [ ] **New feed URLs were fetched and confirmed live** before committing.
- [ ] **Market data keeps its timestamp and entitlement label** — nothing
      delayed is presented as real-time.
- [ ] **AI output stays grounded** in retrieved sources, with citations that
      map to real articles; missing evidence is stated, not filled in.
- [ ] **No secrets committed.** Keys live in `.env.local`, which is gitignored.
- [ ] **Database calls stay async**, so the same code runs on local SQLite
      and hosted libSQL.

## Anything reviewers should know

<!-- Trade-offs, things you deliberately left out, follow-up worth doing. -->
