/**
 * Standalone operative-paragraph diff model.
 *
 * Builds a render-friendly tree from a single `OperativeClause`. Either a plain
 * tree (no diff) or a word-level diff tree comparing an old vs. new clause.
 *
 * Old and new are paired structurally by position (blocks and sub-clause items
 * by index, after dropping empties). Moves surface as a remove + add pair,
 * which is also visible in the RES-Markup source itself, so no move-detection
 * heuristic is applied.
 */

import { diffWords } from 'diff';
import type { OperativeClause, SubClause, ClauseBlock } from '../schema/resolution';
import { isClauseEmpty } from '../schema/resolution';

export type ChangeStatus = 'same' | 'added' | 'removed';

export interface RenderWord {
	value: string;
	status: ChangeStatus;
}

export interface RenderText {
	type: 'text';
	/** Word-level parts; for non-diff / wholly added|removed blocks this is a single part. */
	words: RenderWord[];
	/** Whole-block status. `same` means word-level diff inside an otherwise present block. */
	blockStatus: ChangeStatus;
	/** Trailing punctuation appended at render time (`;` or `.`). */
	punctuation: ';' | '.';
}

export interface RenderSubclauses {
	type: 'subclauses';
	items: RenderItem[];
}

export type RenderBlock = RenderText | RenderSubclauses;

export interface RenderItem {
	status: ChangeStatus;
	blocks: RenderBlock[];
}

export interface RenderClause {
	blocks: RenderBlock[];
}

function plainBlocks(blocks: ClauseBlock[], status: ChangeStatus): RenderBlock[] {
	const out: RenderBlock[] = [];
	for (const b of blocks) {
		if (b.type === 'text') {
			const content = b.content.trim();
			if (!content) continue;
			out.push({
				type: 'text',
				blockStatus: status,
				words: [{ value: content, status }],
				punctuation: ';'
			});
		} else {
			const items = b.items.filter((s) => !isClauseEmpty(s));
			if (items.length === 0) continue;
			out.push({
				type: 'subclauses',
				items: items.map((s) => ({ status, blocks: plainBlocks(s.blocks, status) }))
			});
		}
	}
	return out;
}

function renderableBlocks(blocks: ClauseBlock[]): ClauseBlock[] {
	return blocks.filter((b) =>
		b.type === 'text'
			? b.content.trim().length > 0
			: b.items.filter((s) => !isClauseEmpty(s)).length > 0
	);
}

function diffTextBlock(oldContent: string, newContent: string): RenderText {
	const a = oldContent.trim();
	const b = newContent.trim();
	const words: RenderWord[] = diffWords(a, b).map((part) => ({
		value: part.value,
		status: part.added ? 'added' : part.removed ? 'removed' : 'same'
	}));
	return { type: 'text', blockStatus: 'same', words, punctuation: ';' };
}

function diffSubItems(oldItems: SubClause[], newItems: SubClause[]): RenderItem[] {
	const olds = oldItems.filter((s) => !isClauseEmpty(s));
	const news = newItems.filter((s) => !isClauseEmpty(s));
	const out: RenderItem[] = [];
	const max = Math.max(olds.length, news.length);
	for (let i = 0; i < max; i++) {
		const o = olds[i];
		const n = news[i];
		if (n && !o) {
			out.push({ status: 'added', blocks: plainBlocks(n.blocks, 'added') });
		} else if (o && !n) {
			out.push({ status: 'removed', blocks: plainBlocks(o.blocks, 'removed') });
		} else {
			out.push({ status: 'same', blocks: diffBlocks(o.blocks, n.blocks) });
		}
	}
	return out;
}

function diffBlocks(oldBlocks: ClauseBlock[], newBlocks: ClauseBlock[]): RenderBlock[] {
	const olds = renderableBlocks(oldBlocks);
	const news = renderableBlocks(newBlocks);
	const out: RenderBlock[] = [];
	const max = Math.max(olds.length, news.length);
	for (let i = 0; i < max; i++) {
		const o = olds[i];
		const n = news[i];
		if (n && !o) {
			out.push(...plainBlocks([n], 'added'));
		} else if (o && !n) {
			out.push(...plainBlocks([o], 'removed'));
		} else if (o.type === 'text' && n.type === 'text') {
			out.push(diffTextBlock(o.content, n.content));
		} else if (o.type === 'subclauses' && n.type === 'subclauses') {
			out.push({ type: 'subclauses', items: diffSubItems(o.items, n.items) });
		} else {
			out.push(...plainBlocks([o], 'removed'));
			out.push(...plainBlocks([n], 'added'));
		}
	}
	return out;
}

/** Append `.` to the last non-removed text segment (document order), `;` to the rest. */
function assignPunctuation(clause: RenderClause): void {
	const texts: RenderText[] = [];
	const walk = (blocks: RenderBlock[]) => {
		for (const b of blocks) {
			if (b.type === 'text') texts.push(b);
			else for (const item of b.items) walk(item.blocks);
		}
	};
	walk(clause.blocks);
	if (texts.length === 0) return;
	let terminal = -1;
	for (let i = texts.length - 1; i >= 0; i--) {
		if (texts[i].blockStatus !== 'removed') {
			terminal = i;
			break;
		}
	}
	if (terminal === -1) terminal = texts.length - 1;
	texts.forEach((t, i) => {
		t.punctuation = i === terminal ? '.' : ';';
	});
}

/** Render tree for a single clause without diff. */
export function buildRenderClause(clause: OperativeClause): RenderClause {
	const rc: RenderClause = { blocks: plainBlocks(clause.blocks, 'same') };
	assignPunctuation(rc);
	return rc;
}

/** Word-level diff render tree comparing an old vs. new clause. */
export function buildDiffRenderClause(
	oldClause: OperativeClause,
	newClause: OperativeClause
): RenderClause {
	const rc: RenderClause = { blocks: diffBlocks(oldClause.blocks, newClause.blocks) };
	assignPunctuation(rc);
	return rc;
}
