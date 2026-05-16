<script lang="ts">
	import type { Snippet } from 'svelte';
	import {
		type Resolution,
		type ResolutionHeaderData,
		type PreambleClause,
		type OperativeClause,
		type SubClause,
		type ClauseBlock,
		type AmendmentOverlay,
		createTextBlock,
		createSubclausesBlock,
		generateClauseId,
		generateSubClauseId,
		getFirstTextContent
	} from '../schema/resolution';
	import {
		type PhrasePattern,
		validatePhrase,
		createPhrasePatterns
	} from '../services/phraseValidation';
	import type { ParsedOperativeClause } from '../services/resolutionParser';
	import type { ResolutionEditorLabels } from '../i18n/types';
	import type { PresenceAdapter, ResolutionStore } from '../store/types';
	import { englishLabels } from '../i18n/en';
	import ClauseEditor from './ClauseEditor.svelte';
	import OperativeClauseEditor from './OperativeClauseEditor.svelte';
	import ResolutionPreview from './ResolutionPreview.svelte';
	import PhraseLookupModal from './PhraseLookupModal.svelte';
	import ImportModal from './ImportModal.svelte';
	import ResolutionImportModal from './ResolutionImportModal.svelte';
	import { serialize, suggestResolutionFilename } from '../res-markup';

	interface Props {
		store: ResolutionStore;
		editable?: boolean;
		headerData?: ResolutionHeaderData;
		preamblePatterns?: PhrasePattern[];
		operativePatterns?: PhrasePattern[];
		preamblePhrases?: string[];
		operativePhrases?: string[];
		labels?: Partial<ResolutionEditorLabels>;
		onCopySuccess?: (phrase: string) => void;
		onCopyError?: (error: Error) => void;
		amendments?: AmendmentOverlay[];
		rejectedClauseIds?: string[];
		onAmendmentClick?: (amendmentId: string) => void;
		/**
		 * Called after a full RES-Markup document import with the parsed
		 * header metadata, so the host can update its own `headerData`
		 * (the store only owns the `Resolution` body).
		 */
		onImportHeader?: (header: ResolutionHeaderData) => void;
		/** Optional remote-user awareness adapter. Native consumers pass undefined. */
		presence?: PresenceAdapter;
		// Snippet extension points
		clauseToolbar?: Snippet<[{ clause: OperativeClause; index: number }]>;
		preambleClauseToolbar?: Snippet<[{ clause: PreambleClause; index: number }]>;
		clauseAnnotations?: Snippet<[{ clause: OperativeClause; index: number }]>;
		preambleAnnotations?: Snippet<[{ clause: PreambleClause; index: number }]>;
		afterPreambleClause?: Snippet<[{ clause: PreambleClause; index: number }]>;
		afterOperativeClause?: Snippet<[{ clause: OperativeClause; index: number }]>;
		betweenOperativeClauses?: Snippet<[{ index: number }]>;
		previewHeader?: Snippet<[{ resolution: Resolution; headerData?: ResolutionHeaderData }]>;
		previewFooter?: Snippet<[{ resolution: Resolution }]>;
	}

	let {
		store,
		editable = true,
		headerData,
		preamblePatterns: preamblePatternsInput,
		operativePatterns: operativePatternsInput,
		preamblePhrases = [],
		operativePhrases = [],
		labels = {},
		onCopySuccess,
		onCopyError,
		amendments = [],
		rejectedClauseIds = [],
		onAmendmentClick,
		onImportHeader,
		presence,
		clauseToolbar,
		preambleClauseToolbar,
		clauseAnnotations,
		preambleAnnotations,
		afterPreambleClause,
		afterOperativeClause,
		betweenOperativeClauses,
		previewHeader,
		previewFooter
	}: Props = $props();

	const t = $derived({ ...englishLabels, ...labels });

	const resolution = $derived(store.snapshot);

	const preamblePatterns = $derived(preamblePatternsInput ?? createPhrasePatterns(preamblePhrases));
	const operativePatterns = $derived(
		operativePatternsInput ?? createPhrasePatterns(operativePhrases)
	);

	let showPreview = $state(true);
	let showPreambleLookup = $state(false);
	let showOperativeLookup = $state(false);
	let showPreambleImport = $state(false);
	let showOperativeImport = $state(false);
	let showResolutionImport = $state(false);

	let lastFocusedPreambleId = $state<string | null>(null);
	let lastFocusedOperativeId = $state<string | null>(null);
	let lastFocusedId = $state<string | null>(null);

	// Push local focus into the presence adapter so remote peers see it.
	// Use a single most-recently-focused id rather than preferring preamble —
	// otherwise focusing an operative clause never overrides a stale preamble id.
	$effect(() => {
		presence?.setFocus(lastFocusedId ?? undefined);
	});

	// Validation
	const preambleValidation = $derived(
		resolution.preamble.map((clause) => {
			if (!clause.content.trim()) return { valid: true } as { valid: boolean };
			return validatePhrase(clause.content, preamblePatterns);
		})
	);

	const operativeValidation = $derived(
		resolution.operative.map((clause) => {
			const firstContent = getFirstTextContent(clause);
			if (!firstContent.trim()) return { valid: true } as { valid: boolean };
			return validatePhrase(firstContent, operativePatterns);
		})
	);

	// Phrase insertion handlers (target the last-focused clause).
	function insertIntoPreamble(phrase: string) {
		const id = lastFocusedPreambleId;
		if (!id) return;
		const clause = resolution.preamble.find((c) => c.id === id);
		if (!clause) return;
		const next = clause.content.trim() ? phrase + ' ' + clause.content : phrase;
		store.updatePreambleContent(id, next);
	}

	function insertIntoOperative(phrase: string) {
		const id = lastFocusedOperativeId;
		if (!id) return;
		const clause = resolution.operative.find((c) => c.id === id);
		if (!clause) return;
		const firstBlock = clause.blocks[0];
		if (firstBlock?.type !== 'text') return;
		const next = firstBlock.content.trim() ? phrase + ' ' + firstBlock.content : phrase;
		store.updateTextBlock({ kind: 'operative', clauseId: id }, firstBlock.id, next);
	}

	// Import handlers
	function handlePreambleImport(clauses: string[] | ParsedOperativeClause[]) {
		const list = clauses as string[];
		const newClauses: PreambleClause[] = list.map((content) => ({
			id: generateClauseId('p'),
			content
		}));
		store.insertPreambleClauses(resolution.preamble.length, newClauses);
	}

	function convertParsedSubClauses(
		parsed: { content: string; children?: { content: string; children?: unknown[] }[] }[]
	): SubClause[] {
		return parsed.map((p) => {
			const blocks: ClauseBlock[] = [createTextBlock(p.content)];
			if (p.children && p.children.length > 0) {
				blocks.push(
					createSubclausesBlock(
						convertParsedSubClauses(
							p.children as {
								content: string;
								children?: { content: string; children?: unknown[] }[];
							}[]
						)
					)
				);
			}
			return { id: generateSubClauseId(), blocks };
		});
	}

	function handleOperativeImport(clauses: string[] | ParsedOperativeClause[]) {
		const list = clauses as ParsedOperativeClause[];
		const newClauses: OperativeClause[] = list.map((parsed) => {
			const blocks: ClauseBlock[] = [createTextBlock(parsed.content)];
			if (parsed.subClauses && parsed.subClauses.length > 0) {
				blocks.push(createSubclausesBlock(convertParsedSubClauses(parsed.subClauses)));
			}
			return { id: generateClauseId('o'), blocks };
		});
		store.insertOperativeClauses(resolution.operative.length, newClauses);
	}

	// Full RES-Markup document import / export
	function handleResolutionImport(next: Resolution, header: ResolutionHeaderData) {
		store.replaceResolution(next);
		onImportHeader?.(header);
	}

	function handleResolutionExport() {
		const text = serialize(resolution, headerData ?? {});
		const filename = suggestResolutionFilename(
			headerData?.documentNumber,
			resolution.committeeName
		);
		const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = filename;
		document.body.appendChild(a);
		a.click();
		a.remove();
		URL.revokeObjectURL(url);
	}
