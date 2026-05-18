<script lang="ts">
	import { parseClauseFragment } from '../res-markup/parse';
	import {
		buildRenderClause,
		buildDiffRenderClause,
		type RenderClause,
		type RenderBlock,
		type RenderText,
		type RenderItem
	} from '../services/paragraphDiff';
	import { getSubClauseLabel } from '../schema/resolution';
	import {
		type PhrasePattern,
		validatePhrase,
		createPhrasePatterns
	} from '../services/phraseValidation';
	import type { ResolutionEditorLabels } from '../i18n/types';
	import { englishLabels } from '../i18n/en';

	interface Props {
		/** RES-Markup fragment of a single operative clause (the current version). */
		markup: string;
		/** RES-Markup fragment of the previous version, for diffing. */
		oldMarkup?: string;
		/** Whether the diff against `oldMarkup` is shown. Bindable so the built-in toggle works. */
		showDiff?: boolean;
		/** Render a built-in toggle button to switch the diff on/off. */
		showDiffToggle?: boolean;
		/** Leading number shown before the paragraph (its index in the resolution). */
		operativeNumber?: number;
		operativePatterns?: PhrasePattern[];
		operativePhrases?: string[];
		labels?: Partial<ResolutionEditorLabels>;
	}

	let {
		markup,
		oldMarkup,
		showDiff = $bindable(false),
		showDiffToggle = false,
		operativeNumber = 1,
		operativePatterns: operativePatternsInput,
		operativePhrases = [],
		labels = {}
	}: Props = $props();

	const t = { ...englishLabels, ...labels };

	let operativePatterns = $derived(
		operativePatternsInput ?? createPhrasePatterns(operativePhrases)
	);

	let parsed = $derived(parseClauseFragment(markup ?? ''));
	let parsedOld = $derived(
		oldMarkup && oldMarkup.trim() ? parseClauseFragment(oldMarkup) : undefined
	);

	let diffActive = $derived(showDiff && parsed.valid && !!parsedOld && parsedOld.valid);

	let tree = $derived.by((): RenderClause | null => {
		if (!parsed.valid) return null;
		if (diffActive && parsedOld && parsedOld.valid) {
			return buildDiffRenderClause(parsedOld.clause, parsed.clause);
		}
		return buildRenderClause(parsed.clause);
	});

	let isEmpty = $derived(!!tree && tree.blocks.length === 0);

	function formatFirst(content: string): { firstPhrase: string; rest: string } {
		const trimmed = content.trim();
		if (!trimmed) return { firstPhrase: '', rest: '' };
		const result = validatePhrase(trimmed, operativePatterns);
		if (result.valid && result.matchedPhrase) {
			return {
				firstPhrase: result.matchedPhrase,
				rest: trimmed.slice(result.matchedPhrase.length)
			};
		}
		const i = trimmed.indexOf(' ');
		if (i === -1) return { firstPhrase: trimmed, rest: '' };
		return { firstPhrase: trimmed.slice(0, i), rest: trimmed.slice(i) };
	}

	function plainText(rt: RenderText): string {
		return rt.words.map((w) => w.value).join('');
	}
</script>

