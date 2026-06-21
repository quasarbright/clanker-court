# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # dev server at http://localhost:5173
npm run build     # tsc + vite production build → dist/
npm run lint      # eslint
npm run preview   # serve the production build locally
npm run deploy    # build + push dist/ to gh-pages branch
```

No test suite exists.

## Architecture

Fully static React/TypeScript/Vite SPA. All LLM calls go from the browser directly to [OpenRouter](https://openrouter.ai) — no backend. The user's API key is stored in `localStorage` (see `src/store/settings.ts`).

### Data flow: setup phase

`generateCase` in `gameStore.ts` runs four sequential LLM calls:

1. **`storyGenerator`** → `TrueStory` — the canonical ground truth (crime, POIs, evidence, `groundTruthGuilty`). This is the only place the full truth exists.
2. **`poiBuilder`** → `POIBrief[]` — one first-person memory narrative per POI, constructed from only what they could witness. Witness agents receive *only their own brief* — the `TrueStory` never reaches them.
3. **`police`** → `CaseFile` — the redacted dossier both lawyers receive: known facts, open questions, evidence list. No access to `groundTruthGuilty`.
4. **`court`** → `Personas` — judge, jury, and opposing counsel personas seeded from the `CaseFile`.

### Trial loop

`gameStore.ts` drives the trial via `run()`, which loops calling `autoStep()` until `playerInput()` returns true (meaning the human needs to act). The trial progresses through `Phase` values in `types.ts`. Key phases:

- Openings → prosecution witnesses → defense witnesses → closings → verdict
- During witness phases, `Examination` tracks who's examining, which stage (`direct`/`cross`), and the `pendingQuestion` awaiting objection resolution.

**Objection resolution** (`resolveObjection`): after the examiner asks, the opposing side (NPC or player) may object → `judgeRuling` rules → if sustained, question is struck; else `witnessAnswer` is called.

### Agent files (`src/agents/`)

Each agent is a thin function that builds a prompt and calls `src/llm/openrouter.ts`. Agents return typed objects parsed from LLM JSON output. The `counsel` agent handles opposing counsel's questions, objections, and statements; `witness` handles witness answers; `judge` handles rulings; `jury` handles the final verdict.

### State

All game state lives in a single Zustand store (`src/store/gameStore.ts`). `TrialState` in `types.ts` is the authoritative shape. `src/game/engine.ts` contains pure state-transition helpers (no side effects, no LLM calls) used by the store.

### UI

`App.tsx` gates on phase to show `SetupScreen` → `CaseFileScreen` → `TrialView` → `VerdictScreen`. `ApiKeyGate` wraps the whole app and blocks if no OpenRouter key is stored. `TrialView` is the main chat-like interface.
