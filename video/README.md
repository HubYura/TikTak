# Відеопояснення: локальний конвеєр

```
src/core/videos.ts ─┐                     ┌─ LM Studio (необов’язково): review.py → out/review.md
src/core/video-beats.ts ┴─ npm run video:brief → clips.json
                                           ├─ Piper:   voice.py  → out/<id>/voice.wav + spans.json
                                           └─ Blender: render.py → out/<id>/<id>.blend / .mp4 / .jpg / .vtt
                                                                  out/manifest.json
                                              Higgsfield (необов’язково): стилізація готових .mp4
```

Сценарії й рух стрілок живуть **у коді гри**, тож гра, субтитри й кліпи завжди кажуть одне.
Стрілки рендерить Blender за точною математикою — генератори відео плутають циферблат.

## Що встановити

| Інструмент | Навіщо | Як |
|---|---|---|
| Blender 4.2+ | рендер сцен, редаговані `.blend` | blender.org (у вас уже є) |
| Python 3.10+ | запуск скриптів | python.org |
| Piper | український голос Тіка, офлайн | `pip install -r video/requirements.txt` |
| Голос Piper | модель | [rhasspy/piper-voices → uk/uk_UA](https://huggingface.co/rhasspy/piper-voices/tree/main/uk/uk_UA): `ukrainian_tts/medium` (три диктори, `--speaker 0/1/2`) — завантажте `.onnx` і `.onnx.json` у `video/voices/` |
| ffmpeg (бажано) | трохи вищий «мультяшний» тон голосу | winget / brew / apt; без нього голос просто лишається як є |
| LM Studio | редакторська перевірка сценаріїв | у вас уже є; увімкніть сервер (Developer → Start Server) |

## Кроки

```bash
npm run video:brief                                   # 1. сценарії → video/clips.json

python video/review.py --model bionic                 # 2. (необов’язково) зауваження → video/out/review.md

python video/voice.py --model video/voices/uk_UA-ukrainian_tts-medium.onnx --speaker 1
                                                      # 3. голос; послухайте кілька кліпів,
                                                      #    підберіть --speaker і --length-scale

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

## Higgsfield поверх (необов’язково)

Модель **Seedance 2.5** у режимі `video_edit` перемальовує готовий кліп у «справжній»
3D-мультфільм, зберігаючи рух. Ціна — близько **7–8 кредитів за секунду** (12-секундний
кліп — 89 кредитів; усі 21 кліп ≈ 1 800). Після стилізації **перевіряйте циферблат кадр
за кадром**: числа й кути стрілок мають лишитися точно такими ж. Звук і субтитри беріть
із Blender-версії.
