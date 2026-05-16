/**
 * RES-Markup canonical serializer (deterministic, idempotent).
 *
 * The wrap algorithm is a pure function of (content, prefixes) and the
 * prefixes are a deterministic function of structural depth, so
 * `serialize ∘ parse` is byte-stable (grammar.md §5).
 */

import {
	type OperativeClause,
	type Resolution,
	type ResolutionHeaderData,
	type SubClause
} from '../schema/resolution';

const WIDTH = 80;

/** Exact inverse of the tokenizer's single-leading-backslash strip. */
export function escapeLeading(s: string): string {
	if (s === '') return s;
	const c = s[0];
	if (
		c === '\\' ||
		c === '#' ||
		c === '[' ||
		c === '>' ||
		c === '-' ||
		c === '%' ||
		s.startsWith('==')
	) {
		return '\\' + s;
	}
	return s;
}

/**
 * Greedy word-wrap. `marker` includes its trailing space ('' for a
 * column-0 chapeau / headline). A token longer than the available width
 * is never split. Continuation lines (and marker-less first lines) get
 * `escapeLeading` so they never re-tokenize as a marker; marker-prefixed
 * first lines are safe because the parser captures their content after
 * the marker.
 */
function wrap(content: string, marker: string, indent: number): string[] {
	const firstPrefix = ' '.repeat(indent) + marker;
	const contPrefix = ' '.repeat(indent + marker.length);
	const words = content.length ? content.split(' ').filter((w) => w.length > 0) : [];
	const lines: string[] = [];
	let prefix = firstPrefix;
	let cur = '';
	const flush = () => {
		lines.push(prefix + cur);
		prefix = contPrefix;
		cur = '';
	};
	for (const w of words) {
		if (cur === '') {
			cur = w;
			continue;
		}
		if (prefix.length + cur.length + 1 + w.length <= WIDTH) {
			cur = `${cur} ${w}`;
		} else {
			flush();
			cur = w;
		}
	}
	flush();
	return lines.map((ln, idx) => {
		if (idx === 0 && marker !== '') return ln;
		const pfx = idx === 0 ? firstPrefix : contPrefix;
		return (pfx + escapeLeading(ln.slice(pfx.length))).replace(/[ \t]+$/, '');
	});
}

const FRONT_MATTER_ORDER: {
	key: string;
	get: (h: ResolutionHeaderData, c: string) => string | undefined;
}[] = [
	{ key: 'Conference', get: (h) => str(h.conferenceName) },
	{ key: 'ConferenceTitle', get: (h) => str(h.conferenceTitle) },
	{ key: 'Committee', get: (_h, c) => (c !== '' ? c : undefined) },
	{ key: 'CommitteeAbbreviation', get: (h) => str(h.committeeAbbreviation) },
	{ key: 'CommitteeFullName', get: (h) => str(h.committeeFullName) },
	{ key: 'DocumentNumber', get: (h) => str(h.documentNumber) },
	{ key: 'Topic', get: (h) => str(h.topic) },
	{ key: 'AuthoringDelegation', get: (h) => str(h.authoringDelegation) },
	{
		key: 'SponsoringDelegations',
		get: (h) =>
			h.sponsoringDelegations && h.sponsoringDelegations.length > 0
				? h.sponsoringDelegations.join(', ')
				: undefined
	},
	{
		key: 'LastEdited',
		get: (h) =>
			h.lastEdited === undefined
				? undefined
				: h.lastEdited instanceof Date
					? h.lastEdited.toISOString()
					: str(h.lastEdited)
	}
];

function str(v: string | undefined): string | undefined {
	return v !== undefined && v !== '' ? v : undefined;
}

function emitFrontMatter(header: ResolutionHeaderData, committeeName: string): string[] {
	const entries: { key: string; value: string }[] = [];
	for (const f of FRONT_MATTER_ORDER) {
		const v = f.get(header, committeeName);
		if (v !== undefined) entries.push({ key: f.key, value: v });
	}
	if (entries.length === 0) return [];
	const maxKeyLen = Math.max(...entries.map((e) => e.key.length));
	return entries.map((e) => `${e.key}:` + ' '.repeat(maxKeyLen + 1 - e.key.length) + e.value);
}

/** Clause body WITHOUT the leading `[CLAUSE]` line. */
function emitClauseBody(clause: OperativeClause | SubClause, depth: number): string[] {
	const blocks = clause.blocks;
	const out: string[] = [];
	const first = blocks[0];
	const chapeau = first && first.type === 'text' ? first.content : '';

	if (depth === 0) {
		out.push(...(chapeau === '' ? [''] : wrap(chapeau, '', 0)));
	} else {
		out.push(...wrap(chapeau, '-'.repeat(depth) + ' ', depth * 2));
	}

	for (let i = 1; i < blocks.length; i++) {
		const b = blocks[i];
		if (b.type === 'subclauses') {
			for (const item of b.items) out.push(...emitClauseBody(item, depth + 1));
		} else {
			const cm = '-'.repeat(depth) + '> ';
			const cin = depth === 0 ? 0 : depth * 2;
			out.push(...wrap(b.content, cm, cin));
		}
	}
	return out;
}

export function serialize(resolution: Resolution, header: ResolutionHeaderData = {}): string {
	const lines: string[] = [];
	lines.push('%RES 1.0');
	lines.push('');

	const fm = emitFrontMatter(header, resolution.committeeName);
	if (fm.length > 0) {
		lines.push(...fm);
		lines.push('');
	}

	lines.push('== Header ==');
	lines.push('');
	const headline = header.committeeResolutionHeadline;
	if (headline !== undefined && headline !== '') {
		lines.push(escapeLeading(headline) + ',');
		lines.push('');
	} else {
		lines.push('');
	}

	lines.push('== Preamble ==');
	lines.push('');
	for (const p of resolution.preamble) {
		lines.push(...wrap(p.content, '- ', 0));
		lines.push('');
	}

	lines.push('== Operative ==');
	lines.push('');
	for (const c of resolution.operative) {
		lines.push('[CLAUSE]');
		lines.push(...emitClauseBody(c, 0));
		lines.push('');
	}

	while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
	return lines.join('\n') + '\n';
}

export function serializeClause(clause: OperativeClause): string {
	return emitClauseBody(clause, 0).join('\n') + '\n';
}
