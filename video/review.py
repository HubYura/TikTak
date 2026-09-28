"""Редакторська перевірка сценаріїв через локальну модель у LM Studio.

LM Studio → вкладка Developer → Start Server (типово http://localhost:1234).
Завантажте будь-яку інструктивну модель, що добре знає українську.

    python video/review.py                      # перша завантажена модель
    python video/review.py --model bionic --only stage-6 trap-ampm

Нічого не змінює автоматично: пише video/out/review.md із зауваженнями,
а виправлення вносяться вручну в src/core/videos.ts (звідти беруться і гра, і субтитри).
"""

import argparse
import json
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent

SYSTEM = (
    'Ти — редактор дитячого освітнього відео українською для дітей 6–8 років. '
    'Тема — як читати аналоговий годинник. Перевір репліку персонажа Тіка: '
    '1) граматика, відмінки й наголоси, природність української (без русизмів і кальок); '
    '2) чи зрозуміло 6-річній дитині, чи коротко (одна думка на речення); '
    '3) чи немає фактичних помилок про годинник (пів = 30 хв, «чверть на» / «за чверть», '
    'годинна стрілка рухається плавно; 3:30 — «пів на четверту»); '
    '4) чи кожне речення можна показати на циферблаті. '
    'Відповідай стисло: «OK», якщо все добре, або список зауважень і запропонований текст. '
    'Кількість речень не змінюй — під кожне речення вже зроблена анімація.'
)


def call(base: str, model: str, prompt: str) -> str:
    body = json.dumps({
        'model': model,
        'temperature': 0.2,
        'messages': [{'role': 'system', 'content': SYSTEM}, {'role': 'user', 'content': prompt}]
    }).encode()
    req = urllib.request.Request(base + '/chat/completions', body, {'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=300) as r:
        return json.load(r)['choices'][0]['message']['content'].strip()


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--base', default='http://localhost:1234/v1')
    ap.add_argument('--model', help='id моделі в LM Studio (типово — перша завантажена)')
    ap.add_argument('--only', nargs='*')
    ap.add_argument('--clips', default=str(ROOT / 'clips.json'))
    a = ap.parse_args()

    try:
        with urllib.request.urlopen(a.base + '/models', timeout=10) as r:
            models = [m['id'] for m in json.load(r)['data']]
    except (urllib.error.URLError, OSError) as e:
        sys.exit(f'LM Studio не відповідає на {a.base}: {e}. Увімкніть сервер у вкладці Developer.')
    model = a.model or (models[0] if models else None)
    if a.model and not any(a.model.lower() in m.lower() for m in models):
        sys.exit(f'Моделі «{a.model}» немає серед завантажених: {", ".join(models)}')
    if a.model:
        model = next(m for m in models if a.model.lower() in m.lower())
    if not model:
        sys.exit('У LM Studio не завантажено жодної моделі.')

    clips = json.loads(Path(a.clips).read_text('utf-8'))
    out = [f'# Редакторські зауваження ({model})', '']
    for c in clips:
        if a.only and c['id'] not in a.only:
            continue
        numbered = '\n'.join(f'{i + 1}. {s}' for i, s in enumerate(c['sentences']))
        print(f"→ {c['id']}", flush=True)
        verdict = call(a.base, model, f"Кліп «{c['title']}».\nРечення:\n{numbered}")
        out += [f"## `{c['id']}` — {c['title']}", '', numbered, '', verdict, '']
    dest = ROOT / 'out' / 'review.md'
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text('\n'.join(out), 'utf-8')
    print(f'Готово: {dest}')


if __name__ == '__main__':
    main()
