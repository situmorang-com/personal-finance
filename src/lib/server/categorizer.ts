// Keyword-based auto-categorizer.
// Each entry maps a category name to a list of lowercase keywords.
// The FIRST matching rule wins (order matters — more specific rules first).
// Users can later re-categorize individual transactions.

export const CATEGORY_RULES: { name: string; color: string; keywords: string[] }[] = [
	// ── Income ───────────────────────────────────────────────────────────────
	{ name: 'Salary', color: '#10b981', keywords: ['salary', 'gaji', 'payroll', 'thr', 'bonus', 'afr', 'kr otomatis'] },

	// ── Food & Dining ────────────────────────────────────────────────────────
	{ name: 'Food & Dining', color: '#f59e0b', keywords: [
		// International chains
		'foodha', 'foodhall', 'food hall', 'subway', 'mcdonald', 'kfc', 'pizza',
		'burger', 'resto', 'restaurant', 'cafe', 'coffee', 'starbucks',
		'chatime', 'jco', 'dunkin', 'bakery', 'sushi', 'gofood', 'grabfood',
		'shopeefood', 'elox jus', 'jus', 'milkshake', 'boba', 'es teh', 'wandy froz',
		// Indonesian street food & local
		'warung', 'warteg', 'bakso', 'batagor', 'siomay', 'mie ayam', 'mie goreng',
		'nasi goreng', 'nasi padang', 'rumah makan', 'rm pancor', 'rm ', 'padang',
		'sate', 'soto', 'bubur', 'gorengan', 'martabak', 'ketupat', 'gado',
		'pecel', 'ayam bakar', 'ayam goreng', 'geprek', 'seafood',
		'ramen', 'ramenya', 'es kelapa', 'es teler', 'kios kelap', 'kelapa ',
		'tahu', 'tempe', 'telor', 'roti ', 'donat', 'kedai', 'depot',
		'ixobox', 'maju bersa', 'stim putra', 'kokufe',
	]},

	// ── Groceries ────────────────────────────────────────────────────────────
	{ name: 'Groceries', color: '#84cc16', keywords: [
		'alfamart', 'alfagift', 'indomaret', 'indomart', 'idm indoma', 'hypermart',
		'carrefour', 'lotte mart', 'lottemart', 'giant', 'superindo', 'hero',
		'transmart', 'ranch market', 'farmers market', 'sayur', 'buah',
	]},

	// ── Transport & Fuel ─────────────────────────────────────────────────────
	{ name: 'Transport', color: '#3b82f6', keywords: [
		'spbu', 'pertamina', 'shell', 'vivo', 'total fuel',
		'flazz', 'e-toll', 'commuter', 'krl', 'mrt', 'lrt', 'transjakarta',
		'grab', 'gojek', 'goride', 'bluebird', 'taxi', 'angkot', 'busway',
		'parkir', 'parking', 'tol ',
	]},

	// ── Vehicle ──────────────────────────────────────────────────────────────
	{ name: 'Vehicle', color: '#6366f1', keywords: [
		'bengkel', 'motor', 'mobil', 'servis', 'service', 'oli', 'ban ',
		'sparepart', 'spare part', 'otomotif', 'pendawa moto', 'langgeng',
		'prabu', 'acc bogor',
	]},

	// ── Utilities & Telecoms ─────────────────────────────────────────────────
	{ name: 'Utilities', color: '#06b6d4', keywords: [
		'pln', 'listrik', 'token listrik', 'air pdam', 'pdam',
		'telkom', 'tsel', 'telkomsel', 'indosat', 'xl ', 'xlaxiata', 'smartfren',
		'tri ', '3 by indosat', 'internet', 'firstmedia', 'mncplay', 'biznet',
		'gas pln', 'gas pgn',
	]},

	// ── Health ───────────────────────────────────────────────────────────────
	{ name: 'Health', color: '#ec4899', keywords: [
		'apotek', 'apotik', 'kimia farma', 'guardian', 'century healthcare',
		'rumah sakit', 'rs ', 'klinik', 'dokter', 'drg ', 'laboratorium', 'lab ',
		'dental', 'optik', 'halodoc', 'alodokter',
	]},

	// ── Shopping ─────────────────────────────────────────────────────────────
	{ name: 'Shopping', color: '#a855f7', keywords: [
		'tokopedia', 'shopee', 'lazada', 'blibli', 'bukalapak', 'tiktok shop',
		'zalora', 'matahari', 'sogo', 'zara', 'h&m', 'uniqlo', 'cotton on',
		'ace hardware', 'depo bangunan',
	]},

	// ── Building / Home ──────────────────────────────────────────────────────
	{ name: 'Home', color: '#78716c', keywords: [
		'bahan bangunan', 'granit', 'keramik', 'cat ', 'material', 'furniture',
		'ikea', 'informa', 'living', 'hardware', 'satya langgeng',
	]},

	// ── Education ────────────────────────────────────────────────────────────
	{ name: 'Education', color: '#f97316', keywords: [
		'sekolah', 'spp', 'kuliah', 'universitas', 'kursus', 'bimbel',
		'ruangguru', 'zenius', 'skill', 'udemy', 'coursera',
	]},

	// ── Entertainment ────────────────────────────────────────────────────────
	{ name: 'Entertainment', color: '#e879f9', keywords: [
		'netflix', 'spotify', 'youtube', 'disney', 'hbo', 'vidio', 'viu',
		'cinema', 'bioskop', 'cgv', 'cinepolis', 'XXI', '21 ', 'game', 'steam',
		'playstation', 'nintendo',
	]},

	// ── Donation / Giving ────────────────────────────────────────────────────
	{ name: 'Donation', color: '#f472b6', keywords: [
		// English
		'tithe', 'offering', 'donation', 'donate', 'charity', 'contribution', 'alms',
		// Indonesian — church names & terms
		'gereja', 'gmahk', 'masehi advent', 'jisdac', 'gki ', 'gbi ', 'hkbp',
		'perpuluhan', 'persembahan', 'kolekte', 'persembahan khusus',
		// Indonesian — mosque / Islamic
		'masjid', 'mushola', 'musala',
		// Indonesian — general giving
		'dana bantuan', 'dana sosial', 'dana kemanusiaan',
		'sumbangan', 'donasi', 'sedekah', 'infaq', 'infak',
		'zakat', 'wakaf', 'fidyah', 'kafarat',
		// Common remark phrases
		'bantuan sosial', 'bakti sosial', 'baksos',
	]},

	// ── Insurance ────────────────────────────────────────────────────────────
	{ name: 'Insurance', color: '#0ea5e9', keywords: [
		'bpjs', 'asuransi', 'premi', 'prudential', 'allianz', 'axa', 'manulife',
		'sinarmas', 'bumiputera', 'tugu', 'jasindo', 'adira insurance',
		'cigna', 'sompo', 'zurich', 'great eastern',
	]},

	// ── Investment ───────────────────────────────────────────────────────────
	{ name: 'Investment', color: '#8b5cf6', keywords: [
		'reksadana', 'reksa dana', 'bibit', 'ajaib', 'stockbit', 'ipot',
		'indo premier', 'bareksa', 'pluang', 'pintu', 'indodax',
		'deposito', 'obligasi', 'sbr', 'st0', 'sr0',
		'pegadaian', 'emas antam', 'antam', 'logam mulia',
		'saham', 'idx', 'bursa efek',
	]},

	// ── Loan & Credit ────────────────────────────────────────────────────────
	{ name: 'Loan & Credit', color: '#dc2626', keywords: [
		'cicilan', 'angsuran', 'kredit', 'pinjaman', 'dp ', 'uang muka',
		'kredivo', 'akulaku', 'home credit', 'adira ', 'fif ',
		'kartu kredit', 'tagihan', 'pembayaran kredit',
	]},

	// ── Tax ──────────────────────────────────────────────────────────────────
	{ name: 'Tax', color: '#92400e', keywords: [
		'pajak', 'pbb', 'ppn', 'pph', 'samsat', 'e-samsat', 'stnk',
		'bphtb', 'bea balik nama', 'kantor pajak', 'coretax',
	]},

	// ── Travel ───────────────────────────────────────────────────────────────
	{ name: 'Travel', color: '#14b8a6', keywords: [
		'traveloka', 'tiket.com', 'tiketcom', 'pegi pegi', 'pegipegi',
		'hotel', 'penginapan', 'villa', 'resort', 'airbnb', 'agoda', 'booking.com',
		'garuda', 'lion air', 'batik air', 'citilink', 'sriwijaya', 'airasia',
		'bandara', 'airport', 'terminal', 'stasiun', 'pelabuhan',
		'visa ', 'paspor', 'imigrasi',
	]},

	// ── Personal Care ────────────────────────────────────────────────────────
	{ name: 'Personal Care', color: '#e11d48', keywords: [
		'salon', 'barbershop', 'barber', 'pangkas', 'cukur',
		'spa', 'refleksi', 'pijat', 'massage',
		'skincare', 'kosmetik', 'make up', 'makeup', 'wardah', 'emina',
		'indomaret beauty', 'sociolla', 'sephora', 'the body shop',
		'laundry', 'binatu', 'dry clean',
	]},

	// ── Hosting & Servers ────────────────────────────────────────────────────
	{ name: 'Hosting & Servers', color: '#0891b2', keywords: [
		'hosting', 'vps', 'cloud server', 'cloud hosting',
		'digitalocean', 'linode', 'vultr', 'aws', 'amazon web services',
		'google cloud', 'gcp', 'azure', 'railway', 'render.com', 'fly.io',
		'vercel', 'netlify', 'cloudflare', 'heroku', 'hostinger', 'niagahoster',
		'dewaweb', 'rumahweb', 'idcloudhost', 'cpanel', 'plesk',
	]},

	// ── Software ─────────────────────────────────────────────────────────────
	{ name: 'Software', color: '#7c3aed', keywords: [
		// AI tools
		'chatgpt', 'openai', 'claude', 'anthropic', 'midjourney', 'perplexity',
		'github copilot', 'copilot', 'cursor', 'gemini advanced', 'character.ai',
		// Productivity & creative SaaS
		'notion', 'figma', 'adobe', 'canva', 'slack', 'zoom', 'dropbox',
		'1password', 'lastpass', 'evernote', 'trello', 'asana', 'monday.com',
		'github', 'gitlab', 'jetbrains', 'microsoft 365', 'office 365', 'google one',
		'google workspace', 'icloud', 'grammarly',
	]},

	// ── Fees & Charges ───────────────────────────────────────────────────────
	{ name: 'Fees & Charges', color: '#6b7280', keywords: [
		'biaya adm', 'biaya admin', 'biaya transfer', 'biaya bulanan',
		'admin fee', 'service charge', 'materai', 'denda', 'penalti',
		'biaya keterlambatan', 'late fee', 'iuran', 'biaya tahunan',
	]},

	// ── Transfer / E-Wallet ──────────────────────────────────────────────────
	{ name: 'Transfer', color: '#64748b', keywords: [
		'dana', 'ovo', 'gopay', 'linkaja', 'shopeepay', 'doku',
		'bi-fast', 'bifast', 'bif transfer', 'trsf e-banking',
	]},

	// ── Family / Personal ────────────────────────────────────────────────────
	{ name: 'Family', color: '#f43f5e', keywords: [
		'siska', 'irhen', 'situmorang', 'edmund',
	]},
];

