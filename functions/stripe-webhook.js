// WHISPERS OF KINDNESS - Stage 3, the membership webhook
//
// Runs on Netlify. Zero dependencies, same as submit.js and create-checkout.js.
// Node 20 has fetch and crypto built in, and both Stripe's API and Supabase's
// are ordinary HTTP, so there is no SDK to install and none to keep current.
//
// WHAT IT DOES
//   Stripe calls this address when something happens to a membership. Every
//   call is proved to have come from Stripe before anything else happens.
//
//     checkout.session.completed  somebody joined. Writes the member row and
//                                 links any recipe they had already sent in.
//     invoice.paid                a term renewed. Records it and moves the
//                                 member's current period forward.
//     invoice.payment_failed      a card was declined. Marks the member
//                                 past_due so the archive stops saying they
//                                 are fine, and emails Pela one line about it.
//
//   Each has its own handler and its own ledger table. They do not share
//   state, and the two ledgers are deliberately separate: renewal_count is
//   derived by counting renewal rows, so a failure recorded alongside them
//   would read as a renewal and advance somebody through a term they never
//   paid for.
//
//   Both invoice handlers share one more thing. If either finds an invoice for
//   a subscription no member row holds, it emails about it and creates
//   nothing. Somebody is being charged and is not in the archive, and an
//   invoice does not carry the postal address that would be needed to record
//   them properly. See alertOrphanSubscription.
//
//   The email is the only thing this function sends anywhere other than
//   Supabase and Stripe. It is a stopgap until the daily digest exists, and it
//   is built so that it cannot take the webhook down with it: see sendAlert.
//
// WHY IT EXISTS
//   Until now a completed payment existed in Stripe and nowhere else. Money
//   moved and the archive did not know. This is the piece that closes that.
//
// WHAT IT DELIBERATELY DOES NOT DO
//   It does not touch the submission intake. submit.js and finalize.js are
//   untouched by this stage. See THE GAP at the bottom of this file, which is
//   a real limitation and is documented rather than worked around.

const crypto = require('crypto');

const STRIPE_API = 'https://api.stripe.com/v1';

// How far out of step Stripe's clock and ours may be before a signature is
// refused. Five minutes is Stripe's own recommendation. It is what stops
// somebody capturing a genuine, correctly signed request and replaying it
// tomorrow.
const TOLERANCE_SECONDS = 300;

// ---------------------------------------------------------------------------
// WHAT EACH PRICE MEANS
//
// This is the answer to "how should founding versus standing be decided", and
// the answer is that it is already decided, by the price the subscription was
// created against.
//
// Founding and standing are different Stripe prices with different IDs. When
// somebody pays, Stripe knows exactly which one they paid, and reports it. So
// the rate is read off the completed checkout, not inferred.
//
// The alternative was counting members at webhook time and calling the first
// hundred founding. That is a race. Two people paying in the same second would
// both count 99 and both be recorded as founding, and the hundredth place
// would be sold twice. Reading the price has no such window: the price was
// fixed when the session was created, minutes earlier, one at a time.
//
// The standing prices are listed even though nothing sells them yet. The day
// they are switched on, this function already understands them. A price that
// arrives and is not in this table is handled, loudly, further down.
//
// Kept in step with create-checkout.js by hand. Both files carry the same
// ids because both need them for different reasons, and a lookup at request
// time would add a second thing that can fail.
// ---------------------------------------------------------------------------

const PRICE_FACTS = {
  // The Mailing, posted. Canada and the United States. Founding rate.
  'price_1U49Bt2eC5FgbTwrexqHKP6R': { tier: 'mailing', rate: 'founding', term: '3mo', format: 'print' },
  'price_1U49Bt2eC5FgbTwrn7dntiA3': { tier: 'mailing', rate: 'founding', term: '6mo', format: 'print' },
  'price_1U49Bu2eC5FgbTwrurxeFbMN': { tier: 'mailing', rate: 'founding', term: '1yr', format: 'print' },

  // The Mailing, posted. Standing rate. Not reachable from the site yet.
  'price_1U49Bu2eC5FgbTwrJ4dRoy3F': { tier: 'mailing', rate: 'standing', term: '3mo', format: 'print' },
  'price_1U49Bu2eC5FgbTwrWLlui3Rd': { tier: 'mailing', rate: 'standing', term: '6mo', format: 'print' },
  'price_1U49Bu2eC5FgbTwrRWjzNPv3': { tier: 'mailing', rate: 'standing', term: '1yr', format: 'print' },

  // International digital. No founding split, so rate is null rather than a
  // guess. The founding rate thanks people who subsidised a physical mailing,
  // and there is no mailing in this tier.
  'price_1U49Bv2eC5FgbTwrNE3lQcQl': { tier: 'mailing_intl', rate: null, term: '3mo', format: 'digital' },
  'price_1U49Bv2eC5FgbTwr56JMu0to': { tier: 'mailing_intl', rate: null, term: '6mo', format: 'digital' },
  'price_1U49Bv2eC5FgbTwrtQhBhcUw': { tier: 'mailing_intl', rate: null, term: '1yr', format: 'digital' }
};


// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function reply(statusCode, payload) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  };
}

// Everything this function logs goes here, so a single line in the Netlify log
// tells the whole story of one delivery. Server side only. Stripe is the only
// caller and it does not read the body, so nothing here is ever seen by a
// person on the website.
function log(outcome, detail) {
  console.log('stripe-webhook ' + outcome + ' ' + JSON.stringify(detail));
}


// ---------------------------------------------------------------------------
// Proving the call came from Stripe
//
// This address is public. Anything on the internet can POST to it, and a
// forged "somebody paid" would write a free member into the archive. The
// signature is the only thing standing between those two situations, so it is
// checked before the body is even parsed.
//
// Stripe signs the timestamp and the RAW body together. Raw matters: parsing
// and re-serialising JSON changes key order and whitespace, and the signature
// would no longer match anything.
// ---------------------------------------------------------------------------

function parseSignatureHeader(header) {
  const out = { t: null, v1: [] };
  String(header || '').split(',').forEach(function (part) {
    const at = part.indexOf('=');
    if (at < 0) return;
    const key = part.slice(0, at).trim();
    const value = part.slice(at + 1).trim();
    if (key === 't') out.t = value;
    if (key === 'v1') out.v1.push(value);
  });
  return out;
}

