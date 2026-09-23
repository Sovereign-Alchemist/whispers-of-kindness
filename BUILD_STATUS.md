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

## 2026-09-23 — The batch is committed, pushed and live

**Supersedes the "NOT yet committed, NOT yet deployed" line in the two entries
below.** Both were true when written. Neither is now.

Commit `746a2c3` on `main`, pushed to `origin`, auto-deployed by Netlify.
It carries the story page, the FAQ contributor cluster, `ld-organization`, the
photograph swap, the Lois Sagle vignette, the Instagram footer link and the
removal of all three parent-brand references.

**Two data fixes outside the repo, made the same day.**

`provenance.place_of_origin` for `recipe-0005` corrected from `Ottawa, BC`
to `Ottawa, Ontario`, matching the contributor's own submitted story. Nothing
public had ever shown the wrong value, because the vignette says "Ottawa" with
no province. The local archive was checked and holds no copy of this submission
yet, so there was nothing on disk to correct alongside it.

**`CLAUDE.md` was rewritten where it caused the `talked_to_them` misread.**
The sentence "A database value is not the same as a person having been asked"
is gone, and the section now states outright which fields are the gate, that
they are captured at submission with no waiting period, that they work the same
way for form, email and phone submissions, and that the three `talked_*`
columns are explicitly NOT a gate and a `null` in them means nothing was
logged rather than that consent is missing. The correction is dated in the file
and says what went wrong. Saving the correction to a session memory was not
treated as sufficient, because a fresh session reads `CLAUDE.md` and would
have been misled by it again.

> **Verified live 2026-09-23, against https://whispersofkindness.ca, after the
> deploy finished.** `/`, `/about`, `/about.html`, `/privacy`,
> `/refunds`, `/sitemap.xml` and `/images/balcony-portrait.jpg` all return
> 200. Zero occurrences of either banned brand term on any of the five public
> pages, thank-you included. `ld-organization` present on the four indexable
> pages and absent from `thank-you.html`; every JSON-LD block on every page
> parses, two on the front page and one elsewhere; `sameAs` carries the three
> expected profiles. The teaser link resolves to `/about`, all seven
> `faq-contribute-*` anchors are present, the footer shows Instagram, YouTube
> and Pinterest and an "Our story" link, the sitemap lists four URLs including
> `/about`, and the front page now references `balcony-portrait.jpg` with no
> reference to `blank-card.jpg` anywhere. `/about` carries the measurement
> ID and zero unconditional `googletagmanager` `<script src>` tags.
>
> **STILL NOT verified, and unchanged by the deploy:** that any of it renders
> correctly in a browser. No browser tooling was available in this session.
> Everything above is fetched markup, not a rendered page. The photograph swap
> and the `.vignette` rule in particular have been reasoned about from the CSS
> and never looked at.
>
> **Still open, deliberately left:** `public/images/blank-card.jpg` is
> committed and referenced by nothing.

---

## 2026-09-23 — CORRECTION: talked_to_them is not a permission gate, and a testimonial was written after all

**This corrects the entry "Contributor testimonials: not written, and why", further
down, written earlier the same day. That entry is left exactly as it was, per this
file's rule. Its reasoning about permission was wrong.**

**The misread.** `recipe.talked_to_them`, `talked_how` and `talked_note` were
treated as a gate on whether a contributor's story could be used publicly. They are
not, and never were, for any submission channel. They log that a contact happened,
which is a real internal purpose, particularly for recipes that arrive by email or by
phone rather than through the form. They say nothing about publishability.

**The actual gate, confirmed by Pela against production and true regardless of how a
recipe arrives**, is on the `contributor` table: `permission_status`,
`adaptation_permission` and `video_consideration_consent`, each
`pending` / `granted` / `declined` / `withdrawn`, **captured at submission
time**. There is no waiting period after submission. Consent is the tick, and the tick
is recorded when it is made.

**Decision: the three `talked_*` columns stay.** No migration. They are simply never
to be read as a usability gate again.

**Why this matters beyond one testimonial.** The earlier entry used a null
`talked_to_them` to argue that a contributor with all three permissions `granted`
was not usable. That reasoning would have blocked every email and phone submission in
the archive indefinitely, since those will routinely have permissions recorded and no
form-driven conversation logged. CLAUDE.md's own framing, that "a database value is
not the same as a person having been asked", is about internal diligence. It is not a
publishing rule, and it was read as one.

**So the testimonial was written.** `recipe-0005`, Lois Sagle's Christmas cake,
submitted 23 September 2026 by her daughter Ana-La-Rai Sagle, Vancouver Island.
`permission_status`, `adaptation_permission` and `video_consideration_consent` all
`granted`; `original_cook_public` true; `anonymous` false;
`name_display` "Ana-La-Rai Sagle".

One vignette, not three, on `about.html`, between "What we are actually gathering"
and "What arrives". Set as a `.vignette` note ruled off down the left edge rather
than as a testimonial card, because this site has no testimonial pattern and a review
panel would be the one corporate object on a page made of paper.

**Every detail in it is out of `provenance.remembered_story`** and nothing is added:
1953, the move to Ottawa for a medical internship, the bus stop, the lifelong
friendship, the nickname Red, the recipe of unknown origin, the more-than-doubled
batch for two households, the bathtub, and the contributor's own insistence that it
was a clean one.

**The friend is named twice in the submitted story, nickname and first name.** Only
the nickname is on the page. She is a third party who never filled in a form, and the
nickname carries the warmth without identifying her. The first name is in the record
if it is ever wanted.

**A data-entry slip worth knowing about, not fixed here.**
`provenance.place_of_origin` for this recipe reads `Ottawa, BC`. The contributor's
own story says Ottawa, Ontario. The page says "Ottawa" and no province, so nothing
wrong is published, but the field is wrong in the database and nothing in this session
touched it.

**The FAQ was re-checked and deliberately left as shipped.** None of the five open
questions in the contributor cluster came from this misread. They are about the card
after the promotion ends, the return of posted originals, turnaround time, contributor
payment and the exact printed credit format. The `faq-contribute-permission` answer
already describes the four permission boxes as the thing that governs use, which is
correct under the clarified rule, and `faq-contribute-chosen` never mentioned a
conversation. No edit was needed and none was made.

**Instagram added to the footer.** `instagram.com/wofk_thecherishedtable/`, placed first,
ahead of the YouTube and Pinterest links that were already there. Those two keep the
order they had. The footer therefore reads Instagram, YouTube, Pinterest while the
`sameAs` array reads Instagram, Pinterest, YouTube. That mismatch is cosmetic and was
left alone rather than reordering live markup for it. The three `.fsocial` blocks were two links and are now three,
byte-identical across `index`, `about`, `privacy` and `refunds`. The share link
Pela supplied carried a `?stkn=` parameter, which is a personal share token rather
than part of the profile address; it is not in the markup, on any page, in any form.

> **Verified 2026-09-23.** Permission fields, `original_cook_public`, `anonymous`
> and the full `remembered_story` read directly from `fulnenhnycaeyzrhplch`, not
> from the earlier summary. `.fsocial` identical across the four pages by sha256.
> Grep for `stkn=` across `public/` returns nothing. Re-ran the full check script:
> all JSON-LD parses, no banned brand terms, every internal link resolves, tag balance
> holds, no em dashes in new copy.
>
> **Still NOT verified:** that any of this renders in a browser. Still no browser
> tooling. The `.vignette` rule in particular has been reasoned about and not looked
> at.

---

## 2026-09-23 — Story page, contributor FAQ, Organization schema, photograph swap, and two brand-rule breaches removed

**Done and verified locally. NOT yet committed, NOT yet deployed.** Everything
below is in the working tree only. Nothing in this entry has been seen by a
browser, because no browser tooling was available in the session that built it.

**A brand rule was set the same day and two live pages were breaking it.** The
rule: the public site must never name Sovereign Alchemist or The Heirloom
Archive. See the 23 September Activity Log entry "Brand boundary clarified".
Three breaches were live at the time, all of them shipped months earlier:

