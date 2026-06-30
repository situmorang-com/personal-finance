import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { categories, currencies, expenses } from '$lib/server/db/schema';
import { ensureDefaultCategories } from '$lib/server/db/categories';
import { ensureDefaultCurrencies, getMainCurrency, refreshRatesIfStale } from '$lib/server/db/currencies';
import { and, desc, eq, like, inArray } from 'drizzle-orm';
import { parseBCAStatement } from '$lib/server/parsers/bca-statement';
import { guessCategory, loadKeywordRules, ensureCategoryRuleCategories, learnCategoryAssignment, computeCategorySuggestions } from '$lib/server/categorizer';
import {
	getUserTags,
	getExpenseTagMap,
	createTag,
	applyTagToExpenses,
	removeTagFromExpense,
	computeSuggestions,
	applyAllSuggestions
} from '$lib/server/tags';

// ── Insight types ───────────────────────────────────────────────────────────
type Expense = { id: number; name: string; amount: number; date: string; direction: string; categoryId: number | null };
type Category = { id: number; name: string; color: string; monthlyBudget: number | null };

export type ExpenseInsights = {
	thisMonth: { total: number; income: number; txnCount: number; dailyAvg: number };
	lastMonth: { total: number; income: number };
	biggestExpense: { name: string; amount: number; date: string } | null;
	topCategory: { name: string; color: string; total: number; pct: number } | null;
	anomalies: { categoryName: string; color: string; thisMonth: number; lastMonth: number; pctChange: number }[];
	newRecurring: { name: string; count: number; avgAmount: number }[];
	categorySlices: { label: string; value: number; color: string }[];
	budgets: { categoryId: number; name: string; color: string; spent: number; budget: number; pct: number }[];
};

