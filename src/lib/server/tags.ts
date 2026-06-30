import { db } from '$lib/server/db';
import { tags, expenseTags, tagRules, expenses } from '$lib/server/db/schema';
import { and, eq, inArray, sql } from 'drizzle-orm';

export type Tag = { id: number; name: string; color: string };

export function getUserTags(userId: string): Tag[] {
	return db
		.select({ id: tags.id, name: tags.name, color: tags.color })
		.from(tags)
		.where(eq(tags.userId, userId))
		.all();
}

// Map of expenseId -> tagId[] for all the user's expenses
export function getExpenseTagMap(userId: string): Record<number, number[]> {
	const rows = db
		.select({ expenseId: expenseTags.expenseId, tagId: expenseTags.tagId })
		.from(expenseTags)
		.innerJoin(expenses, eq(expenses.id, expenseTags.expenseId))
		.where(eq(expenses.userId, userId))
		.all();

	const map: Record<number, number[]> = {};
	for (const r of rows) {
		(map[r.expenseId] ??= []).push(r.tagId);
	}
	return map;
}

export function createTag(userId: string, name: string, color: string): Tag {
	const existing = db
		.select()
		.from(tags)
		.where(and(eq(tags.userId, userId), eq(tags.name, name)))
		.get();
	if (existing) return existing;
	db.insert(tags).values({ userId, name, color }).run();
	return db.select().from(tags).where(and(eq(tags.userId, userId), eq(tags.name, name))).get()!;
}

// Strengthen the learned rule: "this merchant is usually tagged with this tag"
function learnRule(userId: string, merchant: string, tagId: number) {
	const key = merchant.trim().toLowerCase();
	if (!key) return;
	const existing = db
		.select()
		.from(tagRules)
		.where(and(eq(tagRules.userId, userId), eq(tagRules.merchant, key), eq(tagRules.tagId, tagId)))
		.get();
	if (existing) {
		db.update(tagRules).set({ weight: existing.weight + 1 }).where(eq(tagRules.id, existing.id)).run();
	} else {
		db.insert(tagRules).values({ userId, merchant: key, tagId, weight: 1 }).run();
	}
}

// Apply a tag to one or more expenses. Learns a rule from each merchant touched.
export function applyTagToExpenses(userId: string, tagId: number, expenseIds: number[], learn = true) {
	if (expenseIds.length === 0) return;

	// Verify ownership of expenses + tag
	const owned = db
		.select({ id: expenses.id, name: expenses.name })
		.from(expenses)
		.where(and(eq(expenses.userId, userId), inArray(expenses.id, expenseIds)))
		.all();
	const tag = db.select().from(tags).where(and(eq(tags.id, tagId), eq(tags.userId, userId))).get();
	if (!tag) return;

	for (const exp of owned) {
		// Skip if already tagged
		const already = db
			.select()
			.from(expenseTags)
			.where(and(eq(expenseTags.expenseId, exp.id), eq(expenseTags.tagId, tagId)))
			.get();
		if (!already) {
			db.insert(expenseTags).values({ expenseId: exp.id, tagId }).run();
		}
		if (learn) learnRule(userId, exp.name, tagId);
	}
}

export function removeTagFromExpense(userId: string, tagId: number, expenseId: number) {
	const owns = db
		.select()
		.from(expenses)
		.where(and(eq(expenses.id, expenseId), eq(expenses.userId, userId)))
		.get();
	if (!owns) return;
	db.delete(expenseTags)
		.where(and(eq(expenseTags.expenseId, expenseId), eq(expenseTags.tagId, tagId)))
		.run();
}

export type Suggestion = {
	tagId: number;
	tagName: string;
	tagColor: string;
	merchant: string;       // display merchant (first-seen casing)
	expenseIds: number[];   // untagged expenses this rule would tag
};

// For each learned rule, find the user's expenses from that merchant that don't yet have the tag.
export function computeSuggestions(userId: string): Suggestion[] {
	const rules = db.select().from(tagRules).where(eq(tagRules.userId, userId)).all();
	if (rules.length === 0) return [];

	const allTags = new Map(getUserTags(userId).map((t) => [t.id, t]));
	const tagMap = getExpenseTagMap(userId);
	const allExpenses = db
		.select({ id: expenses.id, name: expenses.name })
		.from(expenses)
		.where(eq(expenses.userId, userId))
		.all();

	const suggestions: Suggestion[] = [];
	for (const rule of rules) {
		const tag = allTags.get(rule.tagId);
		if (!tag) continue;

		const matches = allExpenses.filter(
			(e) =>
				e.name.trim().toLowerCase() === rule.merchant &&
				!(tagMap[e.id] ?? []).includes(rule.tagId)
		);
		if (matches.length > 0) {
			suggestions.push({
				tagId: rule.tagId,
				tagName: tag.name,
				tagColor: tag.color,
				merchant: matches[0].name,
				expenseIds: matches.map((m) => m.id)
			});
		}
	}
	// Sort by impact (most untagged matches first)
	return suggestions.sort((a, b) => b.expenseIds.length - a.expenseIds.length);
}

// Apply every pending suggestion at once (without re-learning — these are derived from existing rules)
export function applyAllSuggestions(userId: string): number {
	const suggestions = computeSuggestions(userId);
	let count = 0;
	for (const s of suggestions) {
		applyTagToExpenses(userId, s.tagId, s.expenseIds, false);
		count += s.expenseIds.length;
	}
	return count;
}
