import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';

const demoUrl = process.env.DEMO_URL ?? 'http://127.0.0.1:4180';

test('loads the workbench and reports real local tool readiness', async ({ page }) => {
  test.setTimeout(45_000);
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  const response = await page.goto('/');
  expect(response.status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'Code changed. Did it work?' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Describe the change' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Local preflight' })).toBeVisible();
  await expect(page.getByText('No runs yet')).toBeVisible();
  await expect(page.locator('.preflight-row')).toHaveCount(4, { timeout: 30_000 });
  expect(pageErrors).toEqual([]);
});

test('serves the supplied backgrounds and assigns one to each screen', async ({ page, request }) => {
  await page.goto('/');
  await expect(page.locator('body')).toHaveAttribute('data-screen', 'workbench');
  const workbenchBackground = await page.locator('body').evaluate((element) => getComputedStyle(element, '::before').backgroundImage);
  expect(workbenchBackground).toContain('/images/workbench.png');
  const evidenceBackground = await page.locator('#detail-dialog').evaluate((element) => getComputedStyle(element).backgroundImage);
  expect(evidenceBackground).toContain('/images/evidence-dialogue.png');

  await page.locator('body').evaluate((element) => { element.dataset.screen = 'signin'; });
  const signInBackground = await page.locator('body').evaluate((element) => getComputedStyle(element, '::before').backgroundImage);
  expect(signInBackground).toContain('/images/sign-in.png');

  for (const image of ['sign-in.png', 'workbench.png', 'evidence-dialogue.png']) {
    const response = await request.get(`/images/${image}`);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('image/png');
  }
});

test('publishes the provider requirements and states which hosted connections are unavailable', async ({ page }) => {
  const response = await page.goto('/setup.html');
  expect(response.status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'Bring your accounts. Keep provider costs yours.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'TestMu AI / Kane' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Codex with ChatGPT' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'What is usable today' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Create a TestMu AI account' })).toHaveAttribute('href', 'https://www.testmuai.com/register/');
});

test('loads a real bundled task prompt without creating fabricated run records', async ({ page }) => {
  test.setTimeout(45_000);
  await page.goto('/');
  await page.getByRole('button', { name: 'Load the bundled demo task' }).click();
  await expect(page.getByLabel('What should the coding agent change?')).toHaveValue(/archive and restore/);
  await expect(page.getByLabel(/Fixed Kane acceptance objective/)).toHaveValue(/restore it/);
  await expect(page.getByText('0 / 1600')).not.toBeVisible();
  await expect(page.getByText('No runs yet')).toBeVisible();
});

test('keeps all primary controls keyboard reachable and usable on a narrow viewport', async ({ page }) => {
  test.setTimeout(45_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const task = page.getByLabel('What should the coding agent change?');
  await task.focus();
  await expect(task).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByLabel(/Fixed Kane acceptance objective/)).toBeFocused();
  await expect(page.getByRole('button', { name: 'Run Kane verification' })).toBeVisible();
  const documentWidth = await page.locator('body').evaluate((element) => element.scrollWidth);
  expect(documentWidth).toBeLessThanOrEqual(390);
});

test('exposes health and refuses incomplete task submissions without starting tools', async ({ request }) => {
  const health = await request.get('/api/health');
  expect(health.ok()).toBeTruthy();
  expect(await health.json()).toMatchObject({ ok: true, name: 'PatchLoop' });
  const invalid = await request.post('/api/runs', { data: { task: 'short', objective: 'too short' } });
  expect(invalid.status()).toBe(400);
  expect(await invalid.json()).toHaveProperty('error');
  const runs = await request.get('/api/runs');
  expect((await runs.json()).runs).toEqual([]);
});

test('adds safe response headers and blocks cross-origin state changes', async ({ request }) => {
  const health = await request.get('/api/health');
  expect(health.headers()['x-content-type-options']).toBe('nosniff');
  const blocked = await request.post('/api/runs', {
    headers: { origin: 'https://outside.invalid' },
    data: { task: 'A sufficiently long change request', objective: 'A sufficiently long acceptance objective' },
  });
  expect(blocked.status()).toBe(403);
});

test('archives a completed task and restores it to Active with its checkmark', async ({ page, request }) => {
  const title = `Pay electricity bill ${randomUUID()}`;
  const created = await request.post(`${demoUrl}/api/tasks`, { data: { title } });
  expect(created.status()).toBe(201);
  const task = (await created.json()).task;

  const completed = await request.post(`${demoUrl}/api/tasks/${task.id}/complete`);
  expect(completed.status()).toBe(200);
  expect((await completed.json()).task.completed).toBe(true);

  await page.goto(demoUrl);
  const activeRow = page.locator('li.task', { hasText: title });
  await expect(activeRow).toBeVisible();
  await expect(activeRow.locator('.complete')).toHaveAttribute('aria-label', `Mark active: ${title}`);

  await activeRow.getByRole('button', { name: 'Archive' }).click();
  await expect(activeRow).toHaveCount(0);

  await page.getByRole('button', { name: /Archived/ }).click();
  const archivedRow = page.locator('li.task', { hasText: title });
  await expect(archivedRow).toBeVisible();
  await archivedRow.getByRole('button', { name: 'Restore' }).click();
  await expect(archivedRow).toHaveCount(0);

  await page.getByRole('button', { name: /Active/ }).click();
  const restoredRow = page.locator('li.task', { hasText: title });
  await expect(restoredRow).toBeVisible();
  await expect(restoredRow).toHaveClass(/is-complete/);
  await expect(restoredRow.locator('.complete')).toHaveAttribute('aria-label', `Mark active: ${title}`);

  const finalTasks = (await (await request.get(`${demoUrl}/api/tasks`)).json()).tasks;
  expect(finalTasks.find((item) => item.id === task.id)).toMatchObject({ completed: true, archived: false });
});
