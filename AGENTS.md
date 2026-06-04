# AGENTS.md

Guidance for Codex and other coding agents working on Subdivision Quiz.

## Project Shape

- This is a Vite + React + TypeScript static site.
- The deployed site is GitHub Pages, so keep GitHub Pages base-path support intact.
- Main app logic lives in `src/App.tsx`.
- Map rendering lives in `src/QuizMap.tsx`.
- Data loading, name normalization, aliases, country summaries, and matching helpers live in `src/geo.ts`.
- Generated public data lives in `public/data/`.

## Commands

- `npm run dev` starts the local app at `127.0.0.1`.
- `npm run test:run` runs the Vitest suite once.
- `npm run build` type-checks and builds production assets.
- `npm run check` runs tests and then the production build.
- `npm run data` rebuilds the generated map/name data.

Run `npm run check` before considering code changes done.

## Product Direction

- The site should feel like a playable geography quiz, not a dashboard or landing page.
- Keep the answer input immediately above the map.
- Keep controls compact, but avoid squeezing button labels on tablet/mobile widths.
- Small places and island countries should remain geographically honest, but may need markers, insets, or detail tiles so they are playable.
- Avoid overly US-specific language in generic UI copy.

## Data And Naming

- Natural Earth Admin-1 is the base subdivision source.
- Native/local names matter. Preserve both translated English names and local or romanized names when available.
- Do not assume all local scripts can safely ignore diacritics. Thai marks, Japanese dakuten, and similar non-Latin marks are meaningful.
- Latin-script diacritics may be folded for easier typing, but non-Latin combining marks should generally be preserved.
- US state two-letter postal abbreviations should not count as answers.
- Be careful with source rows where the subdivision display name equals the country name. Some are valid one-subdivision places; some need overrides.

## Implementation Notes

- Use existing helpers in `src/geo.ts` instead of creating parallel matching logic.
- Avoid mutating arrays passed from React memo values. Copy before sorting.
- World mode can render thousands of SVG paths, so performance-sensitive changes should avoid unnecessary recomputation on every guess or hover.
- Runtime Wikidata lookups are useful, but build-time enrichment is preferable for consistent static-site behavior.
- Progress is stored in localStorage per scope; reset behavior should clear the active scope only.
- If a UI change affects first-time guidance, consider bumping the help-card localStorage key so users see the updated copy once.

## Testing

- Add focused Vitest coverage for matcher/data behavior in `src/geo.test.ts`.
- Prefer tests that protect general rules and known data classes, not only one-off regressions.
- Useful test areas:
  - script-aware normalization
  - native/local alias matching
  - duplicate-name ambiguity
  - display-name overrides
  - URL/scope behavior if browser tests are added later

## Deployment

- Do not break `vite.config.ts` base handling:
  - local development uses `/`
  - GitHub Pages build uses `/Subdivision-Quiz/`
- GitHub Actions runs tests before building and deploying.
