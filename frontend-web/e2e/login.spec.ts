import { test, expect } from '@playwright/test';

test('signup/login flow and devices smoke', async ({ page, request }) => {
  const username = `e2e_${Date.now()}`;
  const password = 'e2e-pass';
  const email = `${username}@example.com`;

  // register via backend API
  const reg = await request.post('http://127.0.0.1:8000/api/auth/register/', { data: { username, password, email } });
  expect(reg.ok()).toBeTruthy();
  const body = await reg.json();
  const token = body.token;

  // set token in localStorage before loading app
  await page.addInitScript((token) => {
    localStorage.setItem('apiToken', token);
  }, token);

  await page.goto('/');

  // open Devices view
  await page.click('text=Devices');

  // expect the dashboard summary to render
  await expect(page.locator('text=Total Devices')).toBeVisible({ timeout: 5000 });
});
