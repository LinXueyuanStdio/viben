"""Wake word configuration loading and validation."""
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import yaml


@dataclass
class WakeWordConfig:
    """Configuration for wake word training."""

    model_name: str = "my_wakeword"
    target_phrases: list[str] = field(default_factory=lambda: ["hello"])
    tts_backend: str = "piper"
    n_samples: int = 25000
    n_samples_val: int = 5000
    steps: int = 50000
    target_fp_per_hour: float = 0.2
    model: dict = field(default_factory=lambda: {
        "model_type": "conv_attention",
        "model_size": "small",
    })
    voxcpm_tts: Optional[dict] = None
    export: dict = field(default_factory=lambda: {
        "output_dir": "models",
        "threshold": 0.5,
    })


def load_yaml_config(config_path: str | Path) -> dict:
    """Load a YAML configuration file and return raw dict."""
    path = Path(config_path)
    if not path.exists():
        raise FileNotFoundError(f"Config file not found: {path}")
    with open(path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def create_wakeword_config(data: dict) -> WakeWordConfig:
    """Create a WakeWordConfig from a raw YAML dict.

    Only known fields are passed to the dataclass; unknown keys are ignored.
    """
    known_fields = {f.name for f in WakeWordConfig.__dataclass_fields__.values()}
    filtered = {k: v for k, v in data.items() if k in known_fields}
    return WakeWordConfig(**filtered)
