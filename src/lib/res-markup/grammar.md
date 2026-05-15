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
  non-significant.** Depth is encoded by the *number* of leading marker
  characters (`-`, `--`, `---`, …), not by counting spaces. Whitespace,
  copy-paste reflow and leading-space drift can never change structure.
- **No ordinals in the format.** There are no `1.` / `(a)` / `(i)`
  labels. Display labels are derived later from depth and index via
  `getSubClauseLabel` — they are not part of the interchange format. This
  removes the entire class of "how do I number the next level" mistakes.
- **Lenient on input, canonical on output.** The parser ignores all
  indentation and accepts loose section casing, alternate blank-line
  spacing and stray ordinals. The serializer emits exactly one canonical
  form (which *does* indent, purely for human readability — see §5).
- **Validity is programmatically decidable** (section 7).
- **IDs are not content.** `parse` mints fresh IDs; `serialize` never emits
  IDs. Cursor/collaboration preservation is the job of `replaceResolution`,
  not of this format.

Deliberately **out of v1**: amendments (`AmendmentOverlay`), internal IDs,
comment syntax, embedded conference emblem. Rationale in section 9.

### 1.1 Why marker-counted depth

Earlier drafts encoded depth by indentation — the classic YAML footgun.
Counting leading `-` characters instead makes structure **fully
marker-determined**:

- LLMs reliably emit small marker repetitions (`-`, `--`, `---`), the same
  way they reliably emit Markdown heading levels (`#`, `##`);
- the format is completely whitespace-insensitive — indentation becomes a
  cosmetic, parser-ignored aid, so humans *may* indent for readability
  while machines need not;
- maximum depth is hard-capped (max 5 hyphens, §3.1), and a level skip is a
  precise error rather than silent corruption.

This keeps the benefits of an outline format with none of the indentation
fragility.

---

## 2. Lexical structure

- **Encoding:** UTF-8.
- **Line endings:** `CRLF`/`CR` normalized to `LF` on read. Canonical
  output uses `LF` only.
- **Trailing whitespace** on every line is discarded on read.
- **Leading whitespace is non-significant** and discarded before marker
  detection. (The canonical serializer re-adds cosmetic indentation; see
  §5.)
- **Logical line:** a marker line plus any directly following
  *continuation lines* (non-blank lines that do not start with a marker, no
  blank line in between). Contents are joined with exactly one space
  (`U+0020`).
- **Blank line:** empty after trimming; terminates a logical line / block.
  Consecutive blank lines are equivalent to one.

### 2.1 Markers (line-leading, after stripped indentation)

| Marker | Meaning | Canonical regex |
|---|---|---|
| `%RES <ver>` | Format header, **required, line 1** | `^%RES \d+\.\d+$` |
| `Key: Value` | Front-matter pair (only before the first section) | `^[A-Za-z][A-Za-z0-9]*: .*$` |
| `== <Section> ==` | Section heading; also ends front-matter | `^== .+ ==$` |
| `-`…`-----` + space | List item; **depth = hyphen run length** | `^-{1,5} \S` |
| `~`…`~~~~~` + space | Closing text block; **depth = tilde run length** | `^~{1,5} \S` |

- A marker run is consecutive identical characters with **no internal
  spaces**, followed by one space, then content.
- There is **no** `---` front-matter terminator: front-matter ends at the
  first `== … ==` heading. (This also removes any collision between the
  old terminator and a depth-3 list marker.)
- Escaping: if a content line must literally begin with a marker form,
  prefix one backslash `\`; the parser strips exactly one leading `\`.

---

## 3. Grammar (EBNF)

Notation: `{ x }` = 0..n, `[ x ]` = optional, `|` = alternative, `" "` =
literal, `NL` = newline, `TEXT` = non-empty joined content of a logical
line. `DASH(d)` = exactly `d` hyphens; `TILDE(d)` = exactly `d` tildes.

```ebnf
document        = "%RES " version NL { blankline }
                  { kv-pair }
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
preamble-clause   = DASH(1) " " TEXT NL { blankline } ;   (* flat: depth 1 only *)

operative-section = "== Operative ==" NL { blankline }
                    { clause(1) } ;

(* clause(d) maps to OperativeClause (d=1) / SubClause (d>=2).
   blocks[] order is preserved. *)
clause(d)       = DASH(d) " " TEXT NL                 (* chapeau = 1st TextBlock *)
                  { block-tail(d) } ;
block-tail(d)   = sublist(d+1)                        (* -> SubclausesBlock *)
                | closing-text(d) ;                   (* -> further TextBlock *)
