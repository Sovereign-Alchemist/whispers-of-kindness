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

## 2026-08-20 — The offer tag was looked at, and it is right

Pela confirmed the tag on the live site after the clearance fix. The bottom
tape sits clear of the closing line and crosses the torn edge below it.

**This is the entry the two above could not write.** Both of them end by
saying nobody had looked, because there is no browser on this machine and
every number in them is arithmetic against the alpha channel of
`images/torn-edge-mask.png`. That method located the fault correctly twice
and produced a value that turned out to be right, which is worth knowing the
next time something has to be positioned against that mask. It is still not
the same as seeing it, and the confirmation had to come from a person.

**Verified:** by eye, on `whispersofkindness.ca`, by Pela.

---

## 2026-08-20 — The bottom tape again: the gap was the fault, not the offset

The `bottom:7%` fix earlier today put the tape on the paper and put it
through the closing line of type at the same time. The follow-up is recorded
here because the first attempt was aimed at the wrong quantity.

**No offset could have worked.** Padding is a fixed pixel distance from the
last line to the box bottom. The tear is a fraction of the box, because
`mask-size` is `100% 100%`. At `padding-bottom:2.9rem` the closing line sat
46px above the box bottom and the tear sat about 38px above it, so the gap
between the words and the paper's edge was 8px and the tape was 24px tall.
Above the tear it hit the type. Below the type it hung off the paper, which
was the original fault. **Moving it was never going to resolve that**, and an
afternoon could have gone into tuning a number that had no solution.

**What changed.** `padding-bottom` on `.offertag-face` goes 2.9rem to 5rem,
lifting the words clear while the tape stays pinned to the tear by its
percentage. The strip goes 24px to 22px. `bottom:7%` is unchanged.

**A separate fault found in the same place, and it was already live.** The
narrow breakpoint set `padding-bottom:1.7rem`. On a phone the tag is
narrower, so the copy wraps into more lines, the box gets taller, and the
tear moves further up in real pixels while a rem of padding does not move at
all. At roughly 500px tall the closing line sat 27px above the box bottom
with the tear near 50px, meaning **the last line of type was rendering past
the edge of the paper, on nothing.** That had nothing to do with the tape and
was true before any of this. Now 5.4rem.

**Verified:** the geometry modelled across box heights of 340px to 700px for
both breakpoints. The tape clears the type and crosses the tear at its right
end in every case, including the 4.4px the right end gains from
`rotate(-7deg)` over a 72px strip. Desktop tightens to 4.6px of clearance
only at 700px tall, which this tag is not.

**One thing nearly shipped broken, and it is the second time.** The edit left
a stray `*/` with five lines of prose loose outside any comment, directly
above the `.offertag-tape-b` rule. CSS would have parsed that as declarations
and most likely discarded the rule it precedes, so the tape would have
reverted to the top strip's styling with no error anywhere. It was caught by
counting `/*` against `*/` and noticing the skew had gone from 3 to 2, not by
reading the diff, which looked fine. **The count is only meaningful against
HEAD's own skew of 3**, which comes from the two `accept="image/*"` and
`accept="audio/*"` attributes, and is not a real imbalance. A parity check
that walks the `<style>` block pairing openers to closers now confirms zero
stray or nested comments.

**Still not verified:** nobody has looked at the tag. This is arithmetic
against a measured edge on a machine with no browser.

---

## 2026-08-20 — Offer tag copy, the bottom tape, and the 15th in the submission record

Three changes to the offer tag beside the Send a recipe form, plus one fix
underneath it that the copy change exposed.

**Two bullets reworded.** "No membership needed, now or ever" became "No
membership needed to submit a recipe, now or ever", which says what the
membership is not needed *for*. "If that month's card is already printing,
yours is the next one" became "Same 15th cutoff as membership. Your card
follows whichever side you land on", which points at the rule already stated
on `/refunds` instead of describing a production detail.

