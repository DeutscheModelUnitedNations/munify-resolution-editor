/**
 * Typst serializer — converts a Resolution to a Typst source file (.typ).
 *
 * The output is a complete, self-contained Typst document that renders as a
 * properly formatted UN-style resolution PDF when compiled with Typst ≥ 0.12.
 *
 * Usage in a consuming app (server-side):
 *   import { resolutionToTypst } from '@deutschemodelunitednations/munify-resolution-editor/res-markup';
 *   import * as typst from 'typst';
 *   const source = resolutionToTypst(resolution, header);
 *   await typst.compile(inputPath, outputPath); // after writing source to inputPath
 */

import {
	type OperativeClause,
	type PreambleClause,
	type Resolution,
	type ResolutionHeaderData,
	type SubClause,
	getFirstTextContent,
	getSubClauseLabel,
	isClauseEmpty
} from '../schema/resolution';
import { unEmblemSvg } from '../assets/un-emblem';
import {
	FONT_SETUP,
	MUN_DISCLAIMER,
	PAGE_BASE_ARGS,
	THICK_RULE,
	THIN_RULE
} from './typst-snippets';

// ── Markup-context escaping ───────────────────────────────────────────────────

/**
 * Escapes user text for Typst markup context (inside #par[...], #emph[...] etc.).
 * Characters with special meaning in Typst markup are prefixed with a backslash.
 */
