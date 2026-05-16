import { describe, it, expect } from 'vitest';
import { parse } from './parse';
import { serialize, serializeClause, escapeLeading } from './serialize';
import { LENIENT_CANONICAL, LENIENT_INPUT, MINIMAL } from './__fixtures__/fixtures';

describe('serialize — canonical output', () => {
	it('round-trips the minimal canonical fixture byte-identically', () => {
		const { resolution, header } = parse(MINIMAL);
		expect(serialize(resolution, header)).toBe(MINIMAL);
	});

	it('turns lenient input into the documented canonical form (grammar §8.3)', () => {
		const { resolution, header } = parse(LENIENT_INPUT);
		expect(serialize(resolution, header)).toBe(LENIENT_CANONICAL);
	});

	it('always emits all three sections even when empty', () => {
		const out = serialize({
			committeeName: 'X',
			preamble: [],
			operative: [{ id: 'o1', blocks: [{ type: 'text', id: 't', content: 'do it;' }] }]
		});
		expect(out).toContain('== Header ==');
		expect(out).toContain('== Preamble ==');
		expect(out).toContain('== Operative ==');
	});

	it('re-appends exactly one headline comma', () => {
		const out = serialize(
			{ committeeName: 'X', preamble: [], operative: [] },
			{ committeeResolutionHeadline: 'THE COUNCIL' }
		);
		expect(out).toContain('\nTHE COUNCIL,\n');
		expect(out).not.toContain('THE COUNCIL,,');
	});

	it('wraps long content at 80 columns deterministically', () => {
		const long = Array.from({ length: 40 }, (_, i) => `word${i}`).join(' ');
		const out = serialize({
			committeeName: 'X',
			preamble: [{ id: 'p', content: long }],
			operative: []
		});
		const wrapped = out.split('\n').filter((l) => l.startsWith('- ') || l.startsWith('  word'));
		expect(wrapped.length).toBeGreaterThan(1);
		for (const l of out.split('\n')) expect(l.length).toBeLessThanOrEqual(80 + 1);
	});

	it('escapeLeading is the inverse of the parser backslash strip', () => {
		expect(escapeLeading('- not a marker')).toBe('\\- not a marker');
		expect(escapeLeading('\\x')).toBe('\\\\x');
		expect(escapeLeading('Normal prose')).toBe('Normal prose');
	});

	it('serializeClause emits a clause body without [CLAUSE]', () => {
		const { resolution } = parse(MINIMAL);
		const s = serializeClause(resolution.operative[0]);
		expect(s).not.toContain('[CLAUSE]');
		expect(s.trim()).toBe('Calls upon all Member States to honour their obligations;');
	});
});
