/**
 * Y.js-backed implementation of `ResolutionStore`.
 *
 * The Y.Doc is canonical; this store maintains a reactive plain-JSON
 * mirror via `observeDeep` so editor components rendering off
 * `store.snapshot` stay current. Every mutator is wrapped in a Y
 * transaction so observers see one coherent change per call.
 *
 * Per-clause `Y.Text` enables real character-level co-typing: the
 * `TextHandle` returned by `getTextHandle` installs a CRDT binding
 * (`bindYTextToTextarea`) that preserves cursor position across remote
 * inserts/deletes.
 */

import * as Y from 'yjs';
import {
	type Resolution,
	type OperativeClause,
	type PreambleClause,
	type SubClause,
	createEmptyOperativeClause,
	createEmptyPreambleClause,
	createEmptySubClause,
	createSubclausesBlock,
	createTextBlock,
	cleanupBlocks,
	appendNestedSubClause,
	subClauseToOperativeClause,
	MAX_SUBCLAUSE_DEPTH
} from '../schema/resolution';
import type {
	ClausePath,
	OutdentResult,
	ResolutionStore,
	SubclausesBlockPath,
	TextHandle,
	TextLocation
} from '../store/types';
import { bindYTextToTextarea } from './bindYTextToTextarea';
import { jsonToYDoc, replaceResolution as replaceYDoc, yDocToJson, ROOT_KEY } from './conversion';

export interface YjsStoreOptions {
	/**
	 * If the Y.Doc's root map is empty when the store is created, seed it
	 * with this Resolution. (Servers seed before clients connect; clients
	 * usually pass nothing and let the WS sync deliver the initial state.)
	 */
	seed?: Resolution;
}