<div class="operative-paragraph-preview w-full bg-white text-gray-900 text-[0.95rem] leading-[1.7]">
	{#if showDiffToggle && parsed.valid && parsedOld && parsedOld.valid}
		<div class="mb-3 font-sans not-italic">
			<button
				type="button"
				class="btn btn-xs"
				class:btn-primary={showDiff}
				class:btn-outline={!showDiff}
				onclick={() => (showDiff = !showDiff)}
			>
				<i class="fa-solid fa-code-compare"></i>
				{showDiff ? t.operativeParagraphHideDiff : t.operativeParagraphShowDiff}
			</button>
		</div>
	{/if}

	{#if !parsed.valid}
		<div class="rounded border border-error/40 bg-error/10 px-3 py-2 text-sm font-sans text-error">
			<div class="font-semibold">{t.operativeParagraphInvalidMarkup}</div>
			<ul class="mt-1 list-disc list-inside">
				{#each parsed.errors as e (e.code + e.line + e.column)}
					<li>{e.message} ({e.line}:{e.column})</li>
				{/each}
			</ul>
		</div>
	{:else if isEmpty}
		<div class="text-center text-base-content/50 py-6 font-sans">
			<i class="fa-solid fa-paragraph text-2xl mb-2"></i>
			<p>{t.operativeParagraphEmpty}</p>
		</div>
	{:else if tree}
		<ol class="list-none p-0">
			<li class="mb-2 text-justify indent-8">
				<span class="font-bold">{operativeNumber}.</span>
				{@render clauseBlocks(tree.blocks, true)}
			</li>
		</ol>
	{/if}
</div>

{#snippet wordRun(rt: RenderText)}
	{#each rt.words as w, i (i)}
		{#if w.status === 'added'}
			<span class="bg-success/15 text-success rounded-sm">{w.value}</span>
		{:else if w.status === 'removed'}
			<span class="bg-error/10 text-error line-through decoration-error">{w.value}</span>
		{:else}<span>{w.value}</span>{/if}
	{/each}
{/snippet}

{#snippet inlineText(rt: RenderText, isFirstOfClause: boolean)}
	{#if !diffActive && isFirstOfClause && rt.blockStatus === 'same'}
		{@const f = formatFirst(plainText(rt))}<span class="italic">{f.firstPhrase}</span
		>{f.rest}{rt.punctuation}{:else if rt.blockStatus === 'added'}<span
			class="bg-success/15 text-success rounded-sm">{plainText(rt)}{rt.punctuation}</span
		>{:else if rt.blockStatus === 'removed'}<span
			class="bg-error/10 text-error line-through decoration-error"
			>{plainText(rt)}{rt.punctuation}</span
		>{:else}{@render wordRun(rt)}{rt.punctuation}{/if}
{/snippet}

{#snippet clauseBlocks(blocks: RenderBlock[], topLevel: boolean)}
	{#each blocks as block, bi (bi)}
		{#if block.type === 'text'}
			{#if bi === 0 && topLevel}
				{@render inlineText(block, true)}
			{:else}
				<p
					class="mt-2 mb-1 text-justify indent-8"
					class:text-error={block.blockStatus === 'removed'}
				>
					{@render inlineText(block, false)}
				</p>
			{/if}
		{:else}
			{@render subList(block.items, 1)}
		{/if}
	{/each}
{/snippet}

{#snippet subList(items: RenderItem[], depth: number)}
	<ol class="list-none p-0 mt-2">
		{#each items as item, index (index)}
			<li
				class="mb-1 text-justify {depth === 1 ? 'indent-8' : 'pl-8 indent-0'}"
				class:line-through={item.status === 'removed'}
				class:text-error={item.status === 'removed'}
				class:text-success={item.status === 'added'}
			>
				<span>{getSubClauseLabel(index, depth)}</span>
				{@render subItemBlocks(item, depth)}
			</li>
		{/each}
	</ol>
{/snippet}

{#snippet subItemBlocks(item: RenderItem, depth: number)}
	{#each item.blocks as block, bi (bi)}
		{#if block.type === 'text'}
			{#if bi === 0}
				{#if item.status === 'same'}
					{@render wordRun(block)}{block.punctuation}
				{:else}
					{plainText(block)}{block.punctuation}
				{/if}
			{:else}
				<p class="mt-2 mb-1 text-justify {depth === 1 ? 'indent-8' : 'indent-0'}">
					{#if item.status === 'same'}{@render wordRun(block)}{block.punctuation}{:else}{plainText(
							block
						)}{block.punctuation}{/if}
				</p>
			{/if}
		{:else if depth < 4}
			{@render subList(block.items, depth + 1)}
		{/if}
	{/each}
{/snippet}

<style>
	.operative-paragraph-preview {
		font-family: 'Times New Roman', Times, serif;
	}
</style>
