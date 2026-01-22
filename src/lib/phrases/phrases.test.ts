import { describe, it, expect } from 'vitest';
import { englishPhrases, englishPreamblePhrases, englishOperativePhrases } from './en';
import { germanPhrases, germanPreamblePhrases, germanOperativePhrases } from './de';

// =============================================================================
// ENGLISH PHRASES TESTS
// =============================================================================

describe('English Phrases', () => {
	describe('englishPreamblePhrases', () => {
		it('should be a non-empty array', () => {
			expect(Array.isArray(englishPreamblePhrases)).toBe(true);
			expect(englishPreamblePhrases.length).toBeGreaterThan(0);
		});

		it('should contain only strings', () => {
			englishPreamblePhrases.forEach((phrase) => {
				expect(typeof phrase).toBe('string');
			});
		});

		it('should contain no empty strings', () => {
			englishPreamblePhrases.forEach((phrase) => {
				expect(phrase.trim().length).toBeGreaterThan(0);
			});
		});

		it('should have minimal duplicates', () => {
			// Note: The English preamble phrases list contains some intentional duplicates
			// (e.g., "reaffirming" appears multiple times for different contexts)
			const uniquePhrases = new Set(englishPreamblePhrases.map((p) => p.toLowerCase()));
			// Allow for some duplicates but ensure most are unique
			expect(uniquePhrases.size).toBeGreaterThan(englishPreamblePhrases.length * 0.9);
		});

		it('should contain common UN preamble phrases', () => {
			const lowerPhrases = englishPreamblePhrases.map((p) => p.toLowerCase());
			expect(lowerPhrases).toContain('recalling');
			expect(lowerPhrases).toContain('noting');
			expect(lowerPhrases).toContain('emphasizing');
		});
	});

	describe('englishOperativePhrases', () => {
		it('should be a non-empty array', () => {
			expect(Array.isArray(englishOperativePhrases)).toBe(true);
			expect(englishOperativePhrases.length).toBeGreaterThan(0);
		});

		it('should contain only strings', () => {
			englishOperativePhrases.forEach((phrase) => {
				expect(typeof phrase).toBe('string');
			});
		});

		it('should contain no empty strings', () => {
			englishOperativePhrases.forEach((phrase) => {
				expect(phrase.trim().length).toBeGreaterThan(0);
			});
		});

		it('should have minimal duplicates', () => {
			// Note: The English operative phrases list contains some intentional duplicates
			// (e.g., "reaffirms" and "strongly condemns" appear multiple times)
			const uniquePhrases = new Set(englishOperativePhrases.map((p) => p.toLowerCase()));
			// Allow for some duplicates but ensure most are unique
			expect(uniquePhrases.size).toBeGreaterThan(englishOperativePhrases.length * 0.95);
		});

		it('should contain common UN operative phrases', () => {
			const lowerPhrases = englishOperativePhrases.map((p) => p.toLowerCase());
			expect(lowerPhrases).toContain('decides');
			expect(lowerPhrases).toContain('requests');
			expect(lowerPhrases).toContain('calls upon');
		});
	});

	describe('englishPhrases combined object', () => {
		it('should have preamble and operative properties', () => {
			expect(englishPhrases).toHaveProperty('preamble');
			expect(englishPhrases).toHaveProperty('operative');
		});

		it('should reference the correct arrays', () => {
			expect(englishPhrases.preamble).toBe(englishPreamblePhrases);
			expect(englishPhrases.operative).toBe(englishOperativePhrases);
		});
	});
});

// =============================================================================
// GERMAN PHRASES TESTS
// =============================================================================

describe('German Phrases', () => {
	describe('germanPreamblePhrases', () => {
		it('should be a non-empty array', () => {
			expect(Array.isArray(germanPreamblePhrases)).toBe(true);
			expect(germanPreamblePhrases.length).toBeGreaterThan(0);
		});

		it('should contain only strings', () => {
			germanPreamblePhrases.forEach((phrase) => {
				expect(typeof phrase).toBe('string');
			});
		});

		it('should contain no empty strings', () => {
			germanPreamblePhrases.forEach((phrase) => {
				expect(phrase.trim().length).toBeGreaterThan(0);
			});
		});

		it('should contain no duplicates', () => {
			const uniquePhrases = new Set(germanPreamblePhrases.map((p) => p.toLowerCase()));
			expect(uniquePhrases.size).toBe(germanPreamblePhrases.length);
		});
	});

	describe('germanOperativePhrases', () => {
		it('should be a non-empty array', () => {
			expect(Array.isArray(germanOperativePhrases)).toBe(true);
			expect(germanOperativePhrases.length).toBeGreaterThan(0);
		});

		it('should contain only strings', () => {
			germanOperativePhrases.forEach((phrase) => {
				expect(typeof phrase).toBe('string');
			});
		});

		it('should contain no empty strings', () => {
			germanOperativePhrases.forEach((phrase) => {
				expect(phrase.trim().length).toBeGreaterThan(0);
			});
		});

		it('should contain no duplicates', () => {
			const uniquePhrases = new Set(germanOperativePhrases.map((p) => p.toLowerCase()));
			expect(uniquePhrases.size).toBe(germanOperativePhrases.length);
		});
	});

	describe('germanPhrases combined object', () => {
		it('should have preamble and operative properties', () => {
			expect(germanPhrases).toHaveProperty('preamble');
			expect(germanPhrases).toHaveProperty('operative');
		});

		it('should reference the correct arrays', () => {
			expect(germanPhrases.preamble).toBe(germanPreamblePhrases);
			expect(germanPhrases.operative).toBe(germanOperativePhrases);
		});
	});
});

// =============================================================================
// CROSS-LANGUAGE TESTS
// =============================================================================

describe('Cross-Language Phrase Consistency', () => {
	it('should have similar phrase counts between languages', () => {
		// German and English should have roughly similar numbers of phrases
		// Allow for some variance (within 50% of each other)
		const enPreambleCount = englishPreamblePhrases.length;
		const dePreambleCount = germanPreamblePhrases.length;
		const enOperativeCount = englishOperativePhrases.length;
		const deOperativeCount = germanOperativePhrases.length;

		expect(dePreambleCount).toBeGreaterThan(enPreambleCount * 0.5);
		expect(dePreambleCount).toBeLessThan(enPreambleCount * 2);

		expect(deOperativeCount).toBeGreaterThan(enOperativeCount * 0.5);
		expect(deOperativeCount).toBeLessThan(enOperativeCount * 2);
	});
});
