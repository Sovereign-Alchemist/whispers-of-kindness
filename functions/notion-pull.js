// WHISPERS OF KINDNESS - Supabase to Notion, on submission
//
// Runs on Netlify. Zero dependencies, same as every other function here.
//
// WHAT IT DOES
//   A Supabase Database Webhook calls this address when a new provenance row
//   is inserted. It reads the recipe and the contributor behind it and creates
//   one page in the Notion Recipe Pipeline database, so a submission is
//   somewhere Pela can actually see and work with it.
//
// WHY provenance AND NOT recipe
//
//   Because submit.js writes the two in SEPARATE TRANSACTIONS. PostgREST calls
//   are separate HTTP requests, so each commits on its own:
//
//     step 2, submit.js:270   insert recipe        <- commits here
//     step 3, submit.js:298   insert provenance    <- commits here
//
//   A trigger on recipe fires at step 2, before the story exists. The page
//   would be created with an empty story, which looks exactly like a
//   contributor who did not write one. pg_net's queue delay would hide it most
//   of the time, which makes it worse rather than better: a race that usually
//   works is a race that fails on a day nobody is looking.
//
//   provenance is written last of the three and carries recipe_archive_id as
//   its primary key, so triggering there means everything is already present.
//   It also means the story arrives IN the payload and needs no second read.
//
// WHAT ARRIVES LATER AND IS THEREFORE NOT HERE
//   The uploaded files. Those land through finalize.js after the browser has
//   finished uploading, which is after all of this. provenance.files is empty
//   at trigger time. Linking the handwriting scan into Notion is its own work.
//
// SUPABASE DATABASE WEBHOOKS DO NOT RETRY, and everything below is shaped by
// that one fact. See THE STATUS CODE IS NOT A SAFETY NET at the bottom.

const crypto = require('crypto');

const NOTION_API = 'https://api.notion.com/v1';

// Pinned deliberately. Notion dates its API and an unpinned client changes
// behaviour when they ship a version, which is the kind of break that arrives
// on a Tuesday with no deploy of ours to blame it on.
const NOTION_VERSION = '2026-03-11';

// The Recipe Pipeline. A database can hold more than one data source, and the
// data source is what pages actually belong to.
const NOTION_DATA_SOURCE = '20bc26f4-4fca-403a-98c4-87cdde2db9f6';

// Notion rejects a request body over its limit, and a rich_text block over
// 2000 characters is refused outright rather than truncated for us. A recipe
// someone typed their whole family history into would otherwise fail the
// entire page create.
const BLOCK_LIMIT = 1900;

// Bounded so a slow Notion cannot eat the whole function budget.
const NOTION_TIMEOUT_MS = 8000;


// ---------------------------------------------------------------------------
// Small helpers, same shape as stripe-webhook.js
// ---------------------------------------------------------------------------

function reply(statusCode, payload) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  };
}

function log(outcome, detail) {
  console.log('notion-pull ' + outcome + ' ' + JSON.stringify(detail));
}

// Constant time. timingSafeEqual throws on a length mismatch, which would
// itself be an answer, so lengths are checked first and separately.
function safeEqual(a, b) {
  const bufA = Buffer.from(String(a), 'utf8');
  const bufB = Buffer.from(String(b), 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

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
    throw err;
  }
  return text ? JSON.parse(text) : null;
}

