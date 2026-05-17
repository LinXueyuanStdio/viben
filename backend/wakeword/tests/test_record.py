"""Tests for recording, validation, and fine-tuning.

sounddevice and soundfile are mocked so no real microphone is used.
livekit.wakeword.WakeWordModel is mocked so no real ONNX inference happens.

Covers:
- record_samples: file creation, count, format
- validate_recordings: all detected, none detected, detection_rate
- fine_tune: augment + retrain flow
"""
from pathlib import Path
from unittest.mock import MagicMock, call

import numpy as np
import pytest

from wakeword_trainer.record import (
    CHANNELS,
    DTYPE,
    SAMPLE_RATE,
    fine_tune,
    record_samples,
    validate_recordings,
)


# ---------------------------------------------------------------------------
# record_samples tests
# ---------------------------------------------------------------------------

class TestRecordSamples:
    """Tests for ``record_samples``."""

    def test_record_samples_creates_files(self, tmp_path, mock_sounddevice):
        """Recording produces the expected number of WAV files."""
        num = 3
        files = record_samples(output_dir=tmp_path / "rec", num_samples=num)

        assert len(files) == num
        for f in files:
            assert f.exists()
            assert f.suffix == ".wav"

    def test_record_samples_correct_format(self, tmp_path, mock_sounddevice):
        """sd.rec is called with 16 kHz, mono, int16."""
        record_samples(output_dir=tmp_path / "rec", num_samples=1)

        rec_call = mock_sounddevice["rec"]
        rec_call.assert_called_once()
        _, kwargs = rec_call.call_args

        assert kwargs["samplerate"] == SAMPLE_RATE
        assert kwargs["channels"] == CHANNELS
        assert kwargs["dtype"] == DTYPE

    def test_record_samples_sequential_naming(self, tmp_path, mock_sounddevice):
        """Files are named sample_000.wav, sample_001.wav, ..."""
        files = record_samples(output_dir=tmp_path / "rec", num_samples=3)
        names = sorted(f.name for f in files)
        assert names == ["sample_000.wav", "sample_001.wav", "sample_002.wav"]

    def test_record_samples_creates_output_dir(self, tmp_path, mock_sounddevice):
        """Output directory is created if it does not exist."""
        out = tmp_path / "deep" / "nested" / "dir"
        assert not out.exists()

        record_samples(output_dir=out, num_samples=1)

        assert out.is_dir()

    def test_record_samples_wait_called(self, tmp_path, mock_sounddevice):
        """sd.wait() is called after each recording to block until done."""
        n = 4
        record_samples(output_dir=tmp_path / "rec", num_samples=n)

        assert mock_sounddevice["wait"].call_count == n


# ---------------------------------------------------------------------------
# validate_recordings tests
# ---------------------------------------------------------------------------

class TestValidateRecordings:
    """Tests for ``validate_recordings``."""

    def _sample_paths(self, tmp_path, count=5):
        """Create dummy WAV files and return their paths."""
        paths = []
        for i in range(count):
            p = tmp_path / f"sample_{i:03d}.wav"
            p.write_bytes(b"\x00" * 16)
            paths.append(p)
        return paths

    def test_validate_recordings_all_detected(
        self, tmp_path, mock_model_path, mock_wakeword_model
    ):
        """When all scores exceed the threshold, detection_rate == 1.0."""
        mock_wakeword_model["instance"].predict.return_value = {
            "ni_hao_wei_ben": 0.95
        }
        paths = self._sample_paths(tmp_path, count=5)

        result = validate_recordings(
            model_path=mock_model_path,
            sample_paths=paths,
            wakeword_name="ni_hao_wei_ben",
            threshold=0.5,
        )

        assert result["detection_rate"] == 1.0
        assert all(result["detected"])
        assert len(result["scores"]) == 5

    def test_validate_recordings_none_detected(
        self, tmp_path, mock_model_path, mock_wakeword_model
    ):
        """When all scores are below threshold, detection_rate == 0.0."""
        mock_wakeword_model["instance"].predict.return_value = {
            "ni_hao_wei_ben": 0.1
        }
        paths = self._sample_paths(tmp_path, count=4)

        result = validate_recordings(
            model_path=mock_model_path,
            sample_paths=paths,
            wakeword_name="ni_hao_wei_ben",
            threshold=0.5,
        )

        assert result["detection_rate"] == 0.0
        assert not any(result["detected"])

    def test_validate_recordings_detection_rate(
        self, tmp_path, mock_model_path, mock_wakeword_model
    ):
        """Detection rate is correctly computed for a mixed set of scores."""
        # 3 out of 5 samples above threshold
        scores = [0.9, 0.8, 0.3, 0.7, 0.2]
        mock_wakeword_model["instance"].predict.side_effect = [
            {"ni_hao_wei_ben": s} for s in scores
        ]
        paths = self._sample_paths(tmp_path, count=5)

        result = validate_recordings(
            model_path=mock_model_path,
            sample_paths=paths,
            wakeword_name="ni_hao_wei_ben",
            threshold=0.5,
        )

        expected_rate = 3.0 / 5.0
        assert result["detection_rate"] == pytest.approx(expected_rate)
        assert result["detected"] == [True, True, False, True, False]
        assert result["scores"] == scores

    def test_validate_recordings_model_constructed_correctly(
        self, tmp_path, mock_model_path, mock_wakeword_model
    ):
        """WakeWordModel is instantiated with the string path."""
        paths = self._sample_paths(tmp_path, count=1)

        validate_recordings(
            model_path=mock_model_path,
            sample_paths=paths,
            wakeword_name="ni_hao_wei_ben",
        )

        mock_wakeword_model["cls"].assert_called_once_with(str(mock_model_path))


# ---------------------------------------------------------------------------
# fine_tune tests
# ---------------------------------------------------------------------------

class TestFineTune:
    """Tests for ``fine_tune``."""

    def test_fine_tune_augments_and_retrains(self, tmp_path, lk):
        """fine_tune calls run_augment, run_train, and run_export."""
        from wakeword_trainer.config import WakeWordConfig as LocalConfig

        config = LocalConfig(
            model_name="test_ft",
            steps=100,
            export={"output_dir": str(tmp_path / "out"), "threshold": 0.5},
        )

        recorded_dir = tmp_path / "recorded"
        recorded_dir.mkdir()

        lk["run_export"].return_value = str(tmp_path / "out" / "test_ft.onnx")

        result = fine_tune(config, recorded_dir)

        lk["run_augment"].assert_called_once()
        # Verify extra_data_dir is passed
        aug_kwargs = lk["run_augment"].call_args
        assert str(recorded_dir) in str(aug_kwargs)

        lk["run_train"].assert_called_once()
        lk["run_export"].assert_called_once()
