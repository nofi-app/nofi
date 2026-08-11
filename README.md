# nofi

**Notes. Files. Input. Output.**

A free, open-source, privacy-first notes app — a self-hostable Standard Notes
alternative with encrypted file attachments. Everything you write and attach is
encrypted on your device before it ever reaches the cloud; not even the server
can read it.

- **Zero-knowledge encryption** — Argon2id-derived master key, AES-GCM per note
  and per file
- **Encrypted file attachments** — upload, preview, and download files (PDFs,
  images, and more), stored ciphertext-only
- **Cloud sync** — realtime multi-device sync via Supabase
- **Editors** — plain text, Markdown (live preview), rich text (TipTap), code
  (CodeMirror), and checklists, switchable per note
- **Organization** — tags, nested folders, pin, archive, trash with recovery
- **Full-text search** across all notes
- **Data care** — automatic version history, export (JSON / Markdown), import
- **Themes** — light, dark, or system; keyboard shortcuts throughout

## Tech stack

- **App:** React + TypeScript + Vite
- **Crypto:** `@noble/hashes` (Argon2id) + native WebCrypto (AES-GCM)
- **Backend:** Supabase (email/password auth, Postgres, Realtime, Storage)
- **Hosting:** Cloudflare Pages
- **License:** AGPL-3.0

## How encryption works

1. Your passphrase is turned into a master key with **Argon2id**
   (64 MB memory, 3 iterations) — it never leaves your device.
2. Every note, tag, folder, and file reference gets its own random **AES-GCM**
   key, wrapped by the master key and stored alongside the ciphertext.
3. File bytes are encrypted with their own key before upload; stored names are
   UUIDs, so the bucket reveals nothing.
4. The database holds ciphertext only. A wrong passphrase fails verification —
   your data is unrecoverable if you forget it.

## Development

```bash
npm install
cp .env.example .env   # add your Supabase URL + anon/publishable key
npm run dev            # http://localhost:5173
```

Set up the database by running the migrations in
[`supabase/migrations`](supabase/migrations) in the Supabase SQL Editor
(in order: `0001_init.sql`, `0002_files.sql`, `0003_revisions.sql`).

Other commands:

```bash
npm run test    # unit tests
npm run lint    # lint
npm run build   # production build (outputs to dist/)
```

## Deploying

1. `npm run build`
2. `npx wrangler pages deploy dist` (or connect the repo to Cloudflare Pages)

## Migrating your data

Export all notes as JSON or Markdown from the sidebar (Export buttons) and
import the JSON on any other nofi instance. File bytes live in your Supabase
storage bucket; the JSON export includes their metadata.

## Security notes

- The passphrase **cannot be recovered**. Store it in a password manager.
- Supabase email confirmation must be enabled for signups.
- The app is currently single-user (one vault per account).
