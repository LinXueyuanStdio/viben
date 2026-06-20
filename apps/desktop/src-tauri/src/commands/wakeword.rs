use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use livekit_wakeword::WakeWordModel;
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, Runtime, State};
use tokio::sync::Mutex;

const TARGET_AUDIO_SECONDS: usize = 2;
const PREDICTION_INTERVAL_MS: u32 = 250;

#[derive(Debug, Clone, Serialize)]
pub struct WakeWordDetectionEvent {
    pub keyword: String,
    pub score: f32,
}

#[derive(Debug, Clone, Serialize)]
pub struct WakeWordScoreEvent {
    pub keyword: String,
    pub score: f32,
    pub threshold: f32,
    pub above_threshold: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct WakeWordStatus {
    pub state: String,
    pub error: Option<String>,
}

pub struct WakeWordState {
    running: Arc<AtomicBool>,
    active: Mutex<bool>,
}

impl Default for WakeWordState {
    fn default() -> Self {
        Self {
            running: Arc::new(AtomicBool::new(false)),
            active: Mutex::new(false),
        }
    }
}

fn resolve_model_path<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    let resource_path = app
        .path()
        .resolve("resources/ni_hao_wei_ben.onnx", tauri::path::BaseDirectory::Resource)
        .map_err(|e| format!("Failed to resolve model path: {}", e))?;

    if resource_path.exists() {
        return Ok(resource_path);
    }

    // Dev mode fallback: model relative to src-tauri
    let dev_path = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("resources/ni_hao_wei_ben.onnx");
    if dev_path.exists() {
        return Ok(dev_path);
    }

    Err(format!(
        "Wake word model not found at {:?} or {:?}",
        resource_path, dev_path
    ))
}

fn chunk_samples_for_rate(sample_rate: u32) -> usize {
    sample_rate as usize * TARGET_AUDIO_SECONDS
}

fn prediction_step_samples_for_rate(sample_rate: u32) -> usize {
    (sample_rate as usize * PREDICTION_INTERVAL_MS as usize) / 1000
}

fn trim_buffer_to_recent_window(buffer: &mut Vec<i16>, window_samples: usize) {
    if buffer.len() <= window_samples {
        return;
    }
    let excess = buffer.len() - window_samples;
    buffer.drain(..excess);
}

fn f32_to_i16(sample: f32) -> i16 {
    let clamped = sample.clamp(-1.0, 1.0);
    (clamped * i16::MAX as f32) as i16
}

fn interleaved_f32_to_mono_i16(data: &[f32], channels: usize) -> Vec<i16> {
    let channels = channels.max(1);
    data.chunks(channels)
        .map(|frame| {
            let sum: f32 = frame.iter().copied().sum();
            f32_to_i16(sum / frame.len() as f32)
        })
        .collect()
}

fn interleaved_i16_to_mono_i16(data: &[i16], channels: usize) -> Vec<i16> {
    let channels = channels.max(1);
    data.chunks(channels)
        .map(|frame| {
            let sum: i32 = frame.iter().map(|sample| *sample as i32).sum();
            (sum / frame.len() as i32) as i16
        })
        .collect()
}

fn interleaved_u16_to_mono_i16(data: &[u16], channels: usize) -> Vec<i16> {
    let channels = channels.max(1);
    data.chunks(channels)
        .map(|frame| {
            let sum: i32 = frame
                .iter()
                .map(|sample| *sample as i32 - i16::MAX as i32 - 1)
                .sum();
            (sum / frame.len() as i32) as i16
        })
        .collect()
}