async function notion(apiKey, method, path, body) {
  const res = await fetch(NOTION_API + '/' + path, {
    method: method,
    headers: {
      Authorization: 'Bearer ' + apiKey,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(NOTION_TIMEOUT_MS)
  });
  const text = await res.text();
  if (!res.ok) {
    // Notion's own message names the offending property, which is the whole
    // diagnosis for a mapping that has drifted. It is quoted rather than
    // swallowed. A 404 here nearly always means the database has not been
    // shared with the integration, not that an id is wrong.
    const err = new Error('notion ' + res.status + ': ' + text.slice(0, 400));
    err.status = res.status;
    throw err;
  }
  return text ? JSON.parse(text) : null;
}

function trimmed(value) {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s.length ? s : null;
}


// ---------------------------------------------------------------------------
// THE PROPERTY MAPPING
//
// Reconciled against the real data source schema. Four things the brief had
// differently, all of which would have failed:
//
//   Status is a SELECT, not a status property. Different payload.
//   Location is called 'Contributor Location'.
//   Email is called 'Contributor Email'.
//   Region/Origin is 'Region / Origin', with spaces, and is not written at
//     all now. See the note on it below, which is the interesting one.
//
// Permission Status also needs a translation, because Notion and Postgres do
// not use the same words. See PERMISSION below.
//
// A WARNING ABOUT SELECT PROPERTIES, because it decides several choices here.
// If you write a select option that does not exist, Notion does NOT reject it.
// It ADDS it to the schema. So a wrong value here is not a 400 that gets
// noticed on the first run; it is a new option quietly appearing in Pela's
// dropdown, and after fifty submissions the list is unusable. Select options
// are a closed vocabulary that the API will happily open for you.
//
// Status properties are the opposite: their options cannot be created through
// the API at all. Nothing here writes one, and that is worth remembering if
// any of these ever changes type.
//
// It is one declarative table on purpose. Reconciling it against a schema
// change is editing this block, not hunting through the code that uses it.
//
//   notion  the property name, exactly as Notion spells it
//   type    the Notion property type, which decides the payload shape
//   from    given { recipe, contributor, provenance }, the value, or null to
//           leave the property off the page entirely
// ---------------------------------------------------------------------------

// Postgres says one thing, Notion says another, and neither is wrong.
// contributor.permission_status is constrained to four values. The Notion
// select offers three, and the middle one is a different WORD rather than a
// different case: a granted permission is 'Received' in the pipeline.
//
// 'withdrawn' has no Notion option and is deliberately NOT folded into
// 'Declined'. Someone who gave permission and later took it back is not the
// same as someone who never gave it, and flattening the two would lose the
// distinction in the one place Pela does the work. It writes nothing and logs,
// so the field reads as unset and she goes and looks.
//
// In practice this is near unreachable for a new submission: the form only
// ever produces 'granted' or 'pending'. Withdrawal happens later, by hand.
const PERMISSION = {
  pending:  'Pending',
  granted:  'Received',
  declined: 'Declined'
};

const MAPPING = [
  { notion: 'Recipe Title', type: 'title',
    from: function (d) { return trimmed(d.recipe.title) || 'Untitled recipe'; } },

  // A select, not a status property. 'Submitted' is the first of the eight
  // options and everything after it is Pela moving the card by hand.
  { notion: 'Status', type: 'select',
    from: function () { return 'Submitted'; } },

  // The TRUE name, not name_display. An anonymous contributor is anonymous in
  // the archive and on the card, and this database is Pela's private working
  // pipeline. She has to be able to write back to the person who sent it in.
  // Whether they are named publicly is a separate question that the card
  // answers, and name_display is where that lives.
  { notion: 'Contributor Name', type: 'rich_text',
    from: function (d) { return trimmed(d.contributor.name); } },

  { notion: 'Contributor Location', type: 'rich_text',
    from: function (d) { return trimmed(d.contributor.location); } },

  // The Postgres column is called contact, not email. It is whatever they
  // typed in the contact box, which is an email address in practice.
  { notion: 'Contributor Email', type: 'email',
    from: function (d) { return trimmed(d.contributor.contact); } },

  // Both are NULL at submission. Nothing on the form asks for a category or a
  // season; they are Pela's editorial judgement, made later. Returning null
  // leaves the property off the page entirely, so it reads as untouched rather
  // than as deliberately blank.
  //
  // They are still mapped rather than dropped, because the day something does
  // write them, the values have to be exactly one of the existing options or
  // Notion silently invents a new one. Mains, Baking, Preserves, Drinks,
  // Desserts, Soups & Stews. Spring, Summer, Fall, Winter, Any.
  { notion: 'Category', type: 'select',
    from: function (d) { return trimmed(d.recipe.category); } },
  { notion: 'Season', type: 'select',
    from: function (d) { return trimmed(d.recipe.season); } },

  // ---- 'Region / Origin' IS DELIBERATELY NOT WRITTEN ----------------------
  //
  // The brief asked for it and it is left off on purpose, because every way of
  // filling it in makes the pipeline worse.
  //
  // It is a SELECT whose only option is 'Unspecified'. The data that would go
  // in it is free text: recipe.region is NULL at submission, and what the
  // contributor actually tells us is provenance.place_of_origin, which reads
  // "Yorkshire, then Saskatchewan" or "my nan's kitchen in Trail".
  //
  // Writing that to a select does not fail. Notion ADDS the option. So after
  // fifty submissions the dropdown holds fifty one-off phrases and is no
  // longer a filter, and nothing ever raised an error to say so. A property
  // that quietly destroys itself is worse than one that 400s.
  //
  // The information is not lost. place_of_origin is written into the page
  // body, under the 'Where it comes from' prompt, which is where a sentence
  // belongs. Pela picks the select from her own list when she knows the answer.
  //
  // To turn this on: add the real regions as options in Notion, then map it to
  // recipe.region only, never to place_of_origin.

  { notion: 'Date Submitted', type: 'date',
    from: function (d) { return d.recipe.created_at || null; } },

  // Translated, not passed through. See PERMISSION above: Postgres says
  // 'granted' and the pipeline says 'Received'. An unmapped value writes
  // nothing rather than guessing.
  { notion: 'Permission Status', type: 'select',
    from: function (d) {
      const raw = trimmed(d.contributor.permission_status);
      if (!raw) return null;
      const mapped = PERMISSION[raw];
      if (!mapped) {
        log('permission-unmapped', { value: raw, contributor: d.contributor.id || null });
        return null;
      }
      return mapped;
    } },

  // THE MATCH KEY. Both this chunk and the later push depend on it.
  //
  // TEXT, not a number. The primary key of the recipe table is archive_id, in
  // the form recipe-0007, minted by the database. A Number property in Notion
  // cannot hold it and matching would never work.
  { notion: 'Supabase Recipe ID', type: 'rich_text',
    from: function (d) { return d.recipe.archive_id; } }
];

const MATCH_PROPERTY = 'Supabase Recipe ID';


// Turns one mapping row into the shape Notion wants for that property type.
// Returns null when there is nothing to say, and the caller leaves the
// property off the page rather than writing an empty one.
function renderProperty(type, value) {
  if (value === null || value === undefined || value === '') return null;

  const text = String(value);

  switch (type) {
    case 'title':
      return { title: [{ text: { content: text.slice(0, BLOCK_LIMIT) } }] };
    case 'rich_text':
      return { rich_text: [{ text: { content: text.slice(0, BLOCK_LIMIT) } }] };
    case 'select':
      return { select: { name: text } };
    case 'status':
      return { status: { name: text } };
    case 'multi_select':
      return { multi_select: [{ name: text }] };
    case 'email':
      return { email: text };
    case 'url':
      return { url: text };
    case 'number':
      return { number: Number(text) };
    case 'date':
      // Notion accepts a full ISO 8601 timestamp or a bare date. created_at
      // is a timestamptz, which is already ISO, so it goes straight in.
      return { date: { start: text } };
    default:
      return null;
  }
}

function buildProperties(data) {
  const out = {};
  MAPPING.forEach(function (row) {
    let raw = null;
    try {
      raw = row.from(data);
    } catch (e) {
      // A mapping function throwing must not take the whole page down. One
      // missing property is better than no page at all, and the log names it.
      log('mapping-threw', { property: row.notion, error: String(e.message || e).slice(0, 200) });
      return;
    }
    const rendered = renderProperty(row.type, raw);
    if (rendered) out[row.notion] = rendered;
  });
  return out;
}


// ---------------------------------------------------------------------------
// THE PAGE BODY
//
// ###########################################################################
// ## The six prompts below are the real ones, word for word off the page.
// ##
// ## The em dash in the fifth is hers and is kept on purpose, because these
// ## headings exist to match her template exactly. It is the one place on this
// ## project where an em dash is deliberate.
// ##
// ## It is worth knowing WHY this has to be built here at all: a Notion
// ## database TEMPLATE is a user interface feature. It is NOT applied to pages
// ## created through the API. A page created by this function arrives with
// ## exactly the blocks below and nothing else, so if the six prompts are to
// ## be on it, this is what has to put them there.
// ###########################################################################
//
// Six prompts, six provenance columns, which is very unlikely to be a
// coincidence. Where a prompt has a column, the answer goes under it. Where a
// prompt has nothing to pull from, the heading is still written and the space
// under it left empty, so Pela can see what is missing and fill it in rather
// than having to remember what the question was.
// ---------------------------------------------------------------------------

// The real prompts, word for word from the page. They are NOT one prompt to
// one column, which is why each carries a function rather than a field name:
//
//   one prompt draws on TWO columns        (where and when they lived)
//   one draws on a column from a DIFFERENT TABLE  (the relationship, which
//                                           lives on contributor, not
//                                           provenance)
//   one has NOTHING behind it              (see the last entry)
//
// Each `from` returns a list. Every non-empty item becomes its own paragraph,
// so two answers under one prompt stay two answers rather than being joined
// into a sentence nobody wrote.
const STORY_PROMPTS = [
  {
    heading: 'Whose recipe was this, and what was your relationship to them?',
    from: function (d) {
      // Two tables. The cook is on provenance, the relationship is on
      // contributor, because it describes the person submitting rather than
      // the person who cooked.
      return [
        d.provenance.original_cook,
        d.contributor.relationship_to_original_cook
      ];
    }
  },
  {
    heading: 'Where and when did they live?',
    from: function (d) {
      // Deliberately two paragraphs rather than "Yorkshire, in the 1950s".
      // Joining them would be writing a sentence the contributor did not.
      return [d.provenance.place_of_origin, d.provenance.approximate_date];
    }
  },
  {
    heading: 'Who did they make this for? An occasion, a person, a hard season?',
    from: function (d) { return [d.provenance.who_they_cooked_for]; }
  },
  {
    heading: 'What do you remember about them making it?',
    from: function (d) { return [d.provenance.remembered_story]; }
  },
  {
    heading: 'Did it come from further back — another country, another generation?',
    from: function (d) { return [d.provenance.migration_notes]; }
  },
  {
    // NOTHING FILLS THIS ONE, and that is not an oversight in the mapping.
    // The submission form does not ask it. submit.js reads nineteen fields off
    // the body and none of them is this question, so there is no column for it
    // to have been stored in.
    //
    // It writes the heading and an empty space under it, which is the whole
    // point: a question Pela can answer beats a heading that is silently not
    // there. Filling it from anything else would be inventing an answer to the
    // most personal question on the page.
    heading: "Is there anything about them you'd want remembered?",
    from: function () { return []; }
  }
];

function paragraph(text) {
  return {
    object: 'block',
    type: 'paragraph',
    paragraph: { rich_text: text ? [{ text: { content: text } }] : [] }
  };
}

function heading(text) {
  return {
    object: 'block',
    type: 'heading_2',
    heading_2: { rich_text: [{ text: { content: text } }] }
  };
}

// One long field becomes several paragraph blocks. Notion refuses a rich_text
// run over 2000 characters, and a recipe is exactly the kind of thing somebody
// types six thousand characters into.
function paragraphs(text) {
  const clean = trimmed(text);
  if (!clean) return [paragraph(null)];

  const out = [];
  // Split on blank lines first, so the shape the contributor typed survives,
  // then hard split anything still too long.
  clean.split(/\n{2,}/).forEach(function (chunk) {
    let rest = chunk.trim();
    if (!rest) return;
    while (rest.length > BLOCK_LIMIT) {
      out.push(paragraph(rest.slice(0, BLOCK_LIMIT)));
      rest = rest.slice(BLOCK_LIMIT);
    }
    if (rest.length) out.push(paragraph(rest));
  });

  return out.length ? out : [paragraph(null)];
}

function buildBody(data) {
  const blocks = [];

  blocks.push(heading('Original Recipe'));
  paragraphs(data.recipe.original_text).forEach(function (b) { blocks.push(b); });

  blocks.push(heading('The Story'));
  STORY_PROMPTS.forEach(function (prompt) {
    blocks.push(heading(prompt.heading));

    let answers = [];
    try {
      answers = prompt.from(data) || [];
    } catch (e) {
      // One prompt throwing must not cost the whole page. The heading is
      // still written, so the question survives even when the answer does not.
      log('prompt-threw', {
        prompt: prompt.heading.slice(0, 40),
        error: String(e.message || e).slice(0, 200)
      });
    }

    const filled = answers.map(trimmed).filter(Boolean);

    if (!filled.length) {
      // Deliberately an empty paragraph. The prompt is the point: an empty
      // space under a question Pela can answer is more use than a heading
      // that silently is not there.
      blocks.push(paragraph(null));
      return;
    }

    filled.forEach(function (answer) {
      paragraphs(answer).forEach(function (b) { blocks.push(b); });
    });
  });

  // Notion caps children at 100 blocks on a create. Anything past that has to
  // be appended afterwards, and going over silently would lose the tail of a
  // long story.
  if (blocks.length > 100) {
    log('body-truncated', { blocks: blocks.length, kept: 100 });
    return blocks.slice(0, 100);
  }
  return blocks;
}


// ---------------------------------------------------------------------------
// Does a page already exist for this recipe
//
// The SECOND line of defence. recipe.notion_page_id is the first and the
// authoritative one, and this only runs when that column is empty.
//
// It exists for one specific sequence: the page was created, and the write
// back to Supabase failed or the function died before it happened. The column
// says no page, Notion says otherwise, and Notion is right. Without this, that
// recipe gets a duplicate page on every redelivery.
// ---------------------------------------------------------------------------

async function findExistingPage(apiKey, archiveId) {
  const result = await notion(apiKey, 'POST',
    'data_sources/' + NOTION_DATA_SOURCE + '/query', {
      page_size: 1,
      filter: {
        property: MATCH_PROPERTY,
        rich_text: { equals: archiveId }
      }
    });

  const hit = result && result.results && result.results[0];
  return hit ? hit.id : null;
}


// ---------------------------------------------------------------------------
// The handler
// ---------------------------------------------------------------------------

exports.handler = async function (event) {

  // Read per request, not at module scope. A container that cold started
  // before a variable existed keeps the empty value it captured for as long as
  // it stays warm, and goes on reporting the variable missing after it has
  // been added and the site redeployed.
  const SUPABASE_URL  = (process.env.SUPABASE_URL || '').trim();
  const SERVICE_KEY   = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const NOTION_KEY    = (process.env.NOTION_API_KEY || '').trim();
  const HOOK_SECRET   = (process.env.NOTION_PULL_SECRET || '').trim();

  const missing = [];
  if (!SUPABASE_URL) missing.push('SUPABASE_URL');
  if (!SERVICE_KEY)  missing.push('SUPABASE_SERVICE_ROLE_KEY');
  if (!NOTION_KEY)   missing.push('NOTION_API_KEY');
  if (!HOOK_SECRET)  missing.push('NOTION_PULL_SECRET');

  // ---- readiness ----------------------------------------------------------
  //
  // Names only, never values, same rule as stripe-webhook.js. The address is
  // already public and a missing secret makes this function refuse everything,
  // so it does not fall open.
  if (event.httpMethod === 'GET') {
    return reply(200, {
      function: 'notion-pull',
      ready: missing.length === 0,
      missing,
      note: missing.length
        ? 'Netlify sets a function environment when the deploy is built. A variable added afterwards needs a fresh deploy before the function can see it.'
        : 'Configuration is visible to the running function. This says nothing about whether the values are correct, or whether the Notion database has been shared with the integration.'
    });
  }

  if (event.httpMethod !== 'POST') {
    return reply(405, { error: 'Use POST or GET.' });
  }

  // ---- NOTION_API_KEY IS REQUIRED HERE, unlike RESEND_API_KEY in the webhook
  //
  // Worth stating because it looks inconsistent and is not. There, the mail
  // was a side effect of handling a payment that had already succeeded, so
  // refusing over a missing mail key would have thrown away real work to
  // protect nothing. Here the Notion write IS the entire job. A run without
  // the key accomplishes nothing, and carrying on quietly would mean
  // pretending a submission had been filed when it had not.
  if (missing.length) {
    log('config-missing', { missing });
    return reply(500, { error: 'Not configured. Missing: ' + missing.join(', ') });
  }

  // ---- prove the caller is the webhook ------------------------------------
  //
  // This address is public and anything on the internet can POST to it.
  // Supabase Database Webhooks do NOT sign their deliveries the way Stripe
  // does; the only mechanism on offer is a header set in the dashboard, so
  // that is what is checked. Constant time, because a header comparison that
  // returns early leaks the prefix.
  //
  // FAILS CLOSED. Unset means refuse, which is the right default for a
  // security control even though it means nothing works until it is set. What
  // that costs is bounded and visible: the recipes go on reading
  // notion_page_id NULL and the repair queue finds every one of them.
  const headers = event.headers || {};
  // Trimmed, like the environment variable it is compared against. Slightly
  // lax for a credential, and worth it: this check answers a bare 401 with no
  // detail, so a CORRECT secret carrying a stray space pasted into the
  // Supabase dashboard would be indistinguishable from an attack, permanently,
  // with nothing anywhere saying why. The value is 256 bits of entropy. Whether
  // it has a space on the end of it is not what stands between this address
  // and the internet.
  const offered = String(
    headers['x-notion-pull-secret'] || headers['X-Notion-Pull-Secret'] || ''
  ).trim();

  if (!safeEqual(offered, HOOK_SECRET)) {
    // 401 and no detail. A forged caller learns only that it was refused.
    log('refused', { reason: 'shared secret did not match', had_header: Boolean(offered) });
    return reply(401, { error: 'No.' });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '');
  } catch {
    log('unparseable-body', {});
    return reply(400, { error: 'Body was not JSON.' });
  }

  // ---- is this the event we are here for ----------------------------------
  //
  // 200 rather than an error for the ones that are not. The delivery is
  // genuine and correctly authenticated, there is simply no work in it, and
  // answering 4xx to a well formed call would fill net._http_response with
  // failures that are not failures.
  if (payload.type !== 'INSERT' || payload.table !== 'provenance') {
    log('ignored', { type: payload.type, table: payload.table });
    return reply(200, { ignored: 'not an insert on provenance' });
  }

  const record = payload.record || {};
  const archiveId = trimmed(record.recipe_archive_id);

  if (!archiveId) {
    log('no-archive-id', { record_keys: Object.keys(record) });
    return reply(200, { ignored: 'provenance row carried no recipe_archive_id' });
  }

  let stage = 'read-recipe';

  try {
    // ---- the recipe -------------------------------------------------------
    const recipes = await db(SUPABASE_URL, SERVICE_KEY,
      'recipe?archive_id=eq.' + encodeURIComponent(archiveId) +
      '&select=archive_id,title,original_text,category,season,region,created_at,contributor_id,notion_page_id');

    if (!recipes || !recipes.length) {
      // Should be impossible: provenance has a foreign key to recipe. Worth
      // saying rather than crashing, because impossible things do happen and
      // a clear line in the log beats a stack trace.
      log('recipe-missing', { archive_id: archiveId });
      return reply(200, { ignored: 'no recipe holds that archive id' });
    }

    const recipe = recipes[0];

    // ---- already done -----------------------------------------------------
    if (recipe.notion_page_id) {
      log('already-pulled', { archive_id: archiveId, page: recipe.notion_page_id });
      return reply(200, {
        received: true, archive_id: archiveId,
        page_id: recipe.notion_page_id, outcome: 'already-pulled'
      });
    }

    // ---- the contributor --------------------------------------------------
    stage = 'read-contributor';
    let contributor = {};
    if (recipe.contributor_id) {
      const people = await db(SUPABASE_URL, SERVICE_KEY,
        'contributor?id=eq.' + encodeURIComponent(recipe.contributor_id) +
        '&select=id,name,name_display,anonymous,location,contact,permission_status');
      if (people && people.length) contributor = people[0];
    }
    if (!contributor.id) {
      // The page is still worth making. A recipe with no contributor row is a
      // data problem Pela needs to see, and seeing it in the pipeline is how
      // she will. The contributor properties simply come out empty.
      log('contributor-missing', { archive_id: archiveId, contributor_id: recipe.contributor_id });
    }

    const data = { recipe: recipe, contributor: contributor, provenance: record };

    // ---- has Notion got one anyway ----------------------------------------
    stage = 'notion-lookup';
    const existing = await findExistingPage(NOTION_KEY, archiveId);

    if (existing) {
      // The page was made and the write back was lost. Repair the column
      // rather than making a second page.
      stage = 'repair-page-id';
      await db(SUPABASE_URL, SERVICE_KEY, 'recipe?archive_id=eq.' + encodeURIComponent(archiveId), {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ notion_page_id: existing })
      });
      log('page-existed-column-repaired', { archive_id: archiveId, page: existing });
      return reply(200, {
        received: true, archive_id: archiveId,
        page_id: existing, outcome: 'already-in-notion-column-repaired'
      });
    }

    // ---- make the page ----------------------------------------------------
    stage = 'notion-create';
    // Built once. Calling it again for the log would be a second pass over
    // the mapping and could report a different count from the one actually
    // sent if a mapping function ever stopped being pure.
    const properties = buildProperties(data);

    const page = await notion(NOTION_KEY, 'POST', 'pages', {
      parent: { type: 'data_source_id', data_source_id: NOTION_DATA_SOURCE },
      properties: properties,
      children: buildBody(data)
    });

    const pageId = page && page.id;
    if (!pageId) throw new Error('Notion created a page and returned no id');

    // ---- write it down ----------------------------------------------------
    //
    // Not wrapped in its own catch, unlike the alerted_at stamp in the Stripe
    // webhook. There, losing the stamp cost one duplicate email on a retry
    // days later. Here it would mean the recipe reads as never pulled, and
    // since nothing retries, the repair queue is the only thing that would
    // catch it. Let it fail loudly. findExistingPage above is what makes a
    // manual re-run safe afterwards.
    stage = 'write-page-id';
    await db(SUPABASE_URL, SERVICE_KEY, 'recipe?archive_id=eq.' + encodeURIComponent(archiveId), {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ notion_page_id: pageId })
    });

    log('pulled', {
      archive_id: archiveId,
      page: pageId,
      contributor: contributor.id || null,
      properties: Object.keys(properties).length
    });

    return reply(200, {
      received: true, archive_id: archiveId,
      page_id: pageId, outcome: 'created'
    });

  } catch (err) {
    const detail = String(err.message || err).slice(0, 400);
    log('pull-failed', { archive_id: archiveId, stage, error: detail });

    // 500, and see the note below about what that does and does not buy.
    return reply(500, {
      error: 'Could not put that recipe into Notion.',
      archive_id: archiveId,
      stage,
      detail,
      repair: "select archive_id from recipe where notion_page_id is null"
    });
  }
};


