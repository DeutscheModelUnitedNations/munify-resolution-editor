/**
 * Bidirectional binding between a `Y.Text` and a `<textarea>`.
 *
 * - On YText changes from remote peers: refreshes the textarea's value,
 *   adjusting selection so the local user's caret stays in the right place.
 * - On user input: computes a minimal diff against the current YText and
 *   applies precise insert/delete deltas so the CRDT records granular ops.
 *
 * Concurrent edits at the same caret position resolve via Yjs's normal
 * tie-breaking; both characters end up in the YText.
 */

import * as Y from 'yjs';
import { diffApplyYText } from './conversion';

export function bindYTextToTextarea(yText: Y.Text, el: HTMLTextAreaElement): () => void {
	let isApplyingRemote = false;
	let lastValue = yText.toString();

	el.value = lastValue;

	const onYChange = (_event: Y.YTextEvent, transaction: Y.Transaction) => {
		// Ignore our own UI-originated edits — the textarea already has the value.
		// All other origins (remote provider, server-side mutations, programmatic
		// `local` mutations from other locations on this client) should refresh
		// the visible textarea.
		if (transaction.origin === 'ui') return;

		const next = yText.toString();
		if (next === el.value) {
			lastValue = next;
			return;
		}

		isApplyingRemote = true;
		try {
			const wasFocused = document.activeElement === el;
			const start = el.selectionStart ?? 0;
			const end = el.selectionEnd ?? 0;

			// Translate cursor through the diff: count how many chars before
			// `start` differ from the previous value to estimate the new caret.
			const newStart = mapCaret(lastValue, next, start);
			const newEnd = mapCaret(lastValue, next, end);

			el.value = next;
			lastValue = next;

			if (wasFocused) {
				try {
					el.selectionStart = Math.min(newStart, next.length);
					el.selectionEnd = Math.min(newEnd, next.length);
				} catch {
					// detached node, ignore
				}
			}
		} finally {
			isApplyingRemote = false;
		}
	};

	yText.observe(onYChange);

	const onInput = () => {
		if (isApplyingRemote) return;
		const next = el.value;
		if (next === lastValue) return;
		// Wrap in a transaction marked 'ui' so observers can distinguish.
		yText.doc?.transact(() => {
			diffApplyYText(yText, next);
		}, 'ui');
		lastValue = next;
	};

	el.addEventListener('input', onInput);
	el.addEventListener('compositionend', onInput);

	return () => {
		yText.unobserve(onYChange);
		el.removeEventListener('input', onInput);
		el.removeEventListener('compositionend', onInput);
	};
}

/**
 * Map a caret position through a diff between `before` and `after`.
 * Heuristic: locate the caret relative to the common prefix and suffix.
 */
function mapCaret(before: string, after: string, pos: number): number {
	if (before === after) return pos;

	let prefixEnd = 0;
	const minLen = Math.min(before.length, after.length);
	while (prefixEnd < minLen && before[prefixEnd] === after[prefixEnd]) prefixEnd++;

	let suffixLenBefore = 0;
	let suffixLenAfter = 0;
	while (
		suffixLenBefore < before.length - prefixEnd &&
		suffixLenAfter < after.length - prefixEnd &&
		before[before.length - 1 - suffixLenBefore] === after[after.length - 1 - suffixLenAfter]
	) {
		suffixLenBefore++;
		suffixLenAfter++;
	}

	if (pos <= prefixEnd) return pos;
	if (pos >= before.length - suffixLenBefore) {
		return after.length - (before.length - pos);
	}
	// Caret was inside the changed region — clamp to the new region's end.
	return after.length - suffixLenAfter;
}