#[tauri::command]
pub async fn start_wakeword<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, WakeWordState>,
    threshold: Option<f32>,
) -> Result<(), String> {
    let mut active = state.active.lock().await;
    if *active {
        return Ok(());
    }

    let threshold = threshold.unwrap_or(0.5);
    let model_path = resolve_model_path(&app)?;

    state.running.store(true, Ordering::SeqCst);
    let running = state.running.clone();
    let (startup_tx, startup_rx) = std::sync::mpsc::sync_channel::<Result<(), String>>(1);

    // Spawn the entire audio capture + prediction on a dedicated thread
    // because cpal::Stream is !Send and must stay on its creating thread
    std::thread::spawn(move || {
        let fail_startup = |message: String| {
            eprintln!("[WakeWord] {}", message);
            running.store(false, Ordering::SeqCst);
            let _ = startup_tx.try_send(Err(message));
        };

        let host = cpal::default_host();
        let device = match host.default_input_device() {
            Some(d) => d,
            None => {
                fail_startup("No audio input device found".to_string());
                return;
            }
        };

        let supported_config = match device.default_input_config() {
            Ok(config) => config,
            Err(e) => {
                fail_startup(format!("Failed to get default input config: {}", e));
                return;
            }
        };
        let sample_format = supported_config.sample_format();
        let config = supported_config.config();
        let sample_rate = config.sample_rate.0;
        let channels = usize::from(config.channels);
        let chunk_samples = chunk_samples_for_rate(sample_rate);
        let prediction_step_samples = prediction_step_samples_for_rate(sample_rate);

        let (tx, rx) = std::sync::mpsc::sync_channel::<Vec<i16>>(64);

        let stream = match sample_format {
            cpal::SampleFormat::F32 => {
                let tx = tx.clone();
                let running_for_stream = running.clone();
                device.build_input_stream(
                    &config,
                    move |data: &[f32], _: &cpal::InputCallbackInfo| {
                        if !running_for_stream.load(Ordering::Relaxed) {
                            return;
                        }
                        let samples = interleaved_f32_to_mono_i16(data, channels);
                        let _ = tx.try_send(samples);
                    },
                    |err| {
                        eprintln!("[WakeWord] Audio stream error: {}", err);
                    },
                    None,
                )
            }
            cpal::SampleFormat::I16 => {
                let tx = tx.clone();
                let running_for_stream = running.clone();
                device.build_input_stream(
                    &config,
                    move |data: &[i16], _: &cpal::InputCallbackInfo| {
                        if !running_for_stream.load(Ordering::Relaxed) {
                            return;
                        }
                        let samples = interleaved_i16_to_mono_i16(data, channels);
                        let _ = tx.try_send(samples);
                    },
                    |err| {
                        eprintln!("[WakeWord] Audio stream error: {}", err);
                    },
                    None,
                )
            }
            cpal::SampleFormat::U16 => {
                let tx = tx.clone();
                let running_for_stream = running.clone();
                device.build_input_stream(
                    &config,
                    move |data: &[u16], _: &cpal::InputCallbackInfo| {
                        if !running_for_stream.load(Ordering::Relaxed) {
                            return;
                        }
                        let samples = interleaved_u16_to_mono_i16(data, channels);
                        let _ = tx.try_send(samples);
                    },
                    |err| {
                        eprintln!("[WakeWord] Audio stream error: {}", err);
                    },
                    None,
                )
            }
            other => {
                fail_startup(format!("Unsupported input sample format: {:?}", other));
                return;
            }
        };

        let stream = match stream {
            Ok(s) => s,
            Err(e) => {
                fail_startup(format!("Failed to build audio stream: {}", e));
                return;
            }
        };

        if let Err(e) = stream.play() {
            fail_startup(format!("Failed to start audio stream: {}", e));
            return;
        }

        // Load model
        let mut model = match WakeWordModel::new(&[&model_path], sample_rate) {
            Ok(m) => m,
            Err(e) => {
                fail_startup(format!("Failed to load model: {}", e));
                return;
            }
        };

        eprintln!(
            "[WakeWord] Listening with {:?}, {} Hz, {} channel(s)",
            sample_format, sample_rate, channels
        );
        let _ = startup_tx.try_send(Ok(()));

        let mut buffer: Vec<i16> = Vec::with_capacity(chunk_samples);
        let mut samples_since_prediction = 0usize;

        while running.load(Ordering::Relaxed) {
            match rx.recv_timeout(std::time::Duration::from_millis(100)) {
                Ok(samples) => {
                    samples_since_prediction += samples.len();
                    buffer.extend_from_slice(&samples);
                    trim_buffer_to_recent_window(&mut buffer, chunk_samples);

                    if buffer.len() >= chunk_samples
                        && samples_since_prediction >= prediction_step_samples
                    {
                        samples_since_prediction = 0;
                        match model.predict(&buffer) {
                            Ok(scores) => {
                                for (keyword, score) in &scores {
                                    if *score >= threshold {
                                        eprintln!("[WakeWord] 🔔 Detected '{}' (score: {:.4})", keyword, score);
                                        let _ = app.emit(
                                            "wakeword-detected",
                                            WakeWordDetectionEvent {
                                                keyword: keyword.clone(),
                                                score: *score,
                                            },
                                        );
                                    } else if *score > 0.1 {
                                        eprintln!("[WakeWord] 📊 keyword=\"{}\" score={:.4} (below threshold {:.2})", keyword, score, threshold);
                                    }
                                    let _ = app.emit(
                                        "wakeword-score",
                                        WakeWordScoreEvent {
                                            keyword: keyword.clone(),
                                            score: *score,
                                            threshold,
                                            above_threshold: *score >= threshold,
                                        },
                                    );
                                }
                            }
                            Err(e) => {
                                eprintln!("[WakeWord] Prediction error: {}", e);
                            }
                        }
                    }
                }
                Err(std::sync::mpsc::RecvTimeoutError::Timeout) => continue,
                Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => break,
            }
        }

        drop(stream);
        eprintln!("[WakeWord] Stopped");
    });

    match startup_rx.recv_timeout(std::time::Duration::from_secs(5)) {
        Ok(Ok(())) => {
            *active = true;
            Ok(())
        }
        Ok(Err(message)) => {
            state.running.store(false, Ordering::SeqCst);
            Err(message)
        }
        Err(_) => {
            state.running.store(false, Ordering::SeqCst);
            Err("Timed out while starting wake word listener".to_string())
        }
    }
}

