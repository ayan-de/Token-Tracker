mod backend;

use tauri::tray::{TrayIconBuilder, TrayIconEvent};
use tauri::Manager;

#[tauri::command]
fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
}

#[tauri::command]
fn get_backend_port(app: tauri::AppHandle) -> u16 {
    app.try_state::<backend::BackendState>()
        .map(|s| s.port)
        .unwrap_or(backend::DEFAULT_PORT)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // Start the backend HTTP server
            if let Err(e) = backend::start_backend(app) {
                eprintln!("Error starting backend: {}", e);
            }

            // Window setup
            if let Some(window) = app.get_webview_window("main") {
                let _ = window;
            }

            // Tray setup
            let icon = app.default_window_icon().cloned();
            let mut tray_builder = TrayIconBuilder::new();
            if let Some(icon) = icon {
                tray_builder = tray_builder.icon(icon);
            }

            let _tray = tray_builder
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click { button: _, .. } = event {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let is_visible = window.is_visible().unwrap_or(false);
                            if is_visible {
                                let _ = window.hide();
                            } else {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![quit_app, get_backend_port])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            if let tauri::RunEvent::Exit = event {
                backend::stop_backend(app_handle);
            }
        });
}
