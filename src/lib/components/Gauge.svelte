<script lang="ts">
	let {
		value = 0,
		size = 180,
		thickness = 16,
		label = '',
		display = ''
	}: {
		value?: number; // 0-100
		size?: number;
		thickness?: number;
		label?: string;
		display?: string;
	} = $props();

	const clamped = $derived(Math.min(Math.max(value, 0), 100));
	const radius = $derived((size - thickness) / 2);
	// Semicircle: half the circumference is the full track
	const semi = $derived(Math.PI * radius);
	const dash = $derived((clamped / 100) * semi);

	const color = $derived(
		clamped >= 100 ? 'var(--destructive)' : clamped >= 80 ? '#f59e0b' : 'var(--primary)'
	);

	const height = $derived(size / 2 + thickness);
</script>

<div class="flex flex-col items-center">
	<svg width={size} height={height} viewBox="0 0 {size} {height}">
		<!-- track (semicircle) -->
		<path
			d="M {thickness / 2} {size / 2} A {radius} {radius} 0 0 1 {size - thickness / 2} {size / 2}"
			fill="none"
			stroke="var(--muted)"
			stroke-width={thickness}
			stroke-linecap="round"
		/>
		<!-- value -->
		<path
			d="M {thickness / 2} {size / 2} A {radius} {radius} 0 0 1 {size - thickness / 2} {size / 2}"
			fill="none"
			stroke={color}
			stroke-width={thickness}
			stroke-linecap="round"
			stroke-dasharray="{dash} {semi}"
			class="transition-all duration-700 ease-out"
			style="filter: drop-shadow(0 0 8px {color}66)"
		/>
	</svg>
	<div class="-mt-8 text-center">
		<p class="text-2xl font-bold tracking-tight text-card-foreground">{display || `${Math.round(clamped)}%`}</p>
		{#if label}<p class="text-xs text-muted-foreground">{label}</p>{/if}
	</div>
</div>
