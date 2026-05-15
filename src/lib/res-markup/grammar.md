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
2. **LLMs** — robustly writable; structure is conveyed through
   line-leading **markers** plus simple relative indentation, never through
   absolute whitespace counting.
3. **Programs** — unambiguously parseable, validatable and serializable;
   every file maps losslessly onto the `Resolution` schema.

Core principles:

- **Markers determine the *kind*; indentation determines only *depth and
  attachment*.** Whether a line is a clause item, a chapeau continuation,
  or a closing text block is decided by its marker, never by counting
  spaces.
- **No ordinals in the format.** There are no `1.` / `(a)` / `(i)`
  labels. A uniform `- ` list marker is used at every level; nesting is
  expressed by indentation. Display labels are derived later from depth and
  index via `getSubClauseLabel` — they are not part of the interchange
  format. This removes the entire class of "how do I number the next level"
  mistakes.
- **Lenient on input, canonical on output.** The parser accepts a broad
  range of inputs (any consistent indent step, optional blank lines,
  loose section casing). The serializer emits exactly one canonical form.
- **Validity is programmatically decidable** (section 7).
- **IDs are not content.** `parse` mints fresh IDs; `serialize` never emits
  IDs. Cursor/collaboration preservation is the job of `replaceResolution`,
  not of this format.

Deliberately **out of v1**: amendments (`AmendmentOverlay`), internal IDs,
comment syntax, embedded conference emblem. Rationale in section 9.

### 1.1 Accepted tradeoff: depth via indentation

Dropping ordinals means nesting depth is now carried by indentation — the
property we criticized about YAML. This is acceptable because:

- depth is inferred **relatively** (any consistent increase = one level
  deeper, exactly like Markdown lists, which LLMs produce reliably) — not
  by absolute column arithmetic;
- the **kind** of every line is still 100 % marker-determined (`- ` = list
  item, `~ ` = closing text, no marker = continuation);
- maximum depth is hard-capped at 4 (`MAX_SUBCLAUSE_DEPTH`), so drift
  cannot silently produce invalid structure — it produces a precise error.

The real-world error source being eliminated (mislabeling deeper levels)
is larger than the one introduced (indentation drift, bounded and
detectable).

---

## 2. Lexical structure

- **Encoding:** UTF-8.
- **Line endings:** `CRLF` and `CR` are normalized to `LF` on read.
  Canonical output uses `LF` only.
- **Trailing whitespace** on every line is discarded on read.
- **Indent unit:** canonical output uses **2 spaces per nesting level**
  (`INDENT = 2`), matching common list conventions. On input, the indent
  step may be any positive constant; depth is inferred relatively (2.2).
  A tab counts as `INDENT` spaces.
- **Column** is 0-based and refers to the first non-whitespace character of
  a line.
