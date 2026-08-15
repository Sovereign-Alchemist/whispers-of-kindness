# Functions

Server-side code. Netlify runs these on its own machines. It does not serve the
source, so nothing in this folder is readable from the internet.

Five of them now: `submit.js` and `finalize.js` take recipes in,
`create-checkout.js` and `stripe-webhook.js` handle membership, and
`membership-status.js` tells the page what the current prices are.

## Why anything lives here at all

The submission form has to write to Supabase, and every table is locked by row
level security with no policies. There are two ways to allow a write, and only
one of them is safe:

**Let the browser write directly.** This needs an INSERT policy for the `anon`
key. But the `anon` key ships inside the page where anyone can read it, so
anyone could then insert unlimited rows straight into the contributor table.
There is no gate.

**Let a function write.** The function holds the `service_role` key, which lives
only in Netlify's environment variables. Row level security stays at zero
policies across all eight tables. The function is the only writer, so it can
check what it is given and refuse what it does not like.

The second one. Which is why this folder exists.

## Two things to know before writing one

**No keys in this folder.** Read them from `process.env`. Netlify supplies them
at run time. See the note in the root README about why a committed secret is
worse than one in a local file.

**Uploads do not pass through here.** Netlify caps a function request body at
roughly 6MB and times it out after 10 seconds. An elder telling the story behind
a recipe can easily be a 30MB audio file. So the function hands out short-lived
signed upload URLs and the browser sends the file straight to storage. Same
security, no size ceiling.

## Environment variables

All set in Netlify, none in this folder, none in the repo.

| Name | Required | Used by |
|---|---|---|
| `SUPABASE_URL` | yes | all of them |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | all of them |
| `STRIPE_SECRET_KEY` | yes | create-checkout, stripe-webhook |
| `STRIPE_WEBHOOK_SECRET` | yes | stripe-webhook |
| `RESEND_API_KEY` | **no** | stripe-webhook, for the failed-payment alert |
| `ALERT_FROM` | no | defaults to `Whispers of Kindness <alerts@whispersofkindness.ca>` |
| `ALERT_TO` | no | defaults to `lela@whispersofkindness.ca` |

`RESEND_API_KEY` is deliberately optional. The required list makes the webhook
answer 500 to everything when something on it is missing, which is right for a
database key and wrong for a mail key: a successful payment must not be refused
because an email about a different member could not be sent. Without it,
failed payments are still recorded and the member is still marked `past_due`.
Nobody is told, and the log and the reply both say so.

**A variable added to Netlify is not visible until the next deploy.** Netlify
fixes the function environment when the deploy is built. Adding a key and
expecting the running function to pick it up is the single most common way to
lose an hour here. Open the function address in a browser: it answers with
`ready`, `missing`, and whether alerting is configured, without disclosing any
value.

### The alert needs Resend set up before it can send

Setting the key is not enough on its own. Resend will not send from a domain it
has not verified, and the failure comes back as a 403 that looks like a bad key.

1. A Resend account.
2. `whispersofkindness.ca` added as a sending domain, and the DKIM and SPF
   records it gives you added to the DNS. Verification is not instant.
3. The API key into Netlify as `RESEND_API_KEY`.
4. A fresh deploy.

Until step 2 is done, either point `ALERT_FROM` at a sender Resend already
accepts, or expect a 403 with the reason quoted in the webhook's reply.
