// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // Workaround for WebKitGTK EGL crash on Linux.
    //
    // The AppImage bundles WebKitGTK from the CI's Ubuntu 22.04, which has a
    // known EGL incompatibility with many GPU drivers (Intel Iris Xe, some
    // NVIDIA/AMD configurations on Wayland). The WebKitWebProcess subprocess
    // tries to create an EGL display and crashes with:
    //   "Could not create default EGL display: EGL_BAD_PARAMETER. Aborting..."
    //
    // These env vars must be set BEFORE Tauri initializes WebKitGTK.
    // They are inherited by the WebKitWebProcess subprocess.
    // On Windows this block is compiled out entirely.
    #[cfg(target_os = "linux")]
    {
        use std::env;

        // Disable DMA-BUF renderer (primary fix for most systems)
        if env::var("WEBKIT_DISABLE_DMABUF_RENDERER").is_err() {
            env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
        }
        // Disable hardware-accelerated compositing in WebKit
        if env::var("WEBKIT_DISABLE_COMPOSITING_MODE").is_err() {
            env::set_var("WEBKIT_DISABLE_COMPOSITING_MODE", "1");
        }
        // Force Mesa software rendering (llvmpipe) so the EGL display
        // creation in the GPU subprocess never touches the real GPU driver.
        // This has negligible perf impact for a UI-only app like ours.
        if env::var("LIBGL_ALWAYS_SOFTWARE").is_err() {
            env::set_var("LIBGL_ALWAYS_SOFTWARE", "1");
        }
    }

    tauri_app_lib::run()
}
