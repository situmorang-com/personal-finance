export type TxSourceType = 'qr' | 'transfer' | 'biffast' | 'autodebit' | 'flazz' | 'other';

export interface ParsedTransaction {
	date: string;           // YYYY-MM-DD
	amount: number;         // IDR, whole number
	direction: 'expense' | 'income';
	sourceType: TxSourceType;
	merchant: string;       // primary display name (merchant or payee)
	recipient: string | null;  // who received the money (transfers)
	remark: string | null;     // user's own note on the transfer
	rawType: string;        // raw BCA type string, e.g. "TRSF E-BANKING DB"
}

// In PDF: commas = thousand separator, dot = decimal  →  "270,000.00" = 270000 IDR
function parseRupiah(s: string): number {
	return Math.round(parseFloat(s.replace(/,/g, '')));
}

// Clean up a raw reference line into a readable label
function cleanRef(s: string): string {
	return s
		.replace(/^\d{4}\/[A-Z]+\/[A-Z0-9]+\s*/, '')  // strip "0704/FTSCY/WS95271"
		.replace(/^TANGGAL\s*:\s*\d{1,2}\/\d{1,2}\s*/i, '') // strip "TANGGAL :01/04"
		.replace(/^\/+/, '')                            // strip leading /
		.replace(/^\d+[.,]\d+\s*/, '')                 // strip echoed amount "2157840.00"
		.replace(/^TGL:\s*\d{1,2}\/\d{1,2}\s*/i, '')  // strip "TGL: 01/04"
		.replace(/^QRC?\d*\s*/i, '')                   // strip "QRC014", "QR 014"
		.replace(/^00000\.00/, '')                     // strip QR amount prefix
		.trim();
}

function isMeaningful(s: string): boolean {
	// Must have at least 2 letters and not be purely numeric/punctuation
	return /[A-Za-z]{2,}/.test(s) && !/^[\d\/\-\.\s]+$/.test(s);
}

function classify(rawType: string, refs: string[], hasQR = false): {
	sourceType: TxSourceType;
	direction: 'expense' | 'income';
	merchant: string;
	recipient: string | null;
	remark: string | null;
} {
	const type = rawType.toUpperCase();

	// ── QR / QRIS payment (TRANSAKSI DEBIT with QR terminal) ─────────────────
	if (type.includes('TRANSAKSI DEBIT') && hasQR) {
		// cleanRef already strips "00000.00" prefix and "QRC014" — first meaningful ref is the merchant
		const merchant = refs.find(isMeaningful) ?? rawType;
		return { sourceType: 'qr', direction: 'expense', merchant, recipient: null, remark: null };
	}

	// ── TRANSAKSI DEBIT without QR (generic debit) ──────────────────────────
	if (type.includes('TRANSAKSI DEBIT')) {
		const merchant = refs.find(isMeaningful) ?? rawType;
		return { sourceType: 'other', direction: 'expense', merchant, recipient: null, remark: null };
	}

	// ── Flazz top-up ────────────────────────────────────────────────────────
	if (type.includes('FLAZZ')) {
		return { sourceType: 'flazz', direction: 'expense', merchant: 'BCA Flazz Top-up', recipient: null, remark: null };
	}

	// ── Auto-debit / KR Otomatis (salary, standing order) ───────────────────
	if (type.includes('KR OTOMATIS') || type.includes('SETORAN')) {
		const sender = refs.find(isMeaningful) ?? null;
		return { sourceType: 'autodebit', direction: 'income', merchant: sender ?? 'Auto Credit', recipient: null, remark: null };
	}

	// ── BI-Fast ──────────────────────────────────────────────────────────────
	if (type.includes('BI-FAST') || type.includes('BIFAST')) {
		const isCredit = type.includes('CR') || !type.includes('DB');
		const name = refs.find(isMeaningful) ?? null;
		return {
			sourceType: 'biffast',
			direction: isCredit ? 'income' : 'expense',
			merchant: name ?? (isCredit ? 'Incoming Transfer' : 'BI-Fast Transfer'),
			recipient: isCredit ? null : name,
			remark: null
		};
	}

	// ── E-Banking / TRSF (transfer out or in) ────────────────────────────────
	if (type.includes('TRSF') || type.includes('TRANSFER')) {
		const isCredit = type.includes('CR') || !type.includes('DB');
		// For transfers: the LAST meaningful ref is the recipient/sender,
		// the second-to-last (if different) is the remark
		const meaningful = refs.filter(isMeaningful);
		const recipient = meaningful.at(-1) ?? null;
		const remark = meaningful.length > 1 ? meaningful.at(-2) ?? null : null;
		return {
			sourceType: 'transfer',
			direction: isCredit ? 'income' : 'expense',
			merchant: recipient ?? (isCredit ? 'Incoming Transfer' : 'Bank Transfer'),
			recipient: isCredit ? null : recipient,
			remark
		};
	}

	// ── Fallback ─────────────────────────────────────────────────────────────
	const isCredit = type.includes('CR') && !type.includes('DB');
	const name = refs.find(isMeaningful) ?? rawType;
	return {
		sourceType: 'other',
		direction: isCredit ? 'income' : 'expense',
		merchant: name,
		recipient: null,
		remark: null
	};
}

