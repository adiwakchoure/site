# Engram

**A commitment tracker that thinks the way you do.**

Brain dump everything — voice, text, paste — and Engram extracts your commitments, tracks them as threads, and reflects your patterns back to you. No forms. No project management ceremony. Just stream of consciousness in, structured accountability out.

---

## The Problem

You make commitments constantly — in calls, in Slack, in your own head. "I'll send that by Friday." "Remind me to follow up with Jordan." "Cancel the resume thing." These scatter across apps, notes, and memory. Some you keep. Most you forget. The ones you forget erode trust — with others and with yourself.

Every existing tool asks you to manually create tasks, assign metadata, set dates. That's not how commitments happen. They happen in messy, multi-intent brain dumps. You need a tool that meets you where you are.

## The Insight

Your commitments form a graph of accountability — to yourself, to specific people, on specific projects, with varying urgency. The shape of that graph over time reveals who you are: what you prioritize, who you neglect, how long you let things rot, whether you finish what you start.

Engram captures this graph passively and reflects it back honestly.

## How It Works

```
[voice / text / paste]
        ↓
   AI extraction
   (Whisper + GLM)
        ↓
  suggestion cards
  [accept / dismiss]
        ↓
    threads graph
        ↓
  mirror analytics
```

1. **Dump** — speak, type, or paste anything. "Told Ethan I'd have the backtest done by Friday, also cancel the resume update, and remind me to ping Fin about the pipeline."

2. **Parse** — AI extracts three actions: new thread (Darvas backtest → Ethan, deadline Friday), close thread (resume update → canceled), note (ping Fin about pipeline). You accept or dismiss each.

3. **Track** — threads live in a timeline with a pulse scrubber — a vertical waveform showing your commitment load over time. Scrub backward to see what was active any day in the past.

4. **Reflect** — the Mirror view shows your patterns: kept rate, average thread lifetime, overdue count, throughput, per-person load. Honest numbers, not gamification.

---

## Architecture

**Entirely on Cloudflare. One vendor. One deploy.**

| Layer | Service | Purpose |
|-------|---------|---------|
| Frontend | Pages | Static React PWA |
| Database | D1 | SQLite at the edge |
| Voice | Workers AI (Whisper) | Speech-to-text |
| Logic | Workers AI (GLM-4.7-Flash) | Dump parsing + extraction |
| Auth | Access | Zero-trust, free for 1 user |
| API | Pages Functions | 2 endpoints |
| Local cache | IndexedDB (Dexie) | Offline-first, zero-latency UI |

**Zero external dependencies.** No Anthropic API key. No Supabase. No Vercel. No Auth0. One `wrangler deploy` and you're live.

The app writes to IndexedDB first (instant), then syncs to D1 in the background. The network is never in the critical path. When offline, dumps are queued locally — AI parsing happens when connectivity returns.

---

## Design Language

Warm, quiet, precise. Inspired by the texture of a well-used notebook — not a SaaS dashboard.

- **Parchment base** (`#faf9f7`) with translucent white glass cards
- **Instrument Serif** for headings — literary, not corporate
- **DM Sans** for body — clean, neutral, slightly warm
- **DM Mono** for data — ages, dates, counts
- **Copper** (`#a0714a`) as the single accent — warm, organic
- **Depth via shadow, not border** — layered box-shadows with spring-curve transitions
- **Every element responds to touch** — hover lifts, press compresses, focus glows

The UI should feel like it was designed for someone who cares about typography and dislikes clutter.

---

## Core Views

### Threads
The primary view. A scrollable list of open commitments with a vertical pulse scrubber on the right edge — an area chart of your commitment load over time. Drag to time-travel: the list filters to show what was active on any historical date.

### People
Commitment load per person. Tap to see open threads, resolution stats, and patterns for that relationship. Reveals who you're neglecting and who you're overcommitting to.

### Mirror
Self-reflection dashboard. Kept rate, average thread lifetime, age distribution, weekly throughput, per-person load bars. The honest scoreboard.

### Dump Bar
Always visible between content and tab bar. Collapsed: single-line placeholder with mic + paste buttons. Expanded: 3-line textarea with full toolbar. Suggestion cards appear inline above the input. No modals, no overlays for the primary input flow.

---

## What This Is Not

- Not a project management tool. No boards, no sprints, no Gantt charts.
- Not a todo app. No checkboxes, no recurring tasks, no subtasks.
- Not a calendar. No time blocking, no scheduling.
- Not a notes app. Dumps are raw input, not documents.

Engram tracks one thing: **what you said you'd do, and whether you did it.** Everything else is noise.

---

## Target

Single user. Personal accountability. Ships to `engram.adiwak.com` as an installable PWA. Total infrastructure cost: $0/month on Cloudflare's free tier.