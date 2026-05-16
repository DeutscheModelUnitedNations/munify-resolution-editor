/**
 * RES-Markup validity (grammar.md §7).
 *
 * Stage 1 (syntax) and stage 2 (structural / Zod) gate the public result.
 * Stages 3 (idempotence) and 4 (round-trip) are guarantees of this
 * implementation, proven for ALL parseable inputs by the property tests
 * (`idempotence.test.ts`, `roundtrip.test.ts`); `isIdempotent` /
 * `roundTrips` are exported for those tests.
 */

import {
	MAX_SUBCLAUSE_DEPTH,
	ResolutionSchema,
	type OperativeClause,
	type Resolution,
	type ResolutionHeaderData,
	type SubClause
} from '../schema/resolution';
import { err, ResParseError, type ResError, type ResWarning } from './errors';
import { structuralEqualResolution } from './equal';
import { parse } from './parse';
import { serialize } from './serialize';

export type ValidateResult =
	| { valid: true; resolution: Resolution; header: ResolutionHeaderData; warnings: ResWarning[] }
	| { valid: false; errors: ResError[] };

function firstBlockIsTextAndDepthOk(clause: OperativeClause | SubClause, depth: number): boolean {
	if (depth > MAX_SUBCLAUSE_DEPTH) return false;
	if (!clause.blocks[0] || clause.blocks[0].type !== 'text') return false;
	for (const b of clause.blocks) {
		if (b.type === 'subclauses') {
			for (const item of b.items) {
				if (!firstBlockIsTextAndDepthOk(item, depth + 1)) return false;
			}
		}
	}
	return true;
}

export function validate(text: string): ValidateResult {
	let parsed;
	try {
		parsed = parse(text);
	} catch (e) {
		if (e instanceof ResParseError) return { valid: false, errors: [e.error] };
		throw e;
	}

	const schemaOk = ResolutionSchema.safeParse(parsed.resolution).success;
	const structureOk = parsed.resolution.operative.every((c) => firstBlockIsTextAndDepthOk(c, 0));
	if (!schemaOk || !structureOk) {
		return {
			valid: false,
			errors: [err('ERR_EMPTY_DOCUMENT', 1, 1, 'structural validation failed')]
		};
	}

	return {
		valid: true,
		resolution: parsed.resolution,
		header: parsed.header,
		warnings: parsed.warnings
	};
}

/** Stage 3: `S(S(x)) === S(x)` byte-identical, where `S = serialize ∘ parse`. */
export function isIdempotent(text: string): boolean {
	const once = canonical(text);
	const twice = canonical(once);
	return once === twice;
}

function canonical(text: string): string {
	const { resolution, header } = parse(text);
	return serialize(resolution, header);
}

/** Stage 4: `parse(serialize(R))` is structurally equal to `R`. */
export function roundTrips(resolution: Resolution, header: ResolutionHeaderData = {}): boolean {
	const text = serialize(resolution, header);
	const back = parse(text).resolution;
	return structuralEqualResolution(resolution, back);
}
