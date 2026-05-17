"""Tests for recording, validation, and fine-tuning.

sounddevice and soundfile are mocked so no real microphone is used.
livekit.wakeword.WakeWordModel is mocked so no real ONNX inference happens.

Covers:
- record_samples: file creation, count, format
- validate_recordings: all detected, none detected, detection_rate
- fine_tune: augment + export flow
"""
from pathlib import Path
from unittest.mock import MagicMock, patch

import numpy as np
import pytest

from wakeword_trainer.record import (
    DEFAULT_SAMPLE_RATE,
    FRAME_SIZE,
    fine_tune,
    record_samples,
    validate_recordings,
)


# ---------------------------------------------------------------------------
# record_samples tests
# ---------------------------------------------------------------------------

class TestRecordSamples:
    """Tests for ``record_samples``."""

    def test_record_samples_creates_files(
        self, tmp_path, mock_sounddevice, mock_soundfile
    ):
        """Recording produces the expected number of WAV files."""
        num = 3
        out_dir = str(tmp_path / "rec")

        # Patch interactive prompts: input() + _prompt_yes_no
        with patch("wakeword_trainer.record.input", return_value=""), \
             patch("wakeword_trainer.record._prompt_yes_no", return_value=False), \
             patch("wakeword_trainer.record.time.sleep"):
            files = record_samples(
                num_samples=num,
                output_dir=out_dir,
                phrase="test",
            )

        assert len(files) == num
        # sf.write should have been called once per sample
        assert mock_soundfile["write"].call_count == num

    def test_record_samples_correct_format(
        self, tmp_path, mock_sounddevice, mock_soundfile
    ):
        """sd.rec is called with 16 kHz, mono, int16."""
        with patch("wakeword_trainer.record.input", return_value=""), \
             patch("wakeword_trainer.record._prompt_yes_no", return_value=False), \
             patch("wakeword_trainer.record.time.sleep"):
            record_samples(
                num_samples=1,
                output_dir=str(tmp_path / "rec"),
                phrase="test",
            )

        rec_call = mock_sounddevice["rec"]
        rec_call.assert_called_once()
        kwargs = rec_call.call_args.kwargs
        # Check expected audio format
        assert kwargs["samplerate"] == DEFAULT_SAMPLE_RATE
        assert kwargs["channels"] == 1
        assert kwargs["dtype"] == "int16"

    def test_record_samples_creates_output_dir(
        self, tmp_path, mock_sounddevice, mock_soundfile
    ):
        """Output directory is created if it does not exist."""
        out = tmp_path / "deep" / "nested" / "dir"
        assert not out.exists()

        with patch("wakeword_trainer.record.input", return_value=""), \
             patch("wakeword_trainer.record._prompt_yes_no", return_value=False), \
             patch("wakeword_trainer.record.time.sleep"):
            record_samples(num_samples=1, output_dir=str(out), phrase="test")

        assert out.is_dir()

    def test_record_samples_wait_called(
        self, tmp_path, mock_sounddevice, mock_soundfile
    ):
        """sd.wait() is called after each recording to block until done."""
        n = 4
        with patch("wakeword_trainer.record.input", return_value=""), \
             patch("wakeword_trainer.record._prompt_yes_no", return_value=False), \
             patch("wakeword_trainer.record.time.sleep"):
            record_samples(
                num_samples=n,
                output_dir=str(tmp_path / "rec"),
                phrase="test",
            )

        # _do_recording calls sd.wait once per sample
        assert mock_sounddevice["wait"].call_count == n

    def test_record_samples_file_naming(
        self, tmp_path, mock_sounddevice, mock_soundfile
    ):
        """Files are named using the phrase, e.g. 'test_1.wav', 'test_2.wav'."""
        with patch("wakeword_trainer.record.input", return_value=""), \
             patch("wakeword_trainer.record._prompt_yes_no", return_value=False), \
             patch("wakeword_trainer.record.time.sleep"):
            files = record_samples(
                num_samples=2,
                output_dir=str(tmp_path / "rec"),
                phrase="test",
            )

        names = sorted(f.name for f in files)
        assert names == ["test_1.wav", "test_2.wav"]


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
        self, tmp_path, mock_model_path, mock_wakeword_model, mock_soundfile
    ):
        """When all frame scores exceed the threshold, detection_rate == 1.0."""
        mock_wakeword_model["instance"].predict.return_value = {
            "ni_hao_wei_ben": 0.95
        }
        paths = self._sample_paths(tmp_path, count=5)

        result = validate_recordings(
            recordings=paths,
            model_path=mock_model_path,
            threshold=0.5,
        )

        assert result["detection_rate"] == 1.0
        assert all(r["detected"] for r in result["results"])
        assert len(result["results"]) == 5

    def test_validate_recordings_none_detected(
        self, tmp_path, mock_model_path, mock_wakeword_model, mock_soundfile
    ):
        """When all frame scores are below threshold, detection_rate == 0.0."""
        mock_wakeword_model["instance"].predict.return_value = {
            "ni_hao_wei_ben": 0.1
        }
        paths = self._sample_paths(tmp_path, count=4)

        result = validate_recordings(
            recordings=paths,
            model_path=mock_model_path,
            threshold=0.5,
        )

        assert result["detection_rate"] == 0.0
        assert not any(r["detected"] for r in result["results"])

    def test_validate_recordings_detection_rate(
        self, tmp_path, mock_model_path, mock_wakeword_model, mock_soundfile
    ):
        """Detection rate is correctly computed for a mixed set of scores."""
        # Generate audio that has multiple frames so _score_audio iterates.
        # With DEFAULT_SAMPLE_RATE=16000, 3s audio = 48000 samples,
        # FRAME_SIZE=1280, so ~37 frames per recording.
        # We return different max scores per recording by controlling
        # the predict return value per call group.

        # For simplicity: 5 recordings.  We make predict return high score
        # for recordings 0,1,3 and low score for recordings 2,4.
        high = {"ni_hao_wei_ben": 0.9}
        low = {"ni_hao_wei_ben": 0.2}

        # sf.read returns 48000 samples at 16kHz -> 37 frames
        frames_per_recording = 48000 // FRAME_SIZE  # 37

        side_effects = []
        for score_dict in [high, high, low, high, low]:
            side_effects.extend([score_dict] * frames_per_recording)

        mock_wakeword_model["instance"].predict.side_effect = side_effects
        paths = self._sample_paths(tmp_path, count=5)

        result = validate_recordings(
            recordings=paths,
            model_path=mock_model_path,
            threshold=0.5,
        )

        expected_rate = 3.0 / 5.0
        assert result["detection_rate"] == pytest.approx(expected_rate)
        detected_flags = [r["detected"] for r in result["results"]]
        assert detected_flags == [True, True, False, True, False]

    def test_validate_recordings_model_constructed_correctly(
        self, tmp_path, mock_model_path, mock_wakeword_model, mock_soundfile
    ):
        """WakeWordModel is instantiated with the models keyword argument."""
        paths = self._sample_paths(tmp_path, count=1)

        validate_recordings(
            recordings=paths,
            model_path=mock_model_path,
        )

        mock_wakeword_model["cls"].assert_called_once_with(
            models=[str(mock_model_path)]
        )


