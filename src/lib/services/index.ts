/**
 * Resolution Editor Services
 */

export {
	type PhrasePattern,
	type ValidationResult,
	parsePhrasePatterns,
	parsePhraseFile,
	validatePhrase,
	createPhrasePatterns
} from './phraseValidation';

export {
	type ParsedSubClause,
	type ParsedOperativeClause,
	parsePreambleText,
	parseOperativeText,
	countOperativeClauses
} from './resolutionParser';
