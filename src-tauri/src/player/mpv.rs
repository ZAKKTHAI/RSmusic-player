use serde::Serialize;
use serde_json::{Value, json};
use std::{
    fs,
    io::{BufRead, BufReader, Write},
    os::unix::net::UnixStream,
    path::Path,
    process::{Child, Command, Stdio},
    sync::Mutex,
    thread,
    time::Duration,
};

const SOCKET: &str = "/tmp/rsmusic-player-mpv.sock";

#[derive(Default)]
pub struct MpvState {
    child: Mutex<Option<Child>>,
}

impl MpvState {
    pub fn shutdown(&self) {
        if let Ok(mut child_guard) = self.child.lock() {
            if let Some(mut child) = child_guard.take() {
                let _ = child.kill();
                let _ = child.wait();
            }
        }

        let _ = fs::remove_file(SOCKET);
    }
}

impl Drop for MpvState {
    fn drop(&mut self) {
        self.shutdown();
    }
}

#[derive(Serialize)]
pub struct MpvStatus {
    pub playing: bool,
    pub paused: bool,
    pub title: Option<String>,
    pub position: Option<f64>,
    pub duration: Option<f64>,
    pub volume: Option<f64>,
}

fn ipc(command: Value) -> Result<Value, String> {
    let mut stream =
        UnixStream::connect(SOCKET).map_err(|e| format!("mpv IPC connection failed: {e}"))?;

    stream
        .set_read_timeout(Some(Duration::from_secs(3)))
        .map_err(|e| e.to_string())?;

    writeln!(stream, "{}", command).map_err(|e| e.to_string())?;

    let mut reader = BufReader::new(stream);
    let mut response = String::new();

    reader.read_line(&mut response).map_err(|e| e.to_string())?;

    let value: Value = serde_json::from_str(&response).map_err(|e| e.to_string())?;

    if value["error"] != "success" {
        return Err(format!("mpv error: {}", value["error"]));
    }

    Ok(value)
}

fn get_property(property: &str) -> Option<Value> {
    ipc(json!({
        "command": ["get_property", property]
    }))
    .ok()
    .and_then(|v| v.get("data").cloned())
}

#[tauri::command]
pub fn mpv_start(state: tauri::State<'_, MpvState>) -> Result<String, String> {
    let mut child_guard = state.child.lock().map_err(|e| e.to_string())?;

    if let Some(child) = child_guard.as_mut() {
        if child.try_wait().map_err(|e| e.to_string())?.is_none() {
            return Ok("mpv already running".into());
        }
    }

    let _ = fs::remove_file(SOCKET);

    let child = Command::new("mpv")
        .args([
            "--idle=yes",
            "--no-video",
            "--no-terminal",
            &format!("--input-ipc-server={SOCKET}"),
        ])
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| format!("Failed to start mpv: {e}"))?;

    *child_guard = Some(child);

    for _ in 0..50 {
        if Path::new(SOCKET).exists() {
            return Ok("mpv started".into());
        }
        thread::sleep(Duration::from_millis(100));
    }

    Err("mpv IPC socket startup timed out".into())
}

#[tauri::command]
pub fn mpv_play(url: String) -> Result<(), String> {
    ipc(json!({
        "command": ["loadfile", url, "replace"]
    }))?;
    Ok(())
}

#[tauri::command]
pub fn mpv_pause() -> Result<(), String> {
    ipc(json!({
        "command": ["set_property", "pause", true]
    }))?;
    Ok(())
}

#[tauri::command]
pub fn mpv_resume() -> Result<(), String> {
    ipc(json!({
        "command": ["set_property", "pause", false]
    }))?;
    Ok(())
}

#[tauri::command]
pub fn mpv_stop() -> Result<(), String> {
    ipc(json!({
        "command": ["stop"]
    }))?;
    Ok(())
}

#[tauri::command]
pub fn mpv_get_status() -> Result<MpvStatus, String> {
    let paused = get_property("pause")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);

    let title = get_property("media-title").and_then(|v| v.as_str().map(String::from));

    Ok(MpvStatus {
        playing: get_property("idle-active")
            .and_then(|v| v.as_bool())
            .map(|idle| !idle)
            .unwrap_or(false),
        paused,
        title,
        position: get_property("time-pos").and_then(|v| v.as_f64()),
        duration: get_property("duration").and_then(|v| v.as_f64()),
        volume: get_property("volume").and_then(|v| v.as_f64()),
    })
}
