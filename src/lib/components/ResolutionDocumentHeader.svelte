<script lang="ts">
	import type { Resolution, ResolutionHeaderData } from '../schema/resolution';
	import type { ResolutionEditorLabels } from '../i18n/types';
	import { englishLabels } from '../i18n/en';
	import { getUnEmblemDataUrl } from '../assets/un-emblem';

	interface Props {
		headerData: ResolutionHeaderData;
		resolution: Resolution;
		labels?: Partial<ResolutionEditorLabels>;
	}

	let { headerData, resolution, labels = {} }: Props = $props();

	// Merge labels with defaults
	const t = { ...englishLabels, ...labels };

	// Get disclaimer text with conference name
	function getDisclaimerText(): string {
		return t.resolutionDisclaimer.replace(
			'{conferenceName}',
			headerData.conferenceName ?? 'Model UN'
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

<!-- Small Print Disclaimer -->
<div class="text-gray-500 text-[0.65rem] leading-snug mt-6 mb-2">
	{getDisclaimerText()}
</div>

<!-- Thick Divider -->
<hr class="border-t-[3px] border-gray-900 mt-6 mb-8" />
