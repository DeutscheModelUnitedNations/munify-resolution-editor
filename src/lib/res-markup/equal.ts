/**
 * Structural equality helpers (IDs stripped, blocks cleaned).
 *
 * Used by `validate` (round-trip stage) and by tests. The round-trip
 * contract (grammar.md §7.4) is "structurally equal modulo IDs, with
 * cleanupBlocks applied on both sides".
 */

import {
	cleanupBlocks,
	type ClauseBlock,
	type OperativeClause,
	type Resolution,
	type ResolutionHeaderData,
	type SubClause
} from '../schema/resolution';

type IdlessBlock =
	| { type: 'text'; content: string }
	| { type: 'subclauses'; items: IdlessClause[] };

interface IdlessClause {
	blocks: IdlessBlock[];
}

interface IdlessResolution {
	committeeName: string;
	preamble: string[];
	operative: IdlessClause[];
}

function cleanClause<T extends OperativeClause | SubClause>(clause: T): IdlessClause {
	const blocks = cleanupBlocks(clause.blocks.map(cleanBlockChildren));
	return { blocks: blocks.map(toIdlessBlock) };
}

function cleanBlockChildren(block: ClauseBlock): ClauseBlock {
	if (block.type === 'subclauses') {
		return {
			...block,
			items: block.items.map((item) => ({
				...item,
				blocks: cleanupBlocks(item.blocks.map(cleanBlockChildren))
			}))
		};
	}
	return block;
}

function toIdlessBlock(block: ClauseBlock): IdlessBlock {
	if (block.type === 'text') {
		return { type: 'text', content: block.content };
	}
	return { type: 'subclauses', items: block.items.map(cleanClause) };
}

export function stripResolution(resolution: Resolution): IdlessResolution {
	return {
		committeeName: resolution.committeeName,
		preamble: resolution.preamble.map((p) => p.content),
		operative: resolution.operative.map(cleanClause)
	};
}

export function stripClause(clause: OperativeClause): IdlessClause {
	return cleanClause(clause);
}

export function structuralEqualResolution(a: Resolution, b: Resolution): boolean {
	return JSON.stringify(stripResolution(a)) === JSON.stringify(stripResolution(b));
}

export function structuralEqualClause(a: OperativeClause, b: OperativeClause): boolean {
	return JSON.stringify(stripClause(a)) === JSON.stringify(stripClause(b));
}

/** Header fields that participate in the RES-Markup interchange. */
export function relevantHeader(header: ResolutionHeaderData): ResolutionHeaderData {
	const out: ResolutionHeaderData = {};
	const keys: (keyof ResolutionHeaderData)[] = [
		'conferenceName',
		'conferenceTitle',
		'committeeAbbreviation',
		'committeeFullName',
		'committeeResolutionHeadline',
		'documentNumber',
		'topic',
		'authoringDelegation',
		'sponsoringDelegations',
		'lastEdited'
	];
	for (const k of keys) {
		const v = header[k];
		if (v !== undefined && v !== '') {
			// @ts-expect-error indexed assignment across heterogeneous union
			out[k] = v;
		}
	}
	return out;
}
