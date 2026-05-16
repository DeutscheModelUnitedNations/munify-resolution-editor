# @deutschemodelunitednations/munify-resolution-editor

A Svelte 5 component library for creating and editing UN-style resolutions. Built for Model United Nations conferences.

## Features

- **Store-based architecture** — editor components consume a `ResolutionStore` interface; swap between local-only JSON and Y.js-backed real-time collaboration without changing the UI
- **Full Resolution Editor** — preamble + operative clauses, recursive sub-clauses up to 4 levels
- **Real-time co-editing** (optional) — character-level collaborative typing via the `/yjs` subpath, including cursor-preserving CRDT bindings and remote-user awareness
- **Phrase Validation & Suggestions** — validate clause openings against UN vocabulary, inline autocomplete
- **Import from Text** — parse plain text or LLM-formatted resolutions
- **RES-Markup import/export** — round-trip a whole resolution (metadata, header, preamble, operative) as a human- and LLM-friendly plain-text `.res.txt` file; spec in [`grammar.md`](src/lib/res-markup/grammar.md), tutorial in [`USER_GUIDE.md`](src/lib/res-markup/USER_GUIDE.md)
- **Preview & Print** — official UN document format, page-broken via `pagedjs`
- **Customizable** — i18n, custom phrases, snippet extension points
- **Type-safe** — full TypeScript + Zod schema validation

## Installation

```bash
bun add -d @deutschemodelunitednations/munify-resolution-editor
```

> **Note**: install as a dev dependency — SvelteKit bundles components at build time.

## Peer Dependencies

| Peer            | Required for        | Optional? |
| --------------- | ------------------- | --------- |
| `svelte ^5.0.0` | always              | no        |
| `yjs ^13.6.0`   | `/yjs` subpath only | yes       |
| `y-protocols`   | `/yjs` subpath only | yes       |

If you only use the native (JSON) store you do **not** need to install `yjs` / `y-protocols`.

## Styling Setup

The library uses Tailwind CSS utilities. Tailwind needs to scan the library's components.

### Tailwind v4 (recommended)

```css
@import 'tailwindcss';
@import '@deutschemodelunitednations/munify-resolution-editor/tailwind.css';
@plugin "daisyui";
```

### Tailwind v3

```js
export default {
	content: [
		'./src/**/*.{html,js,svelte,ts}',
		'./node_modules/@deutschemodelunitednations/munify-resolution-editor/dist/**/*.svelte'
	]
};
```

---

## Architecture

The editor is **UI-only**. Persistence and collaboration are concerns of the application that hosts it. Two store implementations bridge that gap:

```
┌──────────────────────────────────────────────────────────────┐
│   <ResolutionEditor store={...} presence={...} … />          │
│   ClauseEditor / OperativeClauseEditor / SubClauseEditor     │
│   (read store.snapshot, call store.addPreambleClause(), …)   │
└────────────────────────┬─────────────────────────────────────┘
                         │ ResolutionStore interface
            ┌────────────┴────────────┐
            ▼                         ▼
   createNativeStore           createYjsStore
   ─────────────────           ────────────────
   plain $state<Resolution>    Y.Doc + Y.Map + per-clause Y.Text
   onChange(snapshot)           Y.transact() on every mutator
   no peers                     awareness presence adapter
```

A `ResolutionStore` exposes:

- `snapshot: Resolution` — reactive Svelte 5 `$state` value
- typed mutators (`addPreambleClause`, `updateTextBlock`, `indentSubClause`, …)
- `getTextHandle(loc)` — returns a `TextHandle` whose `bindTextarea(el)` is a no-op for the native store and a CRDT binding for the Y.js store
- `replaceResolution(next)` — bulk replace, preserving clause ids where possible
- `destroy()` — release subscriptions

### When to use which store

| Use case                                               | Store                                                   |
| ------------------------------------------------------ | ------------------------------------------------------- |
| Single-user editor, save-on-blur to your DB            | `createNativeStore`                                     |
| Inline mini-editor in a modal (e.g. amendment compose) | `createNativeStore`                                     |
| Live multi-user co-editing of a working paper          | `createYjsStore`                                        |
| Server-side mutations against a paper's canonical doc  | `createYjsStore` (against the same `Y.Doc` you persist) |

---

## Usage

### Native (single-user)

