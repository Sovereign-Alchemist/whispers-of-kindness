// WHISPERS OF KINDNESS - submission intake
//
// Runs on Netlify. Zero dependencies: Node 20 has fetch built in, and
// Supabase's REST endpoints are ordinary HTTP, so nothing needs installing.
//
// WHAT IT DOES
//   1. Checks what the browser sent, and refuses anything malformed.
//   2. Writes three rows as a set: contributor, recipe, provenance.
//   3. Hands back short-lived upload URLs, one per declared file.
//   4. Links the contributor to a member, if that email is already one. This
//      step is optional, time bounded, and can never fail a submission.
//
// The browser then sends the files STRAIGHT to Supabase Storage. They do not
// pass through here, because Netlify caps a function request body around 6MB
// and times out after 10 seconds. Someone's grandmother telling the story
// behind a recipe is easily a 30MB recording. Files going direct has no
// ceiling and no key ever reaches the browser.
//
// WHY THIS FUNCTION EXISTS AT ALL
//   Every table is locked by row level security with zero policies. The
//   alternative was an INSERT policy for the `anon` key, but that key ships
//   inside the page where anyone can read it, so anyone could write unlimited
//   rows straight into the contributor table. This function holds the
//   service_role key instead, which never leaves Netlify, and is the only
//   writer. RLS stays at zero policies.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET       = 'submissions';

// Length caps. Generous, because a remembered story should not hit a wall
// mid-sentence, but finite, so a script cannot post a megabyte of nonsense.
const CAP = {
  short: 200,     // names, places, contact
  line: 400,      // one-line answers
  title: 300,
  text: 20000,    // the recipe as written
  story: 40000    // the remembered story, the heart of the thing
};

const MAX_FILES = 24;

const ALLOWED_EXT = {
  scan:  ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'pdf', 'tif', 'tiff'],
  photo: ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'],
  audio: ['m4a', 'mp3', 'wav', 'ogg', 'oga', 'aac', 'flac', 'amr', 'opus']
};


// --------------------------------------------------------------------------
// Small helpers
// --------------------------------------------------------------------------

function clean(value, cap) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, cap);
}

// A checkbox ticked by a person IS the grant. Untouched stays 'pending',
// because silence is not consent and must not be recorded as a refusal
// either. Only an explicit answer moves this off the fence.
function permission(value) {
  if (value === true  || value === 'yes') return 'granted';
  if (value === false || value === 'no')  return 'declined';
  return 'pending';
}

// recipe-0007 plus a surname gives recipe-0007-hendricks, the folder a person
// can find by hand. Accents are folded here because folder names stay plain
// ASCII, but the true spelling is kept intact in the contributor record. The
// record is the archive. This is only a label on a drawer.
function folderSuffix(name) {
  if (!name) return '';
  const last = name.trim().split(/\s+/).pop() || '';
  // Written as an escape range rather than the literal combining characters,
  // which are invisible in an editor and easy to destroy by accident.
  const COMBINING_MARKS = new RegExp('[\\u0300-\\u036f]', 'g');
  const ascii = last
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  return ascii ? '-' + ascii : '';
}

function extensionOf(filename) {
  const match = /\.([a-z0-9]+)$/i.exec(filename || '');
  return match ? match[1].toLowerCase() : '';
}

function reply(statusCode, payload) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  };
}


// --------------------------------------------------------------------------
// Supabase calls
// --------------------------------------------------------------------------

// Supabase has two generations of key and they authenticate differently.
//
//   sb_secret_...    Current format. NOT a JWT. It goes in the apikey header
//                    only. Supabase rejects it in Authorization even when the
//                    value is identical, because it tries to parse it as a JWT.
//
//   eyJ... (legacy)  A JWT. PostgREST reads the role FROM Authorization. Leave
//                    that header out and there is no error, the request quietly
//                    drops to the anon role, and row level security hides every
//                    table. Writes would fail for a reason nothing reports.
//
// Sending both unconditionally works today only because the key in Netlify is
// still legacy. It would break the moment legacy keys are turned off.
function authHeaders() {
  const headers = { apikey: SERVICE_KEY };
  if (!/^sb_(secret|publishable)_/.test(SERVICE_KEY)) {
    headers.Authorization = 'Bearer ' + SERVICE_KEY;
  }
  return headers;
}

async function db(path, options = {}) {
  const res = await fetch(SUPABASE_URL + '/rest/v1/' + path, {
    ...options,
    headers: {
      ...authHeaders(),
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(options.headers || {})
    }
  });
  const text = await res.text();
  if (!res.ok) throw new Error('supabase ' + res.status + ': ' + text);
  return text ? JSON.parse(text) : null;
}

async function signedUpload(objectPath) {
  const res = await fetch(
    SUPABASE_URL + '/storage/v1/object/upload/sign/' + BUCKET + '/' + objectPath,
    {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ expiresIn: 3600 })
    }
  );
  const text = await res.text();
  if (!res.ok) throw new Error('storage sign ' + res.status + ': ' + text);
  // Supabase returns a relative path. The browser needs the whole address.
  return SUPABASE_URL + '/storage/v1' + JSON.parse(text).url;
}


