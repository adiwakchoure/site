# Engram

Engram is an offline-first, voice-and-text commitment tracker built on SvelteKit + Cloudflare.

It turns brain dumps into structured actions, lets you accept/dismiss suggestions, and persists everything through an event-style model around loops.

## Core Product Flow

1. Capture input (`text` or `voice`).
2. Convert voice to transcript with Groq `whisper-large-v3-turbo`.
3. Parse transcript into action suggestions with Groq `openai/gpt-oss-120b`.
4. Accept/dismiss suggestion cards.
5. Accepted actions mutate loops and append events.
6. Local state syncs to Cloudflare D1.

## Tech Stack

- Frontend: SvelteKit + TypeScript
- Local storage: Dexie (IndexedDB)
- Cloud DB: Cloudflare D1
- AI: Groq OpenAI-compatible API (`whisper-large-v3-turbo` + `openai/gpt-oss-120b`)
- Hosting/Functions: Cloudflare Pages

## Repository Structure

- `src/routes/loops/+page.svelte`: primary loops view (filters, sort, manual actions, detail panel)
- `src/routes/people/+page.svelte`: people stats and linked loops
- `src/routes/mirror/+page.svelte`: insights/archive/dump log tabs
- `src/routes/api/dump/+server.ts`: transcription + suggestion extraction
- `src/routes/api/sync/+server.ts`: bidirectional sync API
- `src/lib/db/*`: local DB schema, mutation helpers, sync engine
- `schema.sql`: D1 schema for loops/events/people/projects/dumps
- `wrangler.toml`: Cloudflare bindings and Pages output config

## Data Model

Main entities:

- `loops`
- `events`
- `people`
- `loop_person`
- `projects`
- `dumps`

Events (`created`, `closed`, `reopened`, `updated`, `noted`) are appended as history while loop state is materialized for fast reads.

## Local Development

```bash
npm install
npm run dev
```

Create `engram/.env` with:

```bash
GROQ_API_KEY=your_groq_api_key
```

Useful checks:

```bash
npm run check
npm run build
```

## Cloudflare Setup

The app expects:

- D1 binding: `DB`
- Environment variable/secret: `GROQ_API_KEY`

Configured in `wrangler.toml`:

- `compatibility_date` and `nodejs_compat`
- `pages_build_output_dir = ".svelte-kit/cloudflare"`
- `[[d1_databases]]` binding

For production on Cloudflare Pages, configure:

```bash
npx wrangler pages secret put GROQ_API_KEY --project-name engram
```

## Deploy

Build + deploy:

```bash
npm run build
npx wrangler pages deploy .svelte-kit/cloudflare --project-name engram
```

Current Pages project domain:

- `https://engram-81p.pages.dev`

## Notes

- Voice audio is treated as ephemeral input; transcript and structured actions are persisted.
- The system is designed for fast local writes with background sync.
- AI fallback returns at least one open-loop action when extraction fails, so dumps are never lost.
