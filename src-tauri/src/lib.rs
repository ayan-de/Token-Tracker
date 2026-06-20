use tauri::tray::{TrayIconBuilder, TrayIconEvent};
use tauri::Manager;
use tauri::Emitter;
use std::path::{Path, PathBuf};
use std::env;

fn find_cli_path() -> Option<PathBuf> {
    // 1. Check if the environment variable CODEXBAR_BIN is set
    if let Ok(env_path) = env::var("CODEXBAR_BIN") {
        let path = Path::new(&env_path);
        if path.exists() {
            return Some(path.to_path_buf());
        }
    }

    // 2. Check PATH environment variable
    if let Some(paths) = env::var_os("PATH") {
        for path in env::split_paths(&paths) {
            let p1 = path.join("codexbar");
            if p1.exists() && p1.is_file() {
                return Some(p1);
            }
            let p2 = path.join("CodexBarCLI");
            if p2.exists() && p2.is_file() {
                return Some(p2);
            }
        }
    }

    // 3. Check home directory ~/.local/bin/
    if let Some(home_dir) = env::var_os("HOME").map(PathBuf::from) {
        let p1 = home_dir.join(".local").join("bin").join("CodexBarCLI");
        if p1.exists() && p1.is_file() {
            return Some(p1);
        }
        let p2 = home_dir.join(".local").join("bin").join("codexbar");
        if p2.exists() && p2.is_file() {
            return Some(p2);
        }
    }

    // 4. Check absolute standard paths
    let standard_paths = [
        "/usr/local/bin/CodexBarCLI",
        "/usr/local/bin/codexbar",
        "/usr/bin/CodexBarCLI",
        "/usr/bin/codexbar",
    ];
    for &p in &standard_paths {
        let path = Path::new(p);
        if path.exists() && path.is_file() {
            return Some(path.to_path_buf());
        }
    }

    None
}

#[tauri::command]
async fn run_codexbar_command(args: Vec<String>) -> Result<String, String> {
    let cli_path = find_cli_path().ok_or_else(|| "cli_not_found".to_string())?;
    tokio::process::Command::new(cli_path)
        .args(&args)
        .output()
        .await
        .map(|out| {
            let stdout = String::from_utf8_lossy(&out.stdout).to_string();
            let stderr = String::from_utf8_lossy(&out.stderr).to_string();
            if out.status.success() {
                Ok(stdout)
            } else {
                Err(format!("Error: {}\n{}", stderr, stdout))
            }
        })
        .map_err(|e| format!("Failed to execute codexbar command: {}", e))?
}

#[tauri::command]
async fn get_cli_status() -> Result<serde_json::Value, String> {
    let cli_path = match find_cli_path() {
        Some(path) => path,
        None => return Ok(serde_json::json!({"status": "not_installed"})),
    };

    tokio::process::Command::new(cli_path)
        .arg("--version")
        .output()
        .await
        .map(|output| {
            if output.status.success() {
                Ok(serde_json::json!({"status": "available"}))
            } else {
                Ok(serde_json::json!({"status": "demo"}))
            }
        })
        .unwrap_or(Ok(serde_json::json!({"status": "demo"})))
}

fn get_cache_path() -> Option<PathBuf> {
    let home = env::var("HOME").ok()?;
    Some(Path::new(&home).join(".codexbar-desktop").join("cache.json"))
}

fn read_cache() -> Option<serde_json::Value> {
    let path = get_cache_path()?;
    if path.exists() {
        let content = std::fs::read_to_string(&path).ok()?;
        serde_json::from_str(&content).ok()
    } else {
        None
    }
}

fn write_cache(val: &serde_json::Value) -> Result<(), String> {
    let path = get_cache_path().ok_or_else(|| "HOME directory not found".to_string())?;
    if let Some(parent) = path.parent() {
        if !parent.exists() {
            std::fs::create_dir_all(parent).map_err(|e| format!("Failed to create cache directory: {}", e))?;
        }
    }
    let content = serde_json::to_string_pretty(val).map_err(|e| format!("Failed to serialize cache: {}", e))?;
    std::fs::write(&path, content).map_err(|e| format!("Failed to write cache file: {}", e))?;
    Ok(())
}

