<script lang="ts">
	import type { Snippet } from 'svelte';
	import {
		type Resolution,
		type ResolutionHeaderData,
		type PreambleClause,
		type OperativeClause,
		type SubClause,
		type ClauseBlock,
		createEmptyResolution,
		createEmptyOperativeClause,
		createTextBlock,
		createSubclausesBlock,
		generateClauseId,
		generateSubClauseId,
		getFirstTextContent,
		migrateResolution
	} from '../schema/resolution';
	import {
		type PhrasePattern,
		validatePhrase,
		createPhrasePatterns
	} from '../services/phraseValidation';
	import type { ParsedOperativeClause } from '../services/resolutionParser';
	import type { ResolutionEditorLabels } from '../i18n/types';
	import { englishLabels } from '../i18n/en';
	import ClauseEditor from './ClauseEditor.svelte';
	import OperativeClauseEditor from './OperativeClauseEditor.svelte';
	import ResolutionPreview from './ResolutionPreview.svelte';
	import PhraseLookupModal from './PhraseLookupModal.svelte';
	import ImportModal from './ImportModal.svelte';

	interface Props {
		committeeName: string;
		resolution: Resolution;
		editable?: boolean;
		headerData?: ResolutionHeaderData;
		// Phrase patterns (provide either patterns or phrases arrays)
		preamblePatterns?: PhrasePattern[];
		operativePatterns?: PhrasePattern[];
		preamblePhrases?: string[];
		operativePhrases?: string[];
		// i18n
		labels?: Partial<ResolutionEditorLabels>;
		// Callbacks
		onResolutionChange?: (resolution: Resolution) => void;
		onCopySuccess?: (phrase: string) => void;
		onCopyError?: (error: Error) => void;
		// Extension points (Svelte 5 snippets)
		clauseToolbar?: Snippet<[{ clause: OperativeClause; index: number }]>;
		clauseAnnotations?: Snippet<[{ clause: OperativeClause; index: number }]>;
		previewHeader?: Snippet<[{ resolution: Resolution; headerData?: ResolutionHeaderData }]>;
		previewFooter?: Snippet<[{ resolution: Resolution }]>;
	}

	let {
		committeeName,
		resolution: initialContent,
		editable = true,
		headerData,
		preamblePatterns: preamblePatternsInput,
		operativePatterns: operativePatternsInput,
		preamblePhrases = [],
		operativePhrases = [],
		labels = {},
		onResolutionChange,
		onCopySuccess,
		onCopyError,
		clauseToolbar,
		clauseAnnotations,
		previewHeader,
		previewFooter
	}: Props = $props();

	// Merge labels with defaults
	const t = { ...englishLabels, ...labels };

	// Initialize resolution state with migration from legacy format
	const initialResolution = migrateResolution(
		initialContent ?? createEmptyResolution(committeeName)
	) as Resolution;

	let resolution = $state<Resolution>(initialResolution);

	// Use provided patterns or create from phrase arrays
	let preamblePatterns = $derived(preamblePatternsInput ?? createPhrasePatterns(preamblePhrases));
	let operativePatterns = $derived(
		operativePatternsInput ?? createPhrasePatterns(operativePhrases)
	);

	// Ensure committeeName is always current
	$effect(() => {
		resolution.committeeName = committeeName;
	});

	// Notify parent of resolution changes
	$effect(() => {
		onResolutionChange?.(resolution);
	});

	// Preview visibility toggle
	let showPreview = $state(true);

	// Lookup modals
	let showPreambleLookup = $state(false);
	let showOperativeLookup = $state(false);

	// Import modals
	let showPreambleImport = $state(false);
	let showOperativeImport = $state(false);

	// Track last focused clause for insertion from lookup modal
	let lastFocusedPreambleIndex = $state<number | null>(null);
	let lastFocusedOperativeIndex = $state<number | null>(null);

	function insertIntoPreamble(phrase: string) {
		if (
			lastFocusedPreambleIndex !== null &&
			lastFocusedPreambleIndex < resolution.preamble.length
		) {
			const clause = resolution.preamble[lastFocusedPreambleIndex];
			// Insert phrase at the start, preserving existing content
			if (clause.content.trim()) {
				clause.content = phrase + ' ' + clause.content;
			} else {
				clause.content = phrase;
			}
		}
	}

	function insertIntoOperative(phrase: string) {
		if (
			lastFocusedOperativeIndex !== null &&
			lastFocusedOperativeIndex < resolution.operative.length
		) {
			const clause = resolution.operative[lastFocusedOperativeIndex];
			// Insert phrase at the start of the first text block
			const firstBlock = clause.blocks[0];
			if (firstBlock?.type === 'text') {
				const newBlocks = [...clause.blocks];
				if (firstBlock.content.trim()) {
					newBlocks[0] = { ...firstBlock, content: phrase + ' ' + firstBlock.content };
				} else {
					newBlocks[0] = { ...firstBlock, content: phrase };
				}
				resolution.operative[lastFocusedOperativeIndex] = { ...clause, blocks: newBlocks };
				resolution.operative = [...resolution.operative]; // Trigger reactivity
			}
		}
	}

	// Import handlers
	function handlePreambleImport(clauses: string[] | ParsedOperativeClause[]) {
		// clauses is string[] for preamble
		const preambleClauses = clauses as string[];
		const newClauses: PreambleClause[] = preambleClauses.map((content) => ({
			id: generateClauseId('p'),
			content
		}));
		resolution.preamble = [...resolution.preamble, ...newClauses];
	}

	// Convert parsed subclauses to new block-based format
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
			return {
				id: generateSubClauseId(),
				blocks
			};
		});
	}

	function handleOperativeImport(clauses: string[] | ParsedOperativeClause[]) {
		// clauses is ParsedOperativeClause[] for operative
		const operativeClauses = clauses as ParsedOperativeClause[];
		const newClauses: OperativeClause[] = operativeClauses.map((parsed) => {
			const blocks: ClauseBlock[] = [createTextBlock(parsed.content)];
			if (parsed.subClauses && parsed.subClauses.length > 0) {
				blocks.push(createSubclausesBlock(convertParsedSubClauses(parsed.subClauses)));
			}
			return {
				id: generateClauseId('o'),
				blocks
			};
		});
		resolution.operative = [...resolution.operative, ...newClauses];
	}

	// Compute validation errors for preamble clauses
	let preambleValidation = $derived(
		resolution.preamble.map((clause) => {
			if (!clause.content.trim()) return { valid: true }; // Empty is OK (not yet filled)
			return validatePhrase(clause.content, preamblePatterns);
		})
	);

	// Compute validation errors for operative clauses (check first text block)
	let operativeValidation = $derived(
		resolution.operative.map((clause) => {
			const firstContent = getFirstTextContent(clause);
			if (!firstContent.trim()) return { valid: true }; // Empty is OK
			return validatePhrase(firstContent, operativePatterns);
		})
	);

	// Preamble clause management
	function addPreambleClause() {
		const newClause: PreambleClause = {
			id: generateClauseId('p'),
			content: ''
		};
		resolution.preamble = [...resolution.preamble, newClause];
	}

	function deletePreambleClause(index: number) {
		resolution.preamble = resolution.preamble.filter((_, i) => i !== index);
	}

	function movePreambleClause(index: number, direction: 'up' | 'down') {
		const newIndex = direction === 'up' ? index - 1 : index + 1;
		if (newIndex < 0 || newIndex >= resolution.preamble.length) return;

		const newPreamble = [...resolution.preamble];
		[newPreamble[index], newPreamble[newIndex]] = [newPreamble[newIndex], newPreamble[index]];
		resolution.preamble = newPreamble;
	}

	// Operative clause management
	function addOperativeClause() {
		resolution.operative = [...resolution.operative, createEmptyOperativeClause()];
	}

	function deleteOperativeClause(index: number) {
		resolution.operative = resolution.operative.filter((_, i) => i !== index);
	}

	function moveOperativeClause(index: number, direction: 'up' | 'down') {
		const newIndex = direction === 'up' ? index - 1 : index + 1;
		if (newIndex < 0 || newIndex >= resolution.operative.length) return;

		const newOperative = [...resolution.operative];
		[newOperative[index], newOperative[newIndex]] = [newOperative[newIndex], newOperative[index]];
		resolution.operative = newOperative;
	}

	// Update an operative clause
	function updateOperativeClause(index: number, clause: OperativeClause) {
		const newOperative = [...resolution.operative];
		newOperative[index] = clause;
		resolution.operative = newOperative;
	}

	// Insert a new operative clause after a specific index (used for outdent from depth 1)
	function insertOperativeClauseAfter(afterIndex: number, newClause: OperativeClause) {
		const newOperative = [...resolution.operative];
		newOperative.splice(afterIndex + 1, 0, newClause);
		resolution.operative = newOperative;
	}
