<script lang="ts">
	type Slice = { label: string; value: number; color: string };
	let {
		slices,
		size = 150,
		thickness = 20,
		centerLabel = '',
		centerValue = '',
		formatValue = undefined,
		onSelect = undefined,
		selectedLabel = undefined
	}: {
		slices: Slice[];
		size?: number;
		thickness?: number;
		centerLabel?: string;
		centerValue?: string;
		formatValue?: (value: number) => string;
		onSelect?: (label: string) => void;
		selectedLabel?: string | null;
	} = $props();

	const radius = $derived((size - thickness) / 2);
	const circumference = $derived(2 * Math.PI * radius);
	const total = $derived(slices.reduce((sum, s) => sum + s.value, 0));

	const segments = $derived.by(() => {
		let acc = 0;
		return slices
			.filter((s) => s.value > 0)
			.map((s) => {
				const fraction = total > 0 ? s.value / total : 0;
				const seg = { ...s, dash: fraction * circumference, offset: acc };
				acc += fraction * circumference;
				return seg;
			});
	});
</script>

<div class="flex items-center gap-5">
	<div class="relative shrink-0" style="width: {size}px; height: {size}px;">
		<svg width={size} height={size} viewBox="0 0 {size} {size}" class="-rotate-90">
			<circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--muted)" stroke-width={thickness} />
			{#each segments as seg (seg.label)}
				{@const active = selectedLabel === seg.label}
				<circle
					cx={size / 2}
					cy={size / 2}
					r={radius}
					fill="none"
					stroke={seg.color}
					stroke-width={active ? thickness + 3 : thickness}
					stroke-dasharray="{seg.dash} {circumference - seg.dash}"
					stroke-dashoffset={-seg.offset}
					class="transition-all duration-700 ease-out"
					style={active ? `filter: drop-shadow(0 0 6px ${seg.color}99)` : ''}
				/>
			{/each}
		</svg>
		{#if centerLabel || centerValue}
			<div class="absolute inset-0 flex flex-col items-center justify-center text-center">
				{#if centerValue}<span class="text-lg font-bold tracking-tight text-card-foreground">{centerValue}</span>{/if}
				{#if centerLabel}<span class="text-[10px] uppercase tracking-wide text-muted-foreground">{centerLabel}</span>{/if}
			</div>
		{/if}
	</div>

	<div class="min-w-0 flex-1 space-y-1.5">
		{#each segments as seg (seg.label)}
			{@const active = selectedLabel === seg.label}
			<div
				class="flex items-center gap-2 text-sm rounded-lg px-1 py-0.5 transition
					{onSelect ? 'cursor-pointer hover:bg-accent' : ''}
					{active ? 'bg-accent ring-1 ring-border' : ''}"
				role={onSelect ? 'button' : undefined}
				tabindex={onSelect ? 0 : undefined}
				onclick={() => onSelect?.(seg.label)}
				onkeydown={(e) => e.key === 'Enter' && onSelect?.(seg.label)}
			>
				<span class="h-2.5 w-2.5 shrink-0 rounded-full" style="background-color: {seg.color}"></span>
				<span class="min-w-0 flex-1 truncate text-muted-foreground">
					{seg.label} <span class="text-xs font-medium text-card-foreground">{Math.round((seg.value / total) * 100)}%</span>
				</span>
				{#if formatValue}
					<span class="shrink-0 font-medium text-card-foreground">{formatValue(seg.value)}</span>
				{/if}
			</div>
		{:else}
			<p class="text-sm text-muted-foreground">No data yet.</p>
		{/each}
	</div>
</div>