- `public/index.html`, the merchant JSON-LD, carried
  `"parentOrganization": { "@type": "Organization", "name": "Sovereign Alchemist" }`.
  Removed. This was machine-readable identity, handed to Google on every crawl.
- `public/index.html`, the how-it-works kicker, read `the Heirloom Archive`.
  Now reads `the monthly card`.
- `public/index.html`, `privacy.html` and `refunds.html` each closed the
  footer with `a Sovereign Alchemist project`. Removed from all three, and not
  added to `about.html`. The `.fsa` CSS rule is left in place in all four
  files, unused, because deleting it is churn in four copies of a stylesheet
  that has no shared source.

**No replacement comment was left where any of them stood.** An HTML comment is
public, and a comment saying which brand name was taken out is the brand name,
still on the page. The reason lives here instead, outside `public/`.

**New page: `public/about.html`, at /about.** The front page's story letter was
seventeen paragraphs and was the longest thing on a page that also sells a
membership, takes a recipe and answers questions. It is now a seven paragraph
teaser ending in a link, and the long account lives on its own page, expanded
rather than moved: new sections on why recipes specifically carry this record,
on what the back of the card is for, and a closing on what the archive becomes
as it grows. No unbuilt feature is named in that closing, deliberately.

Cloned from `privacy.html`, which cloned from `refunds.html`. Header, footer,
consent stamp and GA4 loader are byte-identical to it by sha256. Two CSS rules
are new on that page, `.sheet .opening` and `.closing-line`, both copied from
values already on the front page rather than invented.

**New: `ld-organization`, a second JSON-LD block, sitewide.** name, url, logo,
description, email and sameAs to Instagram, Pinterest and YouTube. Kept separate
from `ld-membership` on purpose: that graph is rewritten in the browser when
the founding rate changes, and an identity record should not sit inside
something a price rewrite touches. Both carry
`https://whispersofkindness.ca/#organization` as `@id`, so a consumer merges
them and the Product's `brand` reference still resolves to the full record.
Shared properties are written identically in both. Edit one, edit the other.

It is on `index.html`, `about.html`, `privacy.html` and `refunds.html`, and
byte-identical across all four. `thank-you.html` is left out: it carries
noindex, and structured data on a page asking not to be indexed is weight for
nobody.

`logo` points at `/favicon-512x512.png`, the wax seal, a real file already on
the site. All three `sameAs` URLs were opened before being listed. The Instagram
one, `instagram.com/wofk_thecherishedtable/`, was not linked anywhere on the
site before this and still is not in the footer, which carries only YouTube and
Pinterest. That mismatch is deliberate for now and worth a decision.

**New: a contributor cluster in the FAQ**, seven questions under a second
heading, "If you are sending a recipe". The four existing questions all answer
somebody deciding whether to join. Nothing answered somebody deciding whether to
send a recipe.

**Every answer restates something already on the page** and was written from the
form's own labels and hints, the promotion tag, the how-it-works cards and the
thank-you panel. Nothing in it is a new policy. Five things were deliberately
left unanswered because the site does not say and an invented answer would
become the policy by default: whether a contributor gets a card once the
promotion ends, whether posted originals come back, how long the wait is,
whether contributors are paid, and exactly how credit is printed. Those went
back to Pela as open questions.

**Photograph swapped in the invitation section.** `images/blank-card.jpg`
(1100x1650), a colour flat lay of a blank sheet and fresh tomatoes, replaced by
`images/balcony-portrait.jpg` (1429x2000, 281 KB), a vintage black and white
photograph of a woman on a balcony. There is no crop and no aspect-ratio box in
that slot: `.print img` is `width:100%; height:auto`, so the frame takes
whatever shape the file has. The new file is proportionally about seven percent
shorter at the same width, and the `-2.6rem` overlap onto the waiting-list card
is a fixed margin and is unaffected. Still `aria-hidden` with `alt=""`, as it
was.

**`blank-card.jpg` is still in `public/` and is now referenced by nothing.**
Deleting it was refused by tooling in the session and it was left rather than
worked around. It should come out.

**Sitemap:** `/about` added at priority 0.8, changefreq monthly, listed without
the extension like the other two. The front page's `lastmod` moved from
2026-08-16 to 2026-09-23 because its content changed.

**Testimonials were asked for and deliberately not written.** See the separate
entry below.

> **Verified 2026-09-23, by script, not by eye.** All 5 public pages: every
> JSON-LD block parses; `ld-organization` byte-identical across the 4 that
> carry it and absent from `thank-you.html`; consent stamp plus GA4 loader
> byte-identical across all 5 by sha256 and no unconditional `gtag.js`
> `<script src>` on any of them; zero occurrences of either banned brand term
> anywhere under `public/`; every internal `href` and `src` on all 5 pages
> resolves to a file that exists; tag balance on `index.html` and
> `about.html`; no em dashes in any new copy. Served locally on port 8477 and
> fetched: `/`, `/about`, `/about.html`, `/privacy`, `/refunds`,
> `/sitemap.xml` and both images all returned 200.
>
> **NOT verified:** that any of it renders correctly in a browser. No browser
> was available. The photograph swap in particular has been reasoned about from
> the CSS and not looked at.

---

## 2026-09-23 — Contributor testimonials: not written, and why

**Asked for, deliberately not delivered.** The request was two or three real
contributor story vignettes in the third person, matching the voice already used
in Instagram captions, with no invented first-person quotes and no invented
detail, and to flag rather than draft placeholders if no real approved story
content existed.

**No approved contributor story content could be found, and the caption library
that would have been the source does not match the database.**

What is actually in `fulnenhnycaeyzrhplch` as of this date: **one** recipe,
`recipe-0005`, "Lois Sagle Light Christmas Cake Recipe", contributor
Ana-La-Rai Sagle, Vancouver Island, submitted 2026-09-23, status `new`. Its
`talked_to_them` column is **null**, so the Chunk 4 read-it-back conversation
has not happened. One contributor row, one provenance row, one member row
(international digital, joined 18 August).

The Notion Social Pipeline holds several captions written in exactly the voice
that was asked for, including "A member told us she almost deleted her
submission twice", "This week a member sent us her mother's biscuit recipe...
she included the exact time of day her mother baked them", "Water damage had
blurred half the words on the page", and one describing a submission tracing a
dish through three generations with all three versions kept. **None of those
corresponds to anything in the database.** Four are already `Pushed to
Supabase` or `Ready to Post`.

**This is recorded as a discrepancy, not as a finding of fabrication.** The site
invites recipes by email as well as through the form, and a recipe that arrived
by email would never appear in the database at all. So those captions may well
describe real submissions that live only in an inbox. That cannot be checked
from here, and it is the question that went back to Pela.

Either way, the one submission that does exist is not usable as a testimonial:
the contributor has not been spoken to, and publish permission on a recipe is
not the same as approval to be used as marketing.

> **Verified 2026-09-23.** Row counts and column values read directly from the
> hosted Supabase project. Captions read from the Notion Social Pipeline data
> source. Nothing here is from conversation memory.

---

## 2026-09-17 — Ten entries backfilled for 3 to 8 September

This file had nothing between 3 and 15 September. The ten entries below now
cover that gap. **They were written on 17 September 2026 and each one says so**,
with the date the work actually landed in its heading. Nothing below was written
on the day it describes.

**How they were reconstructed, and the limit of that.** From two sources only:
`git log` in `whispers-of-kindness-social`, and the hosted Supabase project —
`activity_log`, `publish_jobs`, `content_items`, `social_accounts`,
`auth.mfa_factors`, the applied migration list and the Edge Function deploy
times. Nothing was reconstructed from conversation memory, and nothing was
filled in because it seemed likely.

