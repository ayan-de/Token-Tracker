use std::collections::HashSet;
use std::env;
use std::path::{Path, PathBuf};
use tauri::tray::{TrayIconBuilder, TrayIconEvent};
use tauri::Emitter;
use tauri::Manager;

fn get_home_dir() -> Option<PathBuf> {
    env::var_os("HOME")
        .or_else(|| env::var_os("USERPROFILE"))
        .map(PathBuf::from)
}

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
            let names = if cfg!(windows) {
                vec!["codexbar.exe", "CodexBarCLI.exe"]
            } else {
                vec!["codexbar", "CodexBarCLI"]
            };
            for name in names {
                let p = path.join(name);
                if p.exists() && p.is_file() {
                    return Some(p);
                }
            }
        }
    }

    // 3. Check home directory ~/.local/bin/
    if let Some(home_dir) = get_home_dir() {
        let names = if cfg!(windows) {
            vec!["CodexBarCLI.exe", "codexbar.exe"]
        } else {
            vec!["CodexBarCLI", "codexbar"]
        };
        for name in names {
            let p = home_dir.join(".local").join("bin").join(name);
            if p.exists() && p.is_file() {
                return Some(p);
            }
        }
    }

    // 4. Check absolute standard paths (non-Windows only)
    if !cfg!(windows) {
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
    }

    None
}

fn executable_exists(names: &[&str]) -> bool {
    let Some(paths) = env::var_os("PATH") else {
        return false;
    };
    env::split_paths(&paths).any(|directory| {
        names.iter().any(|name| {
            let candidate = directory.join(name);
            if candidate.is_file() {
                return true;
            }
            if cfg!(windows) {
                let win_candidate = directory.join(format!("{}.exe", name));
                if win_candidate.is_file() {
                    return true;
                }
            }
            false
        })
    })
}

fn detect_installed_providers() -> HashSet<String> {
    // Provider IDs are mapped to the local executable names users install.
    // Credential-only providers are added later when they return real usage.
    const PROVIDER_COMMANDS: &[(&str, &[&str])] = &[
        ("codex", &["codex"]),
        ("claude", &["claude"]),
        ("cursor", &["cursor"]),
        ("opencode", &["opencode"]),
        ("opencodego", &["opencode-go"]),
        ("factory", &["droid"]),
        ("gemini", &["gemini"]),
        ("antigravity", &["antigravity", "agy"]),
        ("copilot", &["copilot"]),
        ("zai", &["zai"]),
        ("minimax", &["minimax"]),
        ("kimi", &["kimi"]),
        ("kilo", &["kilo"]),
        ("kiro", &["kiro"]),
        ("augment", &["auggie"]),
        ("kimik2", &["kimi-k2"]),
        ("moonshot", &["moonshot"]),
        ("amp", &["amp"]),
        ("ollama", &["ollama"]),
        ("synthetic", &["synthetic"]),
        ("warp", &["warp-cli"]),
        ("openrouter", &["openrouter"]),
        ("windsurf", &["windsurf"]),
        ("zed", &["zed"]),
        ("mimo", &["mimo"]),
        ("mistral", &["mistral"]),
        ("deepseek", &["deepseek"]),
        ("codebuff", &["codebuff"]),
        ("crof", &["crof"]),
        ("venice", &["venice"]),
        ("stepfun", &["stepfun"]),
        ("grok", &["grok"]),
        ("groq", &["groq"]),
        ("litellm", &["litellm"]),
        ("deepgram", &["deepgram"]),
        ("poe", &["poe"]),
        ("chutes", &["chutes"]),
    ];

    PROVIDER_COMMANDS
        .iter()
        .filter(|(_, commands)| executable_exists(commands))
        .map(|(provider, _)| (*provider).to_string())
        .collect()
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
    let home = get_home_dir()?;
    Some(
        home.join(".codexbar-desktop")
            .join("cache.json"),
    )
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
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create cache directory: {}", e))?;
        }
    }
    let content = serde_json::to_string_pretty(val)
        .map_err(|e| format!("Failed to serialize cache: {}", e))?;
    std::fs::write(&path, content).map_err(|e| format!("Failed to write cache file: {}", e))?;
    Ok(())
}

fn usage_item_key(item: &serde_json::Value) -> (String, String) {
    let provider = item
        .get("provider")
        .and_then(|value| value.as_str())
        .unwrap_or_default();
    let account = item
        .get("cacheAccountKey")
        .or_else(|| item.get("account"))
        .and_then(|value| value.as_str())
        .unwrap_or_default();
    (provider.to_string(), account.to_string())
}

fn has_usage_data(item: &serde_json::Value) -> bool {
    item.pointer("/usage/primary")
        .is_some_and(|value| !value.is_null())
}