sublist(k)      = clause(k) { clause(k) } ;
closing-text(d) = TILDE(d) " " TEXT NL { blankline } ;

blankline       = NL ;
```

### 3.1 Depth rules

- A top-level operative clause is **depth 1** (`-`). Each nesting level
  adds one hyphen. Mapping to the schema: depth 1 → `OperativeClause`;
  depth `n ≥ 2` → `SubClause` at sub-clause nesting `n − 1`.
- `MAX_SUBCLAUSE_DEPTH = 4` ⇒ maximum **5 hyphens** (`-----`). More →
  `ERR_DEPTH_EXCEEDED`.
- A child clause must have exactly `parent + 1` hyphens. A jump (e.g. `-`
  directly to `---`) is `ERR_DEPTH_SKIP`. Fewer-or-equal hyphens than the
  current clause means "pop to that depth and continue as a sibling".
- Display labels (`(a)`, `(i)`, `(aa)`, `(aaa)`) are **not** present; the
  editor derives them from depth and index via `getSubClauseLabel`.
- Preamble items are **flat**: a preamble line with more than one hyphen is
  `ERR_PREAMBLE_NESTING`.

### 3.2 Closing-text attachment (unambiguous by tilde count)

`closing-text(d)` (a `~`×`d` line) appends a trailing `TextBlock` to the
open clause at depth `d` on the current branch — i.e. `~~` closes the
nearest open depth-2 clause, `~` the depth-1 clause. The tilde count alone
determines attachment; no whitespace or position heuristic is involved.
If no open clause at depth `d` exists → `ERR_ORPHAN_TAIL`.

This disambiguates every case purely by marker:

- chapeau continuation → no marker;
- a deeper item → more hyphens;
- a closing sentence of *this* clause → tildes matching *this* depth;
- a closing sentence of an *outer* clause → fewer tildes.

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
- `header.conferenceEmblem` is **not** a RES key in v1 (section 9).

### 4.2 `== Header ==` → body headline

The single logical line in `== Header ==` (e.g. `THE GENERAL ASSEMBLY`,
`The Security Council`) maps to **both** `Resolution.committeeName`
**and** `header.committeeResolutionHeadline`. On serialize the value is
taken from `committeeResolutionHeadline ?? committeeName`. Empty → 
`WARN_EMPTY_HEADER`.

### 4.3 Body → `Resolution`

- Each `preamble-clause` → one `PreambleClause` with `content = TEXT`.
- Each top-level `clause(1)` → one `OperativeClause`; chapeau `TEXT` →
  first `TextBlock` (satisfies the "first block is text" invariant).
- A `sublist` → one `SubclausesBlock`; each child `clause` recursively a
  `SubClause` with its own `blocks[]`.
- Each `closing-text` → a further `TextBlock` on the terminated node, in
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
5. `== Operative ==`, blank line, then the clauses.
6. **Markers:** a clause at depth `d` is written with `d` hyphens; a
   closing text of a depth-`d` clause with `d` tildes; one space then
   content. Empty chapeau: marker without trailing space, plus
   `WARN_EMPTY_CHAPEAU`.
7. **Cosmetic indentation (parser-ignored, but deterministic so still
   idempotent):** a depth-`d` line is indented `(d − 1) × 2` spaces. A
   closing text aligns with the clause it closes (same indentation as that
   clause's hyphen marker).
8. **Wrapping:** canonical width = **80** columns. Greedy, break only at
   `U+0020`, never split a token. Continuation lines indented to the
   marker's content column (`(d − 1) × 2 + d + 1`). Fully determined ⇒
   `parse ∘ serialize` is byte-stable.
9. Exactly one blank line between top-level operative clauses; exactly one
   trailing `LF`; no trailing whitespace.

---

## 6. Lenient input (beyond the canonical form)

The parser additionally accepts and normalizes to schema:

- **All leading indentation is ignored** — structure comes solely from
  hyphen/tilde counts. Tabs and any space amount are harmless.
- **Stray ordinals** an author leaves at the start of content (`1.`,
  `a)`, `(i)`, `2026.`) are stripped — order is positional, the display
  label is derived from depth.
- **Blank lines:** optional / repeated between clauses.
- **Front-matter:** any whitespace around `:`; keys matched
  case-insensitively, re-serialized in canonical casing.
- **Section headings:** `== Header ==`, `== Preamble ==`,
  `== Operative ==` matched case-insensitively. No localized aliases in v1
  (international format, English keywords only).
- **Trailing punctuation** (`,` `;` `.`) is **preserved** — it is
  resolution content (unlike the legacy `resolutionParser.ts`).

The parser does **not** repair (→ errors, section 7): hyphen run > 5,
depth skip, nested preamble item, tilde with no matching open clause,
missing `%RES`, a pre-section line that is neither `Key: Value` nor blank.

---

## 7. Validity (programmatically decidable)

`validate(text)` is `valid` iff all four stages pass:

### 7.1 Syntax stage
Tokenizer/parser complete without a `ResError` (see catalog).

### 7.2 Structural stage
- `ResolutionSchema.safeParse(result)` (Zod) succeeds.
- Every `OperativeClause`/`SubClause`: `blocks[0].type === 'text'`.
- Max nesting depth ≤ `MAX_SUBCLAUSE_DEPTH` (4) ⇒ ≤ 5 hyphens.
- **Warnings** (valid but reported): empty chapeau; empty header; unknown
  front-matter key; empty section.

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
| `ERR_UNKNOWN_SECTION` | `== … ==` not Header/Preamble/Operative |
| `ERR_DEPTH_EXCEEDED` | hyphen run > 5 (sub-clause depth > 4) |
| `ERR_DEPTH_SKIP` | child hyphen count > parent + 1 |
| `ERR_PREAMBLE_NESTING` | preamble item with more than one hyphen |
| `ERR_ORPHAN_TAIL` | `~`×d with no open clause at depth `d` |
| `ERR_EMPTY_DOCUMENT` | neither preamble nor operative clauses |
| `ERR_BAD_FRONTMATTER` | pre-section line neither `Key: Value` nor blank |

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

- Calls upon all Member States to honour their obligations;
```

