/**
 * Conversion between the plain-JSON `Resolution` shape and a Y.Doc whose
 * root `Y.Map "resolution"` contains:
 *
 *   committeeName: Y.Text
 *   preamble: Y.Array<Y.Map { id: string, content: Y.Text }>
 *   operative: Y.Array<Y.Map { id: string, blocks: Y.Array<ClauseBlock Y.Map> }>
 *
 * ClauseBlock Y.Map shapes:
 *   text:       { type: 'text', id: string, content: Y.Text }
 *   subclauses: { type: 'subclauses', id: string, items: Y.Array<SubClause Y.Map> }
 *
 * SubClause Y.Map: { id: string, blocks: Y.Array<ClauseBlock Y.Map> } (recursive)
 */

import * as Y from 'yjs';
import type {
	Resolution,
	OperativeClause,
	PreambleClause,
	SubClause,
	ClauseBlock
} from '../schema/resolution';

export const ROOT_KEY = 'resolution';

// ---------------------------------------------------------------------------
// JSON → Y
// ---------------------------------------------------------------------------

function buildSubClauseMap(sub: SubClause): Y.Map<unknown> {
	const map = new Y.Map<unknown>();
	map.set('id', sub.id);
	map.set('blocks', buildBlocksArray(sub.blocks));
	return map;
}

function buildBlockMap(block: ClauseBlock): Y.Map<unknown> {
	const map = new Y.Map<unknown>();
	map.set('id', block.id);
	if (block.type === 'text') {
		map.set('type', 'text');
		map.set('content', new Y.Text(block.content));
	} else {
		map.set('type', 'subclauses');
		const items = new Y.Array<Y.Map<unknown>>();
		items.insert(0, block.items.map(buildSubClauseMap));
		map.set('items', items);
	}
	return map;
}

function buildBlocksArray(blocks: ClauseBlock[]): Y.Array<Y.Map<unknown>> {
	const arr = new Y.Array<Y.Map<unknown>>();
	arr.insert(0, blocks.map(buildBlockMap));
	return arr;
}

function buildPreambleClauseMap(c: PreambleClause): Y.Map<unknown> {
	const map = new Y.Map<unknown>();
	map.set('id', c.id);
	map.set('content', new Y.Text(c.content));
	return map;
}

function buildOperativeClauseMap(c: OperativeClause): Y.Map<unknown> {
	const map = new Y.Map<unknown>();
	map.set('id', c.id);
	map.set('blocks', buildBlocksArray(c.blocks));
	return map;
}

/**
 * Idempotently seed a Y.Doc with the given Resolution. If the root map
 * already has data, this is a no-op (existing collaborators win).
 */
export function jsonToYDoc(yDoc: Y.Doc, json: Resolution): void {
	const root = yDoc.getMap<unknown>(ROOT_KEY);
	yDoc.transact(() => {
		if (root.size > 0) return; // already seeded
		root.set('committeeName', new Y.Text(json.committeeName));

		const preamble = new Y.Array<Y.Map<unknown>>();
		preamble.insert(0, json.preamble.map(buildPreambleClauseMap));
		root.set('preamble', preamble);

		const operative = new Y.Array<Y.Map<unknown>>();
		operative.insert(0, json.operative.map(buildOperativeClauseMap));
		root.set('operative', operative);
	}, 'seed');
}

// ---------------------------------------------------------------------------
// Y → JSON
// ---------------------------------------------------------------------------

function readBlock(map: Y.Map<unknown>): ClauseBlock {
	const id = String(map.get('id'));
	const type = map.get('type');
	if (type === 'text') {
		const content = map.get('content');
		const text = content instanceof Y.Text ? content.toString() : String(content ?? '');
		return { type: 'text', id, content: text };
	}
	// subclauses
	const items = map.get('items');
	const arr = items instanceof Y.Array ? (items as Y.Array<Y.Map<unknown>>) : null;
	const subItems: SubClause[] = arr ? arr.toArray().map(readSubClause) : [];
	return { type: 'subclauses', id, items: subItems };
}

