"""主 CLI 入口和训练管线 - 使用 livekit-wakeword"""
import argparse
import logging
from pathlib import Path
from typing import Any

import yaml
from livekit.wakeword import WakeWordConfig, run_train

from .export import evaluate_model, export_model
from .generate import augment_data, generate_data

logger = logging.getLogger(__name__)


def load_yaml_config(path: str) -> dict[str, Any]:
    """加载 YAML 配置文件。

    Args:
        path: YAML 配置文件路径。

    Returns:
        解析后的配置字典。

    Raises:
        FileNotFoundError: 配置文件不存在。
        yaml.YAMLError: YAML 解析失败。
    """
    config_path = Path(path)
    if not config_path.exists():
        raise FileNotFoundError(f"Config file not found: {path}")

    with open(config_path, "r", encoding="utf-8") as f:
        config = yaml.safe_load(f)

    logger.info("Loaded config from: %s", path)
    return config


def create_wakeword_config(yaml_config: dict[str, Any]) -> WakeWordConfig:
    """将 YAML 配置字典转换为 livekit-wakeword 的 WakeWordConfig。

    支持的 YAML 字段映射:
    - model_name -> model_name
    - target_phrases -> target_phrases
    - n_samples -> n_samples
    - n_samples_val -> n_samples_val
    - steps -> steps
    - tts_backend -> tts_backend
    - target_fp_per_hour -> target_fp_per_hour
    - model.model_type -> model_type
    - model.model_size -> model_size
    - voxcpm_tts.voice_design_prompts -> voice_design_prompts

    Args:
        yaml_config: 从 YAML 文件加载的配置字典。

    Returns:
        构建好的 WakeWordConfig 对象。
    """
    kwargs: dict[str, Any] = {}

    # 直接映射的顶层字段
    direct_fields = [
        "model_name",
        "target_phrases",
        "n_samples",
        "n_samples_val",
        "steps",
        "tts_backend",
        "target_fp_per_hour",
    ]
    for field in direct_fields:
        if field in yaml_config:
            kwargs[field] = yaml_config[field]

    # model 嵌套配置
    model_config = yaml_config.get("model", {})
    if "model_type" in model_config:
        kwargs["model_type"] = model_config["model_type"]
    if "model_size" in model_config:
        kwargs["model_size"] = model_config["model_size"]

    # VoxCPM TTS 配置
    voxcpm_config = yaml_config.get("voxcpm_tts", {})
    if "voice_design_prompts" in voxcpm_config:
        kwargs["voice_design_prompts"] = voxcpm_config["voice_design_prompts"]

    config = WakeWordConfig(**kwargs)
    logger.info(
        "Created WakeWordConfig: model_name='%s', target_phrases=%s",
        config.model_name,
        config.target_phrases,
    )
    return config


def run_pipeline(
    config_path: str,
    skip_generate: bool = False,
    skip_augment: bool = False,
) -> Path:
    """运行完整的唤醒词训练管线。

    依次执行: 数据生成 -> 数据增强 -> 训练 -> 导出。
    返回导出的 ONNX 模型路径。

    Args:
        config_path: YAML 配置文件路径。
        skip_generate: 是否跳过 TTS 数据生成阶段。
        skip_augment: 是否跳过数据增强阶段。

    Returns:
        导出的 ONNX 模型文件路径。
    """
    yaml_config = load_yaml_config(config_path)
    config = create_wakeword_config(yaml_config)

    # 导出配置中的 output_dir（可选）
    export_config = yaml_config.get("export", {})
    output_dir = export_config.get("output_dir")

    # 阶段 1: 数据生成
    if not skip_generate:
        logger.info("[1/4] Generating synthetic data...")
        generate_data(config)
    else:
        logger.info("[1/4] Skipping data generation (--skip-generate)")

    # 阶段 2: 数据增强 + 特征提取
    if not skip_augment:
        logger.info("[2/4] Augmenting data and extracting features...")
        augment_data(config)
    else:
        logger.info("[2/4] Skipping augmentation (--skip-augment)")

    # 阶段 3: 训练
    logger.info("[3/4] Training model '%s' (steps=%d)...", config.model_name, config.steps)
    run_train(config)
    logger.info("Training complete.")

    # 阶段 4: 导出
    logger.info("[4/4] Exporting ONNX model...")
    onnx_path = export_model(config, output_dir=output_dir)
    logger.info("Pipeline complete! Model saved to: %s", onnx_path)

    return onnx_path


def main() -> None:
    """CLI 入口点。

    支持的参数:
        --config: YAML 配置文件路径（必需）
        --skip-generate: 跳过 TTS 数据生成
        --skip-augment: 跳过数据增强
        --eval-only: 仅运行模型评估（跳过所有训练阶段）
        --verbose / -v: 启用详细日志输出
    """
    parser = argparse.ArgumentParser(
        description="Train custom wake word model using livekit-wakeword"
    )
    parser.add_argument(
        "--config",
        required=True,
        help="Path to config YAML file",
    )
    parser.add_argument(
        "--skip-generate",
        action="store_true",
        help="Skip TTS data generation",
    )
    parser.add_argument(
        "--skip-augment",
        action="store_true",
        help="Skip data augmentation",
    )
    parser.add_argument(
        "--eval-only",
        action="store_true",
        help="Only evaluate an existing model (skip training)",
    )
    parser.add_argument(
        "--verbose",
        "-v",
        action="store_true",
        help="Enable verbose logging",
    )
    args = parser.parse_args()

    # 配置日志
    log_level = logging.DEBUG if args.verbose else logging.INFO
    logging.basicConfig(
        level=log_level,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )

    if args.eval_only:
        # 仅评估模式
        yaml_config = load_yaml_config(args.config)
        config = create_wakeword_config(yaml_config)
        results = evaluate_model(config)
        print(f"\nEvaluation results: {results}")
    else:
        # 完整训练管线
        onnx_path = run_pipeline(
            config_path=args.config,
            skip_generate=args.skip_generate,
            skip_augment=args.skip_augment,
        )
        print(f"\nTraining complete! Model saved to: {onnx_path}")


if __name__ == "__main__":
    main()
