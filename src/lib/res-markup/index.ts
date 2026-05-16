/**
 * RES-Markup — plain-text resolution interchange format.
 *
 * Public API (grammar.md §10). Depends only on `../schema/resolution`;
 * no Svelte / store / Y.js imports, so this module stays extractable as
 * a standalone package.
 */

export { parse, parseClauseFragment, type ParseResult } from './parse';
export { serialize, serializeClause } from './serialize';
export { validate, isIdempotent, roundTrips, type ValidateResult } from './validate';
export { type ResError, type ResWarning, type ResErrorCode, type ResWarningCode } from './errors';

export const RES_VERSION = '1.0';

/**
 * Canonical file extension for exported resolutions. `.res.txt` keeps the
 * file openable as plain text everywhere (editors, mail, OS preview) while
 * still self-identifying as RES-Markup — preferred over a bare `.res`
 * (collides with resource files and is treated as unknown/binary by many
 * tools) or an obscure `.unres`.
 */
export const RES_FILE_EXTENSION = '.res.txt';

/** Best-effort, filesystem-safe base name for an exported resolution. */
export function suggestResolutionFilename(
	documentNumber: string | undefined,
	committeeName: string | undefined
): string {
	const base = (documentNumber || committeeName || 'resolution')
		.normalize('NFKD')
		.replace(/[^A-Za-z0-9._-]+/g, '_')
		.replace(/^[_.]+|[_.]+$/g, '');
	return (base || 'resolution') + RES_FILE_EXTENSION;
}
