import { describe, it, expect } from 'vitest';
import {
	// Zod Schemas
	TextBlockSchema,
	SubclausesBlockSchema,
	ClauseBlockSchema,
	ResolutionSchema,
	// ID Generators
	generateClauseId,
	generateSubClauseId,
	generateBlockId,
	// Factory Functions
	createTextBlock,
	createSubclausesBlock,
	createEmptySubClause,
	createEmptyOperativeClause,
	createEmptyPreambleClause,
	createEmptyResolution,
	// Label Generation
	toRoman,
	toLetter,
	toLowerRoman,
	getSubClauseLabel,
	MAX_SUBCLAUSE_DEPTH,
	// Migration Functions
	isLegacyResolution,
	migrateResolution,
	validateResolution,
	// Utility Functions
	getFirstTextContent,
	hasSubclauses,
	getAllTextContent,
	isClauseEmpty,
	// Block Manipulation
	mergeTextBlocks,
	mergeSubclausesBlocks,
	cleanupBlocks,
	subClauseToOperativeClause,
	findLastSubclausesBlockIndex,
	appendNestedSubClause,
	// Types
	type TextBlock,
	type SubclausesBlock,
	type ClauseBlock,
	type SubClause,
	type OperativeClause,
	type Resolution,
	type LegacyResolution
} from './resolution';

// =============================================================================
// ZOD SCHEMA TESTS
// =============================================================================

describe('Zod Schemas', () => {
	describe('TextBlockSchema', () => {
		it('should validate valid text block', () => {
			const block = { type: 'text' as const, id: 'b-123', content: 'Hello' };
			expect(TextBlockSchema.safeParse(block).success).toBe(true);
		});

		it('should reject missing type', () => {
			const block = { id: 'b-123', content: 'Hello' };
			expect(TextBlockSchema.safeParse(block).success).toBe(false);
		});

		it('should reject wrong type', () => {
			const block = { type: 'subclauses', id: 'b-123', content: 'Hello' };
			expect(TextBlockSchema.safeParse(block).success).toBe(false);
		});

		it('should accept empty content', () => {
			const block = { type: 'text' as const, id: 'b-123', content: '' };
			expect(TextBlockSchema.safeParse(block).success).toBe(true);
		});
	});

	describe('SubclausesBlockSchema', () => {
		it('should validate valid subclauses block', () => {
			const block = {
				type: 'subclauses' as const,
				id: 'b-123',
				items: [{ id: 's-1', blocks: [{ type: 'text' as const, id: 'b-1', content: 'test' }] }]
			};
			expect(SubclausesBlockSchema.safeParse(block).success).toBe(true);
		});

		it('should accept empty items array', () => {
			const block = { type: 'subclauses' as const, id: 'b-123', items: [] };
			expect(SubclausesBlockSchema.safeParse(block).success).toBe(true);
		});

		it('should reject wrong type', () => {
			const block = { type: 'text', id: 'b-123', items: [] };
			expect(SubclausesBlockSchema.safeParse(block).success).toBe(false);
		});
	});

	describe('ClauseBlockSchema (discriminated union)', () => {
		it('should validate text block', () => {
			const block = { type: 'text' as const, id: 'b-123', content: 'Hello' };
			expect(ClauseBlockSchema.safeParse(block).success).toBe(true);
		});

		it('should validate subclauses block', () => {
			const block = { type: 'subclauses' as const, id: 'b-123', items: [] };
			expect(ClauseBlockSchema.safeParse(block).success).toBe(true);
		});

		it('should reject unknown type', () => {
			const block = { type: 'unknown', id: 'b-123' };
			expect(ClauseBlockSchema.safeParse(block).success).toBe(false);
		});
	});

	describe('ResolutionSchema (nested validation)', () => {
		it('should validate complete resolution', () => {
			const resolution: Resolution = {
				committeeName: 'Security Council',
				preamble: [{ id: 'p-1', content: 'Noting...' }],
				operative: [
					{
						id: 'o-1',
						blocks: [{ type: 'text', id: 'b-1', content: 'Decides...' }]
					}
				]
			};
			expect(ResolutionSchema.safeParse(resolution).success).toBe(true);
		});

		it('should validate resolution with nested subclauses', () => {
			const resolution: Resolution = {
				committeeName: 'General Assembly',
				preamble: [],
				operative: [
					{
						id: 'o-1',
						blocks: [
							{ type: 'text', id: 'b-1', content: 'Main clause' },
							{
								type: 'subclauses',
								id: 'b-2',
								items: [
									{
										id: 's-1',
										blocks: [
											{ type: 'text', id: 'b-3', content: 'Sub a' },
											{
												type: 'subclauses',
												id: 'b-4',
												items: [
													{ id: 's-2', blocks: [{ type: 'text', id: 'b-5', content: 'Sub i' }] }
												]
											}
										]
									}
								]
							}
						]
					}
				]
			};
			expect(ResolutionSchema.safeParse(resolution).success).toBe(true);
		});

		it('should reject missing committeeName', () => {
			const resolution = {
				preamble: [],
				operative: []
			};
			expect(ResolutionSchema.safeParse(resolution).success).toBe(false);
		});
	});
});

