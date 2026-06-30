<script lang="ts">
	import { enhance } from '$app/forms';
	import { convertToMain, formatMoney, formatMoneyCompact, monthlyEquivalent } from '$lib/currency';
	import { hashColor } from '$lib/color';
	import Logo from '$lib/components/Logo.svelte';
	import PaymentBadge from '$lib/components/PaymentBadge.svelte';
	import { PAYMENT_METHODS, type PaymentMethod } from '$lib/payments';
	import * as Sheet from '$lib/components/ui/sheet/index.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import { Progress } from '$lib/components/ui/progress/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import MoreHorizontal from '@lucide/svelte/icons/ellipsis';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import PauseCircle from '@lucide/svelte/icons/pause-circle';
	import PlayCircle from '@lucide/svelte/icons/play-circle';
	import SearchIcon from '@lucide/svelte/icons/search';

	let { data, form } = $props();

	type Sub = (typeof data.subscriptions)[0];

	let sheetOpen = $state(false);
	let editing = $state<Sub | null>(null);
	let search = $state('');

	const paymentLabels: Record<PaymentMethod, string> = {
		paypal: 'PayPal', visa: 'Visa', mastercard: 'Mastercard', amex: 'Amex',
		applepay: 'Apple Pay', googlepay: 'Google Pay', banktransfer: 'Bank transfer',
		bitcoin: 'Bitcoin', other: 'Other'
	};

	function openAdd() { editing = null; sheetOpen = true; }
	function openEdit(sub: Sub) { editing = sub; sheetOpen = true; }

	function monthlyCost(price: number, cycle: string) {
		switch (cycle) {
			case 'yearly': return price / 12;
			case 'weekly': return (price * 52) / 12;
			case 'quarterly': return price / 3;
			default: return price;
		}
	}

	function cycleLabel(cycle: string) {
		return { monthly: '/mo', yearly: '/yr', weekly: '/wk', quarterly: '/qtr' }[cycle] ?? '';
	}

	function cycleDays(cycle: string) {
		return { monthly: 30, yearly: 365, weekly: 7, quarterly: 90 }[cycle] ?? 30;
	}

	function renewalProgress(nextRenewal: string, cycle: string) {
		const daysTotal = cycleDays(cycle);
		const next = new Date(nextRenewal).getTime();
		const prev = next - daysTotal * 86400000;
		const now = Date.now();
		const elapsed = Math.min(Math.max((now - prev) / (next - prev), 0), 1);
		return Math.round(elapsed * 100);
	}

	function daysUntil(dateStr: string) {
		const diff = new Date(dateStr).getTime() - new Date().setHours(0, 0, 0, 0);
		return Math.ceil(diff / 86400000);
	}

	const filtered = $derived(
		data.subscriptions.filter((s) =>
			!search || s.name.toLowerCase().includes(search.toLowerCase())
		)
	);

	const activeSubs = $derived(data.subscriptions.filter((s) => s.active));
	const monthlyTotal = $derived(
		activeSubs.reduce(
			(sum, s) => sum + convertToMain(monthlyCost(s.price, s.billingCycle), s.currencyId, data.currencies, data.mainCurrency),
			0
		)
	);
	const yearlyTotal = $derived(monthlyTotal * 12);
</script>

