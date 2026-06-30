import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { categories, expenses, tags, expenseTags, tagRules, categoryRules, categoryKeywords } from '$lib/server/db/schema';
import { and, eq } from 'drizzle-orm';
import { ensureCategoryRuleCategories } from '$lib/server/categorizer';

export const load: PageServerLoad = async (event) => {
	const session = await event.locals.auth();
	if (!session?.user) throw redirect(303, '/login');
	const userId = session.user.id;

	ensureCategoryRuleCategories(userId);
	const cats = db.select().from(categories).where(eq(categories.userId, userId)).all();
	const userTags = db.select().from(tags).where(eq(tags.userId, userId)).all();

	// Count how many expenses use each category
	const allExpenses = db
		.select({ id: expenses.id, categoryId: expenses.categoryId })
		.from(expenses)
		.where(eq(expenses.userId, userId))
		.all();
	const catCount: Record<number, number> = {};
	for (const e of allExpenses) {
		if (e.categoryId) catCount[e.categoryId] = (catCount[e.categoryId] ?? 0) + 1;
	}

	// Count how many expenses use each tag
	const tagLinks = db
		.select({ tagId: expenseTags.tagId })
		.from(expenseTags)
		.innerJoin(expenses, eq(expenses.id, expenseTags.expenseId))
		.where(eq(expenses.userId, userId))
		.all();
	const tagCount: Record<number, number> = {};
	for (const t of tagLinks) {
		tagCount[t.tagId] = (tagCount[t.tagId] ?? 0) + 1;
	}

	// Load keywords per category
	const allKeywords = db
		.select()
		.from(categoryKeywords)
		.where(eq(categoryKeywords.userId, userId))
		.all();
	const kwByCat: Record<number, { id: number; keyword: string }[]> = {};
	for (const kw of allKeywords) {
		(kwByCat[kw.categoryId] ??= []).push({ id: kw.id, keyword: kw.keyword });
	}

	return {
		categories: cats.map((c) => ({ ...c, count: catCount[c.id] ?? 0, keywords: kwByCat[c.id] ?? [] })),
		tags: userTags.map((t) => ({ ...t, count: tagCount[t.id] ?? 0 }))
	};
};

export const actions: Actions = {
	updateCategory: async (event) => {
		const session = await event.locals.auth();
		if (!session?.user) return fail(401);
		const userId = session.user.id;
		const form = await event.request.formData();
		const id = Number(form.get('id'));
		const name = form.get('name')?.toString().trim();
		const color = form.get('color')?.toString();
		const budgetRaw = form.get('monthlyBudget')?.toString().trim();
		const monthlyBudget = budgetRaw ? Number(budgetRaw) : null;
		if (!id || !name || !color) return fail(400, { error: 'Missing fields.' });
		db.update(categories)
			.set({ name, color, monthlyBudget })
			.where(and(eq(categories.id, id), eq(categories.userId, userId)))
			.run();
		return { success: true };
	},

	deleteCategory: async (event) => {
		const session = await event.locals.auth();
		if (!session?.user) return fail(401);
		const userId = session.user.id;
		const form = await event.request.formData();
		const id = Number(form.get('id'));
		if (!id) return fail(400);
		// Expenses set to null via ON DELETE SET NULL; also clean up category rules
		db.delete(categoryRules).where(and(eq(categoryRules.userId, userId), eq(categoryRules.categoryId, id))).run();
		db.delete(categories).where(and(eq(categories.id, id), eq(categories.userId, userId))).run();
		return { success: true };
	},

	// Merge: reassign all expenses from sourceId to targetId, then delete source
	mergeCategory: async (event) => {
		const session = await event.locals.auth();
		if (!session?.user) return fail(401);
		const userId = session.user.id;
		const form = await event.request.formData();
		const sourceId = Number(form.get('sourceId'));
		const targetId = Number(form.get('targetId'));
		if (!sourceId || !targetId || sourceId === targetId) return fail(400, { error: 'Invalid merge.' });
		// Verify both belong to user
		const source = db.select().from(categories).where(and(eq(categories.id, sourceId), eq(categories.userId, userId))).get();
		const target = db.select().from(categories).where(and(eq(categories.id, targetId), eq(categories.userId, userId))).get();
		if (!source || !target) return fail(404);
		db.update(expenses).set({ categoryId: targetId }).where(and(eq(expenses.userId, userId), eq(expenses.categoryId, sourceId))).run();
		db.delete(categoryRules).where(and(eq(categoryRules.userId, userId), eq(categoryRules.categoryId, sourceId))).run();
		db.delete(categories).where(eq(categories.id, sourceId)).run();
		return { success: true, message: `Merged "${source.name}" into "${target.name}".` };
	},

	updateTag: async (event) => {
		const session = await event.locals.auth();
		if (!session?.user) return fail(401);
		const userId = session.user.id;
		const form = await event.request.formData();
		const id = Number(form.get('id'));
		const name = form.get('name')?.toString().trim();
		const color = form.get('color')?.toString();
		if (!id || !name || !color) return fail(400, { error: 'Missing fields.' });
		db.update(tags).set({ name, color }).where(and(eq(tags.id, id), eq(tags.userId, userId))).run();
		return { success: true };
	},

	deleteTag: async (event) => {
		const session = await event.locals.auth();
		if (!session?.user) return fail(401);
		const userId = session.user.id;
		const form = await event.request.formData();
		const id = Number(form.get('id'));
		if (!id) return fail(400);
		db.delete(tagRules).where(and(eq(tagRules.userId, userId), eq(tagRules.tagId, id))).run();
		db.delete(tags).where(and(eq(tags.id, id), eq(tags.userId, userId))).run();
		return { success: true };
	},

	addKeyword: async (event) => {
		const session = await event.locals.auth();
		if (!session?.user) return fail(401);
		const userId = session.user.id;
		const form = await event.request.formData();
		const categoryId = Number(form.get('categoryId'));
		const keyword = form.get('keyword')?.toString().trim().toLowerCase();
		if (!categoryId || !keyword) return fail(400, { error: 'Missing fields.' });
		// Verify category belongs to user
		const cat = db.select().from(categories).where(and(eq(categories.id, categoryId), eq(categories.userId, userId))).get();
		if (!cat) return fail(404);
		try {
			db.insert(categoryKeywords).values({ userId, categoryId, keyword }).run();
		} catch { /* duplicate */ }
		return { success: true };
	},

	removeKeyword: async (event) => {
		const session = await event.locals.auth();
		if (!session?.user) return fail(401);
		const userId = session.user.id;
		const form = await event.request.formData();
		const id = Number(form.get('id'));
		if (!id) return fail(400);
		db.delete(categoryKeywords).where(and(eq(categoryKeywords.id, id), eq(categoryKeywords.userId, userId))).run();
		return { success: true };
	}
};
