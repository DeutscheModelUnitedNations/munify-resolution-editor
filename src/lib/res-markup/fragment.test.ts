import { describe, it, expect } from 'vitest';
import { parseClauseFragment } from './parse';
import { serializeClause } from './serialize';
import { stripClause } from './equal';
import { FRAGMENT } from './__fixtures__/fixtures';

describe('parseClauseFragment', () => {
	it('parses a [CLAUSE]-less fragment into one OperativeClause', () => {
		const r = parseClauseFragment(FRAGMENT);
		expect(r.valid).toBe(true);
		if (r.valid) {
			expect(stripClause(r.clause)).toEqual({
				blocks: [
					{ type: 'text', content: 'Decides to' },
					{
						type: 'subclauses',
						items: [
							{ blocks: [{ type: 'text', content: 'deploy observers within 30 days;' }] },
							{ blocks: [{ type: 'text', content: 'review the situation quarterly;' }] }
						]
					},
					{ type: 'text', content: 'and to remain actively seized of the matter;' }
				]
			});
		}
	});

	it('accepts and ignores a leading [CLAUSE] line', () => {
		const a = parseClauseFragment(FRAGMENT);
		const b = parseClauseFragment('[CLAUSE]\n' + FRAGMENT);
		expect(a.valid && b.valid).toBe(true);
		if (a.valid && b.valid) {
			expect(stripClause(a.clause)).toEqual(stripClause(b.clause));
		}
	});

	it('round-trips via serializeClause', () => {
		const r = parseClauseFragment(FRAGMENT);
		if (!r.valid) throw new Error('invalid');
		const again = parseClauseFragment(serializeClause(r.clause));
		if (!again.valid) throw new Error('invalid 2');
		expect(stripClause(again.clause)).toEqual(stripClause(r.clause));
	});

	it('returns an error union on a bad fragment', () => {
		const r = parseClauseFragment('chapeau\n--> orphan;');
		expect(r.valid).toBe(false);
		if (!r.valid) expect(r.errors[0].code).toBe('ERR_ORPHAN_TAIL');
	});
});
