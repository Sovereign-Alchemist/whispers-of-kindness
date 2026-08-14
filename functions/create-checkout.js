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
// The first 100 members pay the founding rate. Nothing here
// counts members, so nothing here can decide when to stop offering it. That
// switch is Stage 2b or Stage 3 work and needs a decision about where the
// count lives before it can be written. Until then this sells the founding
// rate to everyone, which is wrong at member 101 and harmless at member 4.
//
// The standing prices exist in Stripe and are intentionally unreachable from
// here. They are listed so the mapping is visible in one place.
// ---------------------------------------------------------------------------

// TWO TIERS.
//
//   domestic       a physical card in the post. Canada and the United States.
//   international  the same recipe and story delivered online. Everywhere
//                  else, including the UK and Australia. Decided 9 August
//                  2026: there is no separate physical tier for those two.
//
// The domestic tier sells the FOUNDING rate to everyone, on purpose. The
// promise to the first 100 is RELATIVE, not absolute: they always pay less
// than the rate of the day, rather than being locked to a number that could
// stop covering postage. Nothing here counts members, so
// nothing here can decide when to stop offering it. That switch needs a
// decision about where the count lives before it can be written. Wrong at
// member 101, harmless at member 4.
//
// The international tier has no founding split. The cap exists because early
// members subsidise a physical mailing, and there is no mailing here.

const PRICES = {
  domestic: {
    '3mo': 'price_1U49Bt2eC5FgbTwrexqHKP6R',   // $39.00 CAD, renews every 3 months
    '6mo': 'price_1U49Bt2eC5FgbTwrn7dntiA3',   // $78.00 CAD, renews every 6 months
    '1yr': 'price_1U49Bu2eC5FgbTwrurxeFbMN'    // $148.20 CAD, renews every year
  },
  international: {
    '3mo': 'price_1U49Bv2eC5FgbTwrNE3lQcQl',   // $33.00 CAD, renews every 3 months
    '6mo': 'price_1U49Bv2eC5FgbTwr56JMu0to',   // $66.00 CAD, renews every 6 months
    '1yr': 'price_1U49Bv2eC5FgbTwrtQhBhcUw'    // $125.40 CAD, renews every year
  }
};

// Reachable from member 101 onward. See THE CAP below.
const STANDING = {
  '3mo': 'price_1U49Bu2eC5FgbTwrJ4dRoy3F',   // $45.00 CAD
  '6mo': 'price_1U49Bu2eC5FgbTwrWLlui3Rd',   // $90.00 CAD
  '1yr': 'price_1U49Bu2eC5FgbTwrRWjzNPv3'    // $171.00 CAD
};

// ---------------------------------------------------------------------------
// THE CAP
//
// The founding rate is promised to the first hundred members. Until now
// nothing counted, so member 101 and member 900 would both have been sold it.
//
// Only the domestic tier has a founding rate at all. The international tier
// has no split, because the founding rate thanks people who subsidised a
// physical mailing and there is no mailing in that tier, so none of this runs
// for it and no count is even asked for.
// ---------------------------------------------------------------------------

const FOUNDING_CAP = 100;

// Every member row carrying rate = 'founding' counts, including cancelled
// ones. A founding place is one of the first hundred taken, not one of the
// first hundred still occupied. Somebody who joined early and later left still
// had their place, and freeing it up would mean the hundredth founding member
// changes identity every time somebody cancels.
const FOUNDING_FILTER = 'rate=eq.founding';

// A card gets mailed to a physical address, so the domestic tier has to ask
// for one. Skipping it would produce paid members nobody can post anything to.
//
// The international tier asks for no shipping address at all, because there
// is nothing to ship. Asking would be collecting a home address for no reason,
// and every address held is an address that has to be looked after.
const SHIP_TO = ['CA', 'US'];

// Supabase has two generations of key and they authenticate differently.
// Lifted from submit.js, comment and all, because getting this wrong fails in
// a way nothing reports: the request quietly drops to the anon role, row level
// security hides every table, and a count comes back as zero rather than as an
// error. A silent zero here would sell the founding rate forever.
//
//   sb_secret_...    Current format. NOT a JWT. apikey header only.
//   eyJ... (legacy)  A JWT. PostgREST reads the role from Authorization.
function authHeaders(serviceKey) {
  const headers = { apikey: serviceKey };
  if (!/^sb_(secret|publishable)_/.test(serviceKey)) {
    headers.Authorization = 'Bearer ' + serviceKey;
  }
  return headers;
}

