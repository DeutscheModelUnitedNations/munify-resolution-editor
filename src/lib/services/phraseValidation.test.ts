import { describe, it, expect } from 'vitest';
import {
	parsePhrasePatterns,
	parsePhraseFile,
	validatePhrase,
	createPhrasePatterns
} from './phraseValidation';
import { englishPreamblePhrases, englishOperativePhrases } from '../phrases/en';
import { germanPreamblePhrases, germanOperativePhrases } from '../phrases/de';

// =============================================================================
// PARSE PHRASE PATTERNS TESTS
// =============================================================================

describe('parsePhrasePatterns', () => {
	it('should parse basic phrases into patterns', () => {
		const phrases = ['recalling', 'noting', 'emphasizing'];
		const patterns = parsePhrasePatterns(phrases);

		expect(patterns).toHaveLength(3);
		expect(patterns[0].phrase).toBe('recalling');
		expect(patterns[1].phrase).toBe('noting');
		expect(patterns[2].phrase).toBe('emphasizing');
	});

	it('should filter out comments starting with #', () => {
		const phrases = ['recalling', '# This is a comment', 'noting'];
		const patterns = parsePhrasePatterns(phrases);

		expect(patterns).toHaveLength(2);
		expect(patterns.map((p) => p.phrase)).toEqual(['recalling', 'noting']);
	});

	it('should filter out empty lines', () => {
		const phrases = ['recalling', '', '   ', 'noting'];
		const patterns = parsePhrasePatterns(phrases);

		expect(patterns).toHaveLength(2);
		expect(patterns.map((p) => p.phrase)).toEqual(['recalling', 'noting']);
	});

	it('should trim whitespace from phrases', () => {
		const phrases = ['  recalling  ', '\tnoting\t', '  emphasizing'];
		const patterns = parsePhrasePatterns(phrases);

		expect(patterns).toHaveLength(3);
		expect(patterns[0].phrase).toBe('recalling');
		expect(patterns[1].phrase).toBe('noting');
		expect(patterns[2].phrase).toBe('emphasizing');
	});

	it('should create regex patterns for each phrase', () => {
		const phrases = ['recalling'];
		const patterns = parsePhrasePatterns(phrases);

		expect(patterns[0].regex).toBeInstanceOf(RegExp);
		expect(patterns[0].regex.flags).toContain('i');
	});

	it('should escape special regex characters in phrases', () => {
		const phrases = ['noting (with concern)', 'test.*phrase'];
		const patterns = parsePhrasePatterns(phrases);

		expect(patterns).toHaveLength(2);
		// The regex should match literally, not as regex metacharacters
		expect('noting (with concern) the situation'.match(patterns[0].regex)).toBeTruthy();
		expect('noting with concern the situation'.match(patterns[0].regex)).toBeFalsy();
	});

	it('should handle empty array', () => {
		const patterns = parsePhrasePatterns([]);
		expect(patterns).toHaveLength(0);
	});

	it('should handle array with only comments and empty lines', () => {
		const phrases = ['# comment', '', '  ', '# another comment'];
		const patterns = parsePhrasePatterns(phrases);
		expect(patterns).toHaveLength(0);
	});
});

// =============================================================================
// PARSE PHRASE FILE TESTS
// =============================================================================

describe('parsePhraseFile', () => {
	it('should parse newline-separated content', () => {
		const content = 'recalling\nnoting\nemphasizing';
		const patterns = parsePhraseFile(content);

		expect(patterns).toHaveLength(3);
		expect(patterns.map((p) => p.phrase)).toEqual(['recalling', 'noting', 'emphasizing']);
	});

	it('should handle Windows-style line endings', () => {
		const content = 'recalling\r\nnoting\r\nemphasizing';
		const patterns = parsePhraseFile(content);

		expect(patterns).toHaveLength(3);
		// Trimming handles the \r
		expect(patterns[0].phrase).toBe('recalling');
	});

	it('should filter comments and empty lines', () => {
		const content = '# Header comment\nrecalling\n\n# Another comment\nnoting';
		const patterns = parsePhraseFile(content);

		expect(patterns).toHaveLength(2);
		expect(patterns.map((p) => p.phrase)).toEqual(['recalling', 'noting']);
	});

	it('should handle empty content', () => {
		const patterns = parsePhraseFile('');
		expect(patterns).toHaveLength(0);
	});
});

// =============================================================================
// VALIDATE PHRASE TESTS
// =============================================================================