function computeInsights(items: Expense[], cats: Category[]): ExpenseInsights {
	const now = new Date();
	const thisYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
	// Last month
	const lastDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
	const lastYM = `${lastDate.getFullYear()}-${String(lastDate.getMonth() + 1).padStart(2, '0')}`;

	const thisMonthExp = items.filter(e => e.date.startsWith(thisYM));
	const lastMonthExp = items.filter(e => e.date.startsWith(lastYM));

	// If no current-month data, use the most recent month in the dataset
	const allMonths = [...new Set(items.map(e => e.date.slice(0, 7)))].sort();
	const activeYM = thisMonthExp.length > 0 ? thisYM : (allMonths.at(-1) ?? thisYM);
	const prevYM = (() => {
		const idx = allMonths.indexOf(activeYM);
		return idx > 0 ? allMonths[idx - 1] : null;
	})();

	const active = items.filter(e => e.date.startsWith(activeYM));
	const prev = prevYM ? items.filter(e => e.date.startsWith(prevYM)) : [];

	const sum = (arr: Expense[], dir: string) => arr.filter(e => e.direction === dir).reduce((s, e) => s + e.amount, 0);
	const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
	const daysElapsed = activeYM === thisYM ? now.getDate() : daysInMonth;

	const thisTotal = sum(active, 'expense');
	const thisIncome = sum(active, 'income');
	const prevTotal = sum(prev, 'expense');
	const prevIncome = sum(prev, 'income');

	// Biggest single expense
	const biggest = active
		.filter(e => e.direction === 'expense')
		.sort((a, b) => b.amount - a.amount)[0] ?? null;

	// Top category by spend this period
	const catTotals: Record<number, number> = {};
	for (const e of active.filter(e => e.direction === 'expense' && e.categoryId)) {
		catTotals[e.categoryId!] = (catTotals[e.categoryId!] ?? 0) + e.amount;
	}
	const topCatId = Object.entries(catTotals).sort((a, b) => +b[1] - +a[1])[0]?.[0];
	const topCat = topCatId ? cats.find(c => c.id === +topCatId) : null;
	const topCatTotal = topCatId ? catTotals[+topCatId] : 0;

	// Anomalies: categories where this month > last month by 20%+
	const prevCatTotals: Record<number, number> = {};
	for (const e of prev.filter(e => e.direction === 'expense' && e.categoryId)) {
		prevCatTotals[e.categoryId!] = (prevCatTotals[e.categoryId!] ?? 0) + e.amount;
	}
	const anomalies = Object.entries(catTotals)
		.filter(([catId, total]) => {
			const prevTotal = prevCatTotals[+catId] ?? 0;
			return prevTotal > 0 && total > prevTotal * 1.2;
		})
		.map(([catId, total]) => {
			const cat = cats.find(c => c.id === +catId);
			const prev = prevCatTotals[+catId] ?? 0;
			return {
				categoryName: cat?.name ?? 'Unknown',
				color: cat?.color ?? '#64748b',
				thisMonth: total,
				lastMonth: prev,
				pctChange: Math.round(((total - prev) / prev) * 100)
			};
		})
		.sort((a, b) => b.pctChange - a.pctChange)
		.slice(0, 3);

	// New recurring: merchant appearing 3+ times this month with consistent amounts
	const merchantFreq: Record<string, number[]> = {};
	for (const e of active.filter(e => e.direction === 'expense')) {
		const key = e.name.trim().toLowerCase();
		(merchantFreq[key] ??= []).push(e.amount);
	}
	// Check which of these appeared in prev month
	const prevMerchants = new Set(prev.map(e => e.name.trim().toLowerCase()));
	const newRecurring = Object.entries(merchantFreq)
		.filter(([key, amounts]) => amounts.length >= 3 && !prevMerchants.has(key))
		.map(([, amounts]) => {
			const sample = active.find(e => e.name.trim().toLowerCase() === Object.keys(merchantFreq).find(k => merchantFreq[k] === amounts));
			return {
				name: active.find(e => merchantFreq[e.name.trim().toLowerCase()] === amounts)?.name ?? '',
				count: amounts.length,
				avgAmount: Math.round(amounts.reduce((s, a) => s + a, 0) / amounts.length)
			};
		})
		.filter(r => r.name)
		.sort((a, b) => b.count - a.count)
		.slice(0, 3);

	return {
		thisMonth: {
			total: thisTotal,
			income: thisIncome,
			txnCount: active.filter(e => e.direction === 'expense').length,
			dailyAvg: daysElapsed > 0 ? Math.round(thisTotal / daysElapsed) : 0
		},
		lastMonth: { total: prevTotal, income: prevIncome },
		biggestExpense: biggest ? { name: biggest.name, amount: biggest.amount, date: biggest.date } : null,
		topCategory: topCat ? { name: topCat.name, color: topCat.color, total: topCatTotal, pct: Math.round((topCatTotal / thisTotal) * 100) } : null,
		anomalies,
		newRecurring,
		categorySlices: Object.entries(catTotals)
			.map(([catId, value]) => {
				const cat = cats.find(c => c.id === +catId);
				return { label: cat?.name ?? 'Other', value, color: cat?.color ?? '#64748b' };
			})
			.sort((a, b) => b.value - a.value)
			.slice(0, 8),
		budgets: cats
			.filter(c => c.monthlyBudget && c.monthlyBudget > 0)
			.map(c => ({
				categoryId: c.id,
				name: c.name,
				color: c.color,
				spent: catTotals[c.id] ?? 0,
				budget: c.monthlyBudget!,
				pct: Math.round(((catTotals[c.id] ?? 0) / c.monthlyBudget!) * 100)
			}))
			.sort((a, b) => b.pct - a.pct)
	};
}

