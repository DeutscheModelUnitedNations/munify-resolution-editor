# RES-Markup — Formale Spezifikation

**Version:** 1.0
**Status:** Entwurf zur Review (noch keine Implementierung)
**Geltungsbereich:** Import-/Export-Austauschformat für eine einzelne `Resolution`
inkl. `ResolutionHeaderData`. Maßgebliches Datenmodell ist
`src/lib/schema/resolution.ts`.

---

## 1. Zielsetzung & Designprinzipien

RES-Markup ist ein zeilenorientiertes Klartextformat. Es hat drei
gleichrangige Zielgruppen:

1. **Mensch** — lesbar und editierbar; eine Datei sieht aus wie die fertige
   Resolution.
2. **LLM** — robust schreibbar; Struktur wird durch zeilenführende **Marker**
   bestimmt, nicht durch exakte Einrückung.
3. **Programm** — eindeutig parse-, validier- und serialisierbar; jede Datei
   lässt sich verlustfrei in das `Resolution`-Schema überführen.

Tragende Prinzipien:

- **Marker bestimmen den Typ, Einrückung nur die Zuordnung.** Ob etwas Text,
  Unterpunkt oder Schlusssatz ist, hängt nie von Leerzeichenzählung ab.
- **Tolerant lesen, kanonisch schreiben.** Der Parser akzeptiert ein breites
  Eingabespektrum (lockere Nummerierung, beliebige Einrückung, optionale
  Leerzeilen). Der Serializer erzeugt *genau eine* kanonische Form.
- **Validität ist programmatisch entscheidbar** (Abschnitt 7).
- **IDs sind kein Inhalt.** `parse` erzeugt neue IDs; `serialize` gibt nie
  IDs aus. Cursor-/Kollaborationserhalt ist Sache von `replaceResolution`,
  nicht des Formats.

Bewusst **nicht** Teil von v1: Amendments (`AmendmentOverlay`), interne IDs,
Kommentarsyntax, eingebettete Konferenzembleme als Pflichtfeld. Begründung in
Abschnitt 9.

---

## 2. Lexikalische Struktur

- **Kodierung:** UTF-8.
- **Zeilenenden:** `CRLF` und `CR` werden beim Einlesen zu `LF` normalisiert.
  Kanonische Ausgabe verwendet ausschließlich `LF`.
- **Trailing Whitespace** jeder Zeile wird beim Einlesen verworfen.
- **Indent-Einheit:** 3 Leerzeichen pro Verschachtelungsebene (`INDENT = 3`).
  Tabs werden beim Einlesen als 1 Tab = `INDENT` Leerzeichen expandiert.
- **Spaltenzählung** ist 0-basiert und bezieht sich auf die erste
  Nicht-Leerzeichen-Position einer Zeile.
- **Logische Zeile:** eine Markerzeile plus alle direkt folgenden
  *Fortsetzungszeilen* (Zeilen ohne eigenen Marker, tiefer oder gleich
  eingerückt, keine Leerzeile dazwischen). Der Inhalt einer logischen Zeile
  wird mit genau einem Leerzeichen (`U+0020`) zusammengefügt.
- **Leerzeile:** Zeile, die nach Trimmen leer ist. Sie beendet eine logische
  Zeile / einen Block. Mehrere aufeinanderfolgende Leerzeilen sind
  äquivalent zu einer.

### 2.1 Marker (zeilenführend, nach optionaler Einrückung)

| Marker | Bedeutung | Regex (kanonisch) |
|---|---|---|
| `%RES <ver>` | Formatkopf, **Pflicht, Zeile 1** | `^%RES \d+\.\d+$` |
| `Key: Wert` | Front-Matter-Paar (nur vor `---`) | `^[A-Za-z][A-Za-z0-9]*: .*$` |
| `---` | Ende Front-Matter | `^---$` |
| `== <Sektion> ==` | Sektionsüberschrift | `^== .+ ==$` |
| `- ` | Präambelklausel | `^- \S` |
| `n.` | Operative Klausel (n = Dezimalzahl) | `^\d+\. \S` |
| `(a)` `(i)` `(aa)` `(aaa)` | Unterpunkt, Ebene aus Labelform | `^\([a-z]+\) \S` |
| `~ ` | Schlusssatz-Textblock nach Unterpunkten | `^~ \S` |

