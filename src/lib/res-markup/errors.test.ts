import { describe, it, expect } from 'vitest';
import { parse } from './parse';
import { validate } from './validate';

function code(text: string): string {
	const r = validate(text);
	if (r.valid) throw new Error('expected invalid');
	return r.errors[0].code;
}

describe('error catalog (grammar §7)', () => {
	it('ERR_MISSING_HEADER', () => {
		expect(code('Committee: X\n== Operative ==\n[CLAUSE]\nfoo;')).toBe('ERR_MISSING_HEADER');
	});

	it('ERR_UNSUPPORTED_VERSION', () => {
		expect(code('%RES 2.0\n== Operative ==\n[CLAUSE]\nfoo;')).toBe('ERR_UNSUPPORTED_VERSION');
	});

	it('ERR_BAD_FRONTMATTER', () => {
		expect(code('%RES 1.0\nnot a kv line\n== Operative ==\n[CLAUSE]\nx;')).toBe(
			'ERR_BAD_FRONTMATTER'
		);
	});

	it('ERR_UNKNOWN_SECTION', () => {
		expect(code('%RES 1.0\n== Nonsense ==\n[CLAUSE]\nx;')).toBe('ERR_UNKNOWN_SECTION');
	});

	it('ERR_DEPTH_EXCEEDED', () => {
		expect(code('%RES 1.0\n== Operative ==\n[CLAUSE]\nc\n- a\n-- b\n--- d\n---- e\n----- f;')).toBe(
			'ERR_DEPTH_EXCEEDED'
		);
	});

	it('ERR_DEPTH_SKIP', () => {
		expect(code('%RES 1.0\n== Operative ==\n[CLAUSE]\nc\n--- skipped;')).toBe('ERR_DEPTH_SKIP');
	});

	it('ERR_PREAMBLE_NESTING', () => {
		expect(code('%RES 1.0\n== Preamble ==\n-- nested;\n== Operative ==\n[CLAUSE]\nx;')).toBe(
			'ERR_PREAMBLE_NESTING'
		);
	});

	it('ERR_CLAUSE_OUTSIDE_OPERATIVE', () => {
		expect(code('%RES 1.0\n== Preamble ==\n[CLAUSE]\noops;')).toBe('ERR_CLAUSE_OUTSIDE_OPERATIVE');
	});

	it('ERR_ORPHAN_TAIL', () => {
		expect(code('%RES 1.0\n== Operative ==\n[CLAUSE]\nc\n--> orphan;')).toBe('ERR_ORPHAN_TAIL');
	});

	it('ERR_EMPTY_DOCUMENT', () => {
		expect(code('%RES 1.0\nCommittee: X')).toBe('ERR_EMPTY_DOCUMENT');
	});

	it('reports the original source line through a comment banner', () => {
		const r = validate('# banner\n# more\nnope not a version');
		expect(r.valid).toBe(false);
		if (!r.valid) expect(r.errors[0].line).toBe(3);
	});
});

describe('warning catalog', () => {
	it('WARN_MISSING_COMMITTEE + WARN_EMPTY_HEADER', () => {
		const { warnings } = parse('%RES 1.0\n== Header ==\n== Operative ==\n[CLAUSE]\nx;');
		const codes = warnings.map((w) => w.code);
		expect(codes).toContain('WARN_MISSING_COMMITTEE');
		expect(codes).toContain('WARN_EMPTY_HEADER');
	});

	it('WARN_UNKNOWN_KEY', () => {
		const { warnings } = parse(
			'%RES 1.0\nCommittee: X\nBogusKey: y\n== Operative ==\n[CLAUSE]\nz;'
		);
		expect(warnings.map((w) => w.code)).toContain('WARN_UNKNOWN_KEY');
	});

	it('WARN_EMPTY_CHAPEAU + WARN_EMPTY_SECTION', () => {
		const { warnings } = parse(
			'%RES 1.0\nCommittee: X\n== Preamble ==\n== Operative ==\n[CLAUSE]\n- only a sub;'
		);
		const codes = warnings.map((w) => w.code);
		expect(codes).toContain('WARN_EMPTY_CHAPEAU');
		expect(codes).toContain('WARN_EMPTY_SECTION');
	});
});
