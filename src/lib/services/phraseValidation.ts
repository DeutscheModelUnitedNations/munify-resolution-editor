/**
 * Phrase validation service for Resolution Editor
 *
 * Validates clause content against phrase patterns.
 * Each phrase is matched as a case-insensitive prefix of the clause content.
 */

export interface PhrasePattern {
	phrase: string; // The phrase text (e.g., "zutiefst bedauernd")
	regex: RegExp; // Simple regex: /^phrase/i (case-insensitive start match)
}

export interface ValidationResult {
	valid: boolean;
	matchedPhrase?: string; // The matched phrase text (for italicization)
}

/**
 * Escape special regex characters in a string
 */
function escapeRegex(str: string): string {
	return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Parse phrase list content into patterns
 */
export function parsePhrasePatterns(phrases: string[]): PhrasePattern[] {
	return phrases
		.map((phrase) => phrase.trim())
		.filter((phrase) => phrase && !phrase.startsWith('#'))
		.map((phrase) => ({
			phrase,
			regex: new RegExp(`^(${escapeRegex(phrase)})`, 'i')
		}));
}

/**
 * Parse phrase file content (newline-separated) into patterns
 */
export function parsePhraseFile(content: string): PhrasePattern[] {
	return parsePhrasePatterns(content.split('\n'));
}

/**
 * Validate text against a list of phrase patterns
 */
export function validatePhrase(text: string, patterns: PhrasePattern[]): ValidationResult {
	const trimmedText = text.trim();

	if (!trimmedText) {
		return { valid: false };
	}

	for (const pattern of patterns) {
		const match = trimmedText.match(pattern.regex);
		if (match) {
			return {
				valid: true,
				matchedPhrase: match[1]
			};
		}
	}

	return { valid: false };
}

/**
 * Convert string array to phrase patterns
 * This is the main function to use when providing phrases as arrays
 */
export function createPhrasePatterns(phrases: string[]): PhrasePattern[] {
	return parsePhrasePatterns(phrases);
}
