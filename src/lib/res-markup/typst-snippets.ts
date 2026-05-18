/**
 * Static Typst fragments for the resolution serializer.
 *
 * Centralised here so styling tweaks (font, margins, disclaimer text)
 * can be made in one place without touching the serialization logic.
 */

/**
 * Style configuration dict emitted at the top of every generated .typ file.
 * All visual parameters live here — anyone who downloads the .typ can tweak
 * them without touching the data sections below.
 */
export const STYLE_CONFIG = `\
// ── Stil — hier anpassen ─────────────────────────────────────────────────────
#let s = (
  font:             ("Times New Roman", "Linux Libertine", "serif"),
  body-size:        11pt,
  indent:           1.5em,
  margin:           (top: 20mm, bottom: 20mm, left: 25mm, right: 25mm),
  header-name-size: 18pt,
  header-meta-size: 9pt,
  disclaimer-size:  7pt,
  disclaimer-color: luma(120),
  thin-stroke:      0.5pt,
  thick-stroke:     2pt,
  clause-gap:       4pt,
  section-gap:      12pt,
)`;

/**
 * Typst helper functions for each block type.
 * All layout details are expressed via `s.*` so changing the style config
 * above automatically affects every rendered block.
 *
 *   pre-clause   — preamble clause (italic, trailing comma)
 *   op-clause    — top-level operative clause ("1. FirstWord rest;")
 *   sc-clause    — labelled subclause at any depth ("(a) content;")
 *   cont-clause  — unlabelled continuation text within a clause
 *   meta-row     — metadata row (authoring / sponsoring delegations)
 */
export const BLOCK_RENDERERS = `\
// ── Block-Renderer ────────────────────────────────────────────────────────────
#let pre-clause(content) = par(
  first-line-indent: s.indent,
)[#emph[#content,]]

#let op-clause(number, first-word, rest, punct) = par(
  first-line-indent: s.indent,
)[*#number.* #emph[#first-word]#rest#punct]

#let sc-clause(label, content, depth, punct) = pad(
  left: s.indent * depth,
)[#par[#label #content#punct]]

#let cont-clause(content, depth, punct) = pad(
  left: s.indent * depth,
)[#par[#content#punct]]

#let meta-row(label, value) = [
  #text(weight: "bold", size: s.header-meta-size)[#label]
  #v(1pt)
  #pad(left: 4pt)[#value]
]`;

/** Page arguments that don't vary by header content. References s.margin. */
export const PAGE_BASE_ARGS = [
	'  paper: "a4"',
	'  margin: s.margin',
	'  numbering: "1"',
	'  number-align: center + bottom'
];

/** Font and paragraph setup; references s.font and s.body-size. */
export const FONT_SETUP = [
	`#set text(font: s.font, size: s.body-size, lang: "en")`,
	`#set par(justify: true)`
].join('\n');

/** Thin horizontal rule (between conference-title row and emblem row). */
export const THIN_RULE = '#line(length: 100%, stroke: s.thin-stroke)';

/** Thick horizontal rule separating the visible header from the document body. */
export const THICK_RULE = '#line(length: 100%, stroke: s.thick-stroke)';

/** MUN simulation disclaimer rendered below the sponsoring-delegation block. */
export const MUN_DISCLAIMER = `#text(size: s.disclaimer-size, fill: s.disclaimer-color)[This document was created as part of a Model United Nations simulation and has no legal validity.]`;
