"""Tests for configuration loading and WakeWordConfig creation."""
from pathlib import Path

import pytest

from livekit.wakeword import WakeWordConfig
from livekit.wakeword.config import ModelConfig, VoxCpmTtsConfig

from wakeword_trainer.train import create_wakeword_config, load_yaml_config


class TestLoadYamlConfig:
    """Tests for ``load_yaml_config``."""

    def test_load_yaml_config(self, tmp_config):
        """Normal load of a valid YAML config returns the expected dict."""
        config_path, expected_data = tmp_config
        result = load_yaml_config(str(config_path))

        assert isinstance(result, dict)
        assert result["model_name"] == expected_data["model_name"]
        assert result["target_phrases"] == expected_data["target_phrases"]
        assert result["steps"] == expected_data["steps"]

    def test_load_yaml_config_real_file(self):
        """Load the real ni_hao_wei_ben.yaml shipped with the project."""
        config_path = (
            Path(__file__).resolve().parent.parent / "configs" / "ni_hao_wei_ben.yaml"
        )
        if not config_path.exists():
            pytest.skip("ni_hao_wei_ben.yaml not present in tree")

        result = load_yaml_config(str(config_path))
        assert result["model_name"] == "ni_hao_wei_ben"
        assert "你好微本" in result["target_phrases"]

    def test_load_config_missing_file(self):
        """FileNotFoundError is raised when the config file does not exist."""
        with pytest.raises(FileNotFoundError, match="Config file not found"):
            load_yaml_config("/nonexistent/path/missing.yaml")


class TestCreateWakeWordConfig:
    """Tests for ``create_wakeword_config``."""

    def test_create_wakeword_config(self, tmp_config):
        """YAML dict is correctly converted into a WakeWordConfig object."""
        _, data = tmp_config
        config = create_wakeword_config(data)

        assert isinstance(config, WakeWordConfig)
        assert config.model_name == data["model_name"]
        assert config.target_phrases == data["target_phrases"]
        assert config.n_samples == data["n_samples"]
        assert config.n_samples_val == data["n_samples_val"]
        assert config.steps == data["steps"]

    def test_config_defaults(self):
        """Unspecified fields fall back to WakeWordConfig defaults."""
        minimal = {"model_name": "tiny", "target_phrases": ["hey tiny"]}
        config = create_wakeword_config(minimal)

        assert config.model_name == "tiny"
        assert config.target_phrases == ["hey tiny"]
        assert config.n_samples > 0
        assert config.steps > 0

    def test_config_voxcpm_backend(self):
        """tts_backend is correctly set to 'voxcpm'."""
        data = {
            "model_name": "zh_wakeword",
            "target_phrases": ["你好"],
            "tts_backend": "voxcpm",
            "n_samples": 500,
            "n_samples_val": 100,
            "steps": 1000,
        }
        config = create_wakeword_config(data)
        assert config.tts_backend.value == "voxcpm"

    def test_config_model_nested(self):
        """Nested model config creates a ModelConfig object."""
        data = {
            "model_name": "test",
            "target_phrases": ["hey test"],
            "model": {
                "model_type": "conv_attention",
                "model_size": "small",
            },
        }
        config = create_wakeword_config(data)
        assert isinstance(config.model, ModelConfig)
        assert config.model.model_type == "conv_attention"
        assert config.model.model_size == "small"

    def test_config_voice_design_prompts(self):
        """voxcpm_tts.voice_design_prompts are passed as VoxCpmTtsConfig."""
        prompts = ["A young woman, bright voice", "A middle-aged man, deep voice"]
        data = {
            "model_name": "test",
            "target_phrases": ["hey test"],
            "tts_backend": "voxcpm",
            "voxcpm_tts": {"voice_design_prompts": prompts},
        }
        config = create_wakeword_config(data)
        assert isinstance(config.voxcpm_tts, VoxCpmTtsConfig)
        assert config.voxcpm_tts.voice_design_prompts == prompts
