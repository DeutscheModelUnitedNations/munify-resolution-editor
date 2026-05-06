<script lang="ts">
	import { type SubClause, getSubClauseLabel, MAX_SUBCLAUSE_DEPTH } from '../schema/resolution';
	import type { ResolutionEditorLabels } from '../i18n/types';
	import type { ResolutionStore, SubclausesBlockPath } from '../store/types';
	import { englishLabels } from '../i18n/en';
	import Self from './SubClauseEditor.svelte';

	interface Props {
		store: ResolutionStore;
		/** Path of the parent (the entity owning the subclauses array). */
		path: SubclausesBlockPath;
		/** The actual subclauses array — passed in so the parent controls reactivity. */
		subClauses: SubClause[];
		depth: number;
		disabled?: boolean;
		labels?: Partial<ResolutionEditorLabels>;
	}

	let { store, path, subClauses, depth, disabled = false, labels = {} }: Props = $props();

	const t = $derived({ ...englishLabels, ...labels });

	function moveSub(id: string, direction: 'up' | 'down') {
		store.moveSubClause(path, id, direction);
	}

	function indentSub(id: string) {
		store.indentSubClause(path, id);
	}

	function outdentSub(id: string) {
		store.outdentSubClause(path, id);
	}

	function insertSiblingAfter(id: string) {
		store.addSubClause(path, id);
	}

	function deleteSub(id: string) {
		store.deleteSubClause(path, id);
	}

	function addNested(subClauseId: string) {
		if (depth + 1 > MAX_SUBCLAUSE_DEPTH) return;
		store.appendSubclausesBlock({ kind: 'subclause', subClauseId });
	}

	function addContinuationText(subClauseId: string) {
		store.appendTextBlock({ kind: 'subclause', subClauseId });
	}

	function deleteBlock(subClauseId: string, blockId: string) {
		store.deleteBlock({ kind: 'subclause', subClauseId }, blockId);
	}

	function hasSubclausesBlock(subClause: SubClause): boolean {
		return subClause.blocks.some((b) => b.type === 'subclauses');
	}
</script>

<div class="space-y-2">
	{#each subClauses as subClause, subClauseIndex (subClause.id)}
		<div class="border-l-2 border-base-300 pl-2">
			{#each subClause.blocks as block, blockIndex (block.id)}
				{#if block.type === 'text'}
					{@const handle = store.getTextHandle({
						kind: 'subclause-text',
						subClauseId: subClause.id,
						blockId: block.id
					})}
					<div class="flex gap-2 items-start" class:mt-2={blockIndex > 0}>
						{#if blockIndex === 0}
							<span class="text-sm font-medium text-base-content/70 min-w-10 pt-2 text-right">
								{getSubClauseLabel(subClauseIndex, depth)}
							</span>
						{:else}
							<span class="min-w-10"></span>
						{/if}

						<div class="flex-1">
							<textarea
								{@attach (el) => handle.bindTextarea(el)}
								placeholder={blockIndex === 0
									? t.resolutionSubClausePlaceholder
									: t.resolutionContinuationPlaceholder}
								class="textarea textarea-bordered textarea-sm w-full min-h-14 resize-y text-sm leading-relaxed bg-base-100"
								rows="2"
								{disabled}
							></textarea>

							{#if blockIndex === 0}
								<div class="flex flex-wrap gap-1 mt-1">
									<div class="join">
										<div class="tooltip" data-tip={t.resolutionMoveUp}>
											<button
												type="button"
												class="btn btn-ghost btn-xs join-item px-1.5"
												aria-label={t.resolutionMoveUp}
												onclick={() => moveSub(subClause.id, 'up')}
												disabled={disabled || subClauseIndex === 0}
											>
												<i class="fa-solid fa-chevron-up text-xs"></i>
											</button>
										</div>
										<div class="tooltip" data-tip={t.resolutionMoveDown}>
											<button
												type="button"
												class="btn btn-ghost btn-xs join-item px-1.5"
												aria-label={t.resolutionMoveDown}
												onclick={() => moveSub(subClause.id, 'down')}
												disabled={disabled || subClauseIndex === subClauses.length - 1}
											>
												<i class="fa-solid fa-chevron-down text-xs"></i>
											</button>
										</div>
									</div>

									<div class="join">
										<div class="tooltip" data-tip={t.resolutionIndent}>
											<button
												type="button"
												class="btn btn-ghost btn-xs join-item px-1.5"
												aria-label={t.resolutionIndent}
												onclick={() => indentSub(subClause.id)}
												disabled={disabled || subClauseIndex === 0 || depth >= MAX_SUBCLAUSE_DEPTH}
											>
												<i class="fa-solid fa-indent text-xs"></i>
											</button>
										</div>
										<div class="tooltip" data-tip={t.resolutionOutdent}>
											<button
												type="button"
												class="btn btn-ghost btn-xs join-item px-1.5"
												aria-label={t.resolutionOutdent}
												onclick={() => outdentSub(subClause.id)}
											>
												<i class="fa-solid fa-outdent text-xs"></i>
											</button>
										</div>
									</div>

									<div class="join">
										<div class="tooltip" data-tip={t.resolutionAddSibling}>
											<button
												type="button"
												class="btn btn-ghost btn-xs join-item px-1.5 text-primary"
												aria-label={t.resolutionAddSibling}
												onclick={() => insertSiblingAfter(subClause.id)}
											>
												<i class="fa-solid fa-plus text-xs"></i>
											</button>
										</div>
										{#if depth < MAX_SUBCLAUSE_DEPTH && !hasSubclausesBlock(subClause)}
											<div class="tooltip" data-tip={t.resolutionAddNested}>
												<button
													type="button"
													class="btn btn-ghost btn-xs join-item px-1.5 text-primary"
													aria-label={t.resolutionAddNested}
													onclick={() => addNested(subClause.id)}
												>
													<i class="fa-solid fa-level-down text-xs"></i>
												</button>
											</div>
										{/if}
									</div>

									<div class="flex-1"></div>

									<div class="tooltip" data-tip={t.resolutionDeleteClause}>
										<button
											type="button"
											class="btn btn-ghost btn-xs px-1.5 text-error"
											aria-label={t.resolutionDeleteClause}
											onclick={() => deleteSub(subClause.id)}
										>
											<i class="fa-solid fa-trash text-xs"></i>
										</button>
									</div>
								</div>
							{:else}
								<div class="flex flex-wrap gap-1 mt-1">
									<div class="flex-1"></div>
									<div class="tooltip" data-tip={t.resolutionDeleteBlock}>
										<button
											type="button"
											class="btn btn-ghost btn-xs px-1.5 text-error"
											aria-label={t.resolutionDeleteBlock}
											onclick={() => deleteBlock(subClause.id, block.id)}
										>
											<i class="fa-solid fa-trash text-xs"></i>
										</button>
									</div>
								</div>
							{/if}
						</div>
					</div>
				{:else if block.type === 'subclauses'}
					<div class="ml-10 mt-2">
						<Self
							{store}
							path={{ kind: 'subclause', subClauseId: subClause.id }}
							subClauses={block.items}
							depth={depth + 1}
							{disabled}
							{labels}
						/>
						<div class="mt-1 flex gap-1">
							<button
								type="button"
								class="btn btn-ghost btn-xs gap-1 text-primary"
								onclick={() => addContinuationText(subClause.id)}
							>
								<i class="fa-solid fa-paragraph text-xs"></i>
								{t.resolutionAddContinuation}
							</button>
						</div>
					</div>
				{/if}
			{/each}
		</div>
	{/each}
</div>
