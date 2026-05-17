"""Shared fixtures for wakeword_trainer tests.

All tests must run without GPU, network, or microphone access.
Every interaction with livekit.wakeword and audio hardware is mocked.
"""
import sys
import types
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
# Fake ``livekit.wakeword`` module
# ---------------------------------------------------------------------------
# The real package is not installed in CI, so we inject a stub module
# before any wakeword_trainer code tries to import it.

def _build_fake_livekit_wakeword() -> types.ModuleType:
    """Create a fake ``livekit.wakeword`` module with all symbols used by
    wakeword_trainer so that ``import livekit.wakeword`` never fails."""

    # Top-level ``livekit`` namespace package
    livekit_pkg = types.ModuleType("livekit")
    livekit_pkg.__path__ = []  # make it a package

    # ``livekit.wakeword`` sub-module
    wakeword_mod = types.ModuleType("livekit.wakeword")

    # --- WakeWordConfig stub (dataclass-like) ---
    class _FakeWakeWordConfig:
        """Minimal stand-in for ``livekit.wakeword.WakeWordConfig``."""

        def __init__(self, **kwargs):
            # Accept any keyword args so ``WakeWordConfig(**kwargs)`` works.
            defaults = {
                "model_name": "my_wakeword",
                "target_phrases": ["hello"],
                "n_samples": 25000,
                "n_samples_val": 5000,
                "steps": 50000,
                "tts_backend": "piper",
                "target_fp_per_hour": 0.2,
                "model_type": "conv_attention",
                "model_size": "small",
                "voice_design_prompts": None,
            }
            defaults.update(kwargs)
            for key, value in defaults.items():
                setattr(self, key, value)

    wakeword_mod.WakeWordConfig = _FakeWakeWordConfig

    # --- Training / export function stubs ---
    wakeword_mod.run_generate = MagicMock(name="run_generate")
    wakeword_mod.run_augment = MagicMock(name="run_augment")
    wakeword_mod.run_extraction = MagicMock(name="run_extraction")
    wakeword_mod.run_train = MagicMock(name="run_train")
    wakeword_mod.run_export = MagicMock(
        name="run_export", return_value="/tmp/fake_model.onnx"
    )
    wakeword_mod.run_eval = MagicMock(
        name="run_eval",
        return_value={"aut": 0.001, "fpph": 0.08, "recall": 0.86},
    )

    # --- WakeWordModel stub ---
    _FakeModel = MagicMock(name="WakeWordModel")
    _FakeModel.return_value.predict.return_value = {"ni_hao_wei_ben": 0.95}
    wakeword_mod.WakeWordModel = _FakeModel

    return livekit_pkg, wakeword_mod


# Install the fake modules *before* test collection imports wakeword_trainer.
_livekit_pkg, _wakeword_mod = _build_fake_livekit_wakeword()
sys.modules.setdefault("livekit", _livekit_pkg)
sys.modules.setdefault("livekit.wakeword", _wakeword_mod)


# ---------------------------------------------------------------------------
# Fake ``sounddevice`` and ``soundfile`` modules
# ---------------------------------------------------------------------------
# These packages may not be installed in CI (they need system-level audio
# libraries).  We inject stubs so ``import sounddevice`` / ``import soundfile``
# succeed when ``wakeword_trainer.record`` is imported.

def _ensure_fake_audio_modules() -> None:
    if "sounddevice" not in sys.modules:
        sd = types.ModuleType("sounddevice")
        sd.rec = MagicMock(name="sounddevice.rec")
        sd.wait = MagicMock(name="sounddevice.wait")
        sys.modules["sounddevice"] = sd

    if "soundfile" not in sys.modules:
        sf = types.ModuleType("soundfile")
        sf.write = MagicMock(name="soundfile.write")
        sys.modules["soundfile"] = sf

_ensure_fake_audio_modules()


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture()
def lk(monkeypatch):
    """Provide fresh MagicMock instances for every ``livekit.wakeword``
    function and reset them between tests.

    Returns a dict keyed by function name.
    """
    import livekit.wakeword as lw

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

    for attr, mock in mocks.items():
        monkeypatch.setattr(lw, attr, mock)

    return mocks


@pytest.fixture()
def tmp_config(tmp_path):
    """Create a temporary YAML configuration file and return its path.

    The config mirrors the structure of ``configs/ni_hao_wei_ben.yaml``.
    """
    config_data = {
        "model_name": "test_wakeword",
        "target_phrases": ["hello test"],
        "tts_backend": "piper",
        "n_samples": 100,
        "n_samples_val": 20,
        "model": {
            "model_type": "conv_attention",
            "model_size": "small",
        },
        "steps": 500,
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
def sample_audio():
    """Generate fake 16 kHz int16 WAV data (3 seconds of silence).

    Returns a numpy array suitable for soundfile.write.
    """
    sample_rate = 16000
    duration_sec = 3
    frames = sample_rate * duration_sec
    return np.zeros((frames, 1), dtype=np.int16)


@pytest.fixture()
def mock_model_path(tmp_path):
    """Create a fake ONNX model file and return its Path."""
    model_file = tmp_path / "fake_model.onnx"
    model_file.write_bytes(b"\x00" * 64)  # dummy bytes
    return model_file


@pytest.fixture()
def mock_sounddevice(monkeypatch, sample_audio):
    """Mock ``sounddevice.rec`` and ``sounddevice.wait`` so no real
    microphone access is needed."""
    import wakeword_trainer.record as rec_mod

    mock_rec = MagicMock(return_value=sample_audio)
    mock_wait = MagicMock()

    monkeypatch.setattr(rec_mod.sd, "rec", mock_rec)
    monkeypatch.setattr(rec_mod.sd, "wait", mock_wait)

    return {"rec": mock_rec, "wait": mock_wait}


@pytest.fixture()
def mock_wakeword_model(monkeypatch):
    """Mock ``livekit.wakeword.WakeWordModel`` so inference runs without a
    real model file."""
    import livekit.wakeword as lw

    mock_model_instance = MagicMock()
    mock_model_instance.predict.return_value = {"ni_hao_wei_ben": 0.95}

    mock_cls = MagicMock(return_value=mock_model_instance)
    monkeypatch.setattr(lw, "WakeWordModel", mock_cls)

    return {"cls": mock_cls, "instance": mock_model_instance}