// ---------------------------------------------------------------------------
// THE STATUS CODE IS NOT A SAFETY NET
//
// Everywhere else on this project a 500 from a webhook means "send it again",
// and that is load bearing. Stripe redelivers for days, so a transient fault
// costs a delay and nothing else.
//
// Supabase Database Webhooks do not work that way. They are a thin wrapper
// around pg_net, which is fire and forget. A non-2xx is written to
// net._http_response, that table is purged after six hours, and nothing ever
// tries again. There is no redelivery to rely on and no dashboard that will
// show it to anybody a week later.
//
// So the 500 above is honest rather than useful. What actually catches a lost
// submission is the column:
//
//     select archive_id, title, created_at
//       from recipe
//      where notion_page_id is null
//      order by created_at;
//
// That is the repair queue and it should be empty. Anything sitting in it is a
// recipe Pela cannot see, which is the exact failure this function exists to
// prevent, so it is worth looking at rather than assuming.
//
// TWO MORE THINGS pg_net does that are worth knowing before blaming this code.
//
//   The trigger the dashboard writes carries an explicit timeout_ms and the
//   documented example is 1000. One second is not enough for two Supabase
//   reads and two Notion calls. A timeout there does NOT cancel this function,
//   which runs to completion and writes the page anyway; it only means
//   Supabase never learns the outcome and logs a failure that is not one. Set
//   it higher when creating the webhook.
//
//   Delivery is not exactly once. That is what recipe.notion_page_id and
//   findExistingPage are between them for.
//
//
// WHAT THIS DELIBERATELY DOES NOT DO
//
//   Nothing happens when a recipe is EDITED after its page exists. This reacts
//   to new submissions only. Re-syncing an edited recipe is a separate
//   decision that has not been made, and guessing at it would mean quietly
//   overwriting whatever Pela had typed into Notion in the meantime.
//
//   Nothing goes back the other way. Notion to Supabase is its own chunk.
//
//   No files. See the note at the top: they arrive after this runs.
// ---------------------------------------------------------------------------
