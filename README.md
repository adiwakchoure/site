# Engram

Engram is an offline-first, AI-native task tracking app built on SvelteKit + Cloudflare.

It turns brain dumps into structured actions, lets you accept/dismiss suggestions, and persists everything through an event-style model around tasks.

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

- `src/routes/loops/+page.svelte`: primary tasks view (filters, sort, detail panel)
- `src/routes/people/+page.svelte`: people stats and linked tasks
- `src/routes/mirror/+page.svelte`: insights + archive views
- `src/routes/api/dump/+server.ts`: transcription + suggestion extraction
- `src/routes/api/sync/+server.ts`: bidirectional sync API
- `src/lib/db/*`: local DB schema, mutation helpers, sync engine
- `schema.sql`: D1 schema for loops/events/people/projects/dumps/suggestions
- `wrangler.toml`: Cloudflare bindings and Pages output config

## Data Model

Main entities:

- `loops`
- `events`
- `people`
- `loop_person`
- `projects`
- `dumps`
- `suggestions`

Events (`created`, `closed`, `reopened`, `updated`, `noted`) are appended as history while loop state is materialized for fast reads.

## UI Copy Guidelines

Use these terms consistently in user-facing text:

- **Task**: primary unit of work (internally still stored under `loops` tables/types).
- **Update**: any activity added to a task.
- **Activity Log**: chronological updates for a task detail view.
- **Archive**: closed tasks.
- **Mirror**: analytics view.

Avoid legacy terms in UI copy:

- "thread", "loop", "stack trace", "dump log", "note" (when meaning update history)

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
