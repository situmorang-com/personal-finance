// Svelte action: animates a number from 0 to the target value on mount / value change.
// Usage: <p use:countUp={{ value: 12500, format: (n) => formatMoney(n, currency) }}>
export function countUp(
	node: HTMLElement,
	params: { value: number; format?: (n: number) => string; duration?: number }
) {
	let raf: number;
	let current = params.value;

	function animate(from: number, to: number, duration: number) {
		cancelAnimationFrame(raf);
		const start = performance.now();
		const format = params.format ?? ((n: number) => String(Math.round(n)));

		function tick(now: number) {
			const elapsed = now - start;
			const t = Math.min(elapsed / duration, 1);
			const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
			const value = from + (to - from) * eased;
			node.textContent = format(value);
			if (t < 1) raf = requestAnimationFrame(tick);
		}
		raf = requestAnimationFrame(tick);
	}

	animate(0, params.value, params.duration ?? 900);
	current = params.value;

	return {
		update(next: typeof params) {
			if (next.value !== current) {
				animate(current, next.value, next.duration ?? 700);
				current = next.value;
			}
		},
		destroy() {
			cancelAnimationFrame(raf);
		}
	};
}
