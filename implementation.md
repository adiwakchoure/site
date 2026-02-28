# Engram — Implementation Plan

## Table of Contents

1. Project Structure
2. Tech Stack & Dependencies
3. Data Model
4. API Surface
5. Design System
6. Component Architecture
7. Offline-First Strategy
8. AI Pipeline
9. PWA Configuration
10. Auth & Security
11. Build Phases
12. Deployment

---

## 1. Project Structure

```
engram/
├── src/
│   ├── app.tsx                  ← Root component, routing, layout
│   ├── main.tsx                 ← Entry point, mount + SW registration
│   ├── db/
│   │   ├── schema.ts            ← Dexie table definitions
│   │   ├── local.ts             ← Dexie instance + CRUD helpers
│   │   ├── sync.ts              ← Push/pull sync engine
│   │   └── migrations.ts        ← Dexie version upgrades
│   ├── hooks/
│   │   ├── useThreads.ts        ← Thread CRUD + optimistic updates
│   │   ├── useDumps.ts          ← Dump submission + AI parse trigger
│   │   ├── usePeople.ts         ← People CRUD
│   │   ├── useSync.ts           ← Background sync loop
│   │   └── useVoice.ts          ← MediaRecorder + audio blob capture
│   ├── components/
│   │   ├── ui/                  ← Shared primitives
│   │   │   ├── Pill.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── IconBtn.tsx
│   │   │   ├── ActionBtn.tsx
│   │   │   ├── Toast.tsx
│   │   │   ├── Sheet.tsx         ← Reusable bottom sheet with backdrop
│   │   │   └── Empty.tsx
│   │   ├── DumpBar.tsx           ← Persistent input bar
│   │   ├── SuggestionCard.tsx    ← AI suggestion accept/dismiss
│   │   ├── ThreadCard.tsx        ← Thread list item
│   │   ├── ThreadDetail.tsx      ← Bottom sheet detail view
│   │   ├── Pulse.tsx             ← Vertical area chart scrubber
│   │   └── PersonCard.tsx        ← People list item
│   ├── views/
│   │   ├── ThreadsView.tsx
│   │   ├── PeopleView.tsx
│   │   └── MirrorView.tsx
│   ├── lib/
│   │   ├── dates.ts              ← Date math utilities
│   │   ├── theme.ts              ← Colors, shadows, curves
│   │   └── api.ts                ← Fetch wrapper for /api/*
│   └── styles/
│       └── global.css            ← Fonts, resets, animations, keyframes
├── functions/
│   └── api/
│       ├── dump.ts               ← POST: Whisper transcribe + GLM parse
│       ├── sync.ts               ← GET: pull state / POST: push state
│       └── _middleware.ts        ← Cloudflare Access JWT validation
├── public/
│   ├── manifest.json
│   ├── icons/
│   │   ├── icon-192.png
│   │   ├── icon-512.png
│   │   └── apple-touch-icon.png
│   └── robots.txt
├── schema.sql                    ← D1 table definitions
├── seed.sql                      ← Optional dev seed data
├── wrangler.toml                 ← D1 binding, AI binding, secrets
├── vite.config.ts
├── tailwind.config.ts            ← NOT USED — we use inline styles
├── tsconfig.json
└── package.json
```

**No Tailwind. No CSS modules. Inline styles with a shared theme object.** Same approach as the prototype — it keeps the component tree self-contained and makes the design system explicit.

---

## 2. Tech Stack & Dependencies

### Frontend
| Package | Purpose |
|---------|---------|
| `react` + `react-dom` | UI |
| `dexie` | IndexedDB wrapper (local-first storage) |
| `lucide-react` | Icons |
| `recharts` | Charts in Mirror view |
| `vite` | Build tool |
| `vite-plugin-pwa` | Service worker + manifest generation |
| `workbox-precaching` | Precache static assets |

**That's it.** No router (3 views, managed by state). No state library (React state + Dexie). No CSS framework. No animation library (CSS transitions + keyframes).

### Backend (Cloudflare)
| Service | Binding | Purpose |
|---------|---------|---------|
| Pages | — | Static hosting + Functions |
| D1 | `env.DB` | SQLite database |
| Workers AI | `env.AI` | Whisper + GLM inference |
| Access | — | JWT auth on `engram.adiwak.com` |

### Dev Dependencies
| Package | Purpose |
|---------|---------|
| `wrangler` | Cloudflare CLI |
| `typescript` | Type safety |
| `@cloudflare/workers-types` | Worker type definitions |

