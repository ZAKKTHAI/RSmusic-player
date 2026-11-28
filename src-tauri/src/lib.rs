mod player;
use tauri::Manager;

use player::{MpvState, mpv_get_status, mpv_pause, mpv_play, mpv_resume, mpv_start, mpv_stop};

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(MpvState::default())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            mpv_start,
            mpv_play,
            mpv_pause,
            mpv_resume,
            mpv_stop,
            mpv_get_status
        ])
        .on_window_event(|window, event| {
            if matches!(event, tauri::WindowEvent::CloseRequested { .. }) {
                window.state::<MpvState>().shutdown();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
