# Migrating from `0.1.x` to `0.2.x`

`0.2` introduces the `ResolutionStore` abstraction. The editor no longer owns a `$state<Resolution>` — the host application instantiates a store and passes it in. All editing flows through the store's typed mutators.

This document covers two migration paths:

1. **Path A — stay native**: keep your existing single-user save-on-change flow. ~10 lines of glue per editor mount.
2. **Path B — adopt Y.js**: opt into real-time collaborative editing.

Both paths can coexist in the same app — e.g. CHASE uses `createYjsStore` for the main paper editor and `createNativeStore` for the inline mini-editor inside its amendment-creation modal.

---

## Schema is unchanged

`Resolution`, `PreambleClause`, `OperativeClause`, `SubClause`, `ClauseBlock`, etc. are byte-for-byte compatible. JSON written by `0.1.x` deserialises in `0.2.x` without migration. You can roll out new editor mount-points incrementally.

---

## Removed APIs

| Removed in `0.2`                                                         | Replacement                                   |
| ------------------------------------------------------------------------ | --------------------------------------------- |
| `<ResolutionEditor resolution=… committeeName=… onResolutionChange=… />` | `<ResolutionEditor store={…} />`              |
| `i18n` keys `startEditing` / `doneEditing`                               | (no replacement — the lock-toggle UI is gone) |
| Per-clause lock UI                                                       | Y.js CRDT merge (`/yjs` subpath)              |
| Manually constructing `ClauseEditor` with `value` + `oninput`            | `ClauseEditor` now takes `handle: TextHandle` |
| Manually constructing `SubClauseEditor` with array prop drilling         | `SubClauseEditor` now takes `store` + `path`  |

If you don't construct `ClauseEditor` / `SubClauseEditor` directly (most apps don't — they only use `ResolutionEditor`), the bottom two rows don't apply.

---

## Path A — staying native

This is the smaller migration. Replace direct `resolution` + `onResolutionChange` plumbing with a `createNativeStore` instance.

### Before

```svelte
<script lang="ts">
	import { ResolutionEditor } from '@deutschemodelunitednations/munify-resolution-editor';

	let resolution: Resolution = $state(initialContent ?? createEmptyResolution(''));

	function handleChange(updated: Resolution) {
		resolution = updated;
		void saveToServer(updated);
	}
</script>

<ResolutionEditor
	{resolution}
	committeeName={committee.name}
	editable
	onResolutionChange={handleChange}
	labels={germanLabels}
	preamblePhrases={germanPreamblePhrases}
	operativePhrases={germanOperativePhrases}
/>
```

### After

```svelte
<script lang="ts">
	import {
		ResolutionEditor,
		createNativeStore
	} from '@deutschemodelunitednations/munify-resolution-editor';

	const store = createNativeStore(initialContent ?? createEmptyResolution(''), {
		onChange: (snapshot) => {
			void saveToServer(snapshot);
		}
	});

	// Optional: clean up on unmount.
	$effect(() => () => store.destroy());
</script>

<ResolutionEditor
	{store}
	editable
	labels={germanLabels}
	preamblePhrases={germanPreamblePhrases}
	operativePhrases={germanOperativePhrases}
/>
```

Notes:

- The store owns the `$state`. Don't keep a parallel `$state<Resolution>` outside the store — read from `store.snapshot` instead.
- `committeeName` no longer lives on `ResolutionEditor`; it's a field on the `Resolution` and edited through the editor itself. If you need it programmatically: `store.snapshot.committeeName` or `store.setCommitteeName(name)`.
- `onChange` fires after every mutation. Debounce it on your end if you want to throttle network writes.

### Replacing programmatic mutations

If your `0.1.x` code mutated the resolution outside the editor (e.g. amendment apply, status transitions), call store mutators instead of building a new `Resolution` and passing it back via `onResolutionChange`:

| Used to do                                                              | Now do                                                               |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `resolution = { ...resolution, preamble: [...resolution.preamble, c] }` | `store.addPreambleClause(c)`                                         |
| `resolution = applyAmendment(resolution, amendment)`                    | `store.replaceResolution(applyAmendment(store.snapshot, amendment))` |
| Edit a single block's text in code                                      | `store.updateTextBlock(path, blockId, content)`                      |

`replaceResolution` does a structural diff and preserves clause ids where it can — concurrent peers' cursors stay put in unchanged clauses.

---

## Path B — adopting Y.js

This is the larger migration. The benefit is real character-level collaborative editing with cursor preservation.

### Architecture

