<script lang="ts">
	import type { PhrasePattern } from '../services/phraseValidation';
	import type { ResolutionEditorLabels } from '../i18n/types';
	import type { TextHandle } from '../store/types';
	import { englishLabels } from '../i18n/en';
	import PhraseSuggestions from './PhraseSuggestions.svelte';

	interface Props {
		handle: TextHandle;
		placeholder?: string;
		label?: string;
		onMoveUp?: () => void;
		onMoveDown?: () => void;
		onDelete?: () => void;
		onAddSubClause?: () => void;
		onFocus?: () => void;
		onInteraction?: () => void;
		disabled?: boolean;
		canMoveUp?: boolean;
		canMoveDown?: boolean;
		showAddSubClause?: boolean;
		validationError?: string;
		patterns?: PhrasePattern[];
		labels?: Partial<ResolutionEditorLabels>;
	}

	let {
		handle,
		placeholder = '',
		label = '',
		onMoveUp,
		onMoveDown,
		onDelete,
		onAddSubClause,
		onFocus,
		onInteraction,
		disabled = false,
		canMoveUp = true,
		canMoveDown = true,
		showAddSubClause = false,
		validationError,
		patterns = [],
		labels = {}
	}: Props = $props();

	const t = $derived({ ...englishLabels, ...labels });

	let showSuggestions = $state(false);
	let suggestionComponent: PhraseSuggestions | undefined = $state();

	// Reactive read of the current value for suggestions and validation UI.
	const currentValue = $derived(handle.get());

	function handleInput() {
		showSuggestions =
			currentValue.length > 0 && currentValue.length < 30 && !currentValue.includes(',');
		onInteraction?.();
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (suggestionComponent?.handleKeyDown(e)) {
			e.preventDefault();
		}
	}

	function handleFocus() {
		onFocus?.();
		if (patterns.length > 0 && currentValue.length > 0 && currentValue.length < 30) {
			showSuggestions = true;
		}
	}

	function handleBlur() {
		setTimeout(() => {
			showSuggestions = false;
		}, 150);
	}

	function selectSuggestion(phrase: string) {
		const commaIndex = currentValue.indexOf(',');
		if (commaIndex > -1) {
			handle.set(phrase + currentValue.slice(commaIndex));
		} else {
			handle.set(phrase);
		}
		showSuggestions = false;
	}
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="flex flex-col gap-2" onclick={() => onInteraction?.()}>
	<div class="flex gap-2 items-start">
		{#if label}
			<span class="text-sm font-medium text-base-content/70 min-w-8 pt-2">{label}</span>
		{/if}

		<div class="relative flex-1">
			<textarea
				{@attach (el) => handle.bindTextarea(el as HTMLTextAreaElement)}
				{placeholder}
				class="textarea textarea-bordered w-full min-h-20 resize-y text-sm leading-relaxed bg-base-100"
				class:textarea-warning={validationError}
				rows="2"
				{disabled}
				oninput={handleInput}
				onkeydown={handleKeyDown}
				onfocus={handleFocus}
				onblur={handleBlur}
			></textarea>

			{#if patterns.length > 0}
				<PhraseSuggestions
					bind:this={suggestionComponent}
					{patterns}
					inputValue={currentValue}
					visible={showSuggestions}
					onSelect={selectSuggestion}
					onClose={() => (showSuggestions = false)}
				/>
			{/if}
		</div>
	</div>

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
