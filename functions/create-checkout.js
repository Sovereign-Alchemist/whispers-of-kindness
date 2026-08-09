// WHISPERS OF KINDNESS - Stage 2, Stripe Checkout
//
// Runs on Netlify. Zero dependencies, same as submit.js: Node 20 has fetch
// built in and Stripe's API is ordinary form-encoded HTTP, so nothing needs
// installing and there is no SDK to keep up to date.
//
// WHAT IT DOES
//   Takes a term (3mo, 6mo, 1yr), creates a Stripe Checkout Session for the
//   matching price, and hands the browser back a URL to redirect to.
//
// WHAT IT DELIBERATELY DOES NOT DO
//   It does not write to Supabase, and there is no webhook yet. That is
//   Stage 3. Until then a completed payment exists in Stripe and nowhere
//   else, which is fine while this is test mode and there are no members,
//   and is the first thing that has to change before real money moves.
//
// WHY A FUNCTION RATHER THAN STRIPE.JS IN THE PAGE
//   Same reason submit.js exists. Creating a Checkout Session needs the
//   secret key. Anything in the page can be read by anyone. The key lives in
//   Netlify's environment and never reaches the browser.

const crypto = require('crypto');

// The account that minted the six price ids, confirmed two ways: every price
// id contains this account's identifier fragment, and a fresh key read from
// Stripe's Test mode reported this account when asked. TEMPORARY, paired with
// the diagnostics below, and removed with them.
const EXPECTED_ACCOUNT = 'acct_1TuaMf2eC5FgbTwr';

// The key is read inside the handler, NOT here at module scope.
//
// Module scope runs once, when the container cold starts. A container that
// started before the environment variable existed would keep the empty value
// it captured then, for as long as it stayed warm, and would go on reporting
// the variable missing after it had been added and the site redeployed. That
// is a real failure mode and it looks exactly like a Netlify problem.
//
// Reading it per request costs nothing measurable and removes that entirely.

// ---------------------------------------------------------------------------
// THE PRICES
//
// Created in Stage 1, test mode, and confirmed in the dashboard. Written out
// here rather than looked up by lookup_key on every request: a checkout that
// depends on two API calls can fail in two places, and these ids do not
// change. When they do change, a price is archived and replaced, and this
// list is the thing that has to be edited. That is deliberate. A price id
// changing should require somebody to notice.
//
// FOUNDING ONLY, ON PURPOSE.
//
// The first 100 members pay the founding rate and keep it. Nothing here
// counts members, so nothing here can decide when to stop offering it. That
// switch is Stage 2b or Stage 3 work and needs a decision about where the
// count lives before it can be written. Until then this sells the founding
// rate to everyone, which is wrong at member 101 and harmless at member 4.
//
// The standing prices exist in Stripe and are intentionally unreachable from
// here. They are listed so the mapping is visible in one place.
// ---------------------------------------------------------------------------

const FOUNDING = {
  '3mo': 'price_1U2Ht52eC5FgbTwr7pISrsOY',   // $39.00 CAD, renews every 3 months
  '6mo': 'price_1U2Ht52eC5FgbTwrrbx9PFtK',   // $78.00 CAD, renews every 6 months
  '1yr': 'price_1U2Ht62eC5FgbTwrxuON9gB0'    // $148.20 CAD, renews every year
};

// Not reachable yet. Here so the six ids live together.
const STANDING = {
  '3mo': 'price_1U2Ht62eC5FgbTwrJJGQWlfe',   // $45.00 CAD
  '6mo': 'price_1U2Ht62eC5FgbTwrpTKZ3hOS',   // $90.00 CAD
  '1yr': 'price_1U2Ht62eC5FgbTwrS4BrgZJH'    // $171.00 CAD
};

// A card gets mailed to a physical address, so Checkout has to ask for one.
// Skipping this would produce paid members nobody can post anything to.
//
// DECISION STILL OPEN: which countries. Canada and the United States are
// here because they are the realistic near-term audience and their postage
// is knowable. Anywhere else is currently refused at checkout. Widening this
// is one line, but it is a postage cost question, not a code question.
const SHIP_TO = ['CA', 'US'];

function reply(statusCode, payload) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  };
}

// The site's own address, taken from the request rather than from a constant,
// so a deploy preview redirects back to the deploy preview instead of to
// production. Stripe requires absolute URLs for both.
function originOf(event) {
  const headers = event.headers || {};
  const host  = headers['x-forwarded-host'] || headers.host;
  const proto = headers['x-forwarded-proto'] || 'https';
  if (host) return proto + '://' + host;
  return process.env.URL || '';
}

