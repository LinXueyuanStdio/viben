"""录音 + 验证 + 微调模块

提供交互式录音采集唤醒词样本、用已有模型验证录音质量、
以及基于少量真人样本微调唤醒词模型的功能。

Usage:
    python -m wakeword_trainer.record record --config configs/ni_hao_wei_ben.yaml
    python -m wakeword_trainer.record validate --config configs/ni_hao_wei_ben.yaml --model models/ni_hao_wei_ben.onnx
    python -m wakeword_trainer.record fine-tune --config configs/ni_hao_wei_ben.yaml
    python -m wakeword_trainer.record all --config configs/ni_hao_wei_ben.yaml
"""
from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

import numpy as np
import sounddevice as sd
import soundfile as sf

from .config import WakeWordConfig, create_wakeword_config, load_yaml_config

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

DEFAULT_SAMPLE_RATE: int = 16_000
DEFAULT_DURATION: float = 3.0
DEFAULT_NUM_SAMPLES: int = 3
DEFAULT_PHRASE: str = "你好微本"
DEFAULT_OUTPUT_DIR: str = "data/recordings"
DEFAULT_THRESHOLD: float = 0.5

# Frame size expected by livekit-wakeword models (1280 samples = 80ms at 16kHz)
FRAME_SIZE: int = 1280

# Fine-tune defaults
FINE_TUNE_STEPS: int = 5000
AUGMENT_TARGET_COUNT: int = 100


# ---------------------------------------------------------------------------
# 1. Recording
# ---------------------------------------------------------------------------

def record_samples(
    num_samples: int = DEFAULT_NUM_SAMPLES,
    duration: float = DEFAULT_DURATION,
    sample_rate: int = DEFAULT_SAMPLE_RATE,
    output_dir: str = DEFAULT_OUTPUT_DIR,
    phrase: str = DEFAULT_PHRASE,
) -> list[Path]:
    """录制多条唤醒词语音样本。

    交互式流程：打印提示让用户说出唤醒词，倒计时后录音 *duration* 秒，
    保存为 16kHz mono int16 WAV 文件到 *output_dir*。

    Args:
        num_samples: 要录制的样本数量。
        duration: 每条录音时长（秒）。
        sample_rate: 采样率，默认 16000。
        output_dir: 输出目录路径。
        phrase: 唤醒词文本（用于文件命名和提示）。

    Returns:
        保存的 WAV 文件路径列表。
    """
    out_path = Path(output_dir)
    out_path.mkdir(parents=True, exist_ok=True)

    saved_files: list[Path] = []

    print(f"\n=== 录音采集 ===")
    print(f"唤醒词: {phrase}")
    print(f"样本数: {num_samples}")
    print(f"每条时长: {duration}s")
    print(f"采样率: {sample_rate}Hz")
    print(f"保存目录: {out_path}\n")

    for i in range(num_samples):
        print(f"--- 第 {i + 1}/{num_samples} 条 ---")
        input("按 Enter 开始录音...")

        audio = _do_recording(phrase, duration, sample_rate)

        # 保存
        filename = f"{phrase}_{i + 1}.wav"
        filepath = out_path / filename
        sf.write(str(filepath), audio, sample_rate, subtype="PCM_16")
        saved_files.append(filepath)
        print(f"  已保存: {filepath}")

        # 可选回放
        if _prompt_yes_no("  是否回放？(y/n) "):
            print("  播放中...")
            sd.play(audio, sample_rate)
            sd.wait()

        # 如果不满意可以重录
        if _prompt_yes_no("  是否重录这条？(y/n) "):
            print("  重新录制...")
            saved_files.pop()
            audio = _do_recording(phrase, duration, sample_rate)
            sf.write(str(filepath), audio, sample_rate, subtype="PCM_16")
            saved_files.append(filepath)
            print(f"  已覆盖: {filepath}")

        print()

    print(f"录音完成！共保存 {len(saved_files)} 条样本。\n")
    return saved_files


def _do_recording(
    phrase: str,
    duration: float,
    sample_rate: int,
) -> np.ndarray:
    """执行一次倒计时 + 录音。

    Args:
        phrase: 唤醒词文本（用于提示）。
        duration: 录音时长（秒）。
        sample_rate: 采样率。

    Returns:
        int16 单声道音频数据。
    """
    # 倒计时 3-2-1
    for countdown in range(3, 0, -1):
        print(f"  {countdown}...")
        time.sleep(1.0)

    print(f'  请说: "{phrase}"')

    audio = sd.rec(
        frames=int(duration * sample_rate),
        samplerate=sample_rate,
        channels=1,
        dtype="int16",
    )
    sd.wait()
    return audio


