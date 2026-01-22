<script lang="ts">
	import type { PhrasePattern } from '../services/phraseValidation';
	import type { ResolutionEditorLabels } from '../i18n/types';
	import { englishLabels } from '../i18n/en';

	interface Props {
		patterns: PhrasePattern[];
		open: boolean;
		onClose: () => void;
		onSelect?: (phrase: string) => void;
		onCopySuccess?: (phrase: string) => void;
		onCopyError?: (error: Error) => void;
		title?: string;
		labels?: Partial<ResolutionEditorLabels>;
	}

	let {
		patterns,
		open = $bindable(),
		onClose,
		onSelect,
		onCopySuccess,
		onCopyError,
		title,
		labels = {}
	}: Props = $props();

	// Merge labels with defaults
	const t = { ...englishLabels, ...labels };

	let searchQuery = $state('');
	let dialogEl: HTMLDialogElement;

	// Get all phrases from patterns
	let allPhrases = $derived(
		[...new Set(patterns.map((p) => p.phrase))].sort((a, b) => a.localeCompare(b, 'de'))
	);

	// Filter phrases based on search query
	let filteredPhrases = $derived(
		allPhrases.filter((phrase) => phrase.toLowerCase().includes(searchQuery.toLowerCase()))
	);

	function handleSelect(phrase: string) {
		onSelect?.(phrase);
		onClose();
	}

	async function handleCopy(phrase: string) {
		try {
			await navigator.clipboard.writeText(phrase);
			onCopySuccess?.(phrase);
		} catch (err) {
			onCopyError?.(err instanceof Error ? err : new Error('Copy failed'));
		}
	}

	// Handle dialog close via backdrop or escape
	function handleDialogClick(e: MouseEvent) {
		if (e.target === dialogEl) {
			onClose();
		}
	}

	$effect(() => {
		if (open) {
			searchQuery = '';
		}
	});
</script>

<dialog class="modal" class:modal-open={open} bind:this={dialogEl} onclick={handleDialogClick}>
	<div class="modal-box max-w-lg">
		<div class="flex items-center justify-between mb-4">
			<h3 class="font-bold text-lg">
				<i class="fa-solid fa-book mr-2"></i>
				{title ?? t.phraseLookupTitle}
			</h3>
			<button
				type="button"
				class="btn btn-sm btn-circle btn-ghost"
				onclick={onClose}
				aria-label={t.close}
			>
				<i class="fa-solid fa-xmark"></i>
			</button>
		</div>

		<input
			type="text"
			placeholder={t.phraseLookupSearch}
			bind:value={searchQuery}
			class="input input-bordered w-full"
		/>

		<div class="alert alert-info mt-3 py-2 text-sm">
			<i class="fa-solid fa-circle-info"></i>
			<span>{t.phraseLookupDisclaimer}</span>
		</div>

		<ul class="mt-4 max-h-72 overflow-y-auto space-y-1">
			{#each filteredPhrases as phrase}
				<li class="flex items-center gap-1">
					<button
						type="button"
						class="btn btn-ghost btn-sm justify-start flex-1 text-left"
						onclick={() => handleSelect(phrase)}
					>
						{phrase}
					</button>
					<button
						type="button"
						class="btn btn-ghost btn-sm btn-square"
						onclick={() => handleCopy(phrase)}
						aria-label={t.copy}
					>
						<i class="fa-solid fa-copy"></i>
					</button>
				</li>
			{:else}
				<li class="text-center text-base-content/50 py-4">
					{t.phraseLookupNoResults}
				</li>
			{/each}
		</ul>

		<div class="modal-action">
			<button type="button" class="btn" onclick={onClose}>{t.close}</button>
		</div>
	</div>
	<form method="dialog" class="modal-backdrop bg-black/30">
		<button type="button" onclick={onClose}>close</button>
	</form>
</dialog>
