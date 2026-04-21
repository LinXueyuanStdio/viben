#!/bin/bash
# 下载 openWakeWord 模型文件

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
MODELS_DIR="$PROJECT_DIR/public/openwakeword/models"
ORT_DIR="$PROJECT_DIR/public/openwakeword/ort"

mkdir -p "$MODELS_DIR" "$ORT_DIR"

echo "Copying onnxruntime WASM files..."
cp "$PROJECT_DIR/node_modules/onnxruntime-web/dist/"*.wasm "$ORT_DIR/"

echo "Downloading melspectrogram.onnx..."
curl -L -o "$MODELS_DIR/melspectrogram.onnx" \
  "https://github.com/dscripka/openWakeWord/releases/download/v0.5.0/melspectrogram.onnx"

echo "Downloading embedding_model.onnx..."
curl -L -o "$MODELS_DIR/embedding_model.onnx" \
  "https://github.com/dscripka/openWakeWord/releases/download/v0.5.0/embedding_model.onnx"

echo "Downloading hey_jarvis_v0.1.onnx (for development testing)..."
curl -L -o "$MODELS_DIR/hey_jarvis_v0.1.onnx" \
  "https://github.com/dscripka/openWakeWord/releases/download/v0.5.0/hey_jarvis_v0.1.onnx"

echo "Models downloaded successfully!"