```
   Browser A ──┐
   Browser B ──┼─── /api/ws/yjs/<paperId> ── server-side Y.Doc cache ── DB
   Browser C ──┘
```

- The **server** holds the canonical `Y.Doc` per paper in memory, ref-counted across connections.
- The doc's binary state (`Y.encodeStateAsUpdate`) is persisted to a `bytea` column, debounced.
- A JSON projection (`yDocToJson`) is mirrored to your existing JSON column so non-Y.js consumers (print, snapshots, amendment apply) keep working.
- A WebSocket endpoint speaks `y-websocket` wire protocol and does authorization at upgrade.

### 1 — Install the peer deps

```bash
bun add yjs y-websocket y-protocols
```

`y-websocket` is only needed on the client; `y-protocols` is shared.

### 2 — Configure Vite to dedupe yjs

Y.js throws `Yjs was already imported` when two copies are loaded. With a `file:`-linked library (in a monorepo) or a version mismatch this is easy to trigger.

```ts
// vite.config.ts
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	// ...
	resolve: {
		dedupe: ['yjs', 'y-protocols'],
		alias: {
			yjs: path.resolve(__dirname, 'node_modules/yjs/dist/yjs.mjs')
		}
	},
	optimizeDeps: {
		include: ['yjs', 'y-protocols/sync', 'y-protocols/awareness', 'y-websocket']
	}
});
```

`dedupe` alone is not enough when bun has materialised the library's own `node_modules/yjs` from a `file:` link. The explicit alias forces a single copy.

### 3 — Add a server-side Y.Doc cache

Create `src/server/yjs/server.ts`. The cache holds `Y.Doc`s in memory keyed by paper id, persists their binary state on a debounce, and evicts when idle. The reference implementation is in CHASE (`src/api/yjs/server.ts`); copy it and adapt the DB calls.

Surface area to expose to the rest of your server:

```ts
acquirePaperDoc(paperId): Promise<{ doc: Y.Doc; release: () => void }>
applyServerMutation<T>(paperId, fn: (doc: Y.Doc) => T): Promise<T>
readPaperJson(paperId): Promise<Resolution | null>
flushAll(): Promise<void>
```

Use `applyServerMutation` from any place that previously rewrote the JSON column directly:

```ts
await applyServerMutation(paperId, (doc) => {
	const before = yDocToJson(doc);
	const after = applyAmendment(before, amendment);
	replaceResolution(doc, after);
});
```

### 4 — Add a WebSocket sync endpoint

Create `src/server/yjs/wss.ts` that speaks `y-websocket` wire protocol. The reference implementation is in CHASE (`src/api/yjs/wss.ts`). It implements:

- `MESSAGE_SYNC` (sync v2)
- `MESSAGE_AWARENESS`
- `MESSAGE_AUTH` (no-op — auth happens at upgrade)
- `MESSAGE_QUERY_AWARENESS`

Authorization runs at upgrade time using the same rules as your old "save resolution content" mutation. Read-only sessions reply to sync-step1 only and ignore all client-sent doc updates.

Mount it on `/api/ws/yjs/:paperId`. SvelteKit specifics: a Vite `configureServer` plugin upgrades the request, dispatching to the WSS instance.

### 5 — Database

Add a single new table for binary doc state. Drizzle:

```ts
import { customType, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

const bytea = customType<{ data: Uint8Array; driverData: Buffer }>({
	dataType: () => 'bytea',
	toDriver: (v) => Buffer.from(v),
	fromDriver: (v) => new Uint8Array(v as Buffer)
});

export const paperYjsDoc = pgTable('paper_yjs_doc', {
	id: text().primaryKey(),
	createdAt: timestamp().defaultNow().notNull(),
	updatedAt: timestamp(),
	paperId: text()
		.notNull()
		.unique()
		.references(() => resolutionPaper.id, { onDelete: 'cascade' }),
	state: bytea('state').notNull()
});
```

> If your Drizzle config uses `casing: 'snake_case'`, ensure the migration SQL writes snake_case column names — `created_at`, `updated_at`, `paper_id`. CHASE hit a real bug here; double-check after `drizzle-kit generate`.

### 6 — Migrate the editor mount

