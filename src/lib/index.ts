/**
 * @deutschemodelunitednations/munify-resolution-editor
 *
 * A Svelte 5 component library for creating and editing UN-style resolutions.
 */

// Store
export type {
	ResolutionStore,
	TextHandle,
	TextLocation,
	ClausePath,
	SubclausesBlockPath,
	OutdentResult,
	PresenceUser,
	PresenceInfo,
	PresenceAdapter
} from './store/types';
export { createNativeStore, createEmptyNativeStore } from './store/native.svelte';
export type { NativeStoreOptions } from './store/native.svelte';

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
	ImportModal,
	ResolutionImportModal,
	ResolutionPrintPreview
} from './components';

// RES-Markup interchange format (also available via the `/res-markup` subpath)
export {
	parse,
	parseClauseFragment,
	serialize,
	serializeClause,
	validate,
	isIdempotent,
	roundTrips,
	suggestResolutionFilename,
	RES_VERSION,
	RES_FILE_EXTENSION,
	type ParseResult,
	type ValidateResult,
	type ResError,
	type ResWarning,
	type ResErrorCode,
	type ResWarningCode
} from './res-markup';

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
	type AmendmentOverlay,
	type AmendmentOverlayType,
	type AmendmentOverlayStatus,
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
	appendNestedSubClause,
	// Amendment diff utilities
	getClauseTextCharCount,
	calculateAmendmentDiffSize
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

export { stripTerminalPunctuation, normalizeImportedResolution } from './services/importNormalize';

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
