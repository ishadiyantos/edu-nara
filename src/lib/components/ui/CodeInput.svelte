<script lang="ts">
	/**
	 * CodeInput — input kode sesi 6 karakter, per-cell.
	 * Auto-uppercase, hanya A-Z / 2-9 (menghindari ambigu 0/O/1/I).
	 * Auto-advance & backspace-mundur, paste terdistribusi ke seluruh cell.
	 */
	type Props = {
		length?: number;
		value?: string;
		onchange?: (v: string) => void;
		label?: string;
	};

	let { length = 6, value = $bindable(''), onchange, label = 'Kode sesi' }: Props = $props();

	const ALPHABET = /^[A-HJ-NP-Z2-9]$/;
	let refs: HTMLInputElement[] = $state([]);
	let cells = $derived(Array.from({ length }, (_, i) => (value[i] ?? '').trim().toUpperCase()));

	function setCell(i: number, ch: string) {
		const chars = value.padEnd(length, ' ').split('');
		chars[i] = ch || ' ';
		const next = chars.join('').trimEnd();
		value = next;
		onchange?.(next);
	}

	function handleInput(i: number, e: Event) {
		const target = e.target as HTMLInputElement;
		const raw = target.value.slice(-1).toUpperCase();
		if (raw === '') {
			setCell(i, '');
			return;
		}
		if (!ALPHABET.test(raw)) {
			target.value = cells[i] ?? '';
			return;
		}
		setCell(i, raw);
		target.value = raw;
		if (i < length - 1) refs[i + 1]?.focus();
	}

	function handleKeydown(i: number, e: KeyboardEvent) {
		if (e.key === 'Backspace' && !(e.target as HTMLInputElement).value && i > 0) {
			refs[i - 1]?.focus();
		} else if (e.key === 'ArrowLeft' && i > 0) {
			refs[i - 1]?.focus();
		} else if (e.key === 'ArrowRight' && i < length - 1) {
			refs[i + 1]?.focus();
		}
	}

	function handlePaste(e: ClipboardEvent) {
		e.preventDefault();
		const txt = (e.clipboardData?.getData('text') ?? '')
			.toUpperCase()
			.split('')
			.filter((c) => ALPHABET.test(c))
			.slice(0, length)
			.join('');
		value = txt;
		onchange?.(txt);
		refs[Math.min(txt.length, length - 1)]?.focus();
	}
</script>

<fieldset class="flex min-w-0 flex-col gap-2">
	<legend class="text-sm font-medium text-text">{label}</legend>
	<div class="grid min-w-0 grid-cols-6 gap-1.5 sm:gap-2" role="group" aria-label={label}>
		{#each cells as ch, i}
			<input
				bind:this={refs[i]}
				type="text"
				inputmode="text"
				autocomplete="off"
				autocapitalize="characters"
				maxlength="1"
				value={ch}
				aria-label={`Karakter ${i + 1} dari ${length}`}
				class="h-12 min-w-0 rounded-xl border-2 border-border bg-surface text-center font-mono
				       text-xl font-bold uppercase tracking-widest sm:h-14 sm:text-2xl
				       focus:border-primary focus:ring-4 focus:ring-primary/15 focus:outline-none"
				oninput={(e) => handleInput(i, e)}
				onkeydown={(e) => handleKeydown(i, e)}
				onpaste={handlePaste}
			/>
		{/each}
	</div>
	<p class="text-xs text-muted">
		Contoh: <span class="font-mono font-semibold">A B 3 C 7 K</span> — gunakan huruf & angka.
	</p>
</fieldset>
