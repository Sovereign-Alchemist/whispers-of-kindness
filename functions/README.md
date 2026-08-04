# Functions

Server-side code. Netlify runs these on its own machines. It does not serve the
source, so nothing in this folder is readable from the internet.

Empty for now. The first one will be the submission intake for Chunk 3.

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
policies across all six tables. The function is the only writer, so it can check
what it is given and refuse what it does not like.

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
