# Viben Wake Word Trainer

使用 openWakeWord 训练自定义唤醒词模型。

## 安装

```bash
cd backend/wakeword
pip install -e .
```

## 使用

### 训练"你好微本"模型

```bash
python -m wakeword_trainer.train --config configs/ni_hao_wei_ben.yaml
```

### 分步执行

```bash
# 1. 生成合成语音
python -m wakeword_trainer.generate --config configs/ni_hao_wei_ben.yaml

# 2. 训练模型（跳过生成）
python -m wakeword_trainer.train --config configs/ni_hao_wei_ben.yaml --skip-generate

# 3. 导出 ONNX
python -m wakeword_trainer.export --config configs/ni_hao_wei_ben.yaml
```

## 配置说明

参见 `configs/ni_hao_wei_ben.yaml` 中的注释。

## 依赖

- Python 3.9+
- openWakeWord
- PyTorch
- ONNX
