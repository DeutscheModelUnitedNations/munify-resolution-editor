<script lang="ts">
	import type { PhrasePattern } from '../services/phraseValidation';
	import type { ResolutionEditorLabels } from '../i18n/types';
	import { englishLabels } from '../i18n/en';
	import PhraseSuggestions from './PhraseSuggestions.svelte';

	interface Props {
		content: string;
		placeholder?: string;
		label?: string;
		onMoveUp?: () => void;
		onMoveDown?: () => void;
		onDelete?: () => void;
		onAddSubClause?: () => void;
		onFocus?: () => void;
		canMoveUp?: boolean;
		canMoveDown?: boolean;
		showAddSubClause?: boolean;
		validationError?: string;
		patterns?: PhrasePattern[];
		labels?: Partial<ResolutionEditorLabels>;
	}

	let {
		content = $bindable(),
		placeholder = '',
		label = '',
		onMoveUp,
		onMoveDown,
		onDelete,
		onAddSubClause,
		onFocus,
		canMoveUp = true,
		canMoveDown = true,
		showAddSubClause = false,
		validationError,
		patterns = [],
		labels = {}
	}: Props = $props();

	// Merge labels with defaults
	const t = { ...englishLabels, ...labels };

	let showSuggestions = $state(false);
	let suggestionComponent: PhraseSuggestions | undefined = $state();

	function handleInput() {
		// Show suggestions only when typing at start of content (first ~30 chars, no comma yet)
		showSuggestions = content.length > 0 && content.length < 30 && !content.includes(',');
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (suggestionComponent?.handleKeyDown(e)) {
			e.preventDefault();
		}
	}

	function handleFocus() {
		onFocus?.();
		if (patterns.length > 0 && content.length > 0 && content.length < 30) {
			showSuggestions = true;
		}
	}

	function handleBlur() {
		// Delay to allow click on suggestion
		setTimeout(() => {
			showSuggestions = false;
		}, 150);
	}

	function selectSuggestion(phrase: string) {
		// Replace the beginning of content with the selected phrase
		// If there's a comma, keep everything after it
		const commaIndex = content.indexOf(',');
		if (commaIndex > -1) {
			content = phrase + content.slice(commaIndex);
		} else {
			content = phrase;
		}
		showSuggestions = false;
	}
</script>

<div class="flex flex-col gap-2">
	<!-- Clause content row -->
	<div class="flex gap-2 items-start">
		<!-- Clause label (optional) -->
		{#if label}
			<span class="text-sm font-medium text-base-content/70 min-w-8 pt-2">{label}</span>
		{/if}

		<!-- Textarea for clause content with suggestions -->
		<div class="relative flex-1">
			<textarea
				bind:value={content}
				{placeholder}
				class="textarea textarea-bordered w-full min-h-20 resize-y text-sm leading-relaxed"
				class:textarea-warning={validationError}
				rows="2"
				oninput={handleInput}
				onkeydown={handleKeyDown}
				onfocus={handleFocus}
				onblur={handleBlur}
			></textarea>

			{#if patterns.length > 0}
				<PhraseSuggestions
					bind:this={suggestionComponent}
					{patterns}
					inputValue={content}
					visible={showSuggestions}
					onSelect={selectSuggestion}
					onClose={() => (showSuggestions = false)}
				/>
			{/if}
		</div>
	</div>

	<!-- Action buttons row -->
	<div class="flex flex-wrap gap-1 {label ? 'ml-10' : ''}">
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
			disabled={!canMoveUp}
		>
			<i class="fa-solid fa-chevron-up"></i>
			{t.resolutionMoveUp}
		</button>
		<button
			type="button"
			class="btn btn-ghost btn-xs gap-1"
			onclick={onMoveDown}
			disabled={!canMoveDown}
		>
			<i class="fa-solid fa-chevron-down"></i>
			{t.resolutionMoveDown}
		</button>
		{#if showAddSubClause && onAddSubClause}
			<button
				type="button"
				class="btn btn-ghost btn-xs gap-1 text-primary"
				onclick={onAddSubClause}
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
