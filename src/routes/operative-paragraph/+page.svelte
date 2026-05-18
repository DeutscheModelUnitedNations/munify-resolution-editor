<script lang="ts">
	import { OperativeParagraphEditor, OperativeParagraphPreview } from '$lib/components';
	import { englishOperativePhrases } from '$lib/phrases/en';

	const sampleOld = `Calls upon all parties to the conflict to:
- ensure the protection of civilians in accordance with international humanitarian law
- grant unhindered humanitarian access to all affected populations
- release all unlawfully detained persons`;

	let markup = $state(`Calls upon all parties to the conflict to:
- ensure the full protection of civilians in accordance with international humanitarian law and human rights law
- grant rapid, safe and unhindered humanitarian access to all affected populations
- release all arbitrarily detained persons without delay
- refrain from any action that endangers humanitarian personnel`);

	let oldMarkup = $state(sampleOld);
	let showDiff = $state(true);
	let operativeNumber = $state(5);
</script>

<div class="container mx-auto max-w-6xl px-4 py-8">
	<div class="mb-6">
		<h1 class="mb-2 text-3xl font-bold">
			<i class="fa-solid fa-paragraph text-primary"></i>
			Operative Paragraph
		</h1>
		<p class="text-base-content/70">
			Standalone editor and viewer for a single operative paragraph, driven by a RES-Markup clause
			fragment. The viewer renders in resolution-paragraph style and can show a word-level diff
			against a previous version &mdash; useful for amendments.
		</p>
	</div>

	<div class="mb-4 flex items-center gap-3">
		<label class="label gap-2">
			<span class="label-text text-sm">Paragraph number</span>
			<input
				type="number"
				min="1"
				class="input input-bordered input-sm w-20"
				bind:value={operativeNumber}
			/>
		</label>
	</div>

	<div class="card bg-base-100 shadow">
		<div class="card-body">
			<OperativeParagraphEditor
				bind:markup
				bind:oldMarkup
				bind:showDiff
				{operativeNumber}
				operativePhrases={englishOperativePhrases}
			/>
		</div>
	</div>

	<div class="mt-8">
		<h2 class="mb-3 text-xl font-bold">
			<i class="fa-solid fa-eye text-primary"></i>
			Viewer only (with built-in diff toggle)
		</h2>
		<div class="rounded-lg border border-base-300 bg-white p-6 shadow-sm">
			<OperativeParagraphPreview
				{markup}
				{oldMarkup}
				showDiffToggle
				{operativeNumber}
				operativePhrases={englishOperativePhrases}
			/>
		</div>
	</div>
</div>
