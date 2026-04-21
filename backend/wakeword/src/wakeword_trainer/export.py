"""导出训练好的模型为 ONNX 格式"""
from pathlib import Path


def export_onnx_model(
    model_name: str,
    output_dir: Path,
    threshold: float = 0.5,
) -> None:
    """导出模型为 ONNX 格式"""
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / f"{model_name}.onnx"

    print(f"  Model: {model_name}")
    print(f"  Output: {output_path}")
    print(f"  Threshold: {threshold}")

    print("  [Mock] ONNX export not implemented yet")
