<script lang="ts">
	import type { ResolutionEditorLabels } from '../i18n/types';
	import { englishLabels } from '../i18n/en';
	import type { Resolution, ResolutionHeaderData } from '../schema/resolution';
	import { validate } from '../res-markup';

	interface Props {
		open: boolean;
		onClose: () => void;
		onImport: (resolution: Resolution, header: ResolutionHeaderData) => void;
		labels?: Partial<ResolutionEditorLabels>;
	}

	let { open = $bindable(), onClose, onImport, labels = {} }: Props = $props();

	const t = $derived({ ...englishLabels, ...labels });

	let inputText = $state('');
	let dialogEl: HTMLDialogElement;

	const placeholderText = [
		'%RES 1.0',
		'',
		'Committee: General Assembly',
		'',
		'== Header ==',
		'',
		'THE GENERAL ASSEMBLY,',
		'',
		'== Preamble ==',
		'',
		'- Recalling …,',
		'',
		'== Operative ==',
		'',
		'[CLAUSE]',
		'Calls upon …;'
	].join('\n');

	const result = $derived(inputText.trim() ? validate(inputText) : null);

	function countSubclauses(blocks: { type: string; items?: { blocks: unknown[] }[] }[]): number {
		let n = 0;
		for (const b of blocks) {
			if (b.type === 'subclauses' && b.items) {
				n += b.items.length;
				for (const it of b.items)
					n += countSubclauses(it.blocks as { type: string; items?: { blocks: unknown[] }[] }[]);
			}
		}
		return n;
	}

	const summary = $derived.by(() => {
		if (!result || !result.valid) return null;
		const r = result.resolution;
		const subs = r.operative.reduce(
			(acc, c) =>
				acc + countSubclauses(c.blocks as { type: string; items?: { blocks: unknown[] }[] }[]),
			0
		);
		return {
			committeeName: r.committeeName,
			headline: result.header.committeeResolutionHeadline,
			preamble: r.preamble.length,
			operative: r.operative.length,
			subs,
			warnings: result.warnings
		};
	});

	async function handleFile(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		inputText = await file.text();
	}

	function handleImport() {
		if (!result || !result.valid) return;
		onImport(result.resolution, result.header);
		inputText = '';
		onClose();
	}

	function handleDialogClick(e: MouseEvent) {
		if (e.target === dialogEl) onClose();
	}

	$effect(() => {
		if (open) inputText = '';
	});
</script>

<dialog class="modal" class:modal-open={open} bind:this={dialogEl} onclick={handleDialogClick}>
	<div class="modal-box max-w-2xl">
		<div class="flex items-center justify-between mb-4">
			<h3 class="font-bold text-lg">
				<i class="fa-solid fa-file-import mr-2"></i>
				{t.resolutionImportResolution}
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

		<p class="text-sm text-base-content/70 mb-3">{t.resolutionImportResolutionHint}</p>

		<div class="mb-3">
			<input
				type="file"
				accept=".txt,.res,.res.txt,text/plain"
				class="file-input file-input-bordered file-input-sm w-full"
				onchange={handleFile}
				aria-label={t.resolutionImportResolutionFile}
			/>
		</div>

		<textarea
			bind:value={inputText}
			placeholder={placeholderText}
			class="textarea textarea-bordered w-full min-h-40 font-mono text-sm"
			rows="10"
		></textarea>

		{#if !inputText.trim()}
			<p class="text-sm text-base-content/50 mt-4">{t.resolutionImportResolutionEmpty}</p>
		{:else if result && result.valid && summary}
			<div class="mt-4 bg-base-200 rounded-lg p-3 text-sm space-y-1">
				<div class="flex items-center gap-2 font-medium text-success">
					<i class="fa-solid fa-circle-check"></i>
					<span>{summary.committeeName || '—'}</span>
				</div>
				{#if summary.headline}
					<div class="text-base-content/70 italic">{summary.headline}</div>
				{/if}
				<div class="text-base-content/70">
					{summary.preamble}
					{t.resolutionPreambleClauses} · {summary.operative}
					{t.resolutionOperativeClauses}
					{#if summary.subs > 0}
						· {summary.subs} {t.resolutionSubClauses}
					{/if}
				</div>
				{#if summary.warnings.length > 0}
					<div class="mt-2">
						<div class="font-medium text-warning">
							<i class="fa-solid fa-triangle-exclamation mr-1"></i>
							{t.resolutionImportResolutionWarnings} ({summary.warnings.length})
						</div>
						<ul class="list-disc list-inside text-base-content/60">
							{#each summary.warnings as w (w.code + w.line)}
								<li>{w.code}: {w.message}</li>
							{/each}
						</ul>
					</div>
				{/if}
			</div>
		{:else if result && !result.valid}
			<div class="mt-4 bg-error/10 rounded-lg p-3 text-sm">
				<div class="font-medium text-error mb-1">
					<i class="fa-solid fa-circle-xmark mr-1"></i>
					{t.resolutionImportResolutionInvalid}
				</div>
				<ul class="list-disc list-inside text-base-content/70 font-mono text-xs">
					{#each result.errors as err (err.code + err.line + err.column)}
						<li>{err.line}:{err.column} {err.code} — {err.message}</li>
					{/each}
				</ul>
			</div>
		{/if}

		<div class="modal-action">
			<button type="button" class="btn" onclick={onClose}>{t.cancel}</button>
			<button
				type="button"
				class="btn btn-primary"
				onclick={handleImport}
				disabled={!result || !result.valid}
			>
				<i class="fa-solid fa-file-import"></i>
				{t.resolutionImportResolutionButton}
			</button>
		</div>
	</div>
	<form method="dialog" class="modal-backdrop bg-black/30">
		<button type="button" onclick={onClose}>close</button>
	</form>
</dialog>
