"""Озвучка Тіка через Piper — локально, офлайн.

Для кожного кліпу з video/clips.json синтезує речення окремо й склеює їх із паузами.
Так ми точно знаємо, коли звучить кожне речення, — Blender синхронізує з цим рух
стрілок і рот Тіка, а субтитри виходять точними.

    pip install piper-tts
    python video/voice.py                         # голос ukrainian_tts з video/voices/
    python video/voice.py --speaker tetiana       # інший диктор: за іменем або номером
    python video/voice.py --silent            # без голосу: оцінка тривалості (для чернеток)

Результат: video/out/<id>/voice.wav і video/out/<id>/spans.json
"""

import argparse
import json
import re
import shutil
import subprocess
import sys
import wave
from array import array
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DEFAULT_MODEL = ROOT / 'voices' / 'uk_UA-ukrainian_tts-medium.onnx'
DEFAULT_SPEAKER = 'mykyta'   # голос Тіка; змінюється через --speaker
LEAD, GAP, TAIL = 0.6, 0.35, 0.9   # секунди тиші: перед першим реченням, між реченнями, в кінці


def load_voice(model: str):
    from piper import PiperVoice  # type: ignore
    return PiperVoice.load(model)


def resolve_speaker(model: str, speaker):
    """Диктор за іменем (з .onnx.json) або номером. Для однодикторних моделей — None."""
    cfg = Path(model + '.json')
    ids = json.loads(cfg.read_text('utf-8')).get('speaker_id_map', {}) if cfg.exists() else {}
    if not ids:
        return None
    if speaker is None:
        speaker = DEFAULT_SPEAKER if DEFAULT_SPEAKER in ids else next(iter(ids))
    if str(speaker).isdigit():
        return int(speaker)
    if speaker not in ids:
        sys.exit(f'Диктора «{speaker}» немає. Доступні: ' + ', '.join(f'{k} ({v})' for k, v in ids.items()))
    return ids[speaker]


def synth(voice, text: str, speaker, length_scale: float):
    """Повертає (sample_rate, int16 samples). Підтримує API piper-tts 1.2 і 1.3+."""
    try:  # piper-tts >= 1.3
        from piper import SynthesisConfig  # type: ignore
        cfg = SynthesisConfig(speaker_id=speaker, length_scale=length_scale)
        pcm, sr = array('h'), None
        for chunk in voice.synthesize(text, syn_config=cfg):
            sr = chunk.sample_rate
            pcm.frombytes(chunk.audio_int16_bytes)
        return sr, pcm
    except ImportError:  # piper-tts 1.2
        pcm = array('h')
        for raw in voice.synthesize_stream_raw(text, speaker_id=speaker, length_scale=length_scale):
            pcm.frombytes(raw)
        return voice.config.sample_rate, pcm


def estimate(text: str) -> float:
    """Дитячий темп: ~2,2 слова на секунду."""
    return max(1.0, len(text.split()) / 2.2)


def pitch_up(path: Path, factor: float) -> None:
    """Трохи вищий «мультяшний» голос. Потрібен ffmpeg у PATH; без нього пропускаємо."""
    ff = shutil.which('ffmpeg')
    if not ff or abs(factor - 1) < 0.01:
        return
    with wave.open(str(path)) as w:
        sr = w.getframerate()
    tmp = path.with_suffix('.tmp.wav')
    subprocess.run([ff, '-y', '-loglevel', 'error', '-i', str(path), '-af',
                    f'asetrate={sr * factor:.0f},aresample={sr},atempo={1 / factor:.5f}', str(tmp)], check=True)
    tmp.replace(path)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--model', default=str(DEFAULT_MODEL), help='шлях до .onnx голосу Piper (поруч має лежати .onnx.json)')
    ap.add_argument('--speaker', default=None, help=f'диктор: ім’я або номер (типово {DEFAULT_SPEAKER})')
    ap.add_argument('--length-scale', type=float, default=1.12, help='>1 — повільніше (для дітей)')
    ap.add_argument('--pitch', type=float, default=1.08, help='підняття тону через ffmpeg; 1 — без змін')
    ap.add_argument('--silent', action='store_true', help='без синтезу: тиша й оцінена тривалість')
    ap.add_argument('--only', nargs='*', help='лише ці id кліпів')
    ap.add_argument('--clips', default=str(ROOT / 'clips.json'))
    ap.add_argument('--out', default=str(ROOT / 'out'))
    a = ap.parse_args()

    if not a.silent and not Path(a.model).exists():
        sys.exit(f'Немає голосу {a.model}. Завантажте ukrainian_tts (див. video/README.md) або запустіть з --silent.')
    speaker = None if a.silent else resolve_speaker(a.model, a.speaker)

    clips = json.loads(Path(a.clips).read_text('utf-8'))
    voice = None if a.silent else load_voice(a.model)

    for clip in clips:
        if a.only and clip['id'] not in a.only:
            continue
        sr, pcm, spans = 22050, array('h'), []
        silence = lambda s: array('h', bytes(int(sr * s) * 2))  # noqa: E731
        t = LEAD
        pcm.extend(silence(LEAD))
        for i, text in enumerate(clip['sentences']):
            if voice:
                sr_i, part = synth(voice, text, speaker, a.length_scale)
                if i == 0 and sr_i != sr:  # перша фраза визначає частоту
                    sr, pcm = sr_i, array('h', bytes(int(sr_i * LEAD) * 2))
                dur = len(part) / sr
            else:
                dur = estimate(text)
                part = silence(dur)
            pcm.extend(part)
            spans.append({'start': round(t, 3), 'end': round(t + dur, 3), 'text': text})
            t += dur
            gap = TAIL if i == len(clip['sentences']) - 1 else GAP
            pcm.extend(silence(gap))
            t += gap

        d = Path(a.out) / clip['id']
        d.mkdir(parents=True, exist_ok=True)
        wav = d / 'voice.wav'
        with wave.open(str(wav), 'wb') as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(sr)
            w.writeframes(pcm.tobytes())
        if voice:
            pitch_up(wav, a.pitch)
        (d / 'spans.json').write_text(json.dumps(
            {'id': clip['id'], 'duration': round(t, 3), 'voiced': bool(voice), 'sentences': spans},
            ensure_ascii=False, indent=2), 'utf-8')
        print(f"{clip['id']:18} {t:5.1f} с  {'голос' if voice else 'тиша (--silent)'}")


if __name__ == '__main__':
    main()
