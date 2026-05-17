"""ONNX 导出与模型评估 - 使用 livekit-wakeword"""
import logging
import shutil
from pathlib import Path
from typing import Optional

from livekit.wakeword import WakeWordConfig, run_eval, run_export

logger = logging.getLogger(__name__)


def export_model(
    config: WakeWordConfig,
    output_dir: Optional[str] = None,
) -> Path:
    """将训练好的模型导出为 ONNX 格式。

    调用 livekit-wakeword 的 run_export 生成 ONNX 文件。
    如果指定了 output_dir，会将导出的模型复制到该目录
    （例如 apps/desktop/public/wakeword/models/）。

    Args:
        config: livekit-wakeword 配置对象。
        output_dir: 可选的自定义输出目录路径。如果提供，
                    会将导出的 ONNX 文件复制到此目录。

    Returns:
        导出的 ONNX 模型文件路径。
    """
    logger.info("Exporting ONNX model for '%s'...", config.model_name)
    onnx_path = run_export(config)
    onnx_path = Path(onnx_path)
    logger.info("ONNX model exported to: %s", onnx_path)

    if output_dir is not None:
        dest_dir = Path(output_dir)
        dest_dir.mkdir(parents=True, exist_ok=True)
        dest_path = dest_dir / onnx_path.name
        shutil.copy2(onnx_path, dest_path)
        logger.info("Model copied to: %s", dest_path)
        return dest_path

    return onnx_path


def evaluate_model(
    config: WakeWordConfig,
    model_path: Optional[Path] = None,
) -> dict:
    """评估导出的 ONNX 模型。

    使用 livekit-wakeword 的 run_eval 对模型进行评估，
    返回包含准确率、误触率等指标的字典。

    Args:
        config: livekit-wakeword 配置对象。
        model_path: 可选的 ONNX 模型路径。如果为 None，
                    会先调用 run_export 获取默认路径。

    Returns:
        包含评估指标的字典。
    """
    if model_path is None:
        logger.info("No model path provided, exporting first...")
        model_path = Path(run_export(config))

    logger.info("Evaluating model: %s", model_path)
    results = run_eval(config, str(model_path))
    logger.info("Evaluation complete. Results: %s", results)
    return results
