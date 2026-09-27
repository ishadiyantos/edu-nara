import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	testDir: 'tests/e2e',
	fullyParallel: false,
	workers: 1,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	reporter: process.env.CI ? 'github' : 'list',
	use: {
		baseURL: 'http://127.0.0.1:4173',
		trace: 'on-first-retry'
	},
	webServer: {
		command: 'node --import tsx scripts/e2e-server.ts',
		port: 4173,
		reuseExistingServer: false,
		timeout: 120_000
	},
	projects: [
		{
			name: 'mobile-360',
			use: { ...devices['Pixel 5'], viewport: { width: 360, height: 780 } }
		},
		{
			name: 'tablet-768',
			use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 1024 } }
		},
		{
			name: 'desktop-1440',
			use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } }
		}
	]
});