</script>

<fieldset class="fieldset bg-base-200 border-base-300 rounded-box w-full border p-4">
	<legend class="fieldset-legend flex items-center gap-2">
		<span>{editable ? t.resolutionEditor : t.resolution}</span>
	</legend>

	{#if editable}
		<div class="space-y-6">
			<div class="flex items-center justify-between gap-2">
				<div class="bg-base-100 rounded-lg p-3 border border-base-300 grow">
					<div class="text-xs text-base-content/50 mb-1">{t.resolutionCommittee}</div>
					<div class="font-bold uppercase tracking-wide">{resolution.committeeName},</div>
				</div>
				<div class="flex gap-2 shrink-0">
					<button
						type="button"
						class="btn btn-sm btn-ghost"
						onclick={() => (showResolutionImport = true)}
					>
						<i class="fa-solid fa-file-import"></i>
						{t.resolutionImportResolution}
					</button>
					<button type="button" class="btn btn-sm btn-ghost" onclick={handleResolutionExport}>
						<i class="fa-solid fa-file-export"></i>
						{t.resolutionExport}
					</button>
				</div>
			</div>

			<!-- Preamble Section -->
			<div class="space-y-3">
				<div class="flex items-center justify-between">
					<h3 class="font-semibold text-base-content/80">
						<i class="fa-solid fa-quote-left mr-2"></i>
						{t.resolutionPreambleClauses}
					</h3>
					<div class="flex gap-2">
						<button
							type="button"
							class="btn btn-sm btn-ghost"
							onclick={() => (showPreambleLookup = true)}
						>
							<i class="fa-solid fa-book"></i>
							{t.phraseLookup}
						</button>
						<button
							type="button"
							class="btn btn-sm btn-ghost"
							onclick={() => (showPreambleImport = true)}
						>
							<i class="fa-solid fa-file-import"></i>
							{t.resolutionImport}
						</button>
						<button
							type="button"
							class="btn btn-sm btn-ghost"
							onclick={() => store.addPreambleClause()}
						>
							<i class="fa-solid fa-plus"></i>
							{t.resolutionAddClause}
						</button>
					</div>
				</div>

				{#if resolution.preamble.length === 0}
					<div
						class="text-center py-4 text-base-content/50 bg-base-100 rounded-lg border border-dashed border-base-300"
					>
						<p class="text-sm">{t.resolutionNoPreambleClauses}</p>
						<button
							type="button"
							class="btn btn-sm btn-ghost mt-2"
							onclick={() => store.addPreambleClause()}
						>
							<i class="fa-solid fa-plus"></i>
							{t.resolutionAddFirstClause}
						</button>
					</div>
				{:else}
					<div class="space-y-2">
						{#each resolution.preamble as clause, index (clause.id)}
							<div class="relative">
								{#if preambleAnnotations}
									<div class="absolute -left-2 -top-2 z-10">
										{@render preambleAnnotations({ clause, index })}
									</div>
								{/if}
								<ClauseEditor
									handle={store.getTextHandle({ kind: 'preamble', clauseId: clause.id })}
									placeholder={t.resolutionPreamblePlaceholder}
									canMoveUp={index > 0}
									canMoveDown={index < resolution.preamble.length - 1}
									onMoveUp={() => store.movePreambleClause(clause.id, 'up')}
									onMoveDown={() => store.movePreambleClause(clause.id, 'down')}
									onDelete={() => store.deletePreambleClause(clause.id)}
									onFocus={() => {
										lastFocusedPreambleId = clause.id;
										lastFocusedId = clause.id;
									}}
									validationError={!preambleValidation[index]?.valid
										? t.resolutionUnknownPhrase
										: undefined}
									patterns={preamblePatterns}
									{labels}
								/>
							</div>
							{#if preambleClauseToolbar}
								<div class="mt-2">
									{@render preambleClauseToolbar({ clause, index })}
								</div>
							{/if}
						{/each}
						<button
							type="button"
							class="btn btn-sm btn-ghost w-full"
							onclick={() => store.addPreambleClause()}
						>
							<i class="fa-solid fa-plus"></i>
							{t.resolutionAddClause}
						</button>
					</div>
				{/if}
			</div>

			<!-- Operative Section -->
			<div class="space-y-3">
				<div class="flex items-center justify-between">
					<h3 class="font-semibold text-base-content/80">
						<i class="fa-solid fa-list-ol mr-2"></i>
						{t.resolutionOperativeClauses}
					</h3>
					<div class="flex gap-2">
						<button
							type="button"
							class="btn btn-sm btn-ghost"
							onclick={() => (showOperativeLookup = true)}
						>
							<i class="fa-solid fa-book"></i>
							{t.phraseLookup}
						</button>
						<button
							type="button"
							class="btn btn-sm btn-ghost"
							onclick={() => (showOperativeImport = true)}
						>
							<i class="fa-solid fa-file-import"></i>
							{t.resolutionImport}
						</button>
						<button
							type="button"
							class="btn btn-sm btn-ghost"
							onclick={() => store.addOperativeClause()}
						>
							<i class="fa-solid fa-plus"></i>
							{t.resolutionAddClause}
						</button>
					</div>
				</div>

				{#if resolution.operative.length === 0}
					<div
						class="text-center py-4 text-base-content/50 bg-base-100 rounded-lg border border-dashed border-base-300"
					>
						<p class="text-sm">{t.resolutionNoOperativeClauses}</p>
						<button
							type="button"
							class="btn btn-sm btn-ghost mt-2"
							onclick={() => store.addOperativeClause()}
						>
							<i class="fa-solid fa-plus"></i>
							{t.resolutionAddFirstClause}
						</button>
					</div>
				{:else}
					<div class="space-y-4">
						{#each resolution.operative as clause, index (clause.id)}
							<div class="relative">
								{#if clauseAnnotations}
									<div class="absolute -left-2 -top-2 z-10">
										{@render clauseAnnotations({ clause, index })}
									</div>
								{/if}
								<OperativeClauseEditor
									{store}
									{clause}
									{index}
									canMoveUp={index > 0}
									canMoveDown={index < resolution.operative.length - 1}
									onMoveUp={() => store.moveOperativeClause(clause.id, 'up')}
									onMoveDown={() => store.moveOperativeClause(clause.id, 'down')}
									onDelete={() => store.deleteOperativeClause(clause.id)}
									onFocus={() => {
										lastFocusedOperativeId = clause.id;
										lastFocusedId = clause.id;
									}}
									validationError={!operativeValidation[index]?.valid
										? t.resolutionUnknownPhrase
										: undefined}
									patterns={operativePatterns}
									{labels}
								/>
							</div>
							{#if clauseToolbar}
								<div class="mt-2">
									{@render clauseToolbar({ clause, index })}
								</div>
							{/if}
						{/each}
						<button
							type="button"
							class="btn btn-sm btn-ghost w-full"
							onclick={() => store.addOperativeClause()}
						>
							<i class="fa-solid fa-plus"></i>
							{t.resolutionAddClause}
						</button>
					</div>
				{/if}
			</div>

			<!-- Live Preview Section -->
			<div class="border-t border-base-300 pt-6">
				<div class="flex items-center justify-between mb-4">
					<h3 class="font-semibold text-base-content/80">
						<i class="fa-solid fa-eye mr-2"></i>
						{t.resolutionPreview}
					</h3>
					<button
						type="button"
						class="btn btn-ghost btn-xs"
						onclick={() => (showPreview = !showPreview)}
					>
						<i class="fa-solid {showPreview ? 'fa-chevron-up' : 'fa-chevron-down'}"></i>
						{showPreview ? t.resolutionHidePreview : t.resolutionShowPreview}
					</button>
				</div>
				{#if showPreview}
					<div class="bg-base-100 rounded-lg border border-base-300 p-4">
						<ResolutionPreview
							{resolution}
							{headerData}
							{preamblePatterns}
							{operativePatterns}
							{labels}
							{amendments}
							{rejectedClauseIds}
							{onAmendmentClick}
							{previewHeader}
							{previewFooter}
							{afterPreambleClause}
							{afterOperativeClause}
							{betweenOperativeClauses}
						/>
					</div>
				{/if}
			</div>
		</div>
	{:else}
		<ResolutionPreview
			{resolution}
			{headerData}
			{preamblePatterns}
			{operativePatterns}
			{labels}
			{amendments}
			{rejectedClauseIds}
			{onAmendmentClick}
			{previewHeader}
			{previewFooter}
			{afterPreambleClause}
			{afterOperativeClause}
			{betweenOperativeClauses}
		/>
	{/if}
</fieldset>

<PhraseLookupModal
	patterns={preamblePatterns}
	bind:open={showPreambleLookup}
	onClose={() => (showPreambleLookup = false)}
	onSelect={insertIntoPreamble}
	title="{t.phraseLookupTitle} ({t.resolutionPreambleClauses})"
	{onCopySuccess}
	{onCopyError}
	{labels}
/>

<PhraseLookupModal
	patterns={operativePatterns}
	bind:open={showOperativeLookup}
	onClose={() => (showOperativeLookup = false)}
	onSelect={insertIntoOperative}
	title="{t.phraseLookupTitle} ({t.resolutionOperativeClauses})"
	{onCopySuccess}
	{onCopyError}
	{labels}
/>

<ImportModal
	bind:open={showPreambleImport}
	type="preamble"
	onClose={() => (showPreambleImport = false)}
	onImport={handlePreambleImport}
	{labels}
/>

<ImportModal
	bind:open={showOperativeImport}
	type="operative"
	onClose={() => (showOperativeImport = false)}
	onImport={handleOperativeImport}
	{labels}
/>

<ResolutionImportModal
	bind:open={showResolutionImport}
	onClose={() => (showResolutionImport = false)}
	onImport={handleResolutionImport}
	{labels}
/>
