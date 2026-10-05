/* Збирає всі шматки фраз, які може сказати Тік, → public/voice/chunks.json.
   Далі video/game_voice.py (або workflow «Game voice») начитує їх голосом Лади.

     npm i -D playwright     # або PLAYWRIGHT_MODULE=/шлях/до/playwright/index.mjs
     node scripts/harvest-speech.mjs [кількість завдань, типово 20000]

   Запускає vite dev, і гра сама відповідає на випадкові завдання в усіх рівнях і пригодах
   (див. __harvestSpeech у src/ui/practice.ts). Розріз на шматки — той самий, що в грі. */

import { spawn } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const N = Number(process.argv[2] || 20000);
const PORT = 5199;
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');

const dev = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
for (let i = 0; ; i++) {
  if (await fetch(`http://localhost:${PORT}/`).then(r => r.ok, () => false)) break;
  if (i > 120) throw new Error('vite dev не запустився');
  await new Promise(r => setTimeout(r, 500));
}

try {
  const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  const page = await browser.newPage();
  page.on('pageerror', e => console.error('Помилка на сторінці:', e.message));
  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForFunction(() => '__harvestSpeech' in window);
  for (let done = 0; done < N; done += 500) {
    await page.evaluate(k => window.__harvestSpeech(k), Math.min(500, N - done));
    process.stdout.write(`\r${Math.min(N, done + 500)} / ${N}`);
  }
  const old = existsSync('public/voice/chunks.json') ? JSON.parse(readFileSync('public/voice/chunks.json', 'utf8')) : [];
  const pieces = await page.evaluate(async old => {
    const { speechPlan } = await import('/src/core/speech.ts');
    // Старі шматки лишаємо: випадкові завдання могли їх цього разу не зачепити
    const seen = new Map(old.map(p => [p.key, p.text]));
    for (const text of window.__spoken) {
      for (const p of speechPlan(text).flat()) if (!seen.has(p.key)) seen.set(p.key, p.text);
    }
    return [...seen].map(([key, text]) => ({ key, text })).sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  }, old);
  writeFileSync('public/voice/chunks.json', JSON.stringify(pieces, null, 1) + '\n');
  console.log(`\nШматків: ${pieces.length} → public/voice/chunks.json`);
  await browser.close();
} finally {
  dev.kill();
}
