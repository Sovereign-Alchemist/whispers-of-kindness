// WHISPERS OF KINDNESS - close out a submission
//
// Called by the browser once the uploads have finished.
//
// It does NOT take the browser's word for what was uploaded. It asks storage
// what is actually sitting there and writes the manifest from that.
//
// The difference matters. An upload can fail halfway, a phone can lose signal,
// a person can close the tab. A manifest built from intentions would list
// files that are not there, and Pela would find out weeks later with the
// contributor long gone. A manifest built from a directory listing is either
// right or obviously empty.
//
// It also means this function needs no secret handshake with the browser.
// Someone posting a made-up archive id gets the correct manifest for that
// recipe recalculated, which changes nothing. There is no way to use it to
// write something false, so there is nothing to guard.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET       = 'submissions';

const FOLDERS = { scan: 'scans', photo: 'photos', audio: 'audio' };


function reply(statusCode, payload) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  };
}

async function listFolder(prefix) {
  const res = await fetch(SUPABASE_URL + '/storage/v1/object/list/' + BUCKET, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: 'Bearer ' + SERVICE_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ prefix, limit: 100, offset: 0 })
  });
  const text = await res.text();
  if (!res.ok) throw new Error('storage list ' + res.status + ': ' + text);
  return JSON.parse(text);
}


exports.handler = async function (event) {

  if (event.httpMethod !== 'POST') {
    return reply(405, { error: 'Use POST.' });
  }

  // Names only, never values. See the same guard in submit.js.
  const missingConfig = [];
  if (!SUPABASE_URL) missingConfig.push('SUPABASE_URL');
  if (!SERVICE_KEY)  missingConfig.push('SUPABASE_SERVICE_ROLE_KEY');
  if (missingConfig.length) {
    console.error('Missing environment variable(s): ' + missingConfig.join(', '));
    return reply(500, {
      error: 'The form is not configured yet. Missing: ' + missingConfig.join(', ') + '.'
    });
  }

  let archiveId;
  try {
    archiveId = JSON.parse(event.body || '{}').archive_id;
  } catch {
    return reply(400, { error: 'Could not read the request.' });
  }

  // Shape check, not a permission check. This value becomes part of a storage
  // path, so it is confined to exactly the pattern the database issues before
  // it is allowed anywhere near one.
  if (!/^recipe-[0-9]{4}$/.test(archiveId || '')) {
    return reply(400, { error: 'Not a valid archive id.' });
  }

  try {

    // ---- what is actually in storage -------------------------------------

    const files = [];

    for (const kind of Object.keys(FOLDERS)) {
      const entries = await listFolder(archiveId + '/' + FOLDERS[kind]);
      for (const entry of entries) {
        // Supabase returns folders alongside files. Folders have no id.
        if (!entry.id) continue;
        files.push({
          kind,
          name: entry.name,
          bytes: (entry.metadata && entry.metadata.size) || null
        });
      }
    }

    files.sort((a, b) => a.name.localeCompare(b.name));

    // ---- write the manifest ----------------------------------------------
    //
    // Filenames only, never URLs. A URL points at a vendor. A filename points
    // at the archive folder, which is the thing that has to outlive the
    // vendor.
    //
    // handwriting_image and audio_recording each hold one filename and are
    // kept in step with the manifest, so anything reading the older fields
    // still gets a sensible answer.

    const firstScan  = files.find(f => f.kind === 'scan');
    const firstAudio = files.find(f => f.kind === 'audio');

    const res = await fetch(
      SUPABASE_URL + '/rest/v1/provenance?recipe_archive_id=eq.' + archiveId,
      {
        method: 'PATCH',
        headers: {
          apikey: SERVICE_KEY,
          Authorization: 'Bearer ' + SERVICE_KEY,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal'
        },
        body: JSON.stringify({
          files,
          handwriting_image: firstScan  ? firstScan.name  : null,
          audio_recording:   firstAudio ? firstAudio.name : null
        })
      }
    );
    if (!res.ok) throw new Error('provenance patch ' + res.status + ': ' + await res.text());

    return reply(200, { ok: true, archive_id: archiveId, file_count: files.length });

  } catch (err) {
    // The rows already exist and the files are already in storage. A failure
    // here costs the manifest, not the submission, and re-running fixes it.
    console.error('Finalize failed for ' + archiveId + ':', err.message);
    return reply(500, { error: 'The recipe was saved. Recording the file list did not finish.' });
  }
};
