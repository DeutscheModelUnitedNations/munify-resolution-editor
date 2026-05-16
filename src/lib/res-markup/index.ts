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
