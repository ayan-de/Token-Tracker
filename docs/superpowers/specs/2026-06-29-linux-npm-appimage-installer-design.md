# Linux npm AppImage Installer Design

## Goal

Provide a polished Linux install experience where users can run:

```bash
npm install -g @thisisayande/tokentracker
tokentracker
```

and have TokenTracker launch successfully on Debian-family and Arch-based Linux systems without requiring manual `.deb` handling, manual AppImage download, or distro-specific user instructions.

## Scope

This design only covers the Linux distribution and npm-launcher flow.

Included:

- npm-based installation and first-run bootstrap on Linux
- GitHub Release artifact expectations for Linux
- launcher behavior for download, cache, execute, and update checks
- documentation changes required to reflect the new Linux distribution model

Excluded:

- Windows distribution
- macOS distribution
- AUR packaging
- system package manager integration through `dpkg`, `apt`, `pacman`, or similar tools
- auto-update behavior inside the Tauri app itself

## Problem Statement

The current npm package is a Linux-only launcher that assumes a Debian-style install flow. It attempts to download a `.deb` artifact from GitHub Releases and install it with `sudo dpkg -i`. That creates several problems:

- it does not support Arch cleanly
- it requires privileged installation behavior from an npm-driven flow
- it makes the npm path depend on distro-specific package tooling
- it creates a mismatch between the desired user experience and the actual install steps
- it increases failure modes around package-manager assumptions and system-level writes

If the product goal is "install once with npm, then run `tokentracker` from anywhere," the npm path should be user-space, distro-agnostic, and consistent across Linux systems.

## Decision

Use `AppImage` as the runtime artifact for all Linux npm installs.

Under this design:

- the npm package remains a thin launcher
- the launcher only supports Linux
- on first run, the launcher downloads the latest matching `AppImage` from GitHub Releases
- the launcher stores the `AppImage` in a user-owned application directory
- the launcher makes the file executable and launches it
- on later runs, the launcher reuses the cached local artifact
- `.deb` remains a separate direct-download release artifact for users who want a native Debian-family installer outside the npm flow

This means npm is no longer a `.deb` installer. It is a Linux bootstrapper for the AppImage release artifact.

## User Experience

### Primary path

User flow:

```bash
npm install -g @thisisayande/tokentracker
tokentracker
```

Expected behavior:

1. npm installs the launcher command globally
2. user runs `tokentracker`
3. launcher detects Linux and current CPU architecture
4. launcher checks whether a local TokenTracker AppImage is already installed
5. if missing, launcher resolves the latest release version
6. launcher downloads the matching AppImage from GitHub Releases
7. launcher stores it in a user-space directory
8. launcher marks it executable
9. launcher starts the app
10. future runs launch the cached AppImage directly

The user does not manually handle `.deb`, `AppImage`, `sudo`, `dpkg`, or distro-specific package commands.

### Unsupported path

If the user runs the npm launcher on a non-Linux platform, the launcher should exit with a short, explicit message explaining that this npm package currently supports Linux only and should point the user to the releases page.

## Storage Model

The launcher should install runtime assets under a user-owned directory rather than system directories.

Recommended base directory:

- data directory: `~/.local/share/tokentracker/`

Recommended contents:

- `~/.local/share/tokentracker/current/TokenTracker.AppImage`
- `~/.local/share/tokentracker/current/version.json`
- `~/.local/share/tokentracker/downloads/` for temporary download files

Design requirements:

- no root-owned writes
- no writes into `/usr/bin`, `/usr/lib`, or package-manager-controlled locations
- partial downloads must not replace a working current artifact
- the launcher must clean up stale temporary files when possible

## Release Artifact Contract

GitHub Releases must include a Linux AppImage asset for every published version intended for npm users.

The launcher must rely on a stable naming convention. Preferred convention:

- `TokenTracker_<version>_amd64.AppImage`

If arm64 support is added later, the naming convention should scale predictably, for example:

- `TokenTracker_<version>_amd64.AppImage`
- `TokenTracker_<version>_arm64.AppImage`

The release process may continue uploading `.deb` files, but the npm launcher must ignore them.

## Launcher Responsibilities

The Node launcher in `bin/tokentracker.js` becomes responsible for:

- validating platform support
- detecting architecture
- resolving the target release version
- building the expected AppImage asset name
- locating the local installed artifact
- downloading missing or newer artifacts
- writing version metadata atomically
- ensuring execute permissions
- spawning the AppImage process
- surfacing clear user-facing errors