// Constant time, so the comparison itself does not leak how much of a guess
// was correct. timingSafeEqual throws on a length mismatch, which would be an
// answer in itself, so lengths are checked first and separately.
function safeEqualHex(a, b) {
  const bufA = Buffer.from(String(a), 'utf8');
  const bufB = Buffer.from(String(b), 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function verifySignature(rawBody, header, secret) {
  const parsed = parseSignatureHeader(header);
  if (!parsed.t || !parsed.v1.length) {
    return { ok: false, reason: 'signature header malformed or absent' };
  }

  const timestamp = parseInt(parsed.t, 10);
  if (!Number.isFinite(timestamp)) {
    return { ok: false, reason: 'signature timestamp unreadable' };
  }

  const age = Math.floor(Date.now() / 1000) - timestamp;
  if (Math.abs(age) > TOLERANCE_SECONDS) {
    return { ok: false, reason: 'signature timestamp outside tolerance, age ' + age + 's' };
  }

  const expected = crypto
    .createHmac('sha256', secret)
    .update(parsed.t + '.' + rawBody, 'utf8')
    .digest('hex');

  // Stripe sends more than one v1 when a secret is being rotated. Any one
  // matching is a genuine event.
  const matched = parsed.v1.some(function (candidate) {
    return safeEqualHex(candidate, expected);
  });

  return matched ? { ok: true } : { ok: false, reason: 'no matching signature' };
}


// ---------------------------------------------------------------------------
// Supabase
//
// Lifted from submit.js on purpose, including the comment, because the two
// generations of key authenticate differently and getting it wrong fails in a
// way nothing reports: the request quietly drops to the anon role, row level
// security hides every table, and the write vanishes without an error.
//
//   sb_secret_...    Current format. NOT a JWT. apikey header only.
//   eyJ... (legacy)  A JWT. PostgREST reads the role from Authorization.
// ---------------------------------------------------------------------------

function authHeaders(serviceKey) {
  const headers = { apikey: serviceKey };
  if (!/^sb_(secret|publishable)_/.test(serviceKey)) {
    headers.Authorization = 'Bearer ' + serviceKey;
  }
  return headers;
}

async function db(url, key, path, options = {}) {
  const res = await fetch(url + '/rest/v1/' + path, {
    ...options,
    headers: {
      ...authHeaders(key),
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(options.headers || {})
    }
  });
  const text = await res.text();
  if (!res.ok) {
    const err = new Error('supabase ' + res.status + ': ' + text);
    err.status = res.status;
    err.body = text;
    throw err;
  }
  return text ? JSON.parse(text) : null;
}


// ---------------------------------------------------------------------------
// TELLING SOMEBODY
//
// One line of email when a card is declined. A stopgap until the daily digest
// exists, and deliberately the smallest thing that closes the gap: no
// formatting, no batching, no rolling window, one recipient.
//
// THIS FUNCTION NEVER THROWS, and that is the whole design.
//
//   Stripe reads the HTTP status and nothing else. A 500 means "I did not get
//   this, send it again", so if a Resend outage were allowed to escape as an
//   exception, every declined card would answer 500, Stripe would retry the
//   delivery, the ledger insert would come back 409, and the whole thing would
//   go round again on Stripe's schedule for days. An email that failed to send
//   would have turned a recorded, correctly handled payment failure into a
//   webhook that looks broken.
//
//   So the mail result is DATA, not control flow. It gets logged and returned
//   in the body. The database work has already happened and stands on its own.
//
// THE TIMEOUT is the same reasoning one step further. Netlify gives a function
// ten seconds total, and the failure handler already spends up to four
// Supabase round trips. A Resend call that hangs would eat the rest of the
// budget and take the whole delivery down with it, which is the outcome the
// try/catch exists to prevent. Four seconds, then give up and say so.
// ---------------------------------------------------------------------------

const RESEND_API = 'https://api.resend.com/emails';
const ALERT_TIMEOUT_MS = 4000;

async function sendAlert(subject, text, cfg) {
  if (!cfg.RESEND_KEY) {
    return { sent: false, reason: 'RESEND_API_KEY is not set' };
  }

  try {
    const res = await fetch(RESEND_API, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + cfg.RESEND_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: cfg.ALERT_FROM,
        to: [cfg.ALERT_TO],
        subject: subject,
        text: text
      }),
      signal: AbortSignal.timeout(ALERT_TIMEOUT_MS)
    });

    const body = await res.text();

    if (!res.ok) {
      // 403 here is almost always the sending domain not being verified yet.
      // 422 is usually a from address on a domain Resend does not know.
      return { sent: false, reason: 'resend ' + res.status + ': ' + body.slice(0, 200) };
    }

    let id = null;
    try { id = (JSON.parse(body) || {}).id || null; } catch (e) { }
    return { sent: true, id: id };

  } catch (err) {
    // AbortSignal.timeout produces a TimeoutError here. So does DNS failing,
    // Resend being unreachable, and anything else. All of them mean the same
    // thing to this function: no email, carry on, say so in the log.
    return { sent: false, reason: String(err.message || err).slice(0, 200) };
  }
}


// ---------------------------------------------------------------------------
// AN INVOICE FOR A SUBSCRIPTION NOBODY HOLDS
//
// Stripe is billing somebody this database has never heard of. That is the one
// failure mode where everything looks fine from every angle except the one
// nobody is looking at: the card is charged, Stripe shows an active member, and
// the archive does not know they exist.
//
// checkout.session.completed is the ONLY event that creates a member. It has
// three outcomes that answer 200 and write nothing: no session id, not paid at
// that moment, and no email on the session. Every one of them is deliberate and
// correct as a response to that event. None of them leaves a trace anybody
// reads. The renewal that arrives months later finds no member, and the one
// after that, forever.
//
// WHY THIS ONLY TELLS SOMEBODY, and does not create the member itself.
//
//   A domestic membership needs a real postal address to be fulfillable, and
//   that address exists only on the original checkout session. An invoice does
//   not carry it. A member row invented at renewal time would look complete in
//   every list and query while being unmailable, which is worse than the gap it
//   replaced, because the gap is at least visible once somebody looks.
//
//   One policy for both tiers, deliberately. The international tier could be
//   rebuilt from an invoice, since it needs no address. Splitting the rule by
//   tier would mean two behaviours to remember and one of them silently
//   different, to save a human reading one email.
//
// NEVER THROWS, because sendAlert never throws. The email is data, not control
// flow. A Resend outage must not turn a correctly handled invoice into a 500
// that Stripe retries for days.
// ---------------------------------------------------------------------------

async function alertOrphanSubscription(details, cfg) {
  const subject = 'Whispers: a payment for somebody with no member record';

  // Written to be read on a phone, by the person who has to act on it. It says
  // what happened, what it means, and what to do, in that order.
  const lines = [
    'Stripe took a payment for a subscription that has no matching member row.',
    '',
    'The money is fine. Stripe is billing correctly. What is missing is the',
    'record on our side, so this person is not in the archive, not in any',
    'count, and would not receive anything that gets mailed.',
    '',
    'subscription : ' + (details.subscriptionId || 'unknown'),
    'invoice      : ' + (details.invoiceId || 'unknown'),
    'event        : ' + (details.eventType || 'unknown'),
    'stripe event : ' + (details.eventId || 'unknown'),
    '',
    'WHAT TO DO',
    '',
    '1. Open the subscription in Stripe and find the original checkout',
    '   session on it. The customer name, email and shipping address are',
    '   there. An invoice does not carry the address, which is why this is',
    '   an email to you rather than a row this function wrote by itself.',
    '',
    '2. Check whether the member row really is missing before doing anything',
    '   else. Use the SQL editor, not the Table Editor. The Table Editor has',
    '   served a stale cached view and shown nothing where a row existed.',
    '',
    '     select * from member',
    '     where stripe_subscription_id = \'' + (details.subscriptionId || '') + '\';',
    '',
    '3. If it is genuinely missing, add the member by hand from the checkout',
    '   session, including the shipping address for a posted membership.',
    '',
    'This is rare by design. It means checkout.session.completed did not',
    'create the member when they joined, so the reason is worth finding in',
    'the Netlify function log for the day they signed up.'
  ];

  const result = await sendAlert(subject, lines.join('\n'), cfg);

  log('orphan-subscription-alert', {
    id: details.eventId,
    invoice: details.invoiceId,
    subscription: details.subscriptionId,
    event_type: details.eventType,
    alert_sent: result.sent,
    alert_reason: result.sent ? null : result.reason
  });

  return result;
}