```svelte
<script lang="ts">
	import {
		ResolutionEditor,
		createNativeStore,
		createEmptyResolution,
		type Resolution
	} from '@deutschemodelunitednations/munify-resolution-editor';
	import { germanLabels } from '@deutschemodelunitednations/munify-resolution-editor/i18n/de';
	import {
		germanPreamblePhrases,
		germanOperativePhrases
	} from '@deutschemodelunitednations/munify-resolution-editor/phrases/de';

	let { initialContent }: { initialContent?: Resolution } = $props();

	const store = createNativeStore(initialContent ?? createEmptyResolution('General Assembly'), {
		onChange: (snapshot) => {
			// Persist to your backend, debounced if you like.
			void saveToServer(snapshot);
		}
	});
</script>

<ResolutionEditor
	{store}
	editable
	labels={germanLabels}
	preamblePhrases={germanPreamblePhrases}
	operativePhrases={germanOperativePhrases}
/>
```

> The store owns a Svelte 5 `$state`, so `store.snapshot` is reactive — components re-render automatically. Don't keep a separate `$state<Resolution>` outside the store.

### Y.js (real-time collaboration)

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

	let { paperId, currentUser }: { paperId: string; currentUser: { id: string; name: string } } =
		$props();

	let store = $state<ResolutionStore | null>(null);
	let presence = $state<PresenceAdapter | null>(null);
	let synced = $state(false);

	$effect(() => {
		const doc = new Y.Doc();
		const provider = new WebsocketProvider(`wss://${location.host}/api/ws/yjs`, paperId, doc);

		const s = createYjsStore(doc); // no `seed` — server delivers initial state
		const p = createAwarenessPresence({ awareness: provider.awareness, user: currentUser });

		const onSynced = (v: boolean) => (synced = v);
		provider.on('synced', onSynced);
		store = s;
		presence = p;

		return () => {
			provider.off('synced', onSynced);
			s.destroy();
			provider.destroy();
			doc.destroy();
			store = null;
			presence = null;
			synced = false;
		};
	});
</script>

