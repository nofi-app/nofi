# NOFI-PLAN.md — Complete Planning Record

**Purpose:** Permanent reference of every decision made while planning Nofi, a free, open-source, cloud-synced Standard Notes clone with encrypted file attachments. For reference and future migration.

**Status:** Planning complete. Build in progress.

## 1. The Goal (in one sentence)
A free notes app with all Standard Notes features **plus file attachments**, cloud-only, multi-device sync, fully functional, works everywhere, open-source — for one personal user (the owner, a pharmacist, not a coder).

## 2. Final Naming Decisions
- **App name:** **Nofi** (NOtes + FIles) — chosen over: nofio, nofy, noty, nota, note, notefy, fote, nofe, and others
- **Tagline:** *"Notes. Files. Input. Output."* or *"No fees, all your notes & files"*
- **GitHub org:** `nofi-app` (created; `nofi`, `nofi-org`, `nofio` were all taken) → `github.com/nofi-app`
- **Future repo:** `nofi` → `github.com/nofi-app/nofi` (org ≠ repo name, avoids redundancy)

## 3. Accounts & Organization
- **GitHub:** one account `dinesh.io@outlook.com`, handle `dilludx`; ~4-5 repos, all solo
- **tgpc:** active project. Org `tgpc-org` created; repo moved to `github.com/tgpc-org/tgpc` (old links auto-redirect). Dedicated email `tgpcunofficialforum@gmail.com` attached to GitHub as secondary email
- **Nofi:** org `nofi-app` reserved; repo to be created under it during build; uses personal email (no dedicated gmail)
- **Supabase:** one account `dinesh.io@outlook.com`, already hosts TGPC DB/backend. Nofi gets a **new separate project** (isolated from TGPC — separate DB, storage, auth)
- **Storage per project:** Supabase gives each project its own full quota (500MB DB + 1GB files) — NOT shared across projects

## 4. Tech Stack (settled)
- **App:** React + TypeScript (chosen over SvelteKit — best editors TipTap/CodeMirror + simplest client-side crypto pattern)
- **Backend:** Supabase free tier — auth (email/password), Postgres DB, realtime sync, file storage
- **Hosting:** Cloudflare Pages (free; user's existing ecosystem)
- **License:** AGPL-3.0 (same as SN)
- **TGPC stays on SvelteKit + Cloudflare Pages** — correct tool for its search-data site; React is correct for Nofi (interactive app). No change to TGPC.

## 5. Why Not Use Standard Notes' Actual Code
- SN = client (open source, free) + sync server (needs MySQL + Redis + ~2GB RAM + Docker → ~$5/mo VPS; cannot run on free hosting)
- "Authentic SN code" breaks the **free + cloud-only** requirement
- SN's engine (snjs) is hard-wired to their own server protocol — rewiring to Supabase is a huge, fragile rewrite
- **Decision:** clone SN's **features & architecture** (three-pane UI, envelope encryption, item model, sync design), write our own clean code on Supabase → free, fully functional, zero-knowledge
- Open source ≠ reusing code; our rebuild is authentic open source (AGPL-3.0, public repo)

## 6. Security Design (zero-knowledge)
- Passphrase → **Argon2id** (via audited lib, e.g. `@noble/hashes`) → master key → per-item AES-GCM keys
- **AES-GCM** via native WebCrypto (chosen over XChaCha — no WASM, simpler, still top-tier)
- Titles, tags, note content, and file bytes all encrypted **on-device before upload**
- Cloud stores ciphertext only — even the backend can't read anything
- **2FA excluded** (single user; Supabase free tier has no built-in MFA anyway)
- Passcode lock + per-note lock (client-side)

## 7. Storage Design
- **DB (Postgres):** encrypted note rows, tags, folders, file references, revisions, sync metadata (500MB — holds ~100k+ notes, never a concern)
- **Supabase Storage:** bucket `nofi-files`, **flat structure** (no per-user folders — solo user), each file a unique UUID object
- File names stored only in encrypted DB references; storage paths are UUIDs (no sensitive names); private bucket, auth-gated
- Files encrypted before upload; DB row links each file to its note
- **1GB files is sufficient:** user stores no videos; PDFs kept as PDFs (converting PDF→images increases size), images kept as images, depends on note category
- Escape hatch: open source → can point at larger Supabase/self-hosted later, zero app changes

## 8. Features — In Scope (SN parity)
- **Editors:** plain text, Markdown (live preview), rich text, code, checklists — switchable per note
- **Organization:** tags, nested folders, pin, archive, trash (with recovery)
- **Search:** full-text search across all notes
- **Security:** passphrase encryption of everything, passcode lock, per-note lock
- **Files:** SN-style encrypted attachments (file chips on note), preview supported types, download
- **Data care:** revision history, export (plaintext/JSON), import
- **UI:** three-pane layout, light/dark themes, keyboard shortcuts

## 9. Features — Excluded (deliberately)
- 2FA (solo user)
- PWA / installable — plain browser web app only (like SN web)
- Native apps (Tauri/Capacitor) — web-only for now
- OneNote-style inline file embedding — files stay SN-style attachments; inline embedding deferred as possible Phase 2 (would need rich-text block editor)
- Spreadsheet editor, note-linking/@mentions
- Automatic cloud backups (encrypted export covers it)
- Custom domain (personal project)

## 10. Build Order (8 steps, tracked as live checklist + git commit each)
1. Scaffold repo (`nofi-app/nofi`) + Supabase project `nofi` + email/password auth
2. Encrypted vault (Argon2id + AES-GCM)
3. Item model + cloud sync + realtime multi-device
4. Notes CRUD + editors
5. Tags, folders, pin/archive/trash, search
6. Encrypted file attachments (upload/preview/download)
7. Revisions, export/import, themes, keyboard shortcuts
8. Tests (Vitest/Playwright), README, AGPL-3.0 LICENSE, deploy to Cloudflare Pages

**Estimate:** ~15-20h build time over ~1-2 weeks, careful pace, no rushing. App usable after step 4.

## 11. Workflow & Reliability Notes
- Progress logged two ways: visible checklist + git commits per step
- Code lives locally → internet outages don't lose work; only Supabase setup and Cloudflare deploy need internet (discrete, retryable steps)
- Pace: careful, quality over speed
- **User's only task:** create the `nofi` Supabase project (in existing account, isolated from TGPC) + share URL + anon public key

## 12. Pending / Future
- Phase 2 candidates: OneNote-style inline file embedding, native wrappers, PWA
- If storage outgrown: move to larger Supabase project or self-host — zero app changes
