declare module 'pdf-text-extract' {
	export function extractText(
		buffer: Buffer,
		options: Record<string, any>,
		callback?: (err: Error | null, text?: string) => void
	): Promise<string> | void;
}
