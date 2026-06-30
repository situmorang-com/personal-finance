import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { categories, currencies, expenses } from '$lib/server/db/schema';
import { ensureDefaultCategories } from '$lib/server/db/categories';
import { ensureDefaultCurrencies, getMainCurrency, refreshRatesIfStale } from '$lib/server/db/currencies';
import { and, desc, eq, like, inArray } from 'drizzle-orm';
import { parseBCAStatement } from '$lib/server/parsers/bca-statement';
import { guessCategory, ensureCategoryRuleCategories } from '$lib/server/categorizer';
import {
	getUserTags,
	getExpenseTagMap,
	createTag,
	applyTagToExpenses,
	removeTagFromExpense,
	computeSuggestions,
	applyAllSuggestions
} from '$lib/server/tags';
import {
	learnCategoryAssignment,
	computeCategorySuggestions
} from '$lib/server/categorizer';

export const load: PageServerLoad = async (event) => {
	const session = await event.locals.auth();
	if (!session?.user) throw redirect(303, '/login');
	const userId = session.user.id;

	ensureDefaultCategories(userId);
	ensureDefaultCurrencies(userId);
	await refreshRatesIfStale(userId);

	const items = db
		.select()
		.from(expenses)
		.where(eq(expenses.userId, userId))
		.orderBy(desc(expenses.date))
		.all();
	const cats = db.select().from(categories).where(eq(categories.userId, userId)).all();
	const currs = db.select().from(currencies).where(eq(currencies.userId, userId)).all();
	const mainCurrency = getMainCurrency(userId, currs);

	// Derive upload batches from expense notes: "[bca-debit-1234567890] filename.pdf"
	type Batch = { importId: string; filename: string; count: number; cardType: string; ts: number };
	const batchMap = new Map<string, Batch>();
	for (const exp of items) {
		const m = exp.notes?.match(/^\[(bca-(debit|cc)-(\d+))\]\s*(.*)/);
		if (!m) continue;
		const [, importId, cardType, tsStr, filename] = m;
		const ts = Number(tsStr);
		if (!batchMap.has(importId)) {
			batchMap.set(importId, { importId, filename, count: 0, cardType, ts });
		}
		batchMap.get(importId)!.count++;
	}
	const importBatches = [...batchMap.values()].sort((a, b) => b.ts - a.ts);

	const userTags = getUserTags(userId);
	const expenseTagMap = getExpenseTagMap(userId);
	const suggestions = computeSuggestions(userId);
	const categorySuggestions = computeCategorySuggestions(userId);

	return {
		expenses: items,
		categories: cats,
		currencies: currs,
		mainCurrency,
		importBatches,
		tags: userTags,
		expenseTagMap,
		suggestions,
		categorySuggestions
	};
};

