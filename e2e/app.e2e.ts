/* Наскрізні сценарії ЧасоПарку. Кожен тест — свіжий браузер без прогресу. */

import { expect, test, type Page } from '@playwright/test';

type Tower = {
  dialPoint(x: number, y: number): { x: number; y: number } | null;
  debugState(): { stage: number; practice: boolean; half: boolean; quarter: boolean; ghostOpacity: number; tier: number };
};
type Learn = { cur: number; playing: boolean; narrIdx: number; narrOn: boolean };
declare global {
  interface Window { __tower3d?: () => Tower | null; __learn?: () => Learn }
}

const click = (page: Page, id: string) => page.evaluate(i => (document.getElementById(i) as HTMLElement).click(), id);
const learnState = (page: Page) => page.evaluate(() => window.__learn!());
const tower = (page: Page) => page.evaluate(() => window.__tower3d!()!.debugState());

async function start(page: Page, mode: 'learn' | 'practice') {
  await page.goto('/');
  await expect(page.locator('#welcome')).toBeVisible();
  await click(page, mode === 'learn' ? 'wLearn' : 'wPlay');
  // 3D-космос завантажився й лежить під інтерфейсом
  await expect(page.locator('body')).toHaveClass(/bg-3d/);
  await page.waitForFunction(() => !!window.__tower3d?.());
}

async function goStage(page: Page, i: number) {
  await page.evaluate(k => (document.querySelectorAll('.rail-dot')[k] as HTMLElement).click(), i);
  await expect(page.locator('#badge')).toHaveText(`Етап ${i + 1} / 11`);
}

/** Точка на екрані, де лежить задана точка циферблата вежі (x праворуч, y угору, 1 — край). */
async function screenOf(page: Page, tx: number, ty: number) {
  return page.evaluate(([tx, ty]) => {
    const t = window.__tower3d!()!;
    let best = { x: 0, y: 0, d: Infinity };
    for (let x = 0; x < innerWidth; x += 6) for (let y = 0; y < innerHeight; y += 6) {
      const p = t.dialPoint(x, y);
      if (!p) continue;
      const d = Math.hypot(p.x - tx, p.y - ty);
      if (d < best.d) best = { x, y, d };
    }
    return best;
  }, [tx, ty] as const);
}

test.describe('Урок', () => {
  test('усі 11 етапів в один ряд, перемикання й автозапуск вимкнено', async ({ page }) => {
    await start(page, 'learn');
    const rail = await page.locator('#rail').evaluate(r => [r.scrollWidth, r.clientWidth, r.children.length]);
    expect(rail[2]).toBe(11);
    expect(rail[0]).toBeLessThanOrEqual(rail[1] + 1);
    await click(page, 'btnNext');
    await expect(page.locator('#badge')).toHaveText('Етап 2 / 11');
    await click(page, 'btnPrev');
    await expect(page.locator('#badge')).toHaveText('Етап 1 / 11');

    // Повернулися знову — урок не стартує сам
    await page.reload();
    await page.waitForFunction(() => !!window.__learn);
    expect((await learnState(page)).playing).toBe(false);
  });

  test('жовті сектори-підказки — лише на етапах 6 і 7; креслення ледь помітне', async ({ page }) => {
    await start(page, 'learn');
    await click(page, 'btnPlay');                   // пауза: самі гортаємо етапи
    expect((await tower(page)).ghostOpacity).toBeLessThan(0.1);
    await goStage(page, 5);
    expect(await tower(page)).toMatchObject({ half: true, quarter: false });
    await goStage(page, 6);
    expect(await tower(page)).toMatchObject({ half: false, quarter: true });
    await goStage(page, 9);
    expect(await tower(page)).toMatchObject({ half: false, quarter: false });
    await expect(page.locator('#btnTry')).toBeHidden();
    // Креслення не стає суцільним, навіть коли «Підсвітка» пульсує кілька кадрів
    await page.waitForTimeout(800);
    expect((await tower(page)).ghostOpacity).toBeLessThan(0.1);
  });

  test('Тік читає етап частинами й підсвічує картку, яку читає', async ({ page }) => {
    await start(page, 'learn');
    await goStage(page, 3);
    // Читання йде частинами (без звуку частини проходять швидко, але по черзі)
    await page.waitForFunction(() => window.__learn!().narrIdx >= 2);
    expect((await learnState(page)).cur).toBe(3);
  });

  test('«Тепер ти!»: торкнутися числа 6 і поставити довгу стрілку на половину', async ({ page }) => {
    await start(page, 'learn');
    await click(page, 'btnPlay');
    await goStage(page, 2);
    await page.waitForTimeout(3000);                // камера долітає до циферблата
    await expect(page.locator('#btnTry')).toBeVisible();
    await click(page, 'btnTry');
    await expect(page.locator('#buddySay')).toContainText('числа 6');
    const four = await screenOf(page, 0.69, -0.4);
    await page.mouse.click(four.x, four.y);
    await expect(page.locator('#buddySay')).toContainText('інше число');
    const six = await screenOf(page, 0, -0.78);
    await page.mouse.click(six.x, six.y);
    await expect(page.locator('#buddySay')).toContainText('Шість унизу');

    await goStage(page, 5);
    await page.waitForTimeout(3000);
    await click(page, 'btnTry');
    const c = await screenOf(page, 0, 0), top = await screenOf(page, 0, 0.75);
    const r = c.y - top.y;
    await page.mouse.move(c.x, c.y - r);
    await page.mouse.down();
    for (let a = 0; a <= 180; a += 6) {
      const t = a * Math.PI / 180;
      await page.mouse.move(c.x + Math.sin(t) * r, c.y - Math.cos(t) * r);
    }
    await page.mouse.up();
    await expect(page.locator('#buddySay')).toContainText('30 хвилин');
  });
});

