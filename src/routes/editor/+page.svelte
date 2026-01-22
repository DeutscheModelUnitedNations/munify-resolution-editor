<script lang="ts">
	import { ResolutionEditor } from '$lib/components';
	import { englishPreamblePhrases, englishOperativePhrases } from '$lib/phrases/en';
	import type { Resolution, ResolutionHeaderData } from '$lib/schema/resolution';

	// Sample resolution for demo
	let resolution: Resolution = $state({
		committeeName: 'General Assembly',
		preamble: [
			{
				id: 'p-demo-1',
				content: 'Recalling its resolution 70/1 of 25 September 2015, entitled "Transforming our world: the 2030 Agenda for Sustainable Development",'
			},
			{
				id: 'p-demo-2',
				content: 'Recognizing the importance of international cooperation in addressing global challenges,'
			},
			{
				id: 'p-demo-3',
				content: 'Deeply concerned by the ongoing climate crisis and its effects on vulnerable populations,'
			}
		],
		operative: [
			{
				id: 'o-demo-1',
				blocks: [
					{
						type: 'text',
						id: 'b-demo-1',
						content: 'Calls upon all Member States to strengthen their commitment to the Paris Agreement;'
					}
				]
			},
			{
				id: 'o-demo-2',
				blocks: [
					{
						type: 'text',
						id: 'b-demo-2',
						content: 'Urges developed countries to provide financial and technical support to developing nations:'
					},
					{
						type: 'subclauses',
						id: 'b-demo-3',
						items: [
							{
								id: 's-demo-1',
								blocks: [
									{
										type: 'text',
										id: 'b-demo-4',
										content: 'through bilateral and multilateral cooperation mechanisms;'
									}
								]
							},
							{
								id: 's-demo-2',
								blocks: [
									{
										type: 'text',
										id: 'b-demo-5',
										content: 'by establishing capacity-building programmes;'
									}
								]
							}
						]
					}
				]
			},
			{
				id: 'o-demo-3',
				blocks: [
					{
						type: 'text',
						id: 'b-demo-6',
						content: 'Decides to remain actively seized of the matter.'
					}
				]
			}
		]
	});

	// Sample header metadata for preview
	const headerData: ResolutionHeaderData = {
		conferenceName: 'Model United Nations',
		conferenceTitle: 'MUN Conference 2024',
		committeeAbbreviation: 'GA',
		committeeFullName: 'General Assembly',
		committeeResolutionHeadline: 'The General Assembly',
		documentNumber: 'A/RES/2024/001',
		topic: 'Climate Action and Sustainable Development',
		authoringDelegation: 'United States of America'
	};

	let lastChange: Resolution | null = $state(null);

	function handleChange(updated: Resolution) {
		lastChange = updated;
		resolution = updated;
	}

	function handleCopySuccess(phrase: string) {
		console.log('Copied phrase:', phrase);
	}

	function handleCopyError(error: Error) {
		console.error('Copy failed:', error);
	}
</script>

<div class="container mx-auto px-4 py-8 max-w-6xl">
	<div class="mb-6">
		<h1 class="text-3xl font-bold mb-2">
			<i class="fa-solid fa-edit text-primary"></i>
			Interactive Editor Demo
		</h1>
		<p class="text-base-content/70">
			Full-featured resolution editor with phrase validation, autocomplete, and nested subclauses.
		</p>
	</div>

	<div class="grid lg:grid-cols-3 gap-6">
		<div class="lg:col-span-2">
			<ResolutionEditor
				committeeName="General Assembly"
				{resolution}
				{headerData}
				editable={true}
				preamblePhrases={englishPreamblePhrases}
				operativePhrases={englishOperativePhrases}
				onResolutionChange={handleChange}
				onCopySuccess={handleCopySuccess}
				onCopyError={handleCopyError}
			/>
		</div>

		<div class="space-y-4">
			<div class="card bg-base-200">
				<div class="card-body">
					<h2 class="card-title text-lg">
						<i class="fa-solid fa-info-circle"></i>
						How to Use
					</h2>
					<ul class="text-sm space-y-2 text-base-content/70">
						<li>
							<i class="fa-solid fa-plus text-primary mr-2"></i>
							Click "+" to add new clauses
						</li>
						<li>
							<i class="fa-solid fa-indent text-primary mr-2"></i>
							Use indent/outdent buttons for subclauses
						</li>
						<li>
							<i class="fa-solid fa-book text-primary mr-2"></i>
							Use phrase lookup for valid opening phrases
						</li>
						<li>
							<i class="fa-solid fa-file-import text-primary mr-2"></i>
							Import text with automatic clause detection
						</li>
						<li>
							<i class="fa-solid fa-arrows-up-down text-primary mr-2"></i>
							Drag or use arrows to reorder clauses
						</li>
					</ul>
				</div>
			</div>

			<div class="card bg-base-200">
				<div class="card-body">
					<h2 class="card-title text-lg">
						<i class="fa-solid fa-check-circle"></i>
						Features Demonstrated
					</h2>
					<div class="flex flex-wrap gap-2">
						<span class="badge badge-primary">Phrase Validation</span>
						<span class="badge badge-secondary">Autocomplete</span>
						<span class="badge badge-accent">Nested Subclauses</span>
						<span class="badge badge-info">Live Preview</span>
						<span class="badge badge-success">Text Import</span>
						<span class="badge badge-warning">i18n Support</span>
					</div>
				</div>
			</div>

			<div class="card bg-base-200">
				<div class="card-body">
					<h2 class="card-title text-lg">
						<i class="fa-solid fa-code"></i>
						Resolution JSON
					</h2>
					<div class="mockup-code text-xs max-h-64 overflow-y-auto">
						<pre><code>{JSON.stringify(resolution, null, 2)}</code></pre>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>