// =============================================================================
// ID GENERATOR TESTS
// =============================================================================

describe('ID Generators', () => {
	describe('generateClauseId', () => {
		it('should generate ID with "p" prefix for preamble', () => {
			const id = generateClauseId('p');
			expect(id).toMatch(/^p-\d+-[a-z0-9]+$/);
		});

		it('should generate ID with "o" prefix for operative', () => {
			const id = generateClauseId('o');
			expect(id).toMatch(/^o-\d+-[a-z0-9]+$/);
		});

		it('should generate unique IDs', () => {
			const ids = new Set<string>();
			for (let i = 0; i < 100; i++) {
				ids.add(generateClauseId('o'));
			}
			expect(ids.size).toBe(100);
		});
	});

	describe('generateSubClauseId', () => {
		it('should generate ID with "s" prefix', () => {
			const id = generateSubClauseId();
			expect(id).toMatch(/^s-\d+-[a-z0-9]+$/);
		});

		it('should generate unique IDs', () => {
			const ids = new Set<string>();
			for (let i = 0; i < 100; i++) {
				ids.add(generateSubClauseId());
			}
			expect(ids.size).toBe(100);
		});
	});

	describe('generateBlockId', () => {
		it('should generate ID with "b" prefix', () => {
			const id = generateBlockId();
			expect(id).toMatch(/^b-\d+-[a-z0-9]+$/);
		});

		it('should generate unique IDs', () => {
			const ids = new Set<string>();
			for (let i = 0; i < 100; i++) {
				ids.add(generateBlockId());
			}
			expect(ids.size).toBe(100);
		});
	});
});

// =============================================================================
// FACTORY FUNCTION TESTS
// =============================================================================

describe('Factory Functions', () => {
	describe('createTextBlock', () => {
		it('should create text block with content', () => {
			const block = createTextBlock('Hello');
			expect(block.type).toBe('text');
			expect(block.content).toBe('Hello');
			expect(block.id).toMatch(/^b-/);
		});

		it('should create text block with empty content by default', () => {
			const block = createTextBlock();
			expect(block.content).toBe('');
		});
	});

	describe('createSubclausesBlock', () => {
		it('should create subclauses block with items', () => {
			const subClause: SubClause = { id: 's-1', blocks: [createTextBlock('test')] };
			const block = createSubclausesBlock([subClause]);
			expect(block.type).toBe('subclauses');
			expect(block.items).toHaveLength(1);
		});

		it('should create empty subclauses block by default', () => {
			const block = createSubclausesBlock();
			expect(block.items).toHaveLength(0);
		});
	});

	describe('createEmptySubClause', () => {
		it('should create subclause with one empty text block', () => {
			const subClause = createEmptySubClause();
			expect(subClause.id).toMatch(/^s-/);
			expect(subClause.blocks).toHaveLength(1);
			expect(subClause.blocks[0].type).toBe('text');
			expect((subClause.blocks[0] as TextBlock).content).toBe('');
		});
	});

	describe('createEmptyOperativeClause', () => {
		it('should create operative clause with one empty text block', () => {
			const clause = createEmptyOperativeClause();
			expect(clause.id).toMatch(/^o-/);
			expect(clause.blocks).toHaveLength(1);
			expect(clause.blocks[0].type).toBe('text');
		});
	});

	describe('createEmptyPreambleClause', () => {
		it('should create preamble clause with empty content', () => {
			const clause = createEmptyPreambleClause();
			expect(clause.id).toMatch(/^p-/);
			expect(clause.content).toBe('');
		});
	});

	describe('createEmptyResolution', () => {
		it('should create resolution with committee name and empty arrays', () => {
			const resolution = createEmptyResolution('Test Committee');
			expect(resolution.committeeName).toBe('Test Committee');
			expect(resolution.preamble).toEqual([]);
			expect(resolution.operative).toEqual([]);
		});
	});
});

