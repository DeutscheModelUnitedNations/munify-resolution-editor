# RES-Markup — User Guide

A friendly introduction to writing resolutions in **RES-Markup**.
If you are *implementing* a parser, read the precise rules in
[`grammar.md`](./grammar.md). If you are *writing* a resolution, this is
the page you want.

---

## What is RES-Markup?

RES-Markup is a plain-text way to write a whole resolution — metadata,
headline, preamble and operative part — in a single file that:

- **a human** can read and edit without tooling,
- **an LLM** can produce reliably (no fragile whitespace, no numbering to
  get wrong),
- **a program** can parse straight back into the editor's data model.

The guiding idea: **markers carry the structure, never spaces.** You can
indent for looks, or not at all — the meaning does not change.

---

## The 30-second tour

```
%RES 1.0

Committee: General Assembly

== Header ==

THE GENERAL ASSEMBLY,

== Preamble ==

- Recalling something important,

== Operative ==

[CLAUSE]
Calls upon everyone to read the rest of this guide;
```

That is a complete, valid resolution. Everything else is just *more* of
the same four building blocks: front-matter, `== Header ==`,
`== Preamble ==`, `== Operative ==`.

---

## Building it up, piece by piece

We'll assemble one running example: a resolution **about RES-Markup
itself**. (Yes, it adopts the very format it is written in. It can't get
more meta, so relax.)

### 1. The version line

Every file starts with this exact line:

```
%RES 1.0
```

A `#` comment banner may sit *above* it (see §6) — handy for drafting
notes or a licence.

### 2. Front-matter — the metadata

Plain `Key: Value` lines, one per line, until the first `== … ==`
heading. Order doesn't matter; unknown keys are ignored with a warning.

```
Conference:            Model United Nations of Markup Languages 2026
Committee:             General Assembly of Resolution Editors
CommitteeAbbreviation: GARE
DocumentNumber:        GARE/RES/1.0
Topic:                 Adoption of the RES-Markup Interchange Format
AuthoringDelegation:   The Delegation of Tired Drafters
SponsoringDelegations: Humans, Large Language Models, Parsers
```

`SponsoringDelegations` is just a comma-separated list. You can align the
values or not — the exporter pretty-aligns them for you.

### 3. `== Header ==` — the line above the preamble

This is the italic headline printed above the preamble, e.g.
`THE GENERAL ASSEMBLY,`. It is **separate** from `Committee:`:
`Committee:` is the organ's name in the metadata; `== Header ==` is the
exact words on the page.

```
== Header ==

THE GENERAL ASSEMBLY OF RESOLUTION EDITORS,
```

You may end it with a comma (it looks like the real document). The comma
is cosmetic — it's stored without it and the editor adds one back when
rendering, so you'll never get a double comma.

### 4. `== Preamble ==` — the preambulatory clauses

Each clause is one `- ` item. Long clauses can wrap over several lines;
just keep typing. A blank line (or the next `-`) ends a clause.

```
== Preamble ==

- Recalling that no delegate has ever enjoyed renumbering forty operative
  paragraphs at 3 a.m.,

- Deeply concerned by the proliferation of slightly-different JSON blobs,

- Noting with approval that hyphens are very easy to count,
```

### 5. `== Operative ==` — the operative part

Each operative clause begins with **`[CLAUSE]` alone on its line**. The
text on the next line(s) is the clause itself.

```
== Operative ==

[CLAUSE]
Adopts the RES-Markup format for all resolution interchange;
```

Why a whole `[CLAUSE]` tag? Because it makes one clause **liftable**: to
quote or amend a single clause, copy it and delete the `[CLAUSE]` line —
what's left is a valid clause fragment on its own.

### 6. Sub-clauses — just count hyphens

No `(a)`, `(i)`, `(aa)` to type. Sub-levels are hyphens:

