/**
 * Resolution Phrase Collections
 *
 * This module exports phrase collections for UN resolution editing.
 * Phrases are organized by language and clause type (preamble/operative).
 */

// Re-export English phrases (default)
export { englishPreamblePhrases, englishOperativePhrases, englishPhrases } from './en';

// Re-export German phrases
export { germanPreamblePhrases, germanOperativePhrases, germanPhrases } from './de';

// Type for phrase collection
export interface PhraseCollection {
	preamble: string[];
	operative: string[];
}

// Default phrases are English
import { englishPhrases } from './en';
export const defaultPhrases = englishPhrases;