export function createYjsStore(yDoc: Y.Doc, opts: YjsStoreOptions = {}): ResolutionStore {
	if (opts.seed) jsonToYDoc(yDoc, opts.seed);

	// Reactive mirror of the Y.Doc as plain JSON.
	const snapshot = $state<Resolution>(yDocToJson(yDoc));

	const refresh = () => {
		const next = yDocToJson(yDoc);
		// Mutate in place so `$state` proxies stay stable for components
		// that have captured references (e.g. `each` blocks).
		snapshot.committeeName = next.committeeName;
		snapshot.preamble.length = 0;
		snapshot.preamble.push(...next.preamble);
		snapshot.operative.length = 0;
		snapshot.operative.push(...next.operative);
	};

	const onUpdate = () => refresh();
	yDoc.on('update', onUpdate);

	// ===================================================================
	// Internal Y lookups
	// ===================================================================

	function root(): Y.Map<unknown> {
		return yDoc.getMap<unknown>(ROOT_KEY);
	}

	function preambleArr(): Y.Array<Y.Map<unknown>> | null {
		const v = root().get('preamble');
		return v instanceof Y.Array ? (v as Y.Array<Y.Map<unknown>>) : null;
	}

	function operativeArr(): Y.Array<Y.Map<unknown>> | null {
		const v = root().get('operative');
		return v instanceof Y.Array ? (v as Y.Array<Y.Map<unknown>>) : null;
	}

	function findIndexById(arr: Y.Array<Y.Map<unknown>>, id: string): number {
		for (let i = 0; i < arr.length; i++) {
			const item = arr.get(i);
			if (item instanceof Y.Map && String(item.get('id')) === id) return i;
		}
		return -1;
	}

	type SubLoc = { container: Y.Array<Y.Map<unknown>>; index: number; depth: number };

	function findSubClauseY(id: string): SubLoc | null {
		function walkBlocks(blocks: Y.Array<Y.Map<unknown>>, depth: number): SubLoc | null {
			for (let i = 0; i < blocks.length; i++) {
				const block = blocks.get(i);
				if (!(block instanceof Y.Map)) continue;
				if (block.get('type') !== 'subclauses') continue;
				const items = block.get('items');
				if (!(items instanceof Y.Array)) continue;
				const arr = items as Y.Array<Y.Map<unknown>>;
				for (let j = 0; j < arr.length; j++) {
					const sub = arr.get(j);
					if (sub instanceof Y.Map) {
						if (String(sub.get('id')) === id) {
							return { container: arr, index: j, depth };
						}
						const subBlocks = sub.get('blocks');
						if (subBlocks instanceof Y.Array) {
							const found = walkBlocks(subBlocks as Y.Array<Y.Map<unknown>>, depth + 1);
							if (found) return found;
						}
					}
				}
			}
			return null;
		}
		const ops = operativeArr();
		if (!ops) return null;
		for (let i = 0; i < ops.length; i++) {
			const op = ops.get(i);
			if (!(op instanceof Y.Map)) continue;
			const blocks = op.get('blocks');
			if (!(blocks instanceof Y.Array)) continue;
			const found = walkBlocks(blocks as Y.Array<Y.Map<unknown>>, 1);
			if (found) return found;
		}
		return null;
	}

	function clauseBlocksFor(path: ClausePath): Y.Array<Y.Map<unknown>> | null {
		if (path.kind === 'operative') {
			const ops = operativeArr();
			if (!ops) return null;
			const idx = findIndexById(ops, path.clauseId);
			if (idx === -1) return null;
			const op = ops.get(idx);
			if (!(op instanceof Y.Map)) return null;
			const blocks = op.get('blocks');
			return blocks instanceof Y.Array ? (blocks as Y.Array<Y.Map<unknown>>) : null;
		}
		const sub = findSubClauseY(path.subClauseId);
		if (!sub) return null;
		const subItem = sub.container.get(sub.index);
		if (!(subItem instanceof Y.Map)) return null;
		const blocks = subItem.get('blocks');
		return blocks instanceof Y.Array ? (blocks as Y.Array<Y.Map<unknown>>) : null;
	}

	type SubclausesYLoc = {
		items: Y.Array<Y.Map<unknown>>;
		parentBlocks: Y.Array<Y.Map<unknown>>;
		blockIndex: number;
		depth: number;
	};

	function findSubclausesY(path: SubclausesBlockPath): SubclausesYLoc | null {
		if (path.kind === 'operative') {
			const ops = operativeArr();
			if (!ops) return null;
			const idx = findIndexById(ops, path.clauseId);
			if (idx === -1) return null;
			const op = ops.get(idx);
			if (!(op instanceof Y.Map)) return null;
			const blocks = op.get('blocks');
			if (!(blocks instanceof Y.Array)) return null;
			const blocksArr = blocks as Y.Array<Y.Map<unknown>>;
			for (let i = 0; i < blocksArr.length; i++) {
				const b = blocksArr.get(i);
				if (b instanceof Y.Map && b.get('type') === 'subclauses') {
					const items = b.get('items');
					if (items instanceof Y.Array) {
						return {
							items: items as Y.Array<Y.Map<unknown>>,
							parentBlocks: blocksArr,
							blockIndex: i,
							depth: 1
						};
					}
				}
			}
			return null;
		}
		const sub = findSubClauseY(path.subClauseId);
		if (!sub) return null;
		const subItem = sub.container.get(sub.index);
		if (!(subItem instanceof Y.Map)) return null;
		const blocks = subItem.get('blocks');
		if (!(blocks instanceof Y.Array)) return null;
		const blocksArr = blocks as Y.Array<Y.Map<unknown>>;
		for (let i = 0; i < blocksArr.length; i++) {
			const b = blocksArr.get(i);
			if (b instanceof Y.Map && b.get('type') === 'subclauses') {
				const items = b.get('items');
				if (items instanceof Y.Array) {
					return {
						items: items as Y.Array<Y.Map<unknown>>,
						parentBlocks: blocksArr,
						blockIndex: i,
						depth: sub.depth + 1
					};
				}
			}
		}
		return null;
	}

	// ===================================================================
	// Y.Map builders (for inserting new items)
	// ===================================================================

	function buildYBlock(b: {
		type: string;
		id: string;
		content?: string;
		items?: SubClause[];
	}): Y.Map<unknown> {
		const map = new Y.Map<unknown>();
		map.set('id', b.id);
		map.set('type', b.type);
		if (b.type === 'text') {
			map.set('content', new Y.Text(b.content ?? ''));
		} else {
			const items = new Y.Array<Y.Map<unknown>>();
			items.insert(0, (b.items ?? []).map(buildYSubClause));
			map.set('items', items);
		}
		return map;
	}

	function buildYSubClause(s: SubClause): Y.Map<unknown> {
		const map = new Y.Map<unknown>();
		map.set('id', s.id);
		const blocks = new Y.Array<Y.Map<unknown>>();
		blocks.insert(
			0,
			s.blocks.map((b) =>
				buildYBlock({
					type: b.type,
					id: b.id,
					content: b.type === 'text' ? b.content : undefined,
					items: b.type === 'subclauses' ? b.items : undefined
				})
			)
		);
		map.set('blocks', blocks);
		return map;
	}

	function buildYPreamble(c: PreambleClause): Y.Map<unknown> {
		const map = new Y.Map<unknown>();
		map.set('id', c.id);
		map.set('content', new Y.Text(c.content));
		return map;
	}

	function buildYOperative(c: OperativeClause): Y.Map<unknown> {
		const map = new Y.Map<unknown>();
		map.set('id', c.id);
		const blocks = new Y.Array<Y.Map<unknown>>();
		blocks.insert(
			0,
			c.blocks.map((b) =>
				buildYBlock({
					type: b.type,
					id: b.id,
					content: b.type === 'text' ? b.content : undefined,
					items: b.type === 'subclauses' ? b.items : undefined
				})
			)
		);
		map.set('blocks', blocks);
		return map;
	}

	// ===================================================================
	// Mutations
	// ===================================================================

	function tx<T>(fn: () => T): T {
		let result!: T;
		yDoc.transact(() => {
			result = fn();
		}, 'local');
		return result;
	}

	function setCommitteeName(name: string) {
		tx(() => {
			const cn = root().get('committeeName');
			if (cn instanceof Y.Text) {
				if (cn.toString() !== name) {
					cn.delete(0, cn.length);
					cn.insert(0, name);
				}
			} else {
				root().set('committeeName', new Y.Text(name));
			}
		});
	}

	function addPreambleClause(clause?: Partial<PreambleClause>): string {
		const next: PreambleClause = { ...createEmptyPreambleClause(), ...clause };
		tx(() => {
			const arr = preambleArr();
			if (arr) arr.insert(arr.length, [buildYPreamble(next)]);
		});
		return next.id;
	}

	function deletePreambleClause(id: string) {
		tx(() => {
			const arr = preambleArr();
			if (!arr) return;
			const idx = findIndexById(arr, id);
			if (idx === -1) return;
			arr.delete(idx, 1);
		});
	}

	function movePreambleClause(id: string, direction: 'up' | 'down') {
		tx(() => {
			const arr = preambleArr();
			if (!arr) return;
			const idx = findIndexById(arr, id);
			if (idx === -1) return;
			const next = direction === 'up' ? idx - 1 : idx + 1;
			if (next < 0 || next >= arr.length) return;
			swap(arr, idx, next);
		});
	}

	function updatePreambleContent(id: string, content: string) {
		tx(() => {
			const arr = preambleArr();
			if (!arr) return;
			const idx = findIndexById(arr, id);
			if (idx === -1) return;
			const item = arr.get(idx);
			if (!(item instanceof Y.Map)) return;
			const c = item.get('content');
			if (c instanceof Y.Text) {
				if (c.toString() !== content) {
					c.delete(0, c.length);
					c.insert(0, content);
				}
			} else {
				item.set('content', new Y.Text(content));
			}
		});
	}

	function insertPreambleClauses(at: number, clauses: PreambleClause[]) {
		if (clauses.length === 0) return;
		tx(() => {
			const arr = preambleArr();
			if (!arr) return;
			const clamped = Math.max(0, Math.min(at, arr.length));
			arr.insert(clamped, clauses.map(buildYPreamble));
		});
	}

	function addOperativeClause(clause?: Partial<OperativeClause>): string {
		const next: OperativeClause = { ...createEmptyOperativeClause(), ...clause };
		tx(() => {
			const arr = operativeArr();
			if (arr) arr.insert(arr.length, [buildYOperative(next)]);
		});
		return next.id;
	}

	function deleteOperativeClause(id: string) {
		tx(() => {
			const arr = operativeArr();
			if (!arr) return;
			const idx = findIndexById(arr, id);
			if (idx === -1) return;
			arr.delete(idx, 1);
		});
	}

	function moveOperativeClause(id: string, direction: 'up' | 'down') {
		tx(() => {
			const arr = operativeArr();
			if (!arr) return;
			const idx = findIndexById(arr, id);
			if (idx === -1) return;
			const next = direction === 'up' ? idx - 1 : idx + 1;
			if (next < 0 || next >= arr.length) return;
			swap(arr, idx, next);
		});
	}

	function insertOperativeClauseAfter(afterId: string, clause: OperativeClause) {
		tx(() => {
			const arr = operativeArr();
			if (!arr) return;
			const idx = findIndexById(arr, afterId);
			const insertAt = idx === -1 ? arr.length : idx + 1;
			arr.insert(insertAt, [buildYOperative(clause)]);
		});
	}

	function insertOperativeClauses(at: number, clauses: OperativeClause[]) {
		if (clauses.length === 0) return;
		tx(() => {
			const arr = operativeArr();
			if (!arr) return;
			const clamped = Math.max(0, Math.min(at, arr.length));
			arr.insert(clamped, clauses.map(buildYOperative));
		});
	}

	function updateTextBlock(path: ClausePath, blockId: string, content: string) {
		tx(() => {
			const blocks = clauseBlocksFor(path);
			if (!blocks) return;
			const idx = findIndexById(blocks, blockId);
			if (idx === -1) return;
			const block = blocks.get(idx);
			if (!(block instanceof Y.Map) || block.get('type') !== 'text') return;
			const c = block.get('content');
			if (c instanceof Y.Text) {
				if (c.toString() !== content) {
					c.delete(0, c.length);
					c.insert(0, content);
				}
			} else {
				block.set('content', new Y.Text(content));
			}
		});
	}

	function appendTextBlock(path: ClausePath): string {
		const block = createTextBlock();
		tx(() => {
			const blocks = clauseBlocksFor(path);
			if (!blocks) return;
			blocks.insert(blocks.length, [buildYBlock({ type: 'text', id: block.id, content: '' })]);
		});
		return block.id;
	}

	function deleteBlock(path: ClausePath, blockId: string) {
		tx(() => {
			const blocks = clauseBlocksFor(path);
			if (!blocks) return;
			const idx = findIndexById(blocks, blockId);
			if (idx <= 0) return; // first text block is required
			blocks.delete(idx, 1);
			// Apply cleanup by reading + replacing from JSON.
			const cleaned = cleanupBlocks(readBlocksAsJson(blocks));
			replaceBlocks(blocks, cleaned);
		});
	}

	function appendSubclausesBlock(path: ClausePath, initialItems?: SubClause[]): string {
		const items = initialItems && initialItems.length > 0 ? initialItems : [createEmptySubClause()];
		const block = createSubclausesBlock(items);
		tx(() => {
			const blocks = clauseBlocksFor(path);
			if (!blocks) return;
			blocks.insert(blocks.length, [buildYBlock({ type: 'subclauses', id: block.id, items })]);
		});
		return block.id;
	}

	function addSubClause(path: SubclausesBlockPath, after?: string): string {
		const sub = createEmptySubClause();
		tx(() => {
			const existing = findSubclausesY(path);
			if (!existing) {
				if (path.kind === 'operative') {
					const ops = operativeArr();
					if (!ops) return;
					const idx = findIndexById(ops, path.clauseId);
					if (idx === -1) return;
					const op = ops.get(idx);
					if (!(op instanceof Y.Map)) return;
					const blocks = op.get('blocks');
					if (!(blocks instanceof Y.Array)) return;
					const blocksArr = blocks as Y.Array<Y.Map<unknown>>;
					const newBlock = createSubclausesBlock([sub]);
					blocksArr.insert(blocksArr.length, [
						buildYBlock({ type: 'subclauses', id: newBlock.id, items: [sub] })
					]);
				} else {
					const subLoc = findSubClauseY(path.subClauseId);
					if (!subLoc) return;
					if (subLoc.depth + 1 > MAX_SUBCLAUSE_DEPTH) return;
					const subItem = subLoc.container.get(subLoc.index);
					if (!(subItem instanceof Y.Map)) return;
					const blocks = subItem.get('blocks');
					if (!(blocks instanceof Y.Array)) return;
					const blocksArr = blocks as Y.Array<Y.Map<unknown>>;
					const newBlock = createSubclausesBlock([sub]);
					blocksArr.insert(blocksArr.length, [
						buildYBlock({ type: 'subclauses', id: newBlock.id, items: [sub] })
					]);
				}
				return;
			}
			if (after) {
				const idx = findIndexById(existing.items, after);
				const insertAt = idx === -1 ? existing.items.length : idx + 1;
				existing.items.insert(insertAt, [buildYSubClause(sub)]);
			} else {
				existing.items.insert(existing.items.length, [buildYSubClause(sub)]);
			}
		});
		return sub.id;
	}

	function deleteSubClause(path: SubclausesBlockPath, id: string) {
		tx(() => {
			const block = findSubclausesY(path);
			if (!block) return;
			const idx = findIndexById(block.items, id);
			if (idx === -1) return;
			block.items.delete(idx, 1);
			if (block.items.length === 0) {
				block.parentBlocks.delete(block.blockIndex, 1);
				const cleaned = cleanupBlocks(readBlocksAsJson(block.parentBlocks));
				replaceBlocks(block.parentBlocks, cleaned);
			}
		});
	}

	function moveSubClause(path: SubclausesBlockPath, id: string, direction: 'up' | 'down') {
		tx(() => {
			const block = findSubclausesY(path);
			if (!block) return;
			const idx = findIndexById(block.items, id);
			if (idx === -1) return;
			const next = direction === 'up' ? idx - 1 : idx + 1;
			if (next < 0 || next >= block.items.length) return;
			swap(block.items, idx, next);
		});
	}

	function indentSubClause(path: SubclausesBlockPath, id: string) {
		tx(() => {
			const block = findSubclausesY(path);
			if (!block) return;
			const idx = findIndexById(block.items, id);
			if (idx <= 0) return;
			if (block.depth >= MAX_SUBCLAUSE_DEPTH) return;
			const targetJson = readSubClauseJson(block.items.get(idx) as Y.Map<unknown>);
			const previousJson = readSubClauseJson(block.items.get(idx - 1) as Y.Map<unknown>);
			const updatedPrevious = appendNestedSubClause(previousJson, targetJson);
			block.items.delete(idx - 1, 2);
			block.items.insert(idx - 1, [buildYSubClause(updatedPrevious)]);
		});
	}

	function outdentSubClause(path: SubclausesBlockPath, id: string): OutdentResult {
		let result: OutdentResult = { kind: 'noop' };
		tx(() => {
			const block = findSubclausesY(path);
			if (!block) return;
			const idx = findIndexById(block.items, id);
			if (idx === -1) return;
			const targetJson = readSubClauseJson(block.items.get(idx) as Y.Map<unknown>);

			if (block.depth === 1) {
				if (path.kind !== 'operative') return;
				const ops = operativeArr();
				if (!ops) return;
				const opIdx = findIndexById(ops, path.clauseId);
				if (opIdx === -1) return;
				block.items.delete(idx, 1);
				if (block.items.length === 0) {
					block.parentBlocks.delete(block.blockIndex, 1);
					const cleaned = cleanupBlocks(readBlocksAsJson(block.parentBlocks));
					replaceBlocks(block.parentBlocks, cleaned);
				}
				const newOperative = subClauseToOperativeClause(targetJson);
				ops.insert(opIdx + 1, [buildYOperative(newOperative)]);
				result = { kind: 'toOperative', clause: newOperative };
				return;
			}

			if (path.kind !== 'subclause') return;
			const parentLoc = findSubClauseY(path.subClauseId);
			if (!parentLoc) return;
			block.items.delete(idx, 1);
			if (block.items.length === 0) {
				block.parentBlocks.delete(block.blockIndex, 1);
				const cleaned = cleanupBlocks(readBlocksAsJson(block.parentBlocks));
				replaceBlocks(block.parentBlocks, cleaned);
			}
			parentLoc.container.insert(parentLoc.index + 1, [buildYSubClause(targetJson)]);
			result = { kind: 'toParent' };
		});
		return result;
	}

	function replaceResolution(next: Resolution) {
		replaceYDoc(yDoc, next);
	}

	// ===================================================================
	// Text handle
	// ===================================================================

	function findYText(loc: TextLocation): Y.Text | null {
		switch (loc.kind) {
			case 'preamble': {
				const arr = preambleArr();
				if (!arr) return null;
				const idx = findIndexById(arr, loc.clauseId);
				if (idx === -1) return null;
				const item = arr.get(idx);
				if (!(item instanceof Y.Map)) return null;
				const c = item.get('content');
				return c instanceof Y.Text ? c : null;
			}
			case 'operative-text': {
				const blocks = clauseBlocksFor({ kind: 'operative', clauseId: loc.clauseId });
				if (!blocks) return null;
				const idx = findIndexById(blocks, loc.blockId);
				if (idx === -1) return null;
				const block = blocks.get(idx);
				if (!(block instanceof Y.Map) || block.get('type') !== 'text') return null;
				const c = block.get('content');
				return c instanceof Y.Text ? c : null;
			}
			case 'subclause-text': {
				const blocks = clauseBlocksFor({ kind: 'subclause', subClauseId: loc.subClauseId });
				if (!blocks) return null;
				const idx = findIndexById(blocks, loc.blockId);
				if (idx === -1) return null;
				const block = blocks.get(idx);
				if (!(block instanceof Y.Map) || block.get('type') !== 'text') return null;
				const c = block.get('content');
				return c instanceof Y.Text ? c : null;
			}
		}
	}

	function getTextHandle(loc: TextLocation): TextHandle {
		return {
			get() {
				// Read from the reactive snapshot so component effects re-run.
				switch (loc.kind) {
					case 'preamble': {
						const c = snapshot.preamble.find((p) => p.id === loc.clauseId);
						return c?.content ?? '';
					}
					case 'operative-text': {
						const c = snapshot.operative.find((o) => o.id === loc.clauseId);
						const b = c?.blocks.find((bl) => bl.id === loc.blockId);
						return b?.type === 'text' ? b.content : '';
					}
					case 'subclause-text': {
						const targetSubId = loc.subClauseId;
						const targetBlockId = loc.blockId;
						function walk(items: SubClause[]): string | null {
							for (const item of items) {
								if (item.id === targetSubId) {
									const b = item.blocks.find((bl) => bl.id === targetBlockId);
									return b?.type === 'text' ? b.content : '';
								}
								for (const block of item.blocks) {
									if (block.type === 'subclauses') {
										const inner = walk(block.items);
										if (inner !== null) return inner;
									}
								}
							}
							return null;
						}
						for (const op of snapshot.operative) {
							for (const b of op.blocks) {
								if (b.type === 'subclauses') {
									const inner = walk(b.items);
									if (inner !== null) return inner;
								}
							}
						}
						return '';
					}
				}
			},
			set(content) {
				const yText = findYText(loc);
				if (!yText) return;
				if (yText.toString() === content) return;
				yDoc.transact(() => {
					yText.delete(0, yText.length);
					yText.insert(0, content);
				}, 'local');
			},
			bindTextarea(el) {
				const yText = findYText(loc);
				if (!yText) return () => {};
				return bindYTextToTextarea(yText, el);
			}
		};
	}

	function destroy() {
		yDoc.off('update', onUpdate);
	}

	return {
		get snapshot() {
			return snapshot;
		},
		getTextHandle,
		setCommitteeName,
		addPreambleClause,
		deletePreambleClause,
		movePreambleClause,
		updatePreambleContent,
		insertPreambleClauses,
		addOperativeClause,
		deleteOperativeClause,
		moveOperativeClause,
		insertOperativeClauseAfter,
		insertOperativeClauses,
		updateTextBlock,
		appendTextBlock,
		deleteBlock,
		appendSubclausesBlock,
		addSubClause,
		deleteSubClause,
		moveSubClause,
		indentSubClause,
		outdentSubClause,
		replaceResolution,
		destroy
	};
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function swap(arr: Y.Array<Y.Map<unknown>>, i: number, j: number) {
	if (i === j) return;
	const lo = Math.min(i, j);
	const hi = Math.max(i, j);
	const itemHi = arr.get(hi);
	const itemLo = arr.get(lo);
	arr.delete(hi, 1);
	arr.delete(lo, 1);
	arr.insert(lo, [itemHi as Y.Map<unknown>]);
	arr.insert(hi, [itemLo as Y.Map<unknown>]);
}

function readBlocksAsJson(
	blocks: Y.Array<Y.Map<unknown>>
): import('../schema/resolution').ClauseBlock[] {
	return blocks.toArray().map((m) => readBlockJson(m as Y.Map<unknown>));
}

function readBlockJson(map: Y.Map<unknown>): import('../schema/resolution').ClauseBlock {
	const id = String(map.get('id'));
	const type = map.get('type');
	if (type === 'text') {
		const content = map.get('content');
		const text = content instanceof Y.Text ? content.toString() : String(content ?? '');
		return { type: 'text', id, content: text };
	}
	const items = map.get('items');
	const arr = items instanceof Y.Array ? (items as Y.Array<Y.Map<unknown>>) : null;
	const subItems: SubClause[] = arr
		? arr.toArray().map((m) => readSubClauseJson(m as Y.Map<unknown>))
		: [];
	return { type: 'subclauses', id, items: subItems };
}

function readSubClauseJson(map: Y.Map<unknown>): SubClause {
	const id = String(map.get('id'));
	const blocks = map.get('blocks');
	const arr = blocks instanceof Y.Array ? (blocks as Y.Array<Y.Map<unknown>>) : null;
	return {
		id,
		blocks: arr ? arr.toArray().map((m) => readBlockJson(m as Y.Map<unknown>)) : []
	};
}

function replaceBlocks(
	arr: Y.Array<Y.Map<unknown>>,
	target: import('../schema/resolution').ClauseBlock[]
) {
	if (arr.length > 0) arr.delete(0, arr.length);
	arr.insert(
		0,
		target.map((b) => {
			const map = new Y.Map<unknown>();
			map.set('id', b.id);
			map.set('type', b.type);
			if (b.type === 'text') {
				map.set('content', new Y.Text(b.content));
			} else {
				const items = new Y.Array<Y.Map<unknown>>();
				items.insert(
					0,
					b.items.map((s) => {
						const sm = new Y.Map<unknown>();
						sm.set('id', s.id);
						const sb = new Y.Array<Y.Map<unknown>>();
						sb.insert(0, s.blocks.map(buildBlockMapFromJson));
						sm.set('blocks', sb);
						return sm;
					})
				);
				map.set('items', items);
			}
			return map;
		})
	);
}

function buildBlockMapFromJson(b: import('../schema/resolution').ClauseBlock): Y.Map<unknown> {
	const map = new Y.Map<unknown>();
	map.set('id', b.id);
	map.set('type', b.type);
	if (b.type === 'text') {
		map.set('content', new Y.Text(b.content));
	} else {
		const items = new Y.Array<Y.Map<unknown>>();
		items.insert(
			0,
			b.items.map((s) => {
				const sm = new Y.Map<unknown>();
				sm.set('id', s.id);
				const sb = new Y.Array<Y.Map<unknown>>();
				sb.insert(0, s.blocks.map(buildBlockMapFromJson));
				sm.set('blocks', sb);
				return sm;
			})
		);
		map.set('items', items);
	}
	return map;
}
