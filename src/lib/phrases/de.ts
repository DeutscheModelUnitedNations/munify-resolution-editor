/**
 * German UN Resolution Phrases
 *
 * Re-exports all German phrase collections
 */

export { germanPreamblePhrases } from './de-preamble';
export { germanOperativePhrases } from './de-operative';

// Combined export for convenience
import { germanPreamblePhrases } from './de-preamble';
import { germanOperativePhrases } from './de-operative';

export const germanPhrases = {
	preamble: germanPreamblePhrases,
	operative: germanOperativePhrases
};
