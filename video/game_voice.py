"""Голос Тіка в грі: начитує шматки фраз голосом Лади (ukrainian-tts).

Шматки збирає scripts/harvest-speech.mjs → public/voice/chunks.json.
Кожен шматок стає коротким mp3 у public/voice/c/, а manifest.json каже грі, який файл якому шматку.
Уже начитані шматки не синтезуються вдруге.

    python video/game_voice.py                    # усе, чого ще нема
    python video/game_voice.py --shard 0/4        # кожен четвертий шматок (для паралельних задач)
    python video/game_voice.py --manifest-only    # лише перебудувати manifest.json і прибрати зайве
"""

import argparse
import hashlib
import json
import subprocess
import sys
from array import array
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
VOICE = ROOT / 'public' / 'voice'
CLIPS = VOICE / 'c'
SR = 22050


def file_for(key: str) -> str:
    return 'c/' + hashlib.sha1(key.encode('utf-8')).hexdigest()[:12] + '.mp3'


def trim(pcm: array, pad: float = 0.03, thr: int = 350) -> array:
    """Прибирає тишу на краях — шматки склеюються без провалів."""
    loud = [i for i in range(0, len(pcm), 64) if abs(pcm[i]) > thr]
    if not loud:
        return pcm
    a = max(0, loud[0] - int(SR * pad))
    b = min(len(pcm), loud[-1] + int(SR * pad))
    return pcm[a:b]


def encode(pcm: array, out: Path) -> None:
    out.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 's16le', '-ar', str(SR), '-ac', '1', '-i', '-',
                    '-codec:a', 'libmp3lame', '-b:a', '40k', str(out)], input=pcm.tobytes(), check=True)


def synth_text(text: str) -> str:
    """Шматок без розділових знаків на початку; апостроф — звичайний."""
    return text.lstrip(' ,.;:—-').replace('’', "'").strip() or text


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--shard', default='0/1', help='i/n — начитати лише кожен n-й шматок, починаючи з i')
    ap.add_argument('--speaker', default=None, help='голос ukrainian-tts (типово Lada)')
    ap.add_argument('--manifest-only', action='store_true')
    a = ap.parse_args()

    chunks = json.loads((VOICE / 'chunks.json').read_text('utf-8'))
    wanted = {c['key']: c['text'] for c in chunks}

    manifest = VOICE / 'manifest.json'
    if manifest.exists() and json.loads(manifest.read_text('utf-8')).get('voice') == 'Tik':
        print('Гра вже говорить голосом Тіка (ElevenLabs) — Лада не потрібна; див. video/eleven_voice.py')
        return

    if a.manifest_only:
        clips = {k: file_for(k) for k in wanted if (VOICE / file_for(k)).exists()}
        keep = set(clips.values())
        for f in CLIPS.glob('*.mp3'):
            if 'c/' + f.name not in keep:
                f.unlink()
        (VOICE / 'manifest.json').write_text(json.dumps({'voice': 'Lada', 'clips': clips}, ensure_ascii=False, sort_keys=True), 'utf-8')
        missing = len(wanted) - len(clips)
        print(f'manifest: {len(clips)} шматків' + (f', без запису: {missing}' if missing else ''))
        return

    i, n = map(int, a.shard.split('/'))
    todo = [k for idx, k in enumerate(sorted(wanted)) if idx % n == i and not (VOICE / file_for(k)).exists()]
    print(f'Начитати: {len(todo)}')
    if not todo:
        return

    sys.path.insert(0, str(ROOT / 'video'))
    from voice import Espnet  # type: ignore
    tts = Espnet(a.speaker)
    for j, key in enumerate(todo, 1):
        _, pcm = tts.synth(synth_text(wanted[key]), 1.0, SR)
        encode(trim(pcm), VOICE / file_for(key))
        if j % 50 == 0:
            print(f'  {j}/{len(todo)}', flush=True)


if __name__ == '__main__':
    main()