Maskierung: Soll eine **Inhaltszeile** wörtlich mit einer der obigen
Markerformen beginnen, wird ihr ein einzelner Backslash `\` vorangestellt.
Der Parser entfernt genau einen führenden `\`. (In Fließtext-Prosa praktisch
nie nötig.)

---

## 3. Grammatik (EBNF)

Notation: `{ x }` = 0..n, `[ x ]` = optional, `|` = Alternative, `" "` =
Literal, `NL` = ein Zeilenumbruch, `TEXT` = nichtleerer Inhaltsstring einer
logischen Zeile (Fortsetzungszeilen bereits zusammengefügt).

```ebnf
document      = header NL "---" NL { blankline }
                preamble-section
                operative-section ;

header        = "%RES " version NL { blankline } { kv-pair } ;
version       = digit { digit } "." digit { digit } ;
kv-pair       = key ": " value NL ;
key           = letter { letter | digit } ;
value         = { any-char-except-NL } ;

preamble-section  = "== Präambel ==" NL { blankline }
                    { preamble-clause } ;
preamble-clause   = "- " TEXT NL { blankline } ;

operative-section = "== Operativer Teil ==" NL { blankline }
                    { operative-clause } ;

operative-clause  = arabic "." " " TEXT NL          (* Chapeau = 1. TextBlock *)
                    { block-tail }
                    { blankline } ;

(* block-tail bildet weitere Einträge in OperativeClause.blocks bzw.
   SubClause.blocks. Reihenfolge bleibt erhalten. *)
block-tail        = subclause-list            (* -> SubclausesBlock *)
                  | tail-text ;               (* -> weiterer TextBlock *)

subclause-list    = subclause { subclause } ;
subclause         = label " " TEXT NL               (* Chapeau = 1. TextBlock *)
                    { block-tail } ;
label             = "(" letterseq ")" ;             (* Ebene s. 3.1 *)

tail-text         = "~ " TEXT NL { blankline } ;

