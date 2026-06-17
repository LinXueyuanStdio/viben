"""实时唤醒词检测 Demo

用麦克风采集音频，每 ~2 秒送入 ONNX 模型做一次推理，
在终端实时打印检测结果。

用法:
    python demo_listen.py [--model PATH] [--threshold 0.5]

按 Ctrl+C 退出。
"""

import argparse
import sys
import time
from pathlib import Path

import numpy as np
import sounddevice as sd
from livekit.wakeword import WakeWordModel

SAMPLE_RATE = 16000
CHUNK_DURATION = 2.0  # seconds
CHUNK_SAMPLES = int(SAMPLE_RATE * CHUNK_DURATION)

DEFAULT_MODEL = Path(__file__).resolve().parent.parent.parent / "apps/desktop/src-tauri/resources/ni_hao_wei_ben.onnx"


def main():
    parser = argparse.ArgumentParser(description="唤醒词实时检测 Demo")
    parser.add_argument("--model", type=str, default=str(DEFAULT_MODEL), help="ONNX 模型路径")
    parser.add_argument("--threshold", type=float, default=0.5, help="触发阈值 (0-1)")
    parser.add_argument("--device", type=int, default=None, help="音频输入设备 ID (留空使用默认)")
    args = parser.parse_args()

    model_path = Path(args.model)
    if not model_path.exists():
        print(f"❌ 模型文件不存在: {model_path}")
        sys.exit(1)

    print(f"📂 模型: {model_path}")
    print(f"🎯 阈值: {args.threshold}")
    print(f"🎤 采样率: {SAMPLE_RATE} Hz, 每帧: {CHUNK_DURATION}s ({CHUNK_SAMPLES} samples)")
    print()

    # 加载模型
    model = WakeWordModel(models=[str(model_path)])
    print("✅ 模型加载成功")

    # 列出音频设备
    if args.device is None:
        default_device = sd.default.device[0]
        device_info = sd.query_devices(default_device)
        print(f"🔊 使用默认输入设备: [{default_device}] {device_info['name']}")
    else:
        device_info = sd.query_devices(args.device)
        print(f"🔊 使用设备: [{args.device}] {device_info['name']}")

    print()
    print("=" * 50)
    print("🎙️  开始监听，请说 \"你好微本\" ...")
    print("   按 Ctrl+C 退出")
    print("=" * 50)
    print()

    buffer = np.zeros(CHUNK_SAMPLES, dtype=np.float32)
    write_pos = 0
    detection_count = 0

    def audio_callback(indata, frames, time_info, status):
        nonlocal buffer, write_pos
        if status:
            print(f"  ⚠️  音频状态: {status}", file=sys.stderr)
        # indata shape: (frames, channels) - 取第一个通道
        samples = indata[:, 0].copy()
        n = len(samples)

        if write_pos + n >= CHUNK_SAMPLES:
            # 填满当前 buffer
            remaining = CHUNK_SAMPLES - write_pos
            buffer[write_pos:CHUNK_SAMPLES] = samples[:remaining]
            # 发送给模型处理
            process_chunk(buffer.copy())
            # 把多余的放到下一个 buffer
            buffer[:] = 0
            overflow = samples[remaining:]
            buffer[:len(overflow)] = overflow
            write_pos = len(overflow)
        else:
            buffer[write_pos:write_pos + n] = samples
            write_pos += n

    def process_chunk(audio_chunk):
        nonlocal detection_count
        # 转为 int16 (模型支持 int16 和 float32)
        scores = model.predict(audio_chunk)

        for keyword, score in scores.items():
            if score >= args.threshold:
                detection_count += 1
                timestamp = time.strftime("%H:%M:%S")
                print(f"  🔔 [{timestamp}] 检测到唤醒词! keyword=\"{keyword}\" score={score:.4f} (#{detection_count})")
            elif score > 0.1:
                # 打印有一定置信度但未达到阈值的结果，方便调试
                timestamp = time.strftime("%H:%M:%S")
                print(f"  📊 [{timestamp}] keyword=\"{keyword}\" score={score:.4f} (低于阈值)")

    try:
        with sd.InputStream(
            samplerate=SAMPLE_RATE,
            channels=1,
            dtype="float32",
            device=args.device,
            callback=audio_callback,
            blocksize=1024,
        ):
            while True:
                time.sleep(0.1)
    except KeyboardInterrupt:
        print(f"\n\n⏹️  已停止。共检测到 {detection_count} 次唤醒词。")


if __name__ == "__main__":
    main()