// =============================================================================
// LABEL GENERATION TESTS
// =============================================================================

describe('Label Generation', () => {
	describe('toRoman', () => {
		it('should convert 1 to I', () => {
			expect(toRoman(1)).toBe('I');
		});

		it('should convert 4 to IV', () => {
			expect(toRoman(4)).toBe('IV');
		});

		it('should convert 9 to IX', () => {
			expect(toRoman(9)).toBe('IX');
		});

		it('should convert 10 to X', () => {
			expect(toRoman(10)).toBe('X');
		});

		it('should convert 40 to XL', () => {
			expect(toRoman(40)).toBe('XL');
		});

		it('should convert 50 to L', () => {
			expect(toRoman(50)).toBe('L');
		});

		it('should convert 90 to XC', () => {
			expect(toRoman(90)).toBe('XC');
		});

		it('should convert 100 to C', () => {
			expect(toRoman(100)).toBe('C');
		});

		it('should convert 400 to CD', () => {
			expect(toRoman(400)).toBe('CD');
		});

		it('should convert 500 to D', () => {
			expect(toRoman(500)).toBe('D');
		});

		it('should convert 900 to CM', () => {
			expect(toRoman(900)).toBe('CM');
		});

		it('should convert 1000 to M', () => {
			expect(toRoman(1000)).toBe('M');
		});

		it('should convert complex number 1994 to MCMXCIV', () => {
			expect(toRoman(1994)).toBe('MCMXCIV');
		});

		it('should convert 0 to empty string', () => {
			expect(toRoman(0)).toBe('');
		});
	});

	describe('toLetter', () => {
		it('should convert 1 to a', () => {
			expect(toLetter(1)).toBe('a');
		});

		it('should convert 26 to z', () => {
			expect(toLetter(26)).toBe('z');
		});

		it('should convert 27 to aa', () => {
			expect(toLetter(27)).toBe('aa');
		});

		it('should convert 28 to ab', () => {
			expect(toLetter(28)).toBe('ab');
		});

		it('should convert 52 to az', () => {
			expect(toLetter(52)).toBe('az');
		});

		it('should convert 53 to ba', () => {
			expect(toLetter(53)).toBe('ba');
		});
	});

	describe('toLowerRoman', () => {
		it('should return lowercase roman numerals', () => {
			expect(toLowerRoman(1)).toBe('i');
			expect(toLowerRoman(4)).toBe('iv');
			expect(toLowerRoman(10)).toBe('x');
		});
	});

	describe('getSubClauseLabel', () => {
		it('should return (a) for depth 1, index 0', () => {
			expect(getSubClauseLabel(0, 1)).toBe('(a)');
		});

		it('should return (b) for depth 1, index 1', () => {
			expect(getSubClauseLabel(1, 1)).toBe('(b)');
		});

		it('should return (i) for depth 2, index 0', () => {
			expect(getSubClauseLabel(0, 2)).toBe('(i)');
		});

		it('should return (ii) for depth 2, index 1', () => {
			expect(getSubClauseLabel(1, 2)).toBe('(ii)');
		});

		it('should return (aa) for depth 3, index 0', () => {
			expect(getSubClauseLabel(0, 3)).toBe('(aa)');
		});

		it('should return (bb) for depth 3, index 1', () => {
			expect(getSubClauseLabel(1, 3)).toBe('(bb)');
		});

		it('should return (aaa) for depth 4, index 0', () => {
			expect(getSubClauseLabel(0, 4)).toBe('(aaa)');
		});

		it('should return (1) for unknown depth', () => {
			expect(getSubClauseLabel(0, 5)).toBe('(1)');
		});
	});

	describe('MAX_SUBCLAUSE_DEPTH', () => {
		it('should be 4', () => {
			expect(MAX_SUBCLAUSE_DEPTH).toBe(4);
		});
	});
});

