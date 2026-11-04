<script lang="ts">
	import '@phosphor-icons/web/regular';
	import '@phosphor-icons/web/fill';
	import '@phosphor-icons/web/duotone';
	import '../app.css';
	import { base } from '$app/paths';

	let { children } = $props();
</script>

<svelte:head>
	<title>MUNify Resolution Editor</title>
</svelte:head>

<div class="min-h-screen bg-base-100">
	<nav class="navbar bg-base-200 border-b border-base-300">
		<div class="flex-1">
			<a href="{base}/" class="btn btn-ghost text-xl">
				<i class="ph-fill ph-file-text"></i>
				MUNify Resolution Editor
			</a>
		</div>
		<div class="flex-none">
			<ul class="menu menu-horizontal px-1">
				<li><a href="{base}/">Home</a></li>
				<li><a href="{base}/editor">Editor Demo</a></li>
				<li><a href="{base}/preview">Preview Demo</a></li>
				<li><a href="{base}/operative-paragraph">Operative Paragraph</a></li>
				<li>
					<a
						href="https://github.com/DeutscheModelUnitedNations/munify-resolution-editor"
						target="_blank"
						rel="noopener noreferrer"
					>
						<i class="ph ph-github-logo"></i>
						GitHub
					</a>
				</li>
			</ul>
		</div>
	</nav>

	<main>
		{@render children()}
	</main>

	<footer class="footer footer-center p-4 bg-base-200 text-base-content border-t border-base-300">
		<aside>
			<p>
				<i class="ph-fill ph-copyright"></i>
				2026 Deutsche Model United Nations e.V. - MIT License
			</p>
		</aside>
	</footer>
</div>