import { db } from '$lib/server/db';
import { categories, categoryKeywords } from '$lib/server/db/schema';
import { and, eq } from 'drizzle-orm';

export type KeywordRule = { name: string; keywords: string[] };

/**
 * Load keyword rules from DB for a user.
 * Each entry maps a category name to its list of keywords (order matches CATEGORY_RULES order for priority).
 */
export function loadKeywordRules(userId: string): KeywordRule[] {
	const cats = db.select().from(categories).where(eq(categories.userId, userId)).all();
	const kws = db.select().from(categoryKeywords).where(eq(categoryKeywords.userId, userId)).all();

	// Build map: categoryId → keywords[]
	const kwMap = new Map<number, string[]>();
	for (const kw of kws) {
		const arr = kwMap.get(kw.categoryId) ?? [];
		arr.push(kw.keyword);
		kwMap.set(kw.categoryId, arr);
	}

	// Return in CATEGORY_RULES priority order first, then any extra user categories
	const ruleNames = CATEGORY_RULES.map((r) => r.name);
	const sorted = [
		...cats.filter((c) => ruleNames.includes(c.name)),
		...cats.filter((c) => !ruleNames.includes(c.name))
	].sort((a, b) => {
		const ai = ruleNames.indexOf(a.name);
		const bi = ruleNames.indexOf(b.name);
		if (ai === -1 && bi === -1) return a.name.localeCompare(b.name);
		if (ai === -1) return 1;
		if (bi === -1) return -1;
		return ai - bi;
	});

	return sorted.map((c) => ({ name: c.name, keywords: kwMap.get(c.id) ?? [] }));
}

