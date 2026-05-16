# RES-Markup — Format Specification

**Version:** 1.0
**Status:** Draft for review (no implementation yet)
**Scope:** Import/export interchange format for a single `Resolution`
including `ResolutionHeaderData`. The authoritative data model is
`src/lib/schema/resolution.ts`.

This specification is written in English; RES-Markup is an international
format and all of its keywords are English.

---

## 1. Purpose & design principles

RES-Markup is a line-oriented plain-text format with three equally
important audiences:

1. **Humans** — readable and editable; a file looks like the finished
   resolution.
2. **LLMs** — robustly writable; structure is conveyed purely through
   line-leading **markers**, never through whitespace.
3. **Programs** — unambiguously parseable, validatable and serializable;
   every file maps losslessly onto the `Resolution` schema.

Core principles:

- **Markers determine both *kind* and *depth*; indentation is
  non-significant.** Top-level operative clauses are delimited by a solo
  `[CLAUSE]` tag; sub-clause depth is the number of leading `-`; a closing
  text block carries its clause's own hyphen prefix plus `>`. Whitespace,
  copy-paste reflow and leading-space drift can never change structure.
- **No ordinals in the format.** There are no `1.` / `(a)` / `(i)`
  labels. Display labels are derived from depth and index via
  `getSubClauseLabel` — they are not part of the interchange format. This
  removes the entire class of "how do I number the next level" mistakes.
- **Operative clauses are self-delimiting.** Because each top-level clause
  starts with `[CLAUSE]`, a single clause can be excerpted by removing
  that one line; the remainder is a valid *clause fragment*
  (`parseClauseFragment`, §10) yielding exactly one `OperativeClause` —
  the shape of `AmendmentOverlay.newContent`.
- **Lenient on input, canonical on output.** The parser ignores all
  indentation and accepts loose section casing, alternate blank-line
  spacing and stray ordinals. The serializer emits exactly one canonical
  form (which *does* indent, purely for human readability — §5).
- **Validity is programmatically decidable** (§7).
- **IDs are not content.** `parse` mints fresh IDs; `serialize` never emits
  IDs. Cursor/collaboration preservation is the job of `replaceResolution`,
  not of this format. Amendment targeting uses `targetOperativeIndex` /
  `targetClauseId` in the JSON channel — `[CLAUSE]` stays argument-free.

Deliberately **out of v1**: amendments (`AmendmentOverlay`), internal IDs,
comment syntax, embedded conference emblem. Rationale in §9.

### 1.1 Why these markers

- **`[CLAUSE]` (solo) for operative clauses:** an explicit, unmissable
  top-level boundary that does not depend on blank lines, and that makes
  single-clause excerpting trivial (drop the line ⇒ fragment).
- **Hyphen run for sub-clause depth:** marker-counted depth keeps the
  format whitespace-insensitive; LLMs emit small repetitions reliably (like
  Markdown heading levels). Because `[CLAUSE]` absorbs the top level, the
  common single-sub-level case is just `-` and the maximum is `----`.
