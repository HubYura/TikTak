#!/usr/bin/env bash
# Проба озвучки на своїй відеокарті NVIDIA: ті самі дві фрази гри голосом
# Fish Speech S2 Pro і Breeze TTS 2. Голос клонується з 12-секундного зразка Лади.
#
#   bash scripts/voice-trial.sh            # з кореня репозиторію TikTak
#
# Потрібно: Linux або WSL2, драйвер NVIDIA, git, python3.10+ (з venv), ffmpeg,
# ~30 ГБ вільного диска. Відеопам'ять: Breeze ~8 ГБ, Fish S2 Pro — радять 24 ГБ
# (якщо мало — додай --half у FISH_FLAGS). Результат: ~/voice-trial/out/*.wav
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
W=${W:-$HOME/voice-trial}
FISH_FLAGS=${FISH_FLAGS:-}
mkdir -p "$W/out"
cd "$W"

T1='Тепер ти! Постав довгу стрілку на шість. Це пів кола, тридцять хвилин.'
T2='О третій сорок п’ять до четвертої лишилась чверть. Тому кажуть: за чверть четверта.'
REF_TEXT='Довга стрілка проходить ціле коло за годину. Секундна стрілка проходить коло за одну хвилину. Стрілки ходять по ньому завжди в один бік. Дивись на коротку стрілку, поки довга йде по колу.'

nvidia-smi --query-gpu=name,memory.total --format=csv

echo '== Зразок голосу (Лада)'
for f in 704cf0da1b95 aaa3489a9f50 f5ef5e24109e d9faca1987ed; do
  echo "file '$ROOT/public/voice/c/$f.mp3'"
done > ref.txt
ffmpeg -loglevel error -y -f concat -safe 0 -i ref.txt -ac 1 -ar 44100 ref.wav

echo '== Fish Speech S2 Pro'
[ -d fs ] || git clone --depth 1 https://github.com/fishaudio/fish-speech fs
[ -d venv-fish ] || python3 -m venv venv-fish
venv-fish/bin/pip install -q -e fs "huggingface_hub[cli]"
venv-fish/bin/hf download fishaudio/s2-pro --local-dir fs/checkpoints/s2-pro
i=0
for t in "$T1" "$T2"; do
  i=$((i+1)); s=$(date +%s)
  (cd fs && ../venv-fish/bin/python fish_speech/models/text2semantic/inference.py --device cuda $FISH_FLAGS \
    --checkpoint-path checkpoints/s2-pro --prompt-audio ../ref.wav --prompt-text "$REF_TEXT" \
    --text "$t" --output "../out/fish_$i.wav")
  echo "fish_$i: $(( $(date +%s) - s )) с"
done

echo '== Breeze TTS 2'
[ -d bz ] || git clone --depth 1 https://github.com/breezeblue-ai/breeze-tts bz
[ -d venv-breeze ] || python3 -m venv venv-breeze
venv-breeze/bin/pip install -q -r bz/requirements.txt "huggingface_hub[cli]"
venv-breeze/bin/hf download BreezeBlue/Breeze-TTS-2 --local-dir breeze-tts-2
i=0
for t in "$T1" "$T2"; do
  i=$((i+1)); s=$(date +%s)
  (cd bz && ../venv-breeze/bin/python infer.py ../breeze-tts-2 \
    --ref-audio ../ref.wav --ref-text "$REF_TEXT" --text "$t" --output "../out/breeze_$i.wav")
  echo "breeze_$i: $(( $(date +%s) - s )) с"
done

echo "== Готово: $W/out"
ls -la "$W/out"