// =============================================================================
// MIGRATION FUNCTION TESTS
// =============================================================================

describe('Migration Functions', () => {
	describe('isLegacyResolution', () => {
		it('should detect legacy resolution with content field', () => {
			const legacy: LegacyResolution = {
				committeeName: 'Test',
				preamble: [],
				operative: [{ id: 'o-1', content: 'Decides...' }]
			};
			expect(isLegacyResolution(legacy)).toBe(true);
		});

		it('should not detect new resolution format', () => {
			const newFormat: Resolution = {
				committeeName: 'Test',
				preamble: [],
				operative: [{ id: 'o-1', blocks: [{ type: 'text', id: 'b-1', content: 'Decides...' }] }]
			};
			expect(isLegacyResolution(newFormat)).toBe(false);
		});

		it('should return false for null', () => {
			expect(isLegacyResolution(null)).toBe(false);
		});

		it('should return false for non-object', () => {
			expect(isLegacyResolution('string')).toBe(false);
		});

		it('should return false for empty operative array', () => {
			expect(isLegacyResolution({ committeeName: 'Test', preamble: [], operative: [] })).toBe(
				false
			);
		});
	});

	describe('migrateResolution', () => {
		it('should migrate legacy resolution to new format', () => {
			const legacy: LegacyResolution = {
				committeeName: 'Security Council',
				preamble: [{ id: 'p-1', content: 'Noting...' }],
				operative: [{ id: 'o-1', content: 'Decides to take action' }]
			};

			const migrated = migrateResolution(legacy);

			expect(migrated.committeeName).toBe('Security Council');
			expect(migrated.preamble).toEqual(legacy.preamble);
			expect(migrated.operative[0].blocks[0].type).toBe('text');
			expect((migrated.operative[0].blocks[0] as TextBlock).content).toBe('Decides to take action');
		});

		it('should migrate legacy resolution with subclauses', () => {
			const legacy: LegacyResolution = {
				committeeName: 'Test',
				preamble: [],
				operative: [
					{
						id: 'o-1',
						content: 'Main clause',
						subClauses: [
							{ id: 's-1', content: 'Sub a', children: [{ id: 's-2', content: 'Sub i' }] }
						]
					}
				]
			};

			const migrated = migrateResolution(legacy);

			expect(migrated.operative[0].blocks).toHaveLength(2);
			expect(migrated.operative[0].blocks[1].type).toBe('subclauses');

			const subclausesBlock = migrated.operative[0].blocks[1] as SubclausesBlock;
			expect(subclausesBlock.items).toHaveLength(1);
			expect(subclausesBlock.items[0].blocks).toHaveLength(2);
		});

		it('should pass through valid new format resolution', () => {
			const newFormat: Resolution = {
				committeeName: 'Test',
				preamble: [],
				operative: [{ id: 'o-1', blocks: [{ type: 'text', id: 'b-1', content: 'Decides...' }] }]
			};

			const result = migrateResolution(newFormat);
			expect(result).toEqual(newFormat);
		});
	});

	describe('validateResolution', () => {
		it('should return valid for correct resolution', () => {
			const resolution: Resolution = {
				committeeName: 'Test',
				preamble: [],
				operative: [{ id: 'o-1', blocks: [{ type: 'text', id: 'b-1', content: 'Test' }] }]
			};

			const result = validateResolution(resolution);
			expect(result.valid).toBe(true);
			if (result.valid) {
				expect(result.data).toEqual(resolution);
			}
		});

		it('should migrate and validate legacy resolution', () => {
			const legacy: LegacyResolution = {
				committeeName: 'Test',
				preamble: [],
				operative: [{ id: 'o-1', content: 'Test' }]
			};

			const result = validateResolution(legacy);
			expect(result.valid).toBe(true);
		});

		it('should throw for malformed data that fails migration', () => {
			const invalid = { preamble: [], operative: [] };

			// validateResolution calls migrateResolution which throws on invalid data
			expect(() => validateResolution(invalid)).toThrow();
		});
	});
});

