<script lang="ts">
	import type { PaymentMethod } from '$lib/server/db/schema';

	let { method, size = 20 }: { method: PaymentMethod | null; size?: number } = $props();

	const width = $derived(Math.round(size * 1.6));
</script>

{#if method === 'visa'}
	<svg height={size} width={width} viewBox="0 0 32 20" class="shrink-0">
		<rect width="32" height="20" rx="3" fill="#1A1F71" />
		<text x="16" y="14.5" text-anchor="middle" font-family="Arial, sans-serif" font-size="9" font-weight="800" font-style="italic" fill="white">VISA</text>
	</svg>
{:else if method === 'mastercard'}
	<svg height={size} width={width} viewBox="0 0 32 20" class="shrink-0">
		<rect width="32" height="20" rx="3" fill="#16161d" />
		<circle cx="13" cy="10" r="6" fill="#EB001B" />
		<circle cx="19" cy="10" r="6" fill="#F79E1B" />
		<path d="M16 5.3a6 6 0 0 1 0 9.4 6 6 0 0 1 0-9.4Z" fill="#FF5F00" />
	</svg>
{:else if method === 'amex'}
	<svg height={size} width={width} viewBox="0 0 32 20" class="shrink-0">
		<rect width="32" height="20" rx="3" fill="#006FCF" />
		<text x="16" y="13.5" text-anchor="middle" font-family="Arial, sans-serif" font-size="7" font-weight="800" fill="white" letter-spacing="0.3">AMEX</text>
	</svg>
{:else if method === 'paypal'}
	<svg height={size} width={width} viewBox="0 0 32 20" class="shrink-0">
		<rect width="32" height="20" rx="3" fill="#F5F7FA" />
		<path d="M12.3 5.5h4.4c2.2 0 3.4 1 3.1 3.1-.4 2.6-2 3.7-4.3 3.7h-1.4l-.5 3.2h-2.2l1-7.5Zm2 2-.4 2.7h1.1c.9 0 1.6-.4 1.7-1.5.1-1-.4-1.2-1.2-1.2h-1.2Z" fill="#003087" />
		<path d="M16.9 5.5h4.4c2.2 0 3.4 1 3.1 3.1-.4 2.6-2 3.7-4.3 3.7h-1.4l-.5 3.2h-2.1l1-7.8Z" fill="#009CDE" opacity="0.85" />
	</svg>
{:else if method === 'applepay'}
	<svg height={size} width={width} viewBox="0 0 32 20" class="shrink-0">
		<rect width="32" height="20" rx="3" fill="#000" />
		<path d="M11.2 7.6c.4-.5.6-1.1.6-1.8-.6 0-1.2.3-1.6.8-.4.4-.7 1.1-.6 1.7.7.1 1.3-.2 1.6-.7Z" fill="white" />
		<path d="M11.8 8.5c-.9-.1-1.6.5-2.1.5-.4 0-1.1-.5-1.8-.5-.9 0-1.8.5-2.3 1.4-1 1.7-.2 4.2.7 5.6.4.7 1 1.4 1.7 1.4.6 0 .9-.4 1.7-.4s1 .4 1.7.4c.7 0 1.2-.7 1.6-1.4.5-.8.7-1.6.7-1.6s-1.4-.5-1.4-2c0-1.3 1-1.9 1.1-2-.6-.8-1.5-.9-1.8-1l.2.6Z" fill="white" />
		<text x="22" y="13.5" font-family="Arial, sans-serif" font-size="7" font-weight="600" fill="white">Pay</text>
	</svg>
{:else if method === 'googlepay'}
	<svg height={size} width={width} viewBox="0 0 32 20" class="shrink-0">
		<rect width="32" height="20" rx="3" fill="#F5F7FA" />
		<text x="10" y="13.5" text-anchor="middle" font-family="Arial, sans-serif" font-size="9" font-weight="700" fill="#4285F4">G</text>
		<text x="22" y="13.5" text-anchor="middle" font-family="Arial, sans-serif" font-size="7" font-weight="600" fill="#5F6368">Pay</text>
	</svg>
{:else if method === 'bitcoin'}
	<svg height={size} width={size} viewBox="0 0 20 20" class="shrink-0">
		<circle cx="10" cy="10" r="10" fill="#F7931A" />
		<text x="10" y="14.5" text-anchor="middle" font-family="Arial, sans-serif" font-size="11" font-weight="700" fill="white">₿</text>
	</svg>
{:else if method === 'banktransfer'}
	<span class="flex items-center justify-center rounded-md bg-muted text-muted-foreground" style="height: {size}px; width: {size}px;">
		<svg width={Math.round(size * 0.6)} height={Math.round(size * 0.6)} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
			<path d="M3 21h18" /><path d="M5 21V9l7-5 7 5v12" /><path d="M9 21V12h6v9" />
		</svg>
	</span>
{:else if method === 'other'}
	<span class="flex items-center justify-center rounded-md bg-muted text-muted-foreground" style="height: {size}px; width: {size}px;">
		<svg width={Math.round(size * 0.6)} height={Math.round(size * 0.6)} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
			<rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" />
		</svg>
	</span>
{/if}
