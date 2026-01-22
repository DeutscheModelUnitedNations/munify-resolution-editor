/**
 * @deutschemodelunitednations/munify-resolution-editor
 *
 * A Svelte 5 component library for creating and editing UN-style resolutions.
 */

// Main components
export {
	ResolutionEditor,
	ResolutionPreview,
	ResolutionDocumentHeader,
	ResolutionDocumentFooter,
	ClauseEditor,
	OperativeClauseEditor,
	SubClauseEditor,
	PhraseLookupModal,
	PhraseSuggestions,
	ImportModal
} from './components';

// Schema types and utilities
export {
	// Types
	type TextBlock,
	type SubclausesBlock,
	type ClauseBlock,
	type SubClause,
	type OperativeClause,
	type PreambleClause,
	type Resolution,
	type ResolutionHeaderData,
	type LegacySubClause,
	type LegacyOperativeClause,
	type LegacyResolution,
	// Zod schemas
	TextBlockSchema,
	SubClauseSchema,
	SubclausesBlockSchema,
	ClauseBlockSchema,
	PreambleClauseSchema,
	OperativeClauseSchema,
	ResolutionSchema,
	// ID generators
	generateClauseId,
	generateSubClauseId,
	generateBlockId,
	// Factory functions
	createTextBlock,
	createSubclausesBlock,
	createEmptySubClause,
	createEmptyOperativeClause,
	createEmptyPreambleClause,
	createEmptyResolution,
	// Label generation
	toRoman,
	toLetter,
	toLowerRoman,
	getSubClauseLabel,
	MAX_SUBCLAUSE_DEPTH,
	// Migration
	isLegacyResolution,
	migrateResolution,
	validateResolution,
	// Utilities
	getFirstTextContent,
	hasSubclauses,
	getAllTextContent,
	isClauseEmpty,
	// Block manipulation
	mergeTextBlocks,
	mergeSubclausesBlocks,
	cleanupBlocks,
	subClauseToOperativeClause,
	findLastSubclausesBlockIndex,
	appendNestedSubClause
} from './schema/resolution';

// Services
export {
	type PhrasePattern,
	type ValidationResult,
	parsePhrasePatterns,
	parsePhraseFile,
	validatePhrase,
	createPhrasePatterns
} from './services/phraseValidation';

export {
	type ParsedSubClause,
	type ParsedOperativeClause,
	parsePreambleText,
	parseOperativeText,
	countOperativeClauses
} from './services/resolutionParser';

// i18n
export type { ResolutionEditorLabels, PartialLabels } from './i18n/types';
export {
	englishLabels,
	germanLabels,
	defaultLabels,
	mergeLabels,
	createLabelFunction
} from './i18n';

// Phrases
export {
	englishPreamblePhrases,
	englishOperativePhrases,
	englishPhrases,
	germanPreamblePhrases,
	germanOperativePhrases,
	germanPhrases,
	defaultPhrases,
	type PhraseCollection
} from './phrases';

// Assets
export { unEmblemSvg, getUnEmblemDataUrl } from './assets/un-emblem';