function readSubClause(map: Y.Map<unknown>): SubClause {
	const id = String(map.get('id'));
	const blocks = map.get('blocks');
	const arr = blocks instanceof Y.Array ? (blocks as Y.Array<Y.Map<unknown>>) : null;
	return {
		id,
		blocks: arr ? arr.toArray().map(readBlock) : []
	};
}

function readOperative(map: Y.Map<unknown>): OperativeClause {
	const id = String(map.get('id'));
	const blocks = map.get('blocks');
	const arr = blocks instanceof Y.Array ? (blocks as Y.Array<Y.Map<unknown>>) : null;
	return {
		id,
		blocks: arr ? arr.toArray().map(readBlock) : []
	};
}

function readPreamble(map: Y.Map<unknown>): PreambleClause {
	const id = String(map.get('id'));
	const content = map.get('content');
	const text = content instanceof Y.Text ? content.toString() : String(content ?? '');
	return { id, content: text };
}

export function yDocToJson(yDoc: Y.Doc): Resolution {
	const root = yDoc.getMap<unknown>(ROOT_KEY);
	const cn = root.get('committeeName');
	const committeeName = cn instanceof Y.Text ? cn.toString() : String(cn ?? '');

	const preamble = root.get('preamble');
	const operative = root.get('operative');

	const preambleArr =
		preamble instanceof Y.Array ? (preamble as Y.Array<Y.Map<unknown>>).toArray() : [];
	const operativeArr =
		operative instanceof Y.Array ? (operative as Y.Array<Y.Map<unknown>>).toArray() : [];

	return {
		committeeName,
		preamble: preambleArr.map(readPreamble),
		operative: operativeArr.map(readOperative)
	};
}

// ---------------------------------------------------------------------------
// Replace (structural diff preserving identity by id)
// ---------------------------------------------------------------------------

/**
 * Apply a target `Resolution` to the Y.Doc, preserving clause identity
 * wherever possible. Clauses matched by id are reconciled in place
 * (so concurrent peers do not see their cursors snap back to the start
 * of a textarea); unmatched clauses are removed/inserted.
 *
 * Wrapped in a single Y transaction so observers see a coherent change.
 */
export function replaceResolution(yDoc: Y.Doc, next: Resolution): void {
	yDoc.transact(() => {
		const root = yDoc.getMap<unknown>(ROOT_KEY);
		if (root.size === 0) {
			jsonToYDoc(yDoc, next);
			return;
		}

		// committeeName: replace text content via diff to keep concurrent edits sane
		const cn = root.get('committeeName');
		if (cn instanceof Y.Text) {
			diffApplyYText(cn, next.committeeName);
		} else {
			root.set('committeeName', new Y.Text(next.committeeName));
		}

		const preambleArr = root.get('preamble');
		if (preambleArr instanceof Y.Array) {
			reconcilePreamble(preambleArr as Y.Array<Y.Map<unknown>>, next.preamble);
		} else {
			const arr = new Y.Array<Y.Map<unknown>>();
			arr.insert(0, next.preamble.map(buildPreambleClauseMap));
			root.set('preamble', arr);
		}

		const operativeArr = root.get('operative');
		if (operativeArr instanceof Y.Array) {
			reconcileOperative(operativeArr as Y.Array<Y.Map<unknown>>, next.operative);
		} else {
			const arr = new Y.Array<Y.Map<unknown>>();
			arr.insert(0, next.operative.map(buildOperativeClauseMap));
			root.set('operative', arr);
		}
	}, 'replace');
}