---

## 3. Data Model

### D1 Schema (`schema.sql`)

```sql
-- Core tables
CREATE TABLE IF NOT EXISTS threads (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'task',     -- task | promise | followup | commitment
  priority    TEXT NOT NULL DEFAULT 'P1',       -- P0 | P1 | P2
  project_id  TEXT,
  opened_at   TEXT NOT NULL,                    -- ISO 8601
  closed_at   TEXT,
  closed_reason TEXT,                           -- done | canceled | delegated | irrelevant
  deadline    TEXT,
  description TEXT DEFAULT '',
  updated_at  TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE TABLE IF NOT EXISTS thread_people (
  thread_id   TEXT NOT NULL,
  person_id   TEXT NOT NULL,
  PRIMARY KEY (thread_id, person_id),
  FOREIGN KEY (thread_id) REFERENCES threads(id) ON DELETE CASCADE,
  FOREIGN KEY (person_id) REFERENCES people(id)
);

CREATE TABLE IF NOT EXISTS thread_tags (
  thread_id   TEXT NOT NULL,
  tag         TEXT NOT NULL,
  PRIMARY KEY (thread_id, tag),
  FOREIGN KEY (thread_id) REFERENCES threads(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notes (
  id          TEXT PRIMARY KEY,
  thread_id   TEXT NOT NULL,
  text        TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  FOREIGN KEY (thread_id) REFERENCES threads(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS people (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  rel         TEXT DEFAULT '',                  -- relationship label
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  color       TEXT DEFAULT '#a0714a',
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS dumps (
  id          TEXT PRIMARY KEY,
  raw         TEXT NOT NULL,                    -- original input text
  source      TEXT DEFAULT 'text',              -- text | voice | paste
  created_at  TEXT NOT NULL
);

-- Sync metadata
CREATE TABLE IF NOT EXISTS sync_meta (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_threads_open ON threads(closed_at) WHERE closed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_threads_deadline ON threads(deadline) WHERE deadline IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notes_thread ON notes(thread_id);
```

### Dexie Schema (`db/schema.ts`)

```typescript
import Dexie from 'dexie';

export class EngramDB extends Dexie {
  threads!: Table<Thread>;
  people!: Table<Person>;
  projects!: Table<Project>;
  notes!: Table<Note>;
  dumps!: Table<Dump>;
  syncQueue!: Table<SyncOp>;  // pending changes to push

  constructor() {
    super('engram');
    this.version(1).stores({
      threads: 'id, closedAt, projectId, priority, openedAt, deadline',
      people: 'id, name',
      projects: 'id, name',
      notes: 'id, threadId, createdAt',
      dumps: 'id, createdAt',
      syncQueue: '++seq, table, op',  // auto-increment, FIFO
    });
  }
}
```

### Sync Queue

Every local write also pushes to `syncQueue`:

```typescript
interface SyncOp {
  seq?: number;       // auto-increment
  table: string;      // 'threads' | 'notes' | 'people' | ...
  op: 'put' | 'delete';
  id: string;
  data?: any;         // full row for put, null for delete
  ts: string;         // ISO timestamp
}
```

Background sync drains this queue via `POST /api/sync`.

---

## 4. API Surface

Two endpoints. That's it.

### `POST /api/dump`

Processes a brain dump. Accepts either text or audio.

**Request:**
```
Content-Type: multipart/form-data

Fields:
  text?:  string        — raw text input
  audio?: Blob          — audio recording (WebM/WAV)
```

**Processing:**
1. If `audio` present → run Whisper transcription
2. Load all open threads + people + projects from D1
3. Build system prompt with full context
4. Run GLM-4.7-Flash extraction
5. Return suggestions

**Response:**
```json
{
  "transcript": "told Ethan I'd finish the backtest by Friday",
  "suggestions": [
    {
      "type": "new",
      "title": "Finish Darvas backtest for Ethan",
      "people": ["Ethan"],
      "project": "Trading",
      "deadline": "2026-03-06T00:00:00Z",
      "threadType": "promise",
      "priority": "P1",
      "tags": ["algo"],
      "confidence": "high"
    }
  ]
}
```

### `POST /api/sync`

Bidirectional sync. Client sends pending changes, receives remote state.

