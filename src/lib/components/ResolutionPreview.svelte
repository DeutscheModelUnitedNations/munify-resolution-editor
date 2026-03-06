<script lang="ts">
	import type { Snippet } from 'svelte';
	import type {
		Resolution,
		PreambleClause,
		SubClause,
		OperativeClause,
		ResolutionHeaderData,
		AmendmentOverlay
	} from '../schema/resolution';
	import { getSubClauseLabel, isClauseEmpty, migrateResolution } from '../schema/resolution';
	import {
		type PhrasePattern,
		validatePhrase,
		createPhrasePatterns
	} from '../services/phraseValidation';
	import type { ResolutionEditorLabels } from '../i18n/types';
	import { englishLabels } from '../i18n/en';
	import { getUnEmblemDataUrl } from '../assets/un-emblem';

	interface Props {
		resolution: Resolution;
		headerData?: ResolutionHeaderData;
		preamblePatterns?: PhrasePattern[];
		operativePatterns?: PhrasePattern[];
		preamblePhrases?: string[];
		operativePhrases?: string[];
		labels?: Partial<ResolutionEditorLabels>;
		// Amendment overlays
		amendments?: AmendmentOverlay[];
		rejectedClauseIds?: string[];
		onAmendmentClick?: (amendmentId: string) => void;
		// Extension points
		afterPreambleClause?: Snippet<[{ clause: PreambleClause; index: number }]>;
		afterOperativeClause?: Snippet<[{ clause: OperativeClause; index: number }]>;
		betweenOperativeClauses?: Snippet<[{ index: number }]>;
		previewHeader?: Snippet<[{ resolution: Resolution; headerData?: ResolutionHeaderData }]>;
		previewFooter?: Snippet<[{ resolution: Resolution }]>;
	}

	let {
		resolution: rawResolution,
		headerData,
		preamblePatterns: preamblePatternsInput,
		operativePatterns: operativePatternsInput,
		preamblePhrases = [],
		operativePhrases = [],
		labels = {},
		amendments = [],
		rejectedClauseIds = [],
		onAmendmentClick,
		afterPreambleClause,
		afterOperativeClause,
		betweenOperativeClauses,
		previewHeader,
		previewFooter
	}: Props = $props();

	// Merge labels with defaults
	const t = { ...englishLabels, ...labels };

	// Migrate legacy format if needed
	let resolution = $derived(migrateResolution(rawResolution) as Resolution);

	// Filter out empty clauses for preview
	let nonEmptyPreamble = $derived(resolution.preamble.filter((c) => c.content.trim()));
	let nonEmptyOperative = $derived(resolution.operative.filter((c) => !isClauseEmpty(c)));

	// Amendment lookup maps
	let amendmentsByClauseId = $derived(
		amendments.reduce((map, a) => {
			if (a.targetClauseId && a.type !== 'ADD') {
				const existing = map.get(a.targetClauseId) ?? [];
				existing.push(a);
				map.set(a.targetClauseId, existing);
			}
			return map;
		}, new Map<string, AmendmentOverlay[]>())
	);

	let addAmendmentsByPosition = $derived(
		amendments.reduce((map, a) => {
			if (a.type === 'ADD' && a.targetPosition !== undefined) {
				const existing = map.get(a.targetPosition) ?? [];
				existing.push(a);
				map.set(a.targetPosition, existing);
			}
			return map;
		}, new Map<number, AmendmentOverlay[]>())
	);

	let rejectedClauseIdSet = $derived(new Set(rejectedClauseIds));

	// Use provided patterns or create from phrase arrays
	let preamblePatterns = $derived(preamblePatternsInput ?? createPhrasePatterns(preamblePhrases));
	let operativePatterns = $derived(
		operativePatternsInput ?? createPhrasePatterns(operativePhrases)
	);

	// Format clause content using phrase validation for italicization
	function formatClauseContent(
		content: string,
		patterns: PhrasePattern[]
	): { firstPhrase: string; rest: string } {
		const trimmed = content.trim();
		if (!trimmed) return { firstPhrase: '', rest: '' };

		// Try to match against phrase patterns
		const result = validatePhrase(trimmed, patterns);
		if (result.valid && result.matchedPhrase) {
			return {
				firstPhrase: result.matchedPhrase,
				rest: trimmed.slice(result.matchedPhrase.length)
			};
		}

		// Fall back to first word if no pattern matched
		const firstSpaceIndex = trimmed.indexOf(' ');
		if (firstSpaceIndex === -1) {
			return { firstPhrase: trimmed, rest: '' };
		}
		return {
			firstPhrase: trimmed.slice(0, firstSpaceIndex),
			rest: trimmed.slice(firstSpaceIndex)
		};
	}

	// Get disclaimer text with conference name
	function getDisclaimerText(): string {
		return t.resolutionDisclaimer.replace(
			'{conferenceName}',
			headerData?.conferenceName ?? 'Model UN'
		);
	}

	// Format date for display (localized)
	function formatDate(date: Date | string | undefined): string {
		const d = date ? new Date(date) : new Date();
		return d.toLocaleDateString(undefined, {
			day: 'numeric',
			month: 'long',
			year: 'numeric'
		});
	}