fn filter_usage_to_installed(
    usage: serde_json::Value,
    installed_providers: &HashSet<String>,
) -> serde_json::Value {
    let Some(items) = usage.as_array() else {
        return usage;
    };
    serde_json::Value::Array(
        items
            .iter()
            .filter(|item| {
                let (provider, _) = usage_item_key(item);
                installed_providers.contains(&provider) || has_usage_data(item)
            })
            .cloned()
            .collect(),
    )
}

fn merge_usage_with_cache(
    fresh_usage: serde_json::Value,
    cached_payload: Option<&serde_json::Value>,
    timestamp: u64,
) -> serde_json::Value {
    let Some(fresh_items) = fresh_usage.as_array() else {
        return fresh_usage;
    };
    let cached_items = cached_payload
        .and_then(|payload| payload.get("usage"))
        .and_then(serde_json::Value::as_array);
    let cached_timestamp = cached_payload
        .and_then(|payload| payload.get("timestamp"))
        .and_then(serde_json::Value::as_u64);

    serde_json::Value::Array(
        fresh_items
            .iter()
            .map(|fresh_item| {
                let mut merged = fresh_item.clone();
                let has_error = fresh_item
                    .get("error")
                    .is_some_and(|value| !value.is_null());

                if has_usage_data(fresh_item) {
                    if let Some(object) = merged.as_object_mut() {
                        object.insert("stale".to_string(), serde_json::Value::Bool(false));
                        object.insert("lastSuccessfulAt".to_string(), serde_json::json!(timestamp));
                    }
                    return merged;
                }

                if has_error {
                    let key = usage_item_key(fresh_item);
                    let cached_success = cached_items.and_then(|items| {
                        items.iter().find(|cached_item| {
                            usage_item_key(cached_item) == key && has_usage_data(cached_item)
                        })
                    });

                    if let Some(cached_item) = cached_success {
                        merged = cached_item.clone();
                        if let Some(object) = merged.as_object_mut() {
                            object.insert("error".to_string(), fresh_item["error"].clone());
                            object.insert("stale".to_string(), serde_json::Value::Bool(true));
                            object.insert("staleSince".to_string(), serde_json::json!(timestamp));
                            if !object.contains_key("lastSuccessfulAt") {
                                if let Some(previous_timestamp) = cached_timestamp {
                                    object.insert(
                                        "lastSuccessfulAt".to_string(),
                                        serde_json::json!(previous_timestamp),
                                    );
                                }
                            }
                        }
                    }
                }

                merged
            })
            .collect(),
    )
}

async fn refresh_and_cache() -> Result<serde_json::Value, String> {
    let cli_path = find_cli_path().ok_or_else(|| "cli_not_found".to_string())?;

    // 1. Run usage command
    let usage_output = tokio::process::Command::new(&cli_path)
        .args(&["usage", "--provider", "all", "--json"])
        .output()
        .await
        .map_err(|e| format!("Failed to run usage command: {}", e))?;

    let usage_stdout = String::from_utf8_lossy(&usage_output.stdout);
    let usage_json = serde_json::from_str::<serde_json::Value>(&usage_stdout)
        .map_err(|error| format!("Failed to parse usage JSON: {error}"))?;

    // 2. Run cost command
    let cost_output = tokio::process::Command::new(&cli_path)
        .args(&["cost", "--provider", "all", "--json"])
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
    let cached_payload = read_cache();
    let mut installed_providers = detect_installed_providers();
    if let Some(items) = usage_json.as_array() {
        installed_providers.extend(
            items
                .iter()
                .filter(|item| has_usage_data(item))
                .map(|item| usage_item_key(item).0),
        );
    }
    let usage_json = filter_usage_to_installed(usage_json, &installed_providers);
    let usage_json = merge_usage_with_cache(usage_json, cached_payload.as_ref(), timestamp);
    let mut installed_providers = installed_providers.into_iter().collect::<Vec<_>>();
    installed_providers.sort();

    let payload = serde_json::json!({
        "usage": usage_json,
        "cost": cost_json,
        "installedProviders": installed_providers,
        "timestamp": timestamp
    });

    // Write to cache file
    write_cache(&payload)?;

    Ok(payload)
}

#[cfg(test)]
mod tests {
    use super::{filter_usage_to_installed, merge_usage_with_cache};
    use std::collections::HashSet;

    #[test]
    fn filters_unconfigured_provider_errors_but_keeps_installed_and_successful_providers() {
        let usage = serde_json::json!([
            { "provider": "antigravity", "error": { "message": "not running" } },
            { "provider": "minimax", "error": { "message": "not configured" } },
            { "provider": "openai", "usage": { "primary": { "usedPercent": 10 } } }
        ]);
        let installed = HashSet::from(["antigravity".to_string()]);

        let filtered = filter_usage_to_installed(usage, &installed);

        assert_eq!(filtered.as_array().map(Vec::len), Some(2));
        assert_eq!(filtered[0]["provider"], "antigravity");
        assert_eq!(filtered[1]["provider"], "openai");
    }

