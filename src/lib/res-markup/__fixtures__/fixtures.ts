/** Canonical / corpus fixtures for RES-Markup tests. */

// grammar.md §8.1 — already in canonical form.
export const MINIMAL = `%RES 1.0

Committee: General Assembly

== Header ==

THE GENERAL ASSEMBLY,

== Preamble ==

- Reaffirming the Charter of the United Nations,

== Operative ==

[CLAUSE]
Calls upon all Member States to honour their obligations;
`;

// grammar.md §8.2 — the hard recursive case, wrapped in a full document.
export const HARD_CASE = `%RES 1.0

Committee: General Assembly

== Header ==

THE GENERAL ASSEMBLY,

== Preamble ==

- Recalling everything,

== Operative ==

[CLAUSE]
decides to
  - establish an independent commission that
    -- reports annually to the General Assembly;
    -- issues concrete recommendations;
  -> while preserving the confidentiality of sources;
  - secures the necessary funding from the regular budget;
> and to remain actively seized of the matter;

[CLAUSE]
requests the Secretary-General to report within 90 days.
`;

// grammar.md §8.3 — lenient input and its EXACT expected canonical output.
export const LENIENT_INPUT = `# Draft for SC review — do not circulate
# author: DEU delegation
%res 1.0
Committee: Security Council
CommitteeAbbreviation: SC
== header ==
The Security Council
== preamble ==
- Recalling its resolution 2025 (2026),
== operative ==
[clause]
1. Demands an immediate ceasefire;
# TODO: confirm the deployment timeline with legal
[clause]
2. Decides to
- a) deploy observers;
- b) review the situation;
`;

export const LENIENT_CANONICAL = `%RES 1.0

Committee:             Security Council
CommitteeAbbreviation: SC

== Header ==

The Security Council,

== Preamble ==

- Recalling its resolution 2025 (2026),

== Operative ==

[CLAUSE]
Demands an immediate ceasefire;

[CLAUSE]
Decides to
  - deploy observers;
  - review the situation;
`;

// grammar.md §8.4 — clause fragment (no [CLAUSE] line).
export const FRAGMENT = `Decides to
  - deploy observers within 30 days;
  - review the situation quarterly;
> and to remain actively seized of the matter;
`;

// USER_GUIDE.md — the self-referential resolution.
export const SELF_REFERENTIAL = `# This file is a resolution about the format it is written in.
# Edit it freely — the comments, including this one, are dropped on export.
%RES 1.0

Conference:            Model United Nations of Markup Languages 2026
Committee:             General Assembly of Resolution Editors
CommitteeAbbreviation: GARE
DocumentNumber:        GARE/RES/1.0
Topic:                 Adoption of the RES-Markup Interchange Format
AuthoringDelegation:   The Delegation of Tired Drafters
SponsoringDelegations: Humans, Large Language Models, Parsers

== Header ==

THE GENERAL ASSEMBLY OF RESOLUTION EDITORS,

== Preamble ==

- Recalling that no delegate has ever enjoyed renumbering forty operative
  paragraphs at 3 a.m.,

- Deeply concerned by the proliferation of slightly-different JSON blobs,

- Noting with approval that hyphens are very easy to count,

- Bearing in mind that whitespace should never decide a vote,

== Operative ==

[CLAUSE]
Adopts the RES-Markup format for all resolution interchange;

[CLAUSE]
Affirms that every operative clause opens with a solo [CLAUSE] line, so
that a single clause can be lifted out for an amendment by deleting just
that one line;

[CLAUSE]
Decides that nesting shall be expressed by counting hyphens, and in
particular
- that one hyphen marks the first sub-level,
- and that going deeper merely adds a hyphen,
-- as in this second level,
-- which the editor will label automatically;
-> recalling that four hyphens is the deepest a clause may go;
> and resolves that indentation is purely decorative, to be ignored by
machines and happily abused by humans;

[CLAUSE]
Requests that delegations stop typing "1.", "(a)" and "(iii)" by hand,
as these are politely discarded on import;

[CLAUSE]
Encourages liberal use of # comment lines while drafting, recalling that
they vanish on export and therefore embarrass no one;

[CLAUSE]
Remains actively seized of the matter, in this and all future versions.
`;

export const CANONICAL_CORPUS = [MINIMAL, LENIENT_CANONICAL];
export const PARSEABLE_CORPUS = [
	MINIMAL,
	HARD_CASE,
	LENIENT_INPUT,
	LENIENT_CANONICAL,
	SELF_REFERENTIAL
];
