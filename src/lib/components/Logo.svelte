<script lang="ts">
	let { name, website, color = '#6366f1', size = 36 }: {
		name: string;
		website?: string | null;
		color?: string;
		size?: number;
	} = $props();

	let failed = $state(false);

	function domainOf(url: string) {
		try {
			const withProtocol = url.startsWith('http') ? url : `https://${url}`;
			return new URL(withProtocol).hostname.replace(/^www\./, '');
		} catch {
			return null;
		}
	}

	const domain = $derived(website ? domainOf(website) : null);
	// Google's favicon service returns a crisp 64px PNG (vs DuckDuckGo's blurry 16px .ico).
	const faviconUrl = $derived(
		domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=64` : null
	);
	const initial = $derived(name.trim().charAt(0).toUpperCase() || '?');
</script>

{#if faviconUrl && !failed}
	<div
		class="flex items-center justify-center overflow-hidden rounded-xl border border-border bg-white shadow-sm"
		style="width: {size}px; height: {size}px;"
	>
		<img
			src={faviconUrl}
			alt={name}
			class="object-contain"
			style="width: {size * 0.62}px; height: {size * 0.62}px;"
			onerror={() => (failed = true)}
		/>
	</div>
{:else}
	<div
		class="flex items-center justify-center rounded-xl font-semibold text-white shadow-sm"
		style="width: {size}px; height: {size}px; background-color: {color}; font-size: {size * 0.42}px;"
	>
		{initial}
	</div>
{/if}
