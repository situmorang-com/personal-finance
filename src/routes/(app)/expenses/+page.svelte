<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { convertToMain, formatMoney } from '$lib/currency';
	import { hashColor } from '$lib/color';
	import BCABadge from '$lib/components/BCABadge.svelte';
	import TagPicker from '$lib/components/TagPicker.svelte';
	import Donut from '$lib/components/Donut.svelte';
	import * as Sheet from '$lib/components/ui/sheet/index.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import MoreHorizontal from '@lucide/svelte/icons/ellipsis';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import SearchIcon from '@lucide/svelte/icons/search';
	import SparklesIcon from '@lucide/svelte/icons/sparkles';
	import XIcon from '@lucide/svelte/icons/x';
	import SlidersHorizontal from '@lucide/svelte/icons/sliders-horizontal';
	import ArrowUpIcon from '@lucide/svelte/icons/arrow-up';
	import ArrowDownIcon from '@lucide/svelte/icons/arrow-down';
	import CalendarIcon from '@lucide/svelte/icons/calendar';
	import DownloadIcon from '@lucide/svelte/icons/download';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import CheckSquareIcon from '@lucide/svelte/icons/square-check';

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

	// ── Category filter ──────────────────────────────────────────────────────
	let filterCategoryId = $state<number | null>(null);

	// ── Direction filter (all / expense / income) ───────────────────────────
	let directionFilter = $state<'all' | 'expense' | 'income'>('all');

	// ── Date range filter ────────────────────────────────────────────────────
	type DatePreset = 'all' | 'thisMonth' | 'lastMonth' | 'last7' | 'last30' | 'custom';
	let datePreset = $state<DatePreset>('all');
	let customFrom = $state('');
	let customTo = $state('');
	let dateMenuOpen = $state(false);

	function isoDaysAgo(n: number) {
		return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
	}

	const dateRange = $derived.by((): { from: string | null; to: string | null } => {
		const now = new Date();
		const thisYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
		const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
		const prevYM = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

		switch (datePreset) {
			case 'thisMonth': return { from: `${thisYM}-01`, to: null };
			case 'lastMonth': {
				const lastDay = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
				return { from: `${prevYM}-01`, to: `${prevYM}-${String(lastDay).padStart(2, '0')}` };
			}
			case 'last7': return { from: isoDaysAgo(6), to: null };
			case 'last30': return { from: isoDaysAgo(29), to: null };
			case 'custom': return { from: customFrom || null, to: customTo || null };
			default: return { from: null, to: null };
		}
	});

	const dateRangeLabel = $derived.by(() => {
		switch (datePreset) {
			case 'thisMonth': return 'This month';
			case 'lastMonth': return 'Last month';
			case 'last7': return 'Last 7 days';
			case 'last30': return 'Last 30 days';
			case 'custom': return customFrom && customTo ? `${customFrom} → ${customTo}` : 'Custom range';
			default: return null;
		}
	});

	// ── Toast / undo ─────────────────────────────────────────────────────────
	let toast = $state<{ message: string; undo?: () => void } | null>(null);
	let toastTimer: ReturnType<typeof setTimeout> | null = null;

	function showToast(message: string, undo?: () => void) {
		if (toastTimer) clearTimeout(toastTimer);
		toast = { message, undo };
		toastTimer = setTimeout(() => (toast = null), 5000);
	}

	// ── Pagination ───────────────────────────────────────────────────────────
	const PAGE_SIZE = 50;
	let visibleCount = $state(PAGE_SIZE);

	function selectCategory(catName: string) {
		const cat = data.categories.find((c) => c.name === catName);
		if (!cat) return;
		filterCategoryId = filterCategoryId === cat.id ? null : cat.id;
	}

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

	function toggleSelectAll(ids: number[]) {
		const allSelected = ids.every((id) => selectedIds.has(id));
		const next = new Set(selectedIds);
		if (allSelected) for (const id of ids) next.delete(id);
		else for (const id of ids) next.add(id);
		selectedIds = next;
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

	// ── Delete with undo ─────────────────────────────────────────────────────
	function restoreFields(exp: Exp): Record<string, string> {
		return {
			name: exp.name,
			amount: String(exp.amount),
			date: exp.date,
			categoryId: exp.categoryId ? String(exp.categoryId) : '',
			currencyId: exp.currencyId ? String(exp.currencyId) : '',
			direction: exp.direction,
			sourceType: exp.sourceType ?? 'manual',
			recipient: exp.recipient ?? '',
			remark: exp.remark ?? '',
			notes: exp.notes ?? '',
			importRef: exp.importRef ?? ''
		};
	}

	async function deleteExpense(exp: Exp) {
		await postAction('delete', { id: String(exp.id) });
		showToast(`Deleted "${exp.name}".`, () => postAction('restore', restoreFields(exp)));
	}

	async function bulkDelete() {
		const toDelete = data.expenses.filter((e) => selectedIds.has(e.id));
		const ids = [...selectedIds].join(',');
		clearSelection();
		await postAction('bulkDelete', { ids });
		showToast(`Deleted ${toDelete.length} transaction${toDelete.length !== 1 ? 's' : ''}.`, async () => {
			busy = true;
			for (const exp of toDelete) {
				const fd = new FormData();
				for (const [k, v] of Object.entries(restoreFields(exp))) fd.append(k, v);
				await fetch('?/restore', { method: 'POST', body: fd });
			}
			await invalidateAll();
			busy = false;
		});
	}

	function bulkSetCategory(categoryId: number) {
		const ids = [...selectedIds].join(',');
		clearSelection();
		postAction('bulkSetCategory', { ids, categoryId: String(categoryId) });
	}

	async function duplicateExpense(exp: Exp) {
		await postAction('duplicate', { id: String(exp.id) });
		showToast(`Duplicated "${exp.name}" with today's date.`);
	}

	// ── CSV export ───────────────────────────────────────────────────────────
	function exportCsv() {
		const rows = [
			['Date', 'Name', 'Amount', 'Currency', 'Direction', 'Category', 'Tags', 'Remark', 'Notes']
		];
		for (const exp of sorted) {
			const cat = data.categories.find((c) => c.id === exp.categoryId);
			const expCurrency = data.currencies.find((c) => c.id === exp.currencyId);
			const tagNames = tagsFor(exp.id).map((t) => t!.name).join('; ');
			rows.push([
				exp.date, exp.name, String(exp.amount), expCurrency?.code ?? '',
				exp.direction, cat?.name ?? '', tagNames, exp.remark ?? '', exp.notes ?? ''
			]);
		}
		const csv = rows.map((r) => r.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n');
		const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `expenses-${new Date().toISOString().slice(0, 10)}.csv`;
		a.click();
		URL.revokeObjectURL(url);
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
		data.expenses.filter((e) => {
			if (search) {
				const q = search.toLowerCase();
				const matchesName = e.name.toLowerCase().includes(q);
				const matchesRemark = e.remark?.toLowerCase().includes(q) ?? false;
				const matchesAmount = String(e.amount).includes(q);
				if (!matchesName && !matchesRemark && !matchesAmount) return false;
			}
			if (filterCategoryId !== null && e.categoryId !== filterCategoryId) return false;
			if (directionFilter !== 'all' && e.direction !== directionFilter) return false;
			if (dateRange.from && e.date < dateRange.from) return false;
			if (dateRange.to && e.date > dateRange.to) return false;
			return true;
		})
	);

	const filterCategoryName = $derived(
		filterCategoryId !== null ? data.categories.find((c) => c.id === filterCategoryId)?.name ?? null : null
	);

	// ── Sort & Group ─────────────────────────────────────────────────────────
	type SortField = 'date' | 'amount' | 'name';
	type GroupBy = 'none' | 'date' | 'category' | 'month';

	let sortField = $state<SortField>('date');
	let sortDir = $state<'asc' | 'desc'>('desc');
	let groupBy = $state<GroupBy>('none');
	let sortPanelOpen = $state(false);

	const isNonDefault = $derived(sortField !== 'date' || sortDir !== 'desc' || groupBy !== 'none');

	function toggleSort(field: SortField) {
		if (sortField === field) sortDir = sortDir === 'desc' ? 'asc' : 'desc';
		else { sortField = field; sortDir = field === 'date' ? 'desc' : 'asc'; }
	}

	const sorted = $derived.by(() => {
		const arr = [...filtered];
		arr.sort((a, b) => {
			let cmp = 0;
			if (sortField === 'date') cmp = a.date.localeCompare(b.date);
			else if (sortField === 'amount') {
				const aAmt = convertToMain(a.amount, a.currencyId, data.currencies, data.mainCurrency);
				const bAmt = convertToMain(b.amount, b.currencyId, data.currencies, data.mainCurrency);
				cmp = aAmt - bAmt;
			} else cmp = a.name.localeCompare(b.name);
			return sortDir === 'asc' ? cmp : -cmp;
		});
		return arr;
	});

	// Reset pagination whenever the active filter/sort set changes
	$effect(() => {
		sorted;
		visibleCount = PAGE_SIZE;
	});

	const visible = $derived(sorted.slice(0, visibleCount));
	const hasMore = $derived(sorted.length > visibleCount);

	type Group = { key: string; label: string; color?: string; items: typeof sorted; total: number; income: number };

	const grouped = $derived.by(() => {
		if (groupBy === 'none') return [{ key: 'all', label: '', color: undefined, items: visible, total: 0, income: 0 }];

		const map = new Map<string, Group>();

		const today = new Date().toISOString().slice(0, 10);
		const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
		const weekAgo = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
		const thisMonthYM = today.slice(0, 7);
		const prevDate = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);
		const prevMonthYM = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

		for (const exp of visible) {
			let key: string;
			let label: string;
			let color: string | undefined;

			if (groupBy === 'date') {
				if (exp.date === today)          { key = '0-today';     label = 'Today'; }
				else if (exp.date === yesterday) { key = '1-yesterday'; label = 'Yesterday'; }
				else if (exp.date >= weekAgo)    { key = '2-thisweek';  label = 'This week'; }
				else if (exp.date.startsWith(thisMonthYM)) { key = '3-thismonth'; label = 'This month'; }
				else if (exp.date.startsWith(prevMonthYM)) { key = '4-lastmonth'; label = 'Last month'; }
				else { key = '5-' + exp.date.slice(0, 7); label = new Date(exp.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' }); }
			} else if (groupBy === 'month') {
				key = exp.date.slice(0, 7);
				label = new Date(exp.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
			} else {
				const cat = data.categories.find((c) => c.id === exp.categoryId);
				key = cat ? String(cat.id) : 'z-uncategorized';
				label = cat?.name ?? 'Uncategorized';
				color = cat?.color;
			}

			if (!map.has(key)) map.set(key, { key, label, color, items: [], total: 0, income: 0 });
			const g = map.get(key)!;
			g.items.push(exp);
			const amt = convertToMain(exp.amount, exp.currencyId, data.currencies, data.mainCurrency);
			if (exp.direction === 'income') g.income += amt;
			else g.total += amt;
		}

		return [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
	});

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
			class="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 hover:glow-primary"
		>
			<PlusIcon class="h-4 w-4" />
			New Expense
		</button>
	</div>

	<!-- ── Expense dashboard ────────────────────────────────────────────── -->
	{#if data.insights}
	{@const ins = data.insights}
	{@const vsLast = ins.lastMonth.total > 0 ? Math.round(((ins.thisMonth.total - ins.lastMonth.total) / ins.lastMonth.total) * 100) : null}

	<!-- Donut (left) + stat cards stacked (right) -->
	{@const filterCat = filterCategoryId !== null ? data.categories.find((c) => c.id === filterCategoryId) : null}
	<div class="flex gap-3">
		<!-- Spending by category donut -->
		{#if ins.categorySlices.length > 0}
			<div class="glass-card glass-card-hover shrink-0 rounded-2xl p-5 drop-shadow-[0_0_24px_rgba(99,102,241,0.08)]">
				<div class="mb-3 flex items-center justify-between gap-4">
					<p class="text-sm font-semibold text-card-foreground">Spending by category</p>
					{#if filterCategoryId !== null}
						<button
							onclick={() => (filterCategoryId = null)}
							class="flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent"
						>
							<XIcon class="h-3 w-3" /> Clear
						</button>
					{/if}
				</div>
				<Donut
					slices={ins.categorySlices}
					size={140}
					thickness={20}
					centerLabel={filterCategoryId !== null ? filterCat?.name : 'total'}
					centerValue={filterCategoryId !== null
						? formatMoney(ins.categorySlices.find((s) => s.label === filterCat?.name)?.value ?? 0, data.mainCurrency)
						: formatMoney(ins.thisMonth.total, data.mainCurrency)}
					formatValue={(v) => formatMoney(v, data.mainCurrency)}
					onSelect={selectCategory}
					selectedLabel={filterCat?.name ?? null}
				/>
			</div>
		{/if}

		<!-- 4 stat cards stacked -->
		<div class="flex min-w-0 flex-1 flex-col gap-3">
			<div class="glass-card glass-card-hover flex flex-1 items-center justify-between rounded-2xl px-4 py-3">
				<p class="text-xs text-muted-foreground">Spent this month</p>
				<div class="flex items-baseline gap-2">
					<p class="tabular text-base font-bold text-card-foreground">{formatMoney(ins.thisMonth.total, data.mainCurrency)}</p>
					{#if vsLast !== null}
						<span class="text-xs font-medium {vsLast > 0 ? 'text-rose-500' : 'text-emerald-500'}">
							{vsLast > 0 ? '▲' : '▼'}{Math.abs(vsLast)}%
						</span>
					{/if}
				</div>
			</div>
			<div class="glass-card glass-card-hover flex flex-1 items-center justify-between rounded-2xl px-4 py-3">
				<p class="text-xs text-muted-foreground">Income received</p>
				<div class="flex items-baseline gap-2">
					<p class="tabular text-base font-bold text-emerald-600 dark:text-emerald-400">{formatMoney(ins.thisMonth.income, data.mainCurrency)}</p>
					<span class="text-xs font-medium {ins.thisMonth.income >= ins.thisMonth.total ? 'text-emerald-500' : 'text-rose-500'}">
						Net {ins.thisMonth.income >= ins.thisMonth.total ? '+' : '-'}{formatMoney(Math.abs(ins.thisMonth.income - ins.thisMonth.total), data.mainCurrency)}
					</span>
				</div>
			</div>
			<div class="glass-card glass-card-hover flex flex-1 items-center justify-between rounded-2xl px-4 py-3">
				<p class="text-xs text-muted-foreground">Daily average</p>
				<div class="flex items-baseline gap-2">
					<p class="tabular text-base font-bold text-card-foreground">{formatMoney(ins.thisMonth.dailyAvg, data.mainCurrency)}</p>
					<span class="text-xs text-muted-foreground">{ins.thisMonth.txnCount} txns</span>
				</div>
			</div>
			<div class="glass-card glass-card-hover flex flex-1 items-center justify-between rounded-2xl px-4 py-3">
				<p class="text-xs text-muted-foreground">Top category</p>
				{#if ins.topCategory}
					<div class="flex items-baseline gap-2">
						<p class="text-base font-bold" style="color: {ins.topCategory.color}">{ins.topCategory.name}</p>
						<span class="text-xs text-muted-foreground">{ins.topCategory.pct}%</span>
					</div>
				{:else}
					<p class="text-base font-bold text-muted-foreground">—</p>
				{/if}
			</div>
		</div>
	</div>

	<!-- Budgets -->
	{#if ins.budgets.length > 0}
		<div class="glass-card rounded-2xl p-5">
			<p class="mb-4 text-sm font-semibold text-card-foreground">Budgets this month</p>
			<div class="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
				{#each ins.budgets as b (b.categoryId)}
					{@const barColor = b.pct >= 100 ? '#f43f5e' : b.pct >= 80 ? '#fbbf24' : b.color}
					<div>
						<div class="mb-1 flex items-center justify-between text-sm">
							<span class="font-medium" style="color: {b.color}">{b.name}</span>
							<span class="tabular text-xs {b.pct >= 100 ? 'font-semibold text-rose-500' : 'text-muted-foreground'}">
								{formatMoney(b.spent, data.mainCurrency)} / {formatMoney(b.budget, data.mainCurrency)}
							</span>
						</div>
						<div class="h-2 w-full overflow-hidden rounded-full bg-muted/60">
							<div
								class="h-full rounded-full transition-all"
								style="width: {Math.min(b.pct, 100)}%; background-color: {barColor}; box-shadow: 0 0 8px 0 {barColor}88;"
							></div>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Insight cards row — always 3 cols -->
	<div class="grid grid-cols-3 gap-3">

		<!-- Biggest expense -->
		<div class="glass-card glass-card-hover rounded-2xl p-4">
			<p class="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
				<span class="text-base">💸</span> Biggest expense
			</p>
			{#if ins.biggestExpense}
				<p class="truncate font-semibold text-card-foreground">{ins.biggestExpense.name}</p>
				<p class="tabular mt-0.5 text-xl font-bold text-rose-500">{formatMoney(ins.biggestExpense.amount, data.mainCurrency)}</p>
				<p class="mt-1 text-xs text-muted-foreground">{ins.biggestExpense.date}</p>
			{:else}
				<p class="text-sm text-muted-foreground">—</p>
			{/if}
		</div>

		<!-- Anomalies -->
		<div class="glass-card glass-card-hover rounded-2xl p-4
			{ins.anomalies.length > 0 ? 'drop-shadow-[0_0_18px_rgba(245,158,11,0.12)]' : ''}">
			<p class="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide
				{ins.anomalies.length > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}">
				<span class="text-base">⚠️</span> Spending spike
			</p>
			{#if ins.anomalies.length > 0}
				{#each ins.anomalies as a (a.categoryName)}
					<div class="mb-2 last:mb-0">
						<div class="flex items-center justify-between">
							<span class="text-sm font-semibold" style="color: {a.color}">{a.categoryName}</span>
							<span class="tabular text-sm font-bold text-amber-600 dark:text-amber-400">+{a.pctChange}%</span>
						</div>
						<p class="tabular text-xs text-muted-foreground">{formatMoney(a.lastMonth, data.mainCurrency)} → {formatMoney(a.thisMonth, data.mainCurrency)}</p>
					</div>
				{/each}
			{:else}
				<p class="text-sm text-muted-foreground">No spikes this month</p>
			{/if}
		</div>

		<!-- New recurring -->
		<div class="glass-card glass-card-hover rounded-2xl p-4
			{ins.newRecurring.length > 0 ? 'drop-shadow-[0_0_18px_rgba(99,102,241,0.12)]' : ''}">
			<p class="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide
				{ins.newRecurring.length > 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-muted-foreground'}">
				<span class="text-base">🔄</span> New recurring
			</p>
			{#if ins.newRecurring.length > 0}
				{#each ins.newRecurring as r (r.name)}
					<div class="mb-2 last:mb-0">
						<p class="truncate text-sm font-semibold text-card-foreground">{r.name}</p>
						<p class="tabular text-xs text-muted-foreground">{r.count}× · avg {formatMoney(r.avgAmount, data.mainCurrency)}</p>
					</div>
				{/each}
			{:else}
				<p class="text-sm text-muted-foreground">No new recurring</p>
			{/if}
		</div>

	</div>
	{/if}

	{#if form?.error}
		<p class="rounded-xl bg-destructive/10 px-4 py-2.5 text-sm text-destructive">{form.error}</p>
	{/if}

	{#if uploadMessage}
		<p class="rounded-xl bg-primary/10 px-4 py-2.5 text-sm text-primary">{uploadMessage}</p>
	{/if}

	<!-- BCA Statement Upload + Batch Manager -->
	<div class="glass-card rounded-2xl">
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

	<div class="flex flex-wrap items-center gap-2">
		<!-- Search -->
		<div class="relative">
			<SearchIcon class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
			<input
				bind:value={search}
				placeholder="Search expenses..."
				class="w-full rounded-xl border border-border bg-background py-2.5 pl-9 pr-4 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 sm:max-w-xs"
			/>
		</div>

		<!-- Sort & Group button -->
		<div class="relative">
			<button
				onclick={() => (sortPanelOpen = !sortPanelOpen)}
				class="relative flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition
					{sortPanelOpen ? 'border-primary bg-primary/5 text-primary' : 'border-border bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground'}"
			>
				<SlidersHorizontal class="h-4 w-4" />
				<span>Sort & Group</span>
				{#if isNonDefault}
					<span class="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-amber-400 ring-2 ring-background"></span>
				{/if}
			</button>

			{#if sortPanelOpen}
				<!-- Backdrop -->
				<button
					class="fixed inset-0 z-30"
					onclick={() => (sortPanelOpen = false)}
					aria-label="Close panel"
				></button>

				<!-- Panel -->
				<div class="absolute left-0 top-full z-40 mt-2 w-72 rounded-2xl border border-white/10 bg-popover/80 p-4 shadow-xl backdrop-blur-xl dark:border-white/10">
					<div class="grid grid-cols-2 gap-4">
						<!-- Sort column -->
						<div>
							<p class="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Sort by</p>
							<div class="space-y-0.5">
								{#each ([['date', 'Date'], ['amount', 'Amount'], ['name', 'Name']] as const) as [field, label]}
									<button
										onclick={() => toggleSort(field)}
										class="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-sm transition
											{sortField === field ? 'bg-primary/10 font-semibold text-primary' : 'text-card-foreground hover:bg-accent'}"
									>
										<span>{label}</span>
										{#if sortField === field}
											{#if sortDir === 'desc'}
												<ArrowDownIcon class="h-3.5 w-3.5" />
											{:else}
												<ArrowUpIcon class="h-3.5 w-3.5" />
											{/if}
										{/if}
									</button>
								{/each}
							</div>
						</div>

						<!-- Group column -->
						<div>
							<p class="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Group by</p>
							<div class="space-y-0.5">
								{#each ([['none', 'None'], ['date', 'Date'], ['month', 'Month'], ['category', 'Category']] as const) as [g, label]}
									<button
										onclick={() => (groupBy = g)}
										class="flex w-full items-center rounded-lg px-2.5 py-1.5 text-sm transition
											{groupBy === g ? 'bg-primary/10 font-semibold text-primary' : 'text-card-foreground hover:bg-accent'}"
									>
										{label}
									</button>
								{/each}
							</div>
						</div>
					</div>

					{#if isNonDefault}
						<div class="mt-3 border-t border-border pt-3">
							<button
								onclick={() => { sortField = 'date'; sortDir = 'desc'; groupBy = 'none'; }}
								class="text-xs text-muted-foreground hover:text-foreground transition"
							>Reset to defaults</button>
						</div>
					{/if}
				</div>
			{/if}
		</div>

		<!-- Date range button -->
		<div class="relative">
			<button
				onclick={() => (dateMenuOpen = !dateMenuOpen)}
				class="relative flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition
					{datePreset !== 'all' ? 'border-primary bg-primary/5 text-primary' : 'border-border bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground'}"
			>
				<CalendarIcon class="h-4 w-4" />
				<span>{dateRangeLabel ?? 'All time'}</span>
			</button>

			{#if dateMenuOpen}
				<button class="fixed inset-0 z-30" onclick={() => (dateMenuOpen = false)} aria-label="Close panel"></button>
				<div class="absolute left-0 top-full z-40 mt-2 w-56 rounded-2xl border border-white/10 bg-popover/80 p-2 shadow-xl backdrop-blur-xl">
					{#each ([['all', 'All time'], ['thisMonth', 'This month'], ['lastMonth', 'Last month'], ['last7', 'Last 7 days'], ['last30', 'Last 30 days']] as const) as [preset, label]}
						<button
							onclick={() => { datePreset = preset; dateMenuOpen = false; }}
							class="flex w-full items-center rounded-lg px-2.5 py-1.5 text-sm transition
								{datePreset === preset ? 'bg-primary/10 font-semibold text-primary' : 'text-card-foreground hover:bg-accent'}"
						>{label}</button>
					{/each}
					<div class="mt-1 border-t border-border pt-2">
						<p class="px-2.5 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Custom range</p>
						<div class="flex items-center gap-1.5 px-2.5">
							<input type="date" bind:value={customFrom} class="min-w-0 flex-1 rounded-lg border border-input bg-background px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-ring/50" />
							<span class="text-xs text-muted-foreground">→</span>
							<input type="date" bind:value={customTo} class="min-w-0 flex-1 rounded-lg border border-input bg-background px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-ring/50" />
						</div>
						<button
							onclick={() => { if (customFrom && customTo) { datePreset = 'custom'; dateMenuOpen = false; } }}
							disabled={!customFrom || !customTo}
							class="mt-1.5 w-full rounded-lg bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-40"
						>Apply</button>
					</div>
				</div>
			{/if}
		</div>

		<!-- Direction toggle -->
		<div class="flex overflow-hidden rounded-xl border border-border text-sm">
			{#each ([['all', 'All'], ['expense', 'Expenses'], ['income', 'Income']] as const) as [dir, label]}
				<button
					onclick={() => (directionFilter = dir)}
					class="px-3 py-2 font-medium transition {directionFilter === dir ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-accent'}"
				>{label}</button>
			{/each}
		</div>

		<!-- Active category filter chip -->
		{#if filterCategoryName}
			{@const filterCat2 = data.categories.find((c) => c.id === filterCategoryId)}
			<button
				onclick={() => (filterCategoryId = null)}
				class="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition hover:opacity-80"
				style="background-color: {filterCat2?.color ?? '#64748b'}22; color: {filterCat2?.color ?? '#64748b'}"
			>
				{filterCategoryName}
				<XIcon class="h-3 w-3" />
			</button>
		{/if}

		<!-- CSV export -->
		<button
			onclick={exportCsv}
			title="Export filtered transactions to CSV"
			class="ml-auto flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-accent hover:text-accent-foreground"
		>
			<DownloadIcon class="h-4 w-4" />
			<span class="hidden sm:inline">Export CSV</span>
		</button>
	</div>

	<!-- Select all -->
	{#if sorted.length > 0}
		<button
			onclick={() => toggleSelectAll(sorted.map((e) => e.id))}
			class="flex items-center gap-2 px-1 text-xs font-medium text-muted-foreground transition hover:text-foreground"
		>
			<CheckSquareIcon class="h-3.5 w-3.5" />
			{sorted.every((e) => selectedIds.has(e.id)) ? 'Deselect all' : `Select all ${sorted.length}`}
		</button>
	{/if}

	<div class="space-y-2">
		{#each grouped as group (group.key)}
			{#if groupBy !== 'none' && group.label}
				<div class="flex items-center gap-3 px-1 pt-3 first:pt-0">
					<div class="flex items-center gap-2">
						{#if group.color}
							<span class="h-2 w-2 rounded-full" style="background-color: {group.color}"></span>
						{/if}
						<span class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.label}</span>
					</div>
					<div class="h-px flex-1 bg-border"></div>
					<div class="flex items-center gap-2 text-xs text-muted-foreground">
						<span>{group.items.length} txn{group.items.length !== 1 ? 's' : ''}</span>
						{#if group.total > 0}
							<span class="font-medium text-card-foreground">−{formatMoney(group.total, data.mainCurrency)}</span>
						{/if}
						{#if group.income > 0}
							<span class="font-medium text-emerald-600">+{formatMoney(group.income, data.mainCurrency)}</span>
						{/if}
					</div>
				</div>
			{/if}
		{#each group.items as exp (exp.id)}
			{@const cat = data.categories.find((c) => c.id === exp.categoryId)}
			{@const expCurrency = data.currencies.find((c) => c.id === exp.currencyId)}
			{@const bcaType = bcaCardType(exp.importRef)}
			{@const isIncome = exp.direction === 'income'}
			<div class="flex items-center gap-3 rounded-2xl border bg-card/80 px-3.5 py-2.5 shadow-sm transition-all duration-200 hover:bg-card hover:shadow-md sm:px-4 sm:py-3
				{selectedIds.has(exp.id) ? 'border-primary ring-1 ring-primary/30 glow-primary' : 'border-border'}
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
					<BCABadge type={bcaType} size={36} />
				{:else}
					<div
						class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white"
						style="background-color: {cat?.color ?? hashColor(exp.name)}"
					>
						{exp.name.charAt(0).toUpperCase()}
					</div>
				{/if}

				<!-- Info -->
				<div class="min-w-0 flex-1">
					<!-- Name + optional remark -->
					<div class="flex items-baseline gap-1.5">
						<p class="truncate font-semibold leading-tight text-card-foreground">{exp.name}</p>
						{#if exp.remark}
							<p class="shrink-0 truncate text-xs italic text-muted-foreground">"{exp.remark}"</p>
						{/if}
					</div>

					<!-- Single meta row: date · source · category · tags · +Tag -->
					<div class="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
						<span class="text-muted-foreground">{exp.date}</span>

						{#if exp.sourceType === 'qr'}
							<span class="rounded-full border border-violet-400 px-1.5 py-px font-medium text-violet-600 dark:border-violet-500 dark:text-violet-400">via QR</span>
						{:else if exp.sourceType === 'biffast'}
							<span class="rounded-full border border-sky-400 px-1.5 py-px font-medium text-sky-600 dark:border-sky-500 dark:text-sky-400">via BI-Fast</span>
						{:else if exp.sourceType === 'transfer'}
							<span class="rounded-full border border-indigo-400 px-1.5 py-px font-medium text-indigo-600 dark:border-indigo-500 dark:text-indigo-400">via Transfer</span>
						{:else if exp.sourceType === 'flazz'}
							<span class="rounded-full border border-blue-400 px-1.5 py-px font-medium text-blue-600 dark:border-blue-500 dark:text-blue-400">via Flazz</span>
						{:else if exp.sourceType === 'autodebit'}
							<span class="rounded-full border border-emerald-400 px-1.5 py-px font-medium text-emerald-600 dark:border-emerald-500 dark:text-emerald-400">via Auto-debit</span>
						{/if}

						{#if cat}
							<button
								type="button"
								onclick={() => { filterCategoryId = filterCategoryId === cat!.id ? null : cat!.id; }}
								class="rounded-full px-1.5 py-px transition hover:ring-1 hover:ring-current
									{filterCategoryId === cat.id ? 'ring-1 ring-current' : ''}"
								style="background-color: {cat.color}22; color: {cat.color}"
							>{cat.name}</button>
						{/if}

						{#each tagsFor(exp.id) as tag (tag!.id)}
							<span
								class="flex items-center gap-0.5 rounded-full px-1.5 py-px font-medium"
								style="background-color: {tag!.color}22; color: {tag!.color}"
							>
								{tag!.name}
								<button
									type="button"
									onclick={() => removeTag(tag!.id, exp.id)}
									class="opacity-40 transition hover:opacity-100"
									aria-label="Remove tag"
								><XIcon class="h-2.5 w-2.5" /></button>
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
					<p class="tabular text-base font-bold {isIncome ? 'text-emerald-600 dark:text-emerald-400' : 'text-card-foreground'}">
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
						<DropdownMenu.Item onclick={() => duplicateExpense(exp)}>
							<CopyIcon class="mr-2 h-4 w-4" /> Duplicate
						</DropdownMenu.Item>
						<DropdownMenu.Separator />
						<DropdownMenu.Item
							onclick={() => { if (confirm(`Delete "${exp.name}"?`)) deleteExpense(exp); }}
						>
							{#snippet child({ props })}
								<button {...props} type="button" class="flex w-full items-center text-destructive">
									<Trash2 class="mr-2 h-4 w-4" /> Delete
								</button>
							{/snippet}
						</DropdownMenu.Item>
					</DropdownMenu.Content>
				</DropdownMenu.Root>
			</div>
		{/each}
		{/each}

		{#if sorted.length === 0}
			<div class="rounded-2xl border border-dashed border-border bg-card py-16 text-center">
				<p class="text-muted-foreground">
					{search || filterCategoryId ? 'No expenses match your filters.' : 'No expenses logged yet.'}
				</p>
				{#if !search && !filterCategoryId}
					<button onclick={openAdd} class="mt-3 text-sm font-medium text-primary hover:underline">
						Log your first expense →
					</button>
				{/if}
			</div>
		{/if}

		{#if hasMore}
			<button
				onclick={() => (visibleCount += PAGE_SIZE)}
				class="w-full rounded-2xl border border-dashed border-border bg-card py-3 text-sm font-medium text-muted-foreground transition hover:bg-accent hover:text-accent-foreground"
			>
				Show {Math.min(PAGE_SIZE, sorted.length - visibleCount)} more ({sorted.length - visibleCount} remaining)
			</button>
		{/if}
	</div>

	<!-- Spacer so the floating bar never covers the last row -->
	{#if selectedIds.size > 0}<div class="h-20"></div>{/if}
</div>

<!-- Floating bulk-action bar -->
{#if selectedIds.size > 0}
	<div class="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
		<div class="flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-popover/85 px-3 py-2.5 shadow-xl backdrop-blur-xl glow-primary">
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

			<!-- Bulk re-categorize -->
			<div class="relative">
				<select
					onchange={(e) => { const v = Number(e.currentTarget.value); if (v) bulkSetCategory(v); e.currentTarget.value = ''; }}
					class="rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm text-card-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
				>
					<option value="">Set category…</option>
					{#each data.categories as cat (cat.id)}
						<option value={cat.id}>{cat.name}</option>
					{/each}
				</select>
			</div>

			<button
				onclick={() => { if (confirm(`Delete ${selectedIds.size} transaction${selectedIds.size > 1 ? 's' : ''}?`)) bulkDelete(); }}
				class="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-destructive transition hover:bg-destructive/10"
			>
				<Trash2 class="h-3.5 w-3.5" /> Delete
			</button>

			<button
				onclick={clearSelection}
				class="rounded-lg px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition hover:bg-accent"
			>
				Clear
			</button>
		</div>
	</div>
{/if}

<!-- Toast -->
{#if toast}
	<div class="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
		<div class="flex items-center gap-3 rounded-2xl border border-white/10 bg-popover/85 px-4 py-2.5 shadow-xl backdrop-blur-xl">
			<span class="text-sm text-card-foreground">{toast.message}</span>
			{#if toast.undo}
				<button
					onclick={() => { toast?.undo?.(); toast = null; }}
					class="text-sm font-semibold text-primary hover:underline"
				>Undo</button>
			{/if}
			<button onclick={() => (toast = null)} class="text-muted-foreground hover:text-foreground" aria-label="Dismiss">
				<XIcon class="h-3.5 w-3.5" />
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
