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

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;

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

exports.handler = async function (event) {

  if (event.httpMethod !== 'POST') {
    return reply(405, { error: 'Use POST.' });
  }

  // Configuration problem, not the visitor's fault. Names the variable, never
  // reports its value or its length. Same rule as submit.js.
  if (!STRIPE_KEY) {
    console.error('Missing environment variable: STRIPE_SECRET_KEY');
    return reply(500, {
      error: 'Membership is not configured yet. Missing: STRIPE_SECRET_KEY.'
        + ' If this is a deploy preview, check the variable is set for all'
        + ' deploy contexts, not production only.'
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
      // Stripe's message is logged for us and deliberately not returned to
      // the browser, because it can name price ids and account details.
      let detail = text;
      try { detail = JSON.parse(text).error.message; } catch { /* keep raw */ }
      console.error('Stripe refused the session (' + res.status + '): ' + detail);
      return reply(502, {
        error: 'Stripe could not start that checkout. Nothing was charged.'
      });
    }

    const session = JSON.parse(text);
    if (!session.url) {
      console.error('Stripe returned a session with no url: ' + session.id);
      return reply(502, { error: 'Stripe could not start that checkout. Nothing was charged.' });
    }

    return reply(200, { url: session.url, id: session.id });

  } catch (err) {
    console.error('Checkout session failed:', err.message);
    return reply(500, {
      error: 'Something went wrong on our side. Nothing was charged. Please try'
        + ' again, or write to lela@whispersofkindness.ca.'
    });
  }
};
