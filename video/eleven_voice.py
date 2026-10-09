"""Голос Тіка в грі через ElevenLabs: начитує шматки фраз власним голосом «Тік — ЧасоПарк».

Шматки ті самі, що й у Лади (public/voice/chunks.json), назви файлів теж ті самі (file_for).
Записи спершу збираються в voice-tik/c/ — поза public/, тож гра їх ще не бачить.
Щойно начитано ВСІ шматки, скрипт переносить їх у public/voice/ і перемикає manifest на Тіка:
так у грі ніколи не змішуються два голоси.

Кредити ElevenLabs закінчуються — скрипт зупиняється, зберігши зроблене; наступний запуск продовжить.

    ELEVENLABS_API_KEY=... python video/eleven_voice.py
    python video/eleven_voice.py --status      # скільки начитано і скільки символів лишилось
"""

import argparse
import json
import os
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request
from array import array
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from game_voice import SR, VOICE, encode, file_for, synth_text, trim  # noqa: E402

ROOT = VOICE.parent.parent
STAGE = ROOT / 'voice-tik'
VOICE_ID = os.environ.get('VOICE_ID', 'st1SBWBNgcxYTHgNG66W')   # «Тік — ЧасоПарк» (Voice Design)
MODEL_ID = os.environ.get('MODEL_ID', 'eleven_v4')
URL = f'https://api.elevenlabs.io/v1/text-to-speech/{VOICE_ID}?output_format=mp3_44100_128'


class OutOfCredits(Exception):
    pass


def tts(key: str, text: str) -> bytes:
    body = json.dumps({'text': text, 'model_id': MODEL_ID}).encode()
    req = urllib.request.Request(URL, data=body, method='POST', headers={
        'xi-api-key': key, 'Content-Type': 'application/json', 'Accept': 'audio/mpeg'})
    for attempt in range(4):
        try:
            return urllib.request.urlopen(req, timeout=120).read()
        except urllib.error.HTTPError as e:
            msg = e.read().decode(errors='replace')[:400]
            if e.code in (401, 402) and ('quota' in msg or 'credit' in msg or 'payment' in msg):
                raise OutOfCredits(msg)
            if e.code == 429 or e.code >= 500:
                time.sleep(2 ** attempt * 3)
                continue
            raise SystemExit(f'HTTP {e.code}: {msg}')
        except (urllib.error.URLError, TimeoutError):
            time.sleep(2 ** attempt * 3)
    raise SystemExit('ElevenLabs не відповідає')


def to_pcm(mp3: bytes) -> array:
    raw = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', '-', '-f', 's16le', '-ac', '1', '-ar', str(SR), '-'],
                         input=mp3, capture_output=True, check=True).stdout
    pcm = array('h')
    pcm.frombytes(raw)
    return pcm


def promote(wanted: dict) -> None:
    """Усе начитано — переносимо в гру й перемикаємо manifest на Тіка."""
    clips = {}
    for k in wanted:
        f = file_for(k)
        (VOICE / f).parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(STAGE / f, VOICE / f)
        clips[k] = f
    keep = set(clips.values())
    for f in (VOICE / 'c').glob('*.mp3'):
        if 'c/' + f.name not in keep:
            f.unlink()
    (VOICE / 'manifest.json').write_text(json.dumps({'voice': 'Tik', 'clips': clips}, ensure_ascii=False, sort_keys=True), 'utf-8')
    shutil.rmtree(STAGE)
    print(f'Гра перемкнена на голос Тіка: {len(clips)} шматків')


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--status', action='store_true')
    a = ap.parse_args()

    chunks = json.loads((VOICE / 'chunks.json').read_text('utf-8'))
    wanted = {c['key']: c['text'] for c in chunks}
    manifest = json.loads((VOICE / 'manifest.json').read_text('utf-8'))
    tik_live = manifest.get('voice') == 'Tik'
    # Після перемикання нові шматки начитуються одразу в гру
    home = VOICE if tik_live else STAGE
    todo = sorted(k for k in wanted if not (home / file_for(k)).exists())
    chars = sum(len(synth_text(wanted[k])) for k in todo)
    print(f'Голос гри: {"Тік" if tik_live else "Лада"} · начитати Тіком: {len(todo)} із {len(wanted)} шматків, ~{chars} символів')
    if a.status:
        return

    key = os.environ.get('ELEVENLABS_API_KEY', '')
    if todo and not key:
        raise SystemExit('Немає ELEVENLABS_API_KEY')
    done = spent = 0
    try:
        for k in todo:
            text = synth_text(wanted[k])
            encode(trim(to_pcm(tts(key, text))), home / file_for(k))
            done += 1
            spent += len(text)
            if done % 50 == 0:
                print(f'  {done}/{len(todo)} · {spent} символів', flush=True)
    except OutOfCredits as e:
        print(f'Кредити ElevenLabs скінчились: {e}')
    print(f'Начитано зараз: {done} шматків, {spent} символів; лишилось: {len(todo) - done}')

    if tik_live:
        clips = {k: file_for(k) for k in wanted if (VOICE / file_for(k)).exists()}
        manifest['clips'] = clips
        (VOICE / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, sort_keys=True), 'utf-8')
    elif done == len(todo):
        promote(wanted)


if __name__ == '__main__':
    main()