// =============================================================================
// UTILITY FUNCTION TESTS
// =============================================================================

describe('Utility Functions', () => {
	describe('getFirstTextContent', () => {
		it('should return content of first text block', () => {
			const clause: OperativeClause = {
				id: 'o-1',
				blocks: [{ type: 'text', id: 'b-1', content: 'Hello World' }]
			};
			expect(getFirstTextContent(clause)).toBe('Hello World');
		});

		it('should return empty string if first block is not text', () => {
			const clause: OperativeClause = {
				id: 'o-1',
				blocks: [{ type: 'subclauses', id: 'b-1', items: [] }]
			};
			expect(getFirstTextContent(clause)).toBe('');
		});

		it('should return empty string for empty blocks', () => {
			const clause: OperativeClause = {
				id: 'o-1',
				blocks: []
			};
			expect(getFirstTextContent(clause)).toBe('');
		});
	});

	describe('hasSubclauses', () => {
		it('should return true if clause has subclauses block', () => {
			const clause: OperativeClause = {
				id: 'o-1',
				blocks: [
					{ type: 'text', id: 'b-1', content: 'Test' },
					{ type: 'subclauses', id: 'b-2', items: [] }
				]
			};
			expect(hasSubclauses(clause)).toBe(true);
		});

		it('should return false if clause has no subclauses block', () => {
			const clause: OperativeClause = {
				id: 'o-1',
				blocks: [{ type: 'text', id: 'b-1', content: 'Test' }]
			};
			expect(hasSubclauses(clause)).toBe(false);
		});
	});

	describe('getAllTextContent', () => {
		it('should concatenate all text block contents', () => {
			const clause: OperativeClause = {
				id: 'o-1',
				blocks: [
					{ type: 'text', id: 'b-1', content: 'Hello' },
					{ type: 'subclauses', id: 'b-2', items: [] },
					{ type: 'text', id: 'b-3', content: 'World' }
				]
			};
			expect(getAllTextContent(clause)).toBe('Hello World');
		});

		it('should return empty string for no text blocks', () => {
			const clause: OperativeClause = {
				id: 'o-1',
				blocks: [{ type: 'subclauses', id: 'b-1', items: [] }]
			};
			expect(getAllTextContent(clause)).toBe('');
		});
	});

	describe('isClauseEmpty', () => {
		it('should return true for clause with only empty text blocks', () => {
			const clause: OperativeClause = {
				id: 'o-1',
				blocks: [{ type: 'text', id: 'b-1', content: '' }]
			};
			expect(isClauseEmpty(clause)).toBe(true);
		});

		it('should return true for clause with whitespace-only text', () => {
			const clause: OperativeClause = {
				id: 'o-1',
				blocks: [{ type: 'text', id: 'b-1', content: '   ' }]
			};
			expect(isClauseEmpty(clause)).toBe(true);
		});

		it('should return false for clause with text content', () => {
			const clause: OperativeClause = {
				id: 'o-1',
				blocks: [{ type: 'text', id: 'b-1', content: 'Hello' }]
			};
			expect(isClauseEmpty(clause)).toBe(false);
		});

		it('should return true for empty subclauses', () => {
			const clause: OperativeClause = {
				id: 'o-1',
				blocks: [
					{ type: 'text', id: 'b-1', content: '' },
					{ type: 'subclauses', id: 'b-2', items: [] }
				]
			};
			expect(isClauseEmpty(clause)).toBe(true);
		});

		it('should return false if nested subclause has content', () => {
			const clause: OperativeClause = {
				id: 'o-1',
				blocks: [
					{ type: 'text', id: 'b-1', content: '' },
					{
						type: 'subclauses',
						id: 'b-2',
						items: [
							{
								id: 's-1',
								blocks: [{ type: 'text', id: 'b-3', content: 'Has content' }]
							}
						]
					}
				]
			};
			expect(isClauseEmpty(clause)).toBe(false);
		});
	});
});

