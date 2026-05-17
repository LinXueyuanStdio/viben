"""Shared fixtures for wakeword_trainer tests.

Uses the real livekit-wakeword package for config/types.
Training functions (run_generate, run_train, etc.) are mocked to avoid
requiring GPU/network/hours of training time.
"""
import sys
from pathlib import Path
from unittest.mock import MagicMock

import numpy as np
import pytest
import yaml

# ---------------------------------------------------------------------------
# Ensure ``wakeword_trainer`` is importable even without ``pip install -e .``
# ---------------------------------------------------------------------------
_src_dir = str(Path(__file__).resolve().parent.parent / "src")
if _src_dir not in sys.path:
    sys.path.insert(0, _src_dir)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture()
def lk(monkeypatch):
    """Mock livekit-wakeword training functions on the consumer modules.

    This avoids actually running TTS generation, training, or export
    while still using the real WakeWordConfig/ModelConfig types.
    """
    import wakeword_trainer.export as export_mod
    import wakeword_trainer.generate as generate_mod
    import wakeword_trainer.train as train_mod

    mocks = {
        "run_generate": MagicMock(name="run_generate"),
        "run_augment": MagicMock(name="run_augment"),
        "run_extraction": MagicMock(name="run_extraction"),
        "run_train": MagicMock(name="run_train"),
        "run_export": MagicMock(
            name="run_export", return_value="/tmp/fake_model.onnx"
        ),
        "run_eval": MagicMock(
            name="run_eval",
            return_value={"aut": 0.001, "fpph": 0.08, "recall": 0.86},
        ),
    }

    # Patch on the modules that imported these symbols
    monkeypatch.setattr(generate_mod, "run_generate", mocks["run_generate"])
    monkeypatch.setattr(generate_mod, "run_augment", mocks["run_augment"])
    monkeypatch.setattr(generate_mod, "run_extraction", mocks["run_extraction"])
    monkeypatch.setattr(train_mod, "run_train", mocks["run_train"])
    monkeypatch.setattr(export_mod, "run_export", mocks["run_export"])
    monkeypatch.setattr(export_mod, "run_eval", mocks["run_eval"])

    return mocks


@pytest.fixture()
def tmp_config(tmp_path):
    """Create a temporary YAML configuration file with minimal samples."""
    config_data = {
        "model_name": "test_wakeword",
        "target_phrases": ["hello test"],
        "tts_backend": "piper_vits",
        "n_samples": 10,
        "n_samples_val": 5,
        "model": {
            "model_type": "conv_attention",
            "model_size": "small",
        },
        "steps": 10,
        "target_fp_per_hour": 0.5,
        "export": {
            "output_dir": str(tmp_path / "models"),
            "threshold": 0.5,
        },
    }

    config_path = tmp_path / "test_config.yaml"
    config_path.write_text(yaml.dump(config_data, allow_unicode=True), encoding="utf-8")
    return config_path, config_data


@pytest.fixture()
def real_config_path():
    """Return path to the real ni_hao_wei_ben.yaml config."""
    path = Path(__file__).resolve().parent.parent / "configs" / "ni_hao_wei_ben.yaml"
    if not path.exists():
        pytest.skip("Real config file not found")
    return str(path)


@pytest.fixture()
def sample_audio():
    """Generate fake 16 kHz int16 WAV data (3 seconds of silence)."""
    sample_rate = 16000
    duration_sec = 3
    frames = sample_rate * duration_sec
    return np.zeros((frames, 1), dtype=np.int16)


@pytest.fixture()
def mock_model_path(tmp_path):
    """Create a fake ONNX model file and return its Path."""
    model_file = tmp_path / "fake_model.onnx"
    model_file.write_bytes(b"\x00" * 64)
    return model_file


@pytest.fixture()
def mock_sounddevice(monkeypatch, sample_audio):
    """Mock sounddevice so no real microphone access is needed."""
    import wakeword_trainer.record as rec_mod

    mock_rec = MagicMock(return_value=sample_audio)
    mock_wait = MagicMock()
    mock_play = MagicMock()

    monkeypatch.setattr(rec_mod.sd, "rec", mock_rec)
    monkeypatch.setattr(rec_mod.sd, "wait", mock_wait)
    monkeypatch.setattr(rec_mod.sd, "play", mock_play)

    return {"rec": mock_rec, "wait": mock_wait, "play": mock_play}


@pytest.fixture()
def mock_soundfile(monkeypatch, sample_audio):
    """Mock soundfile so no real file I/O happens."""
    import wakeword_trainer.record as rec_mod

    mock_write = MagicMock()
    mock_read = MagicMock(
        return_value=(np.zeros(48000, dtype=np.int16), 16000)
    )

    monkeypatch.setattr(rec_mod.sf, "write", mock_write)
    monkeypatch.setattr(rec_mod.sf, "read", mock_read)

    return {"write": mock_write, "read": mock_read}


@pytest.fixture()
def mock_wakeword_model(monkeypatch):
    """Mock WakeWordModel so inference runs without a real ONNX model."""
    import livekit.wakeword as lw
    import wakeword_trainer.record as rec_mod

    mock_model_instance = MagicMock()
    mock_model_instance.predict.return_value = {"ni_hao_wei_ben": 0.95}

    mock_cls = MagicMock(return_value=mock_model_instance)
    monkeypatch.setattr(lw, "WakeWordModel", mock_cls)
    # Also patch where record.py does lazy import
    if hasattr(rec_mod, "WakeWordModel"):
        monkeypatch.setattr(rec_mod, "WakeWordModel", mock_cls)

    return {"cls": mock_cls, "instance": mock_model_instance}
