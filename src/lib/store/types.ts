/**
 * Store interface for the resolution editor.
 *
 * The editor components consume an implementation of `ResolutionStore`
 * instead of owning their own `$state`. Two implementations are shipped:
 * `createNativeStore` (plain JSON, in this package) and `createYjsStore`
 * (Y.js-backed, in the `/yjs` subpath).
 */

import type { Resolution, OperativeClause, PreambleClause, SubClause } from '../schema/resolution';

/**
 * Address of a clause-or-subclause that owns a `blocks` array.
 * Used for block-level mutations (add text block, delete block, etc.).
 *
 * Identifiers are globally unique within a Resolution, so a single id is
 * sufficient — implementations walk the tree to resolve.
 */
export type ClausePath =
	| { kind: 'operative'; clauseId: string }
	| { kind: 'subclause'; subClauseId: string };

/**
 * Address of a sub-clauses container — either an operative clause's nested
 * sub-clauses block, or a sub-clause's nested sub-clauses block.
 */
export type SubclausesBlockPath =
	| { kind: 'operative'; clauseId: string }
	| { kind: 'subclause'; subClauseId: string };

/**
 * Address of an editable text region.
 *
 * Preamble clauses store text directly as `content`. Operative clauses and
 * sub-clauses store text inside individual text blocks in their `blocks`
 * array; the block id pins the exact target.
 */
export type TextLocation =
	| { kind: 'preamble'; clauseId: string }
	| { kind: 'operative-text'; clauseId: string; blockId: string }
	| { kind: 'subclause-text'; subClauseId: string; blockId: string };

/**
 * A handle to a single editable text region. The native store backs this
 * with a plain string slot; the Y.js store backs it with a `Y.Text`.
 *
 * `bindTextarea` is the seam that lets the Y.js implementation install a
 * bidirectional CRDT binding on the textarea while the native
 * implementation is a no-op (callers fall back to `value` + `oninput`).
 */
export interface TextHandle {
	/** Current snapshot string. Reactive — reading inside an effect tracks changes. */
	get(): string;
	/** Replace the entire text. For Yjs, this is implemented as a minimal diff. */
	set(next: string): void;
	/**
	 * Install a bidirectional binding to the given textarea. Returns a
	 * dispose function. The native impl is a no-op.
	 */
	bindTextarea(el: HTMLTextAreaElement): () => void;
}

/**
 * Outcome of an outdent operation. The caller (UI) needs to know whether
 * the sub-clause was promoted to an operative clause (so it can scroll/focus
 * the new operative position) or merely outdented to its grandparent.
 */
export type OutdentResult =
	| { kind: 'toOperative'; clause: OperativeClause }
	| { kind: 'toParent' }
	| { kind: 'noop' };

export interface PresenceUser {
	id: string;
	name: string;
	color?: string;
}

export interface PresenceInfo {
	user: PresenceUser;
	/** Id of the clause/subclause the user is currently focused on, if any. */
	clauseId?: string;
	/** Optional cursor position within the focused text. */
	cursor?: { blockId?: string; index: number };
}

/**
 * Adapter exposing remote-user awareness. The native store provides a
 * no-op; the Y.js store wires this to a `y-protocols/awareness` instance.
 *
 * Returned getters should be reactive (read inside `$state`/`$derived`).
 */
export interface PresenceAdapter {
	/** Self-identity, if known. Excluded from `editorsFor`/`getAll`. */
	readonly self?: PresenceUser;
	/** All remote users currently connected. */
	getAll(): PresenceInfo[];
	/** Remote users currently focused on the given clause/subclause id. */
	editorsFor(clauseOrSubClauseId: string): PresenceInfo[];
	/** Report local focus. Pass `undefined` to clear. */
	setFocus(clauseId: string | undefined): void;
}

/**
 * Top-level store interface consumed by the editor components.
 *
 * Implementations expose `snapshot` as a Svelte 5 `$state` value so that
 * reading it inside components triggers reactivity. Mutators must batch
 * their writes such that `snapshot` is updated atomically per call (the
 * Y.js implementation wraps each in a single `Y.transact`).
 */
export interface ResolutionStore {
	/** Reactive snapshot of the current resolution. */
	readonly snapshot: Resolution;

	/** Returns a `TextHandle` for the given location. */
	getTextHandle(loc: TextLocation): TextHandle;

	// ===================================================================
	// Top-level
	// ===================================================================
	setCommitteeName(name: string): void;

	// ===================================================================
	// Preamble clauses
	// ===================================================================
	addPreambleClause(clause?: Partial<PreambleClause>): string;
	deletePreambleClause(id: string): void;
	movePreambleClause(id: string, direction: 'up' | 'down'): void;
	updatePreambleContent(id: string, content: string): void;
	insertPreambleClauses(at: number, clauses: PreambleClause[]): void;

	// ===================================================================
	// Operative clauses
	// ===================================================================
	addOperativeClause(clause?: Partial<OperativeClause>): string;
	deleteOperativeClause(id: string): void;
	moveOperativeClause(id: string, direction: 'up' | 'down'): void;
	insertOperativeClauseAfter(afterId: string, clause: OperativeClause): void;
	insertOperativeClauses(at: number, clauses: OperativeClause[]): void;

	// ===================================================================
	// Block-level mutations
	// (apply to either an OperativeClause or a SubClause via ClausePath)
	// ===================================================================
	updateTextBlock(path: ClausePath, blockId: string, content: string): void;
	appendTextBlock(path: ClausePath): string;
	deleteBlock(path: ClausePath, blockId: string): void;
	appendSubclausesBlock(path: ClausePath, initialItems?: SubClause[]): string;

	// ===================================================================
	// Sub-clauses
	// ===================================================================
	addSubClause(path: SubclausesBlockPath, after?: string): string;
	deleteSubClause(path: SubclausesBlockPath, id: string): void;
	moveSubClause(path: SubclausesBlockPath, id: string, direction: 'up' | 'down'): void;
	indentSubClause(path: SubclausesBlockPath, id: string): void;
	outdentSubClause(path: SubclausesBlockPath, id: string): OutdentResult;

	// ===================================================================
	// Bulk replace (used by amendment apply, status transitions, import)
	// Implementations preserve clause identity by id where possible so
	// concurrent peers' cursors are not jostled in unaffected clauses.
	// ===================================================================
	replaceResolution(next: Resolution): void;

	// ===================================================================
	// Lifecycle
	// ===================================================================
	destroy(): void;
}
