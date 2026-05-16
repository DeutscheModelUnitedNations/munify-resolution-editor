import { describe, it, expect } from 'vitest';
import { joinLogicalLines, normalizeNewlines, stripComments, tokenize } from './tokenize';

describe('tokenize', () => {
	it('normalizes CRLF and CR', () => {
		expect(normalizeNewlines('a\r\nb\rc')).toBe('a\nb\nc');
	});

	it('strips comments but keeps original line numbers', () => {
		const map = stripComments('# banner\n%RES 1.0\n# mid\nfoo');
		expect(map.lines).toEqual(['%RES 1.0', 'foo']);
		expect(map.srcLineNo).toEqual([2, 4]);
	});

	it('classifies every marker', () => {
		const t = tokenize(
			stripComments('%RES 1.0\n== Header ==\n[CLAUSE]\n- a\n--- b\n-> c\n> d\nplain')
		);
		expect(t.map((x) => x.kind)).toEqual([
			'version',
			'section',
			'clause',
			'subclause',
			'subclause',
			'closing',
			'closing',
			'text'
		]);
		expect(t[3].depth).toBe(1);
		expect(t[4].depth).toBe(3);
		expect(t[5].depth).toBe(1);
		expect(t[6].depth).toBe(0);
	});

	it('is case-insensitive for version, section and [CLAUSE]', () => {
		const t = tokenize(stripComments('%res 1.0\n== operative ==\n[ clause ]'));
		expect(t[0].kind).toBe('version');
		expect(t[1].sectionName).toBe('operative');
		expect(t[2].kind).toBe('clause');
	});

	it('treats a leading backslash as an escape (forces text)', () => {
		const t = tokenize(stripComments('\\- not a subclause\n\\# not a comment'));
		expect(t[0]).toMatchObject({ kind: 'text', content: '- not a subclause' });
		expect(t[1]).toMatchObject({ kind: 'text', content: '# not a comment' });
	});

	it('joins continuation lines and drops blanks; [CLAUSE] stays solo', () => {
		const lt = joinLogicalLines(
			tokenize(stripComments('[CLAUSE]\nchapeau one\ncontinues\n\n- sub'))
		);
		expect(lt.map((x) => x.kind)).toEqual(['clause', 'text', 'subclause']);
		expect(lt[1].content).toBe('chapeau one continues');
	});
});