test.describe('Гра', () => {
  test('«Не знаю» показує відповідь, «Далі» дає нове питання', async ({ page }) => {
    await start(page, 'practice');
    await expect(page.locator('#qText')).not.toHaveText('—');
    await click(page, 'pDunno');
    await expect(page.locator('#qFb')).toBeVisible();
    await expect(page.locator('#qFb')).toContainText('Правильно');
    await click(page, 'pNext');
    await expect(page.locator('#qFb')).toBeHidden();
  });

  test('«Постав стрілки» клавіатурою зараховується', async ({ page }) => {
    await start(page, 'practice');
    // Шукаємо завдання «Постав стрілки» (рівень 1 — лише цілі години)
    for (let i = 0; i < 40 && await page.locator('#pCheck').isHidden(); i++) {
      await click(page, 'pDunno');
      await click(page, 'pNext');
    }
    await expect(page.locator('#pCheck')).toBeVisible();
    const want = (await page.locator('#qText .target').textContent())!;
    const [wh] = want.split(':').map(Number);
    const [h] = (await page.locator('#digital').textContent())!.split(':').map(Number);
    const d = ((wh % 12) - (h % 12) + 12) % 12;
    await page.locator('body').focus();
    for (let k = 0; k < d; k++) await page.keyboard.press('ArrowUp');
    await expect(page.locator('#digital')).toHaveText(want);
    await click(page, 'pCheck');
    await expect(page.locator('#qFb')).toContainText('Правильно');
  });

  test('«Годинник удома» звіряє зі справжнім часом', async ({ page }) => {
    await start(page, 'practice');
    await page.evaluate(() => (document.querySelector('.home-btn') as HTMLElement).click());
    await expect(page.locator('#pChip')).toHaveText('🏠 Годинник удома');
    // На рівні 1 досить найближчої години
    const now = new Date();
    const target = Math.round(((now.getHours() % 12) * 60 + now.getMinutes()) / 60) % 12;
    const [h] = (await page.locator('#digital').textContent())!.split(':').map(Number);
    const d = (target - (h % 12) + 12) % 12;
    await page.locator('body').focus();
    for (let k = 0; k < d; k++) await page.keyboard.press('ArrowUp');
    await click(page, 'pCheck');
    await expect(page.locator('#qFb')).toContainText('Так і є');
    await expect(page.locator('.home-note')).toContainText('сьогодні');
  });
});

