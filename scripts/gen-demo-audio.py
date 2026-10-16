"""生成演示音频 public/demo/audio-demo.wav。

用途：为「音频文本联动」提供一个可控的验证素材。
内容：36 秒近静音底噪 + 每个转写片段起点一声 880Hz 提示音。
这样播放时只要听到提示音，对应的转写片段就应当被高亮并滚动到可视区。

用法：
    python scripts/gen-demo-audio.py
"""

from __future__ import annotations

import math
import struct
import wave
from pathlib import Path

SAMPLE_RATE = 16_000
DURATION_SECONDS = 36.0
AMPLITUDE = 0.26
BEEP_SECONDS = 0.16

# 与 src/data/demoProject.ts 中 DEMO_TRANSCRIPT.segments 的 startMs 保持一致。
SEGMENT_STARTS_MS = [0, 2600, 5600, 8800, 11800, 15200, 18200, 21400, 24200, 27000, 29800, 32600]

OUTPUT = Path(__file__).resolve().parent.parent / "public" / "demo" / "audio-demo.wav"


def build_samples() -> list[int]:
    total = int(SAMPLE_RATE * DURATION_SECONDS)
    samples = [0] * total

    beep_len = int(SAMPLE_RATE * BEEP_SECONDS)
    beep = []
    for i in range(beep_len):
        t = i / SAMPLE_RATE
        # 5ms 淡入，其余按指数衰减，避免爆音
        attack = min(1.0, t / 0.005)
        decay = math.exp(-t * 18.0)
        value = AMPLITUDE * attack * decay * math.sin(2 * math.pi * 880.0 * t)
        beep.append(value)

    for start_ms in SEGMENT_STARTS_MS:
        offset = int(SAMPLE_RATE * start_ms / 1000)
        for i, value in enumerate(beep):
            index = offset + i
            if index >= total:
                break
            samples[index] += value

    # 极低幅度的底噪，避免整轨绝对静音导致部分播放器行为异常
    for i in range(total):
        samples[i] += 0.002 * math.sin(2 * math.pi * 60.0 * i / SAMPLE_RATE)

    return [max(-32768, min(32767, int(value * 32767))) for value in samples]


def main() -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    samples = build_samples()

    with wave.open(str(OUTPUT), "wb") as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(SAMPLE_RATE)
        handle.writeframes(struct.pack(f"<{len(samples)}h", *samples))

    size_kb = OUTPUT.stat().st_size / 1024
    print(f"written {OUTPUT} ({size_kb:.0f} KB, {DURATION_SECONDS:.0f}s)")


if __name__ == "__main__":
    main()
