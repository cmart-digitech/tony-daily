# Google Drive — The Daily Vault (design, not yet built)

Status: **deferred to its own increment** (brief P6). This document fixes
the design so implementation cannot drift into over-broad access.

## Consent model (brief §5, §28)
- Google **Sign-In** (already implemented) requests identity only:
  `openid email profile`. It never asks for Drive.
- Drive access is a second, deliberate consent behind a **Connect Google
  Drive** action, using least privilege: scope `drive.file` (only files the
  app creates or the user picks) plus Google Picker for selection. Full-Drive
  scope is not requested.

## Planned capabilities
- **Exports**: Daily Brief (Markdown/PDF), audio-brief transcripts, saved
  research — into a `The Daily/` folder created only after connection.
- **Imports**: files Tony picks (PDF, Docs, text, Markdown) into a private
  research library, retrievable by Ask Tony with provenance that clearly
  separates *Tony's private file* from *external news sources* (brief §30,
  §50). Private-file claims and news claims are never merged into one
  unattributed fact.

## Security (brief §31)
- OAuth refresh tokens encrypted at rest (AUTH_SECRET-derived key), never
  sent to the browser.
- **Disconnect Google Drive** removes stored tokens and stops access; it
  never deletes Tony's Drive files.

## Prerequisites
The same Google Cloud OAuth client as Sign-In, with the Drive API enabled
and the Picker API key added. No additional cost at personal scale; scopes
beyond `drive.file` would trigger Google verification review and are to be
avoided.
