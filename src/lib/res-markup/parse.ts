/**
 * RES-Markup parser.
 *
 * `parse` throws `ResParseError` on any `ERR_*`; `validate` (validate.ts)
 * wraps it into the public discriminated union. IDs are freshly minted;
 * `serialize` never emits them. See grammar.md §3–§4, §6.
 */

import {
	cleanupBlocks,
	createSubclausesBlock,
	createTextBlock,
	generateClauseId,
	generateSubClauseId,
	MAX_SUBCLAUSE_DEPTH,
	type ClauseBlock,
	type OperativeClause,
	type PreambleClause,
	type Resolution,
	type ResolutionHeaderData,
	type SubClause,
	type SubclausesBlock
} from '../schema/resolution';
import { err, ResParseError, warn, type ResError, type ResWarning } from './errors';
import { joinLogicalLines, stripComments, tokenize, type LogicalToken } from './tokenize';

export interface ParseResult {
	resolution: Resolution;
	header: ResolutionHeaderData;
	warnings: ResWarning[];
}

const RE_STRAY_ORDINAL =
	/^(?:\((?:\d{1,4}|[A-Za-z]{1,4}|[ivxlcdmIVXLCDM]+)\)|\d{1,4}[.)]|[A-Za-z]{1,3}\))\s+(?=\S)/;

/** Drop a single leading hand-typed ordinal (`1.`, `(a)`, `b)`, `(iii)`). */
export function stripStrayOrdinal(s: string): string {
	return s.replace(RE_STRAY_ORDINAL, '');
}

type Frame = OperativeClause | SubClause;

class Parser {
	private lt: LogicalToken[];
	private i = 0;
	readonly warnings: ResWarning[] = [];

	constructor(text: string) {
		this.lt = joinLogicalLines(tokenize(stripComments(text)));
	}

	private peek(): LogicalToken | undefined {
		return this.lt[this.i];
	}

	private adv(): LogicalToken {
		return this.lt[this.i++];
	}

	// ---- full document -----------------------------------------------------

	parseDocument(): ParseResult {
		const first = this.lt[0];
		if (!first || first.kind !== 'version') {
			throw new ResParseError(err('ERR_MISSING_HEADER', first?.line ?? 1, first?.column ?? 1));
		}
		if (first.major !== 1) {
			throw new ResParseError(
				err('ERR_UNSUPPORTED_VERSION', first.line, first.column, `${first.major}.${first.minor}`)
			);
		}
		this.i = 1;

		const header: ResolutionHeaderData = {};
		let committeeName = '';
		let sawCommittee = false;

		while (this.peek() && this.peek()!.kind !== 'section') {
			const t = this.adv();
			if (t.kind !== 'kv') {
				throw new ResParseError(err('ERR_BAD_FRONTMATTER', t.line, t.column));
			}
			const key = (t.key ?? '').toLowerCase();
			const value = (t.value ?? '').trim();
			switch (key) {
				case 'conference':
					header.conferenceName = value;
					break;
				case 'conferencetitle':
					header.conferenceTitle = value;
					break;
				case 'committee':
					committeeName = value;
					sawCommittee = true;
					break;
				case 'committeeabbreviation':
					header.committeeAbbreviation = value;
					break;
				case 'committeefullname':
					header.committeeFullName = value;
					break;
				case 'documentnumber':
					header.documentNumber = value;
					break;
				case 'topic':
					header.topic = value;
					break;
				case 'authoringdelegation':
					header.authoringDelegation = value;
					break;
				case 'sponsoringdelegations':
					header.sponsoringDelegations = value
						.split(',')
						.map((s) => s.trim())
						.filter((s) => s.length > 0);
					break;
				case 'lastedited':
					header.lastEdited = value;
					break;
				default:
					this.warnings.push(warn('WARN_UNKNOWN_KEY', t.line, t.column, t.key));
			}
		}
		if (!sawCommittee) {
			this.warnings.push(warn('WARN_MISSING_COMMITTEE', first.line, first.column));
		}

		// Past front-matter, a "Key: Value"-looking line is ordinary prose.
		for (let j = this.i; j < this.lt.length; j++) {
			if (this.lt[j].kind === 'kv') {
				this.lt[j] = { ...this.lt[j], kind: 'text' };
			}
		}

		const preamble: PreambleClause[] = [];
		const operative: OperativeClause[] = [];

		while (this.peek()) {
			const sec = this.peek()!;
			if (sec.kind !== 'section') {
				if (sec.kind === 'clause') {
					throw new ResParseError(err('ERR_CLAUSE_OUTSIDE_OPERATIVE', sec.line, sec.column));
				}
				throw new ResParseError(err('ERR_UNKNOWN_SECTION', sec.line, sec.column));
			}
			this.adv();
			const name = sec.sectionName;

			if (name === 'header') {
				this.parseHeaderSection(sec, header);
			} else if (name === 'preamble') {
				this.parsePreambleSection(sec, preamble);
			} else if (name === 'operative') {
				this.parseOperativeSection(sec, operative);
			} else {
				throw new ResParseError(err('ERR_UNKNOWN_SECTION', sec.line, sec.column, sec.content));
			}
		}

		if (preamble.length === 0 && operative.length === 0) {
			throw new ResParseError(err('ERR_EMPTY_DOCUMENT', first.line, first.column));
		}

		return { resolution: { committeeName, preamble, operative }, header, warnings: this.warnings };
	}