- **Logical line:** a marker line plus any directly following
  *continuation lines* (non-blank lines with no marker, indented at least
  to the marker's content column, no blank line in between). The contents
  of a logical line are joined with exactly one space (`U+0020`).
- **Blank line:** a line empty after trimming. It terminates a logical
  line / block. Several consecutive blank lines are equivalent to one.

### 2.1 Markers (line-leading, after optional indentation)

| Marker | Meaning | Canonical regex |
|---|---|---|
| `%RES <ver>` | Format header, **required, line 1** | `^%RES \d+\.\d+$` |
| `Key: Value` | Front-matter pair (only before `---`) | `^[A-Za-z][A-Za-z0-9]*: .*$` |
| `---` | End of front-matter | `^---$` |
| `== <Section> ==` | Section heading | `^== .+ ==$` |
| `- ` | List item (preamble clause / operative clause / sub-clause) | `^- \S` |
| `~ ` | Closing text block after a sub-list | `^~ \S` |

Escaping: if a **content line** must literally begin with one of the marker
forms above, prefix it with a single backslash `\`. The parser strips
exactly one leading `\`. (Practically never needed in prose.)

### 2.2 Relative depth inference

The parser maintains a stack of open list items, each remembering its
indentation column. For a `- ` line at column `I`:

- if `I` is greater than the current top item's column → it is a **child**
  (depth = parent depth + 1);
- if `I` equals the column of some item on the stack → it is a **sibling**
  of that item (pop deeper levels);
- otherwise (`I` between two known columns, or below all) → pop to the
  nearest shallower known column and treat as its child / sibling
  accordingly.

Only the *relative* ordering of columns matters; the absolute step size is
irrelevant. Inconsistent indentation that cannot be resolved to a monotone
stack (e.g. a child less indented than its parent) is `ERR_BAD_INDENT`.

---

## 3. Grammar (EBNF)

Notation: `{ x }` = 0..n, `[ x ]` = optional, `|` = alternative, `" "` =
literal, `NL` = newline, `TEXT` = non-empty joined content of a logical
line, `INDENT(d)` = indentation for depth `d`.

```ebnf
document        = "%RES " version NL { blankline }
                  { kv-pair }
                  "---" NL { blankline }
                  header-section
                  preamble-section
                  operative-section ;

version         = digit { digit } "." digit { digit } ;
kv-pair         = key ": " value NL ;
key             = letter { letter | digit } ;
value           = { any-char-except-NL } ;

header-section    = "== Header ==" NL { blankline }
                    TEXT NL { blankline } ;          (* the body headline *)

preamble-section  = "== Preamble ==" NL { blankline }
                    { preamble-clause } ;
preamble-clause   = "- " TEXT NL { blankline } ;     (* flat, no nesting *)

operative-section = "== Operative ==" NL { blankline }
                    { clause } ;

(* A clause maps to OperativeClause/SubClause. blocks[] order is preserved. *)
clause          = INDENT(d) "- " TEXT NL             (* chapeau = 1st TextBlock *)
                  { block-tail } ;
block-tail      = sublist                            (* -> SubclausesBlock *)
                | closing-text ;                     (* -> further TextBlock *)
sublist         = clause { clause } ;                (* each at depth d+1 *)
closing-text    = INDENT(d+1) "~ " TEXT NL { blankline } ;

blankline       = NL ;
```

### 3.1 Depth rules

- A top-level operative `clause` is at **depth 0**. Each nested `clause` is
  at `parent depth + 1`. Maximum depth = **4** (`MAX_SUBCLAUSE_DEPTH`);
  deeper → `ERR_DEPTH_EXCEEDED`.
- Display labels (`(a)`, `(i)`, `(aa)`, `(aaa)`) are **not** present in the
  format. The editor derives them from depth and index via
  `getSubClauseLabel` when rendering.
- Preamble items are **flat**: a `- ` indented as a child under
  `== Preamble ==` is `ERR_PREAMBLE_NESTING` (the schema's `PreambleClause`
  has no sub-structure).

### 3.2 Closing-text attachment (unambiguous)

A `~ ` line attaches a trailing `TextBlock` to the clause whose
*children* sit at the `~` line's indentation column — i.e. the clause one
level shallower than the `~`. Equivalently: it closes the open clause on
the stack at depth `d` where the `~` is at `INDENT(d+1)`.

This disambiguates all three critical cases by marker + column, never by
whitespace counting alone:

- continuation of the chapeau → no marker, content column;
- a deeper list item → `- ` at a deeper column;
- a closing sentence of *this* clause → `~ ` at this clause's child column;
- a closing sentence of an *outer* clause → `~ ` at a shallower column.

An unmarked, dedented line appearing **after** a sublist is *not* guessed —
it is `ERR_AMBIGUOUS_TEXT` with a hint to use `~ `. (Strictness here
protects robustness; the message guides the author/LLM.)

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

- Unknown keys: reported in `warnings`, otherwise ignored
  (forward-compatible, LLM-tolerant).
- `header.conferenceEmblem` is **not** a RES key in v1 (section 9).

### 4.2 `== Header ==` → body headline

The single logical line in `== Header ==` (e.g. `THE GENERAL ASSEMBLY`,
`The Security Council`, `Der Sicherheitsrat`) maps to **both**
`Resolution.committeeName` **and** `header.committeeResolutionHeadline`
(the schema carries both; they are the same string in practice). On
serialize the value is taken from
`committeeResolutionHeadline ?? committeeName`. An empty header section is
`WARN_EMPTY_HEADER`.

### 4.3 Body → `Resolution`

- Each `preamble-clause` → one `PreambleClause` with `content = TEXT`.
- Each top-level `clause` → one `OperativeClause`.
- Chapeau `TEXT` (text after `- ` on the marker line) → first `TextBlock`
  (satisfies the "first block is text" invariant).
- A `sublist` → one `SubclausesBlock`; each child `clause` recursively a
  `SubClause` with its own `blocks[]`.
- Each `closing-text` → a further `TextBlock` on the terminated
  (sub)clause node, in source order.
- Alternating text / sublist / text is representable. Directly adjacent
  same-kind blocks are merged via `cleanupBlocks` (e.g. two successive
  `~` lines → one `TextBlock`).
- IDs (`generateClauseId`, `generateSubClauseId`, `generateBlockId`) are
  freshly minted on parse.

---

## 5. Canonical serialization (deterministic)

The canonical form is the only output the serializer produces and the
basis of the idempotence test (7.3).

1. Line 1: `%RES 1.0`, then one blank line.
2. Front-matter: only **present** keys, in the order of table 4.1.
   Alignment: every value starts at column `maxKeyLen + 2`, where
   `maxKeyLen` is the longest *present* key (deterministic ⇒ idempotent).
   Per line: `Key:` + padding + value. `SponsoringDelegations` is emitted
   as a `, `-separated list.
3. `---`, then one blank line.
4. `== Header ==`, blank line, the headline line, blank line. Always
   emitted.
5. `== Preamble ==`, blank line, then each clause as `- ` + content,
   then a blank line. Always emitted, even if empty.
6. `== Operative ==`, blank line, then the clauses.
7. **Markers & columns:**
   - every list item: `- ` marker at column `depth * INDENT`
     (`INDENT = 2`), chapeau on the same line;
   - a `~ ` closing text of a clause at depth `d`: column
     `(d + 1) * INDENT`;
   - empty chapeau: marker line without trailing space (`-`), plus
     `WARN_EMPTY_CHAPEAU`.
8. **Wrapping:** canonical width = **80** columns. Greedy, break only at
   `U+0020`, never split a token (even if it exceeds 80). Continuation
   lines are indented to the marker's content column
   (`depth * INDENT + 2`). The algorithm is fully determined by
   (text, start column, width 80) ⇒ `parse ∘ serialize` is byte-stable.
9. Exactly one blank line between top-level operative clauses; exactly one
   trailing `LF`; no trailing whitespace.

---

## 6. Lenient input (beyond the canonical form)

The parser additionally accepts and normalizes to schema:

- **List markers:** `- ` `* ` `• ` are all accepted; serialized as `- `.
  Any leftover ordinal an author types (`1.`, `a)`, `(i)`) at the start of
  the content is **stripped** and ignored — order comes from position, the
  display label from depth.
- **Indentation:** any consistent positive step; depth inferred relatively
  (2.2); tabs allowed.
- **Blank lines:** optional / repeated between clauses.
- **Front-matter:** any whitespace around `:`; keys matched
  case-insensitively, re-serialized in canonical casing.
- **Section headings:** `== Header ==`, `== Preamble ==`,
  `== Operative ==` matched case-insensitively. No localized aliases in v1
  (international format, English keywords only).
- **Trailing punctuation** (`,` `;` `.`) is **preserved** — it is
  resolution content (unlike the legacy `resolutionParser.ts`, which
  stripped it).

The parser does **not** repair (→ errors, section 7): depth > 4, nested
preamble items, ambiguous text after a sublist, missing `%RES`, missing
`---`, non-monotone indentation.

---

## 7. Validity (programmatically decidable)

`validate(text)` is `valid` iff all four stages pass:

### 7.1 Syntax stage
Tokenizer/parser complete without a `ResError` (see catalog).

### 7.2 Structural stage
- `ResolutionSchema.safeParse(result)` (Zod) succeeds.
- Every `OperativeClause`/`SubClause`: `blocks[0].type === 'text'`.
- Max nesting depth ≤ `MAX_SUBCLAUSE_DEPTH` (4).
- **Warnings** (valid but reported): empty chapeau text block; empty
  header; unknown front-matter key; empty section.

### 7.3 Idempotence stage
With `S = serialize ∘ parse`: required `S(S(text)) === S(text)`
(byte-identical).

### 7.4 Round-trip stage (model fidelity)
For any schema-valid `Resolution R` (IDs normalized):
`parse(serialize(R)).resolution` is **structurally equal** to `R`
(IDs excluded; `cleanupBlocks` applied on both sides).

### Error catalog (`ResError`, each with line/column)

| Code | Condition |
|---|---|
| `ERR_MISSING_HEADER` | line 1 ≠ `%RES <ver>` |
| `ERR_UNSUPPORTED_VERSION` | major version newer than supported |
| `ERR_MISSING_FRONTMATTER_END` | no `---` before first section |
| `ERR_UNKNOWN_SECTION` | `== … ==` not Header/Preamble/Operative |
| `ERR_DEPTH_EXCEEDED` | nesting depth > 4 |
| `ERR_BAD_INDENT` | indentation not resolvable to a monotone stack |
| `ERR_PREAMBLE_NESTING` | indented sub-item under `== Preamble ==` |
| `ERR_AMBIGUOUS_TEXT` | unmarked dedented line after a sublist (use `~ `) |
| `ERR_ORPHAN_TAIL` | `~ ` with no matching open clause at its column |
| `ERR_EMPTY_DOCUMENT` | neither preamble nor operative clauses |
| `ERR_BAD_FRONTMATTER` | pre-`---` line is neither `Key: Value` nor blank |

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

---

== Header ==

THE GENERAL ASSEMBLY

== Preamble ==

- Reaffirming the Charter of the United Nations,

== Operative ==

- Calls upon all Member States to honour their obligations;
```

