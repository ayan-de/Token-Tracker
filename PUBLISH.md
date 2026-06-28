# Publishing TokenTracker

## Overview

TokenTracker is published in two places:
- **GitHub Releases** — `.deb` installer for direct download
- **npm** — `@thisisayande/tokentracker` package for `npm install -g`

Both are published automatically via the `Publish to npm` GitHub Actions workflow when a release is created.

---

## Pre-Release Checklist

Before creating a release, ensure all three version files are in sync:

| File | Field |
|------|-------|
| `package.json` | `version` |
| `src-tauri/tauri.conf.json` | `version` |
| `src-tauri/Cargo.toml` | `version` |

All three must match the release version (e.g. `0.1.12`).

---

## Release Workflow

### 1. Build the app

```bash
npm run tauri:build
```

This produces the installer at:
```
target/release/bundle/deb/TokenTracker_<VERSION>_amd64.deb
```

### 2. Commit and push all changes

```bash
git add .
git commit -m "release: bump to v0.x.x"
git push
```

### 3. Tag and create GitHub release

```bash
git tag v0.x.x
git push origin v0.x.x
gh release create v0.x.x \
  --repo ayan-de/Token-Tracker \
  --title "TokenTracker v0.x.x"
```

### 4. Upload the .deb to the release

```bash
gh release upload v0.x.x \
  target/release/bundle/deb/TokenTracker_<VERSION>_amd64.deb \
  --repo ayan-de/Token-Tracker \
  --clobber
```

The `Publish to npm` workflow triggers automatically on release creation and publishes to npm.

---

## npm Package

**Package name:** `@thisisayande/tokentracker`

**Installation:**
```bash
npm install -g @thisisayande/tokentracker
tokentracker
```

On first run, the launcher downloads and installs the latest `.deb` from GitHub releases automatically.

---

## Troubleshooting

**Workflow failed with EOTP:** Use an Automation token, not a Classic token. Generate at https://www.npmjs.com/settings/thisisayande/tokens

**npm version mismatch:** Ensure `package.json` version matches before creating the release. CI publishes whatever version is in `package.json`.

**Wrong .deb filename in release:** Rebuild after updating all three version files, then upload the new `.deb`.
