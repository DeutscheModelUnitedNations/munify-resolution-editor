import { describe, it, expect } from 'vitest';
import { isIdempotent, roundTrips, validate } from './validate';
import { serialize } from './serialize';
import { parse } from './parse';
import { structuralEqualResolution } from './equal';
import { PARSEABLE_CORPUS, CANONICAL_CORPUS } from './__fixtures__/fixtures';
import { makeResolution } from './__fixtures__/gen';

describe('idempotence (grammar §7.3)', () => {
	it('S(S(x)) === S(x) for the whole corpus', () => {
		for (const fixture of PARSEABLE_CORPUS) {
			expect(isIdempotent(fixture)).toBe(true);
		}
	});

	it('canonical fixtures validate', () => {
		for (const fixture of CANONICAL_CORPUS) {
			expect(validate(fixture).valid).toBe(true);
		}
	});

	it('the self-referential resolution validates', () => {
		const r = validate(PARSEABLE_CORPUS[4]);
		expect(r.valid).toBe(true);
	});
});

describe('round-trip (grammar §7.4) — generated resolutions', () => {
	it('parse(serialize(R)) is structurally equal to R for 200 seeds', () => {
		for (let seed = 1; seed <= 200; seed++) {
			const { resolution, header } = makeResolution(seed);
			expect(roundTrips(resolution, header)).toBe(true);
			// and the serialized form is itself idempotent
			const text = serialize(resolution, header);
			const back = parse(text);
			expect(serialize(back.resolution, back.header)).toBe(text);
			expect(structuralEqualResolution(resolution, back.resolution)).toBe(true);
		}
	});
});
