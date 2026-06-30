export const PAYMENT_METHODS = [
	'paypal',
	'visa',
	'mastercard',
	'amex',
	'applepay',
	'googlepay',
	'banktransfer',
	'bitcoin',
	'other'
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
