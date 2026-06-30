<script lang="ts">
	let { type = 'debit', size = 44 }: { type?: 'debit' | 'cc'; size?: number } = $props();
</script>

{#if type === 'debit'}
	<!-- BCA Tahapan / Debit: BCA navy-to-blue gradient -->
	<svg
		width={size}
		height={size}
		viewBox="0 0 44 44"
		fill="none"
		xmlns="http://www.w3.org/2000/svg"
		class="shrink-0"
	>
		<rect width="44" height="44" rx="10" fill="url(#bca-debit-grad)" />
		<defs>
			<linearGradient id="bca-debit-grad" x1="0" y1="0" x2="44" y2="44" gradientUnits="userSpaceOnUse">
				<stop offset="0%" stop-color="#003f88" />
				<stop offset="100%" stop-color="#0066c0" />
			</linearGradient>
		</defs>
		<!-- BCA wordmark -->
		<text x="22" y="20" text-anchor="middle" font-family="Arial, sans-serif" font-size="11" font-weight="800" fill="white" letter-spacing="1">BCA</text>
		<!-- chip rectangle -->
		<rect x="10" y="24" width="10" height="7" rx="1.5" fill="#f0c040" opacity="0.9" />
		<line x1="10" y1="27.5" x2="20" y2="27.5" stroke="#c8920a" stroke-width="0.75" />
		<line x1="15" y1="24" x2="15" y2="31" stroke="#c8920a" stroke-width="0.75" />
		<!-- DEBIT label -->
		<text x="34" y="34" text-anchor="middle" font-family="Arial, sans-serif" font-size="5.5" font-weight="600" fill="#a8d4ff" letter-spacing="0.5">DEBIT</text>
	</svg>
{:else}
	<!-- BCA Credit Card: dark slate + gold accent -->
	<svg
		width={size}
		height={size}
		viewBox="0 0 44 44"
		fill="none"
		xmlns="http://www.w3.org/2000/svg"
		class="shrink-0"
	>
		<rect width="44" height="44" rx="10" fill="url(#bca-cc-grad)" />
		<defs>
			<linearGradient id="bca-cc-grad" x1="0" y1="0" x2="44" y2="44" gradientUnits="userSpaceOnUse">
				<stop offset="0%" stop-color="#1a1a2e" />
				<stop offset="100%" stop-color="#2d2d5e" />
			</linearGradient>
		</defs>
		<!-- decorative circles (Mastercard-style) -->
		<circle cx="27" cy="30" r="6" fill="#e63946" opacity="0.85" />
		<circle cx="33" cy="30" r="6" fill="#f4a261" opacity="0.85" />
		<!-- BCA wordmark -->
		<text x="22" y="20" text-anchor="middle" font-family="Arial, sans-serif" font-size="11" font-weight="800" fill="white" letter-spacing="1">BCA</text>
		<!-- CC label -->
		<text x="11" y="34" text-anchor="middle" font-family="Arial, sans-serif" font-size="5.5" font-weight="600" fill="#f4d03f" letter-spacing="0.5">CC</text>
	</svg>
{/if}