// --------------------------------------------------------------------------
// The handler
// --------------------------------------------------------------------------

exports.handler = async function (event) {

  if (event.httpMethod !== 'POST') {
    return reply(405, { error: 'Use POST.' });
  }

  // Configuration problem, not the visitor's fault.
  //
  // This names the variables that are missing. It never reports their values,
  // their lengths, or anything derived from them. A name is not a secret, and
  // "which one is missing" is the entire difference between a two minute fix
  // and an afternoon of guessing.
  const missingConfig = [];
  if (!SUPABASE_URL) missingConfig.push('SUPABASE_URL');
  if (!SERVICE_KEY)  missingConfig.push('SUPABASE_SERVICE_ROLE_KEY');
  if (missingConfig.length) {
    console.error('Missing environment variable(s): ' + missingConfig.join(', '));
    return reply(500, {
      error: 'The form is not configured yet. Missing: ' + missingConfig.join(', ')
        + '. If this is a deploy preview, check the variables are set for all'
        + ' deploy contexts, not production only.'
    });
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return reply(400, { error: 'Could not read the submission.' });
  }

  // Honeypot. A hidden field no human can see or fill. Bots fill everything.
  // Answer 200 so the bot believes it succeeded and does not come back to
  // probe for what tripped it.
  if (body.website) {
    return reply(200, { ok: true, archive_id: null });
  }

  // ---- the four required answers -----------------------------------------

  const name    = clean(body.name, CAP.short);
  const contact = clean(body.contact, CAP.short);
  const title   = clean(body.title, CAP.title);
  const text    = clean(body.original_text, CAP.text);

  const missing = [];
  if (!name)    missing.push('your name');
  if (!contact) missing.push('an email address');
  if (!title)   missing.push('a name for the recipe');
  if (!text)    missing.push('the recipe itself');
  if (missing.length) {
    return reply(400, { error: 'Still needed: ' + missing.join(', ') + '.' });
  }

  if (permission(body.permission_publish) !== 'granted') {
    return reply(400, {
      error: 'We can only accept a recipe once you have said we may keep and publish it.'
    });
  }

  // ---- the files the browser says it is about to send ---------------------

  const declared = Array.isArray(body.files) ? body.files.slice(0, MAX_FILES) : [];
  for (const file of declared) {
    const kind = file && file.kind;
    if (!ALLOWED_EXT[kind]) {
      return reply(400, { error: 'Unexpected file type.' });
    }
    if (!ALLOWED_EXT[kind].includes(extensionOf(file.name))) {
      return reply(400, {
        error: 'That kind of file cannot be accepted: ' + String(file.name).slice(0, 80)
      });
    }
  }

  const anonymous = body.anonymous === true;

  let contributorId = null;

  try {

    // ---- 1. contributor --------------------------------------------------
    // `name` keeps the true spelling, accents intact. `name_display` is how
    // it appears anywhere it is shown, and is blank when someone has asked to
    // stay anonymous. Two fields, because withdrawing a name should be a
    // small change, not a rewrite.

    const contributor = await db('contributor', {
      method: 'POST',
      body: JSON.stringify({
        name,
        name_display: anonymous ? null : (clean(body.name_display, CAP.short) || name),
        anonymous,
        location: clean(body.location, CAP.short),
        contact,
        relationship_to_original_cook: clean(body.relationship, CAP.line),
        permission_status:           permission(body.permission_publish),
        adaptation_permission:       permission(body.permission_adaptation),
        video_consideration_consent: permission(body.permission_video),
        date_submitted: new Date().toISOString().slice(0, 10)
      })
    });
    contributorId = contributor[0].id;

    // ---- 2. recipe -------------------------------------------------------
    // archive_id is minted by the database, never by this function, so two
    // submissions arriving in the same second cannot collide.

    const recipe = await db('recipe', {
      method: 'POST',
      body: JSON.stringify({
        contributor_id: contributorId,
        title,
        original_text: text,
        status: 'new'
      })
    });
    const archiveId = recipe[0].archive_id;

    // The folder name is only known once the id exists. It can change later
    // if someone withdraws permission to be named. Nothing joins on it.
    const folderName = archiveId + (anonymous ? '' : folderSuffix(name));
    await db('recipe?archive_id=eq.' + archiveId, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ folder_name: folderName })
    });

    // ---- 3. provenance ---------------------------------------------------
    // The entity most builds would skip. Every submission gets one from day
    // one, even while it is mostly empty, because this is where the archive
    // actually lives.
    //
    // original_cook_public is its own question. Recording a name and
    // publishing a name are different permissions, and it defaults to false.

    await db('provenance', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        recipe_archive_id:    archiveId,
        original_cook:        clean(body.original_cook, CAP.short),
        original_cook_public: body.original_cook_public === true,
        who_they_cooked_for:  clean(body.who_they_cooked_for, CAP.line),
        place_of_origin:      clean(body.place_of_origin, CAP.short),
        approximate_date:     clean(body.approximate_date, CAP.short),
        migration_notes:      clean(body.migration_notes, CAP.story),
        remembered_story:     clean(body.remembered_story, CAP.story)
      })
    });

    // ---- 4. upload URLs --------------------------------------------------
    // Storage paths carry the ID only, never the surname. Chunk 1: the folder
    // name may change, the ID never does. Files named for the ID survive a
    // rename without anything having to chase them.

    const counters = { scan: 0, photo: 0, audio: 0 };
    const folders  = { scan: 'scans', photo: 'photos', audio: 'audio' };
    const uploads  = [];

    for (const file of declared) {
      counters[file.kind] += 1;
      const number    = String(counters[file.kind]).padStart(2, '0');
      const extension = extensionOf(file.name);
      const stored    = archiveId + '-' + file.kind + '-' + number + '.' + extension;
      const path      = archiveId + '/' + folders[file.kind] + '/' + stored;

      uploads.push({
        original: file.name,
        name: stored,
        url: await signedUpload(path)
      });
    }

    // ---- 5. link to a member, if this person already is one ---------------
    //
    // THE FORWARD LINK. The Stage 3 webhook does this in reverse, at the
    // moment somebody pays, finding recipes they had already sent in. That
    // only ever looked backward, so somebody who was ALREADY a paying member
    // and contributed afterwards was never connected to their own membership.
    // This is the other direction, done at submission time, with no webhook
    // event and no later sweep needed.
    //
    // THIS STEP CANNOT FAIL A SUBMISSION, and that is not a hope, it is three
    // deliberate choices:
    //
    //   ITS OWN CATCH   the catch below deletes the contributor row and
    //                   answers 500. An error escaping from here would mean a
    //                   paying member's recipe was destroyed by the very
    //                   feature meant to recognise them. Nothing escapes.
    //
    //   LAST            everything that matters is already written and every
    //                   upload URL is already minted. There is nothing left
    //                   for this to spoil by being slow or by throwing.
    //
    //   TIME BOUNDED    Netlify kills this function at ten seconds, and a
    //                   submission with two dozen files has already made two
    //                   dozen calls by now. A slow Supabase must not be able
    //                   to turn a saved recipe into an error message, so this
    //                   gets a small budget of its own and is abandoned if it
    //                   runs over.
    //
    // A skipped link costs nobody anything and is repairable in one statement:
    //
    //   update contributor c set member_id = m.id
    //     from member m
    //    where lower(c.contact) = lower(m.email) and c.member_id is null;
    //
    // NOTHING ABOUT THE ANSWER TO THE BROWSER CHANGES. No field added, none
    // altered. That is the point rather than tidiness: if the reply revealed
    // whether a match was found, anybody could submit this form repeatedly and
    // learn which email addresses belong to paying members.

    try {
      // Two calls, one shared budget between them.
      const linkSignal = AbortSignal.timeout(2500);

      // Case-insensitive, because Ada@ and ada@ are one person. PostgREST has
      // no case-insensitive equality, so this narrows with ilike and settles
      // it exactly in JavaScript. Same approach as the Stage 3 backfill, on
      // purpose, so the two directions always agree about who matches whom.
      //
      // ilike alone is not enough. In SQL LIKE an underscore matches any
      // single character, and underscores are legal in email addresses, so
      // ada_b@x.com would also match adaXb@x.com. It can only ever match too
      // much, never too little, which is what makes narrowing with it and
      // filtering afterwards correct rather than merely convenient.
      const candidates = await db(
        'member?email=ilike.' + encodeURIComponent(contact) + '&select=id,email',
        { signal: linkSignal }
      );

      const wanted = contact.toLowerCase();
      const match = (candidates || []).find(function (m) {
        return String(m.email || '').trim().toLowerCase() === wanted;
      });

      if (match) {
        await db('contributor?id=eq.' + contributorId, {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ member_id: match.id }),
          signal: linkSignal
        });
        console.log('Linked contributor ' + contributorId +
          ' to member ' + match.id + ' at submission.');
      }

    } catch (linkError) {
      // Logged, never surfaced. The submission is already safe and the person
      // waiting on the form has no use for this and did nothing to cause it.
      console.error('Member link skipped for contributor ' + contributorId +
        ', submission unaffected: ' + linkError.message);
    }

    return reply(200, { ok: true, archive_id: archiveId, uploads });

  } catch (err) {

    // A contributor row with no recipe is litter. If the set could not be
    // completed, take back the part that did land, so the archive never holds
    // half a submission.
    if (contributorId) {
      try {
        await db('contributor?id=eq.' + contributorId, {
          method: 'DELETE',
          headers: { Prefer: 'return=minimal' }
        });
      } catch (cleanupError) {
        console.error('Could not remove orphan contributor:', cleanupError.message);
      }
    }

    console.error('Submission failed:', err.message);
    return reply(500, {
      error: 'Something went wrong on our side. Nothing was saved. Please try again, or write to lela@whispersofkindness.ca.'
    });
  }
};
