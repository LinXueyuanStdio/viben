"""使用 TTS 生成合成语音用于训练"""
from pathlib import Path
from typing import Optional


def generate_synthetic_audio(
    phrase: str,
    num_samples: int,
    model: str,
    output_dir: Path,
    augmentation: Optional[dict] = None,
) -> None:
    """使用 TTS 生成合成语音"""
    output_dir.mkdir(parents=True, exist_ok=True)

    print(f"  Phrase: {phrase}")
    print(f"  Model: {model}")
    print(f"  Samples: {num_samples}")
    print(f"  Output: {output_dir}")

    if augmentation:
        print(f"  Augmentation: {augmentation}")

    print("  [Mock] Audio generation not implemented yet")