// ---------------------------------------------------------------------------
// Reading the session
// ---------------------------------------------------------------------------

// The session that arrives on the event does not carry its line items, and
// the line item is where the price id lives. One retrieval, expanded, gets the
// authoritative answer rather than trusting metadata we wrote ourselves.
async function retrieveSession(sessionId, stripeKey) {
  const res = await fetch(
    STRIPE_API + '/checkout/sessions/' + encodeURIComponent(sessionId) +
      '?expand[]=line_items',
    { headers: { Authorization: 'Bearer ' + stripeKey } }
  );
  const text = await res.text();
  if (!res.ok) {
    const err = new Error('stripe ' + res.status + ': ' + text.slice(0, 300));
    err.status = res.status;
    throw err;
  }
  return JSON.parse(text);
}

// Stripe has moved shipping details around between API versions, so this looks
// in each place rather than assuming one. Billing address is the last resort
// and only for the physical tier, where having an approximate address beats
// having none and discovering it at the post office.
function addressFrom(session) {
  const collected = session.collected_information || {};
  const shipping =
    collected.shipping_details ||
    session.shipping_details ||
    null;

  if (shipping && shipping.address) {
    return { name: shipping.name || null, address: shipping.address, source: 'shipping' };
  }

  const customer = session.customer_details || {};
  if (customer.address) {
    return { name: customer.name || null, address: customer.address, source: 'billing' };
  }
  return null;
}

// member.shipping_address is a single text column, and this is a label that
// has to be legible on an envelope. Written the way it would be handwritten,
// one element per line, blanks dropped rather than printed empty.
function formatAddress(name, address) {
  const lines = [];
  if (name) lines.push(name);
  if (address.line1) lines.push(address.line1);
  if (address.line2) lines.push(address.line2);

  const townLine = [address.city, address.state].filter(Boolean).join(', ');
  const withPostal = [townLine, address.postal_code].filter(Boolean).join(' ');
  if (withPostal) lines.push(withPostal);

  if (address.country) lines.push(address.country);
  return lines.length ? lines.join('\n') : null;
}


// ---------------------------------------------------------------------------
// RENEWALS
//
// checkout.session.completed fires once, on the first payment, and never
// again. Without this, a member who has happily auto renewed twice still
// reads as sitting two terms past where they started, because nothing ever
// told the database anything happened.
//
// WHICH INVOICES ARE RENEWALS
//
//   subscription_create  the FIRST invoice, raised alongside the checkout.
//                        Ignored here, because checkout.session.completed has
//                        already recorded it. Counting it would make every
//                        member appear to renew the moment they joined.
//   subscription_cycle   a genuine renewal. The only one acted on.
//   subscription_update  a plan or quantity change mid term. Not a renewal.
//   manual, upcoming     not renewals either.
//
// Anything that is not subscription_cycle is acknowledged and dropped.
// ---------------------------------------------------------------------------

// Stripe moved the subscription reference on an invoice in the 2025-03-31 API
// version, from invoice.subscription to invoice.parent.subscription_details.
// Which one arrives depends on the API version the endpoint is pinned to, and
// that is a setting nobody should have to remember. Both are read, plus the
// line item, which carries it in newer versions again.
function subscriptionIdFrom(invoice) {
  if (typeof invoice.subscription === 'string') return invoice.subscription;

  const details = (invoice.parent || {}).subscription_details || {};
  if (typeof details.subscription === 'string') return details.subscription;

  const lines = (invoice.lines && invoice.lines.data) || [];
  for (const line of lines) {
    if (typeof line.subscription === 'string') return line.subscription;
    const itemDetails = (line.parent || {}).subscription_item_details || {};
    if (typeof itemDetails.subscription === 'string') return itemDetails.subscription;
  }
  return null;
}

// The start of the period this invoice pays for, as a unix timestamp.
//
// The line item is preferred over the invoice. An invoice can carry more than
// one period when something was prorated, and the subscription line is the one
// that describes the term actually being renewed.
function periodStartFrom(invoice) {
  const lines = (invoice.lines && invoice.lines.data) || [];
  for (const line of lines) {
    if (line.period && Number.isFinite(line.period.start)) return line.period.start;
  }
  if (Number.isFinite(invoice.period_start)) return invoice.period_start;
  return null;
}

function dateFromUnix(seconds) {
  return new Date(seconds * 1000).toISOString().slice(0, 10);
}

