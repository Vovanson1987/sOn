import { test, expect } from '@playwright/test';

test.describe('Экран переписки', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
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

  test('секретный чат показывает "Секретный чат"', async ({ page }) => {
    await page.getByText('Алексей').click();
    // Ждём завершения анимации обмена ключами
    await page.waitForTimeout(4000);
    await expect(page.getByText('Секретный чат')).toBeVisible();
  });
});
