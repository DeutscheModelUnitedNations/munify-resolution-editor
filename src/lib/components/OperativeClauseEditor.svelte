<script lang="ts">
	import { type OperativeClause, getFirstTextContent } from '../schema/resolution';
	import type { PhrasePattern } from '../services/phraseValidation';
	import type { ResolutionEditorLabels } from '../i18n/types';
	import type { ResolutionStore } from '../store/types';
	import { englishLabels } from '../i18n/en';
	import SubClauseEditor from './SubClauseEditor.svelte';
	import PhraseSuggestions from './PhraseSuggestions.svelte';

	interface Props {
		store: ResolutionStore;
		clause: OperativeClause;
		index: number;
		onMoveUp?: () => void;
		onMoveDown?: () => void;
		onDelete?: () => void;
		onFocus?: () => void;
		onInteraction?: () => void;
		disabled?: boolean;
		canMoveUp?: boolean;
		canMoveDown?: boolean;
		validationError?: string;
		patterns?: PhrasePattern[];
		labels?: Partial<ResolutionEditorLabels>;
	}

	let {
		store,
		clause,
		index,
		onMoveUp,
		onMoveDown,
		onDelete,
		onFocus,
		onInteraction,
		disabled = false,
		canMoveUp = true,
		canMoveDown = true,
		validationError,
		patterns = [],
		labels = {}
	}: Props = $props();

	const t = $derived({ ...englishLabels, ...labels });

	let showSuggestions = $state(false);
	let suggestionComponent: PhraseSuggestions | undefined = $state();

	const firstTextContent = $derived(getFirstTextContent(clause));
	const firstTextBlockId = $derived(clause.blocks[0]?.type === 'text' ? clause.blocks[0].id : null);
	const hasSubclausesBlock = $derived(clause.blocks.some((b) => b.type === 'subclauses'));

	function addSubClausesBlock() {
		store.appendSubclausesBlock({ kind: 'operative', clauseId: clause.id });
	}

	function addContinuationText() {
		store.appendTextBlock({ kind: 'operative', clauseId: clause.id });
	}

	function deleteBlock(blockId: string) {
		store.deleteBlock({ kind: 'operative', clauseId: clause.id }, blockId);
	}

	function handleFirstInput(content: string) {
		showSuggestions = content.length > 0 && content.length < 30 && !content.includes(',');
		onInteraction?.();
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (suggestionComponent?.handleKeyDown(e)) {
			e.preventDefault();
		}
	}

	function handleFirstFocus() {
		onFocus?.();
		if (patterns.length > 0 && firstTextContent.length > 0 && firstTextContent.length < 30) {
			showSuggestions = true;
		}
	}

	function handleBlur() {
		setTimeout(() => {
			showSuggestions = false;
		}, 150);
	}

	function selectSuggestion(phrase: string) {
		if (!firstTextBlockId) return;
		const content = firstTextContent;
		const commaIndex = content.indexOf(',');
		const newContent = commaIndex > -1 ? phrase + content.slice(commaIndex) : phrase;
		store.updateTextBlock({ kind: 'operative', clauseId: clause.id }, firstTextBlockId, newContent);
		showSuggestions = false;
	}
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="bg-base-100 rounded-lg p-3 border border-base-300" onclick={() => onInteraction?.()}>
	{#each clause.blocks as block, blockIndex (block.id)}
		{#if block.type === 'text'}
			{@const handle = store.getTextHandle({
				kind: 'operative-text',
				clauseId: clause.id,
				blockId: block.id
			})}
			<div class="flex gap-2 items-start" class:mt-3={blockIndex > 0}>
				{#if blockIndex === 0}
					<span class="text-sm font-medium text-base-content/70 min-w-8 pt-2">
						{index + 1}.
					</span>
				{:else}
					<span class="min-w-8"></span>
				{/if}

				<div class="relative flex-1">
					<textarea
						{@attach (el) => handle.bindTextarea(el)}
						oninput={(e) =>
							blockIndex === 0 ? handleFirstInput(e.currentTarget.value) : undefined}
						placeholder={blockIndex === 0
							? t.resolutionOperativePlaceholder
							: t.resolutionContinuationPlaceholder}
						class="textarea textarea-bordered w-full min-h-20 resize-y text-sm leading-relaxed bg-base-100"
						class:textarea-warning={blockIndex === 0 && validationError}
						rows="2"
						{disabled}
						onkeydown={blockIndex === 0 ? handleKeyDown : undefined}
						onfocus={blockIndex === 0 ? handleFirstFocus : undefined}
						onblur={blockIndex === 0 ? handleBlur : undefined}
					></textarea>

					{#if blockIndex === 0 && patterns.length > 0}
						<PhraseSuggestions
							bind:this={suggestionComponent}
							{patterns}
							inputValue={firstTextContent}
							visible={showSuggestions}
							onSelect={selectSuggestion}
							onClose={() => (showSuggestions = false)}
						/>
					{/if}
				</div>
			</div>

			{#if blockIndex > 0}
				<div class="flex flex-wrap gap-1 ml-10 mt-1">
					<div class="flex-1"></div>
					<button
						type="button"
						class="btn btn-ghost btn-xs gap-1 text-error"
						onclick={() => deleteBlock(block.id)}
					>
						<i class="fa-solid fa-trash"></i>
						{t.resolutionDeleteBlock}
					</button>
				</div>
			{/if}
		{:else if block.type === 'subclauses'}
			<div class="mt-3 pt-3 border-t border-base-200">
				<SubClauseEditor
					{store}
					path={{ kind: 'operative', clauseId: clause.id }}
					subClauses={block.items}
					depth={1}
					{disabled}
					{labels}
				/>
				<div class="mt-2 flex gap-1 ml-4">
					<button
						type="button"
						class="btn btn-ghost btn-xs gap-1 text-primary"
						onclick={addContinuationText}
					>
						<i class="fa-solid fa-paragraph"></i>
						{t.resolutionAddContinuation}
					</button>
				</div>
			</div>
		{/if}
	{/each}

	<div class="flex flex-wrap gap-1 {clause.blocks[0]?.type === 'text' ? 'ml-10' : ''} mt-2">
		{#if validationError}
			<span class="badge badge-warning badge-sm gap-1">
				<i class="fa-solid fa-triangle-exclamation"></i>
				{t.resolutionUnknownPhrase}
			</span>
		{/if}

		<div class="flex-1"></div>

		<button
			type="button"
			class="btn btn-ghost btn-xs gap-1"
			onclick={onMoveUp}
			disabled={disabled || !canMoveUp}
		>
			<i class="fa-solid fa-chevron-up"></i>
			{t.resolutionMoveUp}
		</button>
		<button
			type="button"
			class="btn btn-ghost btn-xs gap-1"
			onclick={onMoveDown}
			disabled={disabled || !canMoveDown}
		>
			<i class="fa-solid fa-chevron-down"></i>
			{t.resolutionMoveDown}
		</button>
		{#if !hasSubclausesBlock}
			<button
				type="button"
				class="btn btn-ghost btn-xs gap-1 text-primary"
				onclick={addSubClausesBlock}
			>
				<i class="fa-solid fa-indent"></i>
				{t.resolutionAddSubClause}
			</button>
		{/if}
		<button type="button" class="btn btn-ghost btn-xs gap-1 text-error" onclick={onDelete}>
			<i class="fa-solid fa-trash"></i>
			{t.resolutionDeleteClause}
		</button>
	</div>
</div>
