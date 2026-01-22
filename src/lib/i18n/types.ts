/**
 * Resolution Editor i18n Labels
 *
 * All translatable strings used in the Resolution Editor components.
 * Consumers can provide partial overrides - missing keys will use defaults.
 */

export interface ResolutionEditorLabels {
	// Editor chrome
	resolutionEditor: string;
	resolution: string;
	resolutionPreview: string;
	resolutionShowPreview: string;
	resolutionHidePreview: string;

	// Sections
	resolutionCommittee: string;
	resolutionPreambleClauses: string;
	resolutionOperativeClauses: string;
	resolutionSubClauses: string;

	// Actions
	resolutionAddClause: string;
	resolutionAddFirstClause: string;
	resolutionDeleteClause: string;
	resolutionDeleteBlock: string;
	resolutionMoveUp: string;
	resolutionMoveDown: string;
	resolutionIndent: string;
	resolutionOutdent: string;
	resolutionAddSubClause: string;
	resolutionAddSibling: string;
	resolutionAddNested: string;
	resolutionAddContinuation: string;

	// Placeholders
	resolutionPreamblePlaceholder: string;
	resolutionOperativePlaceholder: string;
	resolutionSubClausePlaceholder: string;
	resolutionContinuationPlaceholder: string;

	// Empty states
	resolutionNoPreambleClauses: string;
	resolutionNoOperativeClauses: string;
	resolutionNoClausesYet: string;

	// Validation
	resolutionUnknownPhrase: string;

	// Phrase lookup
	phraseLookup: string;
	phraseLookupTitle: string;
	phraseLookupSearch: string;
	phraseLookupDisclaimer: string;
	phraseLookupNoResults: string;
	phraseCopied: string;
	copyFailed: string;

	// Import
	resolutionImport: string;
	resolutionImportPreamble: string;
	resolutionImportOperative: string;
	resolutionImportButton: string;
	resolutionImportPreview: string;
	resolutionImportHintPreamble: string;
	resolutionImportHintOperative: string;
	resolutionImportTipsTitle: string;
	resolutionImportTipsPreamble1: string;
	resolutionImportTipsPreamble2: string;
	resolutionImportTipsPreamble3: string;
	resolutionImportTipsOperative1: string;
	resolutionImportTipsOperative2: string;
	resolutionImportTipsOperative3: string;
	resolutionImportTipsOperative4: string;
	resolutionImportLLMTitle: string;
	resolutionImportLLMInstructions: string;
	resolutionImportLLMCopyPrompt: string;
	resolutionImportLLMCopied: string;
	resolutionImportLLMPromptPreamble: string;
	resolutionImportLLMPromptOperative: string;

	// Preview metadata
	resolutionAuthoringDelegation: string;
	resolutionDisclaimer: string;

	// Common
	close: string;
	cancel: string;
	copy: string;
}

/**
 * Type for partial label overrides
 */
export type PartialLabels = Partial<ResolutionEditorLabels>;
