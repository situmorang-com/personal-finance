const PALETTE = ['#6366f1', '#ec4899', '#f59e0b', '#22c55e', '#0ea5e9', '#8b5cf6', '#ef4444', '#14b8a6'];

export function hashColor(seed: string) {
	let hash = 0;
	for (let i = 0; i < seed.length; i++) {
		hash = (hash << 5) - hash + seed.charCodeAt(i);
		hash |= 0;
	}
	return PALETTE[Math.abs(hash) % PALETTE.length];
}
