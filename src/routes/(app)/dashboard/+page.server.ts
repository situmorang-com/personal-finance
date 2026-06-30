import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { categories, currencies, expenses, subscriptions, users } from '$lib/server/db/schema';
import { ensureDefaultCategories } from '$lib/server/db/categories';
import { ensureDefaultCurrencies, getMainCurrency, refreshRatesIfStale } from '$lib/server/db/currencies';
import { eq } from 'drizzle-orm';

export const load: PageServerLoad = async (event) => {
	const session = await event.locals.auth();
	if (!session?.user) throw redirect(303, '/login');
	const userId = session.user.id;

	ensureDefaultCategories(userId);
	ensureDefaultCurrencies(userId);
	refreshRatesIfStale(userId); // fire-and-forget — don't block page load

	const subs = db.select().from(subscriptions).where(eq(subscriptions.userId, userId)).all();
	const exps = db.select().from(expenses).where(eq(expenses.userId, userId)).all();
	const cats = db.select().from(categories).where(eq(categories.userId, userId)).all();
	const currs = db.select().from(currencies).where(eq(currencies.userId, userId)).all();
	const mainCurrency = getMainCurrency(userId, currs);
	const user = db.select().from(users).where(eq(users.id, userId)).get();

	return {
		subscriptions: subs,
		expenses: exps,
		categories: cats,
		currencies: currs,
		mainCurrency,
		monthlyBudget: user?.monthlyBudget ?? null
	};
};

export const actions: Actions = {
	setBudget: async (event) => {
		const session = await event.locals.auth();
		if (!session?.user) return;
		const userId = session.user.id;

		const form = await event.request.formData();
		const value = form.get('monthlyBudget')?.toString().trim();
		const budget = value ? Number(value) : null;

		db.update(users)
			.set({ monthlyBudget: budget && !isNaN(budget) ? budget : null })
			.where(eq(users.id, userId))
			.run();
	}
};