# ---------------------------------------------------------------------------
# 2. Validation
# ---------------------------------------------------------------------------

def validate_recordings(
    recordings: list[Path],
    model_path: Path,
    threshold: float = DEFAULT_THRESHOLD,
) -> dict:
    """用已有模型验证录音是否能被识别。

    将每条录音分帧送入 livekit-wakeword 模型进行推理，
    取最大分数判断是否检测到唤醒词。

    Args:
        recordings: WAV 文件路径列表。
        model_path: ONNX 模型路径。
        threshold: 检测阈值，默认 0.5。

    Returns:
        dict 包含:
            - results: 每个文件的检测结果列表
              [{"file": Path, "score": float, "detected": bool}, ...]
            - detection_rate: 总体识别率 (0.0 - 1.0)
    """
    from livekit.wakeword import WakeWordModel

    print(f"\n=== 验证录音 ===")
    print(f"模型: {model_path}")
    print(f"阈值: {threshold}")
    print(f"录音数: {len(recordings)}\n")

    model = WakeWordModel(models=[str(model_path)])

    results: list[dict] = []
    detected_count = 0

    for rec_path in recordings:
        audio_data, sr = sf.read(str(rec_path), dtype="int16")

        # 确保是 mono
        if audio_data.ndim > 1:
            audio_data = audio_data[:, 0]

        # 如果采样率不匹配，简单重采样
        if sr != DEFAULT_SAMPLE_RATE:
            audio_data = _resample_int16(audio_data, sr, DEFAULT_SAMPLE_RATE)

        # 分帧送入模型，取最大得分
        max_score = _score_audio(model, audio_data)
        detected = max_score >= threshold

        if detected:
            detected_count += 1

        result = {
            "file": rec_path,
            "score": round(max_score, 4),
            "detected": detected,
        }
        results.append(result)

        status = "PASS" if detected else "FAIL"
        print(f"  [{status}] {rec_path.name}  score={max_score:.4f}")

    detection_rate = detected_count / len(recordings) if recordings else 0.0

    print(f"\n识别率: {detection_rate:.0%} ({detected_count}/{len(recordings)})")

    if detection_rate < 0.5:
        print("  识别率较低，建议进行微调。")
    elif detection_rate < 1.0:
        print("  部分未识别，微调可能会改善效果。")
    else:
        print("  所有样本均已识别！")

    return {
        "results": results,
        "detection_rate": detection_rate,
    }


def _score_audio(model: object, audio_int16: np.ndarray) -> float:
    """将音频分帧送入模型推理，返回最大得分。

    处理比单帧更长的音频：按 FRAME_SIZE 分帧逐帧送入
    model.predict()，取所有帧的最大检测分数。

    Args:
        model: WakeWordModel 实例。
        audio_int16: int16 单声道音频数据。

    Returns:
        所有帧中的最大检测分数。
    """
    max_score = 0.0
    num_frames = len(audio_int16) // FRAME_SIZE

    for frame_idx in range(num_frames):
        start = frame_idx * FRAME_SIZE
        end = start + FRAME_SIZE
        frame = audio_int16[start:end]

        # livekit-wakeword predict 返回各模型的检测分数
        scores = model.predict(frame)  # type: ignore[attr-defined]
        if scores:
            frame_max = max(scores.values()) if isinstance(scores, dict) else float(scores)
            max_score = max(max_score, frame_max)

    return max_score


# ---------------------------------------------------------------------------
# 3. Fine-tuning
# ---------------------------------------------------------------------------

