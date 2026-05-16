/**
 * Lexing for RES-Markup.
 *
 * Pipeline: normalizeNewlines -> stripComments (keeps a source-line map)
 * -> tokenize (one token per kept line) -> joinLogicalLines (fold
 * continuation lines, drop blanks).
 *
 * Structure is marker-determined; indentation is non-significant and is
 * discarded here. See grammar.md §2.
 */

export type TokenKind =
	| 'version'
	| 'kv'
	| 'section'
	| 'clause'
	| 'subclause'
	| 'closing'
	| 'text'
	| 'blank';

export interface Token {
	kind: TokenKind;
	/** 1-based original source line. */
	line: number;
	/** 1-based column of the first non-whitespace character. */
	column: number;
	content: string;
	/** hyphen-run length for `subclause` (>=1) and `closing` (0..3). */
	depth: number;
	major?: number;
	minor?: number;
	sectionName?: string;
	key?: string;
	value?: string;
}

export type LogicalKind = Exclude<TokenKind, 'blank'>;

export interface LogicalToken {
	kind: LogicalKind;
	line: number;
	column: number;
	content: string;
	depth: number;
	major?: number;
	minor?: number;
	sectionName?: string;
	key?: string;
	value?: string;
}

export interface LineMap {
	/** kept lines, trailing whitespace already stripped */
	lines: string[];
	/** srcLineNo[i] = 1-based original line number of lines[i] */
	srcLineNo: number[];
}

export function normalizeNewlines(text: string): string {
	return text.replace(/\r\n?/g, '\n');
}

/** Drop full-line `#` comments; remember original line numbers. */
export function stripComments(text: string): LineMap {
	const raw = normalizeNewlines(text).split('\n');
	const lines: string[] = [];
	const srcLineNo: number[] = [];
	for (let i = 0; i < raw.length; i++) {
		const line = raw[i].replace(/[ \t]+$/, '');
		if (/^\s*#/.test(line)) continue; // transparent: neither blank nor content
		lines.push(line);
		srcLineNo.push(i + 1);
	}
	return { lines, srcLineNo };
}

const RE_VERSION = /^%res (\d+)\.(\d+)$/i;
const RE_SECTION = /^==\s*(.+?)\s*==$/;
const RE_CLAUSE = /^\[\s*clause\s*\]$/i;
const RE_CLOSING = /^(-{0,3})>\s+(\S.*)$/;
const RE_SUBITEM = /^(-+)\s+(\S.*)$/;
const RE_KV = /^([A-Za-z][A-Za-z0-9]*)\s*:\s?(.*)$/;

/** Markers a content line must be `\`-escaped to start with literally. */
function startsLikeMarker(s: string): boolean {
	return (
		s.startsWith('#') ||
		s.startsWith('[') ||
		s.startsWith('>') ||
		s.startsWith('-') ||
		s.startsWith('%') ||
		s.startsWith('==')
	);
}

export function tokenize(map: LineMap): Token[] {
	const tokens: Token[] = [];
	for (let i = 0; i < map.lines.length; i++) {
		const srcLine = map.srcLineNo[i];
		const original = map.lines[i];
		const lead = original.length - original.replace(/^[ \t]+/, '').length;
		const column = lead + 1;
		let body = original.slice(lead);

		if (body === '') {
			tokens.push({ kind: 'blank', line: srcLine, column, content: '', depth: 0 });
			continue;
		}

		// Escaping: one leading backslash is removed and the line is forced
		// to plain text (its exact inverse lives in serialize.escapeLeading).
		if (body[0] === '\\') {
			body = body.slice(1);
			tokens.push({ kind: 'text', line: srcLine, column, content: body, depth: 0 });
			continue;
		}

		let m: RegExpMatchArray | null;

		if ((m = body.match(RE_VERSION))) {
			tokens.push({
				kind: 'version',
				line: srcLine,
				column,
				content: body,
				depth: 0,
				major: Number(m[1]),
				minor: Number(m[2])
			});
			continue;
		}
		if ((m = body.match(RE_SECTION))) {
			tokens.push({
				kind: 'section',
				line: srcLine,
				column,
				content: body,
				depth: 0,
				sectionName: m[1].trim().toLowerCase()
			});
			continue;
		}
		if (RE_CLAUSE.test(body)) {
			tokens.push({ kind: 'clause', line: srcLine, column, content: '', depth: 0 });
			continue;
		}
		if ((m = body.match(RE_CLOSING))) {
			tokens.push({
				kind: 'closing',
				line: srcLine,
				column,
				content: m[2],
				depth: m[1].length
			});
			continue;
		}
		if ((m = body.match(RE_SUBITEM))) {
			tokens.push({
				kind: 'subclause',
				line: srcLine,
				column,
				content: m[2],
				depth: m[1].length
			});
			continue;
		}
		if ((m = body.match(RE_KV))) {
			tokens.push({
				kind: 'kv',
				line: srcLine,
				column,
				content: body,
				depth: 0,
				key: m[1],
				value: m[2]
			});
			continue;
		}

		tokens.push({ kind: 'text', line: srcLine, column, content: body, depth: 0 });
	}
	return tokens;
}

const ABSORBING: ReadonlySet<TokenKind> = new Set(['subclause', 'closing', 'text']);

/**
 * Fold continuation lines into their starter (single-space join) and drop
 * blanks. `version`, `section`, `clause` never absorb; a blank ends the
 * current logical line.
 */
export function joinLogicalLines(tokens: Token[]): LogicalToken[] {
	const out: LogicalToken[] = [];
	let cur: LogicalToken | null = null;

	const flush = () => {
		if (cur) {
			out.push(cur);
			cur = null;
		}
	};

	for (const t of tokens) {
		if (t.kind === 'blank') {
			flush();
			continue;
		}
		if (cur && t.kind === 'text' && ABSORBING.has(cur.kind)) {
			cur.content = cur.content === '' ? t.content : `${cur.content} ${t.content}`;
			continue;
		}
		flush();
		cur = {
			kind: t.kind,
			line: t.line,
			column: t.column,
			content: t.content,
			depth: t.depth,
			major: t.major,
			minor: t.minor,
			sectionName: t.sectionName,
			key: t.key,
			value: t.value
		};
		if (t.kind === 'version' || t.kind === 'kv' || t.kind === 'section' || t.kind === 'clause') {
			flush();
		}
	}
	flush();
	return out;
}

export { startsLikeMarker };