- **`<prefix>>` for closing text:** the closing marker reuses the *opening
  hyphen prefix of the clause it closes*, plus `>`. So a `-` clause's
  trailing text is `->`, a `--` clause's is `-->`, and the `[CLAUSE]`'s own
  is `>`. No new counting rule to learn (prefix = the clause's own marker),
  and `>` reads naturally as "…then / back to" — exactly the meaning of a
  closing sentence such as "…and decides to remain seized of the matter".

---

## 2. Lexical structure

- **Encoding:** UTF-8.
- **Line endings:** `CRLF`/`CR` normalized to `LF` on read. Canonical
  output uses `LF` only.
- **Trailing whitespace** on every line is discarded on read.
- **Leading whitespace is non-significant** and discarded before marker
  detection. (The canonical serializer re-adds cosmetic indentation; §5.)
- **Logical line:** a marker line plus any directly following
  *continuation lines* (non-blank lines that do not start with a marker, no
  blank line in between). Contents are joined with exactly one space
  (`U+0020`). Exception: the `[CLAUSE]` tag is *solo* — the chapeau is the
  logical line(s) that follow it.
- **Blank line:** empty after trimming; terminates a logical line / block.
  Consecutive blank lines are equivalent to one. Blank lines never affect
  structure (clause boundaries are `[CLAUSE]` / section / EOF).

### 2.1 Markers (line-leading, after stripped indentation)

| Marker | Meaning | Canonical regex |
|---|---|---|
| `%RES <ver>` | Format header, **required, line 1** | `^%RES \d+\.\d+$` |
| `Key: Value` | Front-matter pair (only before the first section) | `^[A-Za-z][A-Za-z0-9]*: .*$` |
| `== <Section> ==` | Section heading; also ends front-matter | `^== .+ ==$` |
| `[CLAUSE]` | Operative clause start (**solo line**) | `^\[CLAUSE\]$` |
| `-` … `----` + space | Sub-clause item; **depth = hyphen run length (1–4)** | `^-{1,4} \S` |
| `>` , `->` … `--->` + space | Closing text; **hyphen prefix = the closed clause's own marker** | `^-{0,3}> \S` |

- A marker run is consecutive hyphens with **no internal spaces**.
- Sub-clause item = hyphens **then a space**; closing text = hyphens
  **then `>`** then a space. `- x` is a depth-1 item; `-> x` is a closing
  text for a depth-1 clause; `> x` is a closing text for the `[CLAUSE]`.
  These are mutually exclusive by construction.
- Front-matter ends at the first `== … ==` heading. There is **no** `---`
  terminator.
- Escaping: if a content line must literally begin with a marker form,
  prefix one backslash `\`; the parser strips exactly one leading `\`.
  (Resolution prose effectively never starts a line with `[`, `-` + space
  or `>`.)

---

## 3. Grammar (EBNF)

Notation: `{ x }` = 0..n, `[ x ]` = optional, `|` = alternative, `" "` =
literal, `NL` = newline, `TEXT` = non-empty joined content of a logical
line. `DASH(d)` = exactly `d` hyphens.

```ebnf
document          = "%RES " version NL { blankline }
                    { kv-pair }
                    header-section
                    preamble-section
                    operative-section ;

version           = digit { digit } "." digit { digit } ;
kv-pair           = key ": " value NL ;
key               = letter { letter | digit } ;
value             = { any-char-except-NL } ;

header-section    = "== Header ==" NL { blankline }
                    TEXT NL { blankline } ;            (* the body headline *)

preamble-section  = "== Preamble ==" NL { blankline }
                    { preamble-clause } ;
preamble-clause   = DASH(1) " " TEXT NL { blankline } ;  (* flat: 1 hyphen only *)

operative-section = "== Operative ==" NL { blankline }
                    { clause } ;

(* A clause maps to one OperativeClause. blocks[] order is preserved. *)
clause            = "[CLAUSE]" NL { blankline }
                    TEXT NL                              (* chapeau = 1st TextBlock *)
                    clause-body(0) ;

(* clause-body(d): interior of the clause at clause-depth d.
   d = 0 is the [CLAUSE] level; sub-clauses have d = 1..4. *)
clause-body(d)    = { sublist(d+1) | closing-text(d) } ;
sublist(k)        = subclause(k) { subclause(k) } ;
subclause(k)      = DASH(k) " " TEXT NL clause-body(k) ;  (* chapeau = 1st TextBlock *)
closing-text(d)   = DASH(d) ">" " " TEXT NL { blankline } ;

blankline         = NL ;
```

### 3.1 Depth rules

- `[CLAUSE]` = `OperativeClause` = **clause-depth 0**. A sub-clause with
  `k` hyphens is **clause-depth k**, mapping to `SubClause` at sub-clause
  nesting `k`.
- `MAX_SUBCLAUSE_DEPTH = 4` ⇒ maximum **4 hyphens** (`----`). More →
  `ERR_DEPTH_EXCEEDED`.
- A child sub-clause must have exactly `parent + 1` hyphens. A jump (e.g.
  `-` directly to `---`) is `ERR_DEPTH_SKIP`. Fewer-or-equal hyphens means
  "pop to that depth and continue as a sibling".
- Display labels (`(a)`, `(i)`, `(aa)`, `(aaa)`) are **not** present; the
  editor derives them from depth and index via `getSubClauseLabel`.
- Preamble items are **flat**: a preamble line with more than one hyphen,
  or a `[CLAUSE]`/closing marker, is `ERR_PREAMBLE_NESTING`.
- `[CLAUSE]` outside the operative section is
  `ERR_CLAUSE_OUTSIDE_OPERATIVE`.

### 3.2 Closing-text attachment (unambiguous by hyphen prefix)

`closing-text(d)` is written as `DASH(d) ">"` — i.e. the **same hyphen
prefix as the clause it closes**, followed by `>`:

| Marker | Closes clause at | Which clause |
|---|---|---|
| `>` | depth 0 | the `[CLAUSE]` itself |
| `->` | depth 1 | the enclosing `-` sub-clause |
| `-->` | depth 2 | the enclosing `--` sub-clause |
| `--->` | depth 3 | the enclosing `---` sub-clause |

A `DASH(d)>` line appends a trailing `TextBlock` to the nearest open
clause at depth `d`. The hyphen count alone determines attachment; no
whitespace or position heuristic is involved. Maximum prefix is `--->`
(depth 3): a depth-4 clause cannot have a sub-list — its children would be
depth 5 > `MAX_SUBCLAUSE_DEPTH` — so it never has a closing text. If no
open clause at depth `d` exists → `ERR_ORPHAN_TAIL`.

This disambiguates every case purely by marker:

- chapeau continuation → no marker;
- a deeper item → more hyphens **+ space**;
- a closing sentence of *this* clause → its own prefix **+ `>`**;
- a closing sentence of an *outer* clause → a shorter prefix **+ `>`**.

---

## 4. Mapping onto the schema

### 4.1 Front-matter → `ResolutionHeaderData`

| RES key | Target field | Transformation |
|---|---|---|
| `Conference` | `header.conferenceName` | string |
| `ConferenceTitle` | `header.conferenceTitle` | string |
| `Committee` | `header.committeeAbbreviation` | string |
| `CommitteeFullName` | `header.committeeFullName` | string |
| `DocumentNumber` | `header.documentNumber` | string |
| `Topic` | `header.topic` | string |
| `AuthoringDelegation` | `header.authoringDelegation` | string |
| `SponsoringDelegations` | `header.sponsoringDelegations` | split on `,`, each trimmed, empties dropped → `string[]` |
| `LastEdited` | `header.lastEdited` | ISO-8601 string, passed through (schema allows `Date \| string`) |

- Front-matter is every `Key: Value` line between `%RES …` and the first
  `== … ==` heading. Unknown keys: reported in `warnings`, otherwise
  ignored (forward-compatible, LLM-tolerant).
- `header.conferenceEmblem` is **not** a RES key in v1 (§9).

### 4.2 `== Header ==` → body headline

The single logical line in `== Header ==` (e.g. `THE GENERAL ASSEMBLY`,
`The Security Council`) maps to **both** `Resolution.committeeName`
**and** `header.committeeResolutionHeadline`. On serialize the value is
taken from `committeeResolutionHeadline ?? committeeName`. Empty →
`WARN_EMPTY_HEADER`.

### 4.3 Body → `Resolution`

- Each `preamble-clause` → one `PreambleClause` with `content = TEXT`.
- Each `clause` (`[CLAUSE]` + body) → one `OperativeClause`; the chapeau
  → first `TextBlock` (satisfies the "first block is text" invariant).
- A `sublist` → one `SubclausesBlock`; each `subclause` recursively a
  `SubClause` with its own `blocks[]`.
- Each `closing-text` → a further `TextBlock` on the addressed clause, in
  source order.
- Adjacent same-kind blocks are merged via `cleanupBlocks`.
- IDs (`generateClauseId`, `generateSubClauseId`, `generateBlockId`) are
  freshly minted on parse.

---

## 5. Canonical serialization (deterministic)

The canonical form is the only output the serializer produces and the
basis of the idempotence test (7.3).

1. Line 1: `%RES 1.0`, then one blank line.
2. Front-matter: only **present** keys, in the order of table 4.1. Every
   value starts at column `maxKeyLen + 2` (longest present key;
   deterministic ⇒ idempotent). `SponsoringDelegations` emitted as a
   `, `-separated list.
3. `== Header ==`, blank line, headline line, blank line. Always emitted.
4. `== Preamble ==`, blank line, each clause `- ` + content, blank line.
   Always emitted, even if empty.
5. `== Operative ==`, blank line, then the clauses, one blank line
   between clauses.
6. **Markers:** each clause begins with a solo `[CLAUSE]` line; the
   chapeau follows on the next line. A sub-clause at depth `d` is written
   with `d` hyphens; a closing text of a depth-`d` clause with `DASH(d)>`;
   one space then content. Empty chapeau: an empty line after `[CLAUSE]`,
   plus `WARN_EMPTY_CHAPEAU`.
7. **Cosmetic indentation (parser-ignored, but deterministic so still
   idempotent):** `[CLAUSE]` and its chapeau at column 0. A depth-`d`
   sub-clause item at column `d × 2`. A closing text aligns with the
   clause it closes: depth 0 → column 0; depth `d ≥ 1` → column `d × 2`.
8. **Wrapping:** canonical width = **80** columns. Greedy, break only at
   `U+0020`, never split a token. Continuation lines are indented to the
   line's content column. Fully determined ⇒ `parse ∘ serialize` is
   byte-stable.
9. Exactly one trailing `LF`; no trailing whitespace.

---

## 6. Lenient input (beyond the canonical form)

The parser additionally accepts and normalizes to schema:

- **All leading indentation is ignored** — structure comes solely from
  `[CLAUSE]` / hyphen / `>` markers. Tabs and any space amount are
  harmless.
- **Stray ordinals** an author leaves at the start of content (`1.`,
  `a)`, `(i)`, `2026.`) are stripped — order is positional, the display
  label is derived from depth.
- **Blank lines:** optional / repeated anywhere; never structural.
- **Front-matter:** any whitespace around `:`; keys matched
  case-insensitively, re-serialized in canonical casing.
- **Section headings:** `== Header ==`, `== Preamble ==`,
  `== Operative ==` matched case-insensitively. No localized aliases in v1
  (international format, English keywords only).
- **`[CLAUSE]`** matched case-insensitively, surrounding spaces tolerated
  (`[clause]`, `[ CLAUSE ]`).
- **Trailing punctuation** (`,` `;` `.`) is **preserved** — it is
  resolution content (unlike the legacy `resolutionParser.ts`).

The parser does **not** repair (→ errors, §7): hyphen run > 4, depth skip,
nested preamble item, `>` with no matching open clause, missing `%RES`, a
pre-section line that is neither `Key: Value` nor blank, `[CLAUSE]`
outside the operative section.

---

## 7. Validity (programmatically decidable)

`validate(text)` is `valid` iff all four stages pass:

### 7.1 Syntax stage
Tokenizer/parser complete without a `ResError` (see catalog).

### 7.2 Structural stage
- `ResolutionSchema.safeParse(result)` (Zod) succeeds.
- Every `OperativeClause`/`SubClause`: `blocks[0].type === 'text'`.
- Max nesting depth ≤ `MAX_SUBCLAUSE_DEPTH` (4) ⇒ ≤ 4 hyphens.
- **Warnings** (valid but reported): empty chapeau; empty header; unknown
  front-matter key; empty section.

### 7.3 Idempotence stage
With `S = serialize ∘ parse`: required `S(S(text)) === S(text)`
(byte-identical).

### 7.4 Round-trip stage (model fidelity)
For any schema-valid `Resolution R` (IDs normalized):
`parse(serialize(R)).resolution` is **structurally equal** to `R`
(IDs excluded; `cleanupBlocks` applied on both sides). The same property
holds per clause for `parseClauseFragment ∘ serializeClause`.

### Error catalog (`ResError`, each with line/column)

| Code | Condition |
|---|---|
| `ERR_MISSING_HEADER` | line 1 ≠ `%RES <ver>` |
| `ERR_UNSUPPORTED_VERSION` | major version newer than supported |
| `ERR_UNKNOWN_SECTION` | `== … ==` not Header/Preamble/Operative |
| `ERR_BAD_FRONTMATTER` | pre-section line neither `Key: Value` nor blank |
| `ERR_DEPTH_EXCEEDED` | hyphen run > 4 (sub-clause depth > 4) |
| `ERR_DEPTH_SKIP` | child hyphen count > parent + 1 |
| `ERR_PREAMBLE_NESTING` | preamble item not exactly one `- ` |
| `ERR_CLAUSE_OUTSIDE_OPERATIVE` | `[CLAUSE]` not in the operative section |
| `ERR_ORPHAN_TAIL` | `DASH(d)>` with no open clause at depth `d` |
| `ERR_EMPTY_DOCUMENT` | neither preamble nor operative clauses |

| Code | (Warning) condition |
|---|---|
| `WARN_EMPTY_CHAPEAU` | (sub)clause without chapeau text |
| `WARN_EMPTY_HEADER` | `== Header ==` empty |
| `WARN_UNKNOWN_KEY` | unknown front-matter key |
| `WARN_EMPTY_SECTION` | section without clauses |

---

## 8. Worked examples

### 8.1 Minimal

```
%RES 1.0

== Header ==

THE GENERAL ASSEMBLY

== Preamble ==

- Reaffirming the Charter of the United Nations,

== Operative ==

[CLAUSE]
Calls upon all Member States to honour their obligations;
```

→ `Resolution { committeeName: "THE GENERAL ASSEMBLY", preamble: [1],
operative: [1] }`. All sections present, `blocks[0]` text.

### 8.2 The hard case: text → sublist → closing text (recursive)

Canonical form (cosmetic indentation shown; parser ignores it — the
`[CLAUSE]`/hyphen/`>` markers alone define the structure):

```
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
```

Resulting block structure:

```
OperativeClause #1                        ([CLAUSE], depth 0)
└─ blocks:
   ├─ TextBlock        "decides to"
   ├─ SubclausesBlock
   │  ├─ SubClause                         (- , depth 1)
   │  │  └─ blocks:
   │  │     ├─ TextBlock      "establish an independent commission that"
   │  │     ├─ SubclausesBlock
   │  │     │  ├─ SubClause → TextBlock "reports annually to the General Assembly;"
   │  │     │  └─ SubClause → TextBlock "issues concrete recommendations;"
   │  │     └─ TextBlock      "while preserving the confidentiality of sources;"
   │  │                                    ← -> closes the depth-1 clause
   │  └─ SubClause → TextBlock "secures the necessary funding from the regular budget;"
   └─ TextBlock        "and to remain actively seized of the matter;"
                                           ← > closes operative clause #1
OperativeClause #2 → TextBlock "requests the Secretary-General to report within 90 days."
```

`->` (depth-1 prefix + `>`) closes the `-` clause; `>` (depth-0, no
prefix) closes the `[CLAUSE]`. The closing marker carries the same hyphen
prefix as the clause it closes.

### 8.3 Lenient input → canonical output

Input (no indentation, mixed/stray ordinals, lowercase keywords):

```
%res 1.0
Committee: SC
== header ==
The Security Council
== preamble ==
- Recalling its resolution 2025 (2026),
== operative ==
[clause]
1. Demands an immediate ceasefire;
[clause]
2. Decides to
- a) deploy observers;
- b) review the situation;
```

Canonical output (after `serialize ∘ parse`):

```
%RES 1.0

