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
  - Coded rules: weighted random by need urgency, trait strength and remembered outcomes. Used when no key is set or Jev fails.
- **Memory** (`app/utils/db.ts`): decisions, owner actions and lessons in IndexedDB. Export/import as JSON.
- **Learning**: each judged outcome nudges the trait tied to that action by at most ±0.04, clamped to 0.05–0.95.

## Jev proxy

`api.typesafe.ai` rejects browser origins (CORS), so the browser calls `POST /api/jev` (`server/api/jev.post.ts`).
It forwards the `x-jev-key` header as a Bearer token and stores nothing. The key stays in memory unless the user ticks "Remember key".

## Not built yet

- Local model backend (wllama/WebLLM reading option logits) behind the same `Brain` interface.
- Dialogue generation (Gemini Nano / WebLLM); lines are canned for now.
