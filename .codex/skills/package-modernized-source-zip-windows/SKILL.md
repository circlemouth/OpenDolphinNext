---
name: package-modernized-source-zip-windows
description: Create source-only zip archives for OpenDolphinNext on Windows using PowerShell, excluding build artifacts, caches, node_modules, target, dist, and other generated files.
---

# OpenDolphinNext Source Archive for Windows

Use this skill when you need to package the modernized repository contents on a Windows machine.

## What this skill produces

- `artifacts/source-archives/server-modernized-source-<timestamp>.zip`
- `artifacts/source-archives/web-client-source-<timestamp>.zip`

Each archive should contain the source tree for one project only.
Generated output, caches, and dependency directories must be excluded.

## Run script

From the repository root, run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\package-source-zip.ps1
```

Optional parameters:

- `-Target` to package from a different repository root or subdirectory
- `-OutputDir .\artifacts\source-archives` to change the output location
- `-Projects @("server-modernized","web-client")` to override the packaged targets

## Exclusion policy

The packaging script must exclude:

- `.git/`
- `node_modules/`
- `target/`
- `dist/`
- `build/`
- `out/`
- `artifacts/`
- `.cache/`
- `.vite/`
- `.parcel-cache/`
- `.turbo/`
- `.nyc_output/`
- `.env.local`
- `.env.*.local`
- `*.log`
- `*.tsbuildinfo`
- `*.zip`

## Verification

The archive creation script validates its output contents.
It must fail if excluded paths or files are present in the generated zip.

If you need a manual check on Windows, inspect the archive with PowerShell:

```powershell
Expand-Archive -LiteralPath .\artifacts\source-archives\some-archive.zip -DestinationPath $env:TEMP\archive-check
```

Then confirm that generated output directories and dependency caches are absent.

## Notes

- This Windows skill is the repository-local counterpart to the existing source archive workflow.
- The packaging logic uses PowerShell and .NET zip APIs, so no macOS-specific tooling is required.
