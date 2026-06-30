import { db } from './index';
import { categories } from './schema';
import { eq } from 'drizzle-orm';

export function ensureDefaultCategories(userId: string) {
	const existing = db.select().from(categories).where(eq(categories.userId, userId)).all();
	if (existing.length > 0) return;

	const defaults = [
		{ name: 'Entertainment', color: '#ec4899' },
		{ name: 'Software', color: '#6366f1' },
		{ name: 'Utilities', color: '#f59e0b' },
		{ name: 'Food', color: '#22c55e' },
		{ name: 'Other', color: '#64748b' }
	];
	db.insert(categories)
		.values(defaults.map((c) => ({ ...c, userId })))
		.run();
}
