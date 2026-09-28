import { test, expect } from '@playwright/test';
import jsQR from 'jsqr';

test('launch opens presenter in new tab with joining instructions first', async ({
	page,
	context
}) => {
	await page.goto('/admin');
	await page.getByLabel('Email').fill('phase1@example.test');
	await page.getByLabel('Kata sandi').fill('phase1-test-only-password-2026');
	await page.getByRole('button', { name: 'Masuk', exact: true }).click();
	const title = `Presenter QR ${Date.now()}`;
	await page.getByLabel('Judul aktivitas').fill(title);
	await page.getByRole('button', { name: 'Buat aktivitas' }).click();

	const launch = page
		.getByRole('article')
		.filter({ has: page.getByRole('heading', { name: title, exact: true }) })
		.getByRole('button', { name: /Luncurkan sesi/ });
	const popupPromise = context.waitForEvent('page');
	await launch.click();
	const presenter = await popupPromise;
	await presenter.waitForLoadState();

	await expect(presenter).toHaveURL(/admin\/sessions\//);
	await expect(presenter.getByTestId('joining-instructions')).toBeVisible();
	await expect(presenter.getByTestId('session-code')).toBeVisible();
	await expect(presenter.getByRole('img', { name: 'QR code sesi' })).toBeVisible();
	await expect(presenter.getByTestId('presenter-stage')).toHaveCount(0);
	await expect(page).toHaveURL(/\/admin$/);
	expect(await presenter.evaluate(() => window.opener === null)).toBe(true);
	const qr = presenter.getByRole('img', { name: 'QR code sesi' });
	const png = await qr.screenshot();
	const pixels = await presenter.evaluate(async (bytes) => {
		const image = await createImageBitmap(new Blob([new Uint8Array(bytes)], { type: 'image/png' }));
		const canvas = document.createElement('canvas');
		canvas.width = image.width;
		canvas.height = image.height;
		const ctx = canvas.getContext('2d')!;
		ctx.drawImage(image, 0, 0);
		return {
			data: Array.from(ctx.getImageData(0, 0, canvas.width, canvas.height).data),
			width: canvas.width,
			height: canvas.height
		};
	}, Array.from(png));
	expect(jsQR(new Uint8ClampedArray(pixels.data), pixels.width, pixels.height)?.data).toBe(
		await presenter
			.getByRole('link', { name: 'Tautan bergabung', exact: true })
			.getAttribute('href')
	);
	const dock = presenter.getByTestId('session-controls');
	await expect(dock).toHaveCSS('position', 'fixed');
	expect(await dock.locator('svg').count()).toBe(7);
	const box = (await dock.boundingBox())!;
	expect(box.x).toBeGreaterThanOrEqual(0);
	expect(box.x + box.width).toBeLessThanOrEqual(presenter.viewportSize()!.width);
	expect(box.y + box.height).toBeLessThanOrEqual(presenter.viewportSize()!.height);
	await presenter.getByTestId('fullscreen-button').click();
	await expect(presenter.getByTestId('joining-instructions')).toBeVisible();
	expect(
		await presenter
			.getByTestId('session-screen')
			.evaluate((el) => el.scrollHeight <= el.clientHeight)
	).toBe(true);
	const qrBox = (await qr.boundingBox())!;
	expect(qrBox.y + qrBox.height).toBeLessThanOrEqual(presenter.viewportSize()!.height);
	await presenter.keyboard.press('Escape');
	await presenter.reload();
	await expect(presenter.getByTestId('joining-instructions')).toBeVisible();
	await expect(presenter.getByRole('link', { name: 'Dashboard admin', exact: true })).toBeVisible();
	await expect(presenter.getByRole('button', { name: 'Buka sesi', exact: true })).toBeVisible();
	await expect(
		presenter.getByRole('button', { name: 'Mode layar penuh', exact: true })
	).toBeVisible();
	await expect(
		presenter.getByRole('link', { name: 'Tautan bergabung', exact: true })
	).toBeVisible();

	await presenter.getByRole('button', { name: 'Buka sesi', exact: true }).click();
	await expect(presenter.getByTestId('joining-instructions')).toHaveCount(0);
	await expect(presenter.getByText('Belum ada pertanyaan')).toBeVisible();
	await presenter.close();
});