**A commit message is its author's claim, not a verification**, in exactly the
way this file's preamble says a code comment is. So each entry keeps the two
apart: what the commit asserts, and what the database independently shows. Where
the database corroborates, the entry gives the timestamp. Where nothing
corroborates it, the entry says the claim rests on the commit alone.

**None of this was re-tested against live code on 17 September.** These entries
record what the record shows. They are not a fresh audit.

Two of them change something already written here. The 4 September entry
corrects the 3 September one on Pinterest revocation, and the 3 September MFA
entry closes an item the 1 September entry left open.

---

## 2026-09-15 — The Instagram image race is fixed, and one real post proves it

Commit `9a2f7f6` in `whispers-of-kindness-social`. **This entry was held back
deliberately until a post went out on the fixed code.** The commit's own
verification was seven stubbed-fetch cases and a requeue rehearsed inside
transactions that rolled back. That is a fix that typechecks, not a fix that has
run, and this file is the wrong place for that difference to go unrecorded.

**What was wrong.** `publishToInstagram` polled the media container only for
video. For an image it created the container and published immediately, which
usually works, so it read as sound code rather than a race. It had in fact been
failing quietly for a week: `activity_log` shows HTTP 400 code 9007 subcode
2207027 on 9, 10, 11 and 14 September. The first three recovered on a retry and
went out 1 to 15 minutes late with nothing saying so. The fourth, content item
`82204437` "Every Family Has a Keeper of Recipes", used all three attempts and
never published.

**The second bug is the one that trapped it.** Nothing wrote the failure onto
the content item, so it stayed `scheduled`: invisible as a failure on the board,
and permanently unqueueable, because `enqueueDueItems` keys a job on
`content_items.updated_at` and a row whose `updated_at` never moves can never
get a second job row. The fix sets `content_items.status = 'failed'` when
attempts are exhausted, and migration `0015` adds `requeue_content_item()`.

**The live post, with times.** All UTC, 15 September:

- `19:48:50` — `publish-worker` redeployed, version 5, the bundle carrying the
  polling loop.
- `19:49:19` — migration `0015` applied.
- `20:01:55` — `content.marked_failed` on `82204437`, **applied by hand via SQL
  at Pela's instruction**, because the item had been stranded before the code
  that now sets that status existed. A one-off repair, not the routine.
- `20:15:57` — `content.requeued`, `failed` → `scheduled`, `updated_at` moved.
- `20:30:19` — **published, on attempt 1.** Instagram media id
  `18484039066107651`. The item is `posted`.

**The 17:00 post the same day is not evidence of the fix.** "Cozy Season Is
Coming (Autumn)" published on attempt 1 at `17:00:12`, but that was nearly three
hours before the redeploy. It ran on the old bundle and simply won the race,
which is what the old bundle usually did.

**Verified:** 17 September, against the hosted database and the Supabase API.
`publish_jobs` shows the 20:30 job `succeeded` at `attempt_count = 1` carrying
the media id above, and the earlier row for the same content item still sitting
at `failed` with its 9007 body, untouched. `activity_log` carries the
marked_failed, requeued and succeeded entries at the times listed. The redeploy
time is the Supabase API's own `updated_at` for `publish-worker`; the committed
bundle under `supabase/functions/publish-worker/` contains `CONTAINER_POLL`, and
the working tree is clean at `9a2f7f6`.

**Corroborating, and worth knowing:** that job took 17.8 seconds from claim to
post, against 8 to 10 seconds for every earlier Instagram publish. Its image is
2.41MB, the largest in the set and the one that never published on the old code.
The extra seconds are the loop waiting for the container, which is the fix doing
the thing it was added to do.

**Still open.**

- **One post is one post.** Nothing has published since `20:30` on 15 September,
  because nothing is queued: `content_items` holds 9 `posted` rows and 1
  `draft`, and no scheduled item remains. The fix has a single live success
  behind it, not a run of quiet days.
- **The terminal-failure path has not run for real.** `recordFailure` setting
  `content_items.status` was proven in tests only. The one item that needed it
  was marked by hand, and no failure has happened since to exercise it.
- **No post URL is stored.** `external_post_url` is null on every row, successes
  included; only the media id is kept. What is proven above is that Meta
  returned a media id for a publish, not that the post has been opened and
  looked at.

**Also open, and not a small thing: this file skips twelve days.** Between the 3
September entry below and this one, the social repo shipped Phase 1 chunk 2 (the
publish worker), chunk 3 (content board, job history, weekly approval,
connections), scheduled database backups, the MFA enrolment screen, the 15
minute scheduler, token refresh, the credential expiry alarm and the Notion
push — and Instagram published to a live account for the first time on 6
September, on attempt 2. None of that is recorded here. Read this file today and
you would believe the pipeline had never posted anything. Verified by `git log`
in the social repo and by the `publish_jobs` row posted `2026-09-06 00:22:43Z`.

---

## 2026-09-08 — A Notion batch can be pushed into the pipeline, idempotently

**Backfilled 17 September 2026.** The work landed 8 September 2026.

Commit `14cbe98`, with `657fbf9` correcting the docs the same day. The
`notion-push` Edge Function takes a batch of approved Notion pages, downloads
each image into the `social-assets` bucket, and creates the `assets` and
`content_items` rows the 15 minute worker then picks up.

What the commit asserts: three things in the schema contradicted the brief, two
of which would have made the insert fail outright. `scheduled_at` is not
writable — a trigger derives it from `scheduled_local_at` and the row's own
timezone, which is the whole reason the 9am-became-6am bug from the Make
pipeline cannot recur here, so the input is resolved to a local wall clock
instead. `status = 'scheduled'` requires `approved_by_pela_at`, so a pushed row
asserts the human checkpoint happened in Notion, recorded under
`approval_origin` so the trail never claims Pela clicked a button she did not
click. And `assets.media_type` is a different enum from `content_format` that
happens to share the word 'image'. Idempotency is keyed on the Notion page id,
not the title and not the image, enforced by a partial unique index at the
database rather than in the function.

**Verified, from the database.** The `notion-push` function was deployed
`2026-09-08 21:49:27Z`; the first `content.notion_push_batch` entry is
`21:49:59Z`, a dry run of 6 with 2 failures. The idempotency claim is visible
rather than asserted: the batch at `21:51:13Z` records `already_present` for
`notion-2a7f1c9e-e2e-test-0001` and `created` for a second page reusing the same
image, sharing `asset_id` `85d86628`. Both test rows were removed at `21:51:54Z`
as `content.test_fixture_removed`, with the reason recorded — they were
`scheduled` and approval-stamped, so the worker would have posted them to the
live Instagram account.

**The seven real items followed between `21:58` and `22:00`**, one
`content.pushed_from_notion` each, all Instagram, all with Canva export URLs as
`source_uri` and content-addressed storage paths. Those seven are the posts that
went out between 9 and 15 September, which is the strongest thing that can be
said for this function: its output published.

**Open.** The push has run on exactly one real batch. Nothing has been pushed
since 8 September, and `content_items` holds no scheduled row today.

---

## 2026-09-06 — The worker runs itself every 15 minutes, and the service role key stops existing

**Backfilled 17 September 2026.** The work landed 6 September 2026 and was
committed 8 September as `8b6dd2a`.

**Note the two dates.** The commit is dated 8 September, but the `publish-worker`
Edge Function was deployed `2026-09-05 21:54:24Z` and migration
`0013_scheduled_publish_and_refresh` was applied `2026-09-06 00:23:31Z`. This was
live in the project two days before it reached git. Anyone reading the commit
date alone would place it wrongly.

Until this, the worker only ran when Pela opened a terminal and pasted the
Supabase service role key into it. That is a manual pipeline with extra steps.

What the commit asserts: Supabase Cron was chosen over GitHub Actions, Render,
Railway and Fly, and the deciding factor was not cost. Edge Functions receive
`SUPABASE_SERVICE_ROLE_KEY` as an injected environment variable, so the key
exists in no file, no secret store, no shell history and no transcript — the
requirement was "set once, never re-entered" and this is stronger, because it is
never set at all. The Deno bundle is generated by `tools/build-edge-worker.mjs`
from `packages/` rather than hand-copied, because two implementations start
silently disagreeing and this project exists because of a tool that silently
disagreed with its operator. Fifteen minutes rather than five or sixty: five
triples invocations for nothing, sixty means a 09:00 post can go out at 09:59.