async function handleRenewal(stripeEvent, cfg) {
  // Only the two database values are pulled out here. cfg is passed whole to
  // alertOrphanSubscription, which reads the Resend settings off it, so adding
  // a mail key never means threading another argument through this function.
  const { SUPABASE_URL, SERVICE_KEY } = cfg;
  const eventId = stripeEvent.id;
  const invoice = (stripeEvent.data && stripeEvent.data.object) || {};
  const reason = invoice.billing_reason || null;

  if (reason !== 'subscription_cycle') {
    log('ignored-billing-reason', {
      id: eventId, invoice: invoice.id || null, billing_reason: reason
    });
    return reply(200, { ignored: 'billing_reason ' + reason });
  }

  const invoiceId = invoice.id;
  if (!invoiceId) {
    log('no-invoice-id', { id: eventId });
    return reply(200, { ignored: 'invoice carried no id' });
  }

  const subscriptionId = subscriptionIdFrom(invoice);
  if (!subscriptionId) {
    log('no-subscription-id', { id: eventId, invoice: invoiceId });
    return reply(200, { ignored: 'invoice carried no subscription' });
  }

  const periodStartUnix = periodStartFrom(invoice);
  const periodStart = periodStartUnix ? dateFromUnix(periodStartUnix) : null;

  let stage = 'find-member';

  try {
    const members = await db(SUPABASE_URL, SERVICE_KEY,
      'member?stripe_subscription_id=eq.' + encodeURIComponent(subscriptionId) +
      '&select=id,current_period_start,renewal_count,subscription_status');

    if (!members || !members.length) {
      // A renewal for a subscription this database has never heard of. Not an
      // error to retry: the member was probably created before the webhook
      // existed, or in a different Stripe account. 200 and a loud log.
      //
      // The log was the whole response until now, and nothing reads a log
      // unprompted. Somebody is being charged and is not in the archive, so
      // this one gets an email as well. See alertOrphanSubscription.
      log('renewal-unknown-subscription', {
        id: eventId, invoice: invoiceId, subscription: subscriptionId
      });

      const alert = await alertOrphanSubscription({
        eventId, invoiceId, subscriptionId, eventType: 'invoice.paid'
      }, cfg);

      return reply(200, {
        ignored: 'no member holds that subscription',
        alerted: alert.sent,
        alert_reason: alert.sent ? null : alert.reason
      });
    }

    const member = members[0];

    // ---- the ledger, which is the real duplicate guard --------------------
    //
    // A unique index on a column of `member` would NOT stop a double count.
    // Rewriting the same value into the same row does not violate uniqueness,
    // so a retry would still increment. The guard has to be a row that can
    // only exist once, and that is what this is.
    //
    // It also survives the case a "last invoice seen" column cannot: an
    // invoice arriving again AFTER a later one has been processed. That is
    // unlikely in production, where cycles are months apart, and entirely
    // likely while testing, where the same test event gets fired repeatedly
    // and out of order.

    stage = 'renewal-ledger';
    let alreadyRecorded = false;

    try {
      await db(SUPABASE_URL, SERVICE_KEY, 'member_renewal', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          member_id: member.id,
          stripe_invoice_id: invoiceId,
          stripe_subscription_id: subscriptionId,
          period_start: periodStart,
          billing_reason: reason
        })
      });
    } catch (ledgerError) {
      if (ledgerError.status !== 409) throw ledgerError;
      alreadyRecorded = true;
    }

    // ---- the count is DERIVED, not incremented ----------------------------
    //
    // Counting the ledger rather than adding one to a stored number means a
    // delivery that wrote the ledger row and then failed before updating the
    // member repairs itself on the retry, instead of leaving the count one
    // short forever. It also cannot drift.

    stage = 'renewal-count';
    const ledger = await db(SUPABASE_URL, SERVICE_KEY,
      'member_renewal?member_id=eq.' + member.id + '&select=id');
    const renewalCount = (ledger || []).length;

    // ---- move the period forward, never backward --------------------------
    //
    // Re-firing an older invoice must not drag current_period_start back to a
    // date the member has already lived through, which would make the
    // lifecycle view report a month they are no longer in.

    stage = 'renewal-update';
    const patch = { renewal_count: renewalCount };

    const advances = periodStart && (
      !member.current_period_start || periodStart > member.current_period_start
    );
    if (advances) patch.current_period_start = periodStart;

    // ---- coming back from a failed payment --------------------------------
    //
    // A declined card that Stripe successfully retries fires invoice.paid for
    // the SAME invoice that fired invoice.payment_failed a few days earlier.
    // Money arrived, so the member is active again, and without this they
    // would stay past_due forever and the view would go on reporting a
    // problem that resolved itself.
    //
    // ONLY past_due is lifted. Not cancelled, not paused, not pending. Those
    // are decisions somebody made, and a payment landing is not grounds for a
    // webhook to overrule any of them.
    const recovered = member.subscription_status === 'past_due';
    if (recovered) patch.subscription_status = 'active';

    await db(SUPABASE_URL, SERVICE_KEY, 'member?id=eq.' + member.id, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify(patch)
    });

    log('renewal-ok', {
      id: eventId,
      invoice: invoiceId,
      subscription: subscriptionId,
      member: member.id,
      outcome: alreadyRecorded ? 'already-recorded' : 'recorded',
      period_start: periodStart,
      period_advanced: Boolean(advances),
      recovered_from_past_due: recovered,
      renewal_count: renewalCount
    });

    return reply(200, {
      received: true,
      member: member.id,
      renewal_count: renewalCount,
      subscription_status: recovered ? 'active' : member.subscription_status,
      recovered_from_past_due: recovered,
      outcome: alreadyRecorded ? 'already-recorded' : 'recorded'
    });

  } catch (err) {
    const detail = String(err.message || err).slice(0, 400);
    log('renewal-failed', { id: eventId, invoice: invoiceId, stage, error: detail });
    return reply(500, { error: 'Could not record that renewal.', stage, detail });
  }
}


// ---------------------------------------------------------------------------
// FAILED PAYMENTS
//
// Before this, a declined card produced nothing at all. The member went on
// reading 'active', the lifecycle view went on saying "month 2 of 3", and the
// only way to learn otherwise was to open Stripe and go looking. This does not
// tell anybody. It makes the database stop saying something untrue.
//
// WHICH INVOICES COUNT, and why this is deliberately different from renewals
//
//   handleRenewal acts ONLY on subscription_cycle, because anything else
//   counted there would inflate renewal_count and march a member through terms
//   they never paid for.
//
//   This one acts on EVERY billing reason, because there is no counter to
//   inflate. Nothing here is derived from how many failures there are. A
//   subscription_create invoice failing means money did not arrive just as
//   surely as a subscription_cycle one failing, and refusing to notice it
//   because of its label would be recreating the exact silence this closes.
//
//   The billing reason is recorded, so the distinction is still available to
//   anybody reading the ledger later.
// ---------------------------------------------------------------------------

