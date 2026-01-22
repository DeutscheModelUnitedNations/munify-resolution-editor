<script lang="ts">
	import type { Resolution, ResolutionHeaderData } from '../schema/resolution';
	import type { ResolutionEditorLabels } from '../i18n/types';
	import { englishLabels } from '../i18n/en';

	interface Props {
		resolution: Resolution;
		headerData?: ResolutionHeaderData;
		labels?: Partial<ResolutionEditorLabels>;
		/**
		 * Whether to show the divider at the top of the footer
		 */
		showDivider?: boolean;
	}

	let { resolution, headerData, labels = {}, showDivider = true }: Props = $props();

	// Merge labels with defaults
	const t = { ...englishLabels, ...labels };

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

{#if showDivider}
	<hr class="border-t border-gray-300 mt-8 mb-4" />
{/if}

<div class="text-sm text-gray-600">
	<div class="flex justify-between items-end">
		<div>
			{#if headerData?.authoringDelegation}
				<div class="mb-1">
					<span class="font-semibold">{t.resolutionAuthoringDelegation}:</span>
					{headerData.authoringDelegation}
				</div>
			{/if}
			<div>
				<span class="font-semibold">{t.resolutionCommittee}:</span>
				{headerData?.committeeFullName ?? resolution.committeeName}
			</div>
		</div>
		<div class="text-right text-xs text-gray-400">
			{formatDate(headerData?.lastEdited)}
		</div>
	</div>
</div>
