use std::env;
use std::net::TcpStream;
use std::path::PathBuf;
use std::process::{Child, Command};
use std::sync::Mutex;
use std::thread;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Manager};

pub struct BackendState {
    pub child: Mutex<Option<Child>>,
    pub port: u16,
}

pub(crate) const DEFAULT_PORT: u16 = 46727;

/// Resolve the path to the backend executable
fn resolve_backend_path(app: &tauri::App) -> Option<PathBuf> {
    let bin_name = if cfg!(windows) { "backend.exe" } else { "backend" };

    // 1. Check environment variable
    if let Ok(env_path) = env::var("TOKEN_TRACKER_BACKEND_BIN") {
        let path = PathBuf::from(env_path);
        if path.exists() {
            return Some(path);
        }
    }

    // 2. Check next to current exe (development target dir)
    if let Ok(current_exe) = env::current_exe() {
        if let Some(parent) = current_exe.parent() {
            let candidate = parent.join(bin_name);
            if candidate.exists() {
                return Some(candidate);
            }
            // Also check target/release/backend (development layout)
            let candidate = parent.join("target").join("release").join(bin_name);
            if candidate.exists() {
                return Some(candidate);
            }
        }
    }

    // 3. Check Tauri resources directory
    if let Ok(resource_dir) = app.path().resource_dir() {
        let candidate = resource_dir.join("bin").join(bin_name);
        if candidate.exists() {
            return Some(candidate);
        }
        let candidate = resource_dir.join(bin_name);
        if candidate.exists() {
            return Some(candidate);
        }
        // Check _up_/target/release/backend (AppImage/.deb layout)
        let candidate = resource_dir.join("_up_").join("target").join("release").join(bin_name);
        if candidate.exists() {
            return Some(candidate);
        }
        // Check _up_/backend directly under resource dir
        let candidate = resource_dir.join("_up_").join(bin_name);
        if candidate.exists() {
            return Some(candidate);
        }
    }

    None
}

/// Start the backend process
pub fn start_backend(app: &mut tauri::App) -> Result<(), String> {
    let backend_path = resolve_backend_path(app)
        .ok_or_else(|| "Could not find backend executable".to_string())?;

    // Determine port from env var or default
    let port: u16 = env::var("TOKEN_TRACKER_BACKEND_PORT")
        .unwrap_or_else(|_| DEFAULT_PORT.to_string())
        .parse()
        .unwrap_or(DEFAULT_PORT);

    println!("Spawning backend from: {:?}", backend_path);
    println!("Using backend port: {}", port);

    // On Linux, clear LD_LIBRARY_PATH and LD_PRELOAD to avoid AppImage dynamic linker conflicts
    let mut cmd = Command::new(&backend_path);
    cmd.env("TOKEN_TRACKER_BACKEND_PORT", port.to_string());
    #[cfg(target_os = "linux")]
    {
        cmd.env_remove("LD_LIBRARY_PATH");
        cmd.env_remove("LD_PRELOAD");
    }

    let child = cmd
        .spawn()
        .map_err(|e| format!("Failed to spawn backend process: {}", e))?;

    // Wait for the backend to be healthy (TCP port check)
    let start = Instant::now();
    let timeout = Duration::from_secs(5);
    let mut healthy = false;

    while start.elapsed() < timeout {
        if TcpStream::connect(format!("127.0.0.1:{}", port)).is_ok() {
            healthy = true;
            break;
        }
        thread::sleep(Duration::from_millis(100));
    }

    if !healthy {
        let mut child = child;
        let _ = child.kill();
        return Err(format!("Backend failed to respond on port {} within 5 seconds", port));
    }

    println!("Backend is healthy and listening on port {}", port);

    // Manage backend state
    app.manage(BackendState {
        child: Mutex::new(Some(child)),
        port,
    });

    Ok(())
}

/// Stop the backend process
pub fn stop_backend(app: &AppHandle) {
    if let Some(state) = app.try_state::<BackendState>() {
        if let Some(mut child) = state.child.lock().unwrap().take() {
            println!("Stopping backend process...");
            let _ = child.kill();
            let _ = child.wait();
        }
    }
}