// ---------------------------------------------------------------------------
// TEMPORARY DIAGNOSTIC. Added 9 August 2026, REMOVE before going live.
//
// Reports what the running function can actually see, so a missing key stops
// being a matter of opinion. It reports NAMES and LENGTHS only, never a value
// or any part of one. An environment variable name is not a secret; its
// contents are, and none of them travel through here.
//
// The deploy fields matter as much as the key fields. They answer "is the
// deploy I am looking at the deploy I redeployed", which no amount of staring
// at the dashboard can settle.
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// TEMPORARY. Added 9 August 2026, REMOVE with the other diagnostics.
//
// The question these answer is not "is a key present" but "is it THE key".
// Netlify's dashboard shows the last few characters of a stored value, which
// cannot reveal a corruption anywhere else in the string. A one way hash can.
//
// SHA256, first 12 hex characters. The key cannot be recovered from it, and
// two keys differing by a single invisible character produce entirely
// different fingerprints. Computed on the TRIMMED key so it is comparable
// with the local verifier, which also trims. The untrimmed length is
// reported alongside, so stray whitespace shows up as a length gap rather
// than silently changing the answer.
// ---------------------------------------------------------------------------
function fingerprint(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex').slice(0, 12);
}

// Asks the key which account it belongs to. This is the fact the dashboard
// cannot be trusted for, because it reports what was configured rather than
// what the function actually received.
async function whoAmI(key) {
  try {
    const res = await fetch('https://api.stripe.com/v1/account', {
      headers: { Authorization: 'Bearer ' + key }
    });
    const text = await res.text();
    if (!res.ok) {
      let message = String(text).slice(0, 160);
      try { message = JSON.parse(text).error.message; } catch { /* keep raw */ }
      return { account_id: null, account_lookup_status: res.status, account_lookup_error: message };
    }
    return { account_id: (JSON.parse(text).id || null), account_lookup_status: 200 };
  } catch (err) {
    return { account_id: null, account_lookup_error: String(err.message || '').slice(0, 160) };
  }
}

function envDiagnostic() {
  const raw = process.env.STRIPE_SECRET_KEY;
  const isString = (typeof raw === 'string');
  return {
    stripe_names_visible: Object.keys(process.env).filter(function (n) {
      return /STRIPE/i.test(n);
    }).sort(),
    key_defined: Object.prototype.hasOwnProperty.call(process.env, 'STRIPE_SECRET_KEY'),
    key_length: isString ? raw.length : null,
    key_length_trimmed: isString ? raw.trim().length : null,
    context: process.env.CONTEXT || null,
    branch: process.env.BRANCH || null,
    deploy_id: process.env.DEPLOY_ID || null,
    commit: (process.env.COMMIT_REF || '').slice(0, 7) || null
  };
}