// =============================================================================
// BLOCK MANIPULATION TESTS
// =============================================================================

describe('Block Manipulation', () => {
	describe('mergeTextBlocks', () => {
		it('should merge two consecutive text blocks', () => {
			const blocks: ClauseBlock[] = [
				{ type: 'text', id: 'b-1', content: 'Hello' },
				{ type: 'text', id: 'b-2', content: 'World' }
			];

			const result = mergeTextBlocks(blocks, 0, 1);

			expect(result).toHaveLength(1);
			expect((result[0] as TextBlock).content).toBe('Hello World');
		});

		it('should handle empty content in merge', () => {
			const blocks: ClauseBlock[] = [
				{ type: 'text', id: 'b-1', content: '' },
				{ type: 'text', id: 'b-2', content: 'World' }
			];

			const result = mergeTextBlocks(blocks, 0, 1);

			expect(result).toHaveLength(1);
			expect((result[0] as TextBlock).content).toBe('World');
		});

		it('should return original blocks if not both text blocks', () => {
			const blocks: ClauseBlock[] = [
				{ type: 'text', id: 'b-1', content: 'Hello' },
				{ type: 'subclauses', id: 'b-2', items: [] }
			];

			const result = mergeTextBlocks(blocks, 0, 1);

			expect(result).toEqual(blocks);
		});

		it('should handle invalid indices', () => {
			const blocks: ClauseBlock[] = [{ type: 'text', id: 'b-1', content: 'Hello' }];

			const result = mergeTextBlocks(blocks, 0, 5);

			expect(result).toEqual(blocks);
		});
	});

	describe('mergeSubclausesBlocks', () => {
		it('should merge two consecutive subclauses blocks', () => {
			const blocks: ClauseBlock[] = [
				{
					type: 'subclauses',
					id: 'b-1',
					items: [{ id: 's-1', blocks: [{ type: 'text', id: 'b-3', content: 'a' }] }]
				},
				{
					type: 'subclauses',
					id: 'b-2',
					items: [{ id: 's-2', blocks: [{ type: 'text', id: 'b-4', content: 'b' }] }]
				}
			];

			const result = mergeSubclausesBlocks(blocks, 0, 1);

			expect(result).toHaveLength(1);
			expect((result[0] as SubclausesBlock).items).toHaveLength(2);
		});

		it('should return original blocks if not both subclauses blocks', () => {
			const blocks: ClauseBlock[] = [
				{ type: 'text', id: 'b-1', content: 'Hello' },
				{ type: 'subclauses', id: 'b-2', items: [] }
			];

			const result = mergeSubclausesBlocks(blocks, 0, 1);

			expect(result).toEqual(blocks);
		});
	});

	describe('cleanupBlocks', () => {
		it('should remove empty subclauses blocks', () => {
			const blocks: ClauseBlock[] = [
				{ type: 'text', id: 'b-1', content: 'Hello' },
				{ type: 'subclauses', id: 'b-2', items: [] }
			];

			const result = cleanupBlocks(blocks);

			expect(result).toHaveLength(1);
			expect(result[0].type).toBe('text');
		});

		it('should merge consecutive text blocks', () => {
			const blocks: ClauseBlock[] = [
				{ type: 'text', id: 'b-1', content: 'Hello' },
				{ type: 'text', id: 'b-2', content: 'World' }
			];

			const result = cleanupBlocks(blocks);

			expect(result).toHaveLength(1);
			expect((result[0] as TextBlock).content).toBe('Hello World');
		});

		it('should merge consecutive subclauses blocks', () => {
			const blocks: ClauseBlock[] = [
				{
					type: 'subclauses',
					id: 'b-1',
					items: [{ id: 's-1', blocks: [{ type: 'text', id: 'b-3', content: 'a' }] }]
				},
				{
					type: 'subclauses',
					id: 'b-2',
					items: [{ id: 's-2', blocks: [{ type: 'text', id: 'b-4', content: 'b' }] }]
				}
			];

			const result = cleanupBlocks(blocks);

			expect(result).toHaveLength(1);
			expect((result[0] as SubclausesBlock).items).toHaveLength(2);
		});

		it('should handle complex mixed blocks', () => {
			const blocks: ClauseBlock[] = [
				{ type: 'text', id: 'b-1', content: 'Start' },
				{ type: 'text', id: 'b-2', content: 'More' },
				{
					type: 'subclauses',
					id: 'b-3',
					items: [{ id: 's-1', blocks: [{ type: 'text', id: 'b-5', content: 'sub' }] }]
				},
				{ type: 'subclauses', id: 'b-4', items: [] },
				{ type: 'text', id: 'b-6', content: 'End' }
			];

			const result = cleanupBlocks(blocks);

			expect(result).toHaveLength(3);
			expect((result[0] as TextBlock).content).toBe('Start More');
			expect(result[1].type).toBe('subclauses');
			expect((result[2] as TextBlock).content).toBe('End');
		});
	});

	describe('subClauseToOperativeClause', () => {
		it('should convert subclause to operative clause', () => {
			const subClause: SubClause = {
				id: 's-1',
				blocks: [
					{ type: 'text', id: 'b-1', content: 'Test content' },
					{ type: 'subclauses', id: 'b-2', items: [] }
				]
			};

			const result = subClauseToOperativeClause(subClause);

			expect(result.id).toMatch(/^o-/);
			expect(result.blocks).toHaveLength(2);
			expect(result.blocks[0]).toEqual(subClause.blocks[0]);
		});
	});

	describe('findLastSubclausesBlockIndex', () => {
		it('should find last subclauses block', () => {
			const blocks: ClauseBlock[] = [
				{ type: 'text', id: 'b-1', content: 'Hello' },
				{ type: 'subclauses', id: 'b-2', items: [] },
				{ type: 'text', id: 'b-3', content: 'World' },
				{ type: 'subclauses', id: 'b-4', items: [] }
			];

			expect(findLastSubclausesBlockIndex(blocks)).toBe(3);
		});

		it('should return -1 if no subclauses block exists', () => {
			const blocks: ClauseBlock[] = [
				{ type: 'text', id: 'b-1', content: 'Hello' },
				{ type: 'text', id: 'b-2', content: 'World' }
			];

			expect(findLastSubclausesBlockIndex(blocks)).toBe(-1);
		});
	});

	describe('appendNestedSubClause', () => {
		it('should add to existing subclauses block at end', () => {
			const parent: SubClause = {
				id: 's-1',
				blocks: [
					{ type: 'text', id: 'b-1', content: 'Parent' },
					{
						type: 'subclauses',
						id: 'b-2',
						items: [{ id: 's-2', blocks: [{ type: 'text', id: 'b-3', content: 'Existing' }] }]
					}
				]
			};

			const child: SubClause = {
				id: 's-3',
				blocks: [{ type: 'text', id: 'b-4', content: 'New' }]
			};

			const result = appendNestedSubClause(parent, child);

			expect(result.blocks).toHaveLength(2);
			const subclausesBlock = result.blocks[1] as SubclausesBlock;
			expect(subclausesBlock.items).toHaveLength(2);
		});

		it('should create new subclauses block if none at end', () => {
			const parent: SubClause = {
				id: 's-1',
				blocks: [{ type: 'text', id: 'b-1', content: 'Parent' }]
			};

			const child: SubClause = {
				id: 's-2',
				blocks: [{ type: 'text', id: 'b-2', content: 'New' }]
			};

			const result = appendNestedSubClause(parent, child);

			expect(result.blocks).toHaveLength(2);
			expect(result.blocks[1].type).toBe('subclauses');
			const subclausesBlock = result.blocks[1] as SubclausesBlock;
			expect(subclausesBlock.items).toHaveLength(1);
		});
	});
});