# ---------------------------------------------------------------------------
# fine_tune tests
# ---------------------------------------------------------------------------

class TestFineTune:
    """Tests for ``fine_tune``."""

    def test_fine_tune_augments_and_retrains(self, tmp_path, tmp_config):
        """fine_tune performs augmentation, trains, and exports a model."""
        config_path, _ = tmp_config

        # Create dummy recording files
        rec_dir = tmp_path / "recordings"
        rec_dir.mkdir()
        recordings = []
        for i in range(3):
            p = rec_dir / f"sample_{i}.wav"
            p.write_bytes(b"\x00" * 32)
            recordings.append(p)

        # Mock sf.read to return audio data for _augment_recordings
        import wakeword_trainer.record as rec_mod
        orig_sf_read = rec_mod.sf.read
        rec_mod.sf.read = MagicMock(
            return_value=(np.random.randn(48000).astype(np.float64), 16000)
        )
        # Mock sf.write
        orig_sf_write = rec_mod.sf.write
        rec_mod.sf.write = MagicMock()

        # Mock the export_onnx_model that fine_tune imports from .export
        with patch(
            "wakeword_trainer.export.export_onnx_model",
            create=True,
        ) as mock_export:
            # fine_tune does a lazy import: from .export import export_onnx_model
            # We need to patch it where it's used
            with patch(
                "wakeword_trainer.record.export_onnx_model",
                create=True,
            ):
                result = fine_tune(
                    recordings=recordings,
                    config_path=str(config_path),
                )

        # Restore
        rec_mod.sf.read = orig_sf_read
        rec_mod.sf.write = orig_sf_write

        assert isinstance(result, Path)
        assert "finetuned" in result.name