/**
 * Returns the category name that best matches the given strings.
 * Pass rules from loadKeywordRules() — load once per import batch, not per transaction.
 */
export function guessCategory(
	merchant: string,
	remark: string | null,
	rawType: string,
	rules: KeywordRule[]
): string | null {
	const haystack = [merchant, remark, rawType].filter(Boolean).join(' ').toLowerCase();
	for (const rule of rules) {
		if (rule.keywords.some((kw) => haystack.includes(kw))) return rule.name;
	}
	return null;
}

/**
 * Ensure all CATEGORY_RULES categories exist for the user in the DB,
 * and seed their default keywords if they have none yet.
 * Returns a map of category name → id.
 */
export function ensureCategoryRuleCategories(userId: string): Map<string, number> {
	const existing = db.select().from(categories).where(eq(categories.userId, userId)).all();
	const map = new Map<string, number>(existing.map((c) => [c.name, c.id]));

	for (const rule of CATEGORY_RULES) {
		let catId = map.get(rule.name);

		if (!catId) {
			db.insert(categories).values({ userId, name: rule.name, color: rule.color }).run();
			const inserted = db
				.select()
				.from(categories)
				.where(and(eq(categories.userId, userId), eq(categories.name, rule.name)))
				.get();
			if (inserted) { map.set(rule.name, inserted.id); catId = inserted.id; }
		}

		if (!catId) continue;

		// Seed default keywords only if this category has none yet
		const hasKeywords = db
			.select()
			.from(categoryKeywords)
			.where(and(eq(categoryKeywords.userId, userId), eq(categoryKeywords.categoryId, catId)))
			.get();

		if (!hasKeywords) {
			for (const kw of rule.keywords) {
				try {
					db.insert(categoryKeywords).values({ userId, categoryId: catId, keyword: kw }).run();
				} catch { /* duplicate — ignore */ }
			}
		}
	}
	return map;
}