**Request:**
```json
{
  "lastSync": "2026-02-28T10:00:00Z",
  "changes": [
    { "table": "threads", "op": "put", "id": "abc123", "data": { ... }, "ts": "..." },
    { "table": "notes", "op": "put", "id": "def456", "data": { ... }, "ts": "..." }
  ]
}
```

**Response:**
```json
{
  "serverTime": "2026-02-28T12:00:00Z",
  "changes": [
    { "table": "threads", "op": "put", "id": "xyz789", "data": { ... } }
  ]
}
```

**Conflict resolution:** last-write-wins by `updated_at`. Single user, so real conflicts are impossible — this only matters for multi-device scenarios where both devices were offline.

---

## 5. Design System

### Color Tokens

```typescript
export const theme = {
  // Backgrounds
  bg:         '#faf9f7',     // parchment base
  bg2:        '#f2f0ed',     // subtle inset
  surface:    '#eae8e4',     // pressed/active states

  // Text
  text:       '#1a1a1a',     // primary
  text2:      '#5a5651',     // secondary
  text3:      '#8a857f',     // tertiary
  text4:      '#b5b0a9',     // disabled/muted

  // Accent
  accent:     '#a0714a',     // copper — the ONE color

  // Semantic
  red:        '#c0453a',
  amber:      '#a07c28',
  green:      '#3d8a4a',
  purple:     '#6e63a0',
} as const;
```

### Typography

| Element | Font | Size | Weight |
|---------|------|------|--------|
| App title | Instrument Serif | 22px | 400 |
| Thread title (card) | DM Sans | 13.5px | 400 |
| Thread title (detail) | Instrument Serif | 19px | 400 |
| Section header | DM Sans | 10px uppercase | 400, 0.8 tracking |
| Body text | DM Sans | 14px | 300 |
| Badge | DM Sans | 10.5px | 400 |
| Mono data | DM Mono | 10-11px | 300 |
| Stat numbers | DM Mono | 18px | 300 |

### Shadow System

```typescript
export const shadows = {
  sm: '0 1px 2px rgba(0,0,0,0.04), 0 1px 1px rgba(0,0,0,0.02)',
  md: '0 2px 8px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
  lg: '0 8px 24px rgba(0,0,0,0.08), 0 2px 6px rgba(0,0,0,0.03)',
  xl: '0 16px 40px rgba(0,0,0,0.1), 0 4px 12px rgba(0,0,0,0.04)',
};
```

**Rule: borders are `rgba(0,0,0,0.04-0.08)`, never hex.** Shadows do the depth work.

### Easing

```typescript
export const ease = {
  spring: 'cubic-bezier(0.16, 1, 0.3, 1)',    // overshoot — lifts, enters
  ease:   'cubic-bezier(0.4, 0, 0.2, 1)',      // material — color, opacity
  snap:   'cubic-bezier(0.2, 0, 0, 1)',         // quick settle — press
};
```

### Interaction States

Every interactive element follows this contract:

| State | Transform | Shadow | Border | Transition |
|-------|-----------|--------|--------|------------|
| Rest | none | sm | 0.04 | — |
| Hover | translateY(-1px) | md | 0.08 | 0.2s spring |
| Press | scale(0.96-0.99) | sm | 0.08 | 0.15s snap |
| Focus | none | sm + glow ring | accent 0.35 | 0.2s ease |
| Active | none | sm | accent bg | 0.15s ease |
| Disabled | none | none | 0.03 | — |

### Card Treatment

```css
/* The "glass card" — used everywhere */
background: rgba(255, 255, 255, 0.45);
border: 1px solid rgba(0, 0, 0, 0.04);
border-radius: 12px;
box-shadow: 0 1px 2px rgba(0,0,0,0.04), 0 1px 1px rgba(0,0,0,0.02);
transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);

/* hover */
background: rgba(255, 255, 255, 0.8);
border-color: rgba(0, 0, 0, 0.08);
box-shadow: 0 2px 8px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
transform: translateY(-1px);

/* press */
transform: scale(0.99);
box-shadow: 0 1px 2px rgba(0,0,0,0.04);
```

### Animation Keyframes

```css
/* Card entrance — staggered with animationDelay */
@keyframes cardIn {
  from { opacity: 0; transform: translateY(4px) scale(0.98); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}

/* Bottom sheet */
@keyframes sheetUp {
  from { transform: translateY(20px); opacity: 0; }
  to   { transform: translateY(0); opacity: 1; }
}

/* Backdrop */
@keyframes overlayIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}

/* Toast */
@keyframes toastIn {
  from { opacity: 0; transform: translateX(-50%) translateY(10px) scale(0.96); }
  to   { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
}

/* Shimmer loading bar */
@keyframes shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
```