blankline         = NL ;
```

### 3.1 Ebenen- und Labelregeln

- Eine `operative-clause` liegt auf **Tiefe 0**. Jede `subclause` liegt auf
  Tiefe `Elterntiefe + 1`. Maximale Tiefe = **4** (`MAX_SUBCLAUSE_DEPTH`).
- Das Label einer `subclause` auf Tiefe `d` ist kanonisch
  `getSubClauseLabel(index, d)`:

  | Tiefe | Form | Beispiele |
  |---|---|---|
  | 1 | `(a)` Kleinbuchstaben | `(a) (b) … (z) (aa) …` |
  | 2 | `(i)` röm. Kleinziffern | `(i) (ii) (iii) …` |
  | 3 | `(aa)` doppelte Kleinbuchstaben | `(aa) (bb) …` |
  | 4 | `(aaa)` dreifache Kleinbuchstaben | `(aaa) (bbb) …` |

- Der Parser leitet die Tiefe **nicht** aus der Labelform ab, sondern aus
  der Schachtelung (Marker-/`~`-Spalte relativ zum Elternteil, s. 3.2). Die
  Labelform der Eingabe wird ignoriert; der Serializer vergibt Labels neu.

### 3.2 Zuordnung über Spalten (eindeutig)

Sei die Markerspalte einer Klausel auf Tiefe `d` gleich `C`.

- Ihre Unterpunkte (`subclause`, Tiefe `d+1`) haben Markerspalte
  `C + INDENT`.
- Ein `~ `-Schlusssatz, der **diese** Klausel terminiert, steht ebenfalls in
  Spalte `C + INDENT` (visuell auf Höhe ihrer Unterpunkte) und erzeugt einen
  weiteren `TextBlock` in `blocks[]` *dieser* Klausel — als Geschwister
  *nach* dem `SubclausesBlock`.
- Fortsetzungszeilen einer logischen Zeile stehen ≥ `C + INDENT` und tragen
  keinen Marker.

Damit ist jeder der drei kritischen Fälle eindeutig:
„Fortsetzung des Chapeau", „neuer Unterpunkt", „Schlusssatz dieser Klausel"
vs. „Schlusssatz/Unterpunkt einer äußeren Klausel" — entschieden durch
Markerart + Spalte, nie durch Leerzeichenzählung allein.

---

## 4. Abbildung auf das Schema

### 4.1 Front-Matter → `ResolutionHeaderData` / `Resolution`

| RES-Key | Zielfeld | Transformation |
|---|---|---|
| `Conference` | `header.conferenceName` | string |
| `ConferenceTitle` | `header.conferenceTitle` | string |
| `Committee` | `header.committeeAbbreviation` | string |
| `CommitteeFullName` | `header.committeeFullName` | string |
| `Headline` | `Resolution.committeeName` **und** `header.committeeResolutionHeadline` | string |
| `DocumentNumber` | `header.documentNumber` | string |
| `Topic` | `header.topic` | string |
| `AuthoringDelegation` | `header.authoringDelegation` | string |
| `SponsoringDelegations` | `header.sponsoringDelegations` | Split an `,`, je Element getrimmt, leere verworfen → `string[]` |
| `LastEdited` | `header.lastEdited` | ISO-8601-String, unverändert übernommen (Schema erlaubt `Date \| string`) |

- **`Headline`-Mapping (Designentscheidung):** Da das Schema sowohl
  `Resolution.committeeName` als auch
  `header.committeeResolutionHeadline` führt, schreibt `Headline` beides.
  Beim Serialisieren wird der Wert aus
  `committeeResolutionHeadline ?? committeeName` genommen.
- Unbekannte Keys: in `warnings` gemeldet, sonst ignoriert (vorwärts­-
  kompatibel, LLM-tolerant).
- `header.conferenceEmblem` ist **kein** RES-Key in v1 (siehe Abschnitt 9).

### 4.2 Body → `Resolution`

- Jede `preamble-clause` → ein `PreambleClause` mit `content = TEXT`.
- Jede `operative-clause` → ein `OperativeClause`.
- Chapeau-`TEXT` (auf der Markerzeile) → erster `TextBlock`
  (erfüllt die Invariante „erster Block ist Text").
- Eine `subclause-list` → ein `SubclausesBlock`; jede `subclause` rekursiv
  ein `SubClause` mit eigenem `blocks[]` nach denselben Regeln.
- Jeder `tail-text` → ein weiterer `TextBlock` in `blocks[]` des
  terminierten (Sub-)Klausel-Knotens, in Quellreihenfolge.
- Mehrfaches Alternieren Text/Unterpunkte/Text ist abbildbar. Direkt
  aufeinanderfolgende gleichartige Blöcke werden über `cleanupBlocks`
  zusammengeführt (z. B. zwei `~`-Schlusssätze in Folge → ein `TextBlock`).
- IDs (`generateClauseId`, `generateSubClauseId`, `generateBlockId`) werden
  beim Parsen frisch erzeugt.

---

## 5. Kanonische Serialisierung (deterministisch)

Die kanonische Form ist die **einzige** vom Serializer erzeugte Ausgabe und
Grundlage des Idempotenz-Tests (7.3).

1. Zeile 1: `%RES 1.0`, danach eine Leerzeile.
2. Front-Matter: nur **vorhandene** Keys, in der Reihenfolge der Tabelle
   4.1. Spaltenausrichtung: alle Werte beginnen in Spalte
   `maxKeyLen + 2`, wobei `maxKeyLen` die Länge des längsten *vorhandenen*
   Keys ist (deterministisch ⇒ idempotent). Format je Zeile:
   `Key:` + Padding + `Wert`. `SponsoringDelegations` wird als
   `, `-getrennte Liste ausgegeben.
3. `---`, danach eine Leerzeile.
4. `== Präambel ==`, Leerzeile, dann je Klausel `- ` + Inhalt; danach eine
   Leerzeile. Die Sektion wird **immer** ausgegeben, auch wenn leer (dann
   nur Überschrift + Leerzeile).
5. `== Operativer Teil ==`, Leerzeile, dann die Klauseln.
6. **Marker & Spalten:**
   - Operative Klausel: `"%d. " % (1-basierter Index)`, Markerspalte 0.
   - `subclause` auf Tiefe `d`: Markerspalte `d * INDENT`,
     Label = `getSubClauseLabel(index, d)`, dann **genau ein** Leerzeichen,
     dann Inhalt. Labels werden **nicht** auf gleiche Breite gepolstert
     (Determinismus vor Kosmetik).
   - `~ `-Schlusssatz einer Klausel auf Tiefe `d`: Spalte
     `(d + 1) * INDENT`.
   - Leerer Chapeau-Text: Markerzeile ohne nachfolgendes Leerzeichen
     (z. B. `2.`), zusätzlich Validierungswarnung (7.2).
7. **Zeilenumbruch (Wrap):** kanonische Breite = **80** Spalten.
   Greedy-Algorithmus, Trennung nur an `U+0020`, ein Token wird nie
   getrennt (auch wenn es 80 überschreitet). Fortsetzungszeilen werden auf
   die Inhaltsspalte des jeweiligen Markers eingerückt
   (Operative: Spalte `INDENT`; `subclause` Tiefe `d`: Spalte
   `(d + 1) * INDENT`; `~`: Spalte `(d + 1) * INDENT`). Der Algorithmus ist
   vollständig durch (Eingabetext, Startspalte, Breite 80) bestimmt ⇒
   `parse ∘ serialize` ist byte-stabil.
8. Genau eine Leerzeile zwischen Top-Level-Klauseln; genau ein
   abschließendes `LF` am Dateiende; kein Trailing Whitespace.

---

## 6. Tolerante Eingabe (über die kanonische Form hinaus)

Der Parser akzeptiert zusätzlich und normalisiert nach Schema:

- **Nummerierung/Labels:** `1.` `1)` `1` · `a.` `a)` `(a)` · `i.` `(i)` ·
  `-` `*` `•` (Bullet). Tatsächliche Ziffern/Buchstaben werden ignoriert;
  die Position bestimmt den Index, der Serializer nummeriert neu.
- **Einrückung:** beliebige konsistente Schrittweite; Tiefe wird relativ zur
  Elternklausel bestimmt, nicht absolut. Tabs erlaubt (s. 2).
- **Leerzeilen:** zwischen Klauseln optional/mehrfach.
- **Front-Matter:** beliebige Leerraummenge um `:`; Keys
  case-insensitiv gematcht, kanonisch case-korrekt re-serialisiert.
- **Sektionsüberschriften:** `== Präambel ==` / `== Operativer Teil ==`
  case-insensitiv; alternativ engl. `== Preamble ==` /
  `== Operative ==` als Aliase.
- **Trailing-Interpunktion** (`,` `;` `.` am Klauselende) bleibt **erhalten**
  (sie ist Resolutionsinhalt) — anders als im alten `resolutionParser.ts`,
  der sie strippte.

Was der Parser **nicht** repariert (→ Fehler, Abschnitt 7): Tiefe > 4,
Klausel ohne Chapeau auf einer Ebene, die ein Chapeau erfordert (nur
Warnung + leerer TextBlock), fehlende Pflichtzeile `%RES`, fehlendes `---`.

---

## 7. Validität (programmatisch entscheidbar)

`validate(text)` ist genau dann `valid`, wenn alle vier Stufen bestehen:

### 7.1 Syntaxstufe
Tokenizer/Parser laufen ohne `ResError` durch (siehe Fehlerkatalog).

### 7.2 Strukturstufe
- `ResolutionSchema.safeParse(result)` (Zod) erfolgreich.
- Jede `OperativeClause`/`SubClause`: `blocks[0].type === 'text'`.
- Maximale Schachteltiefe ≤ `MAX_SUBCLAUSE_DEPTH` (4).
- **Warnungen** (gültig, aber gemeldet): leerer Chapeau-TextBlock;
  unbekannter Front-Matter-Key; leere Sektion.

### 7.3 Idempotenzstufe
`serialize(parse(text).resolution, parse(text).header)` erneut geparst und
serialisiert ergibt **byte-identische** Ausgabe wie der erste
`serialize`-Lauf. Formal: `S = serialize ∘ parse`. Gefordert:
`S(S(text)) === S(text)`.

### 7.4 Round-Trip-Stufe (Modelltreue)
Für eine beliebige schemavalide `Resolution R` (mit normalisierten IDs)
gilt: `parse(serialize(R)).resolution` ist **strukturell gleich** `R`
(IDs ausgenommen; `cleanupBlocks` auf beiden Seiten angewандt).

### Fehlerkatalog (`ResError`, je mit Zeile/Spalte)

| Code | Bedingung |
|---|---|
| `ERR_MISSING_HEADER` | Zeile 1 ≠ `%RES <ver>` |
| `ERR_UNSUPPORTED_VERSION` | Major-Version > unterstützt |
| `ERR_MISSING_FRONTMATTER_END` | Kein `---` vor erster Sektion |
| `ERR_UNKNOWN_SECTION` | `== … ==` weder Präambel noch Operativ (inkl. Aliase) |
| `ERR_DEPTH_EXCEEDED` | Schachteltiefe > 4 |
| `ERR_ORPHAN_TAIL` | `~ ` ohne vorausgehenden Unterpunktblock auf passender Spalte |
| `ERR_ORPHAN_SUBCLAUSE` | Unterpunkt ohne Elternklausel |
| `ERR_EMPTY_DOCUMENT` | Weder Präambel- noch Operativklauseln |
| `ERR_BAD_FRONTMATTER` | Zeile vor `---` ist weder `Key: Wert` noch leer |

| Code | (Warnung) Bedingung |
|---|---|
| `WARN_EMPTY_CHAPEAU` | (Sub-)Klausel ohne Chapeau-Text |
| `WARN_UNKNOWN_KEY` | Unbekannter Front-Matter-Key |
| `WARN_EMPTY_SECTION` | Sektion ohne Klauseln |

---

## 8. Kommentierte Beispiele

### 8.1 Minimal

```
%RES 1.0