```svelte
<script lang="ts">
	import * as Y from 'yjs';
	import { WebsocketProvider } from 'y-websocket';
	import { ResolutionEditor } from '@deutschemodelunitednations/munify-resolution-editor';
	import {
		createYjsStore,
		createAwarenessPresence
	} from '@deutschemodelunitednations/munify-resolution-editor/yjs';
	import type {
		ResolutionStore,
		PresenceAdapter
	} from '@deutschemodelunitednations/munify-resolution-editor';

	let { paperId, currentUser } = $props();

	let store = $state<ResolutionStore | null>(null);
	let presence = $state<PresenceAdapter | null>(null);
	let synced = $state(false);
	let connected = $state(false);

	$effect(() => {
		const doc = new Y.Doc();
		const wsProto = location.protocol === 'https:' ? 'wss:' : 'ws:';
		const provider = new WebsocketProvider(`${wsProto}//${location.host}/api/ws/yjs`, paperId, doc);
		const s = createYjsStore(doc);
		const p = createAwarenessPresence({ awareness: provider.awareness, user: currentUser });

		const onSynced = (v: boolean) => (synced = v);
		const onStatus = ({ status }) => {
			connected = status === 'connected';
			if (status !== 'connected') synced = false;
		};
		provider.on('synced', onSynced);
		provider.on('status', onStatus);
		store = s;
		presence = p;

		return () => {
			provider.off('synced', onSynced);
			provider.off('status', onStatus);
			s.destroy();
			provider.destroy();
			doc.destroy();
			store = null;
			presence = null;
			synced = false;
			connected = false;
		};
	});
</script>

{#if !synced || !store}
	<div class="loading-state">
		{connected ? 'Synchronizing…' : 'Connecting…'}
	</div>
{:else}
	<ResolutionEditor {store} presence={presence ?? undefined} editable />
{/if}
```

> **Critical**: gate on `synced`. Before sync the local Y.Doc has no root, and store mutators silently no-op. The first time we shipped Y.js without this gate, "Add clause" did nothing on a freshly-loaded paper.

### 7 — Drop your locking machinery

After all editor mount-points are migrated:

- Drop the lock table (CHASE: `paper_clause_lock`).
- Delete the `startEditing` / `doneEditing` mutations and any client UI that toggled them.
- Remove the `startEditing` / `doneEditing` keys from your i18n bundles.

### 8 — Reroute server-side mutations

Anywhere your server previously read JSON, mutated it, and wrote it back, route through `applyServerMutation` instead. This keeps the canonical `Y.Doc` in sync; clients connected at the time will see the change immediately.

If a code path runs _outside_ of any active WS session, `applyServerMutation` still works — `acquirePaperDoc` materialises the doc, mutates it, force-flushes persistence, and releases.

---

## Common pitfalls

- **`Yjs was already imported`** — duplicate yjs copies. See step 2 above. If it persists, run `bun pm ls yjs` and check that only one version is resolved.
- **Editor renders but mutators do nothing** — you forgot to gate on `provider.on('synced', …)`. The local Y.Doc is empty until sync delivers the initial state.
- **Pothos error `Received multiple implementations for plugin`** — Vite is reloading too aggressively, re-registering Pothos plugins. Add the message to your dev-server auto-restart heuristic, and ignore worktree directories in `server.watch.ignored`.
- **WS connects but is stuck on "synchronizing"** — server-side error in `acquirePaperDoc` not surfacing to the client. Add error logs around `loadEntry` (and check column naming if you're using Drizzle's snake_case mode).
- **Cursor jumps on remote edits** — you bypassed `TextHandle.bindTextarea` and bound your own `oninput`. Use the handle's binding; it preserves cursor position across CRDT inserts/deletes.

---

## Reference implementation

CHASE migrated end-to-end in `feat/resolution-editor-integration`'s `websockets` branch. Cross-reference these files when porting:

| Concern                       | CHASE file                                                                                 |
| ----------------------------- | ------------------------------------------------------------------------------------------ |
| DB schema & migration         | `src/api/db/schema.ts` + `drizzle/<timestamp>_yjs_doc/migration.sql`                       |
| Server doc cache              | `src/api/yjs/server.ts`                                                                    |
| WS sync                       | `src/api/yjs/wss.ts`                                                                       |
| Upgrade routing               | `src/api/websocket.ts`                                                                     |
| Vite config                   | `vite.config.ts`                                                                           |
| Editor page (chair)           | `src/routes/app/[conferenceId]/[committeeId]/(chairs)/resolutions/[paperId]/+page.svelte`  |
| Editor page (participant)     | `src/routes/app/[conferenceId]/participant/[committeeId]/papers/[paperId]/+page.svelte`    |
| Native mini-editor (in modal) | `src/lib/components/CreateAmendmentModal.svelte`                                           |
| Server-side amendment apply   | `src/api/handlers/amendment.ts` (`computeAmendedResolution` + `applyAmendmentSideEffects`) |
