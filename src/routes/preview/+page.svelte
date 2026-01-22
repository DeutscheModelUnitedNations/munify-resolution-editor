<script lang="ts">
	import { ResolutionPreview, ResolutionDocumentHeader, ResolutionDocumentFooter } from '$lib/components';
	import { englishPreamblePhrases, englishOperativePhrases } from '$lib/phrases/en';
	import { createPhrasePatterns } from '$lib/services/phraseValidation';
	import type { Resolution, ResolutionHeaderData } from '$lib/schema/resolution';

	// Sample resolution for preview
	const resolution: Resolution = {
		committeeName: 'Security Council',
		preamble: [
			{
				id: 'p-prev-1',
				content: 'Recalling all its previous resolutions and presidential statements concerning the situation in the Middle East,'
			},
			{
				id: 'p-prev-2',
				content: 'Reaffirming its commitment to the sovereignty, territorial integrity and political independence of all States in the region,'
			},
			{
				id: 'p-prev-3',
				content: 'Expressing grave concern at the escalation of violence and the deteriorating humanitarian situation,'
			},
			{
				id: 'p-prev-4',
				content: 'Emphasizing the need for all parties to respect international humanitarian law and protect civilian populations,'
			}
		],
		operative: [
			{
				id: 'o-prev-1',
				blocks: [
					{
						type: 'text',
						id: 'b-prev-1',
						content: 'Demands an immediate cessation of hostilities by all parties to the conflict;'
					}
				]
			},
			{
				id: 'o-prev-2',
				blocks: [
					{
						type: 'text',
						id: 'b-prev-2',
						content: 'Calls upon all parties to ensure:'
					},
					{
						type: 'subclauses',
						id: 'b-prev-3',
						items: [
							{
								id: 's-prev-1',
								blocks: [
									{
										type: 'text',
										id: 'b-prev-4',
										content: 'the protection of civilians in accordance with international humanitarian law;'
									}
								]
							},
							{
								id: 's-prev-2',
								blocks: [
									{
										type: 'text',
										id: 'b-prev-5',
										content: 'unhindered humanitarian access to all affected populations;'
									}
								]
							},
							{
								id: 's-prev-3',
								blocks: [
									{
										type: 'text',
										id: 'b-prev-6',
										content: 'the release of all unlawfully detained persons:'
									},
									{
										type: 'subclauses',
										id: 'b-prev-7',
										items: [
											{
												id: 's-prev-4',
												blocks: [
													{
														type: 'text',
														id: 'b-prev-8',
														content: 'including journalists and humanitarian workers;'
													}
												]
											},
											{
												id: 's-prev-5',
												blocks: [
													{
														type: 'text',
														id: 'b-prev-9',
														content: 'with particular attention to vulnerable groups;'
													}
												]
											}
										]
									}
								]
							}
						]
					}
				]
			},
			{
				id: 'o-prev-3',
				blocks: [
					{
						type: 'text',
						id: 'b-prev-10',
						content: 'Requests the Secretary-General to report to the Council within thirty days on the implementation of this resolution;'
					}
				]
			},
			{
				id: 'o-prev-4',
				blocks: [
					{
						type: 'text',
						id: 'b-prev-11',
						content: 'Decides to remain actively seized of the matter.'
					}
				]
			}
		]
	};

	// Sample header metadata
	const headerData: ResolutionHeaderData = {
		conferenceName: 'Model United Nations',
		conferenceTitle: 'MUN Conference 2024',
		committeeAbbreviation: 'SC',
		committeeFullName: 'Security Council',
		committeeResolutionHeadline: 'The Security Council',
		documentNumber: 'S/RES/2024/001',
		topic: 'Situation in the Middle East',
		authoringDelegation: 'France'
	};

	// Create phrase patterns for preview highlighting
	const preamblePatterns = createPhrasePatterns(englishPreamblePhrases);
	const operativePatterns = createPhrasePatterns(englishOperativePhrases);

	// Show/hide header controls
	let showHeader = $state(true);
	let useDefaultHeader = $state(true);
	let customFooter = $state(false);
</script>

