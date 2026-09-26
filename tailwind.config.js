/** @type {import('tailwindcss').Config} */
export default {
	content: ['./src/**/*.{html,js,svelte,ts}'],
	theme: {
		extend: {
			colors: {
				primary: {
					DEFAULT: 'var(--color-primary)',
					soft: 'var(--color-primary-soft)'
				},
				accent: 'var(--color-accent)',
				warning: 'var(--color-warning)',
				danger: 'var(--color-danger)',
				bg: 'var(--color-bg)',
				surface: 'var(--color-surface)',
				text: 'var(--color-text)',
				muted: 'var(--color-text-muted)',
				border: 'var(--color-border)'
			},
			borderRadius: {
				card: 'var(--radius-card)'
			},
			boxShadow: {
				card: 'var(--shadow-card)',
				lift: 'var(--shadow-lift)'
			},
			fontFamily: {
				sans: [
					'-apple-system',
					'"Segoe UI"',
					'Roboto',
					'Inter',
					'"Helvetica Neue"',
					'Arial',
					'sans-serif'
				],
				mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace']
			}
		}
	},
	plugins: []
};
