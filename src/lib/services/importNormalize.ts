/**
 * Editor-import normalization.
 *
 * RES-Markup preserves trailing punctuation as content (lossless
 * round-trip). The resolution *preview*, however, auto-appends the
 * terminal punctuation itself (preamble `,`; operative / sub-clauses `;`
 * or a final `.`). So when a whole resolution is imported into the
 * editor we strip any trailing run of `, ; .` — including repeats such as
 * `,,` or mixed `;.` — to avoid doubled punctuation in the rendered
 * document.
 */

import type { OperativeClause, Resolution, SubClause } from '../schema/resolution';

const TRAILING_PUNCTUATION = /[\s,;.]*[,;.][\s,;.]*$/u;

/** Remove a trailing run of commas / semicolons / periods (and spaces). */
export function stripTerminalPunctuation(s: string): string {
	return s.replace(TRAILING_PUNCTUATION, '');
}

function normalizeClause<T extends OperativeClause | SubClause>(clause: T): T {
	return {
		...clause,
		blocks: clause.blocks.map((b) =>
			b.type === 'text'
				? { ...b, content: stripTerminalPunctuation(b.content) }
				: { ...b, items: b.items.map(normalizeClause) }
		)
	};
}

/** Strip terminal punctuation from every clause/sub-clause text + committee name. */
export function normalizeImportedResolution(r: Resolution): Resolution {
	return {
		committeeName: stripTerminalPunctuation(r.committeeName),
		preamble: r.preamble.map((p) => ({
			...p,
			content: stripTerminalPunctuation(p.content)
		})),
		operative: r.operative.map(normalizeClause)
	};
}
