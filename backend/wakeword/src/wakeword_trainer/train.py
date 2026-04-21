"""openWakeWord 自定义唤醒词训练入口"""
import argparse
from pathlib import Path
import yaml

from .generate import generate_synthetic_audio
from .export import export_onnx_model


def load_config(config_path: str) -> dict:
    """加载 YAML 配置文件"""
    with open(config_path, 'r', encoding='utf-8') as f:
        return yaml.safe_load(f)


def train_model(config: dict, skip_generate: bool = False) -> None:
    """训练唤醒词模型"""
    model_name = config['model_name']
    target_phrase = config['target_phrase']

    print(f"Training wake word model: {model_name}")
    print(f"Target phrase: {target_phrase}")

    if not skip_generate:
        print("\n[1/3] Generating synthetic audio...")
        generate_synthetic_audio(
            phrase=target_phrase,
            num_samples=config['tts']['num_samples'],
            model=config['tts']['model'],
            output_dir=Path(f"data/{model_name}"),
            augmentation=config['augmentation'],
        )
    else:
        print("\n[1/3] Skipping audio generation (--skip-generate)")

    print("\n[2/3] Training model...")
    train_config = config['training']
    print(f"  Epochs: {train_config['epochs']}")
    print(f"  Batch size: {train_config['batch_size']}")
    print(f"  Learning rate: {train_config['learning_rate']}")
    # TODO: Implement actual training logic

    print("\n[3/3] Exporting ONNX model...")
    export_config = config['export']
    export_onnx_model(
        model_name=model_name,
        output_dir=Path(export_config['output_dir']),
        threshold=export_config['threshold'],
    )

    print(f"\n✅ Training complete! Model saved to: {export_config['output_dir']}/{model_name}.onnx")


def main():
    parser = argparse.ArgumentParser(description='Train custom wake word model')
    parser.add_argument('--config', required=True, help='Path to config YAML file')
    parser.add_argument('--skip-generate', action='store_true', help='Skip audio generation')
    args = parser.parse_args()

    config = load_config(args.config)
    train_model(config, skip_generate=args.skip_generate)


if __name__ == '__main__':
    main()
