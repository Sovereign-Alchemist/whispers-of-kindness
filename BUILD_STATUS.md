# BUILD STATUS

The single source of truth for what is actually built in this repo, versus what
is still open.

**How to use this file.** Check it before answering any question about whether
something is built. Do not answer from conversation memory, and do not answer
from a code comment: a comment describes what its author intended, which is not
the same as what the code does now, and not the same as whether it ever ran.

**How to write in it.** Append a new dated entry at the top. Never edit or delete
an old entry, even a wrong one. This file only grows. If something turns out to
have been recorded wrongly, the correction is a new entry saying so.

**Every entry needs three things:** a real date, a plain statement of what is done
or still open, and one line on how that was verified. "Confirmed by grep across
`public/`" and "not yet checked against live code" are both acceptable. Assuming
is not.

Dates below are the date the work landed. The verification line records when the
claim was last checked and how.

---

## 2026-08-17 — Site favicon

**Built and wired. Not yet confirmed in a browser tab.**

Supersedes the "Open — site favicon" entry at the foot of this file, which was
true when written.

Seven files at `public/` root, alongside `robots.txt` and `sitemap.xml`, not in
`public/images/`, which holds content photographs:

| file | size |
|---|---|
| `favicon.ico` | 16, 32, 48 in one file, PNG payloads |
| `favicon-16x16.png` | 16x16 |
| `favicon-32x32.png` | 32x32 |
| `apple-touch-icon.png` | 180x180, opaque |
| `favicon-192x192.png` | 192x192 |
| `favicon-512x512.png` | 512x512 |
| `site.webmanifest` | references the 192 and 512 |

All cut from `Downloads/wok-wax-seal.png`, 390x390 and already square, so every
size is a straight resize with no crop. **The master lives in Downloads and is
not in the repo**, so regenerating these later means finding it again or
exporting a new one.

`apple-touch-icon.png` is the one exception to "straight resize": it is
flattened onto paper `#F0EBDE` and saved as 24bpp with no alpha channel,
because iOS composites home screen icons onto black and a transparent seal
would land on a black tile.

Six link tags added to the head of all three pages, identical in each: `.ico`,
the two PNG sizes, apple-touch-icon, the manifest, and `theme-color` at olive
`#7A8352`.

`favicon-512x512.png` is a 31% upscale from the 390px master and is therefore
slightly soft. It is only used by Android home screens. A larger master would
be sharper.

> Verified 2026-08-17. Every PNG read back and measured at its intended
> dimensions. `favicon.ico` parsed from its raw bytes: type 1, three entries at
> 16/32/48, each payload carrying the PNG signature, offsets and lengths
> summing exactly to the file size. Manifest parses as JSON with both icons.
> All seven assets return 200 over a local server and all six tags appear
> exactly once per page. `apple-touch-icon.png` confirmed opaque by sampling
> pixels: corner and edge are `#F0EBDE` at A=255, centre still carries the
> seal. **NOT verified: that a browser tab actually shows the seal.** No
> browser tooling was available in the session that built this, so the render
> check was left to Pela and has not been reported back as of this entry.

---

## 2026-08-17 — GA4 and the consent gate

**Done, tested, live.**

Google Analytics 4, Measurement ID `G-1855141C8G`, on all three public pages,
loading only after a reader agrees. `loadGA4()` builds and appends the gtag.js
script; only the exact stored string `given` ever reaches it. `declined` is
stored and remembered as firmly as a yes. A `localStorage` read that throws
counts as not yet asked, not as consent. The notice is a fixed bottom-right
postage stamp with `Understood` and a quiet `No thanks`.

There is no shared head template, so styles, markup and script are duplicated
across `public/index.html`, `public/refunds.html` and `public/thank-you.html`.
The Measurement ID appears once per file, as `GA_ID`.

The class is `consent-stamp`, not `stamp`. `.stamp` is the site's own ephemera
class, used by the hero's "now open" tag and the thank-you page's "first class"
tag. Naming the notice `.stamp` re-styled both of them and pinned them to the
corner. That is fixed, and the site's own rules are byte-identical to what they
were before.

Merged as `15d86a0`, pushed to `main`, which auto-deploys via Netlify.

> Verified 2026-08-17. Code confirmed by grep across `public/`: zero live
> `<script src>` to googletagmanager, one `class="consent-stamp"` per page, both
> button ids present, all three blocks byte-identical by sha256. Browser
> behaviour tested by Pela, not by me: decline fires no request and stores
> `declined`, accept initialises GA4 and stores `given`, both ephemera tags
> render correctly. Deploy confirmed by fetching the live page and finding
> "Kept, not sold" in it.

---

## 2026-08-17 — Mailing card pricing

**Done. $13 founding, $15 standard.** Not the older $11/$13.

`public/index.html:1650`–1711, the tier titled "The Mailing". Founding rate $13
a card at lines 1644, 1669, 1678 and 1692; standard rate $15 at line 1692. Term
totals are $39.00 for 3 months, $78.00 for 6, $148.20 for a year.

The `$11` figures at lines 1731–1755 belong to the **International Digital**
tier, a separate live tier. They are not stale Mailing prices.

The tier cards have no front and back. The five flip cards were replaced by
single-face panels on 2026-08-09 (`563eab2`), and the flip handler was deleted
with them.

Only the founding $13 is hardcoded. `functions/membership-status.js` rewrites the
three domestic prices and the JSON-LD offers at runtime once founding places run
out, and `functions/create-checkout.js` counts again independently at purchase,
which is what actually sets the price. The `$15` in the prose at line 1692 is
the one place the standard rate is written by hand and is not fetched.

