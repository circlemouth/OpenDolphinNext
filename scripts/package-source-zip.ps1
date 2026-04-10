param(
    [string]$Target = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path,
    [string]$OutputDir = (Join-Path (Resolve-Path (Join-Path $PSScriptRoot "..")).Path "artifacts/source-archives"),
    [string[]]$Projects = @(
        "server-modernized",
        "web-client"
    ),
    [string[]]$ExcludeDirNames = @(
        ".git",
        "node_modules",
        "target",
        "dist",
        "build",
        "out",
        "artifacts",
        ".cache",
        ".vite",
        ".parcel-cache",
        ".turbo",
        ".nyc_output"
    ),
    [string[]]$ExcludeFileExtensions = @(
        ".log",
        ".map",
        ".tmp",
        ".bak",
        ".swp",
        ".orig",
        ".tsbuildinfo",
        ".zip"
    ),
    [string[]]$ExcludeFileNames = @(
        ".env.local",
        ".DS_Store",
        "Thumbs.db",
        "desktop.ini"
    )
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Assert-Directory {
    param([string]$Path)
    if (-not (Test-Path -Path $Path -PathType Container)) {
        throw "Directory not found: $Path"
    }
}

function Get-RelativePath {
    param(
        [string]$BasePath,
        [System.IO.FileInfo]$File
    )
    $relative = $File.FullName.Substring($BasePath.Length).TrimStart([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar)
    return ($relative -replace "\\", "/")
}

function Should-ExcludePath {
    param(
        [string]$FullPath,
        [string]$BasePath,
        [string[]]$ExcludeDirNames
    )

    $relative = $FullPath.Substring($BasePath.Length).TrimStart([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar)
    $segments = @($relative -split "[\\/]" | Where-Object { $_ -ne "" })
    if ($segments.Count -lt 2) {
        return $false
    }

    foreach ($segment in $segments[0..($segments.Count - 2)]) {
        if ($ExcludeDirNames -contains $segment) {
            return $true
        }
    }
    return $false
}

function Build-SourceArchive {
    param(
        [string]$Project,
        [string]$Timestamp,
        [string]$OutputDir,
        [string]$SourceDir,
        [string[]]$ExcludeDirNames,
        [string[]]$ExcludeFileExtensions,
        [string[]]$ExcludeFileNames
    )

    $excludeExtensions = $ExcludeFileExtensions | ForEach-Object { $_.ToLowerInvariant() }
    Assert-Directory -Path $SourceDir

    $zipName = "${Project}-source-${Timestamp}.zip"
    $zipPath = Join-Path $OutputDir $zipName

    if (-not (Test-Path -Path $OutputDir -PathType Container)) {
        New-Item -ItemType Directory -Path $OutputDir | Out-Null
    }

    if (Test-Path -Path $zipPath) {
        Remove-Item -Path $zipPath -Force
    }

    Add-Type -AssemblyName System.IO.Compression
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $archive = [System.IO.Compression.ZipFile]::Open($zipPath, [System.IO.Compression.ZipArchiveMode]::Create)
    try {
        $entries = Get-ChildItem -Path $SourceDir -Recurse -File -Force | Where-Object {
            -not (Should-ExcludePath -FullPath $_.FullName -BasePath $SourceDir -ExcludeDirNames $ExcludeDirNames) -and
            -not ($ExcludeFileNames -contains $_.Name) -and
            -not ($_.Name -like ".env.*.local") -and
            -not ($excludeExtensions -contains $_.Extension.ToLowerInvariant())
        }

        foreach ($file in $entries) {
            $entryName = Get-RelativePath -BasePath $SourceDir -File $file
            [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
                $archive,
                $file.FullName,
                $entryName,
                [System.IO.Compression.CompressionLevel]::Optimal
            ) | Out-Null
        }
    }
    finally {
        $archive.Dispose()
    }

    Assert-ArchiveContents -ZipPath $zipPath
    Write-Host "created: $zipPath" -ForegroundColor Green
}

function Assert-ArchiveContents {
    param(
        [string]$ZipPath
    )

    $archive = [System.IO.Compression.ZipFile]::OpenRead($ZipPath)
    try {
        $entries = $archive.Entries | ForEach-Object { $_.FullName.Replace('\', '/') }
        if (-not $entries -or $entries.Count -eq 0) {
            throw "Archive is empty: $ZipPath"
        }

        $unexpectedEntries = $entries | Where-Object {
            $_ -match '(^|/)(node_modules|target|dist|build|out|artifacts|coverage|tmp|temp|\.cache|\.vite|\.parcel-cache|\.turbo|\.nyc_output|bin|obj)(/|$)' -or
            $_ -match '(^|/)\.env\.local$' -or
            $_ -match '(^|/)\.env\..+\.local$' -or
            $_ -match '(^|/)\.DS_Store$' -or
            $_ -match '(^|/)Thumbs\.db$' -or
            $_ -match '(^|/)desktop\.ini$' -or
            $_ -match '\.log$' -or
            $_ -match '\.map$' -or
            $_ -match '\.zip$' -or
            $_ -match '\.tsbuildinfo$'
        }

        if ($unexpectedEntries) {
            throw "Archive contains excluded entries: $($unexpectedEntries -join ', ')"
        }

        $invalidPaths = $entries | Where-Object {
            $_ -match '(^/)|(^\\)|(\.\./)|(\.\.\\)' -or $_ -match '\\'
        }

        if ($invalidPaths) {
            throw "Archive contains invalid paths: $($invalidPaths -join ', ')"
        }
    }
    finally {
        $archive.Dispose()
    }
}

$resolvedTarget = (Resolve-Path $Target).Path
Assert-Directory -Path $resolvedTarget

$timestamp = [DateTime]::UtcNow.ToString("yyyyMMddTHHmmssZ")

foreach ($project in $Projects) {
    $sourceDir = Join-Path $resolvedTarget $project
    if (-not (Test-Path -Path $sourceDir -PathType Container)) {
        Write-Warning "Skip: project directory not found: $sourceDir"
        continue
    }

    Write-Host "packaging: $project" -ForegroundColor Cyan
    Build-SourceArchive -Project $project -Timestamp $timestamp -OutputDir $OutputDir -SourceDir (Resolve-Path $sourceDir).Path -ExcludeDirNames $ExcludeDirNames -ExcludeFileExtensions $ExcludeFileExtensions -ExcludeFileNames $ExcludeFileNames
}
