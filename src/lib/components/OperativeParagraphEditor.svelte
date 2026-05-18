<script lang="ts">
	import OperativeParagraphPreview from './OperativeParagraphPreview.svelte';
	import { parseClauseFragment } from '../res-markup/parse';
	import { type PhrasePattern } from '../services/phraseValidation';
	import type { ResolutionEditorLabels } from '../i18n/types';
	import { englishLabels } from '../i18n/en';

	interface Props {
		/** RES-Markup fragment of the operative clause being edited. Bindable. */
		markup: string;
		/** RES-Markup fragment of the previous version (diff base). Bindable. */
		oldMarkup?: string;
		/** Whether the diff is shown. Bindable. */
		showDiff?: boolean;
		/** Allow editing the previous-version markup (diff base) in a second field. */
		editableOldMarkup?: boolean;
		operativeNumber?: number;
		operativePatterns?: PhrasePattern[];
		operativePhrases?: string[];
		labels?: Partial<ResolutionEditorLabels>;
	}

	let {
		markup = $bindable(''),
		oldMarkup = $bindable(''),
		showDiff = $bindable(false),
		editableOldMarkup = true,
		operativeNumber = 1,
		operativePatterns,
		operativePhrases = [],
		labels = {}
	}: Props = $props();

	const t = { ...englishLabels, ...labels };

	let parsed = $derived(parseClauseFragment(markup ?? ''));
	let errors = $derived(parsed.valid ? [] : parsed.errors);
	let warnings = $derived(parsed.valid ? parsed.warnings : []);
</script>

<div class="grid gap-6 lg:grid-cols-2">
	<div class="flex flex-col gap-3">
		<div class="flex items-center justify-between">
			<span class="font-semibold text-sm">{t.operativeParagraph}</span>
			<label class="label cursor-pointer gap-2 py-0">
				<input type="checkbox" class="toggle toggle-primary toggle-sm" bind:checked={showDiff} />
				<span class="label-text text-sm">{t.operativeParagraphShowDiff}</span>
			</label>
		</div>

		{#if showDiff && editableOldMarkup}
			<div class="flex flex-col gap-1">
				<span class="text-xs font-semibold uppercase text-base-content/60"
					>{t.operativeParagraphOldVersion}</span
				>
				<textarea
					class="textarea textarea-bordered font-mono text-sm min-h-28"
					bind:value={oldMarkup}
					placeholder={t.resolutionOperativePlaceholder}
				></textarea>
			</div>
		{/if}

		<div class="flex flex-col gap-1">
			{#if showDiff}
				<span class="text-xs font-semibold uppercase text-base-content/60"
					>{t.operativeParagraphNewVersion}</span
				>
			{/if}
			<textarea
				class="textarea textarea-bordered font-mono text-sm min-h-40"
				class:textarea-error={!parsed.valid}
				bind:value={markup}
				placeholder={t.resolutionOperativePlaceholder}
			></textarea>
		</div>

		{#if errors.length > 0}
			<div class="rounded border border-error/40 bg-error/10 px-3 py-2 text-sm text-error">
				<div class="font-semibold">{t.operativeParagraphInvalidMarkup}</div>
				<ul class="mt-1 list-disc list-inside">
					{#each errors as e (e.code + e.line + e.column)}
						<li>{e.message} ({e.line}:{e.column})</li>
					{/each}
				</ul>
			</div>
		{:else if warnings.length > 0}
			<div class="rounded border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
				<div class="font-semibold">{t.resolutionImportResolutionWarnings}</div>
				<ul class="mt-1 list-disc list-inside">
					{#each warnings as w (w.code + w.line + w.column)}
						<li>{w.message} ({w.line}:{w.column})</li>
					{/each}
				</ul>
			</div>
		{/if}
	</div>

	<div class="flex flex-col gap-2">
		<span class="font-semibold text-sm">{t.resolutionPreview}</span>
		<div class="rounded-lg border border-base-300 bg-white p-6 shadow-sm">
			<OperativeParagraphPreview
				{markup}
				{oldMarkup}
				bind:showDiff
				{operativeNumber}
				{operativePatterns}
				{operativePhrases}
				{labels}
			/>
		</div>
	</div>
</div>