// ── Category learning (merchant → preferred category) ──────────────────────────

import { categoryRules, expenses } from '$lib/server/db/schema';
import { inArray } from 'drizzle-orm';

function learnCategoryRule(userId: string, merchant: string, categoryId: number) {
	const key = merchant.trim().toLowerCase();
	if (!key) return;
	const existing = db
		.select()
		.from(categoryRules)
		.where(and(eq(categoryRules.userId, userId), eq(categoryRules.merchant, key), eq(categoryRules.categoryId, categoryId)))
		.get();
	if (existing) {
		db.update(categoryRules).set({ weight: existing.weight + 1 }).where(eq(categoryRules.id, existing.id)).run();
	} else {
		db.insert(categoryRules).values({ userId, merchant: key, categoryId, weight: 1 }).run();
	}
}

/**
 * Strengthen the category rule: user assigned this categoryId to this merchant.
 * Only called when the user manually changes a category (not on import).
 */
export function learnCategoryAssignment(userId: string, expenseId: number, categoryId: number) {
	const exp = db.select({ name: expenses.name }).from(expenses).where(eq(expenses.id, expenseId)).get();
	if (exp) {
		learnCategoryRule(userId, exp.name, categoryId);
	}
}

export type CategorySuggestion = {
	categoryId: number;
	categoryName: string;
	categoryColor: string;
	merchant: string;
	expenseIds: number[];
};

/**
 * Find unassigned transactions from merchants where the user has established a preference.
 */
export function computeCategorySuggestions(userId: string): CategorySuggestion[] {
	const rules = db.select().from(categoryRules).where(eq(categoryRules.userId, userId)).all();
	if (rules.length === 0) return [];

	const catMap = new Map(db.select().from(categories).where(eq(categories.userId, userId)).all().map((c) => [c.id, c]));
	const allExpenses = db
		.select({ id: expenses.id, name: expenses.name, categoryId: expenses.categoryId })
		.from(expenses)
		.where(eq(expenses.userId, userId))
		.all();

	const suggestions: CategorySuggestion[] = [];
	for (const rule of rules) {
		const cat = catMap.get(rule.categoryId);
		if (!cat) continue;

		const matches = allExpenses.filter(
			(e) => e.name.trim().toLowerCase() === rule.merchant && e.categoryId !== rule.categoryId
		);
		if (matches.length > 0) {
			suggestions.push({
				categoryId: rule.categoryId,
				categoryName: cat.name,
				categoryColor: cat.color,
				merchant: matches[0].name,
				expenseIds: matches.map((m) => m.id)
			});
		}
	}
	return suggestions.sort((a, b) => b.expenseIds.length - a.expenseIds.length);
}
