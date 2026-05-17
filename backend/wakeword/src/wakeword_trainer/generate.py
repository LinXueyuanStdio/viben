"""数据生成封装 - 使用 livekit-wakeword 进行 TTS 合成与数据增强"""
import logging

from livekit.wakeword import WakeWordConfig, run_augment, run_extraction, run_generate

logger = logging.getLogger(__name__)


def generate_data(config: WakeWordConfig) -> None:
    """使用 TTS 合成正样本和对抗负样本。

    封装 livekit-wakeword 的 run_generate，根据 config 中的
    target_phrases、n_samples、tts_backend 等配置生成合成语音数据。

    Args:
        config: livekit-wakeword 配置对象。
    """
    logger.info(
        "Generating synthetic data for model '%s' (n_samples=%d)",
        config.model_name,
        config.n_samples,
    )
    run_generate(config)
    logger.info("Data generation complete.")


def augment_data(config: WakeWordConfig) -> None:
    """对生成的数据进行增强和特征提取。

    依次调用 run_augment（噪声注入、速度/音调扰动等）和
    run_extraction（提取梅尔频谱等训练特征）。

    Args:
        config: livekit-wakeword 配置对象。
    """
    logger.info("Augmenting data for model '%s'...", config.model_name)
    run_augment(config)
    logger.info("Augmentation complete. Extracting features...")
    run_extraction(config)
    logger.info("Feature extraction complete.")