**The bottom tape strip was not touching the paper, and now is.** It sat at
`bottom:-.5rem`, on the same reasoning that works for the top strip: a
negative offset crosses the box edge, so it crosses the sheet. The sheet is
not a box. It is `images/torn-edge-mask.png`, a photograph of Pela's own torn
paper, and its two ends are not symmetrical. Reading the alpha channel column
by column: the paper reaches within 2% of the box at the top, and stops
between 89.8% and 93.5% of the way down at the bottom. In the strip's own x
range, 68% to 88% across, it stops at about 90%. The tape was therefore
hanging roughly 24px clear underneath the paper with nothing behind it,
reading as a loose scrap. Now `bottom:7%`, a percentage rather than a rem
because `mask-size` is `100% 100%`, so the tear sits at a fixed fraction of
the box at every size and through both narrow breakpoints.

**The 15th was not actually implemented anywhere, and still is not, by
design.** The new bullet was checked against the code rather than assumed.
Nothing in `functions/` mentions a cutoff, a month, or a promotion: grep for
`15th`, `cutoff`, `promo`, `card_month`, `issue_month` and `getDate()` across
every function returns nothing. `submit.js` writes `date_submitted` and
`status: 'new'` and stops. No field records which card a submission earns.
That is correct for where this is: which card someone gets is Pela's decision,
made by eye from the review sheet, and `mailing` has no interface yet by
deliberate deferral. **So the copy does not contradict the code. It rests
entirely on one stored date being right.**

**That date was wrong for seven hours of every day.** `date_submitted` was
`new Date().toISOString().slice(0, 10)`, which is UTC. Vancouver is UTC-7 in
summer, so anything sent after 5pm local on the 15th was stamped the 16th. A
contributor sending a recipe on the evening of the deadline would have been
recorded as a day late, and under the new bullet would be told they had
missed that month's card. The error only ran one way, and it ran against the
contributor. Now `submissionDate()`, using `Intl.DateTimeFormat('en-CA', {
timeZone: 'America/Vancouver' })`, which emits `YYYY-MM-DD` directly.

**Verified:** the mask measured with `System.Drawing` `LockBits` over the
alpha channel, 800x587, threshold 128, sampled every 5% of width. The live
mask was downloaded from `whispersofkindness.ca` first and its SHA256 matched
the local file exactly, so the measurement is of what production actually
serves, not of a working copy. The live `.offertag-tape-b` rule was read back
off the deployed page and matched what was measured against.

**Not verified, and both worth knowing.** Nobody has *looked* at the tag. The
new offset is arithmetic against a measured edge, not a visual confirmation,
and there is no browser on this machine. If it still reads wrong, `bottom`
is the one number to turn, and the paper it has to meet is at 90% to 93.5%.
Separately, `Intl` with a named timezone needs full ICU in the runtime.
Netlify's Node 20 has it, but there is no Node here to prove it, and nothing
else in `functions/` uses `Intl`, so there is no working precedent in this
codebase either. **`submissionDate()` therefore falls back to the old UTC
line inside a `try`/`catch` and logs `submission-date-fallback`.** The worst
case is exactly the behaviour it replaced, because submission is the one path
in this project that must never fail. Check the function log after the next
real submission: if that string appears, the timezone fix is not in effect
and the 15th is still being judged in UTC.

---

## 2026-08-20 — Correction: the orphan alert went live inside the repricing merge

**The 2026-08-18 entry below says the orphan subscription alert was "built on
`chunk-orphan-subscription-alert`, not yet run against a deploy". The first
half is still true. The second half now reads as though the code is sitting
on a branch waiting. It is not. It has been live on production since
`6febdef` on 19 August, and it got there by accident.**

`chunk-domestic-repricing` was created with `git checkout -b` while HEAD was
still on `chunk-orphan-subscription-alert`, not on `main`. So the repricing
branch carried the webhook commit as its parent, and merging the repricing
carried it onto `main` and into production with it. Nobody decided that. The
repricing entry above does not mention it, because I did not know.