---

## 6. Component Architecture

### Primitives (`components/ui/`)

These are the building blocks. Every button, card, and interactive element composes from these:

**`IconBtn`** — 34×34 circle/rounded-square. Tracks hover + pressed state. Used for mic, paste, close, delete, etc.

**`ActionBtn`** — Primary action button with colored background and shadow that intensifies on hover. Used for "Resolve", "Accept", send.

**`Pill`** — Segmented control item. Active pill gets white glass + shadow. Used for filters (Open/Overdue/All) and Mirror tabs.

**`Badge`** — Inline metadata tag. Subtle background tint of its color. Used for priority, people, project, status.

**`Sheet`** — Reusable bottom sheet. Handles backdrop blur overlay, spring-curve slide-up animation, drag handle, scroll containment.

**`Toast`** — Fixed-position notification with blur backdrop and spring entrance. Auto-dismisses.

### Feature Components

**`DumpBar`** — Persistent input. Two modes:
- Collapsed: placeholder + mic + paste
- Expanded: textarea + full toolbar + suggestions panel

**`SuggestionCard`** — AI parse result. Shows type badge, extracted data, accept/dismiss actions. Animates in with stagger. Fades to green on accept. Slides out on dismiss.

**`ThreadCard`** — List item. Left color border (priority-coded), title, badges, age. Full hover/press interaction cycle.

**`Pulse`** — SVG area chart rendered as a 48px vertical strip. Bezier-smoothed line, gradient fill, overdue layer. Pointer drag scrubs through time. Shows floating tooltip with date/count.

**`ThreadDetail`** — Sheet containing: editable title, metadata badges, timeline of notes, add-note input, resolve/reopen/delete actions.

**`PersonCard`** — List item with name, relationship label, open thread count, overdue indicator, animated chevron.

---

## 7. Offline-First Strategy

### Write Path
```
User action → Dexie (instant) → UI updates → SyncQueue entry
                                                    ↓
                                          Background loop (5s interval)
                                                    ↓
                                          POST /api/sync (batch)
                                                    ↓
                                          D1 upserts
                                                    ↓
                                          SyncQueue drained
```

### Read Path
```
App boot → Dexie has data? → Render immediately
                ↓ (parallel)
         GET /api/sync (delta since lastSync)
                ↓
         Merge into Dexie → UI re-renders
```

### AI Path (requires network)
```
Dump submitted → Save to Dexie (raw text, source='text'|'voice')
                     ↓
              POST /api/dump (text or audio blob)
                     ↓ (online)
              Suggestions returned → Show cards
                     ↓ (offline)
              Queue dump, show "will parse when online"
              → On reconnect, process queued dumps
```

### Sync States

| State | Indicator | Behavior |
|-------|-----------|----------|
| Synced | None | All quiet |
| Syncing | Subtle shimmer on header | Background push/pull |
| Pending | Small dot badge on header | Local changes not yet pushed |
| Offline | "Offline" mono text in header | All writes local, AI unavailable |
| Error | Red dot | Sync failed, will retry |

---

## 8. AI Pipeline

### Voice Flow

```
Browser MediaRecorder (WebM/opus)
    ↓
POST /api/dump (multipart: audio blob)
    ↓
Workers AI: @cf/openai/whisper-large-v3-turbo
    → { text: "told Ethan I'd finish the backtest..." }
    ↓
Workers AI: @cf/zai-org/glm-4.7-flash
    → System prompt with D1 context
    → JSON array of suggestions
    ↓
Response to client
```

### System Prompt Strategy

The system prompt is built server-side with full D1 context:

```
You process brain dumps about personal commitments.
Extract ALL actionable items as a JSON array.

KNOWN PEOPLE:
- Ethan (Client)
- Fin (Collaborator)
- Jordan (Manager)

KNOWN PROJECTS:
- capo.fm
- Consulting
- Trading

OPEN THREADS:
- [l1] "Ship capo.fm payment integration" (task, P0) → Fin, capo.fm, 18d, deadline Mar 1
- [l2] "Darvas box backtest for Ethan" (promise, P1) → Ethan, Trading, 16d, deadline Feb 26
- [l3] "Follow up Jordan re: onboarding" (followup, P1) → Jordan, Consulting, 10d
...

TODAY: 2026-02-28

Return ONLY a JSON array. Each element:
{
  "type": "new" | "close" | "update" | "note",
  "title": "...",
  "people": ["name"],
  "project": "name or null",
  "deadline": "ISO or null",
  "threadType": "task | promise | followup | commitment",
  "priority": "P0 | P1 | P2",
  "tags": ["tag"],
  "threadId": "for close/update/note — match from OPEN THREADS",
  "reason": "done | canceled | delegated | irrelevant",
  "changes": { "field": "value" },
  "text": "for notes",
  "confidence": "high | medium | low"
}

RULES:
- Fuzzy match people and project names
- "finished/done/completed" → close with reason "done"
- "cancel/scratch/kill/nevermind" → close with reason "canceled"
- "pushed deadline/moved to" → update with new deadline
- "note on/about/re:" → note on existing thread
- Default: new thread
- Infer priority: urgent/asap/critical → P0, normal → P1, low/whenever → P2
- Infer type: "I'll/I need to" → task, "told/promised X" → promise, "follow up/check in" → followup
```

### Fallback Strategy

If GLM output is malformed (invalid JSON, missing fields):
1. Retry once with stricter temperature (0.1)
2. If still fails, return single suggestion: `{ type: "new", title: <raw text>, priority: "P1" }`
3. Log failure to D1 for debugging

If GLM quality is insufficient for complex multi-intent dumps:
- Swap to Anthropic API call from the same Worker function
- `env.ANTHROPIC_API_KEY` as a Cloudflare secret
- One-line model swap, no architectural change

---

## 9. PWA Configuration

### `vite.config.ts`

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png'],
      manifest: {
        name: 'Engram',
        short_name: 'Engram',
        description: 'Commitment tracker',
        theme_color: '#faf9f7',
        background_color: '#faf9f7',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com/,
            handler: 'CacheFirst',
            options: { cacheName: 'fonts-cache', expiration: { maxEntries: 10, maxAgeSeconds: 365 * 24 * 60 * 60 } },
          },
          {
            urlPattern: /\/api\//,
            handler: 'NetworkFirst',
            options: { cacheName: 'api-cache', networkTimeoutSeconds: 5 },
          },
        ],
      },
    }),
  ],
});
```

### Native-Feel CSS

```css
/* Applied globally — makes the PWA feel native */
html, body {
  overscroll-behavior: none;           /* No rubber-band on scroll edges */
  -webkit-tap-highlight-color: transparent;  /* No flash on tap */
  -webkit-touch-callout: none;         /* No long-press context menu */
  user-select: none;                   /* No text selection on UI */
  touch-action: manipulation;          /* No double-tap zoom */
}

/* Allow text selection only on content areas */
.selectable {
  user-select: text;
  -webkit-user-select: text;
}

/* Safe areas for notched phones */
body {
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
}

