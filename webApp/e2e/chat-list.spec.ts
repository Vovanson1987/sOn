import { test, expect } from '@playwright/test';
import { setupAuthenticatedApiMocks } from './helpers';

test.describe('Список чатов', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedApiMocks(page);
  });

  test('отображает список чатов', async ({ page }) => {
    await expect(page.getByText('Алексей')).toBeVisible();
    await expect(page.getByText('Vladimir')).toBeVisible();
  });

  test('отображает поле поиска', async ({ page }) => {
    await expect(page.getByPlaceholder('Поиск чатов')).toBeVisible();
  });

  test('клик по чату открывает переписку', async ({ page }) => {
    await page.getByText('Vladimir').click();
    await expect(page.getByText('iMessage')).toBeVisible();
  });

  test('секретный чат отображается в списке', async ({ page }) => {
    await expect(page.getByText('Алексей')).toBeVisible();
    await expect(page.getByText(/Зашифрованное сообщение/i)).toBeVisible();
  });
});

test.describe('Адаптивность', () => {
  test('мобильный viewport показывает список чатов', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await setupAuthenticatedApiMocks(page);
    await expect(page.getByText('Алексей')).toBeVisible();
  });

  test('десктопный viewport показывает двухколоночный layout', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await setupAuthenticatedApiMocks(page);
    await expect(page.getByText('Выберите чат')).toBeVisible();
    await expect(page.getByText('Алексей')).toBeVisible();
  });
});
