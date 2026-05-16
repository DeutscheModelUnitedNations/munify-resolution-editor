/**
 * RES-Markup error & warning model.
 *
 * `line` is always the 1-based ORIGINAL source line (the comment pre-pass
 * keeps a source-line map, so diagnostics point at the user's file even
 * with a banner above `%RES` or interspersed comments). `column` is
 * 1-based; 1 when not meaningful.
 *
 * See grammar.md §7 for the authoritative catalog.
 */

export type ResErrorCode =
	| 'ERR_MISSING_HEADER'
	| 'ERR_UNSUPPORTED_VERSION'
	| 'ERR_UNKNOWN_SECTION'
	| 'ERR_BAD_FRONTMATTER'
	| 'ERR_DEPTH_EXCEEDED'
	| 'ERR_DEPTH_SKIP'
	| 'ERR_PREAMBLE_NESTING'
	| 'ERR_CLAUSE_OUTSIDE_OPERATIVE'
	| 'ERR_ORPHAN_TAIL'
	| 'ERR_EMPTY_DOCUMENT';

export type ResWarningCode =
	| 'WARN_EMPTY_CHAPEAU'
	| 'WARN_EMPTY_HEADER'
	| 'WARN_MISSING_COMMITTEE'
	| 'WARN_UNKNOWN_KEY'
	| 'WARN_EMPTY_SECTION';

export interface ResError {
	code: ResErrorCode;
	line: number;
	column: number;
	message: string;
}

export interface ResWarning {
	code: ResWarningCode;
	line: number;
	column: number;
	message: string;
}

const ERROR_MESSAGES: Record<ResErrorCode, string> = {
	ERR_MISSING_HEADER: 'Expected the file to start with "%RES <version>"',
	ERR_UNSUPPORTED_VERSION: 'Unsupported RES-Markup version',
	ERR_UNKNOWN_SECTION: 'Unknown section heading (expected Header, Preamble or Operative)',
	ERR_BAD_FRONTMATTER: 'Front-matter line is neither "Key: Value" nor blank',
	ERR_DEPTH_EXCEEDED: 'Sub-clause nesting deeper than the maximum of 4',
	ERR_DEPTH_SKIP: 'Sub-clause depth jumped more than one level',
	ERR_PREAMBLE_NESTING: 'Preamble clauses must be flat single "- " items',
	ERR_CLAUSE_OUTSIDE_OPERATIVE: '[CLAUSE] is only allowed in the Operative section',
	ERR_ORPHAN_TAIL: 'Closing-text marker has no open clause at its depth',
	ERR_EMPTY_DOCUMENT: 'Document has neither preamble nor operative clauses'
};

const WARNING_MESSAGES: Record<ResWarningCode, string> = {
	WARN_EMPTY_CHAPEAU: 'Clause has no chapeau text',
	WARN_EMPTY_HEADER: '"== Header ==" section is empty',
	WARN_MISSING_COMMITTEE: 'No "Committee:" key; committeeName defaults to ""',
	WARN_UNKNOWN_KEY: 'Unknown front-matter key (ignored)',
	WARN_EMPTY_SECTION: 'Section has no clauses'
};

export function err(code: ResErrorCode, line: number, column: number, detail?: string): ResError {
	const base = ERROR_MESSAGES[code];
	return { code, line, column, message: detail ? `${base}: ${detail}` : base };
}

export function warn(
	code: ResWarningCode,
	line: number,
	column: number,
	detail?: string
): ResWarning {
	const base = WARNING_MESSAGES[code];
	return { code, line, column, message: detail ? `${base}: ${detail}` : base };
}

/** Thrown by `parse`/`parseClauseFragment` internals on any `ERR_*`. */
export class ResParseError extends Error {
	readonly error: ResError;
	constructor(error: ResError) {
		super(error.message);
		this.name = 'ResParseError';
		this.error = error;
	}
}