Headline: Der Sicherheitsrat
---

== Präambel ==

- in Bekräftigung der Charta der Vereinten Nationen,

== Operativer Teil ==

1. fordert die Einstellung der Feindseligkeiten;
```

→ `Resolution { committeeName: "Der Sicherheitsrat", preamble: [1×],
operative: [1×] }`. Beide Sektionen vorhanden, `blocks[0]` jeweils Text.

### 8.2 Der harte Fall: Text → Unterpunkte → Schlusssatz (rekursiv)

```
2. beschließt,
   (a) eine unabhängige Kommission einzusetzen, die
       (i) jährlich Bericht erstattet;
       (ii) konkrete Empfehlungen ausspricht;
       ~ wobei die Vertraulichkeit gewahrt bleibt;
   (b) die Finanzierung aus dem ordentlichen Haushalt sicherzustellen;
   ~ und mit der Angelegenheit aktiv befasst zu bleiben;
```

Resultierende `blocks`-Struktur:

```
OperativeClause #2
└─ blocks:
   ├─ TextBlock        "beschließt,"
   ├─ SubclausesBlock
   │  ├─ SubClause (a)
   │  │  └─ blocks:
   │  │     ├─ TextBlock       "eine unabhängige Kommission einzusetzen, die"
   │  │     ├─ SubclausesBlock
   │  │     │  ├─ SubClause (i)  → TextBlock "jährlich Bericht erstattet;"
   │  │     │  └─ SubClause (ii) → TextBlock "konkrete Empfehlungen ausspricht;"
   │  │     └─ TextBlock       "wobei die Vertraulichkeit gewahrt bleibt;"   ← ~ @ Spalte 6 schließt (a)
   │  └─ SubClause (b)
   │     └─ blocks: [ TextBlock "die Finanzierung aus dem ordentlichen Haushalt sicherzustellen;" ]
   └─ TextBlock        "und mit der Angelegenheit aktiv befasst zu bleiben;" ← ~ @ Spalte 3 schließt Klausel 2
