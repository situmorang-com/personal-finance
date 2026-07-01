<script lang="ts">
	import { enhance } from '$app/forms';
	import { convertToMain, formatMoney, formatMoneyCompact } from '$lib/currency';
	import { hashColor } from '$lib/color';
	import Logo from '$lib/components/Logo.svelte';
	import Donut from '$lib/components/Donut.svelte';
	import Gauge from '$lib/components/Gauge.svelte';
	import Sparkline from '$lib/components/Sparkline.svelte';
	import { countUp } from '$lib/actions/countUp';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Check from '@lucide/svelte/icons/check';

	let { data } = $props();

	let editingBudget = $state(false);
	let budgetInput = $state('');

	function toMain(amount: number, currencyId: number | null) {
		return convertToMain(amount, currencyId, data.currencies, data.mainCurrency);
	}

	function monthlyCost(price: number, cycle: string) {
		switch (cycle) {
			case 'yearly': return price / 12;
			case 'weekly': return (price * 52) / 12;
			case 'quarterly': return price / 3;
			default: return price;
		}
	}

	const activeSubs = $derived(data.subscriptions.filter((s) => s.active));
	const inactiveSubs = $derived(data.subscriptions.filter((s) => !s.active));

	const monthlySubTotal = $derived(
		activeSubs.reduce((sum, s) => sum + toMain(monthlyCost(s.price, s.billingCycle), s.currencyId), 0)
	);
	const yearlySubTotal = $derived(monthlySubTotal * 12);

	const monthlySavings = $derived(
		inactiveSubs.reduce((sum, s) => sum + toMain(monthlyCost(s.price, s.billingCycle), s.currencyId), 0)
	);
	const yearlySavings = $derived(monthlySavings * 12);

	const now = new Date();
	const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

	const monthExpenses = $derived(data.expenses.filter((e) => e.date.startsWith(monthKey)));
	const monthExpenseTotal = $derived(monthExpenses.reduce((sum, e) => sum + toMain(e.amount, e.currencyId), 0));

	// Amount due this month = subscriptions renewing this calendar month
	const amountDueThisMonth = $derived(
		activeSubs
			.filter((s) => s.nextRenewal.startsWith(monthKey))
			.reduce((sum, s) => sum + toMain(s.price, s.currencyId), 0)
	);

	const budgetUsedPct = $derived(
		data.monthlyBudget ? Math.min((monthlySubTotal / data.monthlyBudget) * 100, 100) : null
	);
	const budgetRemaining = $derived(
		data.monthlyBudget ? Math.max(data.monthlyBudget - monthlySubTotal, 0) : null
	);
	const overBudget = $derived(
		data.monthlyBudget ? monthlySubTotal > data.monthlyBudget : false
	);

	// Upcoming (next 6 active renewals)
	const upcoming = $derived(
		[...activeSubs]
			.sort((a, b) => a.nextRenewal.localeCompare(b.nextRenewal))
			.slice(0, 6)
	);

	function daysUntil(dateStr: string) {
		const diff = new Date(dateStr).getTime() - new Date().setHours(0, 0, 0, 0);
		return Math.ceil(diff / 86400000);
	}

	// Category breakdown (subscriptions monthly + expenses this month, in main currency)
	const categoryBreakdown = $derived.by(() => {
		const totals = new Map<number | null, number>();
		for (const s of activeSubs) {
			totals.set(s.categoryId, (totals.get(s.categoryId) ?? 0) + toMain(monthlyCost(s.price, s.billingCycle), s.currencyId));
		}
		for (const e of monthExpenses) {
			totals.set(e.categoryId, (totals.get(e.categoryId) ?? 0) + toMain(e.amount, e.currencyId));
		}
		const rows = [...totals.entries()]
			.map(([categoryId, amount]) => ({ category: data.categories.find((c) => c.id === categoryId), amount }))
			.sort((a, b) => b.amount - a.amount);
		const max = Math.max(...rows.map((r) => r.amount), 1);
		return { rows, max };
	});

	const donutSlices = $derived(
		categoryBreakdown.rows.map((r) => ({
			label: r.category?.name ?? 'Uncategorized',
			value: r.amount,
			color: r.category?.color ?? '#64748b'
		}))
	);
	const donutTotal = $derived(categoryBreakdown.rows.reduce((sum, r) => sum + r.amount, 0));

	// Total monthly outflow = active subscriptions + this month's expenses
	const totalMonthlyOutflow = $derived(monthlySubTotal + monthExpenseTotal);

	// Last 6 months of expense spending, for the trend sparkline
	const spendingTrend = $derived.by(() => {
		const months: { label: string; key: string }[] = [];
		for (let i = 5; i >= 0; i--) {
			const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
			months.push({
				label: d.toLocaleDateString('en-US', { month: 'short' }),
				key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
			});
		}
		return months.map(({ label, key }) => ({
			label,
			value: data.expenses
				.filter((e) => e.direction !== 'income' && e.date.startsWith(key))
				.reduce((sum, e) => sum + toMain(e.amount, e.currencyId), 0)
		}));
	});
