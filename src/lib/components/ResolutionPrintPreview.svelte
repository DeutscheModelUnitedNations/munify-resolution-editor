<script lang="ts">
	import { onMount } from 'svelte';
	import type { Snippet } from 'svelte';
	import type {
		Resolution,
		PreambleClause,
		OperativeClause,
		ResolutionHeaderData,
		AmendmentOverlay
	} from '../schema/resolution';
	import type { PhrasePattern } from '../services/phraseValidation';
	import type { ResolutionEditorLabels } from '../i18n/types';
	import ResolutionPreview from './ResolutionPreview.svelte';

	interface Props {
		resolution: Resolution;
		headerData?: ResolutionHeaderData;
		preamblePatterns?: PhrasePattern[];
		operativePatterns?: PhrasePattern[];
		preamblePhrases?: string[];
		operativePhrases?: string[];
		labels?: Partial<ResolutionEditorLabels>;
		amendments?: AmendmentOverlay[];
		rejectedClauseIds?: string[];
		onAmendmentClick?: (amendmentId: string) => void;
		afterPreambleClause?: Snippet<[{ clause: PreambleClause; index: number }]>;
		afterOperativeClause?: Snippet<[{ clause: OperativeClause; index: number }]>;
		betweenOperativeClauses?: Snippet<[{ index: number }]>;
		previewHeader?: Snippet<[{ resolution: Resolution; headerData?: ResolutionHeaderData }]>;
		previewFooter?: Snippet<[{ resolution: Resolution }]>;
		showPrintButton?: boolean;
		scaleWidth?: number;
	}

	let {
		resolution,
		headerData,
		preamblePatterns,
		operativePatterns,
		preamblePhrases,
		operativePhrases,
		labels,
		amendments,
		rejectedClauseIds,
		onAmendmentClick,
		afterPreambleClause,
		afterOperativeClause,
		betweenOperativeClauses,
		previewHeader,
		previewFooter,
		showPrintButton = true,
		scaleWidth = 0.9
	}: Props = $props();

	let sourceEl: HTMLDivElement | undefined = $state();
	let outputEl: HTMLDivElement | undefined = $state();
	let paged = $state(false);

	onMount(async () => {
		if (!sourceEl || !outputEl) return;
		const { Previewer } = await import('pagedjs');
		const previewer = new Previewer();
		const contentHtml = sourceEl.innerHTML;
		await previewer.preview(contentHtml, [], outputEl);
		paged = true;

		// Scale pages to fit viewport
		requestAnimationFrame(() => {
			const pages = outputEl?.querySelector('.pagedjs_pages') as HTMLElement | null;
			if (pages) {
				const scale = (window.innerWidth * scaleWidth) / pages.offsetWidth;
				if (scale < 1) {
					pages.style.transformOrigin = 'top left';
					pages.style.transform = `scale(${scale})`;
				}
			}
		});
	});
</script>

<svelte:head>
	<style>
		@page {
			size: A4;
			margin: 20mm 25mm;
		}
		@media print {
			@page {
				@bottom-center {
					content: counter(page);
				}
			}
		}
	</style>
</svelte:head>

{#if showPrintButton}
	<div class="print:hidden flex justify-end mb-4">
		<button class="btn btn-primary btn-sm" onclick={() => window.print()}>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				class="w-4 h-4"
			>
				<polyline points="6 9 6 2 18 2 18 9" />
				<path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
				<rect x="6" y="14" width="12" height="8" />
			</svg>
			Print / Export PDF
		</button>
	</div>
{/if}

<div bind:this={sourceEl} class="resolution-print-preview hidden">
	<ResolutionPreview
		{resolution}
		{headerData}
		{preamblePatterns}
		{operativePatterns}
		{preamblePhrases}
		{operativePhrases}
		{labels}
		{amendments}
		{rejectedClauseIds}
		{onAmendmentClick}
		{afterPreambleClause}
		{afterOperativeClause}
		{betweenOperativeClauses}
		{previewHeader}
		{previewFooter}
	/>
</div>

<div bind:this={outputEl} class="resolution-print-preview" class:opacity-0={!paged}></div>

<style>
	/* Remove inner padding/max-width so page margins control spacing */
	.resolution-print-preview :global(.resolution-preview) {
		max-width: none;
		padding: 0;
	}
</style>