    #[test]
    fn keeps_last_successful_usage_when_refresh_returns_an_error() {
        let cached = serde_json::json!({
            "timestamp": 100,
            "usage": [{
                "provider": "antigravity",
                "usage": { "primary": { "usedPercent": 42 } }
            }]
        });
        let fresh = serde_json::json!([{
            "provider": "antigravity",
            "source": "auto",
            "error": { "message": "language server not detected" }
        }]);

        let merged = merge_usage_with_cache(fresh, Some(&cached), 200);

        assert_eq!(merged[0]["usage"]["primary"]["usedPercent"], 42);
        assert_eq!(merged[0]["stale"], true);
        assert_eq!(merged[0]["lastSuccessfulAt"], 100);
        assert_eq!(
            merged[0]["error"]["message"],
            "language server not detected"
        );
    }

    #[test]
    fn leaves_first_error_visible_without_inventing_usage() {
        let fresh = serde_json::json!([{
            "provider": "antigravity",
            "error": { "message": "language server not detected" }
        }]);

        let merged = merge_usage_with_cache(fresh.clone(), None, 200);

        assert_eq!(merged, fresh);
    }

    #[test]
    fn successful_refresh_replaces_stale_usage() {
        let cached = serde_json::json!({
            "timestamp": 100,
            "usage": [{
                "provider": "antigravity",
                "stale": true,
                "usage": { "primary": { "usedPercent": 42 } }
            }]
        });
        let fresh = serde_json::json!([{
            "provider": "antigravity",
            "usage": { "primary": { "usedPercent": 50 } }
        }]);

        let merged = merge_usage_with_cache(fresh, Some(&cached), 200);

        assert_eq!(merged[0]["usage"]["primary"]["usedPercent"], 50);
        assert_eq!(merged[0]["stale"], false);
        assert_eq!(merged[0]["lastSuccessfulAt"], 200);
    }
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
                let cached_installed = cache
                    .get("installedProviders")
                    .and_then(serde_json::Value::as_array)
                    .map(|providers| {
                        providers
                            .iter()
                            .filter_map(serde_json::Value::as_str)
                            .map(str::to_string)
                            .collect::<HashSet<_>>()
                    });
                let installed = cached_installed.unwrap_or_else(detect_installed_providers);
                return Ok(filter_usage_to_installed(usage.clone(), &installed));
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
    if cfg!(windows) {
        return Err("Automatic CLI installation is only supported on Linux. Please install CodexBar CLI on Windows manually and ensure it is in your PATH.".to_string());
    }

    let _ = app.emit("install-progress", "Starting installation...");

    let home = match get_home_dir() {
        Some(h) => h,
        None => return Err("Home directory not found".to_string()),
    };
    let bin_dir = home.join(".local").join("bin");

    if !bin_dir.exists() {
        let _ = app.emit("install-progress", "Creating directory ~/.local/bin...");
        std::fs::create_dir_all(&bin_dir)
            .map_err(|e| format!("Failed to create directory ~/.local/bin: {}", e))?;
    }

    let arch = match std::env::consts::ARCH {
        "x86_64" => "x86_64",
        "aarch64" => "aarch64",
        _ => {
            return Err(format!(
                "Unsupported architecture: {}",
                std::env::consts::ARCH
            ))
        }
    };

    let _ = app.emit(
        "install-progress",
        "Fetching latest version tag from GitHub...",
    );

    let version_output = tokio::process::Command::new("curl")
        .args(&[
            "-s",
            "https://api.github.com/repos/steipete/CodexBar/releases/latest",
        ])
        .output()
        .await;

    let mut version = "v0.46.0".to_string();
    if let Ok(out) = version_output {
        if out.status.success() {
            let stdout = String::from_utf8_lossy(&out.stdout);
            if let Some(pos) = stdout.find("\"tag_name\"") {
                let sub = &stdout[pos..];
                if let Some(start) = sub.find(':') {
                    let val_sub = &sub[start + 1..];
                    if let Some(quote1) = val_sub.find('"') {
                        let tag_sub = &val_sub[quote1 + 1..];
                        if let Some(quote2) = tag_sub.find('"') {
                            version = tag_sub[..quote2].to_string();
                        }
                    }
                }
            }
        }
    }

    let _ = app.emit(
        "install-progress",
        format!("Selected version: {}. Downloading...", version),
    );

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

    let _ = app.emit(
        "install-progress",
        "Download complete. Extracting tarball...",
    );

    let tar_status = tokio::process::Command::new("tar")
        .args(&[
            "-xzf",
            dest_tarball.to_str().unwrap(),
            "-C",
            temp_dir.to_str().unwrap(),
        ])
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

#[tauri::command]
fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
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
            trigger_refresh,
            quit_app
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
