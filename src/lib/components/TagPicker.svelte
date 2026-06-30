<script lang="ts">
	import { hashColor } from '$lib/color';
	import Check from '@lucide/svelte/icons/check';
	import PlusIcon from '@lucide/svelte/icons/plus';

	type Tag = { id: number; name: string; color: string };

	let {
		tags,
		appliedIds = [],
		onToggle,
		onCreate,
		align = 'left',
		label = 'Tag'
	}: {
		tags: Tag[];
		appliedIds?: number[];
		onToggle: (tagId: number) => void;
		onCreate: (name: string, color: string) => void;
		align?: 'left' | 'right';
		label?: string;
	} = $props();

	let open = $state(false);
	let query = $state('');
	let panel = $state<HTMLDivElement | null>(null);

	const filtered = $derived(
		tags.filter((t) => t.name.toLowerCase().includes(query.trim().toLowerCase()))
	);
	const exactExists = $derived(
		tags.some((t) => t.name.toLowerCase() === query.trim().toLowerCase())
	);

	function toggle() {
		open = !open;
		query = '';
	}

	function handleCreate() {
		const name = query.trim();
		if (!name || exactExists) return;
		onCreate(name, hashColor(name));
		query = '';
	}

	function onWindowClick(e: MouseEvent) {
		if (open && panel && !panel.contains(e.target as Node)) open = false;
	}
</script>

<svelte:window onclick={onWindowClick} />

<div class="relative inline-block" bind:this={panel}>
	<button
		type="button"
		onclick={(e) => { e.stopPropagation(); toggle(); }}
		class="flex items-center gap-1 rounded-full border border-dashed border-border px-2 py-0.5 text-xs font-medium text-muted-foreground transition hover:border-primary hover:text-primary"
	>
		<PlusIcon class="h-3 w-3" />
		{label}
	</button>

	{#if open}
		<div
			class="absolute z-50 w-56 rounded-xl border border-border bg-popover p-1.5 shadow-lg {align === 'right' ? 'right-0' : 'left-0'} {label === 'Apply tag' ? 'bottom-full mb-1' : 'top-full mt-1'}"
		>
			<input
				bind:value={query}
				placeholder="Search or create…"
				onclick={(e) => e.stopPropagation()}
				onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleCreate(); } }}
				class="mb-1 w-full rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
			/>
			<div class="max-h-52 overflow-y-auto">
				{#each filtered as tag (tag.id)}
					{@const applied = appliedIds.includes(tag.id)}
					<button
						type="button"
						onclick={(e) => { e.stopPropagation(); onToggle(tag.id); }}
						class="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition hover:bg-accent"
					>
						<span class="h-2.5 w-2.5 shrink-0 rounded-full" style="background-color: {tag.color}"></span>
						<span class="min-w-0 flex-1 truncate">{tag.name}</span>
						{#if applied}<Check class="h-3.5 w-3.5 text-primary" />{/if}
					</button>
				{/each}

				{#if query.trim() && !exactExists}
					<button
						type="button"
						onclick={(e) => { e.stopPropagation(); handleCreate(); }}
						class="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-primary transition hover:bg-accent"
					>
						<PlusIcon class="h-3.5 w-3.5" />
						Create "<span class="font-medium">{query.trim()}</span>"
					</button>
				{:else if filtered.length === 0}
					<p class="px-2 py-1.5 text-xs text-muted-foreground">No tags yet — type to create one.</p>
				{/if}
			</div>
		</div>
	{/if}
</div>