test.describe('Плануємо день (9–10 років)', () => {
  test('пригода відкривається після «П’ятірками», задача з 24-годинним часом, пояснення помилки', async ({ page }) => {
    await start(page, 'practice');
    const plan = page.locator('#adventures .level-btn', { hasText: 'Плануємо день' });
    await expect(plan).toBeDisabled();
    await page.evaluate(() => { const k = 'chasopark.progress.v2'; const p = JSON.parse(localStorage.getItem(k)!); p.unlocked = 4; localStorage.setItem(k, JSON.stringify(p)); });
    await page.reload();
    await page.waitForFunction(() => !!window.__tower3d?.());
    await click(page, 'modePractice');
    await expect(plan).toBeEnabled();
    await plan.click();
    await expect(page.locator('#pChip')).toContainText('Плануємо день');
    await expect(page.locator('#qText')).toHaveText(/\d{2}:\d{2}/);
    await expect(page.locator('#qOpts .opt')).toHaveCount(4);
    // Будь-яка відповідь — відгук і прокручені до кінця стрілки
    await page.locator('#qOpts .opt').first().click();
    await expect(page.locator('#qFb')).toBeVisible();
    await expect(page.locator('#pNext')).toBeVisible();
  });
});

test.describe('Батьки', () => {
  test('звіт за множенням, план на тиждень і набір для друку', async ({ page }) => {
    await start(page, 'practice');
    await click(page, 'btnParents');
    const q = (await page.locator('#gQ').textContent())!;
    const [a, b] = q.match(/\d+/g)!.map(Number);
    await page.fill('#gA', String(a * b));
    await page.press('#gA', 'Enter');
    await expect(page.locator('.r-plan')).toBeVisible();
    await expect(page.locator('.r-day-card')).toHaveCount(3);
    await expect(page.locator('.r-kit')).toHaveAttribute('href', '/print.html');
    const kit = await page.request.get('/print.html');
    expect(kit.ok()).toBe(true);
  });
});

test.describe('Резервна копія', () => {
  test('зберегти у файл, скинути, відновити з файлу; код теж працює', async ({ page }) => {
    await start(page, 'practice');
    await page.evaluate(() => { const k = 'chasopark.progress.v2'; const p = JSON.parse(localStorage.getItem(k)!); p.totals.asked = 77; p.unlocked = 3; localStorage.setItem(k, JSON.stringify(p)); });
    await page.reload();
    await page.waitForFunction(() => !!window.__tower3d?.());
    const openReport = async () => {
      await click(page, 'btnParents');
      const [a, b] = (await page.locator('#gQ').textContent())!.match(/\d+/g)!.map(Number);
      await page.fill('#gA', String(a * b));
      await page.press('#gA', 'Enter');
      await expect(page.locator('.r-backup')).toBeVisible();
    };
    page.on('dialog', d => d.accept());
    const asked = () => page.evaluate(() => JSON.parse(localStorage.getItem('chasopark.progress.v2')!).totals.asked);

    await openReport();
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: '⬇ Зберегти у файл' }).click()]);
    const file = await dl.path();
    expect(dl.suggestedFilename()).toMatch(/^chasopark-\d{4}-\d{2}-\d{2}\.json$/);
    await page.getByRole('button', { name: 'Скинути весь прогрес' }).click();
    expect(await asked()).toBe(0);

    await openReport();
    await page.locator('.r-backup input[type=file]').setInputFiles(file);
    await expect.poll(asked).toBe(77);

    // Код: скопіювати (у полі з'являється CP1-…), скинути, вставити, відновити
    await openReport();
    await page.getByRole('button', { name: '📋 Скопіювати код' }).click();
    const code = await page.locator('.r-code').inputValue();
    expect(code.startsWith('CP1-')).toBe(true);
    await page.getByRole('button', { name: 'Скинути весь прогрес' }).click();
    await openReport();
    await page.fill('.r-code', code);
    await page.getByRole('button', { name: '↩ Відновити з коду' }).click();
    await expect.poll(asked).toBe(77);
  });
});

test.describe('Телефон', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('шторка згортається, 3D лишається тлом', async ({ page }) => {
    await start(page, 'learn');
    const before = await page.locator('#panel').evaluate(p => p.getBoundingClientRect().height);
    await click(page, 'sheetGrip');
    await expect(page.locator('body')).toHaveClass(/sheet-min/);
    const after = await page.locator('#panel').evaluate(p => p.getBoundingClientRect().height);
    expect(after).toBeLessThan(before);
    // Етапи — в один ряд і на вузькому екрані
    const rail = await page.locator('#rail').evaluate(r => [r.scrollWidth, r.clientWidth]);
    expect(rail[0]).toBeLessThanOrEqual(rail[1] + 1);
  });
});
