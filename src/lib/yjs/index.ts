/**
 * Y.js subpath: real-time collaboration backend for the resolution editor.
 *
 * Import from `@deutschemodelunitednations/munify-resolution-editor/yjs`.
 *
 * Consumers must install `yjs` and `y-protocols` themselves (peer deps).
 */

export { createYjsStore } from './yjsStore.svelte';
export type { YjsStoreOptions } from './yjsStore.svelte';

export { jsonToYDoc, yDocToJson, replaceResolution, ROOT_KEY } from './conversion';
export { bindYTextToTextarea } from './bindYTextToTextarea';
export { createAwarenessPresence } from './awarenessPresence.svelte';
export type { AwarenessPresenceOptions } from './awarenessPresence.svelte';