/* Smooth momentum scroll */
.scroll {
  -webkit-overflow-scrolling: touch;
  overflow-y: auto;
}
```

### `<meta>` Tags

```html
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="theme-color" content="#faf9f7">
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
```

---

## 10. Auth & Security

### Cloudflare Access

Free for up to 50 users. For single-user Engram:

1. Add `engram.adiwak.com` as an Access Application
2. Policy: Allow → Emails → `adi@adiwak.com` (or whatever)
3. Identity provider: one-time PIN (email code) or GitHub OAuth

Every request to `engram.adiwak.com` hits Cloudflare's edge first. Unauthenticated requests get a login screen. Authenticated requests get a signed JWT in `CF-Access-JWT-Assertion` header.

### API Validation (`functions/api/_middleware.ts`)

```typescript
export async function onRequest(context) {
  // Cloudflare Access validates the JWT at the edge
  // This middleware verifies the JWT signature as defense-in-depth
  const jwt = context.request.headers.get('CF-Access-JWT-Assertion');
  if (!jwt) return new Response('Unauthorized', { status: 401 });

  try {
    // Verify with Access certs endpoint
    const certsUrl = `https://${context.env.CF_ACCESS_TEAM}.cloudflareaccess.com/cdn-cgi/access/certs`;
    // ... JWT verification logic
    return await context.next();
  } catch {
    return new Response('Forbidden', { status: 403 });
  }
}
```

### Secrets

```bash
wrangler secret put ANTHROPIC_API_KEY    # Only if using Claude fallback
# Workers AI doesn't need keys — it's a binding
```

---

## 11. Build Phases

### Phase 1: Foundation (Day 1-2)

**Goal:** Vite project, Dexie schema, basic CRUD, PWA installable.

- [ ] `npm create cloudflare@latest engram -- --framework=react`
- [ ] Set up Vite + TypeScript + vite-plugin-pwa
- [ ] Create Dexie database with all tables
- [ ] Port theme, typography, shadow system, animation keyframes
- [ ] Build UI primitives: IconBtn, ActionBtn, Pill, Badge, Toast, Sheet
- [ ] Create manifest.json, generate icons
- [ ] Verify: app installs on phone, works offline (empty state)

### Phase 2: Core UI (Day 2-3)

**Goal:** All three views rendering from Dexie data.

- [ ] Port ThreadCard, ThreadDetail, Pulse scrubber
- [ ] Port DumpBar (text only — no AI yet)
- [ ] Build ThreadsView with filters, sorting, Pulse integration
- [ ] Build PeopleView with person detail
- [ ] Build MirrorView with all charts
- [ ] Wire up Dexie CRUD: create/update/close/delete threads, add notes
- [ ] Seed Dexie with sample data for dev
- [ ] Verify: full app works entirely offline from IndexedDB

### Phase 3: Backend (Day 3-4)

**Goal:** D1 database, sync endpoint, AI pipeline.

- [ ] `wrangler d1 create engram`
- [ ] Run schema.sql against D1
- [ ] Build `functions/api/sync.ts` — push/pull endpoint
- [ ] Build sync engine in client (`db/sync.ts`)
- [ ] Build `functions/api/dump.ts` — GLM text parsing
- [ ] Wire DumpBar → POST /api/dump → suggestion cards
- [ ] Test: create thread on phone, see it on desktop via D1

### Phase 4: Voice (Day 4-5)

**Goal:** Record audio in browser, transcribe with Whisper, parse with GLM.

- [ ] Replace browser SpeechRecognition with MediaRecorder
- [ ] Record WebM/opus blob on mic button press
- [ ] POST audio blob to /api/dump as multipart
- [ ] Whisper transcription in Worker
- [ ] Show transcript + suggestions
- [ ] Add recording indicator (waveform or pulsing dot)
- [ ] Test: voice dump → transcription → thread created

### Phase 5: Auth & Deploy (Day 5)

**Goal:** Live at engram.adiwak.com with access control.

- [ ] Set up Cloudflare Access on domain
- [ ] Add _middleware.ts JWT validation
- [ ] Configure DNS: engram.adiwak.com → Pages
- [ ] `wrangler pages deploy`
- [ ] Test full flow on phone: install PWA, dump, voice, sync
- [ ] Generate proper app icons (192, 512, apple-touch)

### Phase 6: Polish (Day 6-7)

**Goal:** Native-feel refinements.

- [ ] Add haptic feedback via `navigator.vibrate()` on accept/resolve
- [ ] Sync status indicator in header
- [ ] Offline dump queue with "pending" indicator
- [ ] Stagger animations on view transitions
- [ ] Pull-to-refresh gesture
- [ ] Error boundaries + retry logic
- [ ] Empty states for all views
- [ ] Add Anthropic API fallback for complex dumps
- [ ] Performance audit: ensure <100ms interaction latency

---

## 12. Deployment

### `wrangler.toml`

```toml
name = "engram"
compatibility_date = "2026-02-28"
compatibility_flags = ["nodejs_compat"]

[site]
bucket = "./dist"

[[d1_databases]]
binding = "DB"
database_name = "engram"
database_id = "<from wrangler d1 create>"

[ai]
binding = "AI"

[vars]
CF_ACCESS_TEAM = "adiwak"
```

### Deploy Commands

```bash
# First time
wrangler d1 create engram
wrangler d1 execute engram --file=./schema.sql
wrangler pages project create engram

# Every deploy
npm run build
wrangler pages deploy dist

# Secrets (one-time)
wrangler secret put ANTHROPIC_API_KEY
```

### Domain

```
engram.adiwak.com → Cloudflare Pages (custom domain)
                  → Access policy: allow adi@adiwak.com
                  → D1: engram database
                  → AI: Workers AI binding
```

One command deploys everything: frontend, API functions, database migrations. Zero infrastructure to manage. Zero monthly cost on free tier.