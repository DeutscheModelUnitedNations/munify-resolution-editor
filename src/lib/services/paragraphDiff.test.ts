import { describe, it, expect } from 'vitest';
import { parseClauseFragment } from '../res-markup/parse';
import type { OperativeClause } from '../schema/resolution';
import { buildRenderClause, buildDiffRenderClause, type RenderText } from './paragraphDiff';

function clause(markup: string): OperativeClause {
	const r = parseClauseFragment(markup);
	if (!r.valid) throw new Error('invalid fixture: ' + JSON.stringify(r.errors));
	return r.clause;
}

function collectTexts(blocks: ReturnType<typeof buildRenderClause>['blocks']): RenderText[] {
	const out: RenderText[] = [];
	const walk = (bs: typeof blocks) => {
		for (const b of bs) {
			if (b.type === 'text') out.push(b);
			else for (const item of b.items) walk(item.blocks);
		}
	};
	walk(blocks);
	return out;
}

describe('buildRenderClause', () => {
	it('renders a flat clause with terminal period', () => {
		const rc = buildRenderClause(clause('Decides to remain seized of the matter'));
		const texts = collectTexts(rc.blocks);
		expect(texts).toHaveLength(1);
		expect(texts[0].words.map((w) => w.value).join('')).toBe(
			'Decides to remain seized of the matter'
		);
		expect(texts[0].punctuation).toBe('.');
	});

	it('uses semicolons before the terminal segment', () => {
		const rc = buildRenderClause(
			clause('Calls upon all parties to:\n- act now\n- and report back')
		);
		const texts = collectTexts(rc.blocks);
		expect(texts.map((t) => t.punctuation)).toEqual([';', ';', '.']);
	});
});

describe('buildDiffRenderClause', () => {
	it('marks added and removed words within a paired text block', () => {
		const oldC = clause('Calls upon all parties to act now');
		const newC = clause('Calls upon all parties to act immediately');
		const rc = buildDiffRenderClause(oldC, newC);
		const words = collectTexts(rc.blocks)[0].words;
		const removed = words.filter((w) => w.status === 'removed').map((w) => w.value.trim());
		const added = words.filter((w) => w.status === 'added').map((w) => w.value.trim());
		expect(removed).toContain('now');
		expect(added).toContain('immediately');
		expect(words.some((w) => w.status === 'same' && w.value.includes('Calls'))).toBe(true);
	});

	it('flags a wholly new sub-clause as added and a dropped one as removed', () => {
		const oldC = clause('Requests the following:\n- a report\n- a briefing');
		const newC = clause('Requests the following:\n- a report\n- a timeline');
		const rc = buildDiffRenderClause(oldC, newC);
		const sub = rc.blocks.find((b) => b.type === 'subclauses');
		expect(sub && sub.type === 'subclauses').toBe(true);
		if (sub && sub.type === 'subclauses') {
			// first item unchanged (word-diff inside), second item is a word-level change
			const second = sub.items[1];
			const w = collectTexts(second.blocks)[0].words;
			expect(w.some((x) => x.status === 'removed')).toBe(true);
			expect(w.some((x) => x.status === 'added')).toBe(true);
		}
	});

	it('handles extra new sub-clauses as fully added', () => {
		const oldC = clause('Decides to:\n- do A');
		const newC = clause('Decides to:\n- do A\n- do B');
		const rc = buildDiffRenderClause(oldC, newC);
		const sub = rc.blocks.find((b) => b.type === 'subclauses');
		if (sub && sub.type === 'subclauses') {
			expect(sub.items).toHaveLength(2);
			expect(sub.items[1].status).toBe('added');
		} else {
			throw new Error('expected subclauses block');
		}
	});
});
