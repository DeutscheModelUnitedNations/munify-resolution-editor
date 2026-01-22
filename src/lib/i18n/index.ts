/**
 * Resolution Editor i18n Module
 *
 * Exports types and utility functions for internationalization.
 */

export type { ResolutionEditorLabels, PartialLabels } from './types';
export { englishLabels } from './en';
export { germanLabels } from './de';

import type { ResolutionEditorLabels, PartialLabels } from './types';
import { englishLabels } from './en';

/**
 * Default labels - English
 */
export const defaultLabels = englishLabels;

/**
 * Merge partial labels with defaults.
 * Uses English labels as the default base.
 */
export function mergeLabels(
	partial: PartialLabels = {},
	defaults: ResolutionEditorLabels = englishLabels
): ResolutionEditorLabels {
	return { ...defaults, ...partial };
}

/**
 * Create a label function that handles interpolation.
 * Replaces {key} placeholders with values from the params object.
 */
export function createLabelFunction(labels: ResolutionEditorLabels) {
	return function t(key: keyof ResolutionEditorLabels, params?: Record<string, string | number>) {
		let text = labels[key];
		if (params) {
			for (const [k, v] of Object.entries(params)) {
				text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
			}
		}
		return text;
	};
}