export async function parseBCAStatement(pdfBuffer: Buffer): Promise<ParsedTransaction[]> {
	const extractTextModule = await import('pdf-text-extract');
	const extractText = (extractTextModule as any).default;

	const fs = await import('fs');
	const path = await import('path');
	const fsp = await import('fs/promises');
	const os = await import('os');

	const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'bca-'));
	const tempPath = path.join(tempDir, 'statement.pdf');

	await new Promise<void>((resolve, reject) => {
		const stream = fs.createWriteStream(tempPath);
		stream.write(pdfBuffer);
		stream.end();
		stream.on('finish', resolve);
		stream.on('error', reject);
	});

	const pages = await new Promise<string[]>((resolve, reject) => {
		extractText(tempPath, {}, (err: Error | null, pages?: string[]) => {
			if (err) reject(err);
			else resolve(pages || []);
		});
	});

	await fsp.unlink(tempPath).catch(() => {});

	// Extract year from "PERIODE : APRIL 2026"
	let year = new Date().getFullYear().toString();
	const periodMatch = pages.join('\n').match(/PE\s*RI\s*OD\s*E\s*:\s*([A-Z]+)\s+(\d{4})/);
	if (periodMatch) year = periodMatch[2];

	const transactions: ParsedTransaction[] = [];

	for (const page of pages) {
		const lines = page.split('\n');

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];

			// Transaction line: leading spaces + DD/MM + 2+ spaces + TYPE + ... + AMOUNT [DB]
			const txMatch = line.match(
				/^\s+(\d{2})\/(\d{2})\s{2,}([A-Z][A-Z\s\-]+?)\s{2,}.*?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*(DB)?\s*(?:\d{1,3}(?:,\d{3})*(?:\.\d{2})?)?\s*$/
			);
			if (!txMatch) continue;

			const [, day, month, rawType, amountStr, dbFlag] = txMatch;
			if (rawType.trim().startsWith('SALDO')) continue;

			const amount = parseRupiah(amountStr);
			if (amount <= 0 || isNaN(amount)) continue;

			// Collect continuation lines (raw, before cleaning)
			const rawRefs: string[] = [];
			for (let j = i + 1; j < Math.min(i + 7, lines.length); j++) {
				const next = lines[j].trim();
				if (!next || /^\s+\d{2}\/\d{2}\s{2,}[A-Z]/.test(lines[j])) break;
				rawRefs.push(next);
			}

			// Detect QR *before* cleaning (cleanRef strips "QRC014")
			const hasQR = rawRefs.some((r) => /^QR[C ]?\s*\d*/i.test(r.trim()));

			// Clean each ref line
			const refs = rawRefs.map(cleanRef).filter((s) => s.length > 0);

			const { sourceType, direction, merchant, recipient, remark } = classify(
				rawType.trim(),
				refs,
				hasQR
			);

			const date = `${year}-${month}-${day}`;

			transactions.push({
				date,
				amount,
				direction,
				sourceType,
				merchant: merchant.substring(0, 100),
				recipient: recipient?.substring(0, 100) ?? null,
				remark: remark?.substring(0, 150) ?? null,
				rawType: rawType.trim()
			});
		}
	}

	return transactions;
}
