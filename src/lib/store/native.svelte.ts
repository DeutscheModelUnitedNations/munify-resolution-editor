/**
 * Native (plain-JSON) implementation of `ResolutionStore`.
 *
 * Used by consumers that don't need real-time collaboration — Delegator's
 * working-paper editor, CHASE's amendment-creation modal, print and
 * presentation previews. Wraps a Svelte 5 `$state` and notifies via
 * `onChange` after each mutation so callers can persist the JSON.
 */

import {
	type Resolution,
	type PreambleClause,
	type OperativeClause,
	type SubClause,
	type ClauseBlock,
	createEmptyResolution,
	createEmptyPreambleClause,
	createEmptyOperativeClause,
	createEmptySubClause,
	createTextBlock,
	createSubclausesBlock,
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
} from './types';

export interface NativeStoreOptions {
	/** Fired after every mutation with the latest snapshot. */
	onChange?: (snapshot: Resolution) => void;
}

export function createNativeStore(
	initial: Resolution,
	opts: NativeStoreOptions = {}
): ResolutionStore {
	// `$state` makes the snapshot reactive for components reading it.
	const snapshot = $state<Resolution>(structuredClone(initial));
	let suppressOnChange = false;

	function notify() {
		if (suppressOnChange) return;
		opts.onChange?.($state.snapshot(snapshot));
	}

	// ===================================================================
	// Lookup helpers — locate a clause/subclause by id, returning
	// references to the parent array + index so mutations can splice.
	// ===================================================================

	function findOperativeIndex(id: string): number {
		return snapshot.operative.findIndex((c) => c.id === id);
	}

	function findPreambleIndex(id: string): number {
		return snapshot.preamble.findIndex((c) => c.id === id);
	}

	type SubLocation = {
		container: SubClause[];
		index: number;
		depth: number;
	};

	function findSubClause(id: string): SubLocation | null {
		function walk(items: SubClause[], depth: number): SubLocation | null {
			for (let i = 0; i < items.length; i++) {
				if (items[i].id === id) return { container: items, index: i, depth };
				const blocks = items[i].blocks;
				for (const block of blocks) {
					if (block.type === 'subclauses') {
						const found = walk(block.items, depth + 1);
						if (found) return found;
					}
				}
			}
			return null;
		}
		for (const op of snapshot.operative) {
			for (const block of op.blocks) {
				if (block.type === 'subclauses') {
					const found = walk(block.items, 1);
					if (found) return found;
				}
			}
		}
		return null;
	}

	function findOperativeOrSub(
		path: ClausePath
	): { kind: 'operative'; clause: OperativeClause } | { kind: 'sub'; clause: SubClause } | null {
		if (path.kind === 'operative') {
			const idx = findOperativeIndex(path.clauseId);
			if (idx === -1) return null;
			return { kind: 'operative', clause: snapshot.operative[idx] };
		}
		const sub = findSubClause(path.subClauseId);
		if (!sub) return null;
		return { kind: 'sub', clause: sub.container[sub.index] };
	}

	function findSubclausesBlock(
		path: SubclausesBlockPath
	): { items: SubClause[]; parentBlocks: ClauseBlock[]; blockIndex: number; depth: number } | null {
		if (path.kind === 'operative') {
			const op = snapshot.operative.find((c) => c.id === path.clauseId);
			if (!op) return null;
			const blockIndex = op.blocks.findIndex((b) => b.type === 'subclauses');
			if (blockIndex === -1) return null;
			const block = op.blocks[blockIndex];
			if (block.type !== 'subclauses') return null;
			return { items: block.items, parentBlocks: op.blocks, blockIndex, depth: 1 };
		}
		const loc = findSubClause(path.subClauseId);
		if (!loc) return null;
		const sub = loc.container[loc.index];
		const blockIndex = sub.blocks.findIndex((b) => b.type === 'subclauses');
		if (blockIndex === -1) return null;
		const block = sub.blocks[blockIndex];
		if (block.type !== 'subclauses') return null;
		return { items: block.items, parentBlocks: sub.blocks, blockIndex, depth: loc.depth + 1 };
	}

	// ===================================================================
	// Mutations
	// ===================================================================

	function setCommitteeName(name: string) {
		if (snapshot.committeeName === name) return;
		snapshot.committeeName = name;
		notify();
	}

	function addPreambleClause(clause?: Partial<PreambleClause>): string {
		const next: PreambleClause = { ...createEmptyPreambleClause(), ...clause };
		snapshot.preamble.push(next);
		notify();
		return next.id;
	}

	function deletePreambleClause(id: string) {
		const idx = findPreambleIndex(id);
		if (idx === -1) return;
		snapshot.preamble.splice(idx, 1);
		notify();
	}

	function movePreambleClause(id: string, direction: 'up' | 'down') {
		const idx = findPreambleIndex(id);
		if (idx === -1) return;
		const next = direction === 'up' ? idx - 1 : idx + 1;
		if (next < 0 || next >= snapshot.preamble.length) return;
		const tmp = snapshot.preamble[idx];
		snapshot.preamble[idx] = snapshot.preamble[next];
		snapshot.preamble[next] = tmp;
		notify();
	}

	function updatePreambleContent(id: string, content: string) {
		const idx = findPreambleIndex(id);
		if (idx === -1) return;
		if (snapshot.preamble[idx].content === content) return;
		snapshot.preamble[idx].content = content;
		notify();
	}

	function insertPreambleClauses(at: number, clauses: PreambleClause[]) {
		if (clauses.length === 0) return;
		const clamped = Math.max(0, Math.min(at, snapshot.preamble.length));
		snapshot.preamble.splice(clamped, 0, ...clauses);
		notify();
	}

	function addOperativeClause(clause?: Partial<OperativeClause>): string {
		const next: OperativeClause = { ...createEmptyOperativeClause(), ...clause };
		snapshot.operative.push(next);
		notify();
		return next.id;
	}

	function deleteOperativeClause(id: string) {
		const idx = findOperativeIndex(id);
		if (idx === -1) return;
		snapshot.operative.splice(idx, 1);
		notify();
	}

	function moveOperativeClause(id: string, direction: 'up' | 'down') {
		const idx = findOperativeIndex(id);
		if (idx === -1) return;
		const next = direction === 'up' ? idx - 1 : idx + 1;
		if (next < 0 || next >= snapshot.operative.length) return;
		const tmp = snapshot.operative[idx];
		snapshot.operative[idx] = snapshot.operative[next];
		snapshot.operative[next] = tmp;
		notify();
	}

	function insertOperativeClauseAfter(afterId: string, clause: OperativeClause) {
		const idx = findOperativeIndex(afterId);
		if (idx === -1) {
			snapshot.operative.push(clause);
		} else {
			snapshot.operative.splice(idx + 1, 0, clause);
		}
		notify();
	}

	function insertOperativeClauses(at: number, clauses: OperativeClause[]) {
		if (clauses.length === 0) return;
		const clamped = Math.max(0, Math.min(at, snapshot.operative.length));
		snapshot.operative.splice(clamped, 0, ...clauses);
		notify();
	}

	function updateTextBlock(path: ClausePath, blockId: string, content: string) {
		const target = findOperativeOrSub(path);
		if (!target) return;
		const block = target.clause.blocks.find((b) => b.id === blockId);
		if (!block || block.type !== 'text') return;
		if (block.content === content) return;
		block.content = content;
		notify();
	}

	function appendTextBlock(path: ClausePath): string {
		const target = findOperativeOrSub(path);
		if (!target) return '';
		const block = createTextBlock();
		target.clause.blocks.push(block);
		notify();
		return block.id;
	}

	function deleteBlock(path: ClausePath, blockId: string) {
		const target = findOperativeOrSub(path);
		if (!target) return;
		const blocks = target.clause.blocks;
		const idx = blocks.findIndex((b) => b.id === blockId);
		// First text block is required and cannot be removed.
		if (idx <= 0) return;
		blocks.splice(idx, 1);
		const cleaned = cleanupBlocks($state.snapshot(target.clause).blocks);
		// Replace the array contents in place to preserve `$state` reactivity.
		blocks.length = 0;
		blocks.push(...cleaned);
		notify();
	}

	function appendSubclausesBlock(path: ClausePath, initialItems?: SubClause[]): string {
		const target = findOperativeOrSub(path);
		if (!target) return '';
		const items = initialItems && initialItems.length > 0 ? initialItems : [createEmptySubClause()];
		const block = createSubclausesBlock(items);
		target.clause.blocks.push(block);
		notify();
		return block.id;
	}

	function addSubClause(path: SubclausesBlockPath, after?: string): string {
		const sub = createEmptySubClause();

		// If the parent has no subclauses block yet, create one with the new item.
		const existing = findSubclausesBlock(path);
		if (!existing) {
			if (path.kind === 'operative') {
				const op = snapshot.operative.find((c) => c.id === path.clauseId);
				if (!op) return '';
				op.blocks.push(createSubclausesBlock([sub]));
			} else {
				const loc = findSubClause(path.subClauseId);
				if (!loc) return '';
				const parent = loc.container[loc.index];
				if (loc.depth + 1 > MAX_SUBCLAUSE_DEPTH) return '';
				parent.blocks.push(createSubclausesBlock([sub]));
			}
			notify();
			return sub.id;
		}

		const items = existing.items;
		if (after) {
			const idx = items.findIndex((s) => s.id === after);
			if (idx === -1) items.push(sub);
			else items.splice(idx + 1, 0, sub);
		} else {
			items.push(sub);
		}
		notify();
		return sub.id;
	}

	function deleteSubClause(path: SubclausesBlockPath, id: string) {
		const block = findSubclausesBlock(path);
		if (!block) return;
		const idx = block.items.findIndex((s) => s.id === id);
		if (idx === -1) return;
		block.items.splice(idx, 1);
		// If empty, drop the subclauses block + cleanup
		if (block.items.length === 0) {
			block.parentBlocks.splice(block.blockIndex, 1);
			const cleaned = cleanupBlocks(structuredClone($state.snapshot(block.parentBlocks)));
			block.parentBlocks.length = 0;
			block.parentBlocks.push(...cleaned);
		}
		notify();
	}

	function moveSubClause(path: SubclausesBlockPath, id: string, direction: 'up' | 'down') {
		const block = findSubclausesBlock(path);
		if (!block) return;
		const idx = block.items.findIndex((s) => s.id === id);
		if (idx === -1) return;
		const next = direction === 'up' ? idx - 1 : idx + 1;
		if (next < 0 || next >= block.items.length) return;
		const tmp = block.items[idx];
		block.items[idx] = block.items[next];
		block.items[next] = tmp;
		notify();
	}

	function indentSubClause(path: SubclausesBlockPath, id: string) {
		const block = findSubclausesBlock(path);
		if (!block) return;
		const idx = block.items.findIndex((s) => s.id === id);
		if (idx <= 0) return; // first item or not found
		if (block.depth >= MAX_SUBCLAUSE_DEPTH) return;

		const target = block.items[idx];
		const previous = block.items[idx - 1];
		const updatedPrevious = appendNestedSubClause(
			structuredClone($state.snapshot(previous)),
			structuredClone($state.snapshot(target))
		);
		block.items[idx - 1] = updatedPrevious;
		block.items.splice(idx, 1);
		notify();
	}

	function outdentSubClause(path: SubclausesBlockPath, id: string): OutdentResult {
		const block = findSubclausesBlock(path);
		if (!block) return { kind: 'noop' };
		const idx = block.items.findIndex((s) => s.id === id);
		if (idx === -1) return { kind: 'noop' };

		const target = block.items[idx];
		const targetCopy = structuredClone($state.snapshot(target));

		if (block.depth === 1) {
			// Promote to operative clause inserted after the owning operative.
			if (path.kind !== 'operative') return { kind: 'noop' };
			const opIdx = findOperativeIndex(path.clauseId);
			if (opIdx === -1) return { kind: 'noop' };

			block.items.splice(idx, 1);
			if (block.items.length === 0) {
				block.parentBlocks.splice(block.blockIndex, 1);
				const cleaned = cleanupBlocks(structuredClone($state.snapshot(block.parentBlocks)));
				block.parentBlocks.length = 0;
				block.parentBlocks.push(...cleaned);
			}
			const newOperative = subClauseToOperativeClause(targetCopy);
			snapshot.operative.splice(opIdx + 1, 0, newOperative);
			notify();
			return { kind: 'toOperative', clause: newOperative };
		}

		// Outdent to grandparent: find the parent subclause, insert sibling after it.
		// `path` is a SubclausesBlockPath identifying the *immediate* parent of the
		// target; we need to walk one level up.
		if (path.kind !== 'subclause') return { kind: 'noop' };
		const parentLoc = findSubClause(path.subClauseId);
		if (!parentLoc) return { kind: 'noop' };

		block.items.splice(idx, 1);
		if (block.items.length === 0) {
			block.parentBlocks.splice(block.blockIndex, 1);
			const cleaned = cleanupBlocks(structuredClone($state.snapshot(block.parentBlocks)));
			block.parentBlocks.length = 0;
			block.parentBlocks.push(...cleaned);
		}
		// Insert into grandparent container after the parent.
		parentLoc.container.splice(parentLoc.index + 1, 0, targetCopy);
		notify();
		return { kind: 'toParent' };
	}

	function replaceResolution(next: Resolution) {
		// Suppress intermediate notifies; emit one combined onChange.
		suppressOnChange = true;
		try {
			snapshot.committeeName = next.committeeName;
			snapshot.preamble.length = 0;
			snapshot.preamble.push(...structuredClone(next.preamble));
			snapshot.operative.length = 0;
			snapshot.operative.push(...structuredClone(next.operative));
		} finally {
			suppressOnChange = false;
		}
		notify();
	}

	// ===================================================================
	// Text handle
	// ===================================================================

	function readText(loc: TextLocation): string {
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
				const sub = findSubClause(loc.subClauseId);
				if (!sub) return '';
				const b = sub.container[sub.index].blocks.find((bl) => bl.id === loc.blockId);
				return b?.type === 'text' ? b.content : '';
			}
		}
	}

	function writeText(loc: TextLocation, content: string) {
		switch (loc.kind) {
			case 'preamble':
				updatePreambleContent(loc.clauseId, content);
				return;
			case 'operative-text':
				updateTextBlock({ kind: 'operative', clauseId: loc.clauseId }, loc.blockId, content);
				return;
			case 'subclause-text':
				updateTextBlock({ kind: 'subclause', subClauseId: loc.subClauseId }, loc.blockId, content);
				return;
		}
	}

	function getTextHandle(loc: TextLocation): TextHandle {
		return {
			get: () => readText(loc),
			set: (content) => writeText(loc, content),
			bindTextarea: (el) =>
				bindNativeTextarea(
					el,
					() => readText(loc),
					(next) => writeText(loc, next)
				)
		};
	}

	function destroy() {
		// Native store has no resources to release.
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

/**
 * Convenience: build a native store seeded with an empty resolution for
 * the given committee name.
 */
export function createEmptyNativeStore(committeeName: string, opts?: NativeStoreOptions) {
	return createNativeStore(createEmptyResolution(committeeName), opts);
}

/**
 * Wire a textarea to a get/set pair for the native store.
 *
 * - Initialises `el.value` from `read()`.
 * - On user input, calls `write(el.value)`.
 * - When `read()` changes externally (e.g. another mutator updated the
 *   snapshot), refreshes `el.value` while the textarea is unfocused, or
 *   syncs while preserving the cursor when focused.
 *
 * Designed to be called from inside a Svelte effect — uses `$effect.root`
 * so cleanup tears down the inner reactive watcher.
 */
function bindNativeTextarea(
	el: HTMLTextAreaElement,
	read: () => string,
	write: (next: string) => void
): () => void {
	el.value = read();

	const onInput = () => write(el.value);
	el.addEventListener('input', onInput);

	const stopWatcher = $effect.root(() => {
		$effect(() => {
			const current = read();
			if (el.value === current) return;
			if (document.activeElement === el) {
				const start = el.selectionStart;
				const end = el.selectionEnd;
				el.value = current;
				try {
					if (start !== null && end !== null) {
						el.selectionStart = Math.min(start, current.length);
						el.selectionEnd = Math.min(end, current.length);
					}
				} catch {
					// some browsers throw when setting selection on detached nodes
				}
			} else {
				el.value = current;
			}
		});
	});

	return () => {
		el.removeEventListener('input', onInput);
		stopWatcher();
	};
}
