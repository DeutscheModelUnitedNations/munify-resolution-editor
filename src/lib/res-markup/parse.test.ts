import { describe, it, expect } from 'vitest';
import { parse, stripStrayOrdinal } from './parse';
import { stripClause } from './equal';
import { HARD_CASE, MINIMAL, SELF_REFERENTIAL } from './__fixtures__/fixtures';

describe('parse — minimal (grammar §8.1)', () => {
	const { resolution, header, warnings } = parse(MINIMAL);

	it('maps Committee and decoupled headline', () => {
		expect(resolution.committeeName).toBe('General Assembly');
		expect(header.committeeResolutionHeadline).toBe('THE GENERAL ASSEMBLY');
	});

	it('produces one preamble and one operative clause', () => {
		expect(resolution.preamble.map((p) => p.content)).toEqual([
			'Reaffirming the Charter of the United Nations,'
		]);
		expect(resolution.operative).toHaveLength(1);
		expect(resolution.operative[0].blocks[0]).toMatchObject({
			type: 'text',
			content: 'Calls upon all Member States to honour their obligations;'
		});
	});

	it('has no warnings', () => {
		expect(warnings).toEqual([]);
	});
});

describe('parse — hard recursive case (grammar §8.2)', () => {
	it('builds the exact block tree (ids ignored)', () => {
		const { resolution } = parse(HARD_CASE);
		expect(stripClause(resolution.operative[0])).toEqual({
			blocks: [
				{ type: 'text', content: 'decides to' },
				{
					type: 'subclauses',
					items: [
						{
							blocks: [
								{ type: 'text', content: 'establish an independent commission that' },
								{
									type: 'subclauses',
									items: [
										{
											blocks: [
												{ type: 'text', content: 'reports annually to the General Assembly;' }
											]
										},
										{ blocks: [{ type: 'text', content: 'issues concrete recommendations;' }] }
									]
								},
								{ type: 'text', content: 'while preserving the confidentiality of sources;' }
							]
						},
						{
							blocks: [
								{ type: 'text', content: 'secures the necessary funding from the regular budget;' }
							]
						}
					]
				},
				{ type: 'text', content: 'and to remain actively seized of the matter;' }
			]
		});
		expect(stripClause(resolution.operative[1])).toEqual({
			blocks: [
				{ type: 'text', content: 'requests the Secretary-General to report within 90 days.' }
			]
		});
	});
});

describe('parse — front-matter mapping', () => {
	const { resolution, header } = parse(SELF_REFERENTIAL);
	it('splits SponsoringDelegations and keeps the rest', () => {
		expect(header.sponsoringDelegations).toEqual(['Humans', 'Large Language Models', 'Parsers']);
		expect(header.committeeAbbreviation).toBe('GARE');
		expect(resolution.committeeName).toBe('General Assembly of Resolution Editors');
		expect(header.committeeResolutionHeadline).toBe('THE GENERAL ASSEMBLY OF RESOLUTION EDITORS');
	});
});

describe('stripStrayOrdinal', () => {
	it('drops hand-typed ordinals', () => {
		expect(stripStrayOrdinal('1. Demands a ceasefire')).toBe('Demands a ceasefire');
		expect(stripStrayOrdinal('(a) deploy observers')).toBe('deploy observers');
		expect(stripStrayOrdinal('b) review')).toBe('review');
		expect(stripStrayOrdinal('(iii) thirdly')).toBe('thirdly');
	});
	it('preserves prose that merely looks ordinal-ish', () => {
		expect(stripStrayOrdinal('v. the respondent')).toBe('v. the respondent');
		expect(stripStrayOrdinal('Calls upon all States')).toBe('Calls upon all States');
	});
});
