export type WordcloudItem = {
	word: string;
	weight: number;
	fontSize: number;
	rotated: boolean;
	x: number;
	y: number;
	width: number;
	height: number;
};

export type WordcloudLayout = {
	width: number;
	height: number;
	items: WordcloudItem[];
	omitted: number;
};

const GAP = 4;

function measure(word: string, fontSize: number) {
	return {
		width: Math.ceil(word.length * fontSize * 0.56) + GAP * 2,
		height: Math.ceil(fontSize * 1.22) + GAP * 2
	};
}

function collides(placed: WordcloudItem[], x: number, y: number, width: number, height: number) {
	return placed.some(
		(item) =>
			x < item.x + item.width &&
			item.x < x + width &&
			y < item.y + item.height &&
			item.y < y + height
	);
}

function findPosition(
	placed: WordcloudItem[],
	width: number,
	height: number,
	canvasWidth: number,
	canvasHeight: number
) {
	const centerX = canvasWidth / 2;
	const centerY = canvasHeight / 2;
	const maxRadius = Math.hypot(canvasWidth, canvasHeight) / 2;
	for (let radius = 0; radius <= maxRadius; radius += 7) {
		const steps = Math.max(8, Math.ceil((2 * Math.PI * radius) / 8));
		for (let step = 0; step < steps; step++) {
			const angle = (step / steps) * Math.PI * 2;
			const x = Math.round(centerX + Math.cos(angle) * radius - width / 2);
			const y = Math.round(centerY + Math.sin(angle) * radius - height / 2);
			if (x < 0 || y < 0 || x + width > canvasWidth || y + height > canvasHeight) continue;
			if (!collides(placed, x, y, width, height)) return { x, y };
		}
	}
	return null;
}

export function layoutWordcloud(
	words: { word: string; weight: number }[],
	{ width, height }: { width: number; height: number }
): WordcloudLayout {
	const max = Math.max(1, ...words.map((item) => item.weight));
	const ranked = [...words]
		.map((item) => ({ word: item.word, weight: Math.max(1, item.weight) }))
		.sort((a, b) => b.weight - a.weight || a.word.localeCompare(b.word));
	const placed: WordcloudItem[] = [];
	for (const [index, item] of ranked.entries()) {
		const ratio = item.weight / max;
		const desired = Math.round(13 + ratio * 64);
		const fitsOneLine = Math.floor((width - GAP * 2) / Math.max(1, item.word.length * 0.56));
		const fontSize = Math.min(desired, fitsOneLine);
		if (fontSize < 6) continue;
		const rotated = index % 5 === 2 && item.word.length < 22;
		const size = measure(item.word, fontSize);
		const boxWidth = rotated ? size.height : size.width;
		const boxHeight = rotated ? size.width : size.height;
		if (boxWidth > width || boxHeight > height) continue;
		const position = findPosition(placed, boxWidth, boxHeight, width, height);
		if (!position) continue;
		placed.push({
			word: item.word,
			weight: item.weight,
			fontSize,
			rotated,
			x: position.x,
			y: position.y,
			width: boxWidth,
			height: boxHeight
		});
	}
	return { width, height, items: placed, omitted: ranked.length - placed.length };
}
