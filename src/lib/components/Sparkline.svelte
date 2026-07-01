<script lang="ts">
	let {
		points,
		width = 600,
		height = 80,
		color = 'var(--primary)',
		fill = true
	}: {
		points: { label: string; value: number }[];
		width?: number;
		height?: number;
		color?: string;
		fill?: boolean;
	} = $props();

	const max = $derived(Math.max(...points.map((p) => p.value), 1));
	const min = $derived(Math.min(...points.map((p) => p.value), 0));
	const range = $derived(max - min || 1);
	const stepX = $derived(points.length > 1 ? width / (points.length - 1) : width);

	const coords = $derived(
		points.map((p, i) => ({
			x: i * stepX,
			y: height - ((p.value - min) / range) * (height - 8) - 4,
			...p
		}))
	);

	const linePath = $derived(coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' '));
	const areaPath = $derived(`${linePath} L ${width} ${height} L 0 ${height} Z`);

	let hoverIdx = $state<number | null>(null);
</script>

<div class="relative w-full" style="height: {height}px;">
	<svg viewBox="0 0 {width} {height}" class="h-full w-full overflow-visible" preserveAspectRatio="none">
		{#if fill}
			<defs>
				<linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
					<stop offset="0%" stop-color={color} stop-opacity="0.25" />
					<stop offset="100%" stop-color={color} stop-opacity="0" />
				</linearGradient>
			</defs>
			<path d={areaPath} fill="url(#spark-fill)" />
		{/if}
		<path
			d={linePath}
			fill="none"
			stroke={color}
			stroke-width="2.5"
			stroke-linecap="round"
			stroke-linejoin="round"
			style="filter: drop-shadow(0 0 4px {color}88); vector-effect: non-scaling-stroke;"
			class="transition-all duration-700 ease-out"
		/>
		{#each coords as c, i (c.label)}
			<circle
				cx={c.x}
				cy={c.y}
				r={hoverIdx === i ? 5 : 3}
				fill={color}
				style="filter: drop-shadow(0 0 4px {color}aa); transition: r 0.15s ease;"
				class="cursor-pointer"
				onmouseenter={() => (hoverIdx = i)}
				onmouseleave={() => (hoverIdx = null)}
				role="img"
				aria-label="{c.label}: {c.value}"
			/>
		{/each}
	</svg>
</div>

<div class="mt-1 flex justify-between text-[10px] text-muted-foreground">
	{#each points as p (p.label)}
		<span>{p.label}</span>
	{/each}
</div>