async function handlePaymentFailure(stripeEvent, cfg) {
  const { SUPABASE_URL, SERVICE_KEY } = cfg;
  const eventId = stripeEvent.id;
  const invoice = (stripeEvent.data && stripeEvent.data.object) || {};

  const invoiceId = invoice.id;
  if (!invoiceId) {
    log('failure-no-invoice-id', { id: eventId });
    return reply(200, { ignored: 'invoice carried no id' });
  }

  const subscriptionId = subscriptionIdFrom(invoice);
  if (!subscriptionId) {
    // A one off invoice failing is not a membership going past due. There is
    // no subscription behind it and nothing here to mark.
    log('failure-no-subscription-id', { id: eventId, invoice: invoiceId });
    return reply(200, { ignored: 'invoice carried no subscription' });
  }

  const reason = invoice.billing_reason || null;
  const attemptCount = Number.isFinite(invoice.attempt_count) ? invoice.attempt_count : null;
  const nextAttempt = Number.isFinite(invoice.next_payment_attempt)
    ? dateFromUnix(invoice.next_payment_attempt)
    : null;

  // When it failed. Stripe's own timestamp on the event, not this server's
  // clock, so a delivery that arrives late is dated when it happened.
  const failedOn = Number.isFinite(stripeEvent.created)
    ? dateFromUnix(stripeEvent.created)
    : new Date().toISOString().slice(0, 10);

  let stage = 'failure-find-member';

  try {
    // name and email are here for the alert, and for nothing else. They are
    // never written back, never returned to the caller, and never logged.
    const members = await db(SUPABASE_URL, SERVICE_KEY,
      'member?stripe_subscription_id=eq.' + encodeURIComponent(subscriptionId) +
      '&select=id,subscription_status,name,email');

    if (!members || !members.length) {
      // Same gap as the renewal handler, reached from the other direction: a
      // card declining for somebody who was never recorded. Worth an email for
      // the same reason, and it uses the same one.
      log('failure-unknown-subscription', {
        id: eventId, invoice: invoiceId, subscription: subscriptionId
      });

      const alert = await alertOrphanSubscription({
        eventId, invoiceId, subscriptionId, eventType: 'invoice.payment_failed'
      }, cfg);

      return reply(200, {
        ignored: 'no member holds that subscription',
        alerted: alert.sent,
        alert_reason: alert.sent ? null : alert.reason
      });
    }

    const member = members[0];

    // ---- has this invoice since been PAID ---------------------------------
    //
    // THE ORDERING GUARD, and the reason a naive version of this handler is
    // worse than nothing.
    //
    // Stripe retries a declined invoice over about a fortnight. The usual
    // sequence is payment_failed, then payment_failed, then paid. Webhook
    // deliveries are not ordered though, and Stripe re-delivers anything that
    // once failed to return 2xx, so an OLD payment_failed can land after the
    // success it precedes.
    //
    // Without this check, that stale delivery would set a member who is paid
    // up and perfectly fine back to past_due, and nothing would ever set them
    // right again. A wrongly raised alarm that never clears is how people
    // learn to stop trusting the alarm.
    //
    // member_renewal holding this invoice id means it was collected in the
    // end. The failure is history. Record it, do not act on it.

    stage = 'failure-check-paid';
    const paid = await db(SUPABASE_URL, SERVICE_KEY,
      'member_renewal?stripe_invoice_id=eq.' + encodeURIComponent(invoiceId) + '&select=id');
    const alreadyPaid = Boolean(paid && paid.length);

    // ---- the ledger, which is the duplicate guard -------------------------
    //
    // Stripe fires this again on every dunning retry of the SAME invoice, so
    // without a unique row per invoice one declined card would write a row a
    // day for a fortnight. The 409 is the index doing its job.

    stage = 'failure-ledger';
    let alreadyRecorded = false;
    let failureRowId = null;
    let alreadyAlerted = false;

    try {
      // Not return=minimal any more. The row's id is needed to stamp
      // alerted_at on it once the email has actually gone.
      const written = await db(SUPABASE_URL, SERVICE_KEY, 'member_payment_failure', {
        method: 'POST',
        body: JSON.stringify({
          member_id: member.id,
          stripe_invoice_id: invoiceId,
          stripe_subscription_id: subscriptionId,
          failed_on: failedOn,
          attempt_count: attemptCount,
          next_attempt_on: nextAttempt,
          billing_reason: reason
        })
      });
      // A row that was just inserted has never been alerted on. No read needed.
      if (written && written.length) failureRowId = written[0].id;

    } catch (ledgerError) {
      if (ledgerError.status !== 409) throw ledgerError;
      alreadyRecorded = true;
    }

    // The 409 path is the only one that has to ask. This is Stripe retrying
    // the same invoice, so the question is whether the email already went the
    // first time round.
    if (alreadyRecorded) {
      stage = 'failure-read-back';
      const existing = await db(SUPABASE_URL, SERVICE_KEY,
        'member_payment_failure?stripe_invoice_id=eq.' + encodeURIComponent(invoiceId) +
        '&select=id,alerted_at');
      if (existing && existing.length) {
        failureRowId = existing[0].id;
        alreadyAlerted = Boolean(existing[0].alerted_at);
      }
    }

    // ---- mark the member, or deliberately do not --------------------------
    //
    // Three reasons to leave the status alone, and all three are correct:
    //
    //   alreadyPaid    the invoice was collected on a later attempt
    //   cancelled      somebody ended this membership. A bounced invoice on
    //                  the way out does not reopen the question.
    //   already        past_due writing past_due changes nothing
    //
    // paused and pending ARE moved to past_due. A payment failing is news
    // about either of them.

    let statusChanged = false;
    let held = null;

    if (alreadyPaid) {
      held = 'invoice was paid on a later attempt';
    } else if (member.subscription_status === 'cancelled') {
      held = 'membership is cancelled';
    } else if (member.subscription_status === 'past_due') {
      held = 'already past_due';
    } else {
      stage = 'failure-update';
      await db(SUPABASE_URL, SERVICE_KEY, 'member?id=eq.' + member.id, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ subscription_status: 'past_due' })
      });
      statusChanged = true;
    }

    // ---- tell Pela --------------------------------------------------------
    //
    // WHO GETS AN EMAIL, and why it is not simply "everyone who fails".
    //
    //   alreadyAlerted  this invoice has already been reported. Stripe fires
    //                   payment_failed on every retry of the SAME invoice, up
    //                   to four times over a fortnight, and four identical
    //                   emails about one declined card is how somebody learns
    //                   to ignore the alert. One per invoice, which is one per
    //                   dunning episode.
    //   alreadyPaid     the invoice was collected in the end. This is a stale
    //                   delivery about a problem that resolved itself, and
    //                   announcing it is exactly the false alarm the ordering
    //                   guard above exists to prevent.
    //   cancelled       somebody ended this membership. A bounced invoice on
    //                   the way out is not news.
    //
    // Note what is NOT on that list: a member already past_due from an EARLIER
    // invoice still gets an email when a NEW invoice fails, because a second
    // failed term is a different fact from the first one.
    //
    // The stamp is what makes this survive a bad day. If Resend is down, the
    // send fails, alerted_at stays NULL, and Stripe's next retry in a few days
    // tries again. Nothing is lost, it is only late.

    const worthTelling = !alreadyAlerted && !alreadyPaid &&
      member.subscription_status !== 'cancelled';

    let alert = { sent: false, reason: 'not attempted' };

    if (worthTelling) {
      stage = 'failure-alert';

      const who = (member.name ? member.name + ' ' : '') + '<' + member.email + '>';
      const lines = [
        'Payment failed: ' + who + ', invoice ' + invoiceId + '.',
        '',
        // Not a truthiness test. attemptCount is null when Stripe did not send
        // one, and null is the only case that has nothing to report.
        attemptCount !== null ? 'Stripe attempt ' + attemptCount + '.' : 'Attempt count not given.',
        nextAttempt
          ? 'It will try again on ' + nextAttempt + '.'
          : 'No further attempt is scheduled, which means Stripe has stopped trying.',
        '',
        'Member ' + member.id + ' is now ' + (statusChanged ? 'past_due' : member.subscription_status) + '.',
        '',
        'Automatic note from the membership webhook. Nothing to reply to.'
      ];

      // Cannot throw. See sendAlert.
      alert = await sendAlert(
        'Payment failed: ' + (member.name || member.email),
        lines.join('\n'),
        cfg
      );

      if (alert.sent && failureRowId) {
        // Stamped in its own try so that a stamp failing cannot 500 the
        // delivery. If this write is lost the cost is one duplicate email on
        // Stripe's next retry, days from now. A 500 here would cost an
        // immediate retry loop, which is far worse.
        try {
          await db(SUPABASE_URL, SERVICE_KEY, 'member_payment_failure?id=eq.' + failureRowId, {
            method: 'PATCH',
            headers: { Prefer: 'return=minimal' },
            body: JSON.stringify({ alerted_at: new Date().toISOString() })
          });
        } catch (stampError) {
          log('alert-sent-but-not-stamped', {
            id: eventId,
            invoice: invoiceId,
            row: failureRowId,
            error: String(stampError.message || stampError).slice(0, 200)
          });
        }
      }
    }

    log('payment-failed', {
      id: eventId,
      invoice: invoiceId,
      subscription: subscriptionId,
      member: member.id,
      billing_reason: reason,
      attempt_count: attemptCount,
      next_attempt_on: nextAttempt,
      ledger: alreadyRecorded ? 'already-recorded' : 'recorded',
      status_was: member.subscription_status,
      status_now: statusChanged ? 'past_due' : member.subscription_status,
      held_because: held,
      // The address is never logged. Whether an email went is operational,
      // who it was about is already answered by member id above.
      alert: alert.sent ? 'sent' : (worthTelling ? 'FAILED: ' + alert.reason : 'not needed')
    });

    return reply(200, {
      received: true,
      member: member.id,
      subscription_status: statusChanged ? 'past_due' : member.subscription_status,
      status_changed: statusChanged,
      held_because: held,
      outcome: alreadyRecorded ? 'already-recorded' : 'recorded',
      alert_sent: alert.sent,
      alert_reason: alert.sent ? null : alert.reason
    });

  } catch (err) {
    const detail = String(err.message || err).slice(0, 400);
    log('payment-failure-not-recorded', { id: eventId, invoice: invoiceId, stage, error: detail });
    return reply(500, { error: 'Could not record that failed payment.', stage, detail });
  }
}


