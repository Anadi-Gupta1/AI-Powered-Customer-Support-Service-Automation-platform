<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture
- All app data lives in a local simulation layer (`src/lib/sim`): pure actions mutate a cloned AppState and return Results; the store persists to versioned localStorage. Why: app must run fully standalone without a backend.
- Permission checks live inside actions (`guard`), not just in UI. Why: centralized authorization, denials are audited.
- AI is a deterministic mock in `src/lib/sim/ai.ts`. Why: no paid AI or external calls; keep as fallback if a real provider is added.
- Business rules are covered by `src/test/sim-rules.test.ts`; update it when rules change.
- AI Employee Simulation engine lives in `src/lib/sim/employee.ts`: each step calls real actions on a cloned state and commits only on success; run progress persists separately in localStorage. Why: honest, idempotent, refresh-safe demo runs.
