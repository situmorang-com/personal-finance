import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { PAYMENT_METHODS } from '$lib/payments';
export { PAYMENT_METHODS, type PaymentMethod } from '$lib/payments';

export const users = sqliteTable('users', {
	id: text('id').primaryKey(),
	name: text('name'),
	email: text('email').notNull().unique(),
	image: text('image'),
	mainCurrencyId: integer('main_currency_id'),
	ratesUpdatedAt: text('rates_updated_at'),
	monthlyBudget: real('monthly_budget')
});


export const currencies = sqliteTable('currencies', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	userId: text('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	code: text('code').notNull(),
	symbol: text('symbol').notNull(),
	name: text('name').notNull(),
	rate: real('rate').notNull().default(1)
});

export const categories = sqliteTable('categories', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	userId: text('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
	color: text('color').notNull().default('#6366f1'),
	monthlyBudget: real('monthly_budget')
});

export const subscriptions = sqliteTable('subscriptions', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	userId: text('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	categoryId: integer('category_id').references(() => categories.id, { onDelete: 'set null' }),
	currencyId: integer('currency_id').references(() => currencies.id, { onDelete: 'set null' }),
	name: text('name').notNull(),
	website: text('website'),
	paymentMethod: text('payment_method', { enum: PAYMENT_METHODS }),
	price: real('price').notNull(),
	billingCycle: text('billing_cycle', { enum: ['monthly', 'yearly', 'weekly', 'quarterly'] })
		.notNull()
		.default('monthly'),
	nextRenewal: text('next_renewal').notNull(),
	notes: text('notes'),
	active: integer('active', { mode: 'boolean' }).notNull().default(true),
	createdAt: text('created_at')
		.notNull()
		.default('CURRENT_TIMESTAMP')
});

// Free-form labels, multiple per transaction (on top of the single category)
export const tags = sqliteTable('tags', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	userId: text('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
	color: text('color').notNull().default('#6366f1')
});

// Many-to-many: expense ↔ tag
export const expenseTags = sqliteTable('expense_tags', {
	expenseId: integer('expense_id')
		.notNull()
		.references(() => expenses.id, { onDelete: 'cascade' }),
	tagId: integer('tag_id')
		.notNull()
		.references(() => tags.id, { onDelete: 'cascade' })
});

// Learned rules: "merchant M is usually tagged T". Strengthened each time the user applies T to M.
export const tagRules = sqliteTable('tag_rules', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	userId: text('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	merchant: text('merchant').notNull(), // lowercased merchant name
	tagId: integer('tag_id')
		.notNull()
		.references(() => tags.id, { onDelete: 'cascade' }),
	weight: integer('weight').notNull().default(1) // how many times this mapping was chosen
});

// Learned rules: "merchant M is usually in category C". Strengthened each time the user assigns C to M.
export const categoryKeywords = sqliteTable('category_keywords', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	userId: text('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	categoryId: integer('category_id')
		.notNull()
		.references(() => categories.id, { onDelete: 'cascade' }),
	keyword: text('keyword').notNull()
});

export const categoryRules = sqliteTable('category_rules', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	userId: text('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	merchant: text('merchant').notNull(), // lowercased merchant name
	categoryId: integer('category_id')
		.notNull()
		.references(() => categories.id, { onDelete: 'cascade' }),
	weight: integer('weight').notNull().default(1) // how many times this mapping was chosen
});

export const expenses = sqliteTable('expenses', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	userId: text('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	categoryId: integer('category_id').references(() => categories.id, { onDelete: 'set null' }),
	currencyId: integer('currency_id').references(() => currencies.id, { onDelete: 'set null' }),
	name: text('name').notNull(),           // merchant / payee (primary display)
	amount: real('amount').notNull(),
	date: text('date').notNull(),
	// direction: 'expense' (debit) | 'income' (credit)
	direction: text('direction', { enum: ['expense', 'income'] }).notNull().default('expense'),
	// source_type: how the tx originated in the bank
	sourceType: text('source_type', { enum: ['qr', 'transfer', 'biffast', 'autodebit', 'flazz', 'manual', 'other'] }).default('manual'),
	recipient: text('recipient'),           // person/merchant receiving the money (transfers)
	remark: text('remark'),                 // user's transfer note / description
	notes: text('notes'),                   // free-text user note
	importRef: text('import_ref'),          // machine ref: "[bca-debit-xxx] filename.pdf"
	createdAt: text('created_at')
		.notNull()
		.default('CURRENT_TIMESTAMP')
});
