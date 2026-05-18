# Viben Wake Word Trainer

基于 [livekit-wakeword](https://github.com/livekit/livekit-wakeword) 训练自定义唤醒词模型，使用 Conv-Attention 分类头实现低误触率。

## 系统依赖

```bash
# macOS
brew install espeak-ng ffmpeg portaudio

# Ubuntu/Debian
sudo apt install espeak-ng libsndfile1 ffmpeg sox libportaudio2 portaudio19-dev
```

> **注意**: `portaudio19-dev` 提供编译头文件，`libportaudio2` 提供运行时库。
> 如果只需要训练（不录音），至少需要安装 `libportaudio2`，否则 `sounddevice` 模块导入会报错 `OSError: PortAudio library not found`。

## 安装

```bash
cd backend/wakeword

# 基础安装（推理 + 录音验证）
pip install -e .

# 完整训练环境
pip install -e ".[train]"

# 中文 VoxCPM TTS 支持（推荐，中文唤醒词必须）
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

首次使用需下载预训练的 embedding 模型和 TTS 模型。

#### 推荐：跳过 ACAV100M 全量特征（节省 16GB 磁盘和下载时间）

```bash
livekit-wakeword setup --config configs/ni_hao_wei_ben.yaml --skip-acav
```

#### 完整下载（需约 22GB 磁盘空间）

```bash
livekit-wakeword setup --config configs/ni_hao_wei_ben.yaml
```

#### 下载内容详情

| 资源 | 大小 | 用途 | 保存路径 |
|------|------|------|----------|
| **VoxCPM2 中文 TTS 模型** | ~4.7 GB | 中文语音合成，生成多样化唤醒词正样本和对抗负样本 | `data/voxcpm/VoxCPM2/` |
| **ACAV100M 负样本特征** | ~16 GB | 2000 小时预计算 embedding 特征，用于训练负样本 | `data/features/openwakeword_features_ACAV100M_2000_hrs_16bit.npy` |
| **验证集特征** | ~176 MB | 11 小时预计算 embedding 特征，用于模型评估 | `data/features/validation_set_features.npy` |
| **MUSAN 背景噪声** | ~1.1 GB | 环境噪声音频（约 930 个 WAV 文件），用于数据增强 | `data/backgrounds/` |
| **MIT 房间脉冲响应 (RIR)** | ~8 MB | 270 个房间混响 WAV 文件，用于数据增强模拟真实环境 | `data/rirs/16khz/` |

VoxCPM2 模型文件组成：

| 文件 | 大小 | 说明 |
|------|------|------|
| `model.safetensors` | 4.3 GB | 主模型权重（语言模型 + 声码器） |
| `audiovae.pth` | 360 MB | 音频 VAE 模型 |
| `tokenizer.json` | 3.6 MB | 分词器 |
| `config.json` | 4.3 KB | 模型配置 |

#### 已内置的模型（随 pip 安装，无需额外下载）

以下模型已打包在 `livekit-wakeword` 包中，`pip install` 后自动可用：

| 模型 | 大小 | 用途 | 位置 |
|------|------|------|------|
| **melspectrogram.onnx** | 1.1 MB | 梅尔频谱提取（torchlibrosa） | `livekit/wakeword/resources/` |
| **embedding_model.onnx** | 1.3 MB | Google speech_embedding CNN（96 维向量） | `livekit/wakeword/resources/` |

这两个模型构成特征提取管线：音频 → 梅尔频谱 → 96 维 embedding → 分类器。

#### 常见问题

- **HuggingFace 限速**：MUSAN 噪声数据集下载可能遇到 `429 Too Many Requests`。解决方法：
  ```bash
  # 设置 HuggingFace token 避免限速
  export HF_TOKEN=your_token_here
  # 或者登录
  pip install huggingface-hub
  huggingface-cli login
  ```
  即使部分文件下载失败（如 228/930 文件），训练仍可正常运行，只是数据增强多样性略有降低。

- **磁盘空间不足**：使用 `--skip-acav` 可减少约 16GB 下载量。`--skip-acav` 模式仅下载验证集特征（176 MB），训练时使用合成数据的 embedding 而非预计算的 ACAV100M 特征。

### 2. 训练

```bash
wakeword-train --config configs/ni_hao_wei_ben.yaml
```

完整管线依次执行：TTS 合成 → 数据增强 → 特征提取 → 模型训练 → ONNX 导出。

> **性能提示**：
> - GPU 环境下 VoxCPM TTS 生成 25000 个样本约需 1-2 小时
> - CPU 环境下生成速度约 2-3 秒/样本，25000 样本可能需要 10+ 小时
> - 建议在有 CUDA GPU 的机器上运行训练

可分步执行：

```bash
# 跳过数据生成（已完成时）
wakeword-train --config configs/ni_hao_wei_ben.yaml --skip-generate

# 跳过数据增强（已完成时）
wakeword-train --config configs/ni_hao_wei_ben.yaml --skip-augment

# 详细日志
wakeword-train --config configs/ni_hao_wei_ben.yaml --verbose
```

也可以使用 `livekit-wakeword` 原生 CLI 分步执行：

```bash
# 单独生成数据
livekit-wakeword generate configs/ni_hao_wei_ben.yaml

# 单独增强 + 特征提取
livekit-wakeword augment configs/ni_hao_wei_ben.yaml

# 单独训练
livekit-wakeword train configs/ni_hao_wei_ben.yaml

# 单独导出 ONNX
livekit-wakeword export configs/ni_hao_wei_ben.yaml

# 一键全流程（等价于 wakeword-train）
livekit-wakeword run configs/ni_hao_wei_ben.yaml
```

### 3. 评估

```bash
wakeword-train --config configs/ni_hao_wei_ben.yaml --eval-only
```

或使用原生 CLI：

```bash
livekit-wakeword eval configs/ni_hao_wei_ben.yaml
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

#### 模型体积

根据配置信息，部署到 desktop 的 ONNX 模型会非常小，大约 **50-200 KB**。

原因：

- 模型架构是 `conv_attention`，size 为 `small`（layer_dim=32, n_blocks=1）
- 它只是一个分类头（classifier），输入是 96 维 embedding 向量，输出是唤醒词检测概率
- 真正的特征提取管线（melspectrogram.onnx 1.1MB + embedding_model.onnx 1.3MB）是内置在 livekit-wakeword / onnxruntime-web 推理侧的，不在这个导出模型里

所以导出到 `apps/desktop/public/wakeword/models/ni_hao_wei_ben.onnx` 的文件非常轻量，适合浏览器端实时推理。

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

> **注意**: 录音功能需要麦克风硬件，在无音频设备的服务器上无法使用。

## 项目结构

```
backend/wakeword/
├── configs/
│   └── ni_hao_wei_ben.yaml       # "你好微本"训练配置
├── data/                          # 训练数据（setup 自动下载/生成）
│   ├── voxcpm/VoxCPM2/            # VoxCPM2 TTS 模型（~4.7GB）
│   ├── features/                  # 预计算 embedding 特征
│   ├── backgrounds/               # MUSAN 背景噪声
│   ├── rirs/                      # MIT 房间脉冲响应
│   └── recordings/                # 录音文件（手动录制）
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
| `model.model_type` | 模型架构（dnn/rnn/conv_attention） | `conv_attention` |
| `model.model_size` | 模型大小（tiny/small/medium/large） | `small` |
| `tts_backend` | TTS 引擎（voxcpm/piper_vits） | `voxcpm`（中文） |
| `n_samples` | 训练样本数 | 25000 |
| `n_samples_val` | 验证样本数 | 5000 |
| `steps` | 训练步数 | 50000 |
| `target_fp_per_hour` | 目标误触率/小时 | 0.2 |

模型大小预设：

| Size | layer_dim | n_blocks | 适用场景 |
|------|-----------|----------|----------|
| tiny | 16 | 1 | 极致轻量，嵌入式设备 |
| small | 32 | 1 | 推荐默认，平衡性能和大小 |
| medium | 128 | 2 | 更高精度，适合多唤醒词 |
| large | 256 | 3 | 最高精度，桌面/服务器端 |

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

## Troubleshooting

### PortAudio library not found

```
OSError: PortAudio library not found
```

安装 PortAudio 运行时库：

```bash
# Ubuntu/Debian
sudo apt install libportaudio2

# macOS
brew install portaudio
```

### HuggingFace 下载限速 (429 Too Many Requests)

MUSAN 背景噪声等数据集从 HuggingFace 下载时可能触发 IP 限速。设置 token 可解决：

```bash
export HF_TOKEN=your_token_here
# 然后重新运行 setup
livekit-wakeword setup --config configs/ni_hao_wei_ben.yaml --skip-acav
```

部分文件下载失败不影响训练，已下载的文件会被缓存，重新运行 setup 不会重复下载。

### espeak-ng not found

VoxCPM 后端不依赖 espeak-ng（使用自带的 tokenizer），但如果使用 piper_vits 后端则需要：

```bash
sudo apt install espeak-ng
```

### numpy.trapezoid AttributeError (评估阶段)

```
AttributeError: module 'numpy' has no attribute 'trapezoid'
```

livekit-wakeword 的评估代码使用了 `np.trapezoid`（NumPy 2.0+ API），但本项目要求 NumPy <2.0 以兼容 audiomentations。已在 `src/wakeword_trainer/export.py` 中自动添加兼容 shim，无需手动处理。

### CPU 训练过慢

VoxCPM 在 CPU 上生成语音非常慢（~2-3 秒/样本）。建议：

1. 使用有 CUDA GPU 的机器
2. 减少 `n_samples` 进行快速验证：修改 YAML 中 `n_samples: 500`
3. 数据生成完毕后用 `--skip-generate` 跳过重新生成
