# Відеопояснення: локальний конвеєр

```
src/core/videos.ts ─┐                     ┌─ LM Studio (необов’язково): review.py → out/review.md
src/core/video-beats.ts ┴─ npm run video:brief → clips.json
                                           ├─ голос:   voice.py  → out/<id>/voice.wav + spans.json
                                           └─ Blender: render.py → out/<id>/<id>.blend / .mp4 / .jpg / .vtt
                                                                  out/manifest.json
```

Сценарії й рух стрілок живуть **у коді гри**, тож гра, субтитри й кліпи завжди кажуть одне.
Стрілки рендерить Blender за точною математикою — генератори відео плутають циферблат.

## Що встановити

| Інструмент | Навіщо | Як |
|---|---|---|
| Blender 4.2+ | рендер сцен, редаговані `.blend` | blender.org (у вас уже є) |
| Python 3.10+ | запуск скриптів | python.org |
| ukrainian-tts | український голос Тіка (Лада), офлайн, наголоси зі словника. Потрібен **Python 3.10** | `pip install -r video/requirements.txt` |
| ffmpeg | зведення голосу до потрібного формату | winget / brew / apt |
| Piper (запасний) | старий голос, `--engine piper` | `pip install piper-tts` і модель [ukrainian_tts](https://huggingface.co/rhasspy/piper-voices/tree/main/uk/uk_UA/ukrainian_tts/medium) у `video/voices/` |
| LM Studio | редакторська перевірка сценаріїв | у вас уже є; увімкніть сервер (Developer → Start Server) |

## Кроки

```bash
npm run video:brief                                   # 1. сценарії → video/clips.json

python video/review.py --model bionic                 # 2. (необов’язково) зауваження → video/out/review.md

python video/voice.py                                 # 3. голос Тіка (ukrainian-tts, Лада);
                                                      #    інший: --speaker Tetiana / Mykyta / Oleksa / Dmytro
                                                      #    порівняти голоси: video/voice_samples.py → docs/voice-samples/

blender -b -P video/blender/render.py -- --only stage-4          # 4. пробний кліп
blender -b -P video/blender/render.py -- --res 1920x1080         #    усі 21 кліп
```

Без голосу можна одразу робити чернетки: `python video/voice.py --silent`.

**Швидкість.** Типовий рушій — Eevee на відеокарті (секунди на кліп). Без відеокарти:
`--engine CYCLES --samples 16` — повільніше, але працює всюди.

**Правки.** Кожен кліп зберігається як `video/out/<id>/<id>.blend`: відкрийте в Blender і
змініть що завгодно — кольори, розташування, криві анімації. Щоб перерендерити саме
правлену сцену, рендеріть її з Blender (Render → Render Animation). Повторний запуск
`render.py` будує сцену заново з партитури й **перезаписує** `.blend`.

## Публікація

Уся тека `video/out/` (крім `.blend`, `.wav`, `spans.json`) разом із `manifest.json`
викладається в сховище з дозволеним CORS (наприклад, Vercel Blob). Адреса теки → змінна
`VITE_VIDEO_BASE` у Vercel, потім перезбірка. Кнопки «▶ Відео» з’являться самі.

## Голос Тіка в самій грі

У грі Тік говорить тими самими записами Лади, а не голосом браузера. Тому його чути на будь-якому
пристрої, навіть без українського голосу в системі, і офлайн (записи кешуються після першого програвання).

Фраза ріжеться на шматки (`src/core/speech.ts`): сталий текст («Постав стрілки на»), словесний час цілим
шматком («двадцять хвилин на восьму»), числа й електронний час словами з правильними відмінками. Гра
склеює записи шматків підряд. Якщо якогось шматка бракує, говорить Web Speech (якщо він є).

```bash
npm i -D playwright                         # один раз
node scripts/harvest-speech.mjs             # гра сама проходить 20 000 завдань → public/voice/chunks.json
git add public/voice/chunks.json && git push   # workflow «Game voice» начитає нові шматки й закомітить mp3
```

Локально замість workflow: `python video/game_voice.py` (Python 3.10 з ukrainian-tts).
Змінили текст реплік у грі — перезберіть `chunks.json`, інакше нові фрази звучатимуть голосом браузера.
