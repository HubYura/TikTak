"""Порівняння українських голосів: той самий текст — різні рушії.

Результат — короткі mp3 у docs/voice-samples/, щоб обрати голос Тіка на слух.

    python video/voice_samples.py --engine piper      # поточний Piper ukrainian_tts (з підняттям тону і без)
    python video/voice_samples.py --engine espnet     # оригінальна ukrainian-tts (ESPnet) з наголосами зі словника
    python video/voice_samples.py --engine mms        # facebook/mms-tts-ukr
    python video/voice_samples.py --engine styletts2  # StyleTTS2 Ukrainian (HF Space patriotyk)
"""

import argparse
import shutil
import subprocess
import sys
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parent
TEXT = ('Привіт! Я Тік — живий годинник. Коротка стрілка показує години, а довга — хвилини. '
        'Зараз чверть на четверту. Спробуй сам: постав стрілки на пів на восьму. Готовий? Поїхали!')


def to_mp3(wav: Path, out: Path, pitch: float = 1.0) -> None:
    af = []
    if abs(pitch - 1) > 0.01:
        with wave.open(str(wav)) as w:
            sr = w.getframerate()
        af = ['-af', f'asetrate={sr * pitch:.0f},aresample={sr},atempo={1 / pitch:.5f}']
    out.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(wav), *af,
                    '-ac', '1', '-b:a', '64k', str(out)], check=True)
    print('✓', out.name)


def write_wav(path: Path, sr: int, samples) -> None:
    import numpy as np
    a = np.asarray(samples, dtype='float32').reshape(-1)
    a = (np.clip(a / max(1e-6, float(np.abs(a).max())) * 0.9, -1, 1) * 32767).astype('<i2')
    with wave.open(str(path), 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(a.tobytes())


def piper(out: Path, tmp: Path) -> None:
    sys.path.insert(0, str(ROOT))
    from voice import load_voice, resolve_speaker, synth  # type: ignore
    from array import array
    model = str(ROOT / 'voices' / 'uk_UA-ukrainian_tts-medium.onnx')
    v = load_voice(model)
    for name in ('mykyta', 'tetiana', 'lada'):
        try:
            spk = resolve_speaker(model, name)
        except SystemExit:
            continue
        sr, pcm = synth(v, TEXT, spk, 1.12)
        wav = tmp / f'piper-{name}.wav'
        with wave.open(str(wav), 'wb') as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(sr)
            w.writeframes(array('h', pcm).tobytes())
        to_mp3(wav, out / f'piper-{name}.mp3')
        if name == 'mykyta':  # так звучить зараз у відео
            to_mp3(wav, out / 'piper-mykyta-як-зараз.mp3', pitch=1.08)


def espnet(out: Path, tmp: Path) -> None:
    from ukrainian_tts.tts import TTS, Voices, Stress  # type: ignore
    tts = TTS(device='cpu')
    for voice in Voices:
        wav = tmp / f'espnet-{voice.value}.wav'
        with open(wav, 'wb') as f:
            _, accented = tts.tts(TEXT, voice.value, Stress.Dictionary.value, f)
        print('   наголоси:', accented)
        to_mp3(wav, out / f'ukrainian-tts-{voice.value.lower()}.mp3')


def mms(out: Path, tmp: Path) -> None:
    import torch
    from transformers import AutoTokenizer, VitsModel  # type: ignore
    tok = AutoTokenizer.from_pretrained('facebook/mms-tts-ukr')
    model = VitsModel.from_pretrained('facebook/mms-tts-ukr')
    torch.manual_seed(1)
    with torch.no_grad():
        y = model(**tok(TEXT, return_tensors='pt')).waveform[0].numpy()
    wav = tmp / 'mms.wav'
    write_wav(wav, model.config.sampling_rate, y)
    to_mp3(wav, out / 'mms-ukr.mp3')


def styletts2(out: Path, tmp: Path) -> None:
    """HF Space patriotyk/styletts2-ukrainian: знаходимо ендпоінт із текстовим полем і кличемо його."""
    from gradio_client import Client  # type: ignore
    c = Client('patriotyk/styletts2-ukrainian')
    api = c.view_api(return_format='dict', print_info=True)
    done = 0
    for name, ep in api.get('named_endpoints', {}).items():
        params = ep.get('parameters', [])
        if not params or not any(p.get('python_type', {}).get('type') == 'str' for p in params):
            continue
        args, placed = [], False
        for p in params:
            if not placed and p.get('python_type', {}).get('type') == 'str' and 'text' in (p.get('label', '') + p.get('parameter_name', '')).lower():
                args.append(TEXT)
                placed = True
            elif p.get('parameter_has_default'):
                args.append(p.get('parameter_default'))
            else:
                args.append(p.get('example_input'))
        if not placed:
            continue
        try:
            res = c.predict(*args, api_name=name)
        except Exception as e:  # noqa: BLE001
            print('  ', name, 'помилка:', e)
            continue
        path = res[0] if isinstance(res, (list, tuple)) else res
        if isinstance(path, dict):
            path = path.get('path') or path.get('value')
        if not path or not Path(str(path)).exists():
            print('  ', name, 'повернув', res)
            continue
        wav = tmp / f'styletts2{name.replace("/", "-")}.wav'
        shutil.copy(str(path), wav)
        to_mp3(wav, out / f'styletts2{name.replace("/", "-")}.mp3')
        done += 1
    if not done:
        sys.exit('StyleTTS2: не вдалося отримати жодного зразка')


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('--engine', required=True, choices=['piper', 'espnet', 'mms', 'styletts2'])
    ap.add_argument('--out', default=str(ROOT.parent / 'docs' / 'voice-samples'))
    a = ap.parse_args()
    tmp = ROOT / 'out' / 'samples'
    tmp.mkdir(parents=True, exist_ok=True)
    globals()[a.engine](Path(a.out), tmp)


if __name__ == '__main__':
    main()