export const actions: Actions = {
	create: async (event) => {
		const session = await event.locals.auth();
		if (!session?.user) return fail(401);
		const userId = session.user.id;

		const form = await event.request.formData();
		const name = form.get('name')?.toString().trim();
		const amount = Number(form.get('amount'));
		const date = form.get('date')?.toString();
		const categoryId = form.get('categoryId') ? Number(form.get('categoryId')) : null;
		const currencyId = form.get('currencyId') ? Number(form.get('currencyId')) : null;
		const notes = form.get('notes')?.toString() || null;

		if (!name || !date || Number.isNaN(amount) || amount < 0) {
			return fail(400, { error: 'Please fill in all required fields.' });
		}

		db.insert(expenses).values({ userId, name, amount, date, categoryId, currencyId, notes }).run();

		return { success: true };
	},

	update: async (event) => {
		const session = await event.locals.auth();
		if (!session?.user) return fail(401);
		const userId = session.user.id;

		const form = await event.request.formData();
		const id = Number(form.get('id'));
		const name = form.get('name')?.toString().trim();
		const amount = Number(form.get('amount'));
		const date = form.get('date')?.toString();
		const categoryId = form.get('categoryId') ? Number(form.get('categoryId')) : null;
		const currencyId = form.get('currencyId') ? Number(form.get('currencyId')) : null;
		const notes = form.get('notes')?.toString() || null;

		if (!id || !name || !date || Number.isNaN(amount) || amount < 0) {
			return fail(400, { error: 'Please fill in all required fields.' });
		}

		// Get the old category to detect if it changed
		const oldExp = db.select({ categoryId: expenses.categoryId }).from(expenses).where(eq(expenses.id, id)).get();

		db.update(expenses)
			.set({ name, amount, date, categoryId, currencyId, notes })
			.where(and(eq(expenses.id, id), eq(expenses.userId, userId)))
			.run();

		// If category was manually changed, learn the preference
		if (categoryId && oldExp?.categoryId !== categoryId) {
			learnCategoryAssignment(userId, id, categoryId);
		}

		return { success: true };
	},

	delete: async (event) => {
		const session = await event.locals.auth();
		if (!session?.user) return fail(401);
		const userId = session.user.id;

		const form = await event.request.formData();
		const id = Number(form.get('id'));

		db.delete(expenses)
			.where(and(eq(expenses.id, id), eq(expenses.userId, userId)))
			.run();

		return { success: true };
	},

	uploadStatement: async (event) => {
		const session = await event.locals.auth();
		if (!session?.user) return fail(401);
		const userId = session.user.id;

		const form = await event.request.formData();
		const file = form.get('file') as File;

		if (!file || file.type !== 'application/pdf') {
			return fail(400, { error: 'Please upload a PDF file.' });
		}

		try {
			const buffer = await file.arrayBuffer();
			const transactions = await parseBCAStatement(Buffer.from(buffer));

			// Get main currency (IDR for BCA)
			const currs = db.select().from(currencies).where(eq(currencies.userId, userId)).all();
			const mainCurrency = getMainCurrency(userId, currs);

			// Ensure all rule-based categories exist
			const categoryMap = ensureCategoryRuleCategories(userId);
			if (!categoryMap.has('Bank')) {
				db.insert(categories).values({ userId, name: 'Bank', color: '#06b6d4' }).run();
				const bc = db.select().from(categories)
					.where(and(eq(categories.userId, userId), eq(categories.name, 'Bank'))).get();
				if (bc) categoryMap.set('Bank', bc.id);
			}

			// Unique tag so this batch can be deleted later
			const cardType = (form.get('cardType')?.toString() || 'debit').replace(/[^a-z]/g, '');
			const importId = `bca-${cardType}-${Date.now()}`;

			// Insert ALL transactions (income + expenses), deduplicated
			let inserted = 0;
			for (const tx of transactions) {
				const existing = db.select().from(expenses)
					.where(and(
						eq(expenses.userId, userId),
						eq(expenses.date, tx.date),
						eq(expenses.amount, tx.amount),
						eq(expenses.name, tx.merchant)
					)).get();

				if (!existing) {
					const guessedName = guessCategory(tx.merchant, tx.remark, tx.rawType);
					const categoryId = guessedName
						? (categoryMap.get(guessedName) ?? categoryMap.get('Bank') ?? null)
						: (categoryMap.get('Bank') ?? null);

					db.insert(expenses).values({
						userId,
						name: tx.merchant,
						amount: tx.amount,
						date: tx.date,
						direction: tx.direction,
						sourceType: tx.sourceType,
						recipient: tx.recipient,
						remark: tx.remark,
						categoryId,
						currencyId: mainCurrency.id,
						notes: `[${importId}] ${file.name}`
					}).run();
					inserted++;
				}
			}

			const expenseCount = transactions.filter((t) => t.direction === 'expense').length;
			const incomeCount = transactions.filter((t) => t.direction === 'income').length;
			return {
				success: true,
				message: `Imported ${inserted} transactions (${expenseCount} expenses, ${incomeCount} income).`,
				importId,
				inserted
			};
		} catch (error) {
			console.error('PDF parsing error:', error);
			return fail(400, {
				error: 'Failed to parse PDF. Please make sure it is a valid BCA statement.'
			});
		}
	},

	undoImport: async (event) => {
		const session = await event.locals.auth();
		if (!session?.user) return fail(401);
		const userId = session.user.id;

		const form = await event.request.formData();
		const importId = form.get('importId')?.toString();

		if (!importId || !importId.startsWith('bca-')) return fail(400, { error: 'Invalid import ID.' });

		const result = db
			.delete(expenses)
			.where(and(eq(expenses.userId, userId), like(expenses.notes, `[${importId}]%`)))
			.run();

		return { success: true, message: `Removed ${result.changes} imported transactions.` };
	},

	createTag: async (event) => {
		const session = await event.locals.auth();
		if (!session?.user) return fail(401);
		const form = await event.request.formData();
		const name = form.get('name')?.toString().trim();
		const color = form.get('color')?.toString() || '#6366f1';
		if (!name) return fail(400, { error: 'Tag name required.' });
		const tag = createTag(session.user.id, name, color);
		return { success: true, tag };
	},

	// Apply a tag to one or more expenses (individual or bulk). Learns a rule per merchant.
	applyTag: async (event) => {
		const session = await event.locals.auth();
		if (!session?.user) return fail(401);
		const form = await event.request.formData();
		const tagId = Number(form.get('tagId'));
		const expenseIds = (form.get('expenseIds')?.toString() || '')
			.split(',')
			.map(Number)
			.filter((n) => !Number.isNaN(n));
		if (!tagId || expenseIds.length === 0) return fail(400, { error: 'Missing tag or expenses.' });
		applyTagToExpenses(session.user.id, tagId, expenseIds);
		return { success: true, message: `Tagged ${expenseIds.length} transaction${expenseIds.length > 1 ? 's' : ''}.` };
	},

	removeTag: async (event) => {
		const session = await event.locals.auth();
		if (!session?.user) return fail(401);
		const form = await event.request.formData();
		const tagId = Number(form.get('tagId'));
		const expenseId = Number(form.get('expenseId'));
		if (!tagId || !expenseId) return fail(400);
		removeTagFromExpense(session.user.id, tagId, expenseId);
		return { success: true };
	},

	applySuggestions: async (event) => {
		const session = await event.locals.auth();
		if (!session?.user) return fail(401);
		const count = applyAllSuggestions(session.user.id);
		return { success: true, message: `Applied ${count} suggested tag${count !== 1 ? 's' : ''}.` };
	},

	applyCategorySuggestions: async (event) => {
		const session = await event.locals.auth();
		if (!session?.user) return fail(401);
		const userId = session.user.id;
		const suggestions = computeCategorySuggestions(userId);
		let count = 0;
		for (const s of suggestions) {
			db.update(expenses)
				.set({ categoryId: s.categoryId })
				.where(and(eq(expenses.userId, userId), inArray(expenses.id, s.expenseIds)))
				.run();
			count += s.expenseIds.length;
		}
		return { success: true, message: `Applied ${count} suggested categor${count !== 1 ? 'ies' : 'y'}.` };
	}
};