**What is actually live, therefore, is untested.** `alertOrphanSubscription`
now runs on both invoice handlers on the production webhook.
`tools/Test-OrphanSubscriptionAlert.ps1` was written for it and has still
never been run. The risk is bounded and worth stating precisely rather than
either dismissing or dramatising:

- Both handlers still answer 200 and still write nothing on that branch, as
  they always did. The database behaviour is unchanged.
- `sendAlert` cannot throw. A Resend failure returns a result object rather
  than an exception, so it cannot turn a handled invoice into a 500 that
  Stripe retries.
- The new code only runs when an invoice arrives for a subscription no
  member row holds, which is the rare case it exists to catch.
- What is genuinely unproven is whether the email sends, whether it is
  legible, and whether `handleRenewal` still behaves now that its config
  object carries three more keys.

Running the harness against production settles all four in about a minute.
It posts two signed events naming a fake subscription and writes nothing.

**The process lesson, which is the reusable part.** `git checkout -b` from
wherever HEAD happens to be is how unrelated work rides into a merge
unnoticed. Branch from `main` explicitly. A branch that carries somebody
else's commit looks identical to one that does not until you go looking.

> Verified 2026-08-20. `git merge-base --is-ancestor` confirms the orphan
> alert commit is an ancestor of `main`, `git log main..branch` is empty, and
> `git show main:functions/stripe-webhook.js` contains
> `alertOrphanSubscription` six times. The ancestry path names `6febdef`, the
> repricing merge, as the commit that carried it. Not verified: any of the
> behaviour, which is the whole point of this entry.

---

## 2026-08-19 — Domestic repricing, shipped and proven at every price point

**Done, live, and verified against Stripe rather than against the source.**

The domestic Mailing tier is repriced. Founding is $45.00, $85.00 and $165.00.
Regular is $55.00, $95.00 and $175.00. International Digital did not change
and was confirmed not to have changed.

Six new live prices were created by `tools/Migrate-StripePricesToLive.ps1` and
the six they replace are archived. Archiving cannot cancel anything: every
existing subscription keeps billing at the price it was created with, so
founding members from before today still pay $39 and still pay less than the
current rate, which is the promise the site makes.

**`stripe-webhook.js` now carries twelve domestic prices, not six**, and that
asymmetry is deliberate. `create-checkout.js` sells only the current six.
`PRICE_FACTS` has to recognise whatever a real person is actually on, and
every member who joined before today renews against an archived id for as
long as their subscription runs. Dropping them would send each of those
renewals through the metadata fallback to be logged as an unknown price, on
every renewal, for years.

**The per card framing is gone from this tier.** No `$X a card` figure
survives anywhere a reader can see. `membership-status.js` no longer sends an
`each` field, the page script no longer reads one, the `.term-each` spans are
removed rather than emptied, and `perCard()` is deleted rather than left
unused. The digital tier keeps its per recipe wording untouched, on purpose.

Mailing mechanics were added to `/refunds` under their own subhead: October
2026 start, the 15th as the cutoff, cards in the third week, video in the
fourth, billing on the subscriber's own signup date.

**There was an outage, and it belongs in the record.** Creating the new prices
archives the old ones, and an archived price cannot start a subscription, so
domestic checkout answered 502 from the moment the migration ran until this
merge deployed. It was observed as a 502 on production and confirmed restored
at 09:34. International was unaffected throughout, because its three ids never
changed. This is inherent to repricing in two steps and is the argument for
running the migration and merging the code in one sitting rather than across a
break.

**This also proves the entry below.** The 18 August entry records the
international `rate` metadata fix as merged without being run. It has now been
run. All three international terms came back with no `rate` key at all, which
is what that change was for. That entry's "NOT verified" line is superseded
here rather than edited there.