#[tauri::command]
pub async fn stop_wakeword(state: State<'_, WakeWordState>) -> Result<(), String> {
    let mut active = state.active.lock().await;
    state.running.store(false, Ordering::SeqCst);
    *active = false;
    Ok(())
}

#[tauri::command]
pub async fn get_wakeword_status(state: State<'_, WakeWordState>) -> Result<WakeWordStatus, String> {
    let active = state.active.lock().await;

    Ok(WakeWordStatus {
        state: if *active { "listening" } else { "inactive" }.to_string(),
        error: None,
    })
}

#[cfg(test)]
mod tests {
    use super::{
        chunk_samples_for_rate, interleaved_f32_to_mono_i16, prediction_step_samples_for_rate,
        trim_buffer_to_recent_window,
    };

    #[test]
    fn chunk_samples_tracks_two_seconds_at_input_rate() {
        assert_eq!(chunk_samples_for_rate(16_000), 32_000);
        assert_eq!(chunk_samples_for_rate(48_000), 96_000);
    }

    #[test]
    fn prediction_step_tracks_quarter_second_at_input_rate() {
        assert_eq!(prediction_step_samples_for_rate(16_000), 4_000);
        assert_eq!(prediction_step_samples_for_rate(48_000), 12_000);
    }

    #[test]
    fn trim_buffer_keeps_recent_audio_for_sliding_predictions() {
        let mut buffer = vec![1, 2, 3, 4, 5, 6];

        trim_buffer_to_recent_window(&mut buffer, 4);

        assert_eq!(buffer, vec![3, 4, 5, 6]);
    }

    #[test]
    fn interleaved_f32_to_mono_i16_averages_channels_and_clamps() {
        let samples = interleaved_f32_to_mono_i16(&[1.25, -1.25, 0.5, -0.25], 2);

        assert_eq!(samples, vec![0, 4095]);
    }

    #[test]
    fn interleaved_f32_to_mono_i16_handles_zero_channels_as_mono() {
        let samples = interleaved_f32_to_mono_i16(&[0.5, -0.5], 0);

        assert_eq!(samples, vec![16383, -16383]);
    }
}
