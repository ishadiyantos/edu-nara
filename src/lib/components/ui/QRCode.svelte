<script lang="ts">
	/**
	 * QRCode — SVG scannable QR encoding `value` (mis. join URL).
	 * Matrix dihitung oleh `qrcode` (encoder standar), dirender sebagai
	 * <rect> per modul tanpa {@html} agar tetap lolos CSP.
	 */
	import QRCode from 'qrcode';
	type Props = {
		value: string;
		size?: number;
		label?: string;
	};
	let { value, size = 200, label = 'QR code sesi' }: Props = $props();
	let matrix = $derived.by(() => {
		try {
			const cells = QRCode.create(value, { errorCorrectionLevel: 'M' }).modules;
			return { size: cells.size, data: cells.data as unknown as Uint8Array };
		} catch {
			return null;
		}
	});
	const range = $derived(matrix ? Array.from({ length: matrix.size }, (_, i) => i) : []);
</script>

<div class="qr-code inline-block max-w-full rounded-2xl bg-white p-2 shadow-card">
	{#if matrix}
		<svg
			width={size}
			height={size}
			viewBox="-4 -4 {matrix.size + 8} {matrix.size + 8}"
			role="img"
			aria-label={label}
			shape-rendering="crispEdges"
		>
			<rect x="-4" y="-4" width={matrix.size + 8} height={matrix.size + 8} fill="#ffffff" />
			{#each range as y}
				{#each range as x}
					{#if matrix.data[y * matrix.size + x]}
						<rect {x} {y} width="1" height="1" fill="#0f172a" />
					{/if}
				{/each}
			{/each}
		</svg>
	{:else}
		<p class="p-4 text-sm text-danger">Gagal membuat QR.</p>
	{/if}
</div>

<style>
	svg {
		display: block;
		max-width: 100%;
		height: auto;
	}
</style>