> Verified 2026-08-19 by `tools/Test-CheckoutMetadata.ps1` against
> `https://whispersofkindness.ca`, which created six real Checkout Sessions in
> live mode and read every one back out of Stripe. All six price points passed
> on amount, currency and renewal interval, and each domestic amount was
> compared against what `membership-status` displays, which is the mismatch
> that endpoint exists to prevent. The three international amounts passed
> unchanged as the regression half. Separately confirmed without a key: the
> served page, the served JSON-LD and `membership-status` all quote the same
> three domestic totals, and stripping comments and scripts from the served
> HTML leaves zero priced per-card phrases. **NOT proven: the founding cap
> switching at member 100.** That needs 100 member rows. The run reports which
> rate is live, and it was `founding` with `degraded: false`, so the result
> should be read as covering the founding prices only. The regular prices are
> verified as Stripe objects and have not been verified as the thing checkout
> selects, because nothing can make it select them yet.

---

## 2026-08-18 — An invoice for a subscription nobody holds now emails somebody

**Built on `chunk-orphan-subscription-alert`. Not yet run against a deploy.**

Both invoice handlers already found this case and both answered it with a log
line. Nothing reads a log unprompted, so a person being charged while absent
from the archive produced no signal at all, on every renewal, forever.

They now send one email and create nothing:

- `functions/stripe-webhook.js`, `alertOrphanSubscription`, one message used by
  both call sites so they cannot drift apart
- `handleRenewal`, the `renewal-unknown-subscription` branch
- `handlePaymentFailure`, the `failure-unknown-subscription` branch
- the `invoice.paid` dispatch now passes `RESEND_KEY`, `ALERT_FROM` and
  `ALERT_TO`, which it never had, so the renewal handler could not have sent
  mail before this change even if it had wanted to

Both branches still answer 200 and still write nothing. The response body
gained `alerted` and `alert_reason`, so Stripe's own delivery log records
whether the email went.

**No self-healing member creation, decided deliberately.** A domestic
membership needs a postal address to be fulfillable and an invoice does not
carry one. A member row invented at renewal time would look complete in every
list and query while being unmailable, which is worse than the gap it replaces,
because the gap is at least visible once somebody looks. One policy for both
tiers rather than two behaviours to remember.

The email names the subscription and invoice, and tells the reader to confirm
from the SQL editor rather than the Table Editor. That instruction is there
because the Table Editor served a stale view twice on 17 August 2026 and would
otherwise make this alert look like a false alarm.

**Two other things were checked and found already done**, both listed as open
in the handoff that scoped this work:

- Omitting the invalid `rate` metadata for international. Merged earlier the
  same day in `be06084`, released in `aae7ecf`.
- `shipping_address_collection` on the domestic tier. It has been there all
  along, `functions/create-checkout.js:333-337`, restricted by
  `SHIP_TO = ['CA','US']` at line 119. Stripe already blocks a domestic
  checkout from completing without an address.

**Found while working, not fixed:** `tools/Test-RenewalWebhook.ps1` says the
function "refuses live mode events on purpose" and would answer 202. No
`livemode` check exists anywhere in `stripe-webhook.js`. The comment is wrong.
Nothing depends on it, and no harness relies on the behaviour it describes.

> Verified 2026-08-18 by reading the diff and by counting brace and paren
> balance across the file, which came out even. That is weak evidence rather
> than proof, since the count includes brackets inside strings and comments,
> and there is no JavaScript runtime on this machine to parse it properly.
> **NOT verified: any of the behaviour.** `tools/Test-OrphanSubscriptionAlert.ps1`
> was written for it. It posts two signed events at a deploy, one
> `invoice.paid` and one `invoice.payment_failed`, both naming a fake
> subscription that holds no member, and checks for a 200, the
> unknown-subscription branch, and an `alerted` field that the old code does
> not emit. It writes nothing to the database, because both handlers return
> before any write. It had not been run when this entry was written.

---

## 2026-08-18 — First payment webhook proven live, and the rate metadata fixed

