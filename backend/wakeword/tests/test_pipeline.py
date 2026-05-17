"""Tests for the training pipeline orchestration.

All ``livekit.wakeword`` functions are mocked via the ``lk`` fixture.
No GPU, network, or real training is required.

Covers:
- Full pipeline (generate -> augment/extraction -> train -> export)
- Skipping generate / augment stages
- Return value (ONNX path)
- generate_data / augment_data wrappers
"""
from pathlib import Path
from unittest.mock import MagicMock

import pytest

from wakeword_trainer.train import (
    create_wakeword_config,
    load_yaml_config,
    run_pipeline,
)
from wakeword_trainer.generate import augment_data, generate_data


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _setup(tmp_config, lk):
    """Prepare config_path and set run_export return value to a real file.

    ``export_model()`` uses ``shutil.copy2`` when output_dir is set, so
    run_export must return a path to a file that actually exists.
    """
    config_path, _ = tmp_config
    # Create a real temp file for run_export to "produce"
    fake_onnx = config_path.parent / "livekit_out" / "test_wakeword.onnx"
    fake_onnx.parent.mkdir(parents=True, exist_ok=True)
    fake_onnx.write_bytes(b"\x00" * 32)
    lk["run_export"].return_value = str(fake_onnx)
    return str(config_path)


# ---------------------------------------------------------------------------
# run_pipeline tests
# ---------------------------------------------------------------------------

class TestRunPipeline:
    """Tests for ``run_pipeline``."""

    def test_run_pipeline_full(self, tmp_config, lk):
        """All stages are called when nothing is skipped."""
        config_path = _setup(tmp_config, lk)

        run_pipeline(config_path=config_path)

        lk["run_generate"].assert_called_once()
        lk["run_augment"].assert_called_once()
        lk["run_extraction"].assert_called_once()
        lk["run_train"].assert_called_once()
        lk["run_export"].assert_called_once()

    def test_run_pipeline_skip_generate(self, tmp_config, lk):
        """run_generate is NOT called when skip_generate=True."""
        config_path = _setup(tmp_config, lk)

        run_pipeline(config_path=config_path, skip_generate=True)

        lk["run_generate"].assert_not_called()
        # Other stages should still run.
        lk["run_augment"].assert_called_once()
        lk["run_extraction"].assert_called_once()
        lk["run_train"].assert_called_once()
        lk["run_export"].assert_called_once()

    def test_run_pipeline_skip_augment(self, tmp_config, lk):
        """run_augment and run_extraction are NOT called when
        skip_augment=True."""
        config_path = _setup(tmp_config, lk)

        run_pipeline(config_path=config_path, skip_augment=True)

        lk["run_augment"].assert_not_called()
        lk["run_extraction"].assert_not_called()
        # Generate and train+export should still run.
        lk["run_generate"].assert_called_once()
        lk["run_train"].assert_called_once()
        lk["run_export"].assert_called_once()

    def test_run_pipeline_returns_onnx_path(self, tmp_config, lk):
        """run_pipeline returns a Path pointing to the exported ONNX model."""
        config_path = _setup(tmp_config, lk)

        result = run_pipeline(config_path=config_path)

        assert isinstance(result, Path)
        assert str(result).endswith(".onnx")


# ---------------------------------------------------------------------------
# generate_data / augment_data wrapper tests
# ---------------------------------------------------------------------------

class TestDataFunctions:
    """Tests for generate_data and augment_data wrappers in generate.py."""

    def _make_config(self, tmp_config):
        _, data = tmp_config
        return create_wakeword_config(data)

    def test_generate_data_calls_run_generate(self, tmp_config, lk):
        """generate_data correctly delegates to livekit run_generate."""
        config = self._make_config(tmp_config)

        generate_data(config)

        lk["run_generate"].assert_called_once_with(config)

    def test_augment_data_calls_both(self, tmp_config, lk):
        """augment_data calls both run_augment and run_extraction."""
        config = self._make_config(tmp_config)

        augment_data(config)

        lk["run_augment"].assert_called_once_with(config)
        lk["run_extraction"].assert_called_once_with(config)
