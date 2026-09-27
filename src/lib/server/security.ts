export class RateLimiter {
	private entries = new Map<string, { count: number; reset: number }>();
	constructor(private capacity = 10000) {}
	take(key: string, limit: number, windowMs: number, now = Date.now()) {
		for (const [k, v] of this.entries) if (v.reset <= now) this.entries.delete(k);
		let entry = this.entries.get(key);
		if (!entry) {
			if (this.entries.size >= this.capacity) return Math.ceil(windowMs / 1000);
			entry = { count: 0, reset: now + windowMs };
			this.entries.set(key, entry);
		}
		if (entry.count >= limit) return Math.max(1, Math.ceil((entry.reset - now) / 1000));
		entry.count++;
		return 0;
	}
}
export const limits = new RateLimiter();
export const sameOrigin = (origin: string | null, expected: string) => origin === expected;
export function cookieOptions(url: URL, setting = process.env.COOKIE_SECURE) {
	return {
		path: '/',
		httpOnly: true,
		sameSite: 'lax' as const,
		secure: url.protocol === 'https:' || setting !== 'false'
	};
}
