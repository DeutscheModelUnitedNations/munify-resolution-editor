import { describe, it, expect } from 'vitest';
import { normalizeImportedResolution, stripTerminalPunctuation } from './importNormalize';
import type { Resolution } from '../schema/resolution';

describe('stripTerminalPunctuation', () => {
	it('removes a single trailing comma / semicolon / period', () => {
		expect(stripTerminalPunctuation('Recalling the Charter,')).toBe('Recalling the Charter');
		expect(stripTerminalPunctuation('Calls upon all States;')).toBe('Calls upon all States');
		expect(stripTerminalPunctuation('to remain seized of the matter.')).toBe(
			'to remain seized of the matter'
		);
	});

	it('removes 2+ consecutive / mixed terminal marks (with spaces)', () => {
		expect(stripTerminalPunctuation('doubled,,')).toBe('doubled');
		expect(stripTerminalPunctuation('spaced , ,')).toBe('spaced');
		expect(stripTerminalPunctuation('mixed ;.')).toBe('mixed');
		expect(stripTerminalPunctuation('trailing ws ;  ')).toBe('trailing ws');
	});

	it('leaves interior punctuation and unpunctuated text alone', () => {
		expect(stripTerminalPunctuation('resolution 2025 (2026)')).toBe('resolution 2025 (2026)');
		expect(stripTerminalPunctuation('the U.S. and the U.K')).toBe('the U.S. and the U.K');
		expect(stripTerminalPunctuation('no trailing mark')).toBe('no trailing mark');
	});
});

describe('normalizeImportedResolution', () => {
	it('strips terminal punctuation across committee, preamble and nested blocks', () => {
		const input: Resolution = {
			committeeName: 'General Assembly,',
			preamble: [{ id: 'p1', content: 'Recalling its resolution 2025 (2026),' }],
			operative: [
				{
					id: 'o1',
					blocks: [
						{ type: 'text', id: 't1', content: 'Decides to,' },
						{
							type: 'subclauses',
							id: 's1',
							items: [
								{
									id: 'sc1',
									blocks: [{ type: 'text', id: 't2', content: 'deploy observers;;' }]
								}
							]
						},
						{ type: 'text', id: 't3', content: 'and to remain seized of the matter.' }
					]
				}
			]
		};

		const out = normalizeImportedResolution(input);
		expect(out.committeeName).toBe('General Assembly');
		expect(out.preamble[0].content).toBe('Recalling its resolution 2025 (2026)');
		const blocks = out.operative[0].blocks;
		expect(blocks[0]).toMatchObject({ type: 'text', content: 'Decides to' });
		expect(blocks[1]).toMatchObject({ type: 'subclauses' });
		if (blocks[1].type === 'subclauses') {
			expect(blocks[1].items[0].blocks[0]).toMatchObject({
				type: 'text',
				content: 'deploy observers'
			});
		}
		expect(blocks[2]).toMatchObject({
			type: 'text',
			content: 'and to remain seized of the matter'
		});
	});
});
