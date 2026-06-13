# ⚖️ Clanker Court

An LLM-powered courtroom trial game. You play a **prosecutor** or **defense attorney**; every other participant — witnesses, opposing counsel, the judge, and the jury — is an AI agent.

Generate a case, examine witnesses, object, give opening and closing arguments, and let the jury decide. Find out at the end whether the defendant was actually guilty.

**Live:** https://quasarbright.github.io/clanker-court/

## How it works

All LLM calls happen in your browser against [OpenRouter](https://openrouter.ai). You supply your own API key (stored only in your browser's `localStorage`). No backend, no server-side secrets.

**Setup pipeline** (each step is one LLM call):
1. **Story Generator** — invents the complete true story: crime, charge, the people involved, a timeline, physical evidence, and whether the defendant is actually guilty.
2. **POI Builder** — turns each person into a first-person memory narrative containing only what they could plausibly know. Witnesses receive **only their own brief** at runtime — the full truth never reaches them.
3. **Police** — writes the redacted case file both lawyers receive: established facts, evidence, open questions. Written impartially, without access to the hidden truth.
4. **Court** — writes personas for the judge, jury, and opposing counsel.

**Trial loop:** openings → prosecution witnesses → defense witnesses → closings → jury verdict. Each witness gets a direct examination and a cross; each examination runs up to 3 questions or until "no further questions". After every question the opposing side may object, and the judge rules. The jury deliberates from the trial transcript only — no pre-read documents.

## Development

```bash
npm install
npm run dev       # dev server at http://localhost:5173
npm run build     # production build → dist/
npm run preview   # preview the production build locally
```

## Deploy to GitHub Pages

```bash
npm run deploy
```

This builds the project and pushes `dist/` to the `gh-pages` branch. Make sure the repo's GitHub Pages source is set to the `gh-pages` branch in Settings → Pages.

## Stack

- React 19 + TypeScript + Vite
- Zustand for state
- OpenRouter (OpenAI-compatible REST API)
- No backend — fully static, deployable anywhere
