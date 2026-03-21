import { test, expect } from '@playwright/test';
import { setupAuthenticatedApiMocks } from './helpers';

test.describe('Экран переписки', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await setupAuthenticatedApiMocks(page);
  });

  test('отправка сообщения', async ({ page }) => {
    // Открыть чат с Vladimir
    await page.getByText('Vladimir').click();

    // Написать и отправить сообщение
    const input = page.getByPlaceholder('iMessage');
    await input.fill('Тестовое сообщение');
    await input.press('Enter');

    // Проверить что сообщение появилось
    await expect(page.getByText('Тестовое сообщение')).toBeVisible();
  });

  test('открытие чата показывает заголовок и поле ввода', async ({ page }) => {
    await page.getByText('Vladimir').click();
    await expect(page.getByText('iMessage')).toBeVisible();
    await expect(page.getByPlaceholder('iMessage')).toBeVisible();
  });
});