function reconcilePreamble(arr: Y.Array<Y.Map<unknown>>, target: PreambleClause[]) {
	const targetIds = new Set(target.map((c) => c.id));
	// Remove items not in target.
	for (let i = arr.length - 1; i >= 0; i--) {
		const item = arr.get(i);
		const id = item instanceof Y.Map ? String(item.get('id')) : '';
		if (!targetIds.has(id)) arr.delete(i, 1);
	}
	// Map current id -> index.
	const currentMap = new Map<string, number>();
	for (let i = 0; i < arr.length; i++) {
		const item = arr.get(i);
		if (item instanceof Y.Map) currentMap.set(String(item.get('id')), i);
	}

	// Walk target left-to-right, ensuring each is at the right position.
	for (let i = 0; i < target.length; i++) {
		const t = target[i];
		const currentIdx = currentMap.get(t.id);
		if (currentIdx === undefined) {
			arr.insert(i, [buildPreambleClauseMap(t)]);
			rebuildIndexMap(arr, currentMap);
		} else {
			if (currentIdx !== i) {
				const item = arr.get(currentIdx);
				arr.delete(currentIdx, 1);
				arr.insert(i, [item as Y.Map<unknown>]);
				rebuildIndexMap(arr, currentMap);
			}
			// Reconcile content.
			const item = arr.get(i);
			if (item instanceof Y.Map) {
				const c = item.get('content');
				if (c instanceof Y.Text) diffApplyYText(c, t.content);
				else item.set('content', new Y.Text(t.content));
			}
		}
	}
}

function reconcileOperative(arr: Y.Array<Y.Map<unknown>>, target: OperativeClause[]) {
	const targetIds = new Set(target.map((c) => c.id));
	for (let i = arr.length - 1; i >= 0; i--) {
		const item = arr.get(i);
		const id = item instanceof Y.Map ? String(item.get('id')) : '';
		if (!targetIds.has(id)) arr.delete(i, 1);
	}
	const currentMap = new Map<string, number>();
	for (let i = 0; i < arr.length; i++) {
		const item = arr.get(i);
		if (item instanceof Y.Map) currentMap.set(String(item.get('id')), i);
	}

	for (let i = 0; i < target.length; i++) {
		const t = target[i];
		const currentIdx = currentMap.get(t.id);
		if (currentIdx === undefined) {
			arr.insert(i, [buildOperativeClauseMap(t)]);
			rebuildIndexMap(arr, currentMap);
		} else {
			if (currentIdx !== i) {
				const item = arr.get(currentIdx);
				arr.delete(currentIdx, 1);
				arr.insert(i, [item as Y.Map<unknown>]);
				rebuildIndexMap(arr, currentMap);
			}
			const item = arr.get(i);
			if (item instanceof Y.Map) {
				const blocksArr = item.get('blocks');
				if (blocksArr instanceof Y.Array) {
					reconcileBlocks(blocksArr as Y.Array<Y.Map<unknown>>, t.blocks);
				} else {
					item.set('blocks', buildBlocksArray(t.blocks));
				}
			}
		}
	}
}

function reconcileBlocks(arr: Y.Array<Y.Map<unknown>>, target: ClauseBlock[]) {
	const targetIds = new Set(target.map((b) => b.id));
	for (let i = arr.length - 1; i >= 0; i--) {
		const item = arr.get(i);
		const id = item instanceof Y.Map ? String(item.get('id')) : '';
		if (!targetIds.has(id)) arr.delete(i, 1);
	}
	const currentMap = new Map<string, number>();
	for (let i = 0; i < arr.length; i++) {
		const item = arr.get(i);
		if (item instanceof Y.Map) currentMap.set(String(item.get('id')), i);
	}

	for (let i = 0; i < target.length; i++) {
		const t = target[i];
		const currentIdx = currentMap.get(t.id);
		if (currentIdx === undefined) {
			arr.insert(i, [buildBlockMap(t)]);
			rebuildIndexMap(arr, currentMap);
		} else {
			if (currentIdx !== i) {
				const item = arr.get(currentIdx);
				arr.delete(currentIdx, 1);
				arr.insert(i, [item as Y.Map<unknown>]);
				rebuildIndexMap(arr, currentMap);
			}
			const item = arr.get(i);
			if (item instanceof Y.Map) {
				const currentType = item.get('type');
				if (currentType !== t.type) {
					// Type changed — replace whole entry.
					arr.delete(i, 1);
					arr.insert(i, [buildBlockMap(t)]);
					rebuildIndexMap(arr, currentMap);
					continue;
				}
				if (t.type === 'text') {
					const c = item.get('content');
					if (c instanceof Y.Text) diffApplyYText(c, t.content);
					else item.set('content', new Y.Text(t.content));
				} else {
					const itemsArr = item.get('items');
					if (itemsArr instanceof Y.Array) {
						reconcileSubClauses(itemsArr as Y.Array<Y.Map<unknown>>, t.items);
					} else {
						const a = new Y.Array<Y.Map<unknown>>();
						a.insert(0, t.items.map(buildSubClauseMap));
						item.set('items', a);
					}
				}
			}
		}
	}
}

