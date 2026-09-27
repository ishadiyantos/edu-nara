import { expect, test } from 'vitest';
import { layoutWordcloud } from '../../src/lib/poll/wordcloud-layout';

test('layout is deterministic for the same input', () => {
	const words = [
		{ word: 'consciousness', weight: 5 },
		{ word: 'modeling', weight: 3 },
		{ word: 'reflect', weight: 1 }
	];
	expect(layoutWordcloud(words, { width: 1200, height: 640 })).toEqual(
		layoutWordcloud(words, { width: 1200, height: 640 })
	);
});

test('heavier words render larger and near the centre', () => {
	const layout = layoutWordcloud(
		[
			{ word: 'consciousness', weight: 8 },
			{ word: 'feedback', weight: 1 }
		],
		{ width: 1200, height: 640 }
	);
	const [heavy, light] = layout.items;
	expect(heavy.fontSize).toBeGreaterThan(light.fontSize);
	const centre = { x: 600, y: 320 };
	const distance = (item: { x: number; y: number; width: number; height: number }) =>
		Math.hypot(item.x + item.width / 2 - centre.x, item.y + item.height / 2 - centre.y);
	expect(distance(heavy)).toBeLessThan(distance(light));
});

test('places every word without overlapping and keeps a minority rotated', () => {
	const words = Array.from({ length: 24 }, (_, index) => ({
		word: `kata-${index}`,
		weight: 24 - index
	}));
	const layout = layoutWordcloud(words, { width: 1200, height: 640 });
	expect(layout.items).toHaveLength(24);
	for (let a = 0; a < layout.items.length; a++)
		for (let b = a + 1; b < layout.items.length; b++) {
			const one = layout.items[a];
			const two = layout.items[b];
			const overlap =
				one.x < two.x + two.width &&
				two.x < one.x + one.width &&
				one.y < two.y + two.height &&
				two.y < one.y + one.height;
			expect(overlap).toBe(false);
		}
	for (const item of layout.items) {
		expect(item.x).toBeGreaterThanOrEqual(0);
		expect(item.y).toBeGreaterThanOrEqual(0);
		expect(item.x + item.width).toBeLessThanOrEqual(1200);
		expect(item.y + item.height).toBeLessThanOrEqual(640);
	}
	const rotated = layout.items.filter((item) => item.rotated).length;
	expect(rotated).toBeGreaterThan(0);
	expect(rotated).toBeLessThan(layout.items.length / 2);
});

test('dense long phrases never overlap or exceed bounds, and all omissions are reported', () => {
	const words = Array.from({ length: 160 }, (_, i) => ({
		word: `${i} ${'W'.repeat(76)}`,
		weight: 1
	}));
	const result = layoutWordcloud(words, { width: 320, height: 400 });
	expect(result.items.length + result.omitted).toBe(words.length);
	for (const [i, a] of result.items.entries()) {
		expect(a.x).toBeGreaterThanOrEqual(0);
		expect(a.y).toBeGreaterThanOrEqual(0);
		expect(a.x + a.width).toBeLessThanOrEqual(320);
		expect(a.y + a.height).toBeLessThanOrEqual(400);
		for (const b of result.items.slice(i + 1))
			expect(
				a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
			).toBe(false);
	}
});
