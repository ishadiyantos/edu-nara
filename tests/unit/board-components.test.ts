import { describe, expect, it } from 'vitest';
import {
	MAX_POST_BODY,
	SAMPLE_POSTS,
	linkifyBody,
	movePost,
	postLength,
	statusLabel,
	statusTone,
	validatePostBody
} from '../../src/lib/board/posts';

describe('board components unit logic', () => {
	it('enforces character limit and boundary validation', () => {
		expect(validatePostBody('Ide pertama').ok).toBe(true);
		expect(validatePostBody('a'.repeat(MAX_POST_BODY)).ok).toBe(true);
		expect(validatePostBody('a'.repeat(MAX_POST_BODY + 1)).ok).toBe(false);
	});

	it('computes unicode length accurately', () => {
		const emojiText = '🚀'.repeat(10);
		expect(postLength(emojiText)).toBe(10);
		expect(validatePostBody(emojiText).ok).toBe(true);
	});

	it('safely handles long URLs and auto-linkify segments', () => {
		const longUrl = 'https://example.com/' + 'a'.repeat(100);
		const segments = linkifyBody(`Check ${longUrl} now`);
		expect(segments).toHaveLength(3);
		expect(segments[1]).toEqual({ type: 'link', value: longUrl, href: longUrl });
	});

	it('preserves order and moves post up and down', () => {
		const items = [
			{ id: '1', position: 0 },
			{ id: '2', position: 1 },
			{ id: '3', position: 2 }
		];
		const movedUp = movePost(items, '2', -1);
		expect(movedUp.map((i) => i.id)).toEqual(['2', '1', '3']);
		expect(movedUp[0].position).toBe(0);
		expect(movedUp[1].position).toBe(1);

		const movedDown = movePost(items, '2', 1);
		expect(movedDown.map((i) => i.id)).toEqual(['1', '3', '2']);
	});

	it('filters sample posts correctly for public vs admin views', () => {
		const approved = SAMPLE_POSTS.filter((p) => p.status === 'approved');
		expect(approved.length).toBeGreaterThan(0);
		expect(approved.every((p) => p.status === 'approved')).toBe(true);

		const pending = SAMPLE_POSTS.filter((p) => p.status === 'pending');
		expect(pending.length).toBeGreaterThan(0);
	});

	it('provides labels and tones for all post statuses', () => {
		expect(statusLabel('pending')).toBe('Awaiting moderation');
		expect(statusLabel('approved')).toBe('Approved');
		expect(statusLabel('rejected')).toBe('Rejected');

		expect(statusTone('pending')).toContain('amber');
		expect(statusTone('approved')).toContain('emerald');
		expect(statusTone('rejected')).toContain('rose');
	});
});