→ `Resolution { committeeName: "THE GENERAL ASSEMBLY", preamble: [1],
operative: [1] }`. All three sections present, `blocks[0]` text.

### 8.2 The hard case: text → sublist → closing text (recursive)

```
== Operative ==

- decides to
  - establish an independent commission that
    - reports annually to the General Assembly;
    - issues concrete recommendations;
    ~ while preserving the confidentiality of sources;
  - secures the necessary funding from the regular budget;
  ~ and to remain actively seized of the matter;

- requests the Secretary-General to report within 90 days.
```

Resulting block structure:

```
OperativeClause #1
└─ blocks:
   ├─ TextBlock        "decides to"
   ├─ SubclausesBlock
   │  ├─ SubClause                      (col 2, depth 1)
   │  │  └─ blocks:
   │  │     ├─ TextBlock      "establish an independent commission that"
   │  │     ├─ SubclausesBlock
   │  │     │  ├─ SubClause → TextBlock "reports annually to the General Assembly;"
   │  │     │  └─ SubClause → TextBlock "issues concrete recommendations;"
   │  │     └─ TextBlock      "while preserving the confidentiality of sources;"
   │  │                                  ← ~ @ col 4 closes the depth-1 clause
   │  └─ SubClause → TextBlock "secures the necessary funding from the regular budget;"
   └─ TextBlock        "and to remain actively seized of the matter;"
                                         ← ~ @ col 2 closes operative clause #1
OperativeClause #2 → TextBlock "requests the Secretary-General to report within 90 days."
```

