<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import Pencil from '@lucide/svelte/icons/pencil';
	import MergeIcon from '@lucide/svelte/icons/git-merge';
	import CheckIcon from '@lucide/svelte/icons/check';
	import XIcon from '@lucide/svelte/icons/x';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import TagIcon from '@lucide/svelte/icons/tag';

	let { data } = $props();

	type Cat = (typeof data.categories)[0];
	type Tag = (typeof data.tags)[0];

	// ── Category editing ─────────────────────────────────────────────────────
	let editingCat = $state<Cat | null>(null);
	let mergingCat = $state<Cat | null>(null);
	let mergeTarget = $state<number | null>(null);
	let expandedCatId = $state<number | null>(null);
	let newKeyword = $state<Record<number, string>>({});

	// ── Tag editing ───────────────────────────────────────────────────────────
	let editingTag = $state<Tag | null>(null);

	const sortedCats = $derived([...data.categories].sort((a, b) => a.name.localeCompare(b.name)));
	const sortedTags = $derived([...data.tags].sort((a, b) => a.name.localeCompare(b.name)));
</script>

<div class="mx-auto max-w-2xl space-y-10 px-4 py-8">
	<div>
		<h1 class="text-2xl font-bold text-card-foreground">Settings</h1>
		<p class="mt-1 text-sm text-muted-foreground">Manage your categories and tags.</p>
	</div>

	<!-- ── Categories ────────────────────────────────────────────────────── -->
	<section class="space-y-3">
		<h2 class="text-base font-semibold text-card-foreground">Categories</h2>

		<div class="divide-y divide-border rounded-2xl border border-border bg-card">
			{#each sortedCats as cat (cat.id)}
				<div class="flex items-center gap-3 px-4 py-3">
					<!-- Color swatch -->
					<span class="h-3 w-3 shrink-0 rounded-full" style="background-color: {cat.color}"></span>

					{#if editingCat?.id === cat.id}
						<!-- Inline edit form -->
						<form
							method="POST"
							action="?/updateCategory"
							class="flex flex-1 flex-wrap items-center gap-2"
							use:enhance={() => async ({ update }) => { editingCat = null; await update(); }}
						>
							<input type="hidden" name="id" value={cat.id} />
							<input
								name="name"
								value={editingCat.name}
								required
								class="min-w-0 flex-1 rounded-lg border border-input bg-background px-2.5 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
							/>
							<input
								name="color"
								type="color"
								value={editingCat.color}
								class="h-7 w-9 cursor-pointer rounded border border-input bg-background p-0.5"
							/>
							<input
								name="monthlyBudget"
								type="number"
								min="0"
								step="1"
								value={editingCat.monthlyBudget ?? ''}
								placeholder="Budget/mo"
								class="w-24 rounded-lg border border-input bg-background px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-ring/50"
							/>
							<button type="submit" class="rounded-lg p-1.5 text-primary hover:bg-primary/10"><CheckIcon class="h-4 w-4" /></button>
							<button type="button" onclick={() => editingCat = null} class="rounded-lg p-1.5 text-muted-foreground hover:bg-accent"><XIcon class="h-4 w-4" /></button>
						</form>

					{:else if mergingCat?.id === cat.id}
						<!-- Merge form -->
						<form
							method="POST"
							action="?/mergeCategory"
							class="flex flex-1 flex-wrap items-center gap-2"
							use:enhance={() => async ({ update }) => { mergingCat = null; mergeTarget = null; await update(); }}
						>
							<input type="hidden" name="sourceId" value={cat.id} />
							<span class="text-sm text-muted-foreground">Merge <strong>{cat.name}</strong> into</span>
							<select
								name="targetId"
								required
								class="rounded-lg border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
							>
								<option value="">Pick category…</option>
								{#each sortedCats.filter(c => c.id !== cat.id) as opt (opt.id)}
									<option value={opt.id}>{opt.name}</option>
								{/each}
							</select>
							<button type="submit" class="rounded-lg bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground hover:opacity-90">Merge</button>
							<button type="button" onclick={() => mergingCat = null} class="rounded-lg p-1.5 text-muted-foreground hover:bg-accent"><XIcon class="h-4 w-4" /></button>
						</form>

					{:else}
						<!-- Default row -->
						<span class="min-w-0 flex-1 truncate text-sm font-medium text-card-foreground">{cat.name}</span>
						{#if cat.monthlyBudget}
							<span class="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
								Budget {cat.monthlyBudget.toLocaleString()}/mo
							</span>
						{/if}
						<span class="shrink-0 text-xs text-muted-foreground">{cat.count} expense{cat.count !== 1 ? 's' : ''}</span>
						<div class="flex shrink-0 items-center gap-1">
							<button
								type="button"
								onclick={() => { expandedCatId = expandedCatId === cat.id ? null : cat.id; editingCat = null; mergingCat = null; }}
								title="Edit keywords"
								class="flex items-center gap-1 rounded-lg px-1.5 py-1 text-xs text-muted-foreground transition hover:bg-accent hover:text-accent-foreground
									{expandedCatId === cat.id ? 'bg-accent text-accent-foreground' : ''}"
							>
								<TagIcon class="h-3 w-3" />
								{cat.keywords.length}
								<ChevronDownIcon class="h-3 w-3 transition-transform {expandedCatId === cat.id ? 'rotate-180' : ''}" />
							</button>
							<button
								type="button"
								onclick={() => { editingCat = { ...cat }; mergingCat = null; expandedCatId = null; }}
								title="Rename"
								class="rounded-lg p-1.5 text-muted-foreground transition hover:bg-accent hover:text-accent-foreground"
							><Pencil class="h-3.5 w-3.5" /></button>
							<button
								type="button"
								onclick={() => { mergingCat = { ...cat }; editingCat = null; expandedCatId = null; }}
								title="Merge into another"
								class="rounded-lg p-1.5 text-muted-foreground transition hover:bg-accent hover:text-accent-foreground"
							><MergeIcon class="h-3.5 w-3.5" /></button>
							<form method="POST" action="?/deleteCategory" use:enhance={() => async ({ update }) => { await update(); }}>
								<input type="hidden" name="id" value={cat.id} />
								<button
									type="submit"
									title="Delete"
									onclick={(e) => { if (!confirm(`Delete "${cat.name}"? Expenses will become uncategorized.`)) e.preventDefault(); }}
									class="rounded-lg p-1.5 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
								><Trash2 class="h-3.5 w-3.5" /></button>
							</form>
						</div>
					{/if}
				</div>

				<!-- Keywords accordion -->
				{#if expandedCatId === cat.id}
					<div class="border-t border-border bg-muted/30 px-4 py-3">
						<p class="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
							Keywords — matched against merchant name &amp; remark on import
						</p>
						<div class="flex flex-wrap gap-1.5">
							{#each cat.keywords as kw (kw.id)}
								<form method="POST" action="?/removeKeyword" use:enhance={() => async ({ update }) => { await update(); }}>
									<input type="hidden" name="id" value={kw.id} />
									<button
										type="submit"
										class="flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-xs text-muted-foreground transition hover:border-destructive hover:text-destructive"
									>
										{kw.keyword} <XIcon class="h-2.5 w-2.5" />
									</button>
								</form>
							{/each}

							<!-- Add keyword inline -->
							<form
								method="POST"
								action="?/addKeyword"
								use:enhance={() => async ({ update }) => { newKeyword[cat.id] = ''; await update(); }}
								class="flex items-center gap-1"
							>
								<input type="hidden" name="categoryId" value={cat.id} />
								<input
									bind:value={newKeyword[cat.id]}
									name="keyword"
									placeholder="Add keyword…"
									class="w-32 rounded-full border border-dashed border-border bg-background px-2.5 py-0.5 text-xs placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none"
								/>
								<button
									type="submit"
									disabled={!newKeyword[cat.id]?.trim()}
									class="rounded-full bg-primary px-2.5 py-0.5 text-xs font-medium text-primary-foreground disabled:opacity-40"
								>Add</button>
							</form>
						</div>
					</div>
				{/if}
			{/each}

			{#if data.categories.length === 0}
				<p class="px-4 py-6 text-center text-sm text-muted-foreground">No categories yet.</p>
			{/if}
		</div>
	</section>

	<!-- ── Tags ──────────────────────────────────────────────────────────── -->
	<section class="space-y-3">
		<h2 class="text-base font-semibold text-card-foreground">Tags</h2>

		{#if data.tags.length === 0}
			<p class="rounded-2xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
				No tags yet — add them from the Expenses page.
			</p>
		{:else}
			<div class="divide-y divide-border rounded-2xl border border-border bg-card">
				{#each sortedTags as tag (tag.id)}
					<div class="flex items-center gap-3 px-4 py-3">
						<span class="h-3 w-3 shrink-0 rounded-full" style="background-color: {tag.color}"></span>

						{#if editingTag?.id === tag.id}
							<form
								method="POST"
								action="?/updateTag"
								class="flex flex-1 items-center gap-2"
								use:enhance={() => async ({ update }) => { editingTag = null; await update(); }}
							>
								<input type="hidden" name="id" value={tag.id} />
								<input
									name="name"
									value={editingTag.name}
									required
									class="min-w-0 flex-1 rounded-lg border border-input bg-background px-2.5 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
								/>
								<input
									name="color"
									type="color"
									value={editingTag.color}
									class="h-7 w-9 cursor-pointer rounded border border-input bg-background p-0.5"
								/>
								<button type="submit" class="rounded-lg p-1.5 text-primary hover:bg-primary/10"><CheckIcon class="h-4 w-4" /></button>
								<button type="button" onclick={() => editingTag = null} class="rounded-lg p-1.5 text-muted-foreground hover:bg-accent"><XIcon class="h-4 w-4" /></button>
							</form>
						{:else}
							<span class="min-w-0 flex-1 truncate text-sm font-medium" style="color: {tag.color}">{tag.name}</span>
							<span class="shrink-0 text-xs text-muted-foreground">{tag.count} expense{tag.count !== 1 ? 's' : ''}</span>
							<div class="flex shrink-0 items-center gap-1">
								<button
									type="button"
									onclick={() => editingTag = { ...tag }}
									title="Rename"
									class="rounded-lg p-1.5 text-muted-foreground transition hover:bg-accent hover:text-accent-foreground"
								><Pencil class="h-3.5 w-3.5" /></button>
								<form method="POST" action="?/deleteTag" use:enhance={() => async ({ update }) => { await update(); }}>
									<input type="hidden" name="id" value={tag.id} />
									<button
										type="submit"
										title="Delete"
										onclick={(e) => { if (!confirm(`Delete tag "${tag.name}"?`)) e.preventDefault(); }}
										class="rounded-lg p-1.5 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
									><Trash2 class="h-3.5 w-3.5" /></button>
								</form>
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</section>
</div>
