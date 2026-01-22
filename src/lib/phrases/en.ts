/**
 * English UN Resolution Phrases
 *
 * Re-exports all English phrase collections
 */

export { englishPreamblePhrases } from './en-preamble';
export { englishOperativePhrases } from './en-operative';

// Combined export for convenience
import { englishPreamblePhrases } from './en-preamble';
import { englishOperativePhrases } from './en-operative';

export const englishPhrases = {
	preamble: englishPreamblePhrases,
	operative: englishOperativePhrases
};