</script>

<fieldset class="fieldset bg-base-200 border-base-300 rounded-box w-full border p-4">
	<legend class="fieldset-legend flex items-center gap-2">
		<span>{editable ? t.resolutionEditor : t.resolution}</span>
	</legend>

	{#if editable}
		<!-- Edit Mode -->
		<div class="space-y-6">
			<!-- Header (non-editable) -->
			<div class="bg-base-100 rounded-lg p-3 border border-base-300">
				<div class="text-xs text-base-content/50 mb-1">{t.resolutionCommittee}</div>
				<div class="font-bold uppercase tracking-wide">{committeeName},</div>
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
						<button type="button" class="btn btn-sm btn-ghost" onclick={addPreambleClause}>
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
						<button type="button" class="btn btn-sm btn-ghost mt-2" onclick={addPreambleClause}>
							<i class="fa-solid fa-plus"></i>
							{t.resolutionAddFirstClause}
						</button>
					</div>
				{:else}
					<div class="space-y-2">
						{#each resolution.preamble as clause, index (clause.id)}
							<ClauseEditor
								bind:content={clause.content}
								placeholder={t.resolutionPreamblePlaceholder}
								canMoveUp={index > 0}
								canMoveDown={index < resolution.preamble.length - 1}
								onMoveUp={() => movePreambleClause(index, 'up')}
								onMoveDown={() => movePreambleClause(index, 'down')}
								onDelete={() => deletePreambleClause(index)}
								onFocus={() => (lastFocusedPreambleIndex = index)}
								validationError={!preambleValidation[index]?.valid
									? t.resolutionUnknownPhrase
									: undefined}
								patterns={preamblePatterns}
								{labels}
							/>
						{/each}
						<button type="button" class="btn btn-sm btn-ghost w-full" onclick={addPreambleClause}>
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
						<button type="button" class="btn btn-sm btn-ghost" onclick={addOperativeClause}>
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
						<button type="button" class="btn btn-sm btn-ghost mt-2" onclick={addOperativeClause}>
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
									{clause}
									{index}
									onUpdate={(updated) => updateOperativeClause(index, updated)}
									canMoveUp={index > 0}
									canMoveDown={index < resolution.operative.length - 1}
									onMoveUp={() => moveOperativeClause(index, 'up')}
									onMoveDown={() => moveOperativeClause(index, 'down')}
									onDelete={() => deleteOperativeClause(index)}
									onFocus={() => (lastFocusedOperativeIndex = index)}
									validationError={!operativeValidation[index]?.valid
										? t.resolutionUnknownPhrase
										: undefined}
									patterns={operativePatterns}
									onOutdentToOperative={(newOp) => insertOperativeClauseAfter(index, newOp)}
									{labels}
								/>
								{#if clauseToolbar}
									<div class="mt-2 flex justify-end">
										{@render clauseToolbar({ clause, index })}
									</div>
								{/if}
							</div>
						{/each}
						<button type="button" class="btn btn-sm btn-ghost w-full" onclick={addOperativeClause}>
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
							{previewHeader}
							{previewFooter}
						/>
					</div>
				{/if}
			</div>
		</div>
	{:else}
		<!-- Read-only Mode -->
		<ResolutionPreview
			{resolution}
			{headerData}
			{preamblePatterns}
			{operativePatterns}
			{labels}
			{previewHeader}
			{previewFooter}
		/>
	{/if}
</fieldset>

<!-- Phrase Lookup Modals -->
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

<!-- Import Modals -->
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