def fine_tune(
    recordings: list[Path],
    config_path: str,
    base_model_path: Path | None = None,
) -> Path:
    """用录音数据微调唤醒词模型。

    流程：
    1. 对录音做数据增强（加噪、变速、混响等）扩增到约 100 条
    2. 合并到原训练数据集
    3. 用较少 steps (5000) 继续训练
    4. 导出新 ONNX 模型

    Args:
        recordings: 录音 WAV 文件路径列表。
        config_path: 训练配置 YAML 文件路径。
        base_model_path: 基础模型路径（可选，用于继续训练）。

    Returns:
        微调后模型的 ONNX 文件路径。
    """
    raw = load_yaml_config(config_path)
    config = create_wakeword_config(raw)

    print(f"\n=== 微调模型 ===")
    print(f"模型: {config.model_name}")
    print(f"录音数: {len(recordings)}")
    if base_model_path:
        print(f"基础模型: {base_model_path}")

    # Step 1: 数据增强
    print("\n[1/3] 数据增强...")
    augmented_dir = Path(f"data/{config.model_name}/augmented")
    augmented_files = _augment_recordings(
        recordings=recordings,
        output_dir=augmented_dir,
        target_count=AUGMENT_TARGET_COUNT,
    )
    print(f"  生成 {len(augmented_files)} 条增强样本 -> {augmented_dir}")

    # Step 2: 训练
    print("\n[2/3] 微调训练...")
    _run_fine_tune_training(
        config=config,
        augmented_dir=augmented_dir,
        base_model_path=base_model_path,
        steps=FINE_TUNE_STEPS,
    )

    # Step 3: 导出 ONNX
    print("\n[3/3] 导出 ONNX 模型...")
    export_cfg = config.export
    output_dir = Path(export_cfg.get("output_dir", "models"))
    output_dir.mkdir(parents=True, exist_ok=True)
    threshold = export_cfg.get("threshold", DEFAULT_THRESHOLD)

    onnx_path = output_dir / f"{config.model_name}_finetuned.onnx"

    from .export import export_onnx_model

    export_onnx_model(
        model_name=f"{config.model_name}_finetuned",
        output_dir=output_dir,
        threshold=threshold,
    )

    print(f"\n微调完成！模型保存到: {onnx_path}")
    return onnx_path


def _augment_recordings(
    recordings: list[Path],
    output_dir: Path,
    target_count: int = AUGMENT_TARGET_COUNT,
) -> list[Path]:
    """对录音进行数据增强。

    增强策略包括：加噪、变速、混响、音量变化、时移等。
    从 *recordings* 扩增到约 *target_count* 条样本。

    Args:
        recordings: 原始录音路径列表。
        output_dir: 增强数据输出目录。
        target_count: 目标样本总数。

    Returns:
        所有增强后文件的路径列表（含原始副本）。
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    augmented_files: list[Path] = []

    if not recordings:
        return augmented_files

    # 每条原始录音需要生成多少增强副本
    augments_per_sample = max(1, target_count // len(recordings))

    for rec_idx, rec_path in enumerate(recordings):
        audio_data, sr = sf.read(str(rec_path), dtype="float64")
        if audio_data.ndim > 1:
            audio_data = audio_data[:, 0]

        # 保留原始副本
        original_out = output_dir / f"original_{rec_idx}.wav"
        sf.write(str(original_out), audio_data, sr)
        augmented_files.append(original_out)

        # 生成增强变体
        for aug_idx in range(augments_per_sample - 1):
            augmented = _apply_augmentation(audio_data, sr, aug_idx)
            aug_path = output_dir / f"aug_{rec_idx}_{aug_idx}.wav"
            sf.write(str(aug_path), augmented, sr)
            augmented_files.append(aug_path)

    print(f"  原始: {len(recordings)} 条")
    print(f"  增强后: {len(augmented_files)} 条")
    return augmented_files


def _apply_augmentation(
    audio: np.ndarray,
    sample_rate: int,
    variant_idx: int,
) -> np.ndarray:
    """对单条音频施加数据增强。

    根据 *variant_idx* 选择不同增强策略的组合以确保多样性。

    Args:
        audio: float64 单声道音频数据。
        sample_rate: 采样率。
        variant_idx: 变体索引，决定增强策略。

    Returns:
        增强后的 float64 音频数据（已裁剪到 [-1, 1]）。
    """
    rng = np.random.default_rng(seed=variant_idx * 7 + 42)
    result = audio.copy()

    # 策略 1: 加性高斯噪声
    if variant_idx % 3 == 0 or variant_idx % 5 == 0:
        noise_level = rng.uniform(0.002, 0.015)
        noise = rng.standard_normal(len(result)) * noise_level
        result = result + noise

    # 策略 2: 变速（通过索引重采样模拟）
    if variant_idx % 4 == 0 or variant_idx % 7 == 0:
        speed_factor = rng.uniform(0.9, 1.1)
        indices = np.arange(0, len(result), speed_factor)
        indices = indices[indices < len(result)].astype(int)
        result = result[indices]

    # 策略 3: 音量变化
    if variant_idx % 2 == 0:
        volume_factor = rng.uniform(0.6, 1.4)
        result = result * volume_factor

    # 策略 4: 随机时移（前方加静音）
    if variant_idx % 6 == 0:
        shift_samples = int(rng.uniform(0, 0.3) * sample_rate)
        padding = np.zeros(shift_samples)
        result = np.concatenate([padding, result])

    # 策略 5: 简易混响（延迟叠加）
    if variant_idx % 8 == 0:
        delay_ms = rng.uniform(20, 80)
        delay_samples = int(delay_ms * sample_rate / 1000)
        decay = rng.uniform(0.2, 0.5)
        if delay_samples < len(result):
            reverb = np.zeros_like(result)
            reverb[delay_samples:] = result[:-delay_samples] * decay
            result = result + reverb

    # 裁剪到有效范围
    result = np.clip(result, -1.0, 1.0)
    return result


def _run_fine_tune_training(
    config: WakeWordConfig,
    augmented_dir: Path,
    base_model_path: Path | None,
    steps: int,
) -> None:
    """执行微调训练。

    Args:
        config: 唤醒词配置。
        augmented_dir: 增强数据目录。
        base_model_path: 基础模型路径（可选）。
        steps: 训练步数。
    """
    model_cfg = config.model
    model_type = model_cfg.get("model_type", "conv_attention")
    model_size = model_cfg.get("model_size", "small")

    print(f"  模型类型: {model_type}")
    print(f"  模型大小: {model_size}")
    print(f"  训练步数: {steps}")
    print(f"  增强数据: {augmented_dir}")

    if base_model_path and base_model_path.exists():
        print(f"  基础模型: {base_model_path} (继续训练)")
    else:
        print("  从头训练（无基础模型）")

    # TODO: 接入 livekit-wakeword 的训练 API
    # from livekit.wakeword import run_train
    # run_train(
    #     model_name=config.model_name,
    #     steps=steps,
    #     model_type=model_type,
    #     model_size=model_size,
    #     target_fp_per_hour=config.target_fp_per_hour,
    #     extra_data_dir=str(augmented_dir),
    # )
    print(f"  [TODO] 微调训练逻辑待接入 livekit-wakeword 训练 API")


# ---------------------------------------------------------------------------
# 4. CLI Entry Point
# ---------------------------------------------------------------------------

def main() -> None:
    """CLI 入口: python -m wakeword_trainer.record

    子命令:
        record     - 录制唤醒词样本
        validate   - 验证已录制样本
        fine-tune  - 微调模型
        all        - 录制 -> 验证 -> 微调 全流程
    """
    parser = argparse.ArgumentParser(
        description="唤醒词录音、验证与微调工具",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  # 录制 3 条样本
  python -m wakeword_trainer.record record --config configs/ni_hao_wei_ben.yaml

  # 验证录音
  python -m wakeword_trainer.record validate --config configs/ni_hao_wei_ben.yaml --model models/ni_hao_wei_ben.onnx

  # 微调
  python -m wakeword_trainer.record fine-tune --config configs/ni_hao_wei_ben.yaml

  # 全流程
  python -m wakeword_trainer.record all --config configs/ni_hao_wei_ben.yaml --model models/ni_hao_wei_ben.onnx
""",
    )

    subparsers = parser.add_subparsers(dest="command", help="子命令")

    # --- record ---
    p_record = subparsers.add_parser("record", help="录制唤醒词语音样本")
    p_record.add_argument("--config", required=True, help="配置文件路径 (YAML)")
    p_record.add_argument(
        "--num-samples", type=int, default=DEFAULT_NUM_SAMPLES,
        help="录制样本数量",
    )
    p_record.add_argument(
        "--duration", type=float, default=DEFAULT_DURATION,
        help="每条录音时长 (秒)",
    )
    p_record.add_argument("--output-dir", default=None, help="输出目录")

    # --- validate ---
    p_validate = subparsers.add_parser("validate", help="验证已录制的样本")
    p_validate.add_argument("--config", required=True, help="配置文件路径 (YAML)")
    p_validate.add_argument("--model", required=True, help="ONNX 模型路径")
    p_validate.add_argument(
        "--threshold", type=float, default=DEFAULT_THRESHOLD,
        help="检测阈值",
    )
    p_validate.add_argument("--output-dir", default=None, help="录音目录")

    # --- fine-tune ---
    p_finetune = subparsers.add_parser("fine-tune", help="用录音微调模型")
    p_finetune.add_argument("--config", required=True, help="配置文件路径 (YAML)")
    p_finetune.add_argument("--model", default=None, help="基础模型路径 (可选)")
    p_finetune.add_argument("--output-dir", default=None, help="录音目录")

    # --- all ---
    p_all = subparsers.add_parser("all", help="录制 -> 验证 -> 微调 全流程")
    p_all.add_argument("--config", required=True, help="配置文件路径 (YAML)")
    p_all.add_argument("--model", default=None, help="ONNX 模型路径 (用于验证)")
    p_all.add_argument(
        "--num-samples", type=int, default=DEFAULT_NUM_SAMPLES,
        help="录制样本数量",
    )
    p_all.add_argument(
        "--duration", type=float, default=DEFAULT_DURATION,
        help="每条录音时长 (秒)",
    )
    p_all.add_argument("--output-dir", default=None, help="输出目录")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(1)

    raw = load_yaml_config(args.config)
    config = create_wakeword_config(raw)
    target_phrases = config.target_phrases
    phrase = target_phrases[0] if target_phrases else DEFAULT_PHRASE

    output_dir = args.output_dir or f"data/{config.model_name}/recordings"

    if args.command == "record":
        record_samples(
            num_samples=args.num_samples,
            duration=args.duration,
            output_dir=output_dir,
            phrase=phrase,
        )

    elif args.command == "validate":
        recordings = _find_recordings(Path(output_dir))
        if not recordings:
            print(f"错误: 在 {output_dir} 中未找到 WAV 文件。请先录制样本。")
            sys.exit(1)
        validate_recordings(
            recordings=recordings,
            model_path=Path(args.model),
            threshold=args.threshold,
        )

    elif args.command == "fine-tune":
        recordings = _find_recordings(Path(output_dir))
        if not recordings:
            print(f"错误: 在 {output_dir} 中未找到 WAV 文件。请先录制样本。")
            sys.exit(1)
        base_model = Path(args.model) if args.model else None
        fine_tune(
            recordings=recordings,
            config_path=args.config,
            base_model_path=base_model,
        )

    elif args.command == "all":
        _run_all_workflow(args, config, phrase, output_dir)


