// WHISPERS OF KINDNESS - what the membership currently costs
//
// Runs on Netlify. Zero dependencies, same as every other function here.
//
// WHY IT EXISTS
//   create-checkout.js stopped selling the founding rate past the hundredth
//   member, but the page went on saying $13 a card to everybody. That is
//   worse than the problem it fixed: a visitor would read $13, click through,
//   and be shown $45 by Stripe. Nobody would be charged wrongly, because
//   Stripe shows the real figure before payment, but it reads as a switch.
//
//   This is the other half. One public, read only answer to "which rate is
//   being sold right now", so the page can say the true number.
//
// WHAT IT DELIBERATELY DOES NOT SAY
//   How many members there are.
//
//   The page only needs to know WHETHER founding places remain, not how many.
//   Publishing a running count would put the size of the membership on the
//   open internet forever, and it cannot be taken back once it is in somebody
//   else's cache. "3 places left" is a nice line and it is also a permanent
//   disclosure of how small this is on any day somebody looks.
//
//   If that line is wanted later it is one field, added on purpose.
//
// WHAT IT IS SAFE TO SERVE PUBLICLY
//   A boolean and a price list. The prices are already printed on the page
//   and are on the Stripe checkout. Nothing here is derived from anybody's
//   personal data, and no row is ever returned: the count is done inside
//   Postgres and only the total crosses the wire, then that total is reduced
//   to true or false before it leaves this function.

// Kept in step with create-checkout.js by hand. Both need it, and a lookup at
// request time would add a second thing that can fail. If one changes, change
// the other, or the page will advertise a rate the checkout will not sell.
const FOUNDING_CAP = 100;
const FOUNDING_FILTER = 'rate=eq.founding';

// The money, in cents, with how many cards each term buys, so the per card
// figure is derived rather than typed twice and allowed to drift.
//
// This is the one place the DISPLAYED numbers live. create-checkout.js holds
// the Stripe price ids that decide what is actually charged. They have to
// agree, and the way to check is the test at the boundary, not a comment.
//
// REPRICED 19 August 2026, and the card count went with it. A term price is
// now the whole of what this tier quotes, so there is nothing left to divide
// and the cards field is gone rather than kept unused. The page has no
// element to write a per card figure into any more either.
//
// 'standing' is still the key here because member.rate still stores that
// word. The site calls it Regular. The two are the same thing and the
// database word is the one that would need a migration to change.
const DISPLAY = {
  founding: {
    '3mo': { cents: 4500  },
    '6mo': { cents: 8500  },
    '1yr': { cents: 16500 }
  },
  standing: {
    '3mo': { cents: 5500  },
    '6mo': { cents: 9500  },
    '1yr': { cents: 17500 }
  }
};

// $45.00, always two decimals, because it is a total somebody is about to pay.
function money(cents) {
  return '$' + (cents / 100).toFixed(2);
}

// perCard was here and is deliberately gone, 19 August 2026, along with the
// per card wording it fed. A helper kept after its last caller is removed is
// a standing invitation to put the thing back.

// Lifted from submit.js, comment and all, because the two generations of key
// authenticate differently and getting it wrong fails silently: the request
// drops to the anon role, row level security hides the table, and the count
// comes back zero rather than as an error.
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
  const count = parseInt(range.split('/')[1], 10);
  if (!Number.isFinite(count)) {
    throw new Error('could not read a count from content-range: ' + range);
  }
  return count;
}

function reply(statusCode, payload) {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json',
      // A minute of staleness is harmless and stops a busy page asking
      // Postgres to count on every single load. At the boundary it means the
      // page can be up to a minute behind, which changes nothing that
      // matters: the checkout counts again for itself when somebody actually
      // joins, and that count is the one that decides the charge.
      'cache-control': 'public, max-age=60'
    },
    body: JSON.stringify(payload)
  };
}

exports.handler = async function () {

  const SUPABASE_URL = (process.env.SUPABASE_URL || '').trim();
  const SERVICE_KEY  = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

  // ---- what happens when the count cannot be read -------------------------
  //
  // Answer founding, the same way create-checkout.js does.
  //
  // The two MUST fail the same way. If the page fell back to standing while
  // the checkout fell back to founding, an outage would make the page quote
  // $55 and Stripe charge $45, which is the mismatch this whole endpoint
  // exists to remove, just pointing the other way.
  //
  // Agreeing matters more than either answer being right.
  let rate = 'founding';
  let degraded = null;

  if (!SUPABASE_URL || !SERVICE_KEY) {
    degraded = 'not configured';
    console.error('membership-status: ' + degraded + ', assuming founding is open');
  } else {
    try {
      const taken = await countFoundingMembers(SUPABASE_URL, SERVICE_KEY);
      if (taken >= FOUNDING_CAP) rate = 'standing';
    } catch (err) {
      degraded = String(err.message || err).slice(0, 200);
      console.error('membership-status: count failed, assuming founding is open. ' + degraded);
    }
  }

  // total only. `each` was a per card figure and this tier no longer quotes
  // one. It is dropped from the response rather than sent and ignored, so
  // that the shape of this answer matches what the page actually uses.
  const table = DISPLAY[rate];
  const terms = {};
  Object.keys(table).forEach(function (term) {
    terms[term] = { total: money(table[term].cents) };
  });

  // `degraded` is reported as a boolean, not as the error text. This response
  // is public, and the reason a database call failed is not.
  return reply(200, {
    rate,
    founding_open: rate === 'founding',
    cap: FOUNDING_CAP,
    terms,
    degraded: Boolean(degraded)
  });
};
