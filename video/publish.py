"""Готує зрендерені кліпи для сайту: video/out → public/videos.

Перетискає MP4 для швидкого старту в браузері (faststart), зберігає звук, копіює
постери й субтитри та пише manifest.json. Кліпи без записаного голосу позначаються
narrate — тоді гра читає субтитри голосом пристрою.

    python video/publish.py
"""

import json
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent
OUT = ROOT / 'out'
DEST = ROOT.parent / 'public' / 'videos'


def ffmpeg() -> str:
    exe = shutil.which('ffmpeg')
    if exe:
        return exe
    import imageio_ffmpeg  # type: ignore
    return imageio_ffmpeg.get_ffmpeg_exe()


def main() -> None:
    ff = ffmpeg()
    DEST.mkdir(parents=True, exist_ok=True)
    clips = {}
    for d in sorted(p for p in OUT.iterdir() if p.is_dir()):
        src = d / f'{d.name}.mp4'
        if not src.exists():
            continue
        spans = d / 'spans.json'
        voiced = spans.exists() and json.loads(spans.read_text('utf-8')).get('voiced', False)
        audio = ['-c:a', 'aac', '-b:a', '96k', '-ac', '1'] if voiced else ['-an']
        subprocess.run([ff, '-loglevel', 'error', '-y', '-i', str(src), '-c:v', 'libx264', '-crf', '27',
                        '-preset', 'slow', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', *audio,
                        str(DEST / src.name)], check=True)
        entry = {'src': src.name}
        for ext, key in (('jpg', 'poster'), ('vtt', 'vtt')):
            f = d / f'{d.name}.{ext}'
            if f.exists():
                shutil.copy2(f, DEST / f.name)
                entry[key] = f.name
        if not voiced:
            entry['narrate'] = True
        clips[d.name] = entry
        print(f"{d.name:18} {'голос' if voiced else 'без голосу'}")
    (DEST / 'manifest.json').write_text(json.dumps({'clips': clips}, ensure_ascii=False, indent=2) + '\n', 'utf-8')
    print(f'public/videos: {len(clips)} кліпів')


if __name__ == '__main__':
    main()