async fn refresh_and_cache() -> Result<serde_json::Value, String> {
    let cli_path = find_cli_path().ok_or_else(|| "cli_not_found".to_string())?;

    // 1. Run usage command
    let usage_output = tokio::process::Command::new(&cli_path)
        .args(&["usage", "--json"])
        .output()
        .await
        .map_err(|e| format!("Failed to run usage command: {}", e))?;

    let usage_stdout = String::from_utf8_lossy(&usage_output.stdout);
    let usage_json = serde_json::from_str::<serde_json::Value>(&usage_stdout)
        .unwrap_or_else(|_| serde_json::json!([]));

    // 2. Run cost command
    let cost_output = tokio::process::Command::new(&cli_path)
        .args(&["cost", "--json"])
        .output()
        .await
        .map_err(|e| format!("Failed to run cost command: {}", e))?;

    let cost_stdout = String::from_utf8_lossy(&cost_output.stdout);
    let cost_json = serde_json::from_str::<serde_json::Value>(&cost_stdout)
        .unwrap_or_else(|_| serde_json::json!([]));

    // Prepare full payload
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);

    let payload = serde_json::json!({
        "usage": usage_json,
        "cost": cost_json,
        "timestamp": timestamp
    });

    // Write to cache file
    write_cache(&payload)?;

    Ok(payload)
}

#[tauri::command]
async fn trigger_refresh(app: tauri::AppHandle) -> Result<(), String> {
    tokio::spawn(async move {
        match refresh_and_cache().await {
            Ok(payload) => {
                let _ = app.emit("data-synced", payload);
            }
            Err(e) => {
                let _ = app.emit("sync-error", e);
            }
        }
    });
    Ok(())
}

#[tauri::command]
async fn get_usage_data() -> Result<serde_json::Value, String> {
    if let Some(cache) = read_cache() {
        if let Some(usage) = cache.get("usage") {
            if !usage.is_null() {
                return Ok(usage.clone());
            }
        }
    }
    Ok(serde_json::json!([]))
}

#[tauri::command]
async fn get_cost_data() -> Result<serde_json::Value, String> {
    if let Some(cache) = read_cache() {
        if let Some(cost) = cache.get("cost") {
            if !cost.is_null() {
                return Ok(cost.clone());
            }
        }
    }
    Ok(serde_json::json!([]))
}