export const load: PageServerLoad = async (event) => {
	const session = await event.locals.auth();
	if (!session?.user) throw redirect(303, '/login');
	const userId = session.user.id;

	ensureDefaultCategories(userId);
	ensureCategoryRuleCategories(userId);
	ensureDefaultCurrencies(userId);
	refreshRatesIfStale(userId); // fire-and-forget — don't block page load

	const items = db
		.select()
		.from(expenses)
		.where(eq(expenses.userId, userId))
		.orderBy(desc(expenses.date))
		.all();
	const cats = db.select().from(categories).where(eq(categories.userId, userId)).all();
	const currs = db.select().from(currencies).where(eq(currencies.userId, userId)).all();
	const mainCurrency = getMainCurrency(userId, currs);

	// Derive upload batches from expense importRef: "[bca-debit-1234567890] filename.pdf"
	type Batch = { importId: string; filename: string; count: number; cardType: string; ts: number };
	const batchMap = new Map<string, Batch>();
	for (const exp of items) {
		const m = exp.importRef?.match(/^\[(bca-(debit|cc)-(\d+))\]\s*(.*)/);
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

	// ── Expense insights ────────────────────────────────────────────────────
	const insights = computeInsights(items, cats);

	return {
		expenses: items,
		categories: cats,
		currencies: currs,
		mainCurrency,
		importBatches,
		tags: userTags,
		expenseTagMap,
		suggestions,
		categorySuggestions,
		insights
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

	// Re-insert a previously deleted expense (used by the undo toast). Does not preserve the original id.
	restore: async (event) => {
		const session = await event.locals.auth();
		if (!session?.user) return fail(401);
		const userId = session.user.id;

		const form = await event.request.formData();
		const name = form.get('name')?.toString();
		const amount = Number(form.get('amount'));
		const date = form.get('date')?.toString();
		if (!name || !date || Number.isNaN(amount)) return fail(400, { error: 'Invalid data.' });

		const categoryId = form.get('categoryId') ? Number(form.get('categoryId')) : null;
		const currencyId = form.get('currencyId') ? Number(form.get('currencyId')) : null;
		const direction = (form.get('direction')?.toString() as 'expense' | 'income') || 'expense';
		const sourceType = form.get('sourceType')?.toString() || 'manual';
		const recipient = form.get('recipient')?.toString() || null;
		const remark = form.get('remark')?.toString() || null;
		const notes = form.get('notes')?.toString() || null;
		const importRef = form.get('importRef')?.toString() || null;

		db.insert(expenses).values({
			userId, name, amount, date, categoryId, currencyId,
			direction: direction as any, sourceType: sourceType as any,
			recipient, remark, notes, importRef
		}).run();

		return { success: true };
	},

	bulkDelete: async (event) => {
		const session = await event.locals.auth();
		if (!session?.user) return fail(401);
		const userId = session.user.id;

		const form = await event.request.formData();
		const ids = (form.get('ids')?.toString() || '').split(',').map(Number).filter((n) => !Number.isNaN(n));
		if (ids.length === 0) return fail(400, { error: 'No transactions selected.' });

		const result = db.delete(expenses)
			.where(and(eq(expenses.userId, userId), inArray(expenses.id, ids)))
			.run();

		return { success: true, message: `Deleted ${result.changes} transaction${result.changes !== 1 ? 's' : ''}.` };
	},

	bulkSetCategory: async (event) => {
		const session = await event.locals.auth();
		if (!session?.user) return fail(401);
		const userId = session.user.id;

		const form = await event.request.formData();
		const ids = (form.get('ids')?.toString() || '').split(',').map(Number).filter((n) => !Number.isNaN(n));
		const categoryId = Number(form.get('categoryId'));
		if (ids.length === 0 || !categoryId) return fail(400, { error: 'Missing transactions or category.' });

		db.update(expenses)
			.set({ categoryId })
			.where(and(eq(expenses.userId, userId), inArray(expenses.id, ids)))
			.run();

		// Learn the merchant → category preference for each unique merchant in the batch
		const touched = db.select({ id: expenses.id, name: expenses.name })
			.from(expenses)
			.where(and(eq(expenses.userId, userId), inArray(expenses.id, ids)))
			.all();
		const seen = new Set<string>();
		for (const exp of touched) {
			const key = exp.name.trim().toLowerCase();
			if (seen.has(key)) continue;
			seen.add(key);
			learnCategoryAssignment(userId, exp.id, categoryId);
		}

		return { success: true, message: `Re-categorized ${ids.length} transaction${ids.length !== 1 ? 's' : ''}.` };
	},

	duplicate: async (event) => {
		const session = await event.locals.auth();
		if (!session?.user) return fail(401);
		const userId = session.user.id;

		const form = await event.request.formData();
		const id = Number(form.get('id'));
		const original = db.select().from(expenses).where(and(eq(expenses.id, id), eq(expenses.userId, userId))).get();
		if (!original) return fail(404, { error: 'Transaction not found.' });

		const today = new Date().toISOString().slice(0, 10);
		const inserted = db.insert(expenses).values({
			userId,
			categoryId: original.categoryId,
			currencyId: original.currencyId,
			name: original.name,
			amount: original.amount,
			date: today,
			direction: original.direction,
			sourceType: 'manual',
			recipient: original.recipient,
			remark: original.remark,
			notes: original.notes
		}).run();

		return { success: true, message: 'Transaction duplicated.', id: Number(inserted.lastInsertRowid) };
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

			// Load keyword rules once for the whole batch
			const keywordRules = loadKeywordRules(userId);

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
					const guessedName = guessCategory(tx.merchant, tx.remark, tx.rawType, keywordRules);
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
						importRef: `[${importId}] ${file.name}`
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
			.where(and(eq(expenses.userId, userId), like(expenses.importRef, `[${importId}]%`)))
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