<div class="container mx-auto px-4 py-8 max-w-5xl">
	<div class="mb-6">
		<h1 class="text-3xl font-bold mb-2">
			<i class="fa-solid fa-eye text-primary"></i>
			Preview Demo
		</h1>
		<p class="text-base-content/70">
			Read-only preview with official UN document formatting, italicized phrases, and proper punctuation.
		</p>
	</div>

	<div class="flex flex-wrap gap-4 mb-6">
		<label class="label cursor-pointer gap-2">
			<input type="checkbox" class="toggle toggle-primary" bind:checked={showHeader} />
			<span class="label-text">Show Header Metadata</span>
		</label>
		<label class="label cursor-pointer gap-2">
			<input type="checkbox" class="toggle toggle-secondary" bind:checked={useDefaultHeader} />
			<span class="label-text">Use Default Header Component</span>
		</label>
		<label class="label cursor-pointer gap-2">
			<input type="checkbox" class="toggle toggle-accent" bind:checked={customFooter} />
			<span class="label-text">Custom Footer Snippet</span>
		</label>
	</div>

	<div class="bg-white text-black rounded-lg shadow-lg p-8 print:shadow-none">
		<ResolutionPreview
			{resolution}
			headerData={showHeader ? headerData : undefined}
			{preamblePatterns}
			{operativePatterns}
		>
			{#snippet previewHeader({ resolution: res, headerData: hd })}
				{#if showHeader && useDefaultHeader}
					<!-- Using the reusable ResolutionDocumentHeader component -->
					<ResolutionDocumentHeader headerData={headerData} resolution={res} />
					<!-- You can add custom content below the default header -->
					<div class="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-sm print:bg-white print:border-blue-400">
						<div class="flex items-center gap-2 text-blue-700">
							<i class="fa-solid fa-info-circle"></i>
							<span>This uses <code>ResolutionDocumentHeader</code> component + custom content</span>
						</div>
					</div>
				{:else if showHeader && !useDefaultHeader}
					<!-- Custom header without using the default component -->
					<div class="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-6 print:bg-white print:border-purple-400">
						<div class="flex items-center gap-2 text-purple-700">
							<i class="fa-solid fa-star"></i>
							<span class="font-semibold">Custom Header Extension Point</span>
						</div>
						<p class="text-sm text-purple-600 mt-2">
							This demonstrates the <code>previewHeader</code> snippet slot without using the default header component. You can build your own header from scratch here.
						</p>
						{#if hd}
							<div class="flex gap-4 mt-3 text-xs text-purple-500">
								<span><strong>Document:</strong> {hd.documentNumber}</span>
								<span><strong>Committee:</strong> {hd.committeeAbbreviation}</span>
								<span><strong>Topic:</strong> {hd.topic}</span>
							</div>
						{/if}
					</div>
				{/if}
			{/snippet}

			{#snippet previewFooter({ resolution: res })}
				{#if customFooter}
					<!-- Using the reusable ResolutionDocumentFooter component -->
					<ResolutionDocumentFooter resolution={res} headerData={headerData} />
					<!-- Additional custom footer content -->
					<div class="mt-4 bg-gray-50 border border-gray-200 rounded-lg p-4">
						<div class="flex items-center gap-2 text-gray-700">
							<i class="fa-solid fa-signature"></i>
							<span class="font-semibold">Custom Footer Extension</span>
						</div>
						<div class="flex gap-8 mt-4 text-sm text-gray-500">
							<div>
								<div class="font-semibold text-gray-700">Status:</div>
								<span class="badge badge-success badge-sm">Adopted</span>
							</div>
							<div>
								<div class="font-semibold text-gray-700">Votes:</div>
								<span>12-2-1</span>
							</div>
						</div>
					</div>
				{/if}
			{/snippet}
		</ResolutionPreview>
	</div>

	<div class="mt-8 grid md:grid-cols-2 gap-6">
		<div class="card bg-base-200">
			<div class="card-body">
				<h2 class="card-title">
					<i class="fa-solid fa-palette"></i>
					Formatting Features
				</h2>
				<ul class="space-y-2 text-sm text-base-content/70">
					<li><i class="fa-solid fa-check text-success mr-2"></i>Italic opening phrases</li>
					<li><i class="fa-solid fa-check text-success mr-2"></i>Proper clause numbering (Roman, letters)</li>
					<li><i class="fa-solid fa-check text-success mr-2"></i>Nested subclauses up to 4 levels</li>
					<li><i class="fa-solid fa-check text-success mr-2"></i>UN document header format</li>
					<li><i class="fa-solid fa-check text-success mr-2"></i>Conference emblem support</li>
					<li><i class="fa-solid fa-check text-success mr-2"></i>Print-optimized styling</li>
				</ul>
			</div>
		</div>

		<div class="card bg-base-200">
			<div class="card-body">
				<h2 class="card-title">
					<i class="fa-solid fa-plug"></i>
					Extension Points
				</h2>
				<p class="text-sm text-base-content/70 mb-3">
					Use Svelte 5 snippets to customize the preview:
				</p>
				<div class="overflow-x-auto">
					<table class="table table-sm">
						<thead>
							<tr>
								<th>Snippet</th>
								<th>Location</th>
							</tr>
						</thead>
						<tbody>
							<tr>
								<td><code>previewHeader</code></td>
								<td>Top of preview</td>
							</tr>
							<tr>
								<td><code>previewFooter</code></td>
								<td>Bottom of preview</td>
							</tr>
						</tbody>
					</table>
				</div>
			</div>
		</div>
	</div>

	<div class="card bg-base-200 mt-6">
		<div class="card-body">
			<h2 class="card-title">
				<i class="fa-solid fa-code"></i>
				Usage Example
			</h2>
			<p class="text-sm text-base-content/70 mb-3">
				Use the reusable header/footer components in your snippets:
			</p>
			<div class="mockup-code text-sm overflow-x-auto">
				<pre><code>{`import {
  ResolutionPreview,
  ResolutionDocumentHeader,
  ResolutionDocumentFooter
} from '@deutschemodelunitednations/munify-resolution-editor';

<ResolutionPreview
  {resolution}
  {preamblePatterns}
  {operativePatterns}
>
  {#snippet previewHeader({ resolution, headerData })}
    <!-- Use the default header component -->
    <ResolutionDocumentHeader {headerData} {resolution} />
    <!-- Add custom content below -->
    <div class="custom-banner">Draft Resolution</div>
  {/snippet}

  {#snippet previewFooter({ resolution })}
    <ResolutionDocumentFooter {resolution} {headerData} />
  {/snippet}
</ResolutionPreview>`}</code></pre>
			</div>
		</div>
	</div>
</div>