<div class="space-y-5">
	<!-- Header -->
	<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
		<div>
			<h1 class="text-2xl font-bold text-foreground">Subscriptions</h1>
			<p class="text-sm text-muted-foreground">
				{activeSubs.length} active · {formatMoney(monthlyTotal, data.mainCurrency)}/mo ·
				{formatMoney(yearlyTotal, data.mainCurrency)}/yr
			</p>
		</div>
		<button
			onclick={openAdd}
			class="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 hover:glow-primary"
		>
			<PlusIcon class="h-4 w-4" />
			New Subscription
		</button>
	</div>

	{#if form?.error}
		<p class="rounded-xl bg-destructive/10 px-4 py-2.5 text-sm text-destructive">{form.error}</p>
	{/if}

	<!-- Search -->
	<div class="relative">
		<SearchIcon class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
		<input
			bind:value={search}
			placeholder="Search subscriptions..."
			class="w-full rounded-xl border border-border bg-background py-2.5 pl-9 pr-4 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 sm:max-w-xs"
		/>
	</div>

	<!-- List -->
	<div class="space-y-2.5">
		{#each filtered as sub, i (sub.id)}
			{@const cat = data.categories.find((c) => c.id === sub.categoryId)}
			{@const subCurrency = data.currencies.find((c) => c.id === sub.currencyId)}
			{@const progress = renewalProgress(sub.nextRenewal, sub.billingCycle)}
			{@const days = daysUntil(sub.nextRenewal)}
			<div
				class="glass-card animate-in fade-in slide-in-from-bottom-1 overflow-hidden rounded-2xl transition-all duration-200 hover:scale-[1.005]
					{sub.active ? '' : 'opacity-60'}
					{sub.active && days <= 3 ? 'drop-shadow-[0_0_18px_rgba(244,63,94,0.15)]' : ''}"
				style="animation-delay: {i * 40}ms; animation-duration: 350ms; animation-fill-mode: backwards;"
			>
				<div class="flex items-center gap-3 p-4 sm:gap-4">
					<!-- Logo -->
					<div class="shrink-0">
						<Logo name={sub.name} website={sub.website} color={cat?.color ?? hashColor(sub.name)} size={44} />
					</div>

					<!-- Info -->
					<div class="min-w-0 flex-1">
						<div class="flex flex-wrap items-center gap-2">
							<p class="font-semibold text-card-foreground">{sub.name}</p>
							{#if !sub.active}
								<Badge variant="secondary">Paused</Badge>
							{/if}
						</div>
						<div class="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
							<!-- Next-renewal pill, color-coded by urgency -->
							{#if sub.active}
								<span
									class="rounded-full px-2 py-0.5 font-medium {days <= 3
										? 'bg-destructive/10 text-destructive animate-glow-pulse'
										: days <= 7
											? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
											: 'bg-muted text-muted-foreground'}"
								>
									{days === 0 ? 'Due today' : days < 0 ? 'Overdue' : days <= 30 ? `in ${days}d` : sub.nextRenewal}
								</span>
							{/if}
							<span class="text-muted-foreground capitalize">{sub.billingCycle}</span>
							{#if cat}
								<span
									class="rounded-full px-2 py-0.5"
									style="background-color: {cat.color}22; color: {cat.color}"
								>{cat.name}</span>
							{/if}
							<PaymentBadge method={sub.paymentMethod} />
						</div>
					</div>

					<!-- Price -->
					<div class="shrink-0 text-right">
						<p class="tabular text-lg font-bold tracking-tight text-card-foreground">
							{formatMoney(sub.price, subCurrency)}<span class="text-xs font-medium text-muted-foreground">{cycleLabel(sub.billingCycle)}</span>
						</p>
						{#if sub.billingCycle !== 'monthly' || (sub.currencyId && sub.currencyId !== data.mainCurrency.id)}
							{@const monthlyInMain = convertToMain(monthlyEquivalent(sub.price, sub.billingCycle), sub.currencyId, data.currencies, data.mainCurrency)}
							<p class="text-xs text-muted-foreground">
								≈ {formatMoneyCompact(monthlyInMain, data.mainCurrency)}/mo
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
							<DropdownMenu.Item onclick={() => openEdit(sub)}>
								<Pencil class="mr-2 h-4 w-4" />
								Edit
							</DropdownMenu.Item>
							<form method="POST" action="?/update" use:enhance>
								<input type="hidden" name="id" value={sub.id} />
								<input type="hidden" name="name" value={sub.name} />
								<input type="hidden" name="price" value={sub.price} />
								<input type="hidden" name="billingCycle" value={sub.billingCycle} />
								<input type="hidden" name="nextRenewal" value={sub.nextRenewal} />
								<input type="hidden" name="categoryId" value={sub.categoryId ?? ''} />
								<input type="hidden" name="currencyId" value={sub.currencyId ?? ''} />
								<input type="hidden" name="website" value={sub.website ?? ''} />
								<input type="hidden" name="paymentMethod" value={sub.paymentMethod ?? ''} />
								<input type="hidden" name="notes" value={sub.notes ?? ''} />
								<input type="hidden" name="active" value={sub.active ? '' : 'on'} />
								<DropdownMenu.Item>
									{#snippet child({ props })}
										<button {...props} type="submit" class="flex w-full items-center">
											{#if sub.active}
												<PauseCircle class="mr-2 h-4 w-4" /> Pause
											{:else}
												<PlayCircle class="mr-2 h-4 w-4" /> Resume
											{/if}
										</button>
									{/snippet}
								</DropdownMenu.Item>
							</form>
							<DropdownMenu.Separator />
							<form method="POST" action="?/delete" use:enhance>
								<input type="hidden" name="id" value={sub.id} />
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

				<!-- Billing cycle progress (how far into the current period) -->
				{#if sub.active}
					<Progress value={progress} class="h-1 rounded-none bg-muted/50" />
				{/if}
			</div>
		{:else}
			<div class="rounded-2xl border border-dashed border-border bg-card py-16 text-center">
				<p class="text-muted-foreground">
					{search ? 'No subscriptions match your search.' : 'No subscriptions yet.'}
				</p>
				{#if !search}
					<button onclick={openAdd} class="mt-3 text-sm font-medium text-primary hover:underline">
						Add your first subscription →
					</button>
				{/if}
			</div>
		{/each}
	</div>
</div>

<!-- Add/Edit Sheet -->
<Sheet.Root bind:open={sheetOpen}>
	<Sheet.Content side="right" class="w-full overflow-y-auto sm:max-w-md">
		<Sheet.Header>
			<Sheet.Title>{editing ? 'Edit subscription' : 'New subscription'}</Sheet.Title>
			<Sheet.Description>
				{editing ? 'Update the details for this subscription.' : 'Track a new recurring subscription.'}
			</Sheet.Description>
		</Sheet.Header>

		<form
			method="POST"
			action={editing ? '?/update' : '?/create'}
			use:enhance={() => {
				return ({ result, update }) => {
					if (result.type === 'success') sheetOpen = false;
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
					placeholder="Netflix"
					class="rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
				/>
			</label>

			<label class="flex flex-col gap-1.5 text-sm font-medium">
				Website <span class="text-xs font-normal text-muted-foreground">(used for logo)</span>
				<input
					name="website"
					value={editing?.website ?? ''}
					placeholder="netflix.com"
					class="rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
				/>
			</label>

			<div class="grid grid-cols-2 gap-3">
				<label class="flex flex-col gap-1.5 text-sm font-medium">
					Price <span class="text-destructive">*</span>
					<input
						name="price"
						type="number"
						step="0.01"
						min="0"
						value={editing?.price ?? ''}
						required
						placeholder="9.99"
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
					Billing cycle
					<select name="billingCycle" class="rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50">
						{#each ['monthly', 'yearly', 'quarterly', 'weekly'] as c (c)}
							<option value={c} selected={c === (editing?.billingCycle ?? 'monthly')} class="capitalize">{c}</option>
						{/each}
					</select>
				</label>
				<label class="flex flex-col gap-1.5 text-sm font-medium">
					Next renewal <span class="text-destructive">*</span>
					<input
						name="nextRenewal"
						type="date"
						value={editing?.nextRenewal ?? ''}
						required
						class="rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
					/>
				</label>
			</div>

			<div class="grid grid-cols-2 gap-3">
				<label class="flex flex-col gap-1.5 text-sm font-medium">
					Category
					<select name="categoryId" class="rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50">
						<option value="">None</option>
						{#each data.categories as cat (cat.id)}
							<option value={cat.id} selected={cat.id === editing?.categoryId}>{cat.name}</option>
						{/each}
					</select>
				</label>
				<label class="flex flex-col gap-1.5 text-sm font-medium">
					Payment method
					<select name="paymentMethod" class="rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50">
						<option value="">None</option>
						{#each PAYMENT_METHODS as pm (pm)}
							<option value={pm} selected={pm === editing?.paymentMethod}>{paymentLabels[pm]}</option>
						{/each}
					</select>
				</label>
			</div>

			{#if editing}
				<label class="flex items-center gap-2.5 text-sm font-medium">
					<input
						type="checkbox"
						name="active"
						checked={editing.active}
						class="h-4 w-4 rounded border-border"
					/>
					Active subscription
				</label>
			{/if}

			<label class="flex flex-col gap-1.5 text-sm font-medium">
				Notes
				<textarea
					name="notes"
					value={editing?.notes ?? ''}
					rows="2"
					placeholder="Optional notes..."
					class="rounded-xl border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring/50"
				></textarea>
			</label>

			<div class="flex gap-3 pt-2">
				<button
					type="submit"
					class="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
				>
					{editing ? 'Save changes' : 'Add subscription'}
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
