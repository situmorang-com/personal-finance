import { db } from './index';
import { currencies, users } from './schema';
import { eq } from 'drizzle-orm';

const DEFAULT_CURRENCIES = [
	{ code: 'IDR', symbol: 'Rp', name: 'Indonesian Rupiah' },
	{ code: 'USD', symbol: '$', name: 'US Dollar' },
	{ code: 'EUR', symbol: '€', name: 'Euro' },
	{ code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' }
];

const MAIN_CURRENCY_CODE = 'IDR';
const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

export function ensureDefaultCurrencies(userId: string) {
	const existing = db.select().from(currencies).where(eq(currencies.userId, userId)).all();
	if (existing.length > 0) return existing;

	const inserted = DEFAULT_CURRENCIES.map((c) =>
		db
			.insert(currencies)
			.values({ ...c, userId, rate: 1 })
			.returning()
			.get()
	);

	const main = inserted.find((c) => c.code === MAIN_CURRENCY_CODE) ?? inserted[0];
	db.update(users).set({ mainCurrencyId: main.id }).where(eq(users.id, userId)).run();

	return inserted;
}

export function getMainCurrency(userId: string, allCurrencies: (typeof currencies.$inferSelect)[]) {
	const user = db.select().from(users).where(eq(users.id, userId)).get();
	return (
		allCurrencies.find((c) => c.id === user?.mainCurrencyId) ??
		allCurrencies.find((c) => c.code === MAIN_CURRENCY_CODE) ??
		allCurrencies[0]
	);
}

export function convertToMain(
	amount: number,
	currencyId: number | null,
	allCurrencies: (typeof currencies.$inferSelect)[],
	mainCurrency: typeof currencies.$inferSelect
) {
	if (!currencyId || currencyId === mainCurrency.id) return amount;
	const currency = allCurrencies.find((c) => c.id === currencyId);
	if (!currency || currency.rate <= 0) return amount;
	return amount / currency.rate;
}

export async function refreshRatesIfStale(userId: string) {
	const user = db.select().from(users).where(eq(users.id, userId)).get();
	if (!user) return;

	const lastUpdate = user.ratesUpdatedAt ? new Date(user.ratesUpdatedAt).getTime() : 0;
	if (Date.now() - lastUpdate < STALE_AFTER_MS) return;

	const allCurrencies = db.select().from(currencies).where(eq(currencies.userId, userId)).all();
	const main = getMainCurrency(userId, allCurrencies);
	if (!main) return;

	const others = allCurrencies.filter((c) => c.id !== main.id);
	if (others.length === 0) return;

	try {
		const symbols = others.map((c) => c.code).join(',');
		const res = await fetch(
			`https://api.frankfurter.dev/v1/latest?base=${main.code}&symbols=${symbols}`
		);
		if (!res.ok) return;
		const data = (await res.json()) as { rates: Record<string, number> };

		for (const currency of others) {
			const rate = data.rates[currency.code];
			if (typeof rate === 'number' && rate > 0) {
				db.update(currencies).set({ rate }).where(eq(currencies.id, currency.id)).run();
			}
		}
		db.update(users)
			.set({ ratesUpdatedAt: new Date().toISOString() })
			.where(eq(users.id, userId))
			.run();
	} catch {
		// Network/API failure — keep stale rates, try again next load.
	}
}
