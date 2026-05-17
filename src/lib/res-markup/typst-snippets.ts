/**
 * Static Typst fragments for the resolution serializer.
 *
 * Centralised here so styling tweaks (font, margins, disclaimer text)
 * can be made in one place without touching the serialization logic.
 */

/** Font stack and paragraph setup applied globally to the document. */
export const FONT_SETUP = [
	`#set text(font: ("Times New Roman", "Linux Libertine", "serif"), size: 11pt, lang: "en")`,
	`#set par(justify: true)`
].join('\n');

/**
 * Page arguments that are independent of header content.
 * The running-header argument is appended conditionally by emitDocumentSetup.
 */
export const PAGE_BASE_ARGS = [
	'  paper: "a4"',
	'  margin: (top: 20mm, bottom: 20mm, left: 25mm, right: 25mm)',
	'  numbering: "1"',
	'  number-align: center + bottom'
];

/** Thin horizontal rule between the conference-title row and the emblem row. */
export const THIN_RULE = '#line(length: 100%, stroke: 0.5pt)';

/** Thick horizontal rule separating the visible header from the document body. */
export const THICK_RULE = '#line(length: 100%, stroke: 2pt)';

/** MUN simulation disclaimer rendered below the sponsoring-delegation block. */
export const MUN_DISCLAIMER = `#text(size: 7pt, fill: luma(120))[This document was created as part of a Model United Nations simulation and has no legal validity.]`;
