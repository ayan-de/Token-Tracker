use std::process::Command;
use tauri::tray::{TrayIconBuilder, TrayIconEvent};
use tauri::Manager;

const CODEXBAR_BIN: &str = "/home/ayan-de/.local/bin/CodexBarCLI";

#[tauri::command]
fn run_codexbar_command(args: Vec<String>) -> Result<String, String> {
    let output = Command::new(CODEXBAR_BIN)
        .args(&args)
        .output();

    match output {
        Ok(out) => {
            let stdout = String::from_utf8_lossy(&out.stdout).to_string();
            let stderr = String::from_utf8_lossy(&out.stderr).to_string();
            if out.status.success() {
                Ok(stdout)
            } else {
                Err(format!("Error: {}\n{}", stderr, stdout))
            }
        }
        Err(e) => Err(format!("Failed to execute codexbar command: {}", e)),
    }
}

#[tauri::command]
fn get_cli_status() -> Result<serde_json::Value, String> {
    match Command::new(CODEXBAR_BIN)
        .arg("--version")
        .output()
    {
        Ok(output) => {
            if output.status.success() {
                Ok(serde_json::json!({"status": "available"}))
            } else {
                Ok(serde_json::json!({"status": "demo"}))
            }
        }
        Err(_) => Ok(serde_json::json!({"status": "demo"})),
    }
}

#[tauri::command]
fn get_usage_data() -> Result<serde_json::Value, String> {
    let output = Command::new(CODEXBAR_BIN)
        .args(&["usage", "--json"])
        .output();

    match output {
        Ok(out) => {
            if out.status.success() {
                let stdout = String::from_utf8_lossy(&out.stdout);
                serde_json::from_str(&stdout)
                    .map_err(|e| format!("Failed to parse usage JSON: {}", e))
            } else {
                let stderr = String::from_utf8_lossy(&out.stderr);
                Err(format!("CLI Error: {}", stderr))
            }
        }
        Err(e) => Err(format!("cli_not_found: {}", e)),
    }
}

#[tauri::command]
fn get_cost_data() -> Result<serde_json::Value, String> {
    let output = Command::new(CODEXBAR_BIN)
        .args(&["cost", "--json"])
        .output();

    match output {
        Ok(out) => {
            if out.status.success() {
                let stdout = String::from_utf8_lossy(&out.stdout);
                serde_json::from_str(&stdout)
                    .map_err(|e| format!("Failed to parse cost JSON: {}", e))
            } else {
                let stderr = String::from_utf8_lossy(&out.stderr);
                Err(format!("CLI Error: {}", stderr))
            }
        }
        Err(e) => Err(format!("cli_not_found: {}", e)),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // Get the main window and register focus loss listener to auto-hide it
            if let Some(window) = app.get_webview_window("main") {
                // Window stays open - only hide via tray click
                let _ = window;
            }

            // Create tray icon
            let icon = app.default_window_icon().cloned();
            let mut tray_builder = TrayIconBuilder::new();
            if let Some(icon) = icon {
                tray_builder = tray_builder.icon(icon);
            }
            
            let _tray = tray_builder
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click { button: _, .. } = event {
                        // We toggle visibility on click
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
        .invoke_handler(tauri::generate_handler![
            run_codexbar_command, 
            get_cli_status, 
            get_usage_data, 
            get_cost_data
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