// ---------------------------------------------------------------------------
// The handler
// ---------------------------------------------------------------------------

exports.handler = async function (event) {

  // Read per request rather than at module scope. A container that cold
  // started before a variable existed keeps the empty value it captured, for
  // as long as it stays warm, and goes on reporting the variable missing after
  // it has been added and the site redeployed. That already happened once on
  // this project, on create-checkout.js, and it looks exactly like a Netlify
  // fault rather than a code one.
  const WEBHOOK_SECRET = (process.env.STRIPE_WEBHOOK_SECRET || '').trim();
  const STRIPE_KEY     = (process.env.STRIPE_SECRET_KEY || '').trim();
  const SUPABASE_URL   = (process.env.SUPABASE_URL || '').trim();
  const SERVICE_KEY    = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

  // The alert configuration, which is deliberately NOT in the list below.
  //
  // RESEND_API_KEY IS NOT REQUIRED, and adding it to `missing` would be an
  // outage. `missing` makes every POST answer 500, so listing the mail key
  // there would mean that until it is set, a genuine successful payment would
  // be refused too. The money handling must not depend on the ability to send
  // an email about it. A missing key costs exactly one thing: no email, said
  // out loud in the log and in the reply.
  //
  // The two addresses have defaults so that going live needs one variable set
  // rather than three. Override either if the verified sending domain changes.
  const RESEND_KEY = (process.env.RESEND_API_KEY || '').trim();
  // The SUBDOMAIN, not the apex, because mail.whispersofkindness.ca is what
  // Resend has verified and Resend will not send from a domain it has not.
  // Sending from a subdomain is the better arrangement anyway: transactional
  // mail builds its own sending reputation there, so a problem with it never
  // touches the deliverability of ordinary post from the main domain.
  const ALERT_FROM = (process.env.ALERT_FROM || '').trim() ||
    'Whispers of Kindness <alerts@mail.whispersofkindness.ca>';
  const ALERT_TO   = (process.env.ALERT_TO || '').trim() ||
    'lela@whispersofkindness.ca';

  const missing = [];
  if (!WEBHOOK_SECRET) missing.push('STRIPE_WEBHOOK_SECRET');
  if (!STRIPE_KEY)     missing.push('STRIPE_SECRET_KEY');
  if (!SUPABASE_URL)   missing.push('SUPABASE_URL');
  if (!SERVICE_KEY)    missing.push('SUPABASE_SERVICE_ROLE_KEY');

  // ---- the readiness check ------------------------------------------------
  //
  // Open this address in a browser and it answers whether the running function
  // can see its configuration. Without it, the only way to find out was to
  // make a real payment and then go reading logs, which is a slow way to learn
  // that a variable needs a redeploy before a function can see it.
  //
  // WHAT THIS DISCLOSES, weighed rather than assumed. It reports the NAMES of
  // variables that are unset. Never a value, never a length, never anything
  // derived from one, and it never confirms what IS set. A missing secret
  // makes this function refuse everything, so it does not fall open, and
  // learning that it is refusing gains an attacker nothing they could use.
  // The address itself is already public.
  if (event.httpMethod === 'GET') {
    return reply(200, {
      function: 'stripe-webhook',
      ready: missing.length === 0,
      missing,
      // Reported separately from `missing` because it is not required. ready
      // stays true without it: payments are handled either way, they are just
      // handled quietly.
      //
      // No address here, in either branch. This endpoint's rule is names
      // only, never values, and the recipient is a value. Whether alerting is
      // switched on is operational. Who it reaches is not the internet's
      // business, even though this particular address is already public.
      alerts: RESEND_KEY
        ? { configured: true }
        : { configured: false, unset: 'RESEND_API_KEY', effect: 'failed payments are recorded but nobody is emailed' },
      note: missing.length
        ? 'Netlify sets a function environment when the deploy is built. A variable added afterwards needs a fresh deploy before the function can see it.'
        : 'Configuration is visible to the running function. This says nothing about whether the values are correct.'
    });
  }

  if (event.httpMethod !== 'POST') {
    return reply(405, { error: 'Use POST or GET.' });
  }

  if (missing.length) {
    // Names only, never values. 500 rather than 200, because Stripe should
    // retry this: the event is genuine and the fault is ours and fixable.
    log('config-missing', { missing });
    return reply(500, { error: 'Not configured. Missing: ' + missing.join(', ') });
  }

  // The raw body, exactly as sent. Netlify base64 encodes some request bodies,
  // and decoding to a string is required before the signature can be checked
  // against it.
  const rawBody = event.isBase64Encoded
    ? Buffer.from(event.body || '', 'base64').toString('utf8')
    : (event.body || '');

  const headers = event.headers || {};
  const signature = headers['stripe-signature'] || headers['Stripe-Signature'];

  const verified = verifySignature(rawBody, signature, WEBHOOK_SECRET);
  if (!verified.ok) {
    // 400, not 500. This is a refusal, not a failure, and Stripe should not
    // retry it. If it really was Stripe, retrying an unverifiable body would
    // only produce the same result.
    //
    // THE REASON GOES IN THE BODY, for the same argument made at the catch-all
    // below, and because leaving it out has now cost real time twice.
    //
    // "no matching signature" and "timestamp outside tolerance" are completely
    // different problems, a wrong secret versus a wrong clock, and they were
    // indistinguishable from outside. An evening went into re-copying a secret
    // that was correct all along, chasing a signing script whose clock
    // conversion was seven hours out.
    //
    // None of these strings leak anything. They describe the SHAPE of what
    // arrived, never the secret, and knowing that a timestamp was out of range
    // does not help anybody forge an HMAC.
    log('signature-rejected', { reason: verified.reason });
    return reply(400, {
      error: 'Signature could not be verified.',
      reason: verified.reason
    });
  }

  let stripeEvent;
  try {
    stripeEvent = JSON.parse(rawBody);
  } catch {
    log('unparseable-body', {});
    return reply(400, { error: 'Body was not JSON.' });
  }

  // Renewals go down their own path entirely. Nothing below this line changed
  // when they were added: the first payment is still handled exactly as it
  // was, by checkout.session.completed, and the two never touch.
  if (stripeEvent.type === 'invoice.paid') {
    // The alert configuration travels here too now. A renewal for a
    // subscription no member holds is the one thing this handler can find that
    // a person needs to hear about, and it could not send an email before
    // because it was never given the means to.
    return await handleRenewal(stripeEvent, {
      SUPABASE_URL, SERVICE_KEY, RESEND_KEY, ALERT_FROM, ALERT_TO
    });
  }

  // Failures go down their own path too, and write to their own ledger. The
  // two never share a table: renewal_count is derived by counting renewal
  // rows, so a failure recorded there would read as its opposite.
  if (stripeEvent.type === 'invoice.payment_failed') {
    return await handlePaymentFailure(stripeEvent, {
      SUPABASE_URL, SERVICE_KEY, RESEND_KEY, ALERT_FROM, ALERT_TO
    });
  }

  // Anything else is acknowledged and dropped. 200, not an error: the event is
  // genuine and correctly delivered, we simply have no work for it, and a
  // failure answer would make Stripe retry something that will never succeed.
  if (stripeEvent.type !== 'checkout.session.completed') {
    log('ignored-type', { id: stripeEvent.id, type: stripeEvent.type });
    return reply(200, { ignored: stripeEvent.type });
  }

  const eventId = stripeEvent.id;
  const sessionStub = (stripeEvent.data && stripeEvent.data.object) || {};
  const sessionId = sessionStub.id;

  if (!sessionId) {
    log('no-session-id', { id: eventId });
    return reply(200, { ignored: 'event carried no session id' });
  }

  // Which step is in progress, so a failure can say where it happened rather
  // than only that it happened. Reset as each step begins.
  let stage = 'retrieve-session';

  try {
    // ---- 1. is this a paid subscription -----------------------------------
    //
    // checkout.session.completed can fire before money has actually moved,
    // for payment methods that settle later. Recording those as paying members
    // would be recording a promise as a fact.
    const session = await retrieveSession(sessionId, STRIPE_KEY);

    if (session.payment_status !== 'paid') {
      log('not-paid-yet', {
        id: eventId, session: sessionId, payment_status: session.payment_status
      });
      return reply(200, { ignored: 'payment_status ' + session.payment_status });
    }

    // ---- 2. what did they buy ---------------------------------------------

    const lineItems = (session.line_items && session.line_items.data) || [];
    const priceId = lineItems.length && lineItems[0].price ? lineItems[0].price.id : null;
    let facts = priceId ? PRICE_FACTS[priceId] : null;
    let factsFrom = 'price';

    if (!facts) {
      // A price nobody has told this function about. Rather than refuse the
      // member, fall back to the metadata the checkout function wrote, and
      // shout about it in the log so the table above gets updated.
      const meta = session.metadata || {};
      facts = {
        tier: meta.tier === 'international' ? 'mailing_intl' : 'mailing',
        rate: meta.tier === 'international' ? null
              : (meta.rate === 'standing' ? 'standing' : 'founding'),
        term: ['3mo', '6mo', '1yr'].includes(meta.term) ? meta.term : null,
        format: meta.tier === 'international' ? 'digital' : 'print'
      };
      factsFrom = 'metadata-fallback';
      log('unknown-price', {
        id: eventId, session: sessionId, price: priceId,
        note: 'price id is not in PRICE_FACTS, fell back to session metadata'
      });
    }

    // ---- 3. who are they --------------------------------------------------

    const customer = session.customer_details || {};
    const email = (customer.email || '').trim();

    if (!email) {
      // Cannot write a member without one: member.email is NOT NULL, and an
      // email is the only way to reach this person or to find their earlier
      // recipe. 200 rather than 500, because retrying will not conjure one.
      log('no-email', { id: eventId, session: sessionId });
      return reply(200, { ignored: 'session carried no email' });
    }

    const found = addressFrom(session);
    const postalName = found ? found.name : null;
    // member.name is NOT NULL. A person who gave no name at all still has to
    // be recorded, and their email is the truest thing we hold about them.
    const name = (customer.name || postalName || email).trim();

    // Only the physical tier gets an address stored. The digital tier is not
    // asked for one, and if a billing address came through anyway it is not
    // recorded, because an address held for no purpose is an address that
    // still has to be looked after.
    const shippingAddress =
      (facts.tier === 'mailing' && found) ? formatAddress(postalName, found.address) : null;

    const row = {
      name,
      email,
      shipping_address: shippingAddress,
      tier: facts.tier,
      rate: facts.rate,
      term: facts.term,
      format: facts.format,
      subscription_status: 'active',
      start_date: new Date((session.created || Math.floor(Date.now() / 1000)) * 1000)
        .toISOString().slice(0, 10),
      stripe_customer_id: typeof session.customer === 'string' ? session.customer : null,
      stripe_subscription_id: typeof session.subscription === 'string' ? session.subscription : null,
      stripe_checkout_session_id: session.id
    };

    // ---- 4. write the member, once ----------------------------------------
    //
    // Three paths, in order:
    //   already recorded   this session has been through here before
    //   known email        somebody subscribing again, updated not duplicated
    //   new                inserted
    //
    // The check-then-write below is not the real guard against duplicates. Two
    // retries arriving together would both pass the check. The unique index on
    // stripe_checkout_session_id settles it, and the 409 is caught below.

    let memberId = null;
    let memberOutcome = null;

    stage = 'member-write';

    const bySession = await db(SUPABASE_URL, SERVICE_KEY,
      'member?stripe_checkout_session_id=eq.' + encodeURIComponent(session.id) + '&select=id');

    if (bySession && bySession.length) {
      memberId = bySession[0].id;
      memberOutcome = 'already-recorded';
    } else {
      // Case-insensitive, because Ada@ and ada@ are one person. PostgREST has
      // no case-insensitive equality, so this narrows with ilike and settles it
      // exactly in JavaScript below.
      const byEmail = await db(SUPABASE_URL, SERVICE_KEY,
        'member?email=ilike.' + encodeURIComponent(email) + '&select=id,email');
      const exact = (byEmail || []).filter(function (m) {
        return String(m.email || '').trim().toLowerCase() === email.toLowerCase();
      });

      if (exact.length) {
        memberId = exact[0].id;
        await db(SUPABASE_URL, SERVICE_KEY, 'member?id=eq.' + memberId, {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify(row)
        });
        memberOutcome = 'existing-member-updated';
      } else {
        try {
          const inserted = await db(SUPABASE_URL, SERVICE_KEY, 'member', {
            method: 'POST',
            body: JSON.stringify(row)
          });
          memberId = inserted[0].id;
          memberOutcome = 'created';
        } catch (insertError) {
          // 409 is the unique index doing its job: a retry got here first,
          // between the check above and this insert. Not an error, and the
          // right answer is to find the row that won and carry on.
          if (insertError.status !== 409) throw insertError;
          const raced = await db(SUPABASE_URL, SERVICE_KEY,
            'member?stripe_checkout_session_id=eq.' + encodeURIComponent(session.id) + '&select=id');
          if (!raced || !raced.length) throw insertError;
          memberId = raced[0].id;
          memberOutcome = 'already-recorded-race';
        }
      }
    }

    // ---- 5. link any recipe they already sent us --------------------------
    //
    // Run even when the member was already recorded. If a previous delivery
    // wrote the member and then failed before linking, this is what repairs
    // it. Setting the same value again costs nothing.
    //
    // ilike narrows, then JavaScript settles it exactly. ilike alone is not
    // enough: in SQL LIKE, underscore matches any single character, and
    // underscores are legal in email addresses, so ada_b@x.com would also
    // match adaXb@x.com. It can only ever match too much, never too little,
    // so narrowing with it and filtering afterwards is correct.

    stage = 'contributor-link';

    const candidates = await db(SUPABASE_URL, SERVICE_KEY,
      'contributor?contact=ilike.' + encodeURIComponent(email) + '&select=id,contact,member_id');

    const toLink = (candidates || []).filter(function (c) {
      return String(c.contact || '').trim().toLowerCase() === email.toLowerCase()
        && c.member_id !== memberId;
    });

    for (const contributor of toLink) {
      await db(SUPABASE_URL, SERVICE_KEY, 'contributor?id=eq.' + contributor.id, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ member_id: memberId })
      });
    }

    // ---- 6. say what happened ---------------------------------------------
    //
    // One line, everything needed to reconstruct the delivery months later.
    // No key material, no full address, no card details. The email is here
    // because without it a failure cannot be traced back to a person, and this
    // log is private to the Netlify account.
    log('ok', {
      id: eventId,
      session: session.id,
      member: memberId,
      outcome: memberOutcome,
      tier: facts.tier,
      rate: facts.rate,
      term: facts.term,
      facts_from: factsFrom,
      email,
      address_recorded: Boolean(shippingAddress),
      address_source: found ? found.source : null,
      contributors_matched: toLink.length,
      contributors_linked: toLink.map(function (c) { return c.id; })
    });

    return reply(200, {
      received: true,
      member: memberId,
      outcome: memberOutcome,
      linked: toLink.length
    });

  } catch (err) {
    // 500, so Stripe retries. Supabase being briefly unreachable is exactly
    // the case retries exist for, and the unique index above makes a retry
    // safe to accept.
    const detail = String(err.message || err).slice(0, 400);

    log('failed', { id: eventId, session: sessionId, stage, error: detail });

    // THE REASON GOES IN THE BODY, on purpose.
    //
    // This used to answer "Could not record that membership." and nothing
    // else, which meant the only way to find out what actually broke was to
    // go and read the Netlify log. That is a bad trade for a webhook.
    //
    // The rule for the website is different from the rule here. A visitor
    // gets a calm sentence because a visitor cannot act on a stack trace and
    // the page is public. This endpoint has exactly one caller, Stripe, and
    // Stripe records the response body against the event and shows it in a
    // dashboard only Pela can open. Hiding the reason there protects nobody
    // and costs an afternoon.
    //
    // Supabase and Stripe error text names tables, columns and constraints.
    // None of them echo key material.
    return reply(500, {
      error: 'Could not record that membership.',
      stage,
      detail
    });
  }
};