→ `Resolution { committeeName: "THE GENERAL ASSEMBLY", preamble: [1],
operative: [1] }`. All sections present, `blocks[0]` text.

### 8.2 The hard case: text → sublist → closing text (recursive)

Canonical form (cosmetic indentation shown; parser ignores it — the
hyphen/tilde counts alone define the structure):

```
== Operative ==

- decides to
  -- establish an independent commission that
    --- reports annually to the General Assembly;
    --- issues concrete recommendations;
  ~~ while preserving the confidentiality of sources;
  -- secures the necessary funding from the regular budget;
~ and to remain actively seized of the matter;

- requests the Secretary-General to report within 90 days.
```

Resulting block structure:

```
OperativeClause #1                       (- , depth 1)
└─ blocks:
   ├─ TextBlock        "decides to"
   ├─ SubclausesBlock
   │  ├─ SubClause                        (-- , depth 2)
   │  │  └─ blocks:
   │  │     ├─ TextBlock      "establish an independent commission that"
   │  │     ├─ SubclausesBlock
   │  │     │  ├─ SubClause → TextBlock "reports annually to the General Assembly;"
   │  │     │  └─ SubClause → TextBlock "issues concrete recommendations;"
   │  │     └─ TextBlock      "while preserving the confidentiality of sources;"
   │  │                                   ← ~~ closes the depth-2 clause
   │  └─ SubClause → TextBlock "secures the necessary funding from the regular budget;"
   └─ TextBlock        "and to remain actively seized of the matter;"
                                          ← ~ closes operative clause #1
OperativeClause #2 → TextBlock "requests the Secretary-General to report within 90 days."
```

`~~` (depth 2) closes the `--` clause; `~` (depth 1) closes the `-`
clause. Fully marker-determined; indentation is decorative only.

### 8.3 Lenient input → canonical output

Input (no indentation, mixed/stray ordinals, lowercase sections):

```
%res 1.0
Committee: SC
== header ==
The Security Council
== preamble ==
- Recalling its resolution 2025 (2026),
== operative ==
- 1. Demands an immediate ceasefire;
- 2. Decides to
-- a) deploy observers;
-- b) review the situation;
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

- Demands an immediate ceasefire;

- Decides to
  -- deploy observers;
  -- review the situation;
```

Stray `1.` / `2.` / `a)` / `b)` stripped; zero indentation in the input is
fine because depth comes from hyphen counts. Idempotent.

---

## 9. Deliberately out of scope (rationale)

- **`AmendmentOverlay`** is review/collaboration state, not document
  content. Belongs in the lossless JSON channel.
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

declare const RES_VERSION = '1.0';
```

Dependency direction is strictly **`res-markup` → `schema/resolution.ts`**.
No Svelte, store or Y.js imports, so the module remains losslessly
extractable as a standalone package later.
```
