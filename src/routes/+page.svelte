<script lang="ts">
	// Landing page - documentation and feature overview
</script>

<div class="container mx-auto px-4 py-8 max-w-4xl">
	<div class="hero bg-base-200 rounded-box p-8 mb-8">
		<div class="hero-content text-center">
			<div class="max-w-lg">
				<h1 class="text-5xl font-bold mb-4">
					<i class="fa-solid fa-file-lines text-primary"></i>
					Resolution Editor
				</h1>
				<p class="text-xl text-base-content/70 mb-6">
					A Svelte 5 component library for creating and editing UN-style resolutions. Built for
					Model United Nations conferences.
				</p>
				<div class="flex gap-4 justify-center">
					<a href="/editor" class="btn btn-primary">
						<i class="fa-solid fa-edit"></i>
						Try Editor
					</a>
					<a href="/preview" class="btn btn-outline">
						<i class="fa-solid fa-eye"></i>
						View Preview
					</a>
				</div>
			</div>
		</div>
	</div>

	<div class="grid md:grid-cols-2 gap-6 mb-8">
		<div class="card bg-base-200">
			<div class="card-body">
				<h2 class="card-title">
					<i class="fa-solid fa-pen-to-square text-primary"></i>
					Full Resolution Editor
				</h2>
				<p>
					Complete editing experience for UN resolutions with preamble and operative clauses.
					Block-based structure supporting nested subclauses up to 4 levels deep.
				</p>
			</div>
		</div>

		<div class="card bg-base-200">
			<div class="card-body">
				<h2 class="card-title">
					<i class="fa-solid fa-check-circle text-primary"></i>
					Phrase Validation
				</h2>
				<p>
					Validate clause openings against official UN resolution vocabulary. Inline autocomplete
					suggestions help users write proper resolutions.
				</p>
			</div>
		</div>

		<div class="card bg-base-200">
			<div class="card-body">
				<h2 class="card-title">
					<i class="fa-solid fa-file-import text-primary"></i>
					Import from Text
				</h2>
				<p>
					Parse plain text or LLM-formatted resolutions. Smart detection of numbered lists, lettered
					subclauses, and nested structures.
				</p>
			</div>
		</div>

		<div class="card bg-base-200">
			<div class="card-body">
				<h2 class="card-title">
					<i class="fa-solid fa-eye text-primary"></i>
					Preview Mode
				</h2>
				<p>
					Render resolutions in official UN document format with proper formatting, italicized
					phrases, and correct punctuation.
				</p>
			</div>
		</div>

		<div class="card bg-base-200">
			<div class="card-body">
				<h2 class="card-title">
					<i class="fa-solid fa-language text-primary"></i>
					Fully Customizable
				</h2>
				<p>
					Complete i18n support with all labels customizable. Provide custom phrase dictionaries for
					different languages or conferences.
				</p>
			</div>
		</div>

		<div class="card bg-base-200">
			<div class="card-body">
				<h2 class="card-title">
					<i class="fa-solid fa-puzzle-piece text-primary"></i>
					Extension Points
				</h2>
				<p>
					Svelte 5 snippet-based extension points allow adding custom UI elements like amendment
					buttons, vote indicators, or diff highlighting.
				</p>
			</div>
		</div>
	</div>

	<div class="card bg-base-200 mb-8">
		<div class="card-body">
			<h2 class="card-title text-2xl mb-4">
				<i class="fa-solid fa-download"></i>
				Installation
			</h2>
			<div class="mockup-code">
				<pre
					data-prefix="$"><code>bun add @deutschemodelunitednations/munify-resolution-editor</code></pre>
			</div>

			<h3 class="font-semibold mt-6 mb-2">Peer Dependencies</h3>
			<ul class="list-disc list-inside text-base-content/70">
				<li><code>svelte</code> ^5.0.0</li>
				<li>TailwindCSS and DaisyUI for styling (configure in your project)</li>
			</ul>
		</div>
	</div>

	<div class="card bg-base-200 mb-8">
		<div class="card-body">
			<h2 class="card-title text-2xl mb-4">
				<i class="fa-solid fa-code"></i>
				Basic Usage
			</h2>
			<div class="mockup-code text-sm overflow-x-auto">
				<pre><code>{`<script lang="ts">
  import {
    ResolutionEditor,
    englishPreamblePhrases,
    englishOperativePhrases,
    type Resolution
  } from '@deutschemodelunitednations/munify-resolution-editor';

  let resolution: Resolution = $state({
    committeeName: 'General Assembly',
    preamble: [],
    operative: []
  });

  function handleChange(updated: Resolution) {
    resolution = updated;
  }
</script>

<ResolutionEditor
  committeeName="General Assembly"
  {resolution}
  editable={true}
  preamblePhrases={englishPreamblePhrases}
  operativePhrases={englishOperativePhrases}
  onResolutionChange={handleChange}
/>`}</code></pre>
			</div>
		</div>
	</div>

	<div class="card bg-base-200">
		<div class="card-body">
			<h2 class="card-title text-2xl mb-4">
				<i class="fa-solid fa-plug"></i>
				Extension Points
			</h2>
			<p class="mb-4">
				The editor supports Svelte 5 snippet-based extension points for customization:
			</p>
			<div class="mockup-code text-sm overflow-x-auto">
				<pre><code>{`import {
  ResolutionEditor,
  ResolutionDocumentHeader,
  ResolutionDocumentFooter
} from '@deutschemodelunitednations/munify-resolution-editor';

<ResolutionEditor {...props}>
  {#snippet clauseToolbar({ clause, index })}
    <button onclick={() => addAmendment(clause)}>
      Add Amendment
    </button>
  {/snippet}

  {#snippet clauseAnnotations({ clause, index })}
    {#if hasAmendments(clause)}
      <div class="badge badge-warning">Has amendments</div>
    {/if}
  {/snippet}

  {#snippet previewHeader({ resolution, headerData })}
    <!-- Use default header + custom content -->
    <ResolutionDocumentHeader {headerData} {resolution} />
    <div class="custom-banner">Draft Resolution</div>
  {/snippet}

  {#snippet previewFooter({ resolution })}
    <ResolutionDocumentFooter {resolution} {headerData} />
  {/snippet}
</ResolutionEditor>`}</code></pre>
			</div>

			<h3 class="font-semibold mt-6 mb-2">Available Extension Points</h3>
			<div class="overflow-x-auto">
				<table class="table table-sm">
					<thead>
						<tr>
							<th>Extension Point</th>
							<th>Location</th>
							<th>Use Case</th>
						</tr>
					</thead>
					<tbody>
						<tr>
							<td><code>clauseToolbar</code></td>
							<td>Next to each operative clause</td>
							<td>Amendment buttons, comment toggles</td>
						</tr>
						<tr>
							<td><code>clauseAnnotations</code></td>
							<td>Overlay on each clause</td>
							<td>Diff highlights, amendment badges</td>
						</tr>
						<tr>
							<td><code>previewHeader</code></td>
							<td>Top of preview</td>
							<td>Custom metadata, voting info</td>
						</tr>
						<tr>
							<td><code>previewFooter</code></td>
							<td>Bottom of preview</td>
							<td>Signatures, timestamps</td>
						</tr>
					</tbody>
				</table>
			</div>
		</div>
	</div>
</div>
