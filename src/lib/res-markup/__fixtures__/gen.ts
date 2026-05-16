/**
 * Deterministic generator of schema-valid Resolutions for the round-trip
 * property test. No external deps; structures are produced already-clean
 * (no adjacent same-kind blocks, no empty chapeaux, depth ≤ 4, prose with
 * no leading marker characters) so `structuralEqual` is well-defined.
 */

import {
	createSubclausesBlock,
	createTextBlock,
	generateClauseId,
	generateSubClauseId,
	type ClauseBlock,
	type OperativeClause,
	type Resolution,
	type ResolutionHeaderData,
	type SubClause
} from '../../schema/resolution';

function mulberry32(seed: number): () => number {
	let a = seed >>> 0;
	return () => {
		a |= 0;
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

const WORDS =
	'assembly council reaffirms recalls decides requests urges noting that the all member states report within days commission funding budget matter situation observers review confidentiality recommendations annually concrete necessary regular actively seized'.split(
		' '
	);

export function makeResolution(seed: number): {
	resolution: Resolution;
	header: ResolutionHeaderData;
} {
	const rnd = mulberry32(seed);
	const pick = (n: number) => Math.floor(rnd() * n);
	const phrase = (min: number, max: number) => {
		const n = min + pick(max - min + 1);
		const out: string[] = [];
		for (let i = 0; i < n; i++) out.push(WORDS[pick(WORDS.length)]);
		return out.join(' ');
	};

	const buildClause = (depth: number, top: boolean): OperativeClause | SubClause => {
		const blocks: ClauseBlock[] = [createTextBlock(phrase(3, 10))];
		let lastSub = false;
		const groups = pick(depth >= 4 ? 1 : 3); // 0..2 sub/closing groups
		for (let g = 0; g < groups; g++) {
			if (depth < 4 && !lastSub) {
				const items: SubClause[] = [];
				const count = 1 + pick(3);
				for (let k = 0; k < count; k++) {
					items.push(buildClause(depth + 1, false) as SubClause);
				}
				blocks.push(createSubclausesBlock(items));
				lastSub = true;
				if (rnd() < 0.5) {
					blocks.push(createTextBlock(phrase(3, 8))); // closing text
					lastSub = false;
				}
			}
		}
		return top ? { id: generateClauseId('o'), blocks } : { id: generateSubClauseId(), blocks };
	};

	const preambleCount = pick(4);
	const resolution: Resolution = {
		committeeName: phrase(1, 3),
		preamble: Array.from({ length: preambleCount }, () => ({
			id: generateClauseId('p'),
			content: phrase(4, 12)
		})),
		operative: Array.from({ length: 1 + pick(4) }, () => buildClause(0, true) as OperativeClause)
	};

	const header: ResolutionHeaderData = {};
	if (rnd() < 0.7) header.committeeResolutionHeadline = phrase(1, 4).toUpperCase();
	if (rnd() < 0.5) header.committeeAbbreviation = 'GA';
	if (rnd() < 0.5) header.documentNumber = 'A/RES/' + (66 + pick(10)) + '/1';
	if (rnd() < 0.5) header.sponsoringDelegations = ['Germany', 'France'];
	if (rnd() < 0.4) header.topic = phrase(2, 5);

	return { resolution, header };
}
