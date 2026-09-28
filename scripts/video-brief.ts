/* Генерує бриф для виробництва відео з каталогу src/core/videos.ts:
   docs/video/STORYBOARD.md і docs/video/manifest.example.json.
   Запуск: npm run video:brief */

import { writeFileSync } from 'node:fs';
import { MOTION, partsOf, sentences } from '../src/core/video-beats.ts';
import { INTRO, PARENTS, STAGE_VIDEOS, TRAP_VIDEOS, type VideoClip } from '../src/core/videos.ts';

const words = (s: string) => s.split(/\s+/).length;
// Дитяча озвучка — близько 2,2 слова на секунду
const secs = (c: VideoClip) => Math.max(8, Math.round(words(c.say) / 2.2) + 2);

const section = (title: string, list: VideoClip[]) => [
  `## ${title}`, '',
  ...list.flatMap(c => [
    `### \`${c.id}\` — ${c.title}`, '',
    `**Тривалість:** ~${secs(c)} с · **Файл:** \`${c.id}.mp4\` (+ \`${c.id}.jpg\` постер)`, '',
    `**Озвучка (Тік, українською):**`, '', `> ${c.say}`, '',
    `**Кадр:** ${c.shot}`, ''
  ])
];

const all = [INTRO, ...STAGE_VIDEOS, ...Object.values(TRAP_VIDEOS), PARENTS];
const total = all.reduce((s, c) => s + secs(c), 0);

const md = [
  '# Відеопояснення ЧасоПарку — бриф для виробництва', '',
  '> Згенеровано з `src/core/videos.ts` командою `npm run video:brief`. Не редагуйте вручну —',
  '> змінюйте сценарії в коді, щоб гра, субтитри й кліпи казали одне й те саме.', '',
  `Кліпів: **${all.length}**, загальна тривалість ≈ **${Math.round(total / 60)} хв**.`, '',
  '## Технічні вимоги', '',
  '- Формат: MP4 (H.264 + AAC), 16:9, 1280×720 або 1920×1080, до ~8 Мбіт/с; вертикальні не потрібні.',
  '- Постер: JPG того самого кадру, що й перший кадр кліпу.',
  '- Мова: українська. Темп спокійний, дитячий; без фонової музики гучнішої за голос.',
  '- Персонаж: Тік — [reference/tik-idle.png](reference/tik-idle.png), [tik-happy](reference/tik-happy.png), [tik-oops](reference/tik-oops.png).',
  '- Світ: [reference/park-full.png](reference/park-full.png). Кольори стрілок **обов’язкові**: коротка — червона, довга — синя, секундна — помаранчева; числа хвилин — сині.',
  '- Субтитри: якщо `.vtt` немає, гра будує їх зі сценарію автоматично.', '',
  '## Публікація', '',
  '1. Завантажте кліпи й `manifest.json` в одну теку сховища (Vercel Blob / CDN) з дозволеним CORS.',
  '2. Задайте `VITE_VIDEO_BASE` = адреса теки (у Vercel → Environment Variables) і перезберіть.',
  '3. Кнопки «▶ Відео» з’являться лише для кліпів, що є в маніфесті — можна викладати поступово.', '',
  ...section('Вступ', [INTRO]),
  ...section('Етапи уроку', STAGE_VIDEOS),
  ...section('Після помилки', Object.values(TRAP_VIDEOS)),
  ...section('Для батьків', [PARENTS])
].join('\n');

writeFileSync('docs/video/STORYBOARD.md', md);
writeFileSync('docs/video/manifest.example.json', JSON.stringify({
  clips: Object.fromEntries(all.map(c => [c.id, { src: c.id + '.mp4', poster: c.id + '.jpg' }]))
}, null, 2) + '\n');
// Вхід для локального конвеєра: Piper (озвучка) → Blender (рендер)
writeFileSync('video/clips.json', JSON.stringify(all.map(c => ({
  id: c.id, title: c.title, say: c.say, shot: c.shot, sentences: sentences(c.say),
  ...MOTION[c.id], parts: partsOf(MOTION[c.id])
})), null, 2) + '\n');
console.log(`STORYBOARD.md: ${all.length} кліпів, ≈${Math.round(total / 60)} хв`);
