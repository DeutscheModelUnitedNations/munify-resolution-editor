import { describe, it, expect } from 'vitest';
import { englishLabels } from './en';
import { germanLabels } from './de';
import type { ResolutionEditorLabels } from './types';

// =============================================================================
// ENGLISH LABELS TESTS
// =============================================================================

describe('English Labels', () => {
	it('should have all required keys', () => {
		const requiredKeys: (keyof ResolutionEditorLabels)[] = [
			'resolutionEditor',
			'resolution',
			'resolutionPreview',
			'resolutionShowPreview',
			'resolutionHidePreview',
			'resolutionCommittee',
			'resolutionPreambleClauses',
			'resolutionOperativeClauses',
			'resolutionSubClauses',
			'resolutionAddClause',
			'resolutionAddFirstClause',
			'resolutionDeleteClause',
			'resolutionDeleteBlock',
			'resolutionMoveUp',
			'resolutionMoveDown',
			'resolutionIndent',
			'resolutionOutdent',
			'resolutionAddSubClause',
			'resolutionAddSibling',
			'resolutionAddNested',
			'resolutionAddContinuation',
			'resolutionPreamblePlaceholder',
			'resolutionOperativePlaceholder',
			'resolutionSubClausePlaceholder',
			'resolutionContinuationPlaceholder',
			'resolutionNoPreambleClauses',
			'resolutionNoOperativeClauses',
			'resolutionNoClausesYet',
			'resolutionUnknownPhrase',
			'phraseLookup',
			'phraseLookupTitle',
			'phraseLookupSearch',
			'phraseLookupDisclaimer',
			'phraseLookupNoResults',
			'phraseCopied',
			'copyFailed',
			'resolutionImport',
			'resolutionImportPreamble',
			'resolutionImportOperative',
			'resolutionImportButton',
			'resolutionImportPreview',
			'resolutionImportHintPreamble',
			'resolutionImportHintOperative',
			'resolutionImportTipsTitle',
			'resolutionImportTipsPreamble1',
			'resolutionImportTipsPreamble2',
			'resolutionImportTipsPreamble3',
			'resolutionImportTipsOperative1',
			'resolutionImportTipsOperative2',
			'resolutionImportTipsOperative3',
			'resolutionImportTipsOperative4',
			'resolutionImportLLMTitle',
			'resolutionImportLLMInstructions',
			'resolutionImportLLMCopyPrompt',
			'resolutionImportLLMCopied',
			'resolutionImportLLMPromptPreamble',
			'resolutionImportLLMPromptOperative',
			'resolutionAuthoringDelegation',
			'resolutionDisclaimer',
			'close',
			'cancel',
			'copy'
		];

		requiredKeys.forEach((key) => {
			expect(englishLabels).toHaveProperty(key);
		});
	});

	it('should have all values as non-empty strings', () => {
		Object.values(englishLabels).forEach((value) => {
			expect(typeof value).toBe('string');
			expect(value.trim().length).toBeGreaterThan(0);
		});
	});

	it('should have no undefined values', () => {
		Object.values(englishLabels).forEach((value) => {
			expect(value).not.toBeUndefined();
		});
	});
});

// =============================================================================
// GERMAN LABELS TESTS
// =============================================================================

describe('German Labels', () => {
	it('should have all required keys', () => {
		const requiredKeys: (keyof ResolutionEditorLabels)[] = [
			'resolutionEditor',
			'resolution',
			'resolutionPreview',
			'resolutionShowPreview',
			'resolutionHidePreview',
			'resolutionCommittee',
			'resolutionPreambleClauses',
			'resolutionOperativeClauses',
			'resolutionSubClauses',
			'resolutionAddClause',
			'resolutionAddFirstClause',
			'resolutionDeleteClause',
			'resolutionDeleteBlock',
			'resolutionMoveUp',
			'resolutionMoveDown',
			'resolutionIndent',
			'resolutionOutdent',
			'resolutionAddSubClause',
			'resolutionAddSibling',
			'resolutionAddNested',
			'resolutionAddContinuation',
			'resolutionPreamblePlaceholder',
			'resolutionOperativePlaceholder',
			'resolutionSubClausePlaceholder',
			'resolutionContinuationPlaceholder',
			'resolutionNoPreambleClauses',
			'resolutionNoOperativeClauses',
			'resolutionNoClausesYet',
			'resolutionUnknownPhrase',
			'phraseLookup',
			'phraseLookupTitle',
			'phraseLookupSearch',
			'phraseLookupDisclaimer',
			'phraseLookupNoResults',
			'phraseCopied',
			'copyFailed',
			'resolutionImport',
			'resolutionImportPreamble',
			'resolutionImportOperative',
			'resolutionImportButton',
			'resolutionImportPreview',
			'resolutionImportHintPreamble',
			'resolutionImportHintOperative',
			'resolutionImportTipsTitle',
			'resolutionImportTipsPreamble1',
			'resolutionImportTipsPreamble2',
			'resolutionImportTipsPreamble3',
			'resolutionImportTipsOperative1',
			'resolutionImportTipsOperative2',
			'resolutionImportTipsOperative3',
			'resolutionImportTipsOperative4',
			'resolutionImportLLMTitle',
			'resolutionImportLLMInstructions',
			'resolutionImportLLMCopyPrompt',
			'resolutionImportLLMCopied',
			'resolutionImportLLMPromptPreamble',
			'resolutionImportLLMPromptOperative',
			'resolutionAuthoringDelegation',
			'resolutionDisclaimer',
			'close',
			'cancel',
			'copy'
		];

		requiredKeys.forEach((key) => {
			expect(germanLabels).toHaveProperty(key);
		});
	});

	it('should have all values as non-empty strings', () => {
		Object.values(germanLabels).forEach((value) => {
			expect(typeof value).toBe('string');
			expect(value.trim().length).toBeGreaterThan(0);
		});
	});

	it('should have no undefined values', () => {
		Object.values(germanLabels).forEach((value) => {
			expect(value).not.toBeUndefined();
		});
	});
});

// =============================================================================
// CONSISTENCY TESTS
// =============================================================================

describe('Label Consistency', () => {
	it('should have same keys in both languages', () => {
		const englishKeys = Object.keys(englishLabels).sort();
		const germanKeys = Object.keys(germanLabels).sort();

		expect(englishKeys).toEqual(germanKeys);
	});

	it('should have same number of labels in both languages', () => {
		const englishCount = Object.keys(englishLabels).length;
		const germanCount = Object.keys(germanLabels).length;

		expect(englishCount).toBe(germanCount);
	});

	it('should have different translations (not just copied English)', () => {
		// Check that at least some labels are actually translated
		const translatedLabels = Object.keys(englishLabels).filter(
			(key) =>
				englishLabels[key as keyof typeof englishLabels] !==
				germanLabels[key as keyof typeof germanLabels]
		);

		// Most labels should be different between languages
		expect(translatedLabels.length).toBeGreaterThan(Object.keys(englishLabels).length * 0.5);
	});

	it('should preserve placeholders in translations', () => {
		// Check that {count} and {conferenceName} placeholders are preserved
		const englishWithPlaceholders = Object.entries(englishLabels).filter(([, value]) =>
			value.includes('{')
		);

		englishWithPlaceholders.forEach(([key, englishValue]) => {
			const germanValue = germanLabels[key as keyof typeof germanLabels];
			const englishPlaceholders = englishValue.match(/\{[^}]+\}/g) || [];
			const germanPlaceholders = germanValue.match(/\{[^}]+\}/g) || [];

			expect(germanPlaceholders.sort()).toEqual(englishPlaceholders.sort());
		});
	});
});