function reconcileSubClauses(arr: Y.Array<Y.Map<unknown>>, target: SubClause[]) {
	const targetIds = new Set(target.map((s) => s.id));
	for (let i = arr.length - 1; i >= 0; i--) {
		const item = arr.get(i);
		const id = item instanceof Y.Map ? String(item.get('id')) : '';
		if (!targetIds.has(id)) arr.delete(i, 1);
	}
	const currentMap = new Map<string, number>();
	for (let i = 0; i < arr.length; i++) {
		const item = arr.get(i);
		if (item instanceof Y.Map) currentMap.set(String(item.get('id')), i);
	}

	for (let i = 0; i < target.length; i++) {
		const t = target[i];
		const currentIdx = currentMap.get(t.id);
		if (currentIdx === undefined) {
			arr.insert(i, [buildSubClauseMap(t)]);
			rebuildIndexMap(arr, currentMap);
		} else {
			if (currentIdx !== i) {
				const item = arr.get(currentIdx);
				arr.delete(currentIdx, 1);
				arr.insert(i, [item as Y.Map<unknown>]);
				rebuildIndexMap(arr, currentMap);
			}
			const item = arr.get(i);
			if (item instanceof Y.Map) {
				const blocksArr = item.get('blocks');
				if (blocksArr instanceof Y.Array) {
					reconcileBlocks(blocksArr as Y.Array<Y.Map<unknown>>, t.blocks);
				} else {
					item.set('blocks', buildBlocksArray(t.blocks));
				}
			}
		}
	}
}

function rebuildIndexMap(arr: Y.Array<Y.Map<unknown>>, map: Map<string, number>) {
	map.clear();
	for (let i = 0; i < arr.length; i++) {
		const item = arr.get(i);
		if (item instanceof Y.Map) map.set(String(item.get('id')), i);
	}
}

// ---------------------------------------------------------------------------
// Y.Text diff/apply
// ---------------------------------------------------------------------------

/**
 * Apply minimum edits to make `target` equal `next`. Computes a single
 * common prefix + common suffix and replaces the middle. This is sufficient
 * for typical user typing and avoids large delete-and-reinsert ops that
 * would clobber concurrent peers.
 */
export function diffApplyYText(target: Y.Text, next: string): void {
	const current = target.toString();
	if (current === next) return;

	let prefixEnd = 0;
	const minLen = Math.min(current.length, next.length);
	while (prefixEnd < minLen && current[prefixEnd] === next[prefixEnd]) prefixEnd++;

	let suffixLenCurrent = 0;
	let suffixLenNext = 0;
	while (
		suffixLenCurrent < current.length - prefixEnd &&
		suffixLenNext < next.length - prefixEnd &&
		current[current.length - 1 - suffixLenCurrent] === next[next.length - 1 - suffixLenNext]
	) {
		suffixLenCurrent++;
		suffixLenNext++;
	}

	const deleteLen = current.length - prefixEnd - suffixLenCurrent;
	const insertText = next.slice(prefixEnd, next.length - suffixLenNext);

	if (deleteLen > 0) target.delete(prefixEnd, deleteLen);
	if (insertText.length > 0) target.insert(prefixEnd, insertText);
}
