# Whispers of Kindness

The public website for [whispersofkindness.ca](https://whispersofkindness.ca),
an archive of human kindness documented through family recipes, built under the
Sovereign Alchemist umbrella.

This repository holds the website and nothing else. It is deliberately narrow.

## What is here

```
netlify.toml     tells Netlify what to serve and what to run
public/          the only folder the internet can see
  index.html
  images/
functions/       server-side code, run by Netlify, never served as files
```

## What is deliberately not here

The archive itself, contributor records, permission records, project documents,
and the database schema all live outside this repository, on a machine that is
not connected to it. That separation is the point.

The canonical archive is a plain folder structure, kept locally and backed up.
Supabase is a searchable index sitting on top of it. If Supabase disappeared
tomorrow, the scans, the recordings and the stories would still exist as
ordinary files a person could open by hand.

## Secrets

The Supabase `service_role` key goes from the Supabase dashboard directly into
Netlify's environment variables. It does not pass through this repository, a
file, a chat window, or an email on the way.

Nothing in this repository is a secret. The Supabase project URL and the `anon`
key are public by design, and the `anon` key can do nothing on its own, because
row level security is on with no policies.

**Do not commit a `service_role` key here.** Git keeps history, so a secret
committed once stays recoverable even after the file is deleted. That is a
harder problem than a key sitting in a local file.

## Deploys

Committing to the default branch deploys automatically. Netlify keeps every
previous deploy, so rolling back is one click rather than finding an old folder.
