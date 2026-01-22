/**
 * English Default Labels for Resolution Editor
 */

import type { ResolutionEditorLabels } from './types';

export const englishLabels: ResolutionEditorLabels = {
	// Editor chrome
	resolutionEditor: 'Resolution Editor',
	resolution: 'Resolution',
	resolutionPreview: 'Preview',
	resolutionShowPreview: 'Show Preview',
	resolutionHidePreview: 'Hide Preview',

	// Sections
	resolutionCommittee: 'Committee',
	resolutionPreambleClauses: 'Preamble Clauses',
	resolutionOperativeClauses: 'Operative Clauses',
	resolutionSubClauses: 'Sub-clauses',

	// Actions
	resolutionAddClause: 'Add Clause',
	resolutionAddFirstClause: 'Add First Clause',
	resolutionDeleteClause: 'Delete',
	resolutionDeleteBlock: 'Delete Block',
	resolutionMoveUp: 'Move Up',
	resolutionMoveDown: 'Move Down',
	resolutionIndent: 'Indent',
	resolutionOutdent: 'Outdent',
	resolutionAddSubClause: 'Sub-clause',
	resolutionAddSibling: 'Add Clause',
	resolutionAddNested: 'Nested Clause',
	resolutionAddContinuation: 'Continuation Text',

	// Placeholders
	resolutionPreamblePlaceholder: 'Enter preamble clause...',
	resolutionOperativePlaceholder: 'Enter operative clause...',
	resolutionSubClausePlaceholder: 'Enter sub-clause...',
	resolutionContinuationPlaceholder: 'Enter continuation text...',

	// Empty states
	resolutionNoPreambleClauses: 'No preamble clauses yet.',
	resolutionNoOperativeClauses: 'No operative clauses yet.',
	resolutionNoClausesYet: 'No clauses yet.',

	// Validation
	resolutionUnknownPhrase: 'Unknown phrase',

	// Phrase lookup
	phraseLookup: 'Phrases',
	phraseLookupTitle: 'Phrase Reference',
	phraseLookupSearch: 'Search phrases...',
	phraseLookupDisclaimer:
		'These phrases are provided as guidance. Please verify correct usage in context.',
	phraseLookupNoResults: 'No phrases found.',
	phraseCopied: 'Phrase copied!',
	copyFailed: 'Copy failed',

	// Import
	resolutionImport: 'Import',
	resolutionImportPreamble: 'Import Preamble Clauses',
	resolutionImportOperative: 'Import Operative Clauses',
	resolutionImportButton: 'Import {count} clause(s)',
	resolutionImportPreview: 'Preview: {count} clause(s) detected',
	resolutionImportHintPreamble:
		'Paste preamble clauses, separated by comma and line break.',
	resolutionImportHintOperative:
		'Paste numbered operative clauses. Sub-clauses will be detected automatically.',
	resolutionImportTipsTitle: 'Tips for Best Results',
	resolutionImportTipsPreamble1: 'Each clause should end with a comma',
	resolutionImportTipsPreamble2: 'Line breaks separate individual clauses',
	resolutionImportTipsPreamble3: 'Clauses are imported in the order entered',
	resolutionImportTipsOperative1: 'Numbered main clauses: 1. 2. 3. or 1) 2) 3)',
	resolutionImportTipsOperative2: 'Lettered sub-clauses: a) b) c) or (a) (b) (c)',
	resolutionImportTipsOperative3:
		'Nested sub-clauses with Roman numerals: i) ii) iii)',
	resolutionImportTipsOperative4: 'Further nesting with double letters: aa) bb) cc)',
	resolutionImportLLMTitle: 'AI Formatting',
	resolutionImportLLMInstructions:
		'Copy the following prompt into an AI assistant to automatically format your text:',
	resolutionImportLLMCopyPrompt: 'Copy Prompt',
	resolutionImportLLMCopied: 'Copied!',
	resolutionImportLLMPromptPreamble: `Format the following text as UN resolution preamble clauses. Each clause should:
- Begin with a lowercase letter (except proper nouns)
- End with a comma
- Be separated by a line break

Example format:
recalling its resolution 70/1 of 25 September 2015,
emphasizing the importance of multilateralism,
noting with concern the current situation,

Text to format:`,
	resolutionImportLLMPromptOperative: `Format the following text as UN resolution operative clauses. Use:
- Numbering for main clauses: 1. 2. 3.
- Letters for sub-clauses: a) b) c)
- Roman numerals for further nesting: i) ii) iii)
- Double letters for deepest level: aa) bb) cc)
- Semicolon at the end of each clause, period at the end of the last

Example format:
1. Calls upon all Member States to take measures;
   a) to promote peace;
   b) to strengthen cooperation;
      i) at the bilateral level;
      ii) at the multilateral level;
2. Requests the Secretary-General to submit a report.

Text to format:`,

	// Preview metadata
	resolutionAuthoringDelegation: 'Authoring Delegation',
	resolutionDisclaimer:
		'This document was created as part of a {conferenceName} simulation and has no legal validity.',

	// Common
	close: 'Close',
	cancel: 'Cancel',
	copy: 'Copy'
};