{#if !synced || !store}
	<div>Connecting…</div>
{:else}
	<ResolutionEditor {store} presence={presence ?? undefined} editable />
{/if}
```

> **Important**: gate the editor on `synced`. Until the WS handshake completes the local Y.Doc has no root structure, and mutators that target it will silently no-op (e.g. `addPreambleClause` returns without inserting).

### Preview only

```svelte
<script lang="ts">
	import { ResolutionPreview } from '@deutschemodelunitednations/munify-resolution-editor';
</script>

<ResolutionPreview
	{resolution}
	headerData={{
		conferenceName: 'Model United Nations',
		committeeName: 'Security Council',
		topic: 'International Peace and Security',
		documentNumber: 'S/RES/2026/1'
	}}
/>
```

`ResolutionPreview` is a pure render — no store needed.

---

## Server-side mutations (Y.js mode)

When the host application needs to mutate a paper from the server (e.g. applying an approved amendment, transitioning status), it should mutate the canonical `Y.Doc` directly, not the JSON projection. The library exports the conversion helpers:

```ts
import {
	jsonToYDoc,
	yDocToJson,
	replaceResolution as replaceYDocResolution
} from '@deutschemodelunitednations/munify-resolution-editor/yjs';
```

A typical server flow looks like:

```ts
import * as Y from 'yjs';
import {
	yDocToJson,
	replaceResolution
} from '@deutschemodelunitednations/munify-resolution-editor/yjs';

// inside an async server-side function with the doc in hand
doc.transact(() => {
	const before = yDocToJson(doc);
	const after = applyAmendment(before, amendment); // pure JSON transform
	replaceResolution(doc, after); // structural diff, preserves ids
}, 'server');
```

The `'server'` origin tag lets WS sync-loop guards (which ignore their own echo) distinguish server mutations from peer broadcasts.

CHASE has a reference implementation at `src/api/yjs/server.ts` (ref-counted in-memory cache, debounced persistence to a `bytea` column, idle eviction). See `MIGRATION.md` for a porting checklist.

---

## API Reference

### Stores

```ts
import {
	createNativeStore,
	createEmptyNativeStore,
	type ResolutionStore,
	type TextHandle,
	type TextLocation,
	type ClausePath,
	type SubclausesBlockPath,
	type OutdentResult,
	type PresenceAdapter,
	type PresenceUser,
	type PresenceInfo,
	type NativeStoreOptions
} from '@deutschemodelunitednations/munify-resolution-editor';

import {
	createYjsStore,
	createAwarenessPresence,
	jsonToYDoc,
	yDocToJson,
	replaceResolution,
	bindYTextToTextarea,
	ROOT_KEY,
	type YjsStoreOptions,
	type AwarenessPresenceOptions
} from '@deutschemodelunitednations/munify-resolution-editor/yjs';
```

### Components

```ts
import {
	ResolutionEditor,
	ResolutionPreview,
	ResolutionDocumentHeader,
	ResolutionDocumentFooter,
	ClauseEditor,
	OperativeClauseEditor,
	SubClauseEditor,
	PhraseLookupModal,
	PhraseSuggestions,
	ImportModal,
	ResolutionPrintPreview
} from '@deutschemodelunitednations/munify-resolution-editor';
```

### Schema & Types

```ts
import {
	type Resolution,
	type PreambleClause,
	type OperativeClause,
	type SubClause,
	type ClauseBlock,
	type TextBlock,
	type SubclausesBlock,
	type ResolutionHeaderData,
	type AmendmentOverlay,
	ResolutionSchema,
	createEmptyResolution,
	createEmptyOperativeClause,
	createEmptyPreambleClause,
	createEmptySubClause,
	createTextBlock,
	createSubclausesBlock,
	getSubClauseLabel,
	isLegacyResolution,
	migrateResolution,
	validateResolution
} from '@deutschemodelunitednations/munify-resolution-editor/schema';
```

### RES-Markup (import / export)

A self-contained, plain-text interchange format for a whole resolution.
Designed to be readable/editable by humans, robustly writable by LLMs, and
losslessly parseable back into the `Resolution` schema. The editor exposes
it through Import/Export buttons (`.res.txt` files); programmatic access:

```ts
import {
	parse,
	serialize,
	validate,
	parseClauseFragment,
	serializeClause,
	RES_VERSION,
	RES_FILE_EXTENSION,
	type ResError,
	type ResWarning
} from '@deutschemodelunitednations/munify-resolution-editor/res-markup';

const { resolution, header, warnings } = parse(text);
const text2 = serialize(resolution, header); // canonical, idempotent
```

- Full grammar, error catalog and round-trip contract:
  [`src/lib/res-markup/grammar.md`](src/lib/res-markup/grammar.md)
- Friendly tutorial with a worked example:
  [`src/lib/res-markup/USER_GUIDE.md`](src/lib/res-markup/USER_GUIDE.md)
- Depends only on `…/schema`; no Svelte/store/Y.js imports.

### Phrases

```ts
import {
	germanPreamblePhrases,
	germanOperativePhrases,
	englishPreamblePhrases,
	englishOperativePhrases
} from '@deutschemodelunitednations/munify-resolution-editor/phrases';
```

### i18n

```ts
import type { ResolutionEditorLabels } from '@deutschemodelunitednations/munify-resolution-editor/i18n';
import {
	germanLabels,
	englishLabels
} from '@deutschemodelunitednations/munify-resolution-editor/i18n/de';
```

---

## Extension Points

Editor render slots use Svelte 5 snippets:

```svelte
<ResolutionEditor {store}>
	{#snippet clauseToolbar({ clause, index })}
		<button onclick={() => addAmendment(clause)}>Add Amendment</button>
	{/snippet}

	{#snippet clauseAnnotations({ clause, index })}
		{#if hasAmendments(clause)}
			<div class="badge badge-warning">Has amendments</div>
		{/if}
	{/snippet}

	{#snippet previewHeader({ resolution, headerData })}
		<div class="custom-header">…</div>
	{/snippet}

	{#snippet previewFooter({ resolution })}
		<div class="signatures">…</div>
	{/snippet}
</ResolutionEditor>
```

Available snippets: `clauseToolbar`, `preambleClauseToolbar`, `clauseAnnotations`, `preambleAnnotations`, `afterPreambleClause`, `afterOperativeClause`, `betweenOperativeClauses`, `previewHeader`, `previewFooter`.

---

## Migrating from `0.1.x`

The `0.1` API took `resolution` + `editable` + `onResolutionChange` props directly on `ResolutionEditor`. In `0.2` the editor consumes a `ResolutionStore` and the consumer wires persistence into the store.

See [`MIGRATION.md`](./MIGRATION.md) for the full upgrade path including a removed-props table and search-and-replace recipes.

---

## Development

```bash
bun install
bun run dev        # demo SvelteKit app
bun run package    # build the library
bun run check      # svelte-check
bun test
```

## License

MIT — Deutsche Model United Nations e.V.