#[tauri::command]
async fn install_cli(app: tauri::AppHandle) -> Result<String, String> {
    let _ = app.emit("install-progress", "Starting installation...");

    let home = match env::var("HOME") {
        Ok(h) => h,
        Err(_) => return Err("HOME environment variable not set".to_string()),
    };
    let bin_dir = Path::new(&home).join(".local").join("bin");

    if !bin_dir.exists() {
        let _ = app.emit("install-progress", "Creating directory ~/.local/bin...");
        std::fs::create_dir_all(&bin_dir)
            .map_err(|e| format!("Failed to create directory ~/.local/bin: {}", e))?;
    }

    let arch = match std::env::consts::ARCH {
        "x86_64" => "x86_64",
        "aarch64" => "aarch64",
        _ => return Err(format!("Unsupported architecture: {}", std::env::consts::ARCH)),
    };

    let _ = app.emit("install-progress", "Fetching latest version tag from GitHub...");

    let version_output = tokio::process::Command::new("curl")
        .args(&["-s", "https://api.github.com/repos/steipete/CodexBar/releases/latest"])
        .output()
        .await;

    let mut version = "v0.46.0".to_string();
    if let Ok(out) = version_output {
        if out.status.success() {
            let stdout = String::from_utf8_lossy(&out.stdout);
            if let Some(pos) = stdout.find("\"tag_name\"") {
                let sub = &stdout[pos..];
                if let Some(start) = sub.find(':') {
                    let val_sub = &sub[start+1..];
                    if let Some(quote1) = val_sub.find('"') {
                        let tag_sub = &val_sub[quote1+1..];
                        if let Some(quote2) = tag_sub.find('"') {
                            version = tag_sub[..quote2].to_string();
                        }
                    }
                }
            }
        }
    }

    let _ = app.emit("install-progress", format!("Selected version: {}. Downloading...", version));

    let tarball = format!("CodexBarCLI-{}-linux-{}.tar.gz", version, arch);
    let url = format!(
        "https://github.com/steipete/CodexBar/releases/download/{}/{}",
        version, tarball
    );

    let temp_dir = std::env::temp_dir().join("codexbar_install");
    if temp_dir.exists() {
        let _ = std::fs::remove_dir_all(&temp_dir);
    }
    std::fs::create_dir_all(&temp_dir)
        .map_err(|e| format!("Failed to create temp directory: {}", e))?;

    let dest_tarball = temp_dir.join(&tarball);

    let download_status = tokio::process::Command::new("curl")
        .args(&["-L", "-f", "-o", dest_tarball.to_str().unwrap(), &url])
        .status()
        .await;

    let success = match download_status {
        Ok(status) => status.success(),
        Err(_) => false,
    };

    if !success {
        let _ = app.emit("install-progress", "curl failed. Retrying with wget...");
        let wget_status = tokio::process::Command::new("wget")
            .args(&["-O", dest_tarball.to_str().unwrap(), &url])
            .status()
            .await;
        let wget_success = match wget_status {
            Ok(status) => status.success(),
            Err(_) => false,
        };
        if !wget_success {
            let _ = std::fs::remove_dir_all(&temp_dir);
            return Err("Failed to download CodexBar CLI with both curl and wget.".to_string());
        }
    }

    let _ = app.emit("install-progress", "Download complete. Extracting tarball...");

    let tar_status = tokio::process::Command::new("tar")
        .args(&["-xzf", dest_tarball.to_str().unwrap(), "-C", temp_dir.to_str().unwrap()])
        .status()
        .await;

    let tar_success = match tar_status {
        Ok(status) => status.success(),
        Err(_) => false,
    };

    if !tar_success {
        let _ = std::fs::remove_dir_all(&temp_dir);
        return Err("Failed to extract tarball.".to_string());
    }

    let cli_bin_name = "CodexBarCLI";
    let extracted_bin = temp_dir.join(cli_bin_name);
    let target_bin = bin_dir.join(cli_bin_name);

    if extracted_bin.exists() {
        std::fs::copy(&extracted_bin, &target_bin)
            .map_err(|e| format!("Failed to copy binary: {}", e))?;
    } else {
        let mut found = false;
        if let Ok(entries) = std::fs::read_dir(&temp_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_file() && path.file_name().unwrap() == cli_bin_name {
                    std::fs::copy(&path, &target_bin)
                        .map_err(|e| format!("Failed to copy binary: {}", e))?;
                    found = true;
                    break;
                }
            }
        }
        if !found {
            let _ = std::fs::remove_dir_all(&temp_dir);
            return Err("CodexBarCLI binary not found in extracted files.".to_string());
        }
    }

    let _ = app.emit("install-progress", "Setting executable permissions...");

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = std::fs::metadata(&target_bin)
            .map_err(|e| format!("Failed to read metadata: {}", e))?
            .permissions();
        perms.set_mode(0o755);
        std::fs::set_permissions(&target_bin, perms)
            .map_err(|e| format!("Failed to set permissions: {}", e))?;
    }

    let _ = app.emit("install-progress", "Creating symlink to codexbar...");
    let symlink_path = bin_dir.join("codexbar");
    if symlink_path.exists() {
        let _ = std::fs::remove_file(&symlink_path);
    }
    #[cfg(unix)]
    {
        std::os::unix::fs::symlink(cli_bin_name, &symlink_path)
            .map_err(|e| format!("Failed to create symlink: {}", e))?;
    }

    let _ = std::fs::remove_dir_all(&temp_dir);
    let _ = app.emit("install-progress", "Installation complete!");

    Ok("Successfully installed CodexBar CLI".to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window;
            }

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
        .invoke_handler(tauri::generate_handler![
            run_codexbar_command, 
            get_cli_status, 
            get_usage_data, 
            get_cost_data,
            install_cli,
            trigger_refresh
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

