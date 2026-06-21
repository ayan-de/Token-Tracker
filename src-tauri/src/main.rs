// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // Workaround for WebKitGTK EGL crash on many Linux GPU/driver/Wayland
    // configurations. Without this, users see:
    //   "Could not create default EGL display: EGL_BAD_PARAMETER. Aborting..."
    // Setting these env vars before Tauri initializes forces a compatible
    // rendering path. This is a no-op on Windows.
    #[cfg(target_os = "linux")]
    {
        if std::env::var("WEBKIT_DISABLE_DMABUF_RENDERER").is_err() {
            std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
        }
        if std::env::var("WEBKIT_DISABLE_COMPOSITING_MODE").is_err() {
            std::env::set_var("WEBKIT_DISABLE_COMPOSITING_MODE", "1");
        }
    }

    tauri_app_lib::run()
}
