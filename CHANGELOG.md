# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.2]

### Fixed

- **Y.js store — reordering a clause no longer makes its text vanish.** Moving a preamble clause, operative clause, or subclause up/down went through `swap()`, which deleted the clause `Y.Map`s and re-inserted the _same_ instances. A Yjs shared type that has been removed from the document is tombstoned and cannot be re-integrated, so the clause came back empty. `swap()` now inserts fresh deep clones (`cloneClauseMap`) instead of the original instances.
- **Y.js store — textareas rebind after a reorder.** `bindYTextToTextarea` captures a single `Y.Text` instance at attach time, but any reorder necessarily destroys that instance (Yjs has no in-place array move) while the `{#each}` keyed by clause id preserves the DOM node, so `@attach` never re-runs. The deleted `Y.Text` fired an observe event that blanked the still-bound textarea. `TextHandle.bindTextarea` now observes structural document changes and rebinds to the freshly-resolved `Y.Text` whenever the instance changes; plain text edits keep the same instance and are skipped.

## [0.2.0-rc1]

### Headline

The editor is no longer a self-contained `$state`-owning component. It now consumes a **`ResolutionStore`** abstraction, which the host application instantiates. Two implementations ship:

- `createNativeStore` — plain Svelte 5 `$state`, identical UX to `0.1.x`.
- `createYjsStore` — Y.js-backed, enables true character-level real-time co-editing.

This is a **breaking change**. Consumers of `0.1.x` must migrate (see `MIGRATION.md`). The benefit is that all collaboration concerns (locking, presence, sync) move out of the host app and into a swappable store.

### Added

- **`/` (main entry)**: `createNativeStore`, `createEmptyNativeStore`, types `ResolutionStore`, `TextHandle`, `TextLocation`, `ClausePath`, `SubclausesBlockPath`, `OutdentResult`, `PresenceAdapter`, `PresenceUser`, `PresenceInfo`, `NativeStoreOptions`.
- **`/yjs` subpath** (new): `createYjsStore`, `createAwarenessPresence`, `jsonToYDoc`, `yDocToJson`, `replaceResolution`, `bindYTextToTextarea`, `ROOT_KEY`, types `YjsStoreOptions`, `AwarenessPresenceOptions`.
  - Y.Doc layout: a single root `Y.Map` keyed by `ROOT_KEY` (`'resolution'`) with `committeeName: Y.Text`, `preamble: Y.Array<Y.Map>`, `operative: Y.Array<Y.Map>`. Per-clause text content is stored as `Y.Text` so cursors survive remote edits.
  - All mutators on the Y.js store are wrapped in `Y.Doc.transact(..., 'local')`; observers see one coherent change per call. Server-side mutations should use the `'server'` origin tag.
  - `bindYTextToTextarea` is a cursor-preserving CRDT binding installed via `TextHandle.bindTextarea(el)`.
  - `createAwarenessPresence` adapts a `y-protocols/awareness` instance to `PresenceAdapter`.
- `ResolutionEditor` now accepts an optional `presence?: PresenceAdapter` prop. The native path passes `undefined`.

### Changed

- **`ResolutionEditor` props**: now requires `store: ResolutionStore`. See "Removed" for what disappeared.
- **`ClauseEditor`**: now takes `handle: TextHandle` (and the usual decorators); installs the binding via `$effect(() => handle.bindTextarea(el))`.
- **`OperativeClauseEditor`**: now takes `store` + `clause`. Internal block lookups go through `store.getTextHandle(...)`.
- **`SubClauseEditor`**: now takes `store` + `path: SubclausesBlockPath`; recursive descent uses the same path shape.
- **i18n**: removed `startEditing` / `doneEditing` label keys (no more lock toggles in UI).
- **Schema**: no changes — `Resolution`, `PreambleClause`, `OperativeClause`, `SubClause`, `ClauseBlock`, etc. are unchanged. JSON written by `0.1.x` consumers loads without migration.

### Removed

- `ResolutionEditor` props removed: `resolution`, `editable` ✱, `committeeName`, `onResolutionChange`. Editing flows through the store; `editable` is still accepted but the per-clause lock UI has been removed entirely.
  - ✱ `editable` _prop_ still exists as a render-mode toggle (preview vs. editor); what was removed is the lock-toggle UI.
- All clause-locking primitives are gone. Concurrent editing is now an actual CRDT merge, not a mutex.
- `i18n` keys `startEditing`, `doneEditing`.

### Migration

Two paths, depending on whether you adopt Y.js:

1. **Stay native**: wrap existing JSON in `createNativeStore` and pipe `onChange` to your existing save flow. ~10 lines of glue per editor mount-point.
2. **Adopt Y.js**: stand up a Y.Doc cache + WS sync server next to your existing API. CHASE's `src/api/yjs/{server,wss}.ts` is a reference implementation (ref-counted cache, debounced persistence to a `bytea` column, awareness fan-out, status-aware authorization).

See [`MIGRATION.md`](./MIGRATION.md) for the step-by-step upgrade, including peer-dep notes (Vite `resolve.dedupe` / `resolve.alias` to avoid duplicate yjs imports) and a full worked example.

### Notes for Y.js consumers

- **Single `yjs` instance**: Y.js throws `Yjs was already imported` if two copies are loaded. With a `file:`-linked library or a peer-dep mismatch this is easy to trigger. In Vite:

  ```ts
  resolve: {
      dedupe: ['yjs', 'y-protocols'],
      alias: { yjs: path.resolve(__dirname, 'node_modules/yjs/dist/yjs.mjs') }
  }
  ```

- **Gate on sync**: until a Y.js client receives the initial state from the server, its local `Y.Doc` has no root structure and mutators silently no-op. Always render the editor only after the WS provider's `synced` event fires.

- **Server-side mutations**: when applying changes from server code (status transitions, amendment apply), open the canonical `Y.Doc` and mutate it inside a `transact`. Don't build a parallel JSON pipeline — clients will not see the change until the WS layer propagates the doc update.

## [0.1.x]

Pre-store API. `ResolutionEditor` owned its own `$state` and emitted `onResolutionChange` callbacks. Per-clause locking was implemented in the host application (CHASE: `paper_clause_lock` table + `startEditing` mutation).

This line is no longer maintained; bugs are fixed on `0.2.x` only.