// How many founding places are already taken.
//
// Asked with Prefer: count=exact and limit=0, so Postgres counts server side
// and sends back a header rather than a hundred rows of member data this
// function has no business handling. The answer arrives in Content-Range as
// "*/103", and the part after the slash is the count.
//
// Throws rather than returning a number it is not sure about. A wrong count
// silently sells the wrong price, so the caller has to decide what to do about
// not knowing, and it does, deliberately, below.
async function countFoundingMembers(supabaseUrl, serviceKey) {
  const res = await fetch(
    supabaseUrl + '/rest/v1/member?' + FOUNDING_FILTER + '&select=id&limit=0',
    { headers: { ...authHeaders(serviceKey), Prefer: 'count=exact' } }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error('supabase ' + res.status + ': ' + text.slice(0, 200));
  }

  const range = res.headers.get('content-range') || '';
  const total = range.split('/')[1];
  const count = parseInt(total, 10);

  if (!Number.isFinite(count)) {
    throw new Error('could not read a count from content-range: ' + range);
  }
  return count;
}

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

  // Trimmed, because a key pasted with a trailing newline stays truthy and
  // still passes the sk_test_ check, then fails much later and far less
  // clearly: a newline inside an Authorization header is rejected outright.
  const STRIPE_KEY = (process.env.STRIPE_SECRET_KEY || '').trim();

  // Configuration problem, not the visitor's fault. Names the variable, never
  // reports its value. Same rule as submit.js.
  if (!STRIPE_KEY) {
    console.error('Missing environment variable: STRIPE_SECRET_KEY');
    return reply(500, {
      error: 'Membership is not configured yet. Missing: STRIPE_SECRET_KEY.'
        + ' If this is a deploy preview, check the variable is set for all'
        + ' deploy contexts, not production only.'
    });
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return reply(400, { error: 'Could not read that request.' });
  }

  // Anything that is not explicitly international is treated as domestic, so
  // a malformed or missing tier can only ever fall back to the physical one,
  // which collects an address and cannot silently sell a digital membership
  // to somebody expecting post.
  const tier = (body.tier === 'international') ? 'international' : 'domestic';

  const term = String(body.term || '').trim();

  // Validated against the founding table before the cap is consulted, because
  // a nonsense term should be refused whatever the count says, and refusing it
  // here avoids a pointless round trip to Supabase.
  if (!PRICES[tier][term]) {
    return reply(400, { error: 'Choose a term: 3mo, 6mo or 1yr.' });
  }

  // ---- the founding cap ---------------------------------------------------
  //
  // Domestic only. The international tier has no founding rate to run out of,
  // so it never asks.

  let rate = (tier === 'domestic') ? 'founding' : 'standard';
  let foundingTaken = null;
  let capNote = null;

  if (tier === 'domestic') {
    const SUPABASE_URL = (process.env.SUPABASE_URL || '').trim();
    const SERVICE_KEY  = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

    if (!SUPABASE_URL || !SERVICE_KEY) {
      // Not fatal, on purpose. See the fallback reasoning below: the same
      // argument applies to a missing variable as to an unreachable database.
      capNote = 'supabase not configured, could not count founding members';
      console.error('Founding cap not enforced: ' + capNote);
    } else {
      try {
        foundingTaken = await countFoundingMembers(SUPABASE_URL, SERVICE_KEY);
        if (foundingTaken >= FOUNDING_CAP) rate = 'standing';
      } catch (err) {
        // ---- WHAT TO DO WHEN THE COUNT CANNOT BE READ ---------------------
        //
        // Fall back to FOUNDING, deliberately, and say so loudly in the log.
        //
        // Three options and none of them are free. Refusing the checkout
        // stops somebody joining over a database hiccup. Falling back to
        // standing charges $45 to a person the page has just promised $13,
        // which is the one outcome that breaks a promise rather than costing
        // money. Falling back to founding undercharges by six dollars a
        // quarter, for as long as the outage lasts, to a handful of people.
        //
        // The cheap error is the right one. It also matches what the page
        // says, which matters more than the arithmetic.
        capNote = 'count failed: ' + String(err.message || err).slice(0, 200);
        console.error('Founding cap not enforced, defaulting to founding. ' + capNote);
      }
    }
  }

  const price = (tier === 'domestic' && rate === 'standing')
    ? STANDING[term]
    : PRICES[tier][term];

  if (!price) {
    // Only reachable if the STANDING table ever falls out of step with the
    // founding one. Better a clear refusal than a session created against
    // undefined.
    console.error('No price for tier ' + tier + ', term ' + term + ', rate ' + rate);
    return reply(500, { error: 'Something went wrong on our side. Nothing was charged.' });
  }

  console.log('checkout ' + JSON.stringify({
    tier, term, rate, price,
    founding_taken: foundingTaken,
    founding_cap: FOUNDING_CAP,
    cap_note: capNote
  }));

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
  //
  // The tier travels too, because the thank-you page has to promise the right
  // thing. Telling a digital member their card is in the post would be the
  // first lie the archive ever told them.
  params.set('success_url', origin + '/thank-you.html?session_id={CHECKOUT_SESSION_ID}&tier=' + tier);
  params.set('cancel_url',  origin + '/#membership');

  params.set('billing_address_collection', 'required');

  // Only the physical tier asks where to post to.
  if (tier === 'domestic') {
    SHIP_TO.forEach(function (country, i) {
      params.set('shipping_address_collection[allowed_countries][' + i + ']', country);
    });
  }

  // Carried on the subscription rather than only on the session, because the
  // session is a moment and the subscription is the thing that lasts. When
  // the webhook reads this, it is what says which rate the member joined on,
  // and so which members are owed the founding advantage if prices move.
  //
  // `rate` is the one the cap decided above, not a fixed value. It used to be
  // hardcoded to founding for every domestic checkout, which is exactly the
  // thing being fixed, and leaving it would have written the wrong word onto
  // member 101 even while charging them correctly.
  //
  // The webhook takes the PRICE ID as authoritative and reads this only as a
  // fallback, so the two agreeing is belt and braces rather than load bearing.
  params.set('subscription_data[metadata][rate]', rate);
  params.set('subscription_data[metadata][tier]', tier);
  params.set('subscription_data[metadata][term]', term);
  params.set('subscription_data[metadata][project]', 'Whispers of Kindness');
  params.set('metadata[rate]', rate);
  params.set('metadata[tier]', tier);
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
      // Logged in full, returned in outline.
      //
      // The log is private and is where a future failure gets diagnosed, so
      // it keeps Stripe's own error, the parameter at fault and the request
      // id. The browser gets none of it. Stripe's messages can name price
      // ids and account details, and a visitor cannot act on any of it.
      let err = {};
      try { err = (JSON.parse(text).error) || {}; } catch { /* not JSON */ }

      console.error('Stripe refused the session: ' + JSON.stringify({
        status:     res.status,
        type:       err.type    || null,
        code:       err.code    || null,
        param:      err.param   || null,
        message:    err.message || String(text).slice(0, 300),
        request_id: res.headers.get('request-id') || null,
        price:      price,
        term:       term
      }));

      return reply(502, {
        error: 'Stripe could not start that checkout. Nothing was charged.'
      });
    }

    const session = JSON.parse(text);
    if (!session.url) {
      console.error('Stripe returned a session with no url: ' + JSON.stringify({
        session_id: session.id || null,
        price:      price
      }));
      return reply(502, {
        error: 'Stripe could not start that checkout. Nothing was charged.'
      });
    }

    return reply(200, { url: session.url, id: session.id });

  } catch (err) {
    // A thrown error rather than a refusal: Stripe was never reached, or the
    // reply could not be parsed. Logged separately from a Stripe rejection,
    // because they are different problems and look alike from outside.
    console.error('Checkout session failed: ' + JSON.stringify({
      threw:  err.name || 'Error',
      detail: String(err.message || '').slice(0, 300),
      price:  price,
      term:   term
    }));
    return reply(500, {
      error: 'Something went wrong on our side. Nothing was charged. Please try'
        + ' again, or write to lela@whispersofkindness.ca.'
    });
  }
};