describe('validatePhrase', () => {
	const patterns = parsePhrasePatterns(['recalling', 'noting', 'deeply concerned']);

	describe('exact match', () => {
		it('should match exact phrase', () => {
			const result = validatePhrase('recalling', patterns);
			expect(result.valid).toBe(true);
			expect(result.matchedPhrase).toBe('recalling');
		});

		it('should match multi-word phrase', () => {
			const result = validatePhrase('deeply concerned', patterns);
			expect(result.valid).toBe(true);
			expect(result.matchedPhrase).toBe('deeply concerned');
		});
	});

	describe('case-insensitive matching', () => {
		it('should match uppercase text', () => {
			const result = validatePhrase('RECALLING', patterns);
			expect(result.valid).toBe(true);
			expect(result.matchedPhrase).toBe('RECALLING');
		});

		it('should match mixed case text', () => {
			const result = validatePhrase('ReCaLlInG', patterns);
			expect(result.valid).toBe(true);
			expect(result.matchedPhrase).toBe('ReCaLlInG');
		});

		it('should match multi-word with mixed case', () => {
			const result = validatePhrase('Deeply Concerned', patterns);
			expect(result.valid).toBe(true);
			expect(result.matchedPhrase).toBe('Deeply Concerned');
		});
	});

	describe('prefix match', () => {
		it('should match phrase at start of longer text', () => {
			const result = validatePhrase('recalling the previous resolution', patterns);
			expect(result.valid).toBe(true);
			expect(result.matchedPhrase).toBe('recalling');
		});

		it('should match multi-word phrase as prefix', () => {
			const result = validatePhrase('deeply concerned about the situation', patterns);
			expect(result.valid).toBe(true);
			expect(result.matchedPhrase).toBe('deeply concerned');
		});

		it('should not match phrase in middle of text', () => {
			const result = validatePhrase('also recalling the resolution', patterns);
			expect(result.valid).toBe(false);
		});
	});

	describe('no match', () => {
		it('should not match unknown phrase', () => {
			const result = validatePhrase('unknown phrase', patterns);
			expect(result.valid).toBe(false);
			expect(result.matchedPhrase).toBeUndefined();
		});

		it('should not match partial phrase', () => {
			const result = validatePhrase('recall', patterns);
			expect(result.valid).toBe(false);
		});
	});

	describe('empty text handling', () => {
		it('should return invalid for empty string', () => {
			const result = validatePhrase('', patterns);
			expect(result.valid).toBe(false);
		});

		it('should return invalid for whitespace-only string', () => {
			const result = validatePhrase('   ', patterns);
			expect(result.valid).toBe(false);
		});

		it('should trim text before matching', () => {
			const result = validatePhrase('  recalling  ', patterns);
			expect(result.valid).toBe(true);
			expect(result.matchedPhrase).toBe('recalling');
		});
	});

	describe('empty patterns handling', () => {
		it('should return invalid for any text with no patterns', () => {
			const result = validatePhrase('recalling', []);
			expect(result.valid).toBe(false);
		});
	});
});

// =============================================================================
// CREATE PHRASE PATTERNS TESTS
// =============================================================================

describe('createPhrasePatterns', () => {
	it('should be an alias for parsePhrasePatterns', () => {
		const phrases = ['recalling', 'noting'];
		const result1 = createPhrasePatterns(phrases);
		const result2 = parsePhrasePatterns(phrases);

		expect(result1).toHaveLength(result2.length);
		expect(result1[0].phrase).toBe(result2[0].phrase);
	});
});

// =============================================================================
// INTEGRATION TESTS WITH REAL PHRASES
// =============================================================================

describe('Integration with real phrase lists', () => {
	describe('English preamble phrases', () => {
		const patterns = parsePhrasePatterns(englishPreamblePhrases);

		it('should validate "Recalling" (capitalized)', () => {
			const result = validatePhrase('Recalling its resolution 70/1', patterns);
			expect(result.valid).toBe(true);
			expect(result.matchedPhrase?.toLowerCase()).toBe('recalling');
		});

		it('should validate "Deeply concerned" (multi-word)', () => {
			const result = validatePhrase('deeply concerned about the humanitarian situation', patterns);
			expect(result.valid).toBe(true);
		});

		it('should validate "Noting with appreciation"', () => {
			const result = validatePhrase('Noting with appreciation the efforts', patterns);
			expect(result.valid).toBe(true);
		});
	});

	describe('English operative phrases', () => {
		const patterns = parsePhrasePatterns(englishOperativePhrases);

		it('should validate "Decides"', () => {
			const result = validatePhrase('Decides to take the following measures', patterns);
			expect(result.valid).toBe(true);
		});

		it('should validate "Calls upon"', () => {
			const result = validatePhrase('Calls upon all Member States', patterns);
			expect(result.valid).toBe(true);
		});

		it('should validate "Strongly condemns"', () => {
			const result = validatePhrase('Strongly condemns the actions', patterns);
			expect(result.valid).toBe(true);
		});
	});

	describe('German preamble phrases', () => {
		const patterns = parsePhrasePatterns(germanPreamblePhrases);

		it('should validate German phrases if available', () => {
			if (germanPreamblePhrases.length > 0) {
				const result = validatePhrase(germanPreamblePhrases[0] + ' weitere Worte', patterns);
				expect(result.valid).toBe(true);
			}
		});
	});

	describe('German operative phrases', () => {
		const patterns = parsePhrasePatterns(germanOperativePhrases);

		it('should validate German phrases if available', () => {
			if (germanOperativePhrases.length > 0) {
				const result = validatePhrase(germanOperativePhrases[0] + ' weitere Worte', patterns);
				expect(result.valid).toBe(true);
			}
		});
	});
});
