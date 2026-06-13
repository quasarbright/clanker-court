# ⚖️ Clanker Court

An LLM-powered courtroom game. You play a **prosecutor** or **defense attorney**; every
other participant — witnesses, opposing counsel, the judge, and the jury — is an AI agent.
Generate a case, examine witnesses, object, give closing arguments, and let the jury decide.

It's a **static site**. All model calls happen in your browser against
[OpenRouter](https://openrouter.ai); you supply your own API key (stored only in your
browser's `localStorage`). No backend, no server-side secrets.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static output in dist/ (deploy to GitHub Pages, Netlify, etc.)
```

On first load you'll be asked for an OpenRouter API key and a model. Default model is
`openai/gpt-4o-mini` (cheap + widely available). Change it any time via ⚙️ Settings.

## How it works

**Setup pipeline** (each step is one LLM agent):
1. **Story Generator** invents the complete true story — crime, charge, the people involved,
   the timeline, and whether the defendant is actually guilty.
2. **POI Builder** turns each person into a first-person *knowledge brief* containing only
   what that person could plausibly know. The witness agents receive **only their own brief** —
   the full true story never reaches them, so they can't leak what they didn't witness, and
   they answer "I don't know" rather than hallucinate.
3. **Police** agent produces the redacted case file both lawyers (and the judge/jury) see —
   established facts plus deliberate open questions.
4. **Court** agent writes personas for the judge, jury, and opposing counsel.

**Trial loop** (`src/game/engine.ts`) follows the sequence in `prompt.md`: openings →
prosecution witnesses → defense witnesses → closings → verdict. Each witness gets a direct
examination by the calling side and a cross by the other; each examination runs up to 10
questions or until "no further questions". After every question the opposing side may object
(leading is only objectionable on direct; out-of-scope only on cross), and the judge rules.
A witness, once called, can't be recalled. The defendant may plead the Fifth; other witnesses
must answer.

## Layout

```
src/
  llm/openrouter.ts     OpenRouter fetch client + tolerant JSON parsing
  agents/               one module per agent (story, poi, police, court, witness, counsel, judge, jury)
  game/                 types, fixed objection list, trial state machine
  store/                zustand store (async orchestration) + settings (localStorage)
  components/           ApiKeyGate, SetupScreen, CaseFileScreen, TrialView, VerdictScreen
```

## Not yet built

- PvP (a human opposing counsel) — see `prompt.md` "future ideas".
