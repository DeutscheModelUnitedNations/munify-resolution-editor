/**
 * German Default Labels for Resolution Editor
 */

import type { ResolutionEditorLabels } from './types';

export const germanLabels: ResolutionEditorLabels = {
	// Editor chrome
	resolutionEditor: 'Resolutions-Editor',
	resolution: 'Resolution',
	resolutionPreview: 'Vorschau',
	resolutionShowPreview: 'Vorschau anzeigen',
	resolutionHidePreview: 'Vorschau ausblenden',

	// Sections
	resolutionCommittee: 'Gremium',
	resolutionPreambleClauses: 'Präambelklauseln',
	resolutionOperativeClauses: 'Operativklauseln',
	resolutionSubClauses: 'Unterklauseln',

	// Actions
	resolutionAddClause: 'Klausel hinzufügen',
	resolutionAddFirstClause: 'Erste Klausel hinzufügen',
	resolutionDeleteClause: 'Löschen',
	resolutionDeleteBlock: 'Block löschen',
	resolutionMoveUp: 'Nach oben',
	resolutionMoveDown: 'Nach unten',
	resolutionIndent: 'Einrücken',
	resolutionOutdent: 'Ausrücken',
	resolutionAddSubClause: 'Unterklausel',
	resolutionAddSibling: 'Klausel hinzufügen',
	resolutionAddNested: 'Verschachtelte Klausel',
	resolutionAddContinuation: 'Fortsetzungstext',

	// Placeholders
	resolutionPreamblePlaceholder: 'Präambelklausel eingeben...',
	resolutionOperativePlaceholder: 'Operativklausel eingeben...',
	resolutionSubClausePlaceholder: 'Unterklausel eingeben...',
	resolutionContinuationPlaceholder: 'Fortsetzungstext eingeben...',

	// Empty states
	resolutionNoPreambleClauses: 'Noch keine Präambelklauseln vorhanden.',
	resolutionNoOperativeClauses: 'Noch keine Operativklauseln vorhanden.',
	resolutionNoClausesYet: 'Noch keine Klauseln vorhanden.',

	// Validation
	resolutionUnknownPhrase: 'Unbekannte Phrase',

	// Phrase lookup
	phraseLookup: 'Phrasen',
	phraseLookupTitle: 'Phrasen-Nachschlagewerk',
	phraseLookupSearch: 'Phrase suchen...',
	phraseLookupDisclaimer:
		'Diese Phrasen sind als Orientierung gedacht. Bitte überprüfen Sie die korrekte Verwendung im Kontext.',
	phraseLookupNoResults: 'Keine Phrasen gefunden.',
	phraseCopied: 'Phrase kopiert!',
	copyFailed: 'Kopieren fehlgeschlagen',

	// Import
	resolutionImport: 'Importieren',
	resolutionImportPreamble: 'Präambelklauseln importieren',
	resolutionImportOperative: 'Operativklauseln importieren',
	resolutionImportButton: '{count} Klausel(n) importieren',
	resolutionImportPreview: 'Vorschau: {count} Klausel(n) erkannt',
	resolutionImportHintPreamble:
		'Fügen Sie Präambelklauseln ein, getrennt durch Komma und Zeilenumbruch.',
	resolutionImportHintOperative:
		'Fügen Sie nummerierte Operativklauseln ein. Unterpunkte werden automatisch erkannt.',
	resolutionImportTipsTitle: 'Tipps für optimale Ergebnisse',
	resolutionImportTipsPreamble1: 'Jede Klausel sollte mit einem Komma enden',
	resolutionImportTipsPreamble2: 'Zeilenumbrüche trennen die einzelnen Klauseln',
	resolutionImportTipsPreamble3: 'Die Klauseln werden in der eingegebenen Reihenfolge importiert',
	resolutionImportTipsOperative1: 'Nummerierte Hauptklauseln: 1. 2. 3. oder 1) 2) 3)',
	resolutionImportTipsOperative2: 'Unterklauseln mit Buchstaben: a) b) c) oder (a) (b) (c)',
	resolutionImportTipsOperative3:
		'Verschachtelte Unterklauseln mit römischen Ziffern: i) ii) iii)',
	resolutionImportTipsOperative4: 'Weitere Verschachtelung mit Doppelbuchstaben: aa) bb) cc)',
	resolutionImportLLMTitle: 'KI-Formatierung',
	resolutionImportLLMInstructions:
		'Kopieren Sie den folgenden Prompt in einen KI-Assistenten, um Ihren Text automatisch formatieren zu lassen:',
	resolutionImportLLMCopyPrompt: 'Prompt kopieren',
	resolutionImportLLMCopied: 'Kopiert!',
	resolutionImportLLMPromptPreamble: `Formatiere den folgenden Text als UN-Resolutions-Präambelklauseln. Jede Klausel sollte:
- Mit einem Kleinbuchstaben beginnen (außer Eigennamen)
- Mit einem Komma enden
- Durch einen Zeilenumbruch getrennt sein

Beispielformat:
in Anbetracht der Notwendigkeit internationaler Zusammenarbeit,
betonend die Bedeutung des Multilateralismus,
mit Sorge zur Kenntnis nehmend die aktuelle Situation,

Zu formatierender Text:`,
	resolutionImportLLMPromptOperative: `Formatiere den folgenden Text als UN-Resolutions-Operativklauseln. Verwende:
- Nummerierung für Hauptklauseln: 1. 2. 3.
- Buchstaben für Unterklauseln: a) b) c)
- Römische Ziffern für weitere Verschachtelung: i) ii) iii)
- Doppelbuchstaben für tiefste Ebene: aa) bb) cc)
- Semikolon am Ende jeder Klausel, Punkt am Ende der letzten

Beispielformat:
1. fordert alle Mitgliedstaaten auf, Maßnahmen zu ergreifen;
   a) zur Förderung des Friedens;
   b) zur Stärkung der Zusammenarbeit;
      i) auf bilateraler Ebene;
      ii) auf multilateraler Ebene;
2. bittet den Generalsekretär, einen Bericht vorzulegen.

Zu formatierender Text:`,

	// Preview metadata
	resolutionAuthoringDelegation: 'Einreichende Delegation',
	resolutionDisclaimer:
		'Dieses Dokument wurde im Rahmen einer {conferenceName}-Simulation erstellt und besitzt keine rechtliche Gültigkeit.',

	// Common
	close: 'Schließen',
	cancel: 'Abbrechen',
	copy: 'Kopieren'
};
