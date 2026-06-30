import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { categories, currencies, PAYMENT_METHODS, subscriptions, type PaymentMethod } from '$lib/server/db/schema';
import { ensureDefaultCategories } from '$lib/server/db/categories';
import { ensureDefaultCurrencies, getMainCurrency, refreshRatesIfStale } from '$lib/server/db/currencies';
import { and, eq } from 'drizzle-orm';

export const load: PageServerLoad = async (event) => {
	const session = await event.locals.auth();
	if (!session?.user) throw redirect(303, '/login');
	const userId = session.user.id;

	ensureDefaultCategories(userId);
	ensureDefaultCurrencies(userId);
	refreshRatesIfStale(userId); // fire-and-forget — don't block page load

	const subs = db
		.select()
		.from(subscriptions)
		.where(eq(subscriptions.userId, userId))
		.orderBy(subscriptions.nextRenewal)
		.all();
	const cats = db.select().from(categories).where(eq(categories.userId, userId)).all();
	const currs = db.select().from(currencies).where(eq(currencies.userId, userId)).all();
	const mainCurrency = getMainCurrency(userId, currs);

	return { subscriptions: subs, categories: cats, currencies: currs, mainCurrency };
};

function readPaymentMethod(form: FormData): PaymentMethod | null {
	const value = form.get('paymentMethod')?.toString();
	return value && (PAYMENT_METHODS as readonly string[]).includes(value) ? (value as PaymentMethod) : null;
}

export const actions: Actions = {
	create: async (event) => {
		const session = await event.locals.auth();
		if (!session?.user) return fail(401);
		const userId = session.user.id;

		const form = await event.request.formData();
		const name = form.get('name')?.toString().trim();
		const price = Number(form.get('price'));
		const billingCycle = form.get('billingCycle')?.toString() as
			| 'monthly'
			| 'yearly'
			| 'weekly'
			| 'quarterly';
		const nextRenewal = form.get('nextRenewal')?.toString();
		const categoryId = form.get('categoryId') ? Number(form.get('categoryId')) : null;
		const currencyId = form.get('currencyId') ? Number(form.get('currencyId')) : null;
		const website = form.get('website')?.toString().trim() || null;
		const paymentMethod = readPaymentMethod(form);
		const notes = form.get('notes')?.toString() || null;
		const cancelUrl = form.get('cancelUrl')?.toString().trim() || null;
		const isTrial = form.get('isTrial') === 'on';

		if (!name || !nextRenewal || Number.isNaN(price) || price < 0) {
			return fail(400, { error: 'Please fill in all required fields.' });
		}

		db.insert(subscriptions)
			.values({
				userId,
				name,
				price,
				billingCycle,
				nextRenewal,
				categoryId,
				currencyId,
				website,
				paymentMethod,
				notes,
				cancelUrl,
				isTrial
			})
			.run();

		return { success: true };
	},

	update: async (event) => {
		const session = await event.locals.auth();
		if (!session?.user) return fail(401);
		const userId = session.user.id;

		const form = await event.request.formData();
		const id = Number(form.get('id'));
		const name = form.get('name')?.toString().trim();
		const price = Number(form.get('price'));
		const billingCycle = form.get('billingCycle')?.toString() as
			| 'monthly'
			| 'yearly'
			| 'weekly'
			| 'quarterly';
		const nextRenewal = form.get('nextRenewal')?.toString();
		const categoryId = form.get('categoryId') ? Number(form.get('categoryId')) : null;
		const currencyId = form.get('currencyId') ? Number(form.get('currencyId')) : null;
		const website = form.get('website')?.toString().trim() || null;
		const paymentMethod = readPaymentMethod(form);
		const notes = form.get('notes')?.toString() || null;
		const active = form.get('active') === 'on';
		const cancelUrl = form.get('cancelUrl')?.toString().trim() || null;
		const isTrial = form.get('isTrial') === 'on';

		if (!id || !name || !nextRenewal || Number.isNaN(price) || price < 0) {
			return fail(400, { error: 'Please fill in all required fields.' });
		}

		db.update(subscriptions)
			.set({
				name,
				price,
				billingCycle,
				nextRenewal,
				categoryId,
				currencyId,
				website,
				paymentMethod,
				notes,
				active,
				cancelUrl,
				isTrial
			})
			.where(and(eq(subscriptions.id, id), eq(subscriptions.userId, userId)))
			.run();

		return { success: true };
	},

	delete: async (event) => {
		const session = await event.locals.auth();
		if (!session?.user) return fail(401);
		const userId = session.user.id;

		const form = await event.request.formData();
		const id = Number(form.get('id'));

		db.delete(subscriptions)
			.where(and(eq(subscriptions.id, id), eq(subscriptions.userId, userId)))
			.run();

		return { success: true };
	}
};
