<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { convertToMain, formatMoney } from '$lib/currency';
	import { hashColor } from '$lib/color';
	import BCABadge from '$lib/components/BCABadge.svelte';
	import TagPicker from '$lib/components/TagPicker.svelte';
	import * as Sheet from '$lib/components/ui/sheet/index.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import MoreHorizontal from '@lucide/svelte/icons/ellipsis';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import SearchIcon from '@lucide/svelte/icons/search';
	import SparklesIcon from '@lucide/svelte/icons/sparkles';
	import XIcon from '@lucide/svelte/icons/x';

	let { data, form } = $props();

	type Exp = (typeof data.expenses)[0];

	let sheetOpen = $state(false);
	let editing = $state<Exp | null>(null);
	let search = $state('');
	let uploading = $state(false);
	let uploadMessage = $state('');
	let uploadFormEl = $state<HTMLFormElement | null>(null);
	let cardType = $state<'debit' | 'cc'>('debit');
	let deletingBatch = $state<string | null>(null);

	// ── Tagging state ────────────────────────────────────────────────────────
	let selectedIds = $state<Set<number>>(new Set());
	let editingTagIds = $state<Set<number>>(new Set());
	let busy = $state(false);

	const tagById = $derived(new Map(data.tags.map((t) => [t.id, t])));

	function tagsFor(expId: number) {
		return (data.expenseTagMap[expId] ?? []).map((id) => tagById.get(id)).filter(Boolean);
	}

	function toggleSelect(id: number) {
		const next = new Set(selectedIds);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		selectedIds = next;
	}
	function clearSelection() {
		selectedIds = new Set();
	}

	// Programmatic form-action POST + refresh
	async function postAction(action: string, fields: Record<string, string>) {
		busy = true;
		const fd = new FormData();
		for (const [k, v] of Object.entries(fields)) fd.append(k, v);
		await fetch(`?/${action}`, { method: 'POST', body: fd });
		await invalidateAll();
		busy = false;
	}

	// Create a tag, then return its id by re-reading data after refresh
	async function createAndApply(name: string, color: string, expenseIds: number[]) {
		busy = true;
		const fd = new FormData();
		fd.append('name', name);
		fd.append('color', color);
		await fetch('?/createTag', { method: 'POST', body: fd });
		await invalidateAll();
		const created = data.tags.find((t) => t.name.toLowerCase() === name.toLowerCase());
		if (created) {
			await postAction('applyTag', { tagId: String(created.id), expenseIds: expenseIds.join(',') });
		}
		busy = false;
	}

	function applyTag(tagId: number, expenseIds: number[]) {
		postAction('applyTag', { tagId: String(tagId), expenseIds: expenseIds.join(',') });
	}
	function removeTag(tagId: number, expenseId: number) {
		postAction('removeTag', { tagId: String(tagId), expenseId: String(expenseId) });
	}
	function applyAllSuggestions() {
		postAction('applySuggestions', {});
	}

	const totalSuggested = $derived(
		data.suggestions.reduce((sum, s) => sum + s.expenseIds.length, 0)
	);

	const totalCategorySuggested = $derived(
		data.categorySuggestions.reduce((sum, s) => sum + s.expenseIds.length, 0)
	);

	function applyAllCategorySuggestions() {
		postAction('applyCategorySuggestions', {});
	}

	function bcaCardType(importRef: string | null): 'debit' | 'cc' | null {
		if (!importRef) return null;
		if (importRef.match(/^\[bca-debit-/)) return 'debit';
		if (importRef.match(/^\[bca-cc-/)) return 'cc';
		return null;
	}

	function importFilename(importRef: string | null): string | null {
		if (!importRef) return null;
		const m = importRef.match(/^\[bca-(?:debit|cc)-\d+\]\s*(.*)/);
		return m ? m[1] : null;
	}

	function openAdd() {
		editing = null;
		editingTagIds = new Set();
		sheetOpen = true;
	}
	function openEdit(exp: Exp) {
		editing = exp;
		editingTagIds = new Set(data.expenseTagMap[exp.id] ?? []);
		sheetOpen = true;
	}

	const filtered = $derived(
		data.expenses.filter((e) =>
			!search || e.name.toLowerCase().includes(search.toLowerCase())
		)
	);

	const totalExpenses = $derived(
		data.expenses
			.filter((e) => e.direction !== 'income')
			.reduce((sum, e) => sum + convertToMain(e.amount, e.currencyId, data.currencies, data.mainCurrency), 0)
	);
	const totalIncome = $derived(
		data.expenses
			.filter((e) => e.direction === 'income')
			.reduce((sum, e) => sum + convertToMain(e.amount, e.currencyId, data.currencies, data.mainCurrency), 0)
	);
	const total = $derived(
		data.expenses.reduce(
			(sum, e) => sum + convertToMain(e.amount, e.currencyId, data.currencies, data.mainCurrency),
			0
		)
	);
</script>

<div class="space-y-5">
	<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
		<div>
			<h1 class="text-2xl font-bold text-foreground">Transactions</h1>
			<p class="text-sm text-muted-foreground">
				{data.expenses.length} entries ·
				<span class="text-destructive">−{formatMoney(totalExpenses, data.mainCurrency)}</span>
				{#if totalIncome > 0}
					· <span class="text-emerald-600 dark:text-emerald-400">+{formatMoney(totalIncome, data.mainCurrency)}</span>
				{/if}
			</p>
		</div>
		<button
			onclick={openAdd}
			class="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90"
		>
			<PlusIcon class="h-4 w-4" />
			New Expense
		</button>
	</div>

	{#if form?.error}
		<p class="rounded-xl bg-destructive/10 px-4 py-2.5 text-sm text-destructive">{form.error}</p>
	{/if}

	{#if uploadMessage}
		<p class="rounded-xl bg-primary/10 px-4 py-2.5 text-sm text-primary">{uploadMessage}</p>
	{/if}

	<!-- BCA Statement Upload + Batch Manager -->
	<div class="rounded-2xl border border-border bg-card shadow-sm">
		<!-- Upload strip -->
		<form
			bind:this={uploadFormEl}
			action="?/uploadStatement"
			method="POST"
			enctype="multipart/form-data"
			use:enhance={() => {
				uploading = true;
				return async ({ result }: any) => {
					uploading = false;
					if (result.type === 'success') {
						uploadMessage = result.data?.message || 'Statement imported successfully!';
						uploadFormEl?.reset();
						await invalidateAll();
						setTimeout(() => (uploadMessage = ''), 4000);
					} else if (result.type === 'failure') {
						uploadMessage = result.data?.error || 'Failed to import statement';
					}
				};
			}}
			class="flex flex-wrap items-center gap-3 border-b border-border p-4"
		>
			<input type="hidden" name="cardType" value={cardType} />
			<input
				type="file"
				name="file"
				id="pdf-upload"
				accept="application/pdf"
				required
				disabled={uploading}
				class="hidden"
				onchange={(e) => {
					if ((e.target as HTMLInputElement).files?.length) uploadFormEl?.requestSubmit();
				}}
			/>

			<!-- Card type toggle -->
			<div class="flex overflow-hidden rounded-lg border border-border text-xs font-semibold">
				<button type="button" onclick={() => (cardType = 'debit')}
					class="flex items-center gap-1.5 px-3 py-1.5 transition {cardType === 'debit' ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-muted'}">
					<BCABadge type="debit" size={16} /> Debit
				</button>
				<button type="button" onclick={() => (cardType = 'cc')}
					class="flex items-center gap-1.5 px-3 py-1.5 transition {cardType === 'cc' ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-muted'}">
					<BCABadge type="cc" size={16} /> Credit Card
				</button>
			</div>

			<button
				type="button"
				onclick={() => document.getElementById('pdf-upload')?.click()}
				disabled={uploading}
				class="flex items-center gap-2 rounded-lg border border-primary bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/20 disabled:opacity-50"
			>
				{#if uploading}
					<span class="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent"></span>
					Importing…
				{:else}
					+ Import BCA PDF
				{/if}
			</button>

			<p class="text-xs text-muted-foreground">Select the monthly statement PDF from BCA</p>
		</form>

		<!-- Batch list -->
		{#if data.importBatches.length > 0}
			<ul class="divide-y divide-border">
				{#each data.importBatches as batch (batch.importId)}
					<li class="flex items-center gap-3 px-4 py-3">
						<BCABadge type={batch.cardType as 'debit' | 'cc'} size={32} />
						<div class="min-w-0 flex-1">
							<p class="truncate text-sm font-medium text-card-foreground">{batch.filename}</p>
							<p class="text-xs text-muted-foreground">
								{batch.count} transactions · imported {new Date(batch.ts).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
							</p>
						</div>
						<form
							action="?/undoImport"
							method="POST"
							use:enhance={() => {
								deletingBatch = batch.importId;
								return async ({ result }: any) => {
									deletingBatch = null;
									uploadMessage = result.data?.message || 'Batch deleted.';
									await invalidateAll();
									setTimeout(() => (uploadMessage = ''), 3000);
								};
							}}
						>
							<input type="hidden" name="importId" value={batch.importId} />
							<button
								type="submit"
								disabled={deletingBatch === batch.importId}
								class="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-destructive transition hover:bg-destructive/10 disabled:opacity-40"
							>
								<Trash2 class="h-3.5 w-3.5" />
								{deletingBatch === batch.importId ? 'Deleting…' : 'Delete'}
							</button>
						</form>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="px-4 py-3 text-xs text-muted-foreground">No imported batches yet.</p>
		{/if}
	</div>

	<!-- Suggestions banner (learned from your past tagging) -->
	{#if data.suggestions.length > 0}
		<div class="flex flex-col gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
			<div class="flex items-start gap-3">
				<div class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
					<SparklesIcon class="h-4 w-4" />
				</div>
				<div class="min-w-0">
					<p class="text-sm font-semibold text-card-foreground">
						{totalSuggested} transaction{totalSuggested > 1 ? 's' : ''} match your tagging history
					</p>
					<div class="mt-1.5 flex flex-wrap gap-1.5">
						{#each data.suggestions.slice(0, 4) as s (s.tagId + '-' + s.merchant)}
							<span class="rounded-full px-2 py-0.5 text-xs" style="background-color: {s.tagColor}22; color: {s.tagColor}">
								{s.tagName} · {s.merchant} ({s.expenseIds.length})
							</span>
						{/each}
						{#if data.suggestions.length > 4}
							<span class="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
								+{data.suggestions.length - 4} more
							</span>
						{/if}
					</div>
				</div>
			</div>
			<button
				onclick={applyAllSuggestions}
				disabled={busy}
				class="shrink-0 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
			>
				{busy ? 'Applying…' : 'Apply all'}
			</button>
		</div>
	{/if}


	<!-- Category suggestions banner (learned from your past category choices) -->
	{#if data.categorySuggestions.length > 0}
		<div class="flex flex-col gap-3 rounded-2xl border border-amber-300/30 bg-amber-50/50 p-4 dark:border-amber-600/30 dark:bg-amber-950/20 sm:flex-row sm:items-center sm:justify-between">
			<div class="flex items-start gap-3">
				<div class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-200/50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
					<SparklesIcon class="h-4 w-4" />
				</div>
				<div class="min-w-0">
					<p class="text-sm font-semibold text-card-foreground">
						{totalCategorySuggested} transaction{totalCategorySuggested > 1 ? 's' : ''} can be re-categorized
					</p>
					<div class="mt-1.5 flex flex-wrap gap-1.5">
						{#each data.categorySuggestions.slice(0, 3) as s (s.categoryId + '-' + s.merchant)}
							<span class="rounded-full px-2 py-0.5 text-xs" style="background-color: {s.categoryColor}22; color: {s.categoryColor}">
								{s.categoryName} · {s.merchant} ({s.expenseIds.length})
							</span>
						{/each}
						{#if data.categorySuggestions.length > 3}
							<span class="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
								+{data.categorySuggestions.length - 3} more
							</span>
						{/if}
					</div>
				</div>
			</div>
			<button
				onclick={applyAllCategorySuggestions}
				disabled={busy}
				class="shrink-0 rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50 dark:bg-amber-700"
			>
				{busy ? 'Applying…' : 'Apply all'}
			</button>
		</div>
	{/if}

	<div class="relative">
		<SearchIcon class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
		<input
			bind:value={search}
			placeholder="Search expenses..."
			class="w-full rounded-xl border border-border bg-background py-2.5 pl-9 pr-4 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 sm:max-w-xs"
		/>
	</div>

	<div class="space-y-2">
		{#each filtered as exp (exp.id)}
			{@const cat = data.categories.find((c) => c.id === exp.categoryId)}
			{@const expCurrency = data.currencies.find((c) => c.id === exp.currencyId)}
			{@const bcaType = bcaCardType(exp.importRef)}
			{@const isIncome = exp.direction === 'income'}
			<div class="flex items-center gap-3 rounded-2xl border bg-card p-3.5 shadow-sm transition sm:gap-4 sm:p-4
				{selectedIds.has(exp.id) ? 'border-primary ring-1 ring-primary/30' : 'border-border'}
				{isIncome ? 'border-l-2 border-l-emerald-500' : ''}">

				<!-- Select checkbox -->
				<input
					type="checkbox"
					checked={selectedIds.has(exp.id)}
					onchange={() => toggleSelect(exp.id)}
					class="h-4 w-4 shrink-0 cursor-pointer rounded border-input accent-primary"
				/>

				<!-- Avatar -->
				{#if bcaType}
					<BCABadge type={bcaType} size={42} />
				{:else}
					<div
						class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-base font-bold text-white"
						style="background-color: {cat?.color ?? hashColor(exp.name)}"
					>
						{exp.name.charAt(0).toUpperCase()}
					</div>
				{/if}

				<!-- Info -->
				<div class="min-w-0 flex-1">
					<!-- Merchant / counterparty name -->
					<p class="font-semibold text-card-foreground">{exp.name}</p>

					<!-- Remark: the user's own note on the transfer -->
					{#if exp.remark}
						<p class="mt-0.5 text-xs italic text-muted-foreground">"{exp.remark}"</p>
					{/if}

					<!-- Meta chips -->
					<div class="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
						<span class="text-muted-foreground">{exp.date}</span>

						<!-- Source type badge — outlined with "via" prefix to distinguish from category -->
						{#if exp.sourceType === 'qr'}
							<span class="rounded-full border border-violet-400 px-2 py-0.5 text-xs font-medium text-violet-600 dark:border-violet-500 dark:text-violet-400">via QR</span>
						{:else if exp.sourceType === 'biffast'}
							<span class="rounded-full border border-sky-400 px-2 py-0.5 text-xs font-medium text-sky-600 dark:border-sky-500 dark:text-sky-400">via BI-Fast</span>
						{:else if exp.sourceType === 'transfer'}
							<span class="rounded-full border border-indigo-400 px-2 py-0.5 text-xs font-medium text-indigo-600 dark:border-indigo-500 dark:text-indigo-400">via Transfer</span>
						{:else if exp.sourceType === 'flazz'}
							<span class="rounded-full border border-blue-400 px-2 py-0.5 text-xs font-medium text-blue-600 dark:border-blue-500 dark:text-blue-400">via Flazz</span>
						{:else if exp.sourceType === 'autodebit'}
							<span class="rounded-full border border-emerald-400 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:border-emerald-500 dark:text-emerald-400">via Auto-debit</span>
						{/if}

						<!-- Category chip -->
						{#if cat}
							<span class="rounded-full px-2 py-0.5" style="background-color: {cat.color}22; color: {cat.color}">
								{cat.name}
							</span>
						{/if}
					</div>

					<!-- Tags row -->
					<div class="mt-1.5 flex flex-wrap items-center gap-1.5">
						{#each tagsFor(exp.id) as tag (tag!.id)}
							<span
								class="group flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
								style="background-color: {tag!.color}22; color: {tag!.color}"
							>
								{tag!.name}
								<button
									type="button"
									onclick={() => removeTag(tag!.id, exp.id)}
									class="opacity-50 transition hover:opacity-100"
									aria-label="Remove tag"
								>
									<XIcon class="h-3 w-3" />
								</button>
							</span>
						{/each}
						<TagPicker
							tags={data.tags}
							appliedIds={data.expenseTagMap[exp.id] ?? []}
							onToggle={(tagId) => {
								if ((data.expenseTagMap[exp.id] ?? []).includes(tagId)) removeTag(tagId, exp.id);
								else applyTag(tagId, [exp.id]);
							}}
							onCreate={(name, color) => createAndApply(name, color, [exp.id])}
						/>
					</div>
				</div>

				<!-- Amount -->
				<div class="shrink-0 text-right">
					<p class="text-base font-bold {isIncome ? 'text-emerald-600 dark:text-emerald-400' : 'text-card-foreground'}">
						{isIncome ? '+' : ''}{formatMoney(exp.amount, expCurrency)}
					</p>
					{#if exp.currencyId && exp.currencyId !== data.mainCurrency.id}
						<p class="text-xs text-muted-foreground">
							≈ {formatMoney(convertToMain(exp.amount, exp.currencyId, data.currencies, data.mainCurrency), data.mainCurrency)}
						</p>
					{/if}
				</div>

				<!-- Actions -->
				<DropdownMenu.Root>
					<DropdownMenu.Trigger>
						{#snippet child({ props })}
							<button
								{...props}
								class="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
							>
								<MoreHorizontal class="h-4 w-4" />
							</button>
						{/snippet}
					</DropdownMenu.Trigger>
					<DropdownMenu.Content align="end">
						<DropdownMenu.Item onclick={() => openEdit(exp)}>
							<Pencil class="mr-2 h-4 w-4" /> Edit
						</DropdownMenu.Item>
						<DropdownMenu.Separator />
						<form method="POST" action="?/delete" use:enhance>
							<input type="hidden" name="id" value={exp.id} />
							<DropdownMenu.Item>
								{#snippet child({ props })}
									<button {...props} type="submit" class="flex w-full items-center text-destructive">
										<Trash2 class="mr-2 h-4 w-4" /> Delete
									</button>
								{/snippet}
							</DropdownMenu.Item>
						</form>
					</DropdownMenu.Content>
				</DropdownMenu.Root>
			</div>
		{:else}
			<div class="rounded-2xl border border-dashed border-border bg-card py-16 text-center">
				<p class="text-muted-foreground">
					{search ? 'No expenses match your search.' : 'No expenses logged yet.'}
				</p>
				{#if !search}
					<button onclick={openAdd} class="mt-3 text-sm font-medium text-primary hover:underline">
						Log your first expense →
					</button>
				{/if}
			</div>
		{/each}
	</div>

	<!-- Spacer so the floating bar never covers the last row -->
	{#if selectedIds.size > 0}<div class="h-20"></div>{/if}
</div>

<!-- Floating bulk-action bar -->
{#if selectedIds.size > 0}
	<div class="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
		<div class="flex items-center gap-3 rounded-2xl border border-border bg-popover px-3 py-2.5 shadow-xl">
			<span class="pl-1 text-sm font-semibold text-card-foreground">{selectedIds.size} selected</span>
			<div class="h-5 w-px bg-border"></div>
			<TagPicker
				tags={data.tags}
				appliedIds={[]}
				align="left"
				label="Apply tag"
				onToggle={(tagId) => { applyTag(tagId, [...selectedIds]); clearSelection(); }}
				onCreate={(name, color) => { createAndApply(name, color, [...selectedIds]); clearSelection(); }}
			/>
			<button
				onclick={clearSelection}
				class="rounded-lg px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition hover:bg-accent"
			>
				Clear
			</button>
		</div>
	</div>
{/if}

<!-- Add/Edit Sheet -->
<Sheet.Root bind:open={sheetOpen}>
	<Sheet.Content side="right" class="w-full overflow-y-auto sm:max-w-md">
		<Sheet.Header>
			<Sheet.Title>{editing ? 'Edit expense' : 'New expense'}</Sheet.Title>
			<Sheet.Description>
				{editing ? 'Update the details for this expense.' : 'Log a one-off expense.'}
			</Sheet.Description>
		</Sheet.Header>

		<form
			method="POST"
			action={editing ? '?/update' : '?/create'}
			use:enhance={() => {
				return async ({ result, update }) => {
					if (result.type === 'success') {
						const expId = editing?.id ?? (result.data as any)?.id;
						const currentTags = new Set(data.expenseTagMap[expId] ?? []);

						// Remove tags that were unchecked
						for (const tagId of currentTags) {
							if (!editingTagIds.has(tagId)) {
								await postAction('removeTag', { tagId: String(tagId), expenseId: String(expId) });
							}
						}

						// Add tags that were checked
						for (const tagId of editingTagIds) {
							if (!currentTags.has(tagId)) {
								await postAction('applyTag', { tagId: String(tagId), expenseIds: String(expId) });
							}
						}

						sheetOpen = false;
						selectedIds = new Set();
					}
					update();
				};
			}}
			class="mt-6 flex flex-col gap-4 px-4 pb-8"
		>
			{#if editing}<input type="hidden" name="id" value={editing.id} />{/if}

			<label class="flex flex-col gap-1.5 text-sm font-medium">
				Name <span class="text-destructive">*</span>
				<input
					name="name"
					value={editing?.name ?? ''}
					required
					placeholder="Coffee"
					class="rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
				/>
			</label>

			<div class="grid grid-cols-2 gap-3">
				<label class="flex flex-col gap-1.5 text-sm font-medium">
					Amount <span class="text-destructive">*</span>
					<input
						name="amount"
						type="number"
						step="0.01"
						min="0"
						value={editing?.amount ?? ''}
						required
						placeholder="0.00"
						class="rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
					/>
				</label>
				<label class="flex flex-col gap-1.5 text-sm font-medium">
					Currency
					<select name="currencyId" class="rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50">
						{#each data.currencies as cur (cur.id)}
							<option value={cur.id} selected={cur.id === (editing?.currencyId ?? data.mainCurrency.id)}>
								{cur.code} ({cur.symbol})
							</option>
						{/each}
					</select>
				</label>
			</div>

			<div class="grid grid-cols-2 gap-3">
				<label class="flex flex-col gap-1.5 text-sm font-medium">
					Date <span class="text-destructive">*</span>
					<input
						name="date"
						type="date"
						value={editing?.date ?? ''}
						required
						class="rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
					/>
				</label>
				<label class="flex flex-col gap-1.5 text-sm font-medium">
					Category
					<select name="categoryId" class="rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50">
						<option value="">None</option>
						{#each data.categories as cat (cat.id)}
							<option value={cat.id} selected={cat.id === editing?.categoryId}>{cat.name}</option>
						{/each}
					</select>
				</label>
			</div>


			<!-- Tags -->
			<div class="flex flex-col gap-2 text-sm font-medium">
				Tags
				<div class="flex flex-wrap items-center gap-1.5">
					{#each data.tags as tag (tag.id)}
						{@const checked = editingTagIds.has(tag.id)}
						<label class="flex items-center gap-1.5 rounded-full px-2.5 py-1 transition cursor-pointer {checked ? 'bg-primary/15' : 'bg-muted hover:bg-muted/80'}">
							<input
								type="checkbox"
								checked={checked}
								onchange={(e) => {
									const next = new Set(editingTagIds);
									if (e.currentTarget.checked) next.add(tag.id);
									else next.delete(tag.id);
									editingTagIds = next;
								}}
								class="h-3.5 w-3.5 cursor-pointer accent-primary"
							/>
							<span class="text-xs" style={checked ? `color: ${tag.color}; font-weight: 500;` : ''}>{tag.name}</span>
						</label>
					{/each}
					<TagPicker
						tags={data.tags}
						appliedIds={[...editingTagIds]}
						label="Add"
						onToggle={(tagId) => {
							const next = new Set(editingTagIds);
							if (next.has(tagId)) next.delete(tagId);
							else next.add(tagId);
							editingTagIds = next;
						}}
						onCreate={(name, color) => {
							postAction('createTag', { name, color }).then(() => {
								const created = data.tags.find((t) => t.name.toLowerCase() === name.toLowerCase());
								if (created) {
									const next = new Set(editingTagIds);
									next.add(created.id);
									editingTagIds = next;
								}
							});
						}}
					/>
				</div>
			</div>

			<label class="flex flex-col gap-1.5 text-sm font-medium">
				Notes
				<textarea
					name="notes"
					value={editing?.notes ?? ''}
					rows="2"
					placeholder="Optional notes..."
					class="resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
				></textarea>
			</label>

			{#if editing?.importRef}
				{@const filename = importFilename(editing.importRef)}
				<div class="flex flex-col gap-1.5 text-sm font-medium">
					Import source
					<div class="flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
						<svg class="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/>
						</svg>
						<span class="truncate">{filename ?? editing.importRef}</span>
					</div>
				</div>
			{/if}

			<div class="flex gap-3 pt-2">
				<button
					type="submit"
					class="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
				>
					{editing ? 'Save changes' : 'Add expense'}
				</button>
				<button
					type="button"
					onclick={() => (sheetOpen = false)}
					class="rounded-xl border border-border px-4 py-2.5 text-sm font-medium transition hover:bg-accent"
				>
					Cancel
				</button>
			</div>
		</form>
	</Sheet.Content>
</Sheet.Root>
