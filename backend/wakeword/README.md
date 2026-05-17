# Viben Wake Word Trainer

基于 [livekit-wakeword](https://github.com/livekit/livekit-wakeword) 训练自定义唤醒词模型，使用 Conv-Attention 分类头实现低误触率。

## 系统依赖

```bash
# macOS
brew install espeak-ng ffmpeg portaudio

# Ubuntu/Debian
sudo apt install espeak-ng libsndfile1 ffmpeg sox portaudio19-dev
```

## 安装

```bash
cd backend/wakeword

# 基础安装（推理 + 录音验证）
pip install -e .

# 完整训练环境
pip install -e ".[train]"

# 中文 VoxCPM TTS 支持
pip install -e ".[train,voxcpm]"

# 开发测试
pip install -e ".[dev]"
```

> **注意**: numpy 需要 `<2.0` 以兼容 audiomentations 的 numpy-minmax 依赖。
> 在 Apple Silicon 上如果 numpy-minmax 编译失败，用：
> ```bash
> CFLAGS="-arch x86_64" CC="/usr/bin/clang" pip install numpy-minmax
> ```

## 快速开始

### 1. 下载模型和数据

首次使用需下载预训练的 embedding 模型和 TTS 模型：

```bash
livekit-wakeword setup --config configs/ni_hao_wei_ben.yaml
```

这会下载：
- Google speech embedding 模型
- openWakeWord embedding 模型
- VoxCPM2 中文 TTS 模型（约 2GB）

### 2. 训练

```bash
wakeword-train --config configs/ni_hao_wei_ben.yaml
```

完整管线依次执行：TTS 合成 → 数据增强 → 特征提取 → 模型训练 → ONNX 导出。

可分步执行：

```bash
# 跳过数据生成（已完成时）
wakeword-train --config configs/ni_hao_wei_ben.yaml --skip-generate

# 跳过数据增强（已完成时）
wakeword-train --config configs/ni_hao_wei_ben.yaml --skip-augment
```

### 3. 评估

```bash
wakeword-train --config configs/ni_hao_wei_ben.yaml --eval-only
```

输出 DET 曲线、AUT、FPPH、Recall 等指标。

### 4. 部署

训练完成后，ONNX 模型自动复制到桌面应用：

```
apps/desktop/public/wakeword/models/ni_hao_wei_ben.onnx
```

桌面端通过 `onnxruntime-web` 加载该模型进行实时推理。

如需手动复制：

```bash
cp models/ni_hao_wei_ben.onnx ../../apps/desktop/public/wakeword/models/
```

### 5. 录音 + 验证 + 微调（可选）

录制 3 条真人语音，验证模型识别效果，并可选择微调：

```bash
# 一键全流程
wakeword-record all --config configs/ni_hao_wei_ben.yaml

# 或分步执行
wakeword-record record --config configs/ni_hao_wei_ben.yaml
wakeword-record validate --config configs/ni_hao_wei_ben.yaml --model models/ni_hao_wei_ben.onnx
wakeword-record fine-tune --config configs/ni_hao_wei_ben.yaml
```

## 项目结构

```
backend/wakeword/
├── configs/
│   └── ni_hao_wei_ben.yaml       # "你好微本"训练配置
├── data/                          # 训练数据（自动生成）
│   ├── voxcpm/                    # VoxCPM TTS 模型（setup 下载）
│   └── recordings/                # 录音文件
├── models/                        # 训练输出模型
├── src/wakeword_trainer/
│   ├── __init__.py                # 公共 API
│   ├── config.py                  # WakeWordConfig 数据类
│   ├── train.py                   # 训练管线 CLI
│   ├── generate.py                # TTS 生成 + 数据增强
│   ├── export.py                  # ONNX 导出 + 评估
│   └── record.py                  # 录音 + 验证 + 微调
└── tests/                         # pytest 测试套件
```

## 配置说明

`configs/ni_hao_wei_ben.yaml` 关键参数：

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `model.model_type` | 模型架构 | `conv_attention` |
| `model.model_size` | 模型大小 | `small` |
| `tts_backend` | TTS 引擎 | `voxcpm`（中文） |
| `n_samples` | 训练样本数 | 25000 |
| `steps` | 训练步数 | 50000 |
| `target_fp_per_hour` | 目标误触率/小时 | 0.2 |

## 测试

```bash
pytest tests/ -v
```

所有测试在无 GPU、无网络、无麦克风环境下运行（完全 mock）。

## 依赖

- Python 3.11+
- livekit-wakeword（基础推理）
- livekit-wakeword[train,eval,export]（训练）
- livekit-wakeword[voxcpm]（中文 TTS）
- sounddevice + soundfile（录音）
- NumPy <2.0, PyYAML

## Python API

```python
from wakeword_trainer import (
    load_yaml_config,
    create_wakeword_config,
    run_pipeline,
    generate_data,
    augment_data,
    export_model,
    evaluate_model,
    record_samples,
    validate_recordings,
    fine_tune,
)

# 运行完整训练管线
onnx_path = run_pipeline("configs/ni_hao_wei_ben.yaml")

# 录音并验证
recordings = record_samples(num_samples=3, phrase="你好微本")
results = validate_recordings(recordings, model_path=onnx_path)
print(f"识别率: {results['detection_rate']:.0%}")
```
