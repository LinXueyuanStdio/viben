"""Tests for ONNX export and model evaluation.

All ``livekit.wakeword`` functions are mocked via the ``lk`` fixture.

Covers:
- export_model with default output_dir
- export_model with custom output_dir override
- evaluate_model returns metrics dict
- export copies model to desktop app directory
"""
from pathlib import Path
from unittest.mock import MagicMock

import pytest

from wakeword_trainer.export import evaluate_model, export_model
from wakeword_trainer.train import create_wakeword_config


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_config(data_override=None):
    """Build a WakeWordConfig from a minimal YAML-like dict."""
    base = {
        "model_name": "test_export",
        "target_phrases": ["hello export"],
        "tts_backend": "piper_vits",
        "n_samples": 10,
        "n_samples_val": 5,
        "steps": 10,
    }
    if data_override:
        base.update(data_override)
    return create_wakeword_config(base)


def _create_fake_onnx(tmp_path, name="test_export.onnx"):
    """Create a temporary ONNX file and return its string path."""
    src_dir = tmp_path / "livekit_output"
    src_dir.mkdir(exist_ok=True)
    onnx_file = src_dir / name
    onnx_file.write_bytes(b"\x00" * 32)
    return str(onnx_file)


# ---------------------------------------------------------------------------
# export_model tests
# ---------------------------------------------------------------------------

class TestExportModel:
    """Tests for ``export_model``."""

    def test_export_model_default_path(self, lk, tmp_path):
        """When no output_dir is passed, run_export is called and its return
        value is converted to a Path."""
        onnx_path = _create_fake_onnx(tmp_path)
        lk["run_export"].return_value = onnx_path
        config = _make_config()

        result = export_model(config)

        lk["run_export"].assert_called_once()
        assert isinstance(result, Path)
        assert str(result) == onnx_path

    def test_export_model_custom_path(self, lk, tmp_path):
        """When output_dir is provided, the ONNX file is copied to that
        directory and the new path is returned."""
        onnx_path = _create_fake_onnx(tmp_path)
        lk["run_export"].return_value = onnx_path

        custom_dir = tmp_path / "custom_output"
        config = _make_config()

        result = export_model(config, output_dir=str(custom_dir))

        # The file should now exist in custom_dir.
        assert result.parent == custom_dir
        assert result.exists()
        assert result.name == "test_export.onnx"

    def test_export_model_no_output_dir_returns_raw(self, lk, tmp_path):
        """Without output_dir, the raw path from run_export is returned
        as a Path object (no copy)."""
        onnx_path = _create_fake_onnx(tmp_path, "model.onnx")
        lk["run_export"].return_value = onnx_path
        config = _make_config()

        result = export_model(config, output_dir=None)

        assert result == Path(onnx_path)

    def test_export_copies_to_desktop(self, lk, tmp_path):
        """Simulate copying the model to the desktop app's wakeword
        models directory (via output_dir)."""
        onnx_path = _create_fake_onnx(tmp_path)
        lk["run_export"].return_value = onnx_path

        desktop_dir = tmp_path / "apps" / "desktop" / "public" / "wakeword" / "models"
        config = _make_config()

        result = export_model(config, output_dir=str(desktop_dir))

        assert desktop_dir.is_dir()
        assert (desktop_dir / "test_export.onnx").exists()
        assert result == desktop_dir / "test_export.onnx"


# ---------------------------------------------------------------------------
# evaluate_model tests
# ---------------------------------------------------------------------------

class TestEvaluateModel:
    """Tests for ``evaluate_model``."""

    def test_evaluate_model_returns_metrics(self, lk, tmp_path):
        """evaluate_model returns a dict with aut, fpph, recall keys."""
        expected = {"aut": 0.001, "fpph": 0.08, "recall": 0.86}
        lk["run_eval"].return_value = expected
        # run_export must also return a string path for the fallback branch.
        lk["run_export"].return_value = _create_fake_onnx(tmp_path)

        config = _make_config()
        result = evaluate_model(config)

        assert isinstance(result, dict)
        assert "aut" in result
        assert "fpph" in result
        assert "recall" in result
        assert result == expected

    def test_evaluate_model_with_explicit_path(self, lk, tmp_path):
        """When model_path is provided, run_export is NOT called to locate
        the model."""
        expected = {"aut": 0.002, "fpph": 0.05, "recall": 0.90}
        lk["run_eval"].return_value = expected

        model_path = tmp_path / "explicit.onnx"
        model_path.write_bytes(b"\x00" * 8)

        config = _make_config()
        result = evaluate_model(config, model_path=model_path)

        lk["run_eval"].assert_called_once()
        # run_export should NOT have been called because we provided model_path.
        lk["run_export"].assert_not_called()
        assert result == expected

    def test_evaluate_model_no_path_calls_export_first(self, lk, tmp_path):
        """When model_path is None, run_export is called first to obtain
        the default path, then run_eval evaluates it."""
        lk["run_export"].return_value = _create_fake_onnx(tmp_path, "auto.onnx")
        lk["run_eval"].return_value = {"aut": 0.0}

        config = _make_config()
        evaluate_model(config, model_path=None)

        lk["run_export"].assert_called_once()
        lk["run_eval"].assert_called_once()