	private parseHeaderSection(sec: LogicalToken, header: ResolutionHeaderData): void {
		const pieces: string[] = [];
		while (this.peek() && this.peek()!.kind !== 'section') {
			const t = this.peek()!;
			if (t.kind === 'text') {
				pieces.push(t.content);
				this.adv();
			} else if (t.kind === 'clause') {
				throw new ResParseError(err('ERR_CLAUSE_OUTSIDE_OPERATIVE', t.line, t.column));
			} else {
				break;
			}
		}
		const joined = pieces.join(' ').trim();
		if (joined === '') {
			this.warnings.push(warn('WARN_EMPTY_HEADER', sec.line, sec.column));
			return;
		}
		const trimmed = joined.replace(/,$/, '').trimEnd();
		header.committeeResolutionHeadline = trimmed;
	}

	private parsePreambleSection(sec: LogicalToken, preamble: PreambleClause[]): void {
		while (this.peek() && this.peek()!.kind !== 'section') {
			const t = this.peek()!;
			if (t.kind === 'subclause') {
				if (t.depth !== 1) {
					throw new ResParseError(err('ERR_PREAMBLE_NESTING', t.line, t.column));
				}
				preamble.push({
					id: generateClauseId('p'),
					content: stripStrayOrdinal(t.content)
				});
				this.adv();
			} else if (t.kind === 'text') {
				// lenient: a flat line without "- " still becomes a clause
				preamble.push({
					id: generateClauseId('p'),
					content: stripStrayOrdinal(t.content)
				});
				this.adv();
			} else if (t.kind === 'closing') {
				throw new ResParseError(err('ERR_PREAMBLE_NESTING', t.line, t.column));
			} else if (t.kind === 'clause') {
				throw new ResParseError(err('ERR_CLAUSE_OUTSIDE_OPERATIVE', t.line, t.column));
			} else {
				break;
			}
		}
		if (preamble.length === 0) {
			this.warnings.push(warn('WARN_EMPTY_SECTION', sec.line, sec.column));
		}
	}

	private parseOperativeSection(sec: LogicalToken, operative: OperativeClause[]): void {
		while (this.peek() && this.peek()!.kind !== 'section') {
			const t = this.peek()!;
			if (t.kind === 'clause') {
				this.adv();
				operative.push(this.buildClause(true));
			} else if (t.kind === 'subclause' || t.kind === 'text') {
				// lenient: an operative paragraph written without [CLAUSE]
				operative.push(this.buildClause(false));
			} else if (t.kind === 'closing') {
				throw new ResParseError(err('ERR_ORPHAN_TAIL', t.line, t.column));
			} else {
				break;
			}
		}
		if (operative.length === 0) {
			this.warnings.push(warn('WARN_EMPTY_SECTION', sec.line, sec.column));
		}
	}