> Verified 2026-08-17 by grep across `public/` for every `$` figure, with the
> per-term totals divided back against the per-card rate: 39÷3, 78÷6, 33÷3,
> 66÷6 all check out. `refunds.html` and `thank-you.html` carry no prices.
> NOT verified against Stripe: whether $13/$15 matches the live price objects
> was not checked and is not visible from the markup.

---

## 2026-08-15 — Failed-renewal webhook handling

**Built and merged. Test harnesses exist. No record that they were ever run.**

`functions/stripe-webhook.js:1005` dispatches `invoice.payment_failed` to
`handlePaymentFailure` at line 595. That handler:

- resolves the subscription across both Stripe shapes, `invoice.subscription`
  and `invoice.parent.subscription_details` (`subscriptionIdFrom`, line 384)
- guards against out-of-order delivery by checking `member_renewal` for the
  invoice id before acting (line 664), so a stale failure cannot drag a
  recovered member back to `past_due`
- writes one row per invoice to `member_payment_failure`, using a 409 from the
  unique index as the duplicate guard (line 682)
- sets `subscription_status` to `past_due`, held back when already paid, already
  cancelled, or already `past_due` (line 731)
- sends one Resend email per invoice and stamps `alerted_at` in its own try, so
  a failed stamp cannot 500 the delivery and cause a retry loop (line 797)

Schema is present: `supabase/013-failed-payment.sql` creates the table and unique
index, `014-payment-failure-alert.sql` adds `alerted_at`. Both end with
`NOTIFY pgrst, 'reload schema';`.

Merged in `664e30d` (2026-08-12) and `ed290e7` (2026-08-15), both contained in
`origin/main`. No unmerged branch exists, local or remote.

**Open, and named in the code itself** (`stripe-webhook.js:1292`):
`customer.subscription.deleted` is not listened for, so a membership Stripe has
given up on stays `past_due` indefinitely rather than becoming `cancelled`.

> Verified 2026-08-17 by reading the handler and the dispatch, not by running
> anything. `git branch -a --contains` confirms both commits are on
> `origin/main`. Three harnesses exist outside the repo:
> `tools/Test-FailedPaymentWebhook.ps1`, `tools/Test-PaymentFailureAlert.ps1`,
> `tools/Test-RenewalWebhook.ps1`. They post signed events at the deployed
> function and cover the hard cases including stale delivery. None writes a
> transcript or log, so **whether any of them was ever run cannot be determined
> from disk.** Also unverified: whether the Stripe endpoint is subscribed to
> `invoice.payment_failed`, whether `RESEND_API_KEY` is set in Netlify, and
> whether migrations 013 and 014 have been applied to the live database.

---

## 2026-08-15 — Notion to Supabase push script

**Built. Dry-run by default. No record of a committed run.**

`tools/Push-NotionToSupabase.ps1`, 1033 lines. Reads every page in the Notion
Recipe Pipeline and writes four fields back to Supabase. It is the other half of
`functions/notion-pull.js`, which only ever creates Notion pages and never
updates them.

Run by hand, no webhook and no schedule, same rhythm as `Export-Database.ps1`.
Writes nothing without `-Commit`. Both keys are asked for per run and neither is
stored. Its header records that the status vocabularies on the two sides do not
line up and were checked against `supabase/schema.sql` rather than assumed.

> Verified 2026-08-17 by reading the script header and confirming the file
> exists at 1033 lines, last modified 2026-08-15. NOT verified: whether it has
> ever been run with `-Commit`, and whether the field mapping is correct against
> the live Notion database.

---

## 2026-08-15 — STORY_PROMPTS sixth question

**Done, and the sixth question is deliberately empty. Not a pending cleanup.**

`functions/notion-pull.js:377`–423. Six prompts. The sixth, "Is there anything
about them you'd want remembered?", has `from: function () { return []; }` and
carries a comment explaining that nothing fills it because the submission form
never asks it: `submit.js` reads nineteen fields off the body and none is this
question, so there is no column it could have been stored in. It writes the
heading and an empty space on purpose, so Pela has a question to answer rather
than a heading that is silently absent.

Landed in `b647793`.

> Verified 2026-08-17 by reading the array and grepping lines 360–500 for
> `TODO`, `FIXME`, `legacy`, `deprecated` and `remove`: no cleanup markers, no
> dead code, no orphaned seventh entry. The empty sixth entry is the finished
> state, not an unfinished one.

---

## 2026-08-12 — Contributor to member link

**Done, and no longer one-directional.**

Both halves exist:

- **Backward**, `functions/stripe-webhook.js:1192`. Runs when somebody becomes a
  paying member, finds recipes they submitted before they paid, sets `member_id`
  on those contributor rows.
- **Forward**, `functions/submit.js:366`–403, step 5. Runs at submission time,
  so somebody who was already a member and contributes afterwards is linked
  immediately rather than never.

Both match the same way, `ilike` to narrow then an exact comparison in
JavaScript to settle it, so the two directions agree about who is the same
person. The comment at `stripe-webhook.js:1281` states the rule: change the
matching in one and change it in the other.

Landed in `592d4c9`, "Link a recipe to its member at submission, not only in
hindsight".

> Verified 2026-08-17 by grepping `member_id` and `contributor_id` across
> `functions/` and reading both call sites. NOT verified: whether the two
> matching implementations are still identical in behaviour, which would need
> them read side by side.

---

## Open — site favicon

**Not built.**

No `<link rel="icon">`, `rel="shortcut icon"`, `apple-touch-icon` or `manifest`
in any of the three pages. No `favicon.ico`, `.png`, `.svg` or `.webmanifest`
anywhere in `public/`. No commit in the repo's whole history mentions a favicon.

Browsers will show their default page icon on every tab.

> Verified 2026-08-17 by grep for icon link tags across `public/*.html`, a
> listing of `public/`, and `git log --all -i --grep="favicon"`. All three came
> back empty.