// ---------------------------------------------------------------------------
// THE CONTRIBUTOR LINK RUNS BOTH WAYS NOW
//
// What follows was written when this was the only half that existed, and is
// kept because the shape of it still matters.
//
// The link here is a BACKFILL. It runs at the moment somebody becomes a paying
// member and finds recipes they sent in BEFORE they paid. It only ever looked
// backward, so somebody who was already a member and contributed AFTERWARDS
// was never connected to their own membership, and "has this paying member
// also contributed a recipe" was answerable for people who contributed first
// and silently wrong for everybody else.
//
// The forward half now lives in submit.js, at step 5, and runs at submission
// time rather than waiting on any event here. It matches the same way this
// does, ilike to narrow and an exact comparison in JavaScript to settle it, so
// the two directions always agree about who is the same person. Change the
// matching in one and change it in the other.
//
// The two halves do not overlap. Each only ever sets member_id on a row the
// other has no reason to touch at the same moment, and setting the same value
// twice costs nothing.
//
//
// THE SECOND GAP: STRIPE GIVING UP
//
// invoice.payment_failed fires on each retry of a declined invoice. When the
// retry schedule runs out, Stripe does whatever the subscription is set to do,
// usually cancel it, and fires customer.subscription.deleted. That event is
// NOT listened for.
//
// So a membership Stripe has finished with reads past_due here rather than
// cancelled, indefinitely. That is a much smaller wrong answer than the one
// this closes, because past_due already means "something is broken, go and
// look", and it errs toward flagging rather than toward silence. It is still a
// wrong answer, and it is its own small piece of work.
//
// member_payment_failure.next_attempt_on is the near-term substitute. A row
// whose next_attempt_on has passed, with the member still past_due, is one
// Stripe has almost certainly stopped chasing.
//
// The email now says which of the two it is. "It will try again on the 19th"
// and "no further attempt is scheduled, which means Stripe has stopped trying"
// are the same sentence Stripe's own dashboard would tell you, arriving
// without anybody having to go and ask. It still does not CHANGE the status to
// cancelled, so the gap above is narrowed rather than closed.
//
//
// THE THIRD GAP: NOBODY IS TOLD WHEN IT RECOVERS
//
// A declined card sends one email. A successful retry a week later sends
// nothing at all, so the last thing anybody heard about that member is that
// their payment failed. The database is right, the human record is one sided.
//
// Not fixed here on purpose. The daily digest is where both sides belong, and
// a second immediate email saying "never mind" is the kind of thing that turns
// a useful alert into noise. Until then: a member reading active with a row in
// member_payment_failure is somebody who recovered.
// ---------------------------------------------------------------------------