Committee: SC

== Header ==

The Security Council

== Preamble ==

- Recalling its resolution 2025 (2026),

== Operative ==

[CLAUSE]
Demands an immediate ceasefire;

[CLAUSE]
Decides to
  - deploy observers;
  - review the situation;
```

Stray `1.` / `2.` / `a)` / `b)` stripped; zero indentation in the input is
fine because structure comes from markers. Idempotent.

### 8.4 Clause fragment (amendment use-case)

Removing the `[CLAUSE]` line from one clause yields a fragment parseable
by `parseClauseFragment` into a single `OperativeClause` — the shape of
`AmendmentOverlay.newContent`:

```
Decides to
  - deploy observers within 30 days;
  - review the situation quarterly;
> and to remain actively seized of the matter;
```

`> ` here closes the implicit clause-level of the fragment. A leading
`[CLAUSE]` line, if present, is accepted and ignored.

---

## 9. Deliberately out of scope (rationale)

- **`AmendmentOverlay`** is review/collaboration state, not document
  content. Belongs in the lossless JSON channel. (The clause-fragment
  grammar exists so a single `newContent` clause can be rendered/diffed as
  text, but the overlay metadata itself stays in JSON.)
- **Internal IDs** serve cursor/CRDT preservation; in the format they would
  only add noise and degrade LLM output. Re-import mints new IDs;
  `replaceResolution` performs the structural diff.
- **Comment syntax** omitted in v1 to avoid parsing ambiguity and
  idempotence breakage; addable additively in v1.x (the `%RES` version
  field covers this).
- **`conferenceEmblem`** (SVG data URL): potentially very long, not
  human-editable; stays in the JSON channel; can later be an optional
  `Emblem:` key.

---

## 10. Public API (contract; implementation to follow separately)

```ts
parse(text: string): {
  resolution: Resolution;
  header: ResolutionHeaderData;
  warnings: ResWarning[];
};

serialize(resolution: Resolution, header?: ResolutionHeaderData): string; // canonical

validate(text: string):
  | { valid: true;  resolution: Resolution; header: ResolutionHeaderData; warnings: ResWarning[] }
  | { valid: false; errors: ResError[] };

// Single-clause fragment (amendment newContent). Accepts a clause body
// with or without a leading [CLAUSE] line; returns exactly one clause.
parseClauseFragment(text: string):
  | { valid: true; clause: OperativeClause; warnings: ResWarning[] }
  | { valid: false; errors: ResError[] };

serializeClause(clause: OperativeClause): string; // canonical, no [CLAUSE] line

declare const RES_VERSION = '1.0';
```

Dependency direction is strictly **`res-markup` → `schema/resolution.ts`**.
No Svelte, store or Y.js imports, so the module remains losslessly
extractable as a standalone package later.
```