</script>

<div class="space-y-8">
	<!-- Hero -->
	<div class="glass-card animate-in fade-in slide-in-from-bottom-2 relative overflow-hidden rounded-3xl p-6 drop-shadow-[0_0_32px_rgba(99,102,241,0.1)] duration-500 sm:p-8">
		<div class="flex items-center gap-2">
			<span class="relative flex h-2 w-2">
				<span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
				<span class="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
			</span>
			<span class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Live overview</span>
		</div>
		<h1 class="mt-2 text-2xl font-bold text-foreground">Dashboard</h1>
		<p class="mt-5 text-sm text-muted-foreground">Total monthly outflow</p>
		<p
			class="tabular mt-1 text-4xl font-bold tracking-tight text-foreground sm:text-5xl"
			use:countUp={{ value: totalMonthlyOutflow, format: (n) => formatMoney(n, data.mainCurrency) }}
		>{formatMoney(totalMonthlyOutflow, data.mainCurrency)}</p>
		<p class="mt-2 text-xs text-muted-foreground">
			Subscriptions <span class="tabular font-medium text-card-foreground">{formatMoney(monthlySubTotal, data.mainCurrency)}</span>
			+ Expenses <span class="tabular font-medium text-card-foreground">{formatMoney(monthExpenseTotal, data.mainCurrency)}</span>
		</p>
	</div>

	<!-- Upcoming payments -->
	<section class="animate-in fade-in slide-in-from-bottom-1 duration-500" style="animation-delay: 60ms; animation-fill-mode: backwards;">
		<h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Upcoming payments</h2>
		<div class="flex gap-3 overflow-x-auto pb-1">
			{#each upcoming as sub, i (sub.id)}
				{@const cat = data.categories.find((c) => c.id === sub.categoryId)}
				{@const subCurrency = data.currencies.find((c) => c.id === sub.currencyId)}
				{@const d = daysUntil(sub.nextRenewal)}
				<div
					class="glass-card glass-card-hover animate-in fade-in slide-in-from-bottom-2 min-w-[140px] rounded-2xl p-4
						{d <= 3 ? 'drop-shadow-[0_0_16px_rgba(244,63,94,0.18)]' : d <= 7 ? 'drop-shadow-[0_0_16px_rgba(245,158,11,0.15)]' : ''}"
					style="animation-delay: {i * 60}ms; animation-duration: 400ms; animation-fill-mode: backwards;"
				>
					<Logo name={sub.name} website={sub.website} color={cat?.color ?? hashColor(sub.name)} size={36} />
					<p class="mt-3 truncate text-sm font-semibold text-card-foreground">{sub.name}</p>
					<p class="text-xs text-muted-foreground">{sub.nextRenewal}</p>
					<p class="tabular mt-1 font-bold text-card-foreground">{formatMoney(sub.price, subCurrency)}</p>
					{#if d <= 7}
						<p class="mt-0.5 text-xs font-medium {d <= 3 ? 'text-rose-500' : 'text-amber-500'} {d <= 3 ? 'animate-glow-pulse' : ''}">
							{d === 0 ? 'Today' : d < 0 ? 'Overdue' : `in ${d}d`}
						</p>
					{/if}
				</div>
			{:else}
				<p class="text-sm text-muted-foreground">No upcoming renewals.</p>
			{/each}
		</div>
	</section>

	<!-- Subscription stats -->
	<section class="animate-in fade-in slide-in-from-bottom-1 duration-500" style="animation-delay: 120ms; animation-fill-mode: backwards;">
		<h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Your subscriptions</h2>
		<div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
			{@render statCard('Active subscriptions', activeSubs.length, (n) => String(Math.round(n)))}
			{@render statCard('Monthly cost', monthlySubTotal, (n) => formatMoney(n, data.mainCurrency))}
			{@render statCard('Yearly cost', yearlySubTotal, (n) => formatMoney(n, data.mainCurrency))}
		</div>
	</section>

	<!-- Budget -->
	<section class="animate-in fade-in slide-in-from-bottom-1 duration-500" style="animation-delay: 180ms; animation-fill-mode: backwards;">
		<div class="mb-3 flex items-center justify-between">
			<h2 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Your budget</h2>
			<button
				onclick={() => (editingBudget = !editingBudget)}
				class="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted-foreground transition hover:bg-accent hover:text-accent-foreground"
			>
				<Pencil class="h-3 w-3" />
				{data.monthlyBudget ? 'Edit budget' : 'Set budget'}
			</button>
		</div>

		{#if editingBudget}
			<form
				method="POST"
				action="?/setBudget"
				use:enhance={() => ({ update }) => { editingBudget = false; update(); }}
				class="mb-4 flex gap-2"
			>
				<input
					name="monthlyBudget"
					type="number"
					step="0.01"
					min="0"
					bind:value={budgetInput}
					placeholder="Monthly budget ({data.mainCurrency.symbol})"
					class="flex-1 rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
				/>
				<button type="submit" class="flex items-center gap-1 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
					<Check class="h-4 w-4" /> Save
				</button>
			</form>
		{/if}

		{#if budgetUsedPct != null}
			<div class="glass-card grid grid-cols-1 gap-4 rounded-2xl p-5 sm:grid-cols-[auto_1fr] sm:items-center sm:gap-8">
				<div class="flex justify-center">
					<Gauge
						value={budgetUsedPct}
						label="of budget used"
						display="{budgetUsedPct.toFixed(0)}%"
					/>
				</div>
				<div class="grid grid-cols-2 gap-3">
					{@render statCard('Monthly spend', monthlySubTotal, (n) => formatMoney(n, data.mainCurrency))}
					{@render statCard('Budget', data.monthlyBudget ?? 0, (n) => formatMoney(n, data.mainCurrency))}
					{@render statCard('Due this month', amountDueThisMonth, (n) => formatMoney(n, data.mainCurrency))}
					{@render statCard(
						overBudget ? 'Over budget' : 'Remaining',
						overBudget ? monthlySubTotal - (data.monthlyBudget ?? 0) : (budgetRemaining ?? 0),
						(n) => formatMoney(n, data.mainCurrency),
						overBudget ? 'destructive' : 'success'
					)}
				</div>
			</div>
		{:else}
			<div class="grid grid-cols-2 gap-3">
				{@render statCard('Due this month', amountDueThisMonth, (n) => formatMoney(n, data.mainCurrency))}
				{@render statCard('Monthly spend', monthlySubTotal, (n) => formatMoney(n, data.mainCurrency))}
			</div>
			<p class="mt-3 text-sm text-muted-foreground">Set a monthly budget to track how much headroom you have.</p>
		{/if}
	</section>

	<!-- Savings -->
	<section class="animate-in fade-in slide-in-from-bottom-1 duration-500" style="animation-delay: 240ms; animation-fill-mode: backwards;">
		<h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Your savings (inactive subscriptions)</h2>
		<div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
			{@render statCard('Inactive subscriptions', inactiveSubs.length, (n) => String(Math.round(n)))}
			{@render statCard('Monthly savings', monthlySavings, (n) => formatMoney(n, data.mainCurrency), 'success')}
			{@render statCard('Yearly savings', yearlySavings, (n) => formatMoney(n, data.mainCurrency), 'success')}
		</div>
	</section>

	<!-- Spending trend -->
	{#if spendingTrend.some((m) => m.value > 0)}
		<section
			class="glass-card glass-card-hover animate-in fade-in slide-in-from-bottom-1 rounded-2xl p-5 duration-500"
			style="animation-delay: 300ms; animation-fill-mode: backwards;"
		>
			<h2 class="text-sm font-semibold text-card-foreground">Spending trend</h2>
			<p class="mb-4 text-xs text-muted-foreground">Expenses over the last 6 months</p>
			<Sparkline points={spendingTrend} height={90} color="var(--primary)" />
		</section>
	{/if}

	<!-- Category breakdown + this month expenses -->
	<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
		<section
			class="glass-card glass-card-hover animate-in fade-in slide-in-from-bottom-1 rounded-2xl p-5 drop-shadow-[0_0_24px_rgba(99,102,241,0.08)] duration-500"
			style="animation-delay: 360ms; animation-fill-mode: backwards;"
		>
			<h2 class="text-sm font-semibold text-card-foreground">Spending by category</h2>
			<p class="mb-4 text-xs text-muted-foreground">Monthly subscriptions + this month's expenses</p>
			{#if donutTotal > 0}
				<Donut
					slices={donutSlices}
					centerValue={formatMoneyCompact(donutTotal, data.mainCurrency)}
					centerLabel="per month"
				/>
			{:else}
				<p class="text-sm text-muted-foreground">No spending recorded yet.</p>
			{/if}
		</section>

		<section
			class="glass-card glass-card-hover animate-in fade-in slide-in-from-bottom-1 rounded-2xl p-5 duration-500"
			style="animation-delay: 420ms; animation-fill-mode: backwards;"
		>
			<h2 class="text-sm font-semibold text-card-foreground">This month's expenses</h2>
			<p class="mb-4 text-xs text-muted-foreground">{monthExpenses.length} entries · {formatMoney(monthExpenseTotal, data.mainCurrency)}</p>
			<ul class="space-y-2.5">
				{#each monthExpenses.slice(0, 6) as exp, i (exp.id)}
					{@const cat = data.categories.find((c) => c.id === exp.categoryId)}
					{@const expCurrency = data.currencies.find((c) => c.id === exp.currencyId)}
					<li
						class="animate-in fade-in slide-in-from-left-1 flex items-center gap-3 text-sm"
						style="animation-delay: {i * 50}ms; animation-duration: 300ms; animation-fill-mode: backwards;"
					>
						<div
							class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white transition-transform hover:scale-110"
							style="background-color: {cat?.color ?? hashColor(exp.name)}"
						>
							{exp.name.charAt(0).toUpperCase()}
						</div>
						<span class="flex-1 truncate text-muted-foreground">{exp.name}</span>
						<span class="tabular font-semibold text-card-foreground">{formatMoney(exp.amount, expCurrency)}</span>
					</li>
				{:else}
					<li class="text-sm text-muted-foreground">No expenses this month.</li>
				{/each}
				{#if monthExpenses.length > 6}
					<li class="pt-1 text-xs text-muted-foreground">+{monthExpenses.length - 6} more</li>
				{/if}
			</ul>
		</section>
	</div>
</div>

{#snippet statCard(label: string, raw: number, format: (n: number) => string, accent?: 'destructive' | 'success')}
	<div class="glass-card glass-card-hover rounded-2xl p-4">
		<p class="text-xs text-muted-foreground">{label}</p>
		<p
			class="tabular mt-1.5 text-xl font-bold {accent === 'destructive' ? 'text-destructive' : accent === 'success' ? 'text-emerald-600 dark:text-emerald-400' : 'text-card-foreground'}"
			use:countUp={{ value: raw, format }}
		>{format(raw)}</p>
	</div>
{/snippet}
