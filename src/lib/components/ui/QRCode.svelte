<script lang="ts">
	/**
	 * QRCode — SVG placeholder untuk Fase 0.
	 * Menampilkan pola dekoratif deterministik dari `value` sehingga terlihat
	 * seperti QR asli untuk keperluan wireframe. Diganti dengan encoder QR
	 * asli di Fase 1 (via `qrcode` npm).
	 */
	type Props = {
		value: string;
		size?: number;
		label?: string;
	};
	let { value, size = 200, label = 'QR code sesi' }: Props = $props();

	const grid = 21;
	// Hash sederhana → seed
	function hash(s: string): number {
		let h = 2166136261;
		for (let i = 0; i < s.length; i++) {
			h ^= s.charCodeAt(i);
			h = Math.imul(h, 16777619);
		}
		return h >>> 0;
	}
	let seed = $derived(hash(value || 'edu-nara'));
	const indices = Array.from({ length: grid }, (_, index) => index);

	function cellOn(r: number, c: number): boolean {
		// Position markers di 3 sudut
		function inMarker(rr: number, cc: number) {
			const inTL = rr < 7 && cc < 7;
			const inTR = rr < 7 && cc >= grid - 7;
			const inBL = rr >= grid - 7 && cc < 7;
			return inTL || inTR || inBL;
		}
		if (inMarker(r, c)) {
			// pola frame 7x7 dengan 3x3 tengah
			const lr = r < 7 ? r : r - (grid - 7);
			const lc = c < 7 && r < 7 ? c : c < 7 ? c : c - (grid - 7);
			const edge = lr === 0 || lr === 6 || lc === 0 || lc === 6;
			const inner = lr >= 2 && lr <= 4 && lc >= 2 && lc <= 4;
			return edge || inner;
		}
		// pseudo-random dari seed
		const bit = (((r * 31 + c) * 2654435761) ^ seed) & 0xff;
		return bit % 2 === 0;
	}
</script>

<div class="inline-block rounded-2xl border border-border bg-white p-3 shadow-card">
	<svg
		width={size}
		height={size}
		viewBox="0 0 {grid} {grid}"
		role="img"
		aria-label={label}
		shape-rendering="crispEdges"
	>
		<rect width={grid} height={grid} fill="#ffffff" />
		{#each indices as r}
			{#each indices as c}
				{#if cellOn(r, c)}
					<rect x={c} y={r} width="1" height="1" fill="#0f172a" />
				{/if}
			{/each}
		{/each}
	</svg>
	<p class="mt-2 text-center font-mono text-sm font-semibold tracking-widest">{value}</p>
</div>