The launcher should remain small and focused. If the file starts growing significantly, helper modules should be introduced under a packaged runtime directory so that download logic, filesystem logic, and release-resolution logic are separated.

## Version Resolution

Default version resolution:

- query GitHub Releases for the latest published release
- use the release tag version as the desired version

Optional override:

- continue supporting `TOKEN_TRACKER_VERSION` for manual pinning or debugging if that environment variable is already part of the existing launcher behavior

Behavioral rules:

- if local installed version matches desired version, launch local artifact
- if local installed version differs from desired version, download the desired version and replace the current pointer only after successful verification
- if no local artifact exists, download before launch

## Download and Install Flow

Recommended sequence:

1. compute desired version and target asset name
2. create required user-space directories if absent
3. download to a temporary path in the downloads directory
4. verify that the file exists and is non-empty after download
5. mark the temporary file executable
6. move the file atomically into the current runtime location
7. write version metadata atomically
8. spawn the AppImage

This sequence ensures a broken download does not clobber a previously working install.

## Error Handling

The launcher should produce short, actionable errors for these cases:

- GitHub API unreachable
- latest release missing expected AppImage asset
- download timeout or interrupted download
- unsupported CPU architecture
- chmod failure
- spawn failure

Error messages should include:

- what failed
- which version or asset was expected when relevant
- the manual fallback URL for GitHub Releases

The launcher should not print raw stack traces for common user-facing failures unless a debug mode is explicitly enabled.

## Architecture Support

Initial architecture target:

- `x64` Linux mapped to `amd64`

The launcher should fail clearly for unsupported architectures rather than attempting a best-effort guess. Additional mappings can be added once matching release assets exist.

## Documentation Changes

`PUBLISH.md` should be updated to state:

- npm installs a Linux launcher, not the desktop app payload itself
- npm runtime uses the AppImage release artifact for all Linux distros
- `.deb` remains available for direct Debian-family installation
- every release intended for npm users must include the AppImage asset

`README.md` should be updated to state:

- Linux npm install is supported through the launcher
- direct native installer downloads remain available from GitHub Releases
- Linux users can use the same npm flow on Debian-family and Arch-based distributions

## Testing Strategy

Manual verification should cover:

- fresh Ubuntu or Debian machine: install npm package globally, run `tokentracker`, verify first-run download and launch
- fresh Arch machine: install npm package globally, run `tokentracker`, verify first-run download and launch
- second run on both distros: verify cached AppImage launches without re-download
- forced version override: verify `TOKEN_TRACKER_VERSION` downloads and launches the pinned version
- missing asset: verify clear fallback error
- interrupted download: verify partial artifact does not become current

Pre-publish verification should include:

- `npm pack --dry-run` to confirm the launcher and its helper files are actually included
- release inspection to confirm AppImage naming matches launcher expectations

## Risks and Mitigations

### Risk: AppImage asset missing from release

Impact:

- npm users cannot install or launch the app

Mitigation:

- make AppImage upload part of the required release checklist
- keep asset naming stable and documented

### Risk: launcher package omits helper files

Impact:

- npm install succeeds, but runtime bootstrap fails

Mitigation:

- narrow and verify `package.json` `files` entries
- validate package contents with `npm pack --dry-run` before publishing

### Risk: GitHub API or release downloads are temporarily unavailable

Impact:

- first-run bootstrap may fail

Mitigation:

- keep a clear manual download fallback URL
- preserve working cached versions for future runs

### Risk: launcher grows into an unmaintainable script

Impact:

- harder changes, weaker testing, higher packaging mistakes

Mitigation:

- separate release lookup, filesystem management, and process launch responsibilities into helper modules if complexity increases

## Migration Plan

From the current launcher behavior to the new design:

1. remove `.deb`-specific install logic from the npm launcher
2. replace distro/package-manager assumptions with AppImage download-and-run logic
3. package all launcher runtime files correctly in the npm tarball
4. update release workflow to ensure AppImage artifacts are present and named consistently
5. update docs to describe npm as a Linux AppImage bootstrapper
6. validate on Debian-family and Arch machines before the next publish

## Success Criteria

This design is successful when:

- a Debian-family user can run `npm install -g @thisisayande/tokentracker` and then `tokentracker` without any manual installer work
- an Arch user can run the same two commands and get the same outcome
- the npm launcher never requires `sudo`
- npm no longer depends on `.deb` installation to work
- the release process reliably provides the AppImage artifact required by the launcher