Column logic: `- decides` @0 → children @2 → their children @4. The inner
`~` @4 (= child column of the depth-1 clause) closes that clause. The outer
`~` @2 (= child column of clause #1) closes clause #1. Fully
marker+column-determined; no ordinals anywhere.

### 8.3 Lenient input → canonical output

Input (mixed markers, 4-space step, stray ordinals, lowercase sections):

```
%res 1.0
---
== header ==
The Security Council
== preamble ==
* Recalling its resolution 2025 (2026),
== operative ==
* 1. Demands an immediate ceasefire;
* 2. Decides to
        a) deploy observers;
        b) review the situation;
```

Canonical output (after `serialize ∘ parse`):

```
%RES 1.0

---

== Header ==

The Security Council

== Preamble ==

- Recalling its resolution 2025 (2026),

== Operative ==

- Demands an immediate ceasefire;

- Decides to
  - deploy observers;
  - review the situation;
```

The stray `1.` / `2.` / `a)` / `b)` are stripped (order is positional,
labels are derived on render). Idempotent: re-`parse`/`serialize` yields
identical bytes.

---

## 9. Deliberately out of scope (rationale)

- **`AmendmentOverlay`** is review/collaboration state, not document
  content. Belongs in the lossless JSON channel, not a human-edited
  interchange format.
- **Internal IDs** serve cursor/CRDT preservation; in the format they would
  only add noise and degrade LLM output. Re-import mints new IDs;
  `replaceResolution` performs the structural diff.
- **Comment syntax** omitted in v1 to avoid parsing ambiguity and
  idempotence breakage; can be added additively in v1.x (the `%RES`
  version field covers this).
- **`conferenceEmblem`** (SVG data URL): potentially very long, not
  human-editable content. Stays in the JSON channel; can later be added as
  an optional `Emblem:` key.

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

declare const RES_VERSION = '1.0';
```

Dependency direction is strictly **`res-markup` → `schema/resolution.ts`**.
No Svelte, store or Y.js imports, so the module remains losslessly
extractable as a standalone package later.
```
