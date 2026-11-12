# Browser Pet

A pet that lives in your browser tab. It picks actions, remembers outcomes in IndexedDB, and shifts its personality based on how things turned out.

Built with Nuxt 4 (client-only SPA plus one server route).

## Run

```sh
npm install
npm run dev        # http://localhost:3000
npm run typecheck
```

## How it works

- **World** (`app/utils/world.ts`): needs, traits, actions. Code decides what each action does.
- **Brain** (`app/utils/brain/`): one `Brain.decide(state, questions)` interface.
  - Jev: one batched TypeSafe call per tick (action choice, mood, judgment of the last outcome, lesson yes/no).
  - Local model (`app/utils/brain/local.ts`): imitates Jev with an in-browser model. Each question becomes a lettered multiple-choice prompt; WebLLM reads the first token's log-probabilities (top 5 only), Gemini Nano returns one constrained answer (no probabilities).
  - Coded rules: weighted random by need urgency, trait strength and remembered outcomes.
  - Fallback order each tick: chosen brain → local model (if loaded) → coded rules. Jev times out after 20 s, local after 60 s.
- **Local model** (`app/utils/local/`): "Auto" picks Gemini Nano (Chrome Prompt API) if it is already downloaded, else Qwen2.5 0.5B via WebLLM (~400 MB) if a real WebGPU adapter exists (software GPUs are skipped), else a Gemini Nano that still needs Chrome's multi-GB download. Chrome keeps downloading Nano in the background; the menu shows when it is ready. Loaded on button click, then auto-loaded on later visits. Also writes the pet's lines when enabled.
- **Memory** (`app/utils/db.ts`): decisions, owner actions and lessons in IndexedDB. Export/import as JSON.
- **Learning**: each judged outcome nudges the trait tied to that action by at most ±0.04, clamped to 0.05–0.95.

## Jev proxy

`api.typesafe.ai` rejects browser origins (CORS), so the browser calls `POST /api/jev` (`server/api/jev.post.ts`).
It forwards the `x-jev-key` header as a Bearer token and stores nothing. The key stays in memory unless the user ticks "Remember key".

## Not built yet

- Jev scoring of dialogue candidates (the local model writes one line; Jev does not pick between several).