```

Spaltenlogik: `2.` @0 → Unterpunkte @3 → deren Unterpunkte @6. Inneres `~`
@6 (= Unterpunktspalte von `(a)`) terminiert `(a)`. Äußeres `~` @3
(= Unterpunktspalte von Klausel 2) terminiert Klausel 2. Vollständig
markerbestimmt.

### 8.3 Tolerante Eingabe → kanonische Ausgabe

Eingabe (lockere Nummerierung, 2-Leerzeichen-Indent, Bullets):

```
%res 1.0
headline: Der Sicherheitsrat
---
== preamble ==
* in Bekräftigung der Charta,
== operative ==
1) fordert X;
2) beschließt,
  a) Y;
  b) Z;
```

Kanonische Ausgabe (nach `serialize ∘ parse`):

```
%RES 1.0

Headline: Der Sicherheitsrat
---

== Präambel ==

- in Bekräftigung der Charta,

== Operativer Teil ==

1. fordert X;

2. beschließt,
   (a) Y;
   (b) Z;
```

Idempotent: erneutes `parse`/`serialize` liefert dieselben Bytes.

---

## 9. Bewusst ausgeklammert (Begründung)

- **`AmendmentOverlay`** ist Review-/Kollaborationszustand, kein
  Dokumentinhalt. Gehört in den verlustfreien JSON-Kanal, nicht in ein
  menschlich editiertes Austauschformat.
- **Interne IDs**: dienen Cursor-/CRDT-Erhalt; im Format würden sie nur
  Rauschen erzeugen und LLM-Ausgaben verschlechtern. Re-Import erzeugt neue
  IDs; `replaceResolution` macht den strukturellen Diff.
- **Kommentarsyntax**: in v1 weggelassen, um Parsing-Mehrdeutigkeiten und
  Idempotenzbrüche zu vermeiden. Kann in v1.x additiv ergänzt werden
  (Versionsfeld `%RES` deckt das ab).
- **`conferenceEmblem`** (SVG-Data-URL): potenziell sehr lang, kein
  menschlich editierbarer Inhalt. Bleibt im JSON-Kanal; bei Bedarf später
  als optionaler `Emblem:`-Key nachrüstbar.

---

## 10. Öffentliche API (Vertrag, Implementierung folgt separat)

```ts
parse(text: string): {
  resolution: Resolution;
  header: ResolutionHeaderData;
  warnings: ResWarning[];
};

serialize(resolution: Resolution, header?: ResolutionHeaderData): string; // kanonisch

validate(text: string):
  | { valid: true;  resolution: Resolution; header: ResolutionHeaderData; warnings: ResWarning[] }
  | { valid: false; errors: ResError[] };

declare const RES_VERSION = '1.0';
```

Abhängigkeitsrichtung ausschließlich **`res-markup` → `schema/resolution.ts`**.
Kein Svelte-, Store- oder Y.js-Import, damit das Modul später verlustfrei als
eigenständiges Paket extrahierbar bleibt.
```