	// ---- one clause --------------------------------------------------------

	private buildClause(explicit: boolean): OperativeClause {
		const op: OperativeClause = { id: generateClauseId('o'), blocks: [] };
		const frames: Frame[] = [op];

		const t0 = this.peek();
		let chapeau = '';
		let chapeauEmpty = true;
		if (t0 && t0.kind === 'text') {
			chapeau = stripStrayOrdinal(t0.content);
			chapeauEmpty = chapeau.trim() === '';
			this.adv();
		}
		op.blocks.push(createTextBlock(chapeau));
		if (chapeauEmpty) {
			const at = t0 ?? this.lt[this.i - 1];
			this.warnings.push(warn('WARN_EMPTY_CHAPEAU', at?.line ?? 1, at?.column ?? 1));
		}
		void explicit;

		for (;;) {
			const t = this.peek();
			if (!t || t.kind === 'clause' || t.kind === 'section') break;

			if (t.kind === 'text') {
				const deepest = frames[frames.length - 1];
				deepest.blocks.push(createTextBlock(stripStrayOrdinal(t.content)));
				this.adv();
				continue;
			}

			if (t.kind === 'subclause') {
				const k = t.depth;
				const cur = frames.length - 1;
				if (k > MAX_SUBCLAUSE_DEPTH) {
					throw new ResParseError(err('ERR_DEPTH_EXCEEDED', t.line, t.column));
				}
				if (k > cur + 1) {
					throw new ResParseError(err('ERR_DEPTH_SKIP', t.line, t.column));
				}
				while (frames.length - 1 >= k) frames.pop();
				const parent = frames[frames.length - 1];
				let sb = parent.blocks[parent.blocks.length - 1];
				if (!sb || sb.type !== 'subclauses') {
					sb = createSubclausesBlock([]);
					parent.blocks.push(sb);
				}
				const ns: SubClause = {
					id: generateSubClauseId(),
					blocks: [createTextBlock(stripStrayOrdinal(t.content))]
				};
				(sb as SubclausesBlock).items.push(ns);
				frames.push(ns);
				this.adv();
				continue;
			}

			if (t.kind === 'closing') {
				const d = t.depth;
				if (d > frames.length - 1) {
					throw new ResParseError(err('ERR_ORPHAN_TAIL', t.line, t.column));
				}
				while (frames.length - 1 > d) frames.pop();
				frames[d].blocks.push(createTextBlock(stripStrayOrdinal(t.content)));
				this.adv();
				continue;
			}

			break;
		}

		cleanupClauseDeep(op);
		return op;
	}

	parseFragment(): OperativeClause {
		for (let j = 0; j < this.lt.length; j++) {
			if (this.lt[j].kind === 'kv') {
				this.lt[j] = { ...this.lt[j], kind: 'text' };
			}
		}
		const t0 = this.peek();
		if (t0 && t0.kind === 'clause') {
			this.adv(); // accept and ignore a leading [CLAUSE]
			return this.buildClause(true);
		}
		return this.buildClause(false);
	}
}

function cleanupClauseDeep(clause: OperativeClause | SubClause): void {
	for (const block of clause.blocks) {
		if (block.type === 'subclauses') {
			for (const item of block.items) cleanupClauseDeep(item);
		}
	}
	clause.blocks = cleanupBlocks(clause.blocks) as ClauseBlock[];
}

export function parse(text: string): ParseResult {
	return new Parser(text).parseDocument();
}

export function parseClauseFragment(
	text: string
):
	| { valid: true; clause: OperativeClause; warnings: ResWarning[] }
	| { valid: false; errors: ResError[] } {
	try {
		const p = new Parser(text);
		const clause = p.parseFragment();
		return { valid: true, clause, warnings: p.warnings };
	} catch (e) {
		if (e instanceof ResParseError) {
			return { valid: false, errors: [e.error] };
		}
		throw e;
	}
}
