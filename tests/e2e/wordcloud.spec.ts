import { expect, test } from '@playwright/test';

test('word cloud edit, submit, moderate, reconnect, native fullscreen and fallback', async ({ page, browser }) => {
 test.setTimeout(60000);
 await page.goto('/admin/login');
 await page.getByLabel('Email').fill('phase1@example.test');
 await page.getByLabel('Kata sandi').fill('phase1-test-only-password-2026');
 await page.getByRole('button', { name: 'Masuk', exact: true }).click();
 await page.getByLabel('Judul aktivitas').fill('Cloud flow');
 await page.getByLabel('Jenis aktivitas').selectOption('wordcloud');
 await page.getByRole('button', { name: 'Buat aktivitas' }).click();
 await page.getByRole('link', { name: 'Buka editor' }).first().click();
 await page.getByLabel('Pertanyaan').fill('Bagaimana kelas ini?');
 await expect(page.getByLabel('Moderasi sebelum tampil')).toBeChecked();
 await page.getByLabel('Batas kiriman per peserta').selectOption('2');
 await page.getByRole('button', { name: 'Simpan Word Cloud' }).click();
 await expect(page.getByRole('status')).toHaveText('Word Cloud tersimpan.');
 await page.reload();
 await expect(page.getByLabel('Pertanyaan')).toHaveValue('Bagaimana kelas ini?');
 await page.getByRole('button', { name: 'Luncurkan Word Cloud' }).click();
 const code = (await page.getByTestId('session-code').textContent())!.trim();
 const sessionId = page.url().split('/').pop()!;
 // Wrap native API, not replace: proves gesture call and native success.
 await page.evaluate(() => {
  const native = HTMLElement.prototype.requestFullscreen;
  HTMLElement.prototype.requestFullscreen = function(...args) {
   document.documentElement.dataset.fullscreenGesture = String(navigator.userActivation.isActive);
   return native.apply(this, args);
  };
 });
 await page.getByRole('button', { name: 'Buka sesi', exact: true }).click();
 await expect(page.locator('header')).toContainText('open');
 await expect(page.getByTestId('session-screen')).toHaveClass(/presentation/);
 await expect.poll(() => page.evaluate(() => document.documentElement.dataset.fullscreenGesture)).toBe('true');
 await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(true);
 await expect(page.getByTestId('session-controls')).toHaveCount(0);
 await expect(page.getByRole('link', { name: 'Dashboard', exact: true })).toHaveCount(0);
 const context = await browser.newContext();
 try {
  const student = await context.newPage();
  await student.goto(`/join?code=${code}`);
  await student.getByLabel('Nama tampilan').fill('Cloud participant');
  await student.getByRole('button', { name: 'Bergabung', exact: true }).click();
  await expect(student.getByTestId('wordcloud-player')).toBeVisible();
  await student.getByLabel('Kata atau frasa', { exact: true }).fill('  SÉRU  ');
  await student.getByRole('button', { name: 'Kirim', exact: true }).click();
  await expect(student.getByRole('list', { name: 'Kiriman Anda' })).toContainText('séru');
  await student.reload();
  await expect(student.getByRole('list', { name: 'Kiriman Anda' })).toContainText('séru');
  await expect(student.getByTestId('wordcloud-results')).not.toContainText('séru');
  await expect(page.getByTestId('wordcloud-results')).not.toContainText('séru');
  // Observer participant cannot see other participant's pending text in SSR, JSON or SSE snapshot/replay.
  const observerContext = await browser.newContext();
  try {
   const observer = await observerContext.newPage();
   await observer.goto(`/join?code=${code}`);
   await observer.getByLabel('Nama tampilan').fill('Observer');
   await observer.getByRole('button', { name: 'Bergabung', exact: true }).click();
   await expect(observer.getByTestId('wordcloud-player')).toBeVisible();
   expect(await (await observer.request.get(`/play/${code}`)).text()).not.toContain('séru');
   expect(await (await observer.request.get(`/api/wordcloud/${code}/responses`)).text()).not.toContain('séru');
   const chunk = await observer.evaluate(async (id) => {
    const controller = new AbortController();
    const response = await fetch(`/api/sessions/${id}/events`, { signal: controller.signal, headers: { 'Last-Event-ID': 'old:1' } });
    const reader = response.body!.getReader();
    const first = await reader.read(); controller.abort();
    return new TextDecoder().decode(first.value);
   }, sessionId);
   expect(chunk).not.toContain('séru');
   expect(chunk).toContain('resync');
  } finally { await observerContext.close(); }
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('session-controls')).toBeVisible();
  await expect(page.getByTestId('moderation-item')).toContainText('séru');
  await page.getByRole('button', { name: 'Setujui', exact: true }).click();
  await expect(page.getByTestId('wordcloud-results')).toContainText('séru');
  await expect(student.getByTestId('wordcloud-results')).toContainText('séru');
  await student.reload();
  await expect(student.getByTestId('wordcloud-results')).toContainText('séru');
  await page.getByRole('button', { name: 'Tolak', exact: true }).click();
  await expect(student.getByTestId('wordcloud-results')).not.toContainText('séru');
  // Denied native permission still gives clean viewport slideshow, keyboard/touch exit.
  await page.evaluate(() => { HTMLElement.prototype.requestFullscreen = () => Promise.reject(new Error('denied')); });
  await page.getByTestId('fullscreen-button').click();
  await expect(page.getByTestId('session-screen')).toHaveClass(/presentation/);
  await expect(page.getByTestId('session-controls')).toHaveCount(0);
  await page.mouse.move(20,20);
  await expect(page.getByRole('navigation', { name: 'Kontrol presentasi' })).toHaveCSS('opacity', '1');
  await expect(page.getByRole('navigation', { name: 'Kontrol presentasi' })).toHaveCSS('opacity', '0');
  await page.keyboard.press('Tab');
  await expect(page.getByTestId('exit-fullscreen')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('session-controls')).toBeVisible();
  await student.setViewportSize({ width: 360, height: 780 });
  expect(await student.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
 } finally { await context.close(); }
});
