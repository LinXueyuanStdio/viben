use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use livekit_wakeword::WakeWordModel;
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, Runtime, State};
use tokio::sync::Mutex;

const SAMPLE_RATE: u32 = 16000;
const CHUNK_SAMPLES: usize = 32000; // ~2 seconds at 16kHz

#[derive(Debug, Clone, Serialize)]
pub struct WakeWordDetectionEvent {
    pub keyword: String,
    pub score: f32,
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

    // Spawn the entire audio capture + prediction on a dedicated thread
    // because cpal::Stream is !Send and must stay on its creating thread
    std::thread::spawn(move || {
        let host = cpal::default_host();
        let device = match host.default_input_device() {
            Some(d) => d,
            None => {
                eprintln!("[WakeWord] No audio input device found");
                return;
            }
        };

        let config = cpal::StreamConfig {
            channels: 1,
            sample_rate: cpal::SampleRate(SAMPLE_RATE),
            buffer_size: cpal::BufferSize::Default,
        };

        let (tx, rx) = std::sync::mpsc::sync_channel::<Vec<i16>>(64);
        let running_for_stream = running.clone();

        let stream = match device.build_input_stream(
            &config,
            move |data: &[f32], _: &cpal::InputCallbackInfo| {
                if !running_for_stream.load(Ordering::Relaxed) {
                    return;
                }
                let samples: Vec<i16> = data.iter().map(|&s| (s * 32767.0) as i16).collect();
                let _ = tx.try_send(samples);
            },
            |err| {
                eprintln!("[WakeWord] Audio stream error: {}", err);
            },
            None,
        ) {
            Ok(s) => s,
            Err(e) => {
                eprintln!("[WakeWord] Failed to build audio stream: {}", e);
                return;
            }
        };

        if let Err(e) = stream.play() {
            eprintln!("[WakeWord] Failed to start audio stream: {}", e);
            return;
        }

        // Load model
        let mut model = match WakeWordModel::new(&[&model_path], SAMPLE_RATE) {
            Ok(m) => m,
            Err(e) => {
                eprintln!("[WakeWord] Failed to load model: {}", e);
                return;
            }
        };

        eprintln!("[WakeWord] Listening...");

        let mut buffer: Vec<i16> = Vec::with_capacity(CHUNK_SAMPLES);

        while running.load(Ordering::Relaxed) {
            match rx.recv_timeout(std::time::Duration::from_millis(100)) {
                Ok(samples) => {
                    buffer.extend_from_slice(&samples);

                    if buffer.len() >= CHUNK_SAMPLES {
                        match model.predict(&buffer) {
                            Ok(scores) => {
                                for (keyword, score) in &scores {
                                    if *score >= threshold {
                                        eprintln!("[WakeWord] Detected '{}' (score: {:.3})", keyword, score);
                                        let _ = app.emit(
                                            "wakeword-detected",
                                            WakeWordDetectionEvent {
                                                keyword: keyword.clone(),
                                                score: *score,
                                            },
                                        );
                                    }
                                }
                            }
                            Err(e) => {
                                eprintln!("[WakeWord] Prediction error: {}", e);
                            }
                        }
                        buffer.clear();
                    }
                }
                Err(std::sync::mpsc::RecvTimeoutError::Timeout) => continue,
                Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => break,
            }
        }

        drop(stream);
        eprintln!("[WakeWord] Stopped");
    });

    *active = true;
    Ok(())
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