function escapeTypst(s: string): string {
	return s
		.replace(/\\/g, '\\\\')
		.replace(/\[/g, '\\[')
		.replace(/\]/g, '\\]')
		.replace(/#/g, '\\#')
		.replace(/@/g, '\\@')
		.replace(/_/g, '\\_')
		.replace(/\*/g, '\\*')
		.replace(/</g, '\\<')
		.replace(/>/g, '\\>')
		.replace(/\$/g, '\\$')
		.replace(/`/g, '\\`');
}

/**
 * Escapes a string for use inside a Typst string literal ("...").
 * Used when embedding SVG content via bytes("...").
 */
function escapeTypstString(s: string): string {
	return s
		.replace(/\\/g, '\\\\')
		.replace(/"/g, '\\"')
		.replace(/\r?\n/g, '\\n')
		.replace(/\t/g, '\\t');
}

// ── Text helpers ──────────────────────────────────────────────────────────────

/** Strips a single trailing punctuation character (,  ;  .  :) if present. */
function stripTrailingPunct(s: string): string {
	return s.replace(/[,;.:]\s*$/, '');
}

/** Splits text at the first whitespace boundary for italic-first-word rendering. */
function splitFirstWord(text: string): { first: string; rest: string } {
	const trimmed = text.trim();
	const idx = trimmed.search(/\s/);
	if (idx === -1) return { first: trimmed, rest: '' };
	return { first: trimmed.slice(0, idx), rest: trimmed.slice(idx) };
}

/** Formats a date value as "17 May 2026" (en-GB, fixed locale for determinism). */
function formatDate(date: Date | string | undefined): string {
	if (!date) return '';
	try {
		return new Date(date).toLocaleDateString('en-GB', {
			day: 'numeric',
			month: 'long',
			year: 'numeric'
		});
	} catch {
		return String(date);
	}
}

// ── Emblem helpers ────────────────────────────────────────────────────────────

/**
 * Attempts to decode an SVG data URL into a plain SVG string.
 * Supports both percent-encoded ("data:image/svg+xml,...") and
 * base64-encoded ("data:image/svg+xml;base64,...") variants.
 * Returns null if the input is not a recognised SVG data URL.
 */
function decodeEmblemDataUrl(dataUrl: string): string | null {
	const plainPrefix = 'data:image/svg+xml,';
	const b64Prefix = 'data:image/svg+xml;base64,';
	if (dataUrl.startsWith(plainPrefix)) {
		try {
			return decodeURIComponent(dataUrl.slice(plainPrefix.length));
		} catch {
			return null;
		}
	}
	if (dataUrl.startsWith(b64Prefix)) {
		try {
			return atob(dataUrl.slice(b64Prefix.length));
		} catch {
			return null;
		}
	}
	return null;
}

/**
 * Renders an SVG string as a Typst image.decode() call.
 * Requires Typst ≥ 0.12. The SVG is embedded inline via bytes("...").
 */
function svgToTypstImage(svg: string, width = '70pt', height = '70pt'): string {
	const escaped = escapeTypstString(svg);
	// image.decode with bytes requires Typst >= 0.12
	return `#image.decode(bytes("${escaped}"), format: "svg", width: ${width}, height: ${height})`;
}

// ── Document setup ────────────────────────────────────────────────────────────

function emitDocumentSetup(header: ResolutionHeaderData): string {
	const abbrev = header.committeeAbbreviation ?? '';
	const docNum = header.documentNumber ?? '';
	const runningHeader = [abbrev, docNum].filter(Boolean).map(escapeTypst).join('/');

	const pageArgs = [...PAGE_BASE_ARGS];
	if (runningHeader) {
		pageArgs.push(
			`  header: context if counter(page).get().first() > 1 [\n    #align(right)[#text(size: 9pt)[${runningHeader}]]\n  ]`
		);
	}

	return [`#set page(\n${pageArgs.join(',\n')},\n)`, FONT_SETUP].join('\n');
}

// ── Visible document header ───────────────────────────────────────────────────

function emitHeaderSection(header: ResolutionHeaderData, resolution: Resolution): string {
	const lines: string[] = [];

	// Row 1: conference title (left) | committee abbrev / doc number (right)
	const leftText = header.conferenceTitle ?? header.conferenceName ?? '';
	const abbrev = header.committeeAbbreviation ?? '';
	const docNum = header.documentNumber ?? '';

	if (leftText || abbrev || docNum) {
		const leftCell = `#text(size: 9pt)[${escapeTypst(leftText)}]`;
		const rightCell =
			abbrev && docNum
				? `#align(right)[#text(size: 16pt, weight: "bold")[${escapeTypst(abbrev)}]#text(size: 9pt)[/${escapeTypst(docNum)}]]`
				: abbrev
					? `#align(right)[#text(size: 16pt, weight: "bold")[${escapeTypst(abbrev)}]]`
					: `#align(right)[#text(size: 9pt)[${escapeTypst(docNum)}]]`;

		lines.push(`#grid(\n  columns: (1fr, auto),\n  [${leftCell}],\n  [${rightCell}]\n)`);
		lines.push('#v(4pt)');
		lines.push(THIN_RULE);
		lines.push('#v(6pt)');
	}

	// Row 2: emblem (left) | committee name (centre-left) | date (right)
	const svgContent = header.conferenceEmblem
		? (decodeEmblemDataUrl(header.conferenceEmblem) ?? unEmblemSvg)
		: unEmblemSvg;
	const emblemTypst = svgToTypstImage(svgContent);
	const committeeName = escapeTypst(header.committeeFullName ?? resolution.committeeName);
	const dateStr = escapeTypst(formatDate(header.lastEdited));

	lines.push(
		`#grid(\n  columns: (auto, 1fr, auto),\n  gutter: 8pt,\n  [${emblemTypst}],\n  [#align(horizon)[#text(size: 18pt, weight: "bold")[${committeeName}]]],\n  [#align(right + horizon)[#text(size: 9pt)[${dateStr}]]]\n)`
	);
	lines.push('#v(8pt)');

	// Authoring delegation
	if (header.authoringDelegation) {
		lines.push(
			`#grid(\n  columns: (auto, 1fr),\n  gutter: 6pt,\n  [#text(weight: "bold", size: 9pt)[AUTHORING DELEGATION]],\n  [#pad(left: 4pt)[${escapeTypst(header.authoringDelegation)}]]\n)`
		);
		lines.push('#v(4pt)');
	}

	// Sponsoring delegations
	if (header.sponsoringDelegations && header.sponsoringDelegations.length > 0) {
		const delegations = header.sponsoringDelegations.map(escapeTypst).join(', ');
		lines.push(
			`#grid(\n  columns: (auto, 1fr),\n  gutter: 6pt,\n  [#text(weight: "bold", size: 9pt)[SPONSORING DELEGATIONS]],\n  [#pad(left: 4pt)[${delegations}]]\n)`
		);
		lines.push('#v(4pt)');
	}

	lines.push(MUN_DISCLAIMER);
	lines.push('#v(6pt)');
	lines.push(THICK_RULE);

	return lines.join('\n');
}

// ── Body opening (topic + resolution headline) ────────────────────────────────

function emitBodyOpening(header: ResolutionHeaderData, resolution: Resolution): string {
	const lines: string[] = ['#v(12pt)'];

	if (header.topic) {
		lines.push(`#text(weight: "bold")[${escapeTypst(header.topic)}]`);
		lines.push('#v(6pt)');
	}

	const headline =
		header.committeeResolutionHeadline ??
		(header.committeeFullName ? `The ${header.committeeFullName}` : null) ??
		`The ${resolution.committeeName}`;

	lines.push(`#par[#emph[${escapeTypst(headline)},]]`);
	lines.push('#v(8pt)');

	return lines.join('\n');
}

// ── Preamble ──────────────────────────────────────────────────────────────────

function emitPreambleClauses(clauses: PreambleClause[]): string {
	const nonEmpty = clauses.filter((c) => c.content.trim());
	if (nonEmpty.length === 0) return '';

	const lines: string[] = [];
	for (const clause of nonEmpty) {
		const content = escapeTypst(stripTrailingPunct(clause.content.trim()));
		lines.push(`#par(first-line-indent: 1.5em)[#emph[${content},]]`);
		lines.push('');
	}

	return lines.join('\n');
}

// ── Operative clauses ─────────────────────────────────────────────────────────

function emitSubclauseList(items: SubClause[], depth: number, isLastInParent: boolean): string {
	const nonEmpty = items.filter((s) => !isClauseEmpty(s));
	if (nonEmpty.length === 0) return '';

	return nonEmpty
		.map((sub, i) => {
			const label = getSubClauseLabel(i, depth);
			const isLast = i === nonEmpty.length - 1;
			return emitSubClause(sub, label, depth, isLast && isLastInParent);
		})
		.join('\n');
}

function emitSubClause(
	sub: SubClause,
	label: string,
	depth: number,
	isLastInParent: boolean
): string {
	const indentEm = depth * 1.5;
	const lines: string[] = [];
	const blocks = sub.blocks;
	const firstContent = escapeTypst(stripTrailingPunct(getFirstTextContent(sub).trim()));
	const isOnlyBlock = blocks.length === 1;
	const endPunct = isOnlyBlock && isLastInParent ? '.' : ';';

	lines.push(`#pad(left: ${indentEm}em)[#par[${escapeTypst(label)} ${firstContent}${endPunct}]]`);

	for (let i = 1; i < blocks.length; i++) {
		const b = blocks[i];
		const isLastBlock = i === blocks.length - 1;
		if (b.type === 'subclauses') {
			const nested = emitSubclauseList(b.items, depth + 1, isLastBlock && isLastInParent);
			if (nested) lines.push(nested);
		} else {
			const content = escapeTypst(stripTrailingPunct(b.content.trim()));
			const punct = isLastBlock && isLastInParent ? '.' : ';';
			lines.push(`#pad(left: ${indentEm}em)[#par[${content}${punct}]]`);
		}
	}

	return lines.join('\n');
}

function emitTopLevelClause(clause: OperativeClause, number: number, isLast: boolean): string {
	const lines: string[] = [];
	const blocks = clause.blocks;
	const firstContent = stripTrailingPunct(getFirstTextContent(clause).trim());
	const isOnlyBlock = blocks.length === 1;
	const endPunct = isOnlyBlock && isLast ? '.' : ';';
	const { first, rest } = splitFirstWord(firstContent);

	lines.push(
		`#par(first-line-indent: 1.5em)[*${number}.* #emph[${escapeTypst(first)}]${escapeTypst(rest)}${endPunct}]`
	);

	for (let i = 1; i < blocks.length; i++) {
		const b = blocks[i];
		const isLastBlock = i === blocks.length - 1;
		if (b.type === 'subclauses') {
			const subclauses = emitSubclauseList(b.items, 1, isLastBlock && isLast);
			if (subclauses) lines.push(subclauses);
		} else {
			const content = escapeTypst(stripTrailingPunct(b.content.trim()));
			const punct = isLastBlock && isLast ? '.' : ';';
			lines.push(`#pad(left: 1.5em)[#par[${content}${punct}]]`);
		}
	}

	return lines.join('\n');
}

function emitOperativeClauses(clauses: OperativeClause[]): string {
	const nonEmpty = clauses.filter((c) => !isClauseEmpty(c));
	if (nonEmpty.length === 0) return '';

	const lines: string[] = ['#v(12pt)', ''];
	for (let i = 0; i < nonEmpty.length; i++) {
		lines.push(emitTopLevelClause(nonEmpty[i], i + 1, i === nonEmpty.length - 1));
		if (i < nonEmpty.length - 1) lines.push('#v(4pt)');
		lines.push('');
	}

	return lines.join('\n');
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Serializes a Resolution to a Typst source document (.typ).
 *
 * The resulting string is a complete Typst file ready to be compiled with
 * `typst compile`. All header fields are optional; missing fields are omitted
 * from the output gracefully.
 *
 * Note: SVG emblem embedding via image.decode() requires Typst ≥ 0.12.
 */
export function resolutionToTypst(
	resolution: Resolution,
	header: ResolutionHeaderData = {}
): string {
	const parts: string[] = [];

	parts.push(emitDocumentSetup(header));
	parts.push('');
	parts.push(emitHeaderSection(header, resolution));
	parts.push(emitBodyOpening(header, resolution));
	parts.push('');

	const preamble = emitPreambleClauses(resolution.preamble);
	if (preamble) parts.push(preamble);

	const operative = emitOperativeClauses(resolution.operative);
	if (operative) parts.push(operative);

	while (parts.length > 0 && parts[parts.length - 1] === '') parts.pop();
	return parts.join('\n') + '\n';
}