**Verified, from the database.** The first two runs were manual: `00:22:20Z`
found nothing due, then `00:22:32Z` claimed 1 and succeeded 1 in 11.3 seconds.
Migration `0013` was applied at `00:23:31Z`, and the regular cadence begins at
`00:30:02Z` and has not stopped since. `activity_log` holds **1,121
`publish_run.completed` entries between `2026-09-06 00:22:21Z` and `2026-09-17
16:00:02Z`** — a span in which an unbroken 15 minute tick produces about 1,118,
the small excess being manual invocations. There is no gap in it.

**One thing the record does not prove.** Every one of those entries carries
`"via": "supabase edge function, pg_cron"`, including the two manual runs made
before the cron schedule existed. That string is a constant in the metadata, not
a measurement. What shows the schedule really running is the timestamps, not the
label.

---

## 2026-09-06 — Instagram published to a live account for the first time

**Backfilled 17 September 2026.** The work landed 6 September 2026.

**No commit records this.** It is an event in the database, and it is the first
time anything this pipeline built put a post on a real account.

`publish_jobs` row `018731ad`, content item `cccc0002` "Kindness travels
quietly", instagram, production, **succeeded on attempt 2 at `2026-09-06
00:22:43Z`**, Instagram media id `18139105525526086`, with the matching
`publish_job.succeeded` entry at `00:22:44Z`. It went out 22 seconds into the
second manually invoked run of the freshly deployed `publish-worker` function.

The account is `@wofk_thecherishedtable`, Instagram id `17841439383486367`,
connected `2026-09-05 20:36:21Z`.

**Attempt 2, not attempt 1.** The first attempt failed. Recorded here because it
is the earliest instance of the image race written up in the 15 September entry
above — nine days before anyone noticed it was a pattern rather than a hiccup.

**Verified:** the `publish_jobs` row and the `activity_log` entry, read 17
September. The one earlier `publish_job.succeeded` in the table, at `2026-09-03
23:34:39Z`, was a **Pinterest sandbox** pin and not a live post.

---

## 2026-09-05 — Pinterest tokens renew themselves, and the Instagram expiry we stored was invented

**Backfilled 17 September 2026.** The work landed 5 September 2026 and was
committed 8 September as `f26e85e`. `token-refresh` was deployed `2026-09-05
21:42:31Z`; migration `0012_refresh_platform_credentials` was applied
`2026-09-05 21:39:43Z`.

Two platforms, two different problems. Pretending they were the same would have
produced a function that looks like it renews Instagram and does not.

**Pinterest is a real OAuth refresh.** A `refresh_token` had been stored at
connect time and never used. **Verified in the database:**
`credential.refreshed` at `2026-09-08 20:31:34Z` records `expires_at` moving
from `2026-10-03 22:15:37Z` to `2026-10-08 20:31:34Z`, with
`rotated_refresh_token: true`, `secret_rotated_in_place: true`, and
`verified_as: Whispers_of_kindness` — Pinterest's own `user_account` call, made
with the new credential read back out of Vault. `social_accounts` still carries
that `2026-10-08` expiry today.

**Instagram has nothing to refresh, and what we had stored was wrong.**
`credential.refreshed` at `2026-09-05 21:42:55Z` records the correction:
`expires_at` from `2026-11-04 20:09:47Z` to `2026-12-04 20:36:18Z`, with
`token_expires_at: null` and the note "Instagram tokens do not expire (Meta
reports expires_at 0)". The 4 November date was a 60 day guess our own connect
code invented. Meta never said it, and it would have fired the expiry alarm a
month early for a token that was never going to die. The date that actually
matters is `data_access_expires_at`, and **no server-side call extends it**:
Pela has to click Connect Instagram in a browser before **4 December 2026**.

The commit also asserts verify-before-store on every path, and that refresh uses
a separate verb from store precisely so it cannot touch `connected_at`, the date
Meta measures its 90 day window from. **That rests on the commit alone.** The
only corroboration is circumstantial: Instagram's `connected_at` still reads
`2026-09-05 20:36:21Z` after twelve days of refresh runs, which is what it
should read if nothing moved it.

**Verified:** `activity_log` and `social_accounts`, read 17 September. The job
is still running — 16 `credential.refresh_run` entries, daily, most recently
`2026-09-17 13:00:02Z`.

---

## 2026-09-05 — A credential expiry emails Pela before it lapses

**Backfilled 17 September 2026.** The work landed 5 September 2026 and was
committed 8 September as `42f3035`. `expiry-check` was deployed `2026-09-05
21:35:26Z`; migration `0011_scheduled_jobs_expiry_check` was applied
`21:38:08Z`.

The pipeline had two connected accounts and no renewal path for either.
Pinterest's token was due to expire 3 October 2026, nine days before Canadian
Thanksgiving, and nothing would have told anyone. An automated publisher whose
credentials quietly die is worse than a manual one, because the failure is
silent and the dates it misses are real.

Deliberately the dumbest, most reliable piece: read a column, compare it to a
clock, send an email. It has no dependency on the refresh logic working, which
is the point — if refresh breaks, this still fires. Scheduled daily at 14:00
UTC, 07:00 brand time, because a warning that lands at 3am is a warning read
late.

**The alarm branch was proven rather than trusted, and the record shows the
seam.** The first entry, `2026-09-05 21:35:44Z`, is a dry run reporting 2
healthy. Two minutes later at `21:37:23Z` a run with `warn_days` widened flags
both accounts, Pinterest at `days_remaining: 28.03` — the alarm path firing on
demand rather than being believed. **The email itself was not proven that day:**
the `21:37:32Z` entry records `email: {sent: false, reason: "RESEND_API_KEY is
not set on this function"}`.

**The email was proven three days later.** `2026-09-08 20:32:22Z` records
`email: {id: "311031ae-f093-43b0-8f70-668f170446ce", sent: true}`. That is the
first and so far the only alarm email this system has sent.

**Verified:** `activity_log`, read 17 September. 19 `credential.expiry_check`
entries, daily at 14:00Z, most recently `2026-09-17 14:00:02Z`, reporting 2
healthy and 0 expiring.

---

## 2026-09-04 — Phase 1 chunk 3: content board, job history, weekly approval, connections

**Backfilled 17 September 2026.** The work landed 4 September 2026.

Commit `cef9fb9`. Four screens, the UI both prior chunks deferred, built against
the real tables rather than a scaffold.

What the commit asserts: the board is a kanban over the real `content_status`
enum, all six values in §05 order plus `failed`, because a failed item that
appeared nowhere would rebuild the invisible failure §00 exists to design away.
Platform and recurrence filters live in the URL, so a filtered board is a link
rather than client state a reload discards. Job history prints `last_error`
verbatim in a scrollable block, not truncated and not summarised, because the
platform's own words are the only thing that says which scope was missing three
weeks later. Weekly approval shows drafts only, ticked by default, with the
count named on the button. Connections shows three platforms and three different
kinds of "not connected", including a deliberately disabled YouTube control
rather than a button that would 400.

**A bug this found, and it is the reason for migration `0010`.** The first
version of approve-batch did the UPDATE and then inserted its own audit row from
the API route. That insert was **silently rejected on every call**:
`activity_log` is select-only for `authenticated` by design from `0001`, because
an audit trail the app can rewrite is not an audit trail. So approvals worked,
left no trace, and nothing errored. Caught by querying `activity_log` after
walking the flow, not by reading the code. `approve_content_batch()` is now
SECURITY DEFINER, so the update and the log are one transaction.

**Verified, from the database:** `0010_approve_content_batch` is in the applied
migration list, and `content.approved_batch` appears exactly once, at
`2026-09-04 17:18:34Z`, recording `approved_count: 3` and the three ids. That
row existing at all is the proof the bug is fixed, because before `0010` no such
row could be written.

**Also on 4 September, the chunk 2 test fixtures were got out of the way**, and
the reason is worth keeping: left as they were, they would have published test
content to the live Pinterest account on the first run after Standard access was
granted. `publish_job.skipped_by_operator` at `17:30:41Z` on job `fe233823`,
then `content.unapproved_by_operator` at `17:41:20Z` on item `cccc0001` — the
second because marking the job skipped did not prevent re-enqueue. Both record
`decided_by: "Pela, 4 September 2026"`. That item is still the single `draft` row
in the table today.

**Not verified:** the screens themselves. Nothing in this entry claims the UI was
loaded and looked at on 17 September. The admin app runs on `localhost:3000` and
is not hosted anywhere, so there was nothing to check against.

---

## 2026-09-04 — Correction: Pinterest revocation is impossible, not merely unbuilt

**Backfilled 17 September 2026.** The work landed 4 September 2026.

Commit `a390534`. **This corrects the 3 September entry below**, which says
Pinterest publishes a revocation endpoint and that calling it is flagged for
Chunk 2. That reads as a task waiting for someone with an afternoon. It is not a
task.

Tested end to end on 4 September 2026:

```
POST /v5/oauth/token/revoke
401 {"code":1201,"message":"Two-factor authentication required."}
```

2FA is a human interactive step. A server holding a valid app id, app secret and
access token cannot supply it. Same answer from the sandbox host and the
production host, and for the access token and the refresh token alike.

The credentials were proven good before that conclusion was drawn: a
deliberately invalid authorization code produced code 283 "The authorization
grant is invalid", while a knowingly wrong secret produced code 2
"Authentication failed." at the same moment. Pinterest had stopped objecting to
who was asking and started objecting to what was asked, which is what makes 1201
a statement about revocation rather than about us.

**So `revoked` means this system can no longer use the credential. It will never
mean the credential is dead.** The only complete remedy is removing the app from
the account's connected-apps settings, which is manual and kills every
environment at once. The 3 September entry's line that an emergency disconnect is
not finished until the app is also removed by hand is therefore **permanent, not
a stopgap**.

This also closes the design question raised while planning the feature: whether
revocation belonged in the web app, which holds the app secret but by design
cannot read tokens, or in the worker, which can. Neither can pass a 2FA
challenge, so the store/get split from §07 stays exactly as built, with nothing
relaxed to accommodate a call that cannot be made.

**Verified, from the database:** the disposable sandbox connection used for that
test is still there as its own `social_accounts` row — pinterest, environment
sandbox, `status = revoked`, connected `2026-09-04 16:32:39Z`, revoked
`16:52:53Z` with `secret_destroyed: true`. Production was left alone: that row's
`connected_at` still reads `2026-09-03 22:15:38Z`.

**The probe itself was not re-run on 17 September.** The 401 above rests on the
commit.

---

## 2026-09-03 — A scheduled, self-verifying database backup

**Backfilled 17 September 2026.** The work landed 3 September 2026.

Commit `62cf85d`, plus eight follow-ups the same day getting it actually to run:
`bace3e2`, `aed5488`, `68a22b1`, `3e378cd`, `cc645af`, `cb81259`, `596e317`,
`be3548e`.

This project is on Supabase's Free plan by deliberate choice. **The Free plan
has no automated daily backups and no point-in-time recovery.** Between chunk 1,
when real OAuth credentials went live, and 3 September, this database had no
recovery point of any kind.

Daily at 11:00 UTC (04:00 Vancouver) plus manual dispatch: dump `public` and
`vault`, verify, encrypt AES256, upload a 90 day artifact, shred the plaintext
before upload can see it.

**The verify step is the point.** A backup job that uploads an empty file and
reports success removes the worry without removing the risk. It asserts a size
floor, all five tables, the credential RPCs, `COPY public.activity_log` so it
proves data and not merely schema, and `COPY vault.secrets` so that if Supabase
ever stops dumping the ciphertext this fails loudly instead of quietly
shrinking.

**The Pinterest credential does not survive a restore into a new project.**
`vault.decrypted_secrets` decrypts via the pgsodium server root key, which is
held outside the database and is not dumped — confirmed at the time by finding
no pgsodium schema, no pgsodium tables, the extension not installed, and
`key_id` null on the row. The ciphertext travels because `supabase_vault`
registers secrets via `pg_extension_config_dump`; the key cannot. Same-project
restores work. New-project restores need Pinterest reconnected through `/board`.

**Two follow-ups are worth keeping.** `3e378cd` stopped guessing which Supavisor
pooler cluster serves the project, after six runs were spent unable to tell a
wrong password from a wrong cluster — Supavisor answers "password authentication
failed for user postgres" to both. `596e317` found that installing `pg_dump` 17
is not the same as using it: the runner's `postgresql-client-16` shadowed it,
and the version step **printed 16.15 and checked nothing**, so it went green
while the dump was guaranteed to fail. "A check that cannot fail is decoration."

**Known gaps, listed rather than discovered during a restore:** Storage objects
are not dumped, auth users are not dumped, and 90 days on GitHub is off-site
relative to Supabase but not to GitHub.

**Verification, and it is the thinnest in this backfill.** This entry is
reconstructed from the nine commits alone. **The workflow runs in GitHub
Actions, which leaves no trace in the database, so nothing here was corroborated
against the project.** Whether a backup has actually run green since 3
September, and whether one has ever been restored, is not established by
anything read on 17 September. That is the open question this entry leaves
behind, and it is the same shape as the thing the verify step exists to prevent.

---

## 2026-09-03 — The MFA enrolment screen the config already assumed, and it was used

**Backfilled 17 September 2026.** The work landed 3 September 2026.

Commit `102d707`. `[auth.mfa.totp] enroll_enabled` had been true since 1
September. **That switched on the capability and nothing else**: enrolment is an
app-side call to `supabase.auth.mfa.enroll()`, and there was no screen anywhere
to make it. The setting was true and unreachable, which is a comforting line in
a config file rather than a control.

`/security` implements all three steps: enroll creates an unverified factor and
returns the QR and secret, challenge starts a verification, verify submits the
code and makes it real. The trap it designs against is a factor left at step one
— it sits in the account unverified, Supabase ignores it at sign-in, and it
makes the list look protected. So the screen lists factors from
`listFactors().all` rather than `.totp`, labels an unverified one "UNVERIFIED,
protects nothing", and offers to remove it. Admin-only via `getUser`, which
revalidates with Supabase, rather than `getSession`, which reads a cookie the
client could have written.

**This closes an item the 1 September entry left open.** That entry records MFA
as not enrolled. **It is enrolled now, and has been since the night the screen
shipped.** `auth.mfa_factors` holds exactly one factor, `status = verified`,
created `2026-09-04 02:28:53Z`, about seven hours after the commit. Not an
unverified stub: verified, which is the distinction the screen was built to make
visible.

**Verified:** commit `102d707` and a count over `auth.mfa_factors`, read 17
September. What that proves is that a verified TOTP factor exists on the
account. It does not prove the factor is in anyone's authenticator app today,
and it says nothing about recovery codes, which were not looked at.

**Still open from the same 1 September entry:** leaked-password protection is
Pro-only and remains unavailable, mitigated by a 16 character minimum. The
`/security` page states that on itself, so the gap is visible where someone
manages their account rather than only in a doc.

---

## 2026-09-03 — Phase 1 chunk 2: the publish worker

**Backfilled 17 September 2026.** The work landed 3 September 2026.

Commit `73b8fe3`, with `94ebdfb`, `937e0df`, `edace60`, `258fe94`, `46eceeb` and
`0ba874e` the same day.

Pinterest gained a real pin-creation path: list boards, create pin, delete pin.
Instagram gained the two-step container flow. **The commit says at the top that
the Instagram path had never run against a live account**, and claims only that
it typechecks and follows Meta's documented shape. It first ran live three days
later; see the 6 September entry above.

Structure worth keeping. The worker runs one pass and exits rather than looping,
so a stuck run is a visible failed invocation instead of a process that quietly
stopped. Enqueue and execute are separate phases, so a crash between them leaves
queued work rather than lost work, and the record of what was attempted exists
before anything is attempted. One job per row, one try/catch per job, no shared
state between platforms. Failures record the platform's own response body,
because "HTTP 401" is not debuggable three weeks later while the body usually
names the missing scope. Migration `0007` adds `get_platform_credentials`,
granted to `service_role` and revoked from `authenticated`, so the web app
cannot read a token even holding a valid session, and `claim_publish_jobs` uses
FOR UPDATE SKIP LOCKED so two runners can never take the same job. The worker
converts no timezones: `scheduled_at` is already resolved by the database from
the row's own zone, so there is no place for a host clock to substitute itself.

**`258fe94` made the environment a property of a credential rather than a switch
on a run**, because a Pinterest token for one host is rejected by the other. The
credential functions take a **required** `p_environment`, never a defaulted one:
a default of 'production' would mean a caller that forgot the argument silently
reaches the real account.

**Pinterest refused, and still refuses.** `0ba874e` records 403 code 29 — apps
on Trial access may not create Pins in production. Not a code or scope fault:
`user_account` and `boards` both returned 200 on the same token in the same run,
and `pins:write` was granted. **Verified in the database:** `publish_jobs` holds
exactly one production Pinterest job, `fe233823`, `status = skipped`,
`error_code = http_403`, its `last_error` still carrying the code 29 body. In
the whole table there has never been a successful production Pinterest publish.

**A documentation claim was checked and turned out to be false.** `46eceeb`: the
runbook and architecture doc both said Sandbox pins are visible only to the
account owner and never to the public. That was taken from Pinterest's own
documentation and never verified, and verifying it is what disproved it — a
board and a pin created through `api-sandbox.pinterest.com` were both returned
by `api.pinterest.com` under the production token, on the live account, with the
board marked PUBLIC. Both deleted the same day, confirmed by GET on each id
against **both** hosts, all four 404, because a delete issued against one host
proves nothing about the other. A standing rule followed: no live calls to
either Pinterest host for testing until Standard access is granted. **`0009` is
comment-only and corrects the column comments `0008` shipped; `0008` was left
exactly as applied**, because editing an applied migration makes the file and
the database disagree for anyone who already ran it, and quietly rewrites what
was believed at the time.

**Verified, from the database:** the sandbox pin at the centre of that is
`publish_jobs` row `edac0a44`, environment sandbox, succeeded `2026-09-03
23:34:38Z`, external id `1136596024738184475`. A `pinterest.leak_check` entry at
`2026-09-04 17:56:24Z` re-checked whether it had leaked and records "Already
clean." Migrations `0007`, `0008` and `0009` are all in the applied list.

**Not re-verified:** Trial access was last measured 8 September, per the runbook.
Nothing on 17 September re-ran that probe, so "still refuses" above means "has
never succeeded in this table", not "was checked today".

---

## 2026-09-03 — Pinterest connected for real, and disconnected again

Chunk 1 of the social pipeline's Phase 1 is done. Commit `c09eef2`, CI green.
**A real Pinterest account was connected, used, and revoked**, not simulated.

`@Whispers_of_kindness`, account id `1136596162116632390`, BUSINESS account.
Pinterest granted `boards:read boards:write pins:read pins:write
user_accounts:read`, so **Chunk 2 will not need a second authorisation.**

**The token never touched a table or a log.** Verified by substring-matching
the real token out of Vault against the full JSON of the row and every audit
entry: absent from both. The row holds only a pointer.

**The "who am I" call was proven live rather than inferred.** Pinterest
answered 200 with the matching account id, using the stored token, several
minutes after the connect. The token never left the database to do it: the
`http` extension was installed, the call made from inside Postgres, and the
extension dropped again.

**Two auth bugs were found and fixed on the way**, both dating from Phase 0
and both making the app unusable rather than merely wrong.

1. **Nobody could ever have signed in.** `[auth.email] enable_signup = false`
   disables the email PROVIDER, not just signups, so every login attempt
   answered 422 `email_provider_disabled`, correct password or not. **The
   symptom had been recorded twice in this file as "nobody has signed in yet"
   and read as not-yet-tried rather than cannot.** Signups stay blocked by the
   top-level switch, which is the right place for it.
2. **The worker could not start.** Chunk 1 removed `.js` import extensions to
   fix `next build`, which broke plain Node ESM. Explicit `.ts` extensions
   satisfy tsc, webpack and Node together. Neither typecheck nor the build
   catches a broken worker, so CI now starts it.

**Disconnect does less than its name says, and this is open.** It destroys the
Vault copy and marks the row `revoked`, but never calls Pinterest, so the
token stays valid there until it expires. Fine for an ordinary disconnect.
**Not fine for the case someone would actually use the button in a hurry, a
token they think has leaked.** Pinterest publishes a revocation endpoint;
calling it is flagged for Chunk 2. Until then an emergency disconnect is not
finished until the app is also removed from the account's connected-apps
settings.

**Verified:** after revoke, `status = revoked`, `credentials_secret_id` null,
`vault.secrets` count 0 with zero dangling pointers, the row still present with
`connected_at` intact, and two audit entries reading `social_account.connected`
then `social_account.revoked {"secret_destroyed": true}`.

**Not verified, and it cannot be:** the promised re-test of the dead token
against Pinterest did not happen. The token was deliberately never surfaced
outside the database, and revoke destroyed it, so there was nothing left to
test with. The design that protects the token is the same design that
prevented that check. Worth knowing rather than papering over: what is proven
is that our copy is gone, not that Pinterest considers the token dead. On the
evidence above, Pinterest almost certainly still does.

---

## 2026-09-02 — Privacy policy page is live

`https://whispersofkindness.ca/privacy`. Commit `4561d10`, deployed by Netlify
about twenty seconds after the push.

Pinterest's and Meta's developer app forms both require a privacy policy URL
that resolves, and both were blocked on it. That is the reason this exists now
rather than later.

**Cloned from refunds.html rather than written fresh.** The head, design
system, header, footer, favicon block and consent stamp are identical because
they are the same bytes, so the two policy pages cannot drift apart. There is
still no shared template on this site, which is why cloning was the safer
move than reimplementing.

**The wording is Pela's, reproduced exactly.** Not asserted: the rendered page
was stripped back to plain text and diffed against the source, first locally
and then against the live URL. 25 of 25 lines identical, nothing reworded,
added or dropped. Two pieces of chrome are NOT policy text and match the
pattern refunds.html already set: the handwritten kicker, and the "back to the
front page" link.

**The footer gained a third link**, added identically on index, refunds and
privacy. thank-you.html has no footer at all, so there was nothing to add
there and the tooling correctly skipped it rather than inventing one.

**Four comments that said the shared blocks "live in three places" now say
four** and name privacy.html. They were one page away from being quietly
wrong, which is the kind of comment that misleads a later reader.

**Verified:** all six live URLs return 200, including both `/privacy` and
`/privacy.html`. The live text diff matched exactly. The footer link is
present on all three live pages and resolves; note it is served as
`href='/privacy'` because Pretty URLs rewrites the `.html` on the way out, so
a grep for the authored form finds nothing and that is expected. Front page
and refunds still carry their headings, robots.txt still 200, sitemap lists
`/privacy`. Rendering confirmed by headless screenshot of the live page at
1280 wide, and locally at true 390 and 360 CSS px viewports where the measured
`document.scrollWidth` equalled `innerWidth`, meaning no horizontal overflow.

**One false alarm worth recording.** The first mobile screenshots looked badly
clipped on the right. They were not. Windows display scaling made the layout
viewport 492 CSS px while the capture was cropped to 390 physical px. The
existing refunds page showed the identical artifact, which is what prompted
measuring rather than trusting the picture. **The measurement disproved the
screenshot.** Same lesson as the offer tag in August, reached from the
opposite direction: there, arithmetic was not a substitute for looking; here,
looking was not a substitute for measuring.

**Not verified:** the footer was never captured in a screenshot. Repeated
headless attempts failed on a locked Edge profile and then on oversized
captures. It is confirmed three other ways, by markup, by the link resolving,
and by the CSS being the same bytes as the working refunds page, but nobody
has looked at it. **A human should glance at the bottom of the page**, the
same way the offer tag ultimately needed a person.

---

## 2026-09-02 — Social pipeline Phase 1 chunk 1: connections and content intake

Commit `11e2874`. Migrations `0004` to `0006`. **No account has actually been
connected**, because no platform credentials exist on this machine.

**Nine endpoints built** under `/api/v1`, per architecture section 04: connect,
callback, status and revoke for social accounts; list, create, patch, delete
and upload-asset for content. Instagram and Pinterest OAuth clients, token
exchange and "who am I" only. No publish method anywhere, which is chunk 2.

**The web app can write a credential and can never read one back.** Vault
access goes through two SECURITY DEFINER functions granted only to
`authenticated`, and there is deliberately no read counterpart. That also
means no service role key needs to live in the web app at all. The worker will
read Vault directly when it exists.

**Two faults found that were already there, neither introduced by this work.**

1. **CI never built the app, only typechecked it.** The workspace packages
   import each other with `.js` extensions, which `tsc` resolves and webpack
   does not, so `next build` had been failing since Phase 0 and nothing was
   watching. Extensions dropped, and a build step added to CI. **A green
   pipeline was reporting on a build that had never run.**
2. **`assets.storage_bucket` still defaulted to `social-assets`** after
   migration 0003 made it nullable, so an external long-form asset silently
   claimed a bucket holding none of its bytes. Nothing had broken yet because
   the route passes null explicitly, but the schema permitted a row that would
   send someone looking in the bucket for a file never put there. Default
   dropped, bucket and path now all-or-nothing. Found by inserting a row the
   way the route does and reading the result rather than assuming it.

**The Meta Graph API version was checked, not recalled.** v26.0, confirmed
against Meta's changelog. Writing it from memory would have pinned v21.0,
nearly two years stale.

**Verified:** `pnpm typecheck` and `next build` both clean locally; CI green on
`11e2874` with the new Build step and all six migrations applied to a fresh
database twice. The full credential lifecycle exercised against the live
project with a synthetic token: stored and decrypted back through Vault, no
raw token anywhere in the row, reconnect rotating in place without orphaning
the secret, revoke destroying the secret and leaving status `revoked` with the
row intact, and the audit trail recording all three. Now asserted in CI too.
Asset constraints proven in all three failing directions. All nine endpoints
confirmed returning 401 unauthenticated against a real running server,
including the OAuth callback. All tables back to 0 rows.

**Not verified, and this is the gap:** no real OAuth connection has been made.
There are no Meta or Pinterest credentials on this machine, and the
authenticated HTTP paths could not be exercised because signing in needs the
admin password, which correctly is not available to tooling. Everything past
the auth gate is verified at the database layer rather than through the API.

---

## 2026-09-01 — Auth hardened. Two of three closed, and MFA is not enrolled

Commit `cac64ca`. Phase 0 is complete.

**Password minimum raised 6 to 16**, no character-class requirements. Length
rather than punctuation soup, because forced character classes push people
toward predictable substitutions and writing the password down. **Applies to
new passwords only**, so the existing admin login is untouched and the rule
bites at the next change.

**TOTP MFA capability enabled.** The "Insufficient MFA Options" advisor has
cleared, which is independent confirmation rather than a claim.

**MFA IS ENABLED BUT NOT ENROLLED, AND THERE IS NO DASHBOARD FLOW TO ENROL
IT.** The dashboard's MFA settings govern the Supabase *account*, not a
project's end users. Enrolling a factor for the admin login needs an app-side
`supabase.auth.mfa.enroll()` screen, and this app has only placeholder pages.
**Nothing about signing in has changed and login is still AAL1.** The security
benefit is not real until that screen exists and has been used.

**Leaked password protection could not be closed.** There is no key for it in
the CLI's config schema, so `config push` cannot set it. It is a dashboard
setting and may be gated behind a paid plan, which would collide with the
free-tier decision taken for storage. Left open deliberately rather than
quietly dropped.

**The long-form export backup-scope question is folded into the Phase 3 backup
work** rather than tracked separately, per Pela.

**Verified:** the push diff showed only the two intended lines changing and
nothing else, the follow-up push reported the auth config up to date, and the
MFA advisor cleared on its own. Working tree clean and in sync at `cac64ca`,
six commits. `pnpm typecheck` exits 0. CI green with all three migrations
applied to a fresh database twice and four assertions passing. **Not
verified:** the app has never been run, nobody has signed in, no MFA factor is
enrolled, and no platform API has been touched.

---

## 2026-09-01 — Long-form video leaves the bucket, and a full auth key audit

Commit `70e714a`. Migration `0003`.

**Long-form video will never be stored in Supabase.** The free tier caps a
file at 50MiB and the monthly recipe video does not fit. Decision was to stay
on the free tier rather than upgrade, so the YouTube resumable upload reads
the source export directly and the `assets` row keeps metadata only.
`storage_path` and `storage_bucket` are nullable now, `source_uri` says where
the bytes actually are, and a constraint requires one or the other so an asset
can never point at nothing.

**The cost is written down rather than buried.** There is no Supabase-hosted
copy of a long-form video. The only copies are the source export, whatever the
nightly backup covers, and YouTube's own once the upload succeeds. **Two
things follow: do not delete a source export before the upload is confirmed,
and check that long-form exports actually sit inside the 02:00 job's scope.**
Otherwise, between export and upload, that file exists on exactly one disk,
which is the situation the outreach letter was held back over in August.

**A full audit of every auth key the CLI manages.** Prompted by the near-miss
where two settings were weakened purely by being absent from the local file.
Result: **nothing else had drifted.** Fourteen previously undeclared keys are
now pinned at their existing values, and the push that followed reported no
auth diff at all, which is the proof: every pinned value already matched the
server. A future CLI default cannot move them silently now.

**The audit did find three weak Supabase defaults, and all three are still
open.** `minimum_password_length` is 6 with no character requirements, leaked
password protection is off, and MFA is off. None were changed, because
altering live auth policy is Pela's call. **These matter from Phase 1 onward,
not now:** the admin account currently guards nothing, since no platform
tokens are stored yet. That stops being true the first time an OAuth flow
runs.

**Also confirmed, because it had dropped out of two reports:** the roughly
eight column renames to section 03's naming did land, in `0002` alongside the
other two changes, not left pending. Fourteen rename statements, verified
against both the live schema and the generated types.

**Verified:** working tree clean and in sync at `70e714a`. `pnpm typecheck`
exits 0. CI green with all three migrations applied to a fresh database twice
and four assertions passing: the five tables, the timezone in both DST states,
the approval gate in both directions, and an asset having to point at bytes
somewhere. Live schema queried directly for all nineteen section 03 column
names, every one present; all seventeen old names return nothing. All tables
at 0 rows. **Not verified:** the app has still never been run and no platform
API has been touched.

---

## 2026-09-01 — Social pipeline schema aligned to the real architecture document

The architecture document arrived after the schema was already built from a
summary. Four divergences closed by Pela's decision, while every table was
still empty and the changes were free. Migration `0002`, commit `e5fb237`.

**`content_items.platform` is singular now.** It was a `platform[]` array.
Section 03 and the section 08 worker loop both give a content item one
platform, so creative going to three platforms is three rows. That is what
lets each row carry its own caption, and Instagram and Pinterest wanting
different text for the same image is the normal case rather than an edge one.

**The approval gate is real and enforced by the database.**
`approved_by_pela_at` is not just a column. A check constraint refuses to let
any row reach `ready`, `scheduled` or `posted` while it is null. Section 00
defines "full automation" as one periodic go-ahead and then hands-off, which
makes this single transition the entire human checkpoint. It should not be
something application code can forget or route around. Tested both directions
and asserted in CI, including the too-strict direction, so a future change
that blocks approved rows also fails the build.

**Column names aligned to section 03** across all five tables.
`social_accounts` gained a `connected | expired | revoked` status in place of
`is_active`, because a boolean could not tell an expired token from a revoked
one, and those are different problems with different fixes.

**One new constraint to remember:** section 03 says the two video formats are
YouTube-only, so that is now enforced. **This will need relaxing if Instagram
Reels or Pinterest video ever enter scope.** One line to change, written up in
section 12 of the architecture doc rather than left to be discovered.

**A CI break was caught by CI, which is the point.** Making `platform` NOT NULL
invalidated the timezone assertion's INSERT, which did not supply it. Fixed in
the same commit.

**Two new security advisories, both open and neither acted on.** Leaked
password protection is disabled, and MFA options are insufficient. Both are
auth-level settings on a single admin account that guards Instagram, Pinterest
and YouTube tokens. Left alone deliberately rather than changed unilaterally,
since they alter live auth policy. Worth closing before Phase 1 connects real
platform credentials.

**Verified:** migration history reads `0001 core_schema | 0002
align_to_architecture_section_03`. All five new `content_items` columns
present, the old array column gone, both new constraints present, zero tables
without RLS, one auth user, all tables at 0 rows. `pnpm typecheck` exits 0.
CI green on `e5fb237` with all twenty-one steps `success`, including the new
approval-gate assertion, having applied both migrations to a fresh database
twice. **Not verified:** the app has still never been run and no platform API
has been touched.

---

## 2026-09-01 — Social pipeline Phase 0 closed out. The three unverified items are now verified

Follow-up to the entry below, which ended by saying CI had never run, no admin
user existed, and sign-up was still enabled on the server. All three are now
done and checked. Written as a new entry rather than an edit to that one.

**Pushed and CI is green.** `github.com/Sovereign-Alchemist/whispers-of-kindness-social`,
private. Three commits, `f24ebff`, `e444cc7`, `192769a`. Both jobs pass on the
current head.

**The first CI run failed**, and it is worth recording why rather than only
that it now passes. `pnpm/action-setup` treats a `version:` input plus a
`packageManager` field in `package.json` as a hard error, not a precedence
rule, so typecheck died before installing anything. `package.json` is now the
single source of truth for the pnpm version.

**Sign-up is disabled on the live server, not just in the file.** Checked by
sending a real sign-up request and getting `422 signup_disabled`, not by
reading `config.toml` and not by looking at the dashboard.

**`config push` silently weakened two settings, and this is the part to
remember.** It sends the whole file and treats an absent key as "use the CLI
default", not "leave the server alone". The first push moved `otp_length` from
8 to 6 and `max_frequency` from `1m0s` to `1s`. Both are weaker than what the
project already had, both were pushed because the keys were simply missing
from the local file, and **the output announced them in a diff that looked
like ordinary success.** Same shape as the backup logs that read
`ALL STEPS PASSED` while writing to the wrong folder: every line true, the
overall impression wrong. Both keys are now pinned explicitly and the runbook
says to read the diff before answering yes.

**A storage setting was rejected and this constrains Phase 2.**
`file_size_limit` of 500MiB returned a 402 on the free tier and the storage
config did not apply at all. Now 50MiB, the free ceiling. **The monthly
long-form YouTube video will not fit in 50MiB at any sensible quality**, so
before Phase 2 either the project moves to a paid tier or long-form uploads
bypass that bucket.

**The real architecture document arrived and the schema was reconciled against
it.** `content_status` changed from values invented during the build to the
document's own: `idea, draft, ready, scheduled, posted, failed`. All five
open decisions are resolved and recorded in section 11 of
`docs/architecture.md`. Five further divergences are listed there unresolved,
one of them structural: the document gives `content_items` a single `platform`
where the build has an array. **Phase 1's content intake API depends on which
way that goes and it is not decided.**

**Verified:** working tree clean and in sync with `origin/main` at `192769a`.
`pnpm typecheck` exits 0 locally; CI reports success for both jobs on that same
commit, with all twenty steps individually `success`. The CI timezone assertion
was confirmed to do real work (`INSERT 0 2`, `DO`, `DELETE 2` in its log) and
confirmed to be capable of failing, by running the same block against a
deliberately wrong expected value and watching it raise. RLS was tested against
a table with a row actually in it, since an empty table returns `[]` whether
RLS works or not: the anon key read `[]` and was refused on write with `42501`.
Three `config push` runs to convergence, the third reporting every service
`up_to_date`. All five tables back to 0 rows, one auth user,
`lela@whispersofkindness.ca`, email confirmed. **Not verified:** the app has
never been run, nobody has signed in, and no platform API has been touched.

---

## 2026-09-01 — Social pipeline Phase 0 built, out of phase order, on purpose

**This is not this repo.** A separate project was scaffolded at
`Documents/Whispers of Kindness/whispers-of-kindness-social/`, a sibling of
`site/` and outside it, the same way the working folders sit beside the
project. It is recorded here because this file is where build state is
written down, and because the sequencing decision belongs in the record rather
than only in a conversation.

**It was built ahead of the documented phase sequence.** CLAUDE.md lists
Phase 3 Stripe billing, Phase 4 accounts, Phase 5 member area, Phase 6 archive
browsing. A social posting pipeline is not among them, and the governing rule
is "gather first, build second." The archive holds zero recipes. This was
raised before any work started and Pela decided to proceed anyway, for a
reason that does not fit the phase list: **the Thanksgiving and Christmas
marketing window.** The pipeline has to exist before those dates, and those
dates do not move to accommodate a build order. Same shape of decision as
finishing Phase 2 ahead of gathering because a job was starting.

**What is actually built.** A pnpm monorepo, a five table schema
(`social_accounts`, `content_items`, `assets`, `publish_jobs`,
`activity_log`), Supabase Auth with sign-ups disabled, and CI. There is no
posting logic and no Instagram, Pinterest or YouTube API call anywhere in it.
Those are later phases.

**A separate Supabase project, not new tables in this one.** "Whispers Social
Pipeline" (`fulqsbitynlxjvjyefac`, ca-central-1). No shared tables with
`fulnenhnycaeyzrhplch`, no foreign keys across the boundary. The pipeline
holds social platform tokens, and its credentials must not be able to reach
contributor names, addresses or member records.

**The no-dev-tooling decision was reversed, deliberately.** Node 24.19.0,
pnpm 11.25.0 and the Supabase CLI 2.116.0 are now installed on this machine.
CLAUDE.md still describes it as kept free of developer tooling and that
sentence is now out of date. Pela's call: the machine was set up for these
projects going forward.

**Two gaps left open, neither closed.** The nightly 02:00 backup does not
cover the new repo, and `Export-Database.ps1` points at this project only, so
nothing exports the social pipeline's database. Both are harmless while its
tables are empty and both need closing before real scheduled content exists,
because at that point the content board is the only record of what goes out
and when.

**Verified:** `pnpm install` and `pnpm typecheck` both run clean on this
machine, typecheck exiting 0 across all five packages. The schema was applied
to the live project and the five tables confirmed present. The scheduling
trigger was tested with real rows in both daylight saving states: 9am Pacific
resolved to 16:00Z in July and 17:00Z in November, and read back as 09:00 in
both cases. The two offsets differ, which is the part that matters, since a
hardcoded offset passes one and fails the other. Test rows were deleted after.
**Not verified:** CI has never run, because nothing is pushed to GitHub yet,
and no admin user exists yet.

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