def _run_all_workflow(
    args: argparse.Namespace,
    config: WakeWordConfig,
    phrase: str,
    output_dir: str,
) -> None:
    """执行录制 -> 验证 -> 微调全流程。

    Args:
        args: CLI 解析后的参数。
        config: 唤醒词配置。
        phrase: 唤醒词文本。
        output_dir: 录音输出目录。
    """
    # Step 1: 录制
    print("=" * 50)
    print("步骤 1/3: 录制样本")
    print("=" * 50)
    recordings = record_samples(
        num_samples=args.num_samples,
        duration=args.duration,
        output_dir=output_dir,
        phrase=phrase,
    )

    # Step 2: 验证（如果提供了模型）
    if args.model:
        print("=" * 50)
        print("步骤 2/3: 验证录音")
        print("=" * 50)
        result = validate_recordings(
            recordings=recordings,
            model_path=Path(args.model),
        )
        print(f"\n当前识别率: {result['detection_rate']:.0%}")
    else:
        print("\n跳过验证（未指定 --model）")

    # Step 3: 微调
    print("=" * 50)
    print("步骤 3/3: 微调模型")
    print("=" * 50)
    base_model = Path(args.model) if args.model else None
    onnx_path = fine_tune(
        recordings=recordings,
        config_path=args.config,
        base_model_path=base_model,
    )
    print(f"\n全流程完成！微调模型: {onnx_path}")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _find_recordings(directory: Path) -> list[Path]:
    """在目录中查找所有 WAV 录音文件。

    Args:
        directory: 目录路径。

    Returns:
        按文件名排序的 WAV 文件路径列表。
    """
    if not directory.exists():
        return []
    return sorted(directory.glob("*.wav"))


def _prompt_yes_no(prompt: str) -> bool:
    """提示用户输入 y/n。

    Args:
        prompt: 提示文本。

    Returns:
        用户选择 y 返回 True，否则返回 False。
    """
    try:
        answer = input(prompt).strip().lower()
        return answer in ("y", "yes")
    except (EOFError, KeyboardInterrupt):
        return False


def _resample_int16(
    audio: np.ndarray,
    orig_sr: int,
    target_sr: int,
) -> np.ndarray:
    """简易重采样（线性插值）。

    用于将非 16kHz 音频转换为模型所需的 16kHz。

    Args:
        audio: int16 单声道音频数据。
        orig_sr: 原始采样率。
        target_sr: 目标采样率。

    Returns:
        重采样后的 int16 音频数据。
    """
    if orig_sr == target_sr:
        return audio

    duration = len(audio) / orig_sr
    target_length = int(duration * target_sr)
    indices = np.linspace(0, len(audio) - 1, target_length)
    resampled = np.interp(indices, np.arange(len(audio)), audio.astype(np.float64))
    return resampled.astype(np.int16)


if __name__ == "__main__":
    main()