- `-` first sub-level (renders as `(a)`),
- `--` second sub-level (renders as `(i)`),
- `---` third, `----` fourth — that's the maximum.

The editor draws the correct labels automatically. You only ever think
"how deep", not "which letter comes next".

```
[CLAUSE]
Decides that nesting shall be expressed by counting hyphens, namely
- one hyphen for the first sub-level,
- and that going deeper just adds a hyphen,
-- such as this second level,
-- which the editor will label automatically;
```

### 7. Closing sentences — the `>` arrow

Sometimes a clause has a sub-list and *then* a closing line that still
belongs to the clause ("…; and decides to remain seized of the matter").
That line uses an arrow: the **same hyphens as the clause it closes, plus
`>`**.

- `>` closes the `[CLAUSE]` itself,
- `->` closes a `-` sub-clause,
- `-->` closes a `--` sub-clause.

Mnemonic: the arrow wears the same dashes as the thing it returns to.

```
[CLAUSE]
Decides to
- establish a working group, which shall
-- meet annually,
-- publish its notes;
-> while keeping the notes short;
> and to remain actively seized of the matter;
```

Here `->` closes the `-` clause ("establish a working group"); `>` closes
the whole `[CLAUSE]`.

### 8. Comments

Any line whose first non-space character is `#` is a comment. It is
removed before parsing and never changes anything — sprinkle them freely.
They are **not** saved back out (they're drafting notes, not content).

```
# TODO: ask Legal whether "shall" or "should"
[CLAUSE]
Requests a legal review;
```

---

## The things you *don't* have to do

This is the best part:

- **Don't indent.** Or do — it's ignored. Hyphen counts decide depth.
- **Don't number anything.** `1.`, `(a)`, `(iii)` typed by hand are
  stripped on import. Reordering clauses never means renumbering.
- **Don't align the front-matter.** The exporter does it.
- **Don't worry about the headline comma.** It's normalised.
- **Don't escape normal prose.** Only a line that must *literally* start
  with `[`, `#`, `-` + space, or `>` needs a leading `\`. Resolution
  sentences essentially never do.

---

## The complete self-referential resolution

```
# This file is a resolution about the format it is written in.
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
```

Copy it, mangle the indentation, renumber nothing, add `#` notes — it
still parses to exactly the same resolution.

---

## Cheat sheet

| You write | It means |
|---|---|
| `%RES 1.0` | required first line |
| `Key: Value` | a metadata field |
| `== Header ==` | the italic headline line follows |
| `== Preamble ==` | preamble clauses follow |
| `== Operative ==` | operative clauses follow |
| `- text` | one preamble clause |
| `[CLAUSE]` (alone) | start of an operative clause |
| `- text` | sub-clause, level 1 |
| `-- text` | sub-clause, level 2 (max `----`) |
| `> text` | closing line of the `[CLAUSE]` |
| `-> text` | closing line of a `-` sub-clause |
| `# text` | comment (ignored, not saved) |
| `\- text` | a line that literally starts with `- ` |

---

## FAQ / gotchas

**Do I need blank lines?** Only for readability. Clause boundaries are
`[CLAUSE]` / section headings, not blanks.

**What if I skip a level (`-` straight to `---`)?** That's an error
(`ERR_DEPTH_SKIP`) — go one hyphen at a time.

**Can the preamble have sub-points?** No, preamble clauses are flat.

**Where do amendments fit?** A single clause minus its `[CLAUSE]` line is
a *fragment* the tooling can parse on its own — that's exactly the unit
an amendment replaces. Amendment status, sponsors etc. live in the app,
not in this text format.

**Will my comments survive a round-trip?** No, by design. They are
authoring aids; export produces clean, canonical RES-Markup with no
comments.

**Is it case-sensitive?** Section names and `[CLAUSE]` are matched
case-insensitively; your content is kept exactly as written.

---

For the exhaustive grammar, error codes and the parser/serializer
contract, see [`grammar.md`](./grammar.md).
