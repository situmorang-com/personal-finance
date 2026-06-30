export type Currency = { id: number; code: string; symbol: string; name: string; rate: number };

export function convertToMain(amount: number, currencyId: number | null, currencies: Currency[], mainCurrency: Currency) {
	if (!currencyId || currencyId === mainCurrency.id) return amount;
	const currency = currencies.find((c) => c.id === currencyId);
	if (!currency || currency.rate <= 0) return amount;
	return amount / currency.rate;
}

export function formatMoney(amount: number, currency: Currency | undefined) {
	const symbol = currency?.symbol ?? '';
	const decimals = currency?.code === 'IDR' ? 0 : 2;
	return `${symbol}${amount.toLocaleString(undefined, {
		minimumFractionDigits: decimals,
		maximumFractionDigits: decimals
	})}`;
}

// Compact form for dense secondary lines, e.g. Rp1.2M, $1.5k, €240.
export function formatMoneyCompact(amount: number, currency: Currency | undefined) {
	const symbol = currency?.symbol ?? '';
	const abs = Math.abs(amount);
	let value: string;
	if (abs >= 1_000_000) value = `${(amount / 1_000_000).toFixed(amount % 1_000_000 === 0 ? 0 : 1)}M`;
	else if (abs >= 1_000) value = `${(amount / 1_000).toFixed(amount % 1_000 === 0 ? 0 : 1)}k`;
	else value = amount.toLocaleString(undefined, { maximumFractionDigits: currency?.code === 'IDR' ? 0 : 2 });
	return `${symbol}${value}`;
}

export function monthlyEquivalent(price: number, cycle: string) {
	switch (cycle) {
		case 'yearly':
			return price / 12;
		case 'weekly':
			return (price * 52) / 12;
		case 'quarterly':
			return price / 3;
		default:
			return price;
	}
}