</script>

<div
	class="resolution-preview w-full max-w-[900px] mx-auto px-16 py-8 bg-white text-gray-900 text-[0.95rem] leading-[1.7]"
>
	{#if previewHeader}
		<div class="font-sans">{@render previewHeader({ resolution, headerData })}</div>
	{:else if headerData}
		<!-- Header Row: Conference Title left, Document Number right -->
		<div class="flex justify-between items-baseline mb-2">
			<div class="text-sm">
				{headerData.conferenceTitle ?? headerData.conferenceName ?? 'Model United Nations'}
			</div>
			{#if headerData.documentNumber}
				<div class="text-right">
					<span class="text-2xl font-bold">{headerData.committeeAbbreviation}</span><span
						class="text-sm">/{headerData.documentNumber}</span
					>
				</div>
			{/if}
		</div>

		<!-- Thin Divider -->
		<hr class="border-t border-gray-900 my-2 mb-4" />

		<!-- Committee Section with Emblem -->
		<div class="flex justify-between">
			<div class="flex items-start gap-4 mb-6">
				<img
					src={headerData.conferenceEmblem ?? getUnEmblemDataUrl()}
					alt="Conference Emblem"
					class="w-[70px] h-[70px] shrink-0"
				/>
				<div class="text-3xl font-bold leading-tight pt-1">
					{headerData.committeeFullName ?? resolution.committeeName}
				</div>
			</div>

			<!-- Date below divider -->
			<div class="text-right text-sm mb-4">
				{formatDate(headerData.lastEdited)}
			</div>
		</div>

		<!-- Authoring Delegation -->
		{#if headerData.authoringDelegation}
			<div class="mb-4">
				<div class="font-bold uppercase text-sm">{t.resolutionAuthoringDelegation}</div>
				<div class="ml-6">{headerData.authoringDelegation}</div>
			</div>
		{/if}

		<!-- Sponsoring Delegations -->
		{#if headerData.sponsoringDelegations?.length}
			<div class="mb-4">
				<div class="font-bold uppercase text-sm">{t.resolutionSponsoringDelegations}</div>
				<div class="ml-6">{headerData.sponsoringDelegations.join(', ')}</div>
			</div>
		{/if}

		<!-- Small Print Disclaimer -->
		<div class="text-gray-500 text-[0.65rem] leading-snug mt-6 mb-2">
			{getDisclaimerText()}
		</div>

		<!-- Thick Divider -->
		<hr class="border-t-[3px] border-gray-900 mt-6 mb-8" />
	{/if}

	<!-- Topic below thick divider -->
	{#if headerData?.topic}
		<div class="font-bold mb-6">
			{headerData.topic}
		</div>
	{/if}

	<!-- Resolution Content Header -->
	<div class="italic mb-6">
		{#if headerData?.committeeResolutionHeadline}
			{headerData.committeeResolutionHeadline},
		{:else if headerData?.committeeFullName}
			{headerData.committeeFullName},
		{:else}
			{resolution.committeeName.toUpperCase()},
		{/if}
	</div>

	<!-- Preamble Section -->
	{#if nonEmptyPreamble.length > 0}
		<div class="mb-6">
			{#each nonEmptyPreamble as clause, index (clause.id)}
				{@const formatted = formatClauseContent(clause.content, preamblePatterns)}
				<p class="mb-3 text-justify indent-8">
					<span class="italic">{formatted.firstPhrase}</span>{formatted.rest},
				</p>
				{#if afterPreambleClause}
					<div class="font-sans">{@render afterPreambleClause({ clause, index })}</div>
				{/if}
			{/each}
		</div>
	{/if}

	<!-- Operative Section -->
	{#if nonEmptyOperative.length > 0}
		<ol class="list-none p-0">
			{#each nonEmptyOperative as clause, opIndex (clause.id)}
				{@const isLastOperative = opIndex === nonEmptyOperative.length - 1}
				{@const isRejected = rejectedClauseIdSet.has(clause.id)}
				{@const clauseAmendments = amendmentsByClauseId.get(clause.id) ?? []}
				{@const hasDeleteAmendment = clauseAmendments.some((a) => a.type === 'DELETE')}
				{@const alterTextAmendments = clauseAmendments.filter((a) => a.type === 'ALTER_TEXT')}
				<!-- ADD amendments inserted before this clause (position = opIndex - 1 means "after previous") -->
				{@const addAmendmentsBefore = opIndex === 0 ? (addAmendmentsByPosition.get(-1) ?? []) : []}
				{#each addAmendmentsBefore as addAmendment (addAmendment.id)}
					{@render addAmendmentMarker(addAmendment)}
				{/each}
				<li
					class="mb-2 text-justify indent-8"
					class:line-through={isRejected}
					class:opacity-40={isRejected}
				>
					{#if clauseAmendments.length > 0}
						<!-- Amendment type indicators -->
						<span class="inline-flex gap-1 mr-1 text-xs align-middle font-sans">
							{#each clauseAmendments as amendment (amendment.id)}
								<!-- svelte-ignore a11y_click_events_have_key_events -->
								<!-- svelte-ignore a11y_no_static_element_interactions -->
								<span
									class="inline-flex items-center px-1.5 py-0.5 rounded text-white text-[0.65rem] leading-none cursor-pointer"
									class:bg-error={amendment.type === 'DELETE'}
									class:bg-warning={amendment.type === 'ALTER_TEXT'}
									class:bg-info={amendment.type === 'ALTER_POSITION'}
									onclick={() => onAmendmentClick?.(amendment.id)}
								>
									{#if amendment.type === 'DELETE'}
										{t.amendmentDelete}
									{:else if amendment.type === 'ALTER_TEXT'}
										{t.amendmentAlterText}
									{:else if amendment.type === 'ALTER_POSITION'}
										{t.amendmentAlterPosition}
									{/if}
								</span>
							{/each}
						</span>
					{/if}
					<span class="font-bold">{opIndex + 1}.</span>
					{#if hasDeleteAmendment}
						<span class="bg-error/10 line-through decoration-error">
							{@render operativeClauseBlocks(clause, opIndex, isLastOperative)}
						</span>
					{:else}
						{@render operativeClauseBlocks(clause, opIndex, isLastOperative)}
					{/if}
				</li>
				<!-- ALTER_TEXT proposed replacements -->
				{#each alterTextAmendments as altAmendment (altAmendment.id)}
					{#if altAmendment.newContent}
						<!-- svelte-ignore a11y_click_events_have_key_events -->
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div
							class="ml-8 mb-2 pl-3 border-l-4 border-success bg-success/10 rounded-r cursor-pointer"
							onclick={() => onAmendmentClick?.(altAmendment.id)}
						>
							<div class="text-xs text-success font-semibold mb-1 font-sans">
								{t.amendmentAlterText}
								{#if altAmendment.proposerName}
									— {altAmendment.proposerName}
								{/if}
							</div>
							<div class="text-justify">
								{@render operativeClauseBlocks(altAmendment.newContent, opIndex, isLastOperative)}
							</div>
						</div>
					{/if}
				{/each}
				{#if afterOperativeClause}
					<div class="font-sans">{@render afterOperativeClause({ clause, index: opIndex })}</div>
				{/if}
				{#if betweenOperativeClauses}
					<div class="font-sans">{@render betweenOperativeClauses({ index: opIndex })}</div>
				{/if}
				<!-- ADD amendments after this clause -->
				{@const addAmendmentsAfter = addAmendmentsByPosition.get(opIndex) ?? []}
				{#each addAmendmentsAfter as addAmendment (addAmendment.id)}
					{@render addAmendmentMarker(addAmendment)}
				{/each}
			{/each}
		</ol>
	{/if}

	{#snippet addAmendmentMarker(amendment: AmendmentOverlay)}
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="ml-8 mb-2 pl-3 border-l-4 border-success bg-success/5 rounded-r py-1 cursor-pointer"
			onclick={() => onAmendmentClick?.(amendment.id)}
		>
			<span class="text-xs text-success font-semibold font-sans">
				+ {t.amendmentAdd}
				{#if amendment.proposerName}
					— {amendment.proposerName}
				{/if}
			</span>
			{#if amendment.newContent}
				<div class="text-justify mt-1 text-success/80">
					{@render operativeClauseBlocks(amendment.newContent, 0, false)}
				</div>
			{/if}
		</div>
	{/snippet}

	<!-- Render blocks of an operative clause -->
	{#snippet operativeClauseBlocks(
		clause: OperativeClause,
		_opIndex: number,
		isLastOperative: boolean
	)}
		{#each clause.blocks as block, blockIndex (block.id)}
			{@const isLastBlock = blockIndex === clause.blocks.length - 1}
			{#if block.type === 'text'}
				{@const formatted = formatClauseContent(block.content, operativePatterns)}
				{#if block.content.trim()}
					{#if blockIndex === 0}
						<!-- First text block gets italicized phrase (inline) -->
						<span class="italic">{formatted.firstPhrase}</span
						>{formatted.rest}{#if isLastBlock && isLastOperative}.{:else};{/if}
					{:else}
						<!-- Continuation text blocks (after subclauses) -->
						<p class="mt-2 mb-1 text-justify indent-8">
							{block.content.trim()}{#if isLastBlock && isLastOperative}.{:else};{/if}
						</p>
					{/if}
				{/if}
			{:else if block.type === 'subclauses'}
				{@const nonEmptyItems = block.items.filter((s) => !isClauseEmpty(s))}
				{#if nonEmptyItems.length > 0}
					{@render subClauseList(nonEmptyItems, 1, isLastOperative && isLastBlock)}
				{/if}
			{/if}
		{/each}
	{/snippet}

	<!-- Render a list of subclauses at a given depth -->
	{#snippet subClauseList(subClauses: SubClause[], depth: number, isLastInParent: boolean)}
		<ol class="list-none p-0 mt-2">
			{#each subClauses as subClause, index (subClause.id)}
				{@const isLastSubClause = index === subClauses.length - 1}
				<!-- Depth 1: first-line indent only; Depth 2+: all lines indented equally (no first-line indent) -->
				<li class="mb-1 text-justify {depth === 1 ? 'indent-8' : 'pl-8 indent-0'}">
					<span>{getSubClauseLabel(index, depth)}</span>
					{@render subClauseBlocks(subClause, depth, isLastInParent && isLastSubClause)}
				</li>
			{/each}
		</ol>
	{/snippet}

	<!-- Render blocks within a subclause -->
	{#snippet subClauseBlocks(subClause: SubClause, depth: number, isLastInParent: boolean)}
		{#each subClause.blocks as block, blockIndex (block.id)}
			{@const isLastBlock = blockIndex === subClause.blocks.length - 1}
			{#if block.type === 'text'}
				{#if block.content.trim()}
					{#if blockIndex === 0}
						<!-- First text block content (inline) -->
						{block.content.trim()}{#if isLastBlock && isLastInParent}.{:else};{/if}
					{:else}
						<!-- Continuation text after nested subclauses (parent li already has base indent) -->
						<p class="mt-2 mb-1 text-justify {depth === 1 ? 'indent-8' : 'indent-0'}">
							{block.content.trim()}{#if isLastBlock && isLastInParent}.{:else};{/if}
						</p>
					{/if}
				{/if}
			{:else if block.type === 'subclauses'}
				{@const nonEmptyItems = block.items.filter((s) => !isClauseEmpty(s))}
				{#if nonEmptyItems.length > 0 && depth < 4}
					{@render subClauseList(nonEmptyItems, depth + 1, isLastInParent && isLastBlock)}
				{/if}
			{/if}
		{/each}
	{/snippet}

	<!-- Empty state -->
	{#if nonEmptyPreamble.length === 0 && nonEmptyOperative.length === 0}
		<div class="text-center text-base-content/50 py-8 font-sans">
			<i class="fa-solid fa-file-lines text-4xl mb-2"></i>
			<p>{t.resolutionNoClausesYet}</p>
		</div>
	{/if}

	{#if previewFooter}
		<div class="font-sans">{@render previewFooter({ resolution })}</div>
	{/if}
</div>

<style>
	/* Font family for official document styling */
	.resolution-preview {
		font-family: 'Times New Roman', Times, serif;
	}
</style>
