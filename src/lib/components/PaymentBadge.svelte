<script lang="ts">
	import type { PaymentMethod } from '$lib/server/db/schema';

	let { method }: { method: PaymentMethod | null } = $props();

	const labels: Record<PaymentMethod, { label: string; icon: string; bg: string; fg: string }> = {
		paypal: { label: 'PayPal', icon: '🅿️', bg: '#e0e7ff', fg: '#3730a3' },
		visa: { label: 'Visa', icon: '💳', bg: '#dbeafe', fg: '#1e40af' },
		mastercard: { label: 'Mastercard', icon: '💳', bg: '#fef3c7', fg: '#92400e' },
		amex: { label: 'Amex', icon: '💳', bg: '#dbeafe', fg: '#1e3a8a' },
		applepay: { label: 'Apple Pay', icon: '🍎', bg: '#f1f5f9', fg: '#0f172a' },
		googlepay: { label: 'Google Pay', icon: '🟢', bg: '#f1f5f9', fg: '#0f172a' },
		banktransfer: { label: 'Bank transfer', icon: '🏦', bg: '#f1f5f9', fg: '#334155' },
		bitcoin: { label: 'Bitcoin', icon: '₿', bg: '#fff7ed', fg: '#9a3412' },
		other: { label: 'Other', icon: '💰', bg: '#f1f5f9', fg: '#334155' }
	};

	const info = $derived(method ? labels[method] : null);
</script>

{#if info}
	<span
		class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
		style="background-color: {info.bg}; color: {info.fg};"
	>
		<span>{info.icon}</span>
		{info.label}
	</span>
{/if}