exports.handler = async function (event) {

  if (event.httpMethod !== 'POST') {
    return reply(405, { error: 'Use POST.' });
  }

  // Trimmed, because a key pasted with a trailing newline stays truthy and
  // still passes the sk_test_ check, then fails much later and far less
  // clearly: a newline inside an Authorization header is rejected outright.
  const STRIPE_KEY = (process.env.STRIPE_SECRET_KEY || '').trim();

  // Configuration problem, not the visitor's fault. Names the variable, never
  // reports its value. Same rule as submit.js.
  if (!STRIPE_KEY) {
    const diag = envDiagnostic();
    console.error('Missing environment variable: STRIPE_SECRET_KEY. ' + JSON.stringify(diag));
    return reply(500, {
      error: 'Membership is not configured yet. Missing: STRIPE_SECRET_KEY.'
        + ' If this is a deploy preview, check the variable is set for all'
        + ' deploy contexts, not production only.',
      diagnostic: diag
    });
  }

  // ---- the test mode guard ------------------------------------------------
  //
  // Stage 2 is test mode only, so this refuses to run on a live key rather
  // than trusting that nobody swaps the environment variable. It is a
  // deliberate tripwire and it WILL need removing when this goes live, which
  // is the point: going live should be an edit somebody made on purpose, not
  // a variable that quietly started working.
  if (!/^(sk|rk)_test_/.test(STRIPE_KEY)) {
    console.error('STRIPE_SECRET_KEY is not a test key. Refusing to create a session.');
    return reply(500, {
      error: 'Membership is in test mode and the configured key is not a test key.'
        + ' Nothing was charged and no session was created.'
    });
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return reply(400, { error: 'Could not read that request.' });
  }

  const term = String(body.term || '').trim();
  const price = FOUNDING[term];
  if (!price) {
    return reply(400, { error: 'Choose a term: 3mo, 6mo or 1yr.' });
  }

  const origin = originOf(event);
  if (!origin) {
    console.error('Could not work out the site origin from the request headers.');
    return reply(500, { error: 'Something went wrong on our side. Nothing was charged.' });
  }

  // ---- the session --------------------------------------------------------

  const params = new URLSearchParams();
  params.set('mode', 'subscription');
  params.set('line_items[0][price]', price);
  params.set('line_items[0][quantity]', '1');

  // {CHECKOUT_SESSION_ID} is a literal Stripe placeholder, not a template
  // string. Stripe substitutes it on the redirect. It must reach Stripe with
  // the braces intact.
  params.set('success_url', origin + '/thank-you.html?session_id={CHECKOUT_SESSION_ID}');
  params.set('cancel_url',  origin + '/#membership');

  params.set('billing_address_collection', 'required');
  SHIP_TO.forEach(function (country, i) {
    params.set('shipping_address_collection[allowed_countries][' + i + ']', country);
  });

  // Carried on the subscription rather than only on the session, because the
  // session is a moment and the subscription is the thing that lasts. When
  // Stage 3 reads a webhook, this is what says which rate the member joined
  // on, which is the whole meaning of "kept for life".
  params.set('subscription_data[metadata][rate]', 'founding');
  params.set('subscription_data[metadata][term]', term);
  params.set('subscription_data[metadata][project]', 'Whispers of Kindness');
  params.set('metadata[rate]', 'founding');
  params.set('metadata[term]', term);

  try {
    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + STRIPE_KEY,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    const text = await res.text();

    if (!res.ok) {
      // TEMPORARY DIAGNOSTIC, added 9 August 2026, REMOVE before going live,
      // together with the one on the missing-key path.
      //
      // Stripe's own error is returned to the browser here as well as logged.
      // That is a deliberate reversal of the original comment on this block.
      // What it can name is a price id, a parameter name and a request id.
      // None of those are credentials: a price id appears in the page in most
      // Stripe integrations, and a request id is only useful to somebody
      // already signed in to the account. The secret key is never touched.
      let err = {};
      try { err = (JSON.parse(text).error) || {}; } catch { /* not JSON */ }

      // TEMPORARY. Identifies the key the RUNTIME received, as opposed to the
      // one the dashboard says was configured. Hash and account id only: the
      // value itself is never read into this, logged, or returned.
      const rawKey = process.env.STRIPE_SECRET_KEY || '';
      const identity = await whoAmI(STRIPE_KEY);

      const diag = {
        stripe_status:  res.status,
        stripe_type:    err.type    || null,
        stripe_code:    err.code    || null,
        stripe_param:   err.param   || null,
        stripe_message: err.message || String(text).slice(0, 300),
        request_id:     res.headers.get('request-id') || null,
        price_attempted: price,
        term_attempted:  term,
        mode: 'subscription',
        ship_to: SHIP_TO.join(','),

        // who is this key, really
        key_prefix:        STRIPE_KEY.slice(0, 11),
        key_length:        STRIPE_KEY.length,
        key_length_raw:    rawKey.length,
        key_fingerprint:   fingerprint(STRIPE_KEY),
        account_id:        identity.account_id,
        account_expected:  EXPECTED_ACCOUNT,
        account_matches:   (identity.account_id === EXPECTED_ACCOUNT),
        account_lookup_status: identity.account_lookup_status || null,
        account_lookup_error:  identity.account_lookup_error  || null
      };

      console.error('Stripe refused the session: ' + JSON.stringify(diag));
      return reply(502, {
        error: 'Stripe could not start that checkout. Nothing was charged.',
        diagnostic: diag
      });
    }

    const session = JSON.parse(text);
    if (!session.url) {
      const diag = {
        stripe_status: res.status,
        note: 'session created but carried no url',
        session_id: session.id || null,
        price_attempted: price
      };
      console.error('Stripe returned a session with no url: ' + JSON.stringify(diag));
      return reply(502, {
        error: 'Stripe could not start that checkout. Nothing was charged.',
        diagnostic: diag
      });
    }

    return reply(200, { url: session.url, id: session.id });

  } catch (err) {
    // TEMPORARY diagnostic, same removal as the other two. This path is a
    // thrown error rather than a refusal: Stripe was never reached, or the
    // reply could not be parsed. Naming it separately keeps it from being
    // confused with a Stripe rejection, which is a different problem.
    const diag = {
      threw: err.name || 'Error',
      detail: String(err.message || '').slice(0, 300),
      price_attempted: price,
      term_attempted: term
    };
    console.error('Checkout session failed: ' + JSON.stringify(diag));
    return reply(500, {
      error: 'Something went wrong on our side. Nothing was charged. Please try'
        + ' again, or write to lela@whispersofkindness.ca.',
      diagnostic: diag
    });
  }
};