**The `checkout.session.completed` path has now run for a real paying customer,
and it worked.** This is the first time. Every previous webhook test signed its
own event on Pela's machine and posted it straight at Netlify, and all three
harnesses cover only `invoice.paid` and `invoice.payment_failed`. The event that
turns a payment into a member had never been exercised by anything, for any
tier.

A live International Digital subscription was created on 2026-08-17. Stripe's
delivery log shows the event delivered and answered 200, and `member` row 208
was written, with a timestamp matching the delivery. That row exercises the
international branch specifically: `PRICE_FACTS` resolved the price to
`tier: 'mailing_intl'`, `rate: null`, `format: 'digital'`, and
`shipping_address` was correctly left null because the tier is not `'mailing'`
(`functions/stripe-webhook.js:1097`).

**The investigation that found this was chasing a row that was never missing.**
Supabase's Table Editor served a stale cached view and showed no row. The same
thing had happened earlier the same night on `contributor`. Recorded here
because the false negative is the reusable lesson: the Table Editor is not a
witness for whether a row exists, and absence should be confirmed from the SQL
editor or a REST call before anything is built on it.

**Fixed on this branch.** `functions/create-checkout.js` set
`rate = 'standard'` for the international tier, a fourth value in a vocabulary
of three. `member.rate` is `CHECK (rate IS NULL OR rate IN ('founding',
'standing'))` (`supabase/schema.sql:227`). It now sets `null` and omits the
metadata key rather than writing the literal string `"null"`, which is what
`URLSearchParams` does with a null.

Nothing was ever broken by it. The webhook takes the price id as authoritative
and reads `metadata.rate` only in its unknown-price fallback, where the
international branch returns `null` before the field is read at all
(`stripe-webhook.js:1061`). Row 208 was written correctly while the metadata
still said `standard`. This closes a trap rather than a fault.

**Existing international subscriptions in Stripe still carry
`rate: "standard"` in their metadata.** Not backfilled, deliberately. Nothing
reads the field, and rewriting metadata on a live payment record buys nothing.

**Still open, and the next piece of work:** a checkout that completes without
being paid immediately is never recovered. The handler answers 200 and writes
nothing when `payment_status` is not `paid`
(`stripe-webhook.js:1040`), and when the payment later settles, `handleRenewal`
finds no member for the subscription, logs `renewal-unknown-subscription` and
answers 200 (`stripe-webhook.js:451-458`). `checkout.session.completed` is the
only event that can create a member, so a membership missed there stays missed
while Stripe bills it forever.

> Verified 2026-08-18. The live delivery, the 200 and row 208 were read by Pela
> in the Stripe dashboard and Supabase and reported back; I did not see them, as
> this machine has no browser tooling and no database key. The code claims above
> were verified by reading the named files and line numbers, and the schema
> constraint by reading `supabase/schema.sql`. **NOT yet verified: the fix
> itself.** There is no JavaScript runtime on this machine, so
> `tools/Test-CheckoutMetadata.ps1` was written to create a real Checkout
> Session against the deploy preview and read its metadata back out of Stripe.
> **It had not been run at the time this was merged, and merging did not wait
> for it.** That was a deliberate call, taken on the strength of the code
> reading and a live smoke test confirming the deployed function still creates
> an international session. Running the script is what would turn the fix from
> reasoned to proven, and until a later entry here says it passed, it has not
> been.

---

## 2026-08-17 — Site favicon, render confirmed

**Closes the one gap left open by the entry below.** The favicon renders. Pela
checked a browser tab and confirmed the seal shows in place of the default page
icon.

Nothing changed in the code. This entry exists only to record that the check
happened, because the entry below says in writing that it had not, and an
unverified claim left standing reads as a verified one after a few weeks.

> Verified 2026-08-17 by Pela, in a browser, reported back. Not verified by me:
> I had no browser tooling in this session. Also still unverified, and a
> separate surface: how `apple-touch-icon.png` looks as an iOS home screen tile
> and how the manifest icons look on Android. The tab is the common case and it
> is confirmed; the installed-icon case has not been looked at by anyone yet.

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
