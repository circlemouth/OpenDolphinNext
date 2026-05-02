<#
.SYNOPSIS
  モダナイズ版サーバーと Web クライアント開発環境のセットアップスクリプト (PowerShell 版)
  setup-modernized-env.sh と同等の機能を提供します。

.USAGE
  # Web クライアントをローカル npm で起動する場合
  $env:WEB_CLIENT_MODE = 'npm'; .\setup-modernized-env.ps1

  # Web クライアントも Docker で起動する場合
  $env:WEB_CLIENT_MODE = 'docker'; .\setup-modernized-env.ps1

.NOTES
  - Python 実行禁止ルールに従い、PowerShell + Docker Compose のみを使用
  - ORCA 連携ポートは 8000 番を使用しない（環境変数 ORCA_PORT で上書き可能）
  - ワークツリー実行時は自動的にコンテナ名にサフィックスを付与します
#>

$ErrorActionPreference = "Stop"

# --- 設定 ---
$ScriptDir = $PSScriptRoot
$OrcaInfoFile = "docs/operations/ORCA_CERTIFICATION_ONLY.md"
$OrcaCredentialFile = "docs/operations/ORCA_CERTIFICATION_ONLY.md"
$CustomPropTemplate = "ops/shared/docker/custom.properties"
$CustomPropOutput = Join-Path $ScriptDir "custom.properties.dev"
$ComposeOverrideFile = Join-Path $ScriptDir "docker-compose.override.dev.yml"
$LocalSeedFile = "ops/db/local-baseline/local_synthetic_seed.sql"
$FlywayLogDir = if ($env:FLYWAY_LOG_DIR) { $env:FLYWAY_LOG_DIR } else { "artifacts/preprod/flyway" }
$FlywayMigrateOnBoot = if ($env:FLYWAY_MIGRATE_ON_BOOT) { $env:FLYWAY_MIGRATE_ON_BOOT } else { "1" }
$FlywayOutOfOrder = if ($env:FLYWAY_OUT_OF_ORDER) { $env:FLYWAY_OUT_OF_ORDER } else { "1" }
$FlywayRepairOnValidation = if ($env:FLYWAY_REPAIR_ON_VALIDATION) { $env:FLYWAY_REPAIR_ON_VALIDATION } else { "1" }
$OpenDolphinSchemaAction = if ($env:OPENDOLPHIN_SCHEMA_ACTION) { $env:OPENDOLPHIN_SCHEMA_ACTION } else { "create" }
$env:OPENDOLPHIN_SCHEMA_ACTION = $OpenDolphinSchemaAction
$FlywayRunId = (Get-Date).ToUniversalTime().ToString("yyyyMMddTHHmmssZ")

$ModernizedAppHttpPort = if ($env:MODERNIZED_APP_HTTP_PORT) { $env:MODERNIZED_APP_HTTP_PORT } else { "9080" }
$ServerHealthUrl = "http://localhost:$ModernizedAppHttpPort/openDolphin/api/health"
$WorktreeContainerSuffix = if ($env:WORKTREE_CONTAINER_SUFFIX) { $env:WORKTREE_CONTAINER_SUFFIX } else { "" }
$OpenDolphinRuntimeProfileEffective = if ($env:OPENDOLPHIN_RUNTIME_PROFILE) { $env:OPENDOLPHIN_RUNTIME_PROFILE } else { "" }
$OpenDolphinEnvironmentEffective = if ($env:OPENDOLPHIN_ENVIRONMENT) { $env:OPENDOLPHIN_ENVIRONMENT } else { "trial-local" }
$AttachmentStorageModeEffective = if ($env:ATTACHMENT_STORAGE_MODE) { $env:ATTACHMENT_STORAGE_MODE } else { "s3" }
$ObjectStorageFreeRuntime = $false

# 管理者認証 (システムアカウント)
$AdminUser = "1.3.6.1.4.1.9414.10.1:dolphin"
$AdminPass = "36cdf8b887a5cffc78dcd5c08991b993" # dolphin (MD5)

# 作成するユーザー（既定: ORCA連携前提の ormaster）
$NewUserId = if ($env:DEV_ADMIN_USER_ID) { $env:DEV_ADMIN_USER_ID } else { "ormaster" }
$NewUserPass = if ($env:DEV_ADMIN_USER_PASS) { $env:DEV_ADMIN_USER_PASS } else { "" }
$NewUserName = if ($env:DEV_ADMIN_USER_NAME) { $env:DEV_ADMIN_USER_NAME } else { "OR Master Admin" }
$NewUserSirName = if ($env:DEV_ADMIN_SIR_NAME) { $env:DEV_ADMIN_SIR_NAME } else { "ORCA" }
$NewUserGivenName = if ($env:DEV_ADMIN_GIVEN_NAME) { $env:DEV_ADMIN_GIVEN_NAME } else { "Master" }
$NewUserEmail = if ($env:DEV_ADMIN_EMAIL) { $env:DEV_ADMIN_EMAIL } else { "ormaster@example.com" }
$NewUserPassSource = if ($env:DEV_ADMIN_USER_PASS) { "env:DEV_ADMIN_USER_PASS" } else { "unset" }
$FacilityId = if ($env:OPENDOLPHIN_FACILITY_ID) { $env:OPENDOLPHIN_FACILITY_ID } else { "1.3.6.1.4.1.9414.72.103" }
$SingleFacilityMode = if ($env:OPENDOLPHIN_SINGLE_FACILITY_MODE) { $env:OPENDOLPHIN_SINGLE_FACILITY_MODE } else { "false" }
$SingleFacilityModeEnabled = $SingleFacilityMode.ToLowerInvariant() -in @("1", "true", "yes", "y", "on")
$ViteSingleFacilityLogin = if ($env:VITE_SINGLE_FACILITY_LOGIN) { $env:VITE_SINGLE_FACILITY_LOGIN } elseif ($SingleFacilityModeEnabled) { "1" } else { "0" }
$ViteDefaultFacilityId = if ($env:VITE_DEFAULT_FACILITY_ID) { $env:VITE_DEFAULT_FACILITY_ID } elseif ($SingleFacilityModeEnabled) { $FacilityId } else { "" }

if ($OpenDolphinRuntimeProfileEffective.ToLowerInvariant() -eq "orca-trial-no-object-storage") {
    $AttachmentStorageModeEffective = "disabled"
}
if ($AttachmentStorageModeEffective.ToLowerInvariant() -eq "disabled") {
    $ObjectStorageFreeRuntime = $true
    if (-not $OpenDolphinRuntimeProfileEffective) {
        $OpenDolphinRuntimeProfileEffective = "orca-trial-no-object-storage"
    }
    if (-not $env:OPENDOLPHIN_ENVIRONMENT) {
        $OpenDolphinEnvironmentEffective = "trial-local"
    }
} elseif (-not $env:MINIO_ROOT_PASSWORD) {
    if (-not $env:MINIO_ROOT_USER) {
        $env:MINIO_ROOT_USER = "opendolphin"
    }
    $env:MINIO_ROOT_PASSWORD = [Guid]::NewGuid().ToString("N")
}
if (-not $ObjectStorageFreeRuntime) {
    if (-not $env:MINIO_ROOT_USER) {
        $env:MINIO_ROOT_USER = "opendolphin"
    }
    if (-not $env:ATTACHMENT_STORAGE_S3_ACCESS_KEY) {
        $env:ATTACHMENT_STORAGE_S3_ACCESS_KEY = $env:MINIO_ROOT_USER
    }
    if (-not $env:ATTACHMENT_STORAGE_S3_SECRET_KEY) {
        $env:ATTACHMENT_STORAGE_S3_SECRET_KEY = $env:MINIO_ROOT_PASSWORD
    }
    if (-not $env:PHR_EXPORT_S3_ACCESS_KEY) {
        $env:PHR_EXPORT_S3_ACCESS_KEY = $env:MINIO_ROOT_USER
    }
    if (-not $env:PHR_EXPORT_S3_SECRET_KEY) {
        $env:PHR_EXPORT_S3_SECRET_KEY = $env:MINIO_ROOT_PASSWORD
    }
}

# Web クライアント設定
$WebClientMode = if ($env:WEB_CLIENT_MODE) { $env:WEB_CLIENT_MODE } else { "docker" }
$WebClientDevHost = if ($env:WEB_CLIENT_DEV_HOST) { $env:WEB_CLIENT_DEV_HOST } else { "localhost" }
$WebClientDevPort = if ($env:WEB_CLIENT_DEV_PORT) { $env:WEB_CLIENT_DEV_PORT } else { "5173" }
$WebClientDevLog = if ($env:WEB_CLIENT_DEV_LOG) { $env:WEB_CLIENT_DEV_LOG } else { "tmp/web-client-dev.log" }
$WebClientDevLogPath = if ([System.IO.Path]::IsPathRooted($WebClientDevLog)) { $WebClientDevLog } else { Join-Path $ScriptDir $WebClientDevLog }
$WebClientDevPidFile = if ($env:WEB_CLIENT_DEV_PID_FILE) { $env:WEB_CLIENT_DEV_PID_FILE } else { "tmp/web-client-dev.pid" }
$WebClientDevPidFilePath = if ([System.IO.Path]::IsPathRooted($WebClientDevPidFile)) { $WebClientDevPidFile } else { Join-Path $ScriptDir $WebClientDevPidFile }
$FlywayLogDirPath = if ([System.IO.Path]::IsPathRooted($FlywayLogDir)) { $FlywayLogDir } else { Join-Path $ScriptDir $FlywayLogDir }
$FlywayLogFile = Join-Path $FlywayLogDirPath "flyway-$FlywayRunId.log"

$WebClientDevProxyTargetOverride = if ($env:WEB_CLIENT_DEV_PROXY_TARGET) { $env:WEB_CLIENT_DEV_PROXY_TARGET } else { $null }
$WebClientDevProxyTargetDefault = "http://localhost:$ModernizedAppHttpPort/openDolphin"
$WebClientDockerProxyTargetDefault = "http://host.docker.internal:$ModernizedAppHttpPort/openDolphin"
$WebClientDevProxyTarget = if ($WebClientDevProxyTargetOverride) { $WebClientDevProxyTargetOverride } else { $WebClientDevProxyTargetDefault }
$WebClientDevApiBase = if ($env:WEB_CLIENT_DEV_API_BASE) { $env:WEB_CLIENT_DEV_API_BASE } else { "/api" }
$WebClientEnvLocal = if ($env:WEB_CLIENT_ENV_LOCAL) { $env:WEB_CLIENT_ENV_LOCAL } else { Join-Path $ScriptDir "web-client/.env.local" }

# Worktree サフィックスの自動判定
if (-not $WorktreeContainerSuffix -and $ScriptDir -match "\.worktrees") {
    $WorktreeContainerSuffix = Split-Path $ScriptDir -Leaf
}
if ($WorktreeContainerSuffix) {
    $WorktreeContainerSuffix = $WorktreeContainerSuffix -replace '[^a-zA-Z0-9-]', '-'
}

function Get-ContainerName {
    param([string]$Base)
    if ($WorktreeContainerSuffix) {
        return "$Base-$WorktreeContainerSuffix"
    }
    return $Base
}

$PostgresContainerName = Get-ContainerName "opendolphin-postgres-modernized"
$ServerContainerName = Get-ContainerName "opendolphin-server-modernized-dev"
$MinioContainerName = Get-ContainerName "opendolphin-minio"

# --- ユーティリティ関数 ---

function Log {
    param([string]$Message, [ConsoleColor]$Color = [ConsoleColor]::Gray)
    $Timestamp = Get-Date -Format "HH:mm:ss"
    Write-Host "[$Timestamp] $Message" -ForegroundColor $Color
}

function Is-Truthy {
    param([string]$Value)
    if (-not $Value) { return $false }
    switch ($Value.ToLower()) {
        "1" { return $true }
        "true" { return $true }
        "yes" { return $true }
        "on" { return $true }
        default { return $false }
    }
}

function Is-LocalOrcaHost {
    param([string]$HostName)
    if (-not $HostName) { return $false }
    $normalized = $HostName.ToLowerInvariant()
    return $normalized -eq "localhost" -or $normalized -eq "127.0.0.1" -or $normalized -eq "::1" -or $normalized -eq "host.docker.internal"
}

function Mask-State {
    param([string]$User, [string]$Pass)
    if ($User -and $Pass) { return "set" }
    return "unset"
}

function Import-OrcaEnvFile {
    $Candidates = @()
    if ($env:ORCA_ENV_FILE) {
        $Candidates += $env:ORCA_ENV_FILE
    } else {
        $Candidates += (Join-Path $ScriptDir "orca.env.local")
        if ($HOME) {
            $Candidates += (Join-Path $HOME ".config/opendolphin/orca.env")
        }
    }

    foreach ($Candidate in $Candidates) {
        if (-not $Candidate) { continue }
        if (-not (Test-Path $Candidate)) { continue }

        Log "Loading ORCA env from $Candidate..." -Color Cyan
        foreach ($RawLine in Get-Content $Candidate) {
            $Line = $RawLine.Trim()
            if (-not $Line -or $Line.StartsWith("#")) { continue }
            if ($Line.StartsWith("export ")) {
                $Line = $Line.Substring(7).Trim()
            }
            if ($Line -notmatch '^([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
                continue
            }
            $Key = $Matches[1]
            $RawValue = $Matches[2].Trim()
            $Value = $RawValue
            if ($RawValue.Length -ge 2 -and $RawValue.StartsWith("'") -and $RawValue.EndsWith("'")) {
                $Value = $RawValue.Substring(1, $RawValue.Length - 2)
            } elseif ($RawValue.Length -ge 2 -and $RawValue.StartsWith('"') -and $RawValue.EndsWith('"')) {
                $Value = $RawValue.Substring(1, $RawValue.Length - 2)
                $Value = $Value.Replace('\\', '\')
                $Value = $Value.Replace('\"', '"')
                $Value = $Value.Replace('\n', "`n")
                $Value = $Value.Replace('\r', "`r")
                $Value = $Value.Replace('\t', "`t")
            }
            Set-Item -Path "Env:$Key" -Value $Value
        }
        return
    }

    $HomeCandidate = if ($HOME) { Join-Path $HOME ".config/opendolphin/orca.env" } else { $null }
    if ($HomeCandidate) {
        Log "Warning: ORCA env file not found. Looked for $(Join-Path $ScriptDir 'orca.env.local') and $HomeCandidate." -Color Yellow
    } else {
        Log "Warning: ORCA env file not found. Looked for $(Join-Path $ScriptDir 'orca.env.local')." -Color Yellow
    }
}

function Resolve-ProxyAuthEnv {
    $global:ORCA_PROXY_CERT_PATH = if ($env:ORCA_CERT_PATH) { $env:ORCA_CERT_PATH } elseif ($env:ORCA_PROD_CERT_PATH) { $env:ORCA_PROD_CERT_PATH } elseif ($env:ORCA_PROD_CERT) { $env:ORCA_PROD_CERT } else { $null }
    $global:ORCA_PROXY_CERT_PASS = if ($env:ORCA_CERT_PASS) { $env:ORCA_CERT_PASS } elseif ($env:ORCA_PROD_CERT_PASS) { $env:ORCA_PROD_CERT_PASS } else { $null }
    $global:ORCA_PROXY_BASIC_USER = if ($env:ORCA_BASIC_USER) { $env:ORCA_BASIC_USER } elseif ($env:ORCA_PROD_BASIC_USER) { $env:ORCA_PROD_BASIC_USER } elseif ($global:ORN_ORCA_API_USER) { $global:ORN_ORCA_API_USER } else { $null }
    $global:ORCA_PROXY_BASIC_PASSWORD = if ($env:ORCA_BASIC_PASSWORD) { $env:ORCA_BASIC_PASSWORD } elseif ($env:ORCA_BASIC_KEY) { $env:ORCA_BASIC_KEY } elseif ($env:ORCA_PROD_BASIC_KEY) { $env:ORCA_PROD_BASIC_KEY } elseif ($global:ORN_ORCA_API_PASSWORD) { $global:ORN_ORCA_API_PASSWORD } else { $null }
}

Import-OrcaEnvFile

function Get-MD5Hash {
    param([string]$InputString)
    $md5 = [System.Security.Cryptography.MD5]::Create()
    $hash = [BitConverter]::ToString($md5.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($InputString)))
    return $hash.Replace("-", "").ToLower()
}

function Test-ModernizedTable {
    param([string]$TableName)
    try {
        $result = docker exec $PostgresContainerName psql -U opendolphin -d opendolphin_modern -tAc "SELECT 1 FROM information_schema.tables WHERE table_name='$TableName' LIMIT 1;" 2>$null
        return ($result -replace '\s+', '') -eq "1"
    } catch {
        return $false
    }
}

# --- メイン処理 ---

function Read-OrcaInfo {
    $fileScheme = $null
    $fileHost = $null
    $filePort = $null
    $fileUser = $null
    $filePass = $null

    function Get-MarkdownTableBacktickValue {
        param(
            [string]$Content,
            [string]$Marker
        )
        foreach ($line in ($Content -split "`r?`n")) {
            if ($line -notlike "*$Marker*") {
                continue
            }
            $parts = $line -split '`'
            if ($parts.Length -ge 3) {
                return $parts[1].Trim()
            }
        }
        return $null
    }

    # .sh と同等の正規表現による抽出
    $pwsRegexAuth = 'Basic auth:\s*``([^`]*)``\s*/\s*``([^`]*)``'

    if (Test-Path $OrcaInfoFile) {
        Log "Reading ORCA connection info from $OrcaInfoFile..." -Color Cyan
        $content = Get-Content $OrcaInfoFile -Raw
        
        if ($content -match '(https?)://([^/:\s`]+)(:(\d+))?') {
            $fileScheme = $Matches[1]
            $fileHost = $Matches[2]
            $filePort = $Matches[4]
            if (-not $filePort) {
                $filePort = if ($fileScheme -eq "https") { "443" } else { "80" }
            }
        }

        if ($content -match $pwsRegexAuth) {
            $fileUser = $Matches[1]
            $filePass = $Matches[2]
        }
        if (-not $fileUser -or -not $filePass) {
            $tableUser = Get-MarkdownTableBacktickValue -Content $content -Marker '<<FILL_BASIC_USER>>'
            $tablePass = Get-MarkdownTableBacktickValue -Content $content -Marker '<<FILL_BASIC_PASS>>'
            if (-not $fileUser -and $tableUser) {
                $fileUser = $tableUser
            }
            if (-not $filePass -and $tablePass) {
                $filePass = $tablePass
            }
        }
    } else {
        Log "Warning: ORCA info file not found ($OrcaInfoFile)" -Color Yellow
    }

    if (Test-Path $OrcaCredentialFile) {
        $content = Get-Content $OrcaCredentialFile -Raw
        if ($content -match $pwsRegexAuth) {
            $fileUser = $Matches[1]
            $filePass = $Matches[2]
        }
    }

    $fallbackPort = if ($env:ORCA_API_PORT_FALLBACK) { $env:ORCA_API_PORT_FALLBACK } else { "443" }
    $allowPort8000 = if ($env:ORCA_API_PORT_ALLOW_8000) { $env:ORCA_API_PORT_ALLOW_8000 } else { "0" }
    $allowPort8000Normalized = if (Is-Truthy $allowPort8000) { "1" } else { "0" }

    $global:ORCA_TARGET_ENV = if ($env:ORCA_TARGET_ENV) { $env:ORCA_TARGET_ENV } elseif ($env:ORCA_ENV) { $env:ORCA_ENV } else { "" }
    if ($global:ORCA_TARGET_ENV) { $global:ORCA_TARGET_ENV = $global:ORCA_TARGET_ENV.ToLower() }

    if ($env:ORCA_API_SCHEME) {
        $global:ORN_ORCA_API_SCHEME = $env:ORCA_API_SCHEME
        $global:ORCA_API_SCHEME_SOURCE = "env:ORCA_API_SCHEME"
    } elseif ($fileScheme) {
        $global:ORN_ORCA_API_SCHEME = $fileScheme
        $global:ORCA_API_SCHEME_SOURCE = "file:ORCA_CERTIFICATION_ONLY"
    } else {
        $global:ORN_ORCA_API_SCHEME = "http"
        $global:ORCA_API_SCHEME_SOURCE = "default"
    }

    if ($env:ORCA_API_HOST) {
        $global:ORN_ORCA_API_HOST = $env:ORCA_API_HOST
        $global:ORCA_API_HOST_SOURCE = "env:ORCA_API_HOST"
    } elseif ($env:ORCA_HOST) {
        $global:ORN_ORCA_API_HOST = $env:ORCA_HOST
        $global:ORCA_API_HOST_SOURCE = "env:ORCA_HOST"
    } elseif ($fileHost) {
        $global:ORN_ORCA_API_HOST = $fileHost
        $global:ORCA_API_HOST_SOURCE = "file:ORCA_CERTIFICATION_ONLY"
    } else {
        $global:ORN_ORCA_API_HOST = "localhost"
        $global:ORCA_API_HOST_SOURCE = "default"
    }

    if ($env:ORCA_API_PORT) {
        $rawPort = $env:ORCA_API_PORT
        $global:ORCA_API_PORT_SOURCE = "env:ORCA_API_PORT"
    } elseif ($env:ORCA_PORT) {
        $rawPort = $env:ORCA_PORT
        $global:ORCA_API_PORT_SOURCE = "env:ORCA_PORT"
    } elseif ($filePort) {
        $rawPort = $filePort
        $global:ORCA_API_PORT_SOURCE = "file:ORCA_CERTIFICATION_ONLY"
    } else {
        $rawPort = $fallbackPort
        $global:ORCA_API_PORT_SOURCE = "default:fallback"
    }

    $portOriginal = $rawPort
    $portSourceOriginal = $global:ORCA_API_PORT_SOURCE
    $portReplaced = $false
    if ($rawPort -eq "8000" -and $allowPort8000Normalized -ne "1") {
        $rawPort = $fallbackPort
        $global:ORCA_API_PORT_SOURCE = "policy:block_8000"
        $portReplaced = $true
    }
    $global:ORN_ORCA_API_PORT = $rawPort

    if ($env:ORCA_API_USER) {
        $global:ORN_ORCA_API_USER = $env:ORCA_API_USER
        $global:ORCA_API_USER_SOURCE = "env:ORCA_API_USER"
    } elseif ($env:ORCA_USER) {
        $global:ORN_ORCA_API_USER = $env:ORCA_USER
        $global:ORCA_API_USER_SOURCE = "env:ORCA_USER"
    } else {
        $global:ORN_ORCA_API_USER = $fileUser
        $global:ORCA_API_USER_SOURCE = if ($fileUser) { "file:ORCA_CERTIFICATION_ONLY" } else { "default" }
    }

    if ($env:ORCA_API_PASSWORD) {
        $global:ORN_ORCA_API_PASSWORD = $env:ORCA_API_PASSWORD
        $global:ORCA_API_PASSWORD_SOURCE = "env:ORCA_API_PASSWORD"
    } elseif ($env:ORCA_PASS) {
        $global:ORN_ORCA_API_PASSWORD = $env:ORCA_PASS
        $global:ORCA_API_PASSWORD_SOURCE = "env:ORCA_PASS"
    } else {
        $global:ORN_ORCA_API_PASSWORD = $filePass
        $global:ORCA_API_PASSWORD_SOURCE = if ($filePass) { "file:ORCA_CERTIFICATION_ONLY" } else { "default" }
    }

    if ($env:ORCA_MODE) {
        $global:ORN_ORCA_MODE = $env:ORCA_MODE
        $global:ORCA_MODE_SOURCE = "env:ORCA_MODE"
    } elseif (Is-Truthy $env:ORCA_API_WEBORCA) {
        $global:ORN_ORCA_MODE = "weborca"
        $global:ORCA_MODE_SOURCE = "env:ORCA_API_WEBORCA"
    } else {
        $global:ORN_ORCA_MODE = "onprem"
        $global:ORCA_MODE_SOURCE = "default"
    }

    if ($global:ORCA_MODE_SOURCE -eq "default" -and -not (Is-LocalOrcaHost $ORN_ORCA_API_HOST)) {
        Write-Error "ORCA_MODE is required when ORCA_API_HOST is not local. Set ORCA_MODE=weborca or ORCA_MODE=onprem (or ORCA_API_WEBORCA=1)."
    }

    if ($ORN_ORCA_MODE -eq "weborca" -and $global:ORCA_API_SCHEME_SOURCE -eq "default") {
        $global:ORN_ORCA_API_SCHEME = "https"
        $global:ORCA_API_SCHEME_SOURCE = "computed:weborca"
    }

    if ($env:ORCA_BASE_URL) {
        $global:ORN_ORCA_BASE_URL = $env:ORCA_BASE_URL
        $global:ORCA_BASE_URL_SOURCE = "env:ORCA_BASE_URL"
    } else {
        $global:ORN_ORCA_BASE_URL = if ($ORN_ORCA_API_PORT -eq "80" -or $ORN_ORCA_API_PORT -eq "443") {
            "$ORN_ORCA_API_SCHEME`://$ORN_ORCA_API_HOST"
        } else {
            "$ORN_ORCA_API_SCHEME`://$ORN_ORCA_API_HOST`:$ORN_ORCA_API_PORT"
        }
        $global:ORCA_BASE_URL_SOURCE = "computed"
    }

    Resolve-ProxyAuthEnv

    $targetEnvLabel = if ($global:ORCA_TARGET_ENV) { $global:ORCA_TARGET_ENV } else { "unset" }
    $pathPrefixLabel = if ($env:ORCA_API_PATH_PREFIX) { $env:ORCA_API_PATH_PREFIX } else { "auto" }

    Log "ORCA_CONFIG target_env=$targetEnvLabel base_url=$ORN_ORCA_BASE_URL mode=$ORN_ORCA_MODE path_prefix=$pathPrefixLabel" -Color Cyan
    Log "ORCA_CONFIG source host=$ORCA_API_HOST_SOURCE port=$ORCA_API_PORT_SOURCE scheme=$ORCA_API_SCHEME_SOURCE base_url=$ORCA_BASE_URL_SOURCE mode=$ORCA_MODE_SOURCE" -Color Cyan
    Log "ORCA_CONFIG port policy=block_8000 allow_8000=$allowPort8000Normalized fallback=$fallbackPort replaced=$portReplaced original_port=$portOriginal original_source=$portSourceOriginal" -Color Cyan
    Log "ORCA_CONFIG auth server_basic=$(Mask-State $ORN_ORCA_API_USER $ORN_ORCA_API_PASSWORD) web_proxy_basic=$(Mask-State $ORCA_PROXY_BASIC_USER $ORCA_PROXY_BASIC_PASSWORD) web_proxy_cert=$(Mask-State $ORCA_PROXY_CERT_PATH $ORCA_PROXY_CERT_PASS)" -Color Cyan

    if ($global:ORCA_TARGET_ENV -match "^(preprod|prod)$") {
        if ($global:ORCA_BASE_URL_SOURCE -notlike "env:*" -and $global:ORCA_API_HOST_SOURCE -notlike "env:*") {
            Write-Error "ORCA_TARGET_ENV=$global:ORCA_TARGET_ENV requires explicit ORCA_BASE_URL or ORCA_API_HOST env."
        }
    }
}

function Resolve-DevAdminCredentials {
    if ($NewUserPass) {
        Log "DEV_ADMIN account=$NewUserId pass_source=$NewUserPassSource" -Color Cyan
        return
    }

    if ($ORN_ORCA_API_USER -and $ORN_ORCA_API_PASSWORD -and ($ORN_ORCA_API_USER -eq $NewUserId)) {
        $script:NewUserPass = $ORN_ORCA_API_PASSWORD
        $script:NewUserPassSource = "ORCA_API_PASSWORD"
    } elseif ($env:ORMASTER_PASS) {
        $script:NewUserPass = $env:ORMASTER_PASS
        $script:NewUserPassSource = "env:ORMASTER_PASS"
    } else {
        $script:NewUserPass = "change_me"
        $script:NewUserPassSource = "default:change_me"
    }

    Log "DEV_ADMIN account=$NewUserId pass_source=$NewUserPassSource" -Color Cyan
}

function Generate-CustomProperties {
    Log "Generating $CustomPropOutput from $CustomPropTemplate..." -Color Cyan
    if (-not (Test-Path $CustomPropTemplate)) {
        Write-Error "Template not found: $CustomPropTemplate"
    }

    $content = Get-Content $CustomPropTemplate -Raw
    $content = $content -replace '^orca\.orcaapi\.ip=.*', "orca.orcaapi.ip=$ORN_ORCA_API_HOST"
    $content = $content -replace '^orca\.orcaapi\.port=.*', "orca.orcaapi.port=$ORN_ORCA_API_PORT"
    
    if ($ORN_ORCA_API_USER) {
        $content = $content -replace '^orca\.id=.*', "orca.id=$ORN_ORCA_API_USER"
    }
    if ($ORN_ORCA_API_PASSWORD) {
        $content = $content -replace '^orca\.password=.*', "orca.password=$ORN_ORCA_API_PASSWORD"
    }

    [System.IO.File]::WriteAllText($CustomPropOutput, $content, (New-Object System.Text.UTF8Encoding $false))
    Log "custom.properties written to $CustomPropOutput"
}

function Generate-ComposeOverride {
    Log "Generating $ComposeOverrideFile..." -Color Cyan
    $propBaseName = Split-Path $CustomPropOutput -Leaf
    $storageEnvBlock = ""
    if ($ObjectStorageFreeRuntime) {
        $storageEnvBlock = @"
      OPENDOLPHIN_RUNTIME_PROFILE: $OpenDolphinRuntimeProfileEffective
      ATTACHMENT_STORAGE_MODE: disabled
      ATTACHMENT_STORAGE_S3_BUCKET: ''
      ATTACHMENT_STORAGE_S3_REGION: ''
      ATTACHMENT_STORAGE_S3_ENDPOINT: ''
      ATTACHMENT_STORAGE_S3_BASE_PATH: ''
      ATTACHMENT_STORAGE_S3_FORCE_PATH_STYLE: ''
      ATTACHMENT_STORAGE_S3_SERVER_SIDE_ENCRYPTION: ''
      ATTACHMENT_STORAGE_S3_KMS_KEY_ID: ''
      ATTACHMENT_STORAGE_S3_MULTIPART_THRESHOLD_MB: ''
      ATTACHMENT_STORAGE_S3_ACCESS_KEY: ''
      ATTACHMENT_STORAGE_S3_SECRET_KEY: ''
      PHR_EXPORT_STORAGE_TYPE: disabled
      PHR_EXPORT_SIGNING_SECRET: ''
      PHR_EXPORT_S3_BUCKET: ''
      PHR_EXPORT_S3_REGION: ''
      PHR_EXPORT_S3_PREFIX: ''
      PHR_EXPORT_S3_ENDPOINT: ''
      PHR_EXPORT_S3_FORCE_PATH_STYLE: ''
      PHR_EXPORT_S3_ACCESS_KEY: ''
      PHR_EXPORT_S3_SECRET_KEY: ''
"@
    }
    $content = @"
services:
  server-modernized-dev:
    container_name: $ServerContainerName
    environment:
      OPENDOLPHIN_ENVIRONMENT: $OpenDolphinEnvironmentEffective
      ORCA_API_HOST: $ORN_ORCA_API_HOST
      ORCA_API_PORT: $ORN_ORCA_API_PORT
      ORCA_API_SCHEME: $ORN_ORCA_API_SCHEME
      ORCA_API_USER: $ORN_ORCA_API_USER
      ORCA_API_PASSWORD: $ORN_ORCA_API_PASSWORD
      ORCA_BASE_URL: $ORN_ORCA_BASE_URL
      ORCA_MODE: $ORN_ORCA_MODE
      ORCA_API_PATH_PREFIX: $env:ORCA_API_PATH_PREFIX
      ORCA_API_WEBORCA: $env:ORCA_API_WEBORCA
      ORCA_API_RETRY_MAX: $env:ORCA_API_RETRY_MAX
      ORCA_API_RETRY_BACKOFF_MS: $env:ORCA_API_RETRY_BACKOFF_MS
      OPENDOLPHIN_FACILITY_ID: $FacilityId
      OPENDOLPHIN_SINGLE_FACILITY_MODE: $SingleFacilityMode
      OPENDOLPHIN_SCHEMA_ACTION: $OpenDolphinSchemaAction
$storageEnvBlock
      JAVA_OPTS_APPEND: \${JAVA_OPTS_APPEND:-} -Dhibernate.hbm2ddl.auto=$OpenDolphinSchemaAction -Djakarta.persistence.schema-generation.database.action=$OpenDolphinSchemaAction -Dmicrometer.export.otlp.enabled=false -Dio.micrometer.export.otlp.enabled=false -Dotlp.enabled=false -Dotel.metrics.exporter=none -Dotel.sdk.disabled=true
    volumes:
      - ./${propBaseName}:/opt/jboss/wildfly/custom.properties
  db-modernized:
    container_name: $PostgresContainerName
  minio:
    container_name: $MinioContainerName
"@
    [System.IO.File]::WriteAllText($ComposeOverrideFile, $content, (New-Object System.Text.UTF8Encoding $false))
    Log "docker-compose override written to $ComposeOverrideFile"
}

function Start-ModernizedServer {
    Log "Starting Modernized Server..." -Color Cyan
    $env:ORCA_API_HOST = $ORN_ORCA_API_HOST
    $env:ORCA_API_PORT = $ORN_ORCA_API_PORT
    $env:ORCA_API_SCHEME = $ORN_ORCA_API_SCHEME
    $env:ORCA_API_USER = $ORN_ORCA_API_USER
    $env:ORCA_API_PASSWORD = $ORN_ORCA_API_PASSWORD
    $env:ORCA_BASE_URL = $ORN_ORCA_BASE_URL
    $env:ORCA_MODE = $ORN_ORCA_MODE
    if ($ObjectStorageFreeRuntime) {
        docker compose -f docker-compose.modernized.dev.yml -f $ComposeOverrideFile up -d --build --force-recreate
    } else {
        docker compose -f docker-compose.modernized.dev.yml -f $ComposeOverrideFile --profile object-storage up -d --build --force-recreate
    }
    if ($LASTEXITCODE -ne 0) {
        throw "docker compose failed to start Modernized Server."
    }
}

function Wait-ForPostgresReady {
    $retries = 30
    for ($i = 1; $i -le $retries; $i++) {
        try {
            $result = docker exec $PostgresContainerName psql -U opendolphin -d opendolphin_modern -tAc "SELECT 1" 2>$null
            if (($result -replace '\s+', '') -eq "1") {
                return
            }
        } catch { }
        Start-Sleep -Seconds 2
    }
    Write-Error "Postgres did not become ready in time."
}

function Invoke-FlywayCommand {
    param([string]$Subcommand)

    $dbName = if ($env:MODERNIZED_POSTGRES_DB) { $env:MODERNIZED_POSTGRES_DB } else { "opendolphin_modern" }
    $dbUser = if ($env:MODERNIZED_POSTGRES_USER) { $env:MODERNIZED_POSTGRES_USER } else { "opendolphin" }
    $dbPassword = if ($env:MODERNIZED_POSTGRES_PASSWORD) { $env:MODERNIZED_POSTGRES_PASSWORD } else { "opendolphin" }

    $args = @(
        "run", "--rm",
        "--network", "container:$PostgresContainerName",
        "-v", "${ScriptDir}:/workspace",
        "-w", "/workspace",
        "-e", "DB_HOST=localhost",
        "-e", "DB_PORT=5432",
        "-e", "DB_NAME=$dbName",
        "-e", "DB_USER=$dbUser",
        "-e", "DB_PASSWORD=$dbPassword",
        "flyway/flyway:10.17",
        "-configFiles=server-modernized/tools/flyway/flyway.conf"
    )
    if (Is-Truthy $FlywayOutOfOrder) {
        $args += "-outOfOrder=true"
    }
    $args += $Subcommand

    $previousPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = "Continue"
        $output = & docker @args 2>&1
        $exitCode = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $previousPreference
    }
    $output | Tee-Object -FilePath $FlywayLogFile -Append | Out-Null
    return $exitCode
}

function Apply-FlywayMigrations {
    if (-not (Is-Truthy $FlywayMigrateOnBoot)) {
        Log "Skipping Flyway migrate (FLYWAY_MIGRATE_ON_BOOT=$FlywayMigrateOnBoot)." -Color Yellow
        return
    }

    Wait-ForPostgresReady

    if (-not (Test-Path $FlywayLogDirPath)) {
        New-Item -ItemType Directory -Path $FlywayLogDirPath -Force | Out-Null
    }

    Log "Running Flyway migrate... (log: $FlywayLogFile)" -Color Cyan
    if ((Invoke-FlywayCommand "migrate") -eq 0) {
        return
    }

    if (-not (Is-Truthy $FlywayRepairOnValidation)) {
        Write-Error "Flyway migrate failed. Set FLYWAY_REPAIR_ON_VALIDATION=1 to auto-repair."
    }

    Log "Flyway migrate failed. Running flyway repair..." -Color Yellow
    if ((Invoke-FlywayCommand "repair") -ne 0) {
        Write-Error "Flyway repair failed."
    }

    Log "Retrying Flyway migrate after repair..." -Color Cyan
    if ((Invoke-FlywayCommand "migrate") -ne 0) {
        Write-Error "Flyway migrate failed after repair."
    }
}

function Is-OrcaConfigOnly {
    return (Is-Truthy $env:ORCA_CONFIG_ONLY)
}

function Wait-ForServer {
    Log "Waiting for server to be healthy... ($ServerHealthUrl)" -Color Cyan
    $retries = 60
    $success = $false
    for ($i = 1; $i -le $retries; $i++) {
        try {
            $headers = @{
                "userName" = $AdminUser
                "password" = $AdminPass
            }
            $response = Invoke-WebRequest -Uri $ServerHealthUrl -Headers $headers -Method Get -TimeoutSec 5 -ErrorAction SilentlyContinue -UseBasicParsing
            if ($response.StatusCode -eq 200) {
                $success = $true
                break
            }
        } catch { }
        Write-Host "." -NoNewline
        Start-Sleep -Seconds 5
    }
    Write-Host ""

    if (-not $success) {
        Write-Error "Server failed to start within timeout."
    }
    Log "Server is UP!" -Color Green
}

function Apply-BaselineSeed {
    Log "Applying local baseline seed ($LocalSeedFile)..." -Color Cyan
    if (-not (Test-Path $LocalSeedFile)) {
        Write-Error "Seed file not found: $LocalSeedFile"
    }
    if (-not (Test-ModernizedTable "d_facility")) {
        Log "Warning: d_facility table not found; skipping baseline seed. Initialize DB schema first." -Color Yellow
        return
    }
    docker cp $LocalSeedFile "${PostgresContainerName}:/tmp/modern_seed.sql"
    docker exec $PostgresContainerName psql -U opendolphin -d opendolphin_modern -v ON_ERROR_STOP=1 -f /tmp/modern_seed.sql
    Log "Baseline seed applied." -Color Green
}

function Register-InitialUser {
    Log "Registering initial user ($NewUserId) via SQL..." -Color Cyan
    if (-not (Test-ModernizedTable "d_users")) {
        Log "Warning: d_users table not found; skipping initial user registration." -Color Yellow
        return
    }
    $passHash = Get-MD5Hash $NewUserPass
    $compositeUserId = "$FacilityId`:$NewUserId"

    $sql = @"
SET search_path = public;

-- Ensure hibernate_sequence exists and is aligned
DO \$\$
DECLARE
    max_id BIGINT;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_class WHERE relname = 'hibernate_sequence' AND relkind = 'S'
    ) THEN
        CREATE SEQUENCE IF NOT EXISTS hibernate_sequence
            START WITH 1
            INCREMENT BY 1
            NO MINVALUE
            NO MAXVALUE
            CACHE 1;
    END IF;

    SELECT GREATEST(
        COALESCE((SELECT max(id) FROM d_facility), 0),
        COALESCE((SELECT max(id) FROM d_users), 0),
        COALESCE((SELECT max(id) FROM d_roles), 0),
        1
    ) INTO max_id;

    PERFORM setval('hibernate_sequence', max_id, true);
END\$\$;

-- Create facility if missing
INSERT INTO d_facility (id, facilityid, facilityname, membertype, registereddate, zipcode, address, telephone)
SELECT nextval('hibernate_sequence'), '$FacilityId', 'OpenDolphin Clinic', 'PROCESS', now(), '000-0000', 'Tokyo', '03-0000-0000'
WHERE NOT EXISTS (SELECT 1 FROM d_facility WHERE facilityid = '$FacilityId');

-- Create user if missing
INSERT INTO d_users (
    id, userid, password, commonname, facility_id, membertype, registereddate,
    sirname, givenname, email
)
SELECT
    nextval('hibernate_sequence'),
    '$compositeUserId',
    '$passHash',
    '$NewUserName',
    (SELECT id FROM d_facility WHERE facilityid = '$FacilityId'),
    'PROCESS',
    now(),
    '$NewUserSirName', '$NewUserGivenName', '$NewUserEmail'
WHERE NOT EXISTS (SELECT 1 FROM d_users WHERE userid = '$compositeUserId');

-- Keep default dev admin account aligned with configured credentials
UPDATE d_users
SET
    password = '$passHash',
    commonname = '$NewUserName',
    sirname = '$NewUserSirName',
    givenname = '$NewUserGivenName',
    email = '$NewUserEmail',
    facility_id = (SELECT id FROM d_facility WHERE facilityid = '$FacilityId')
WHERE userid = '$compositeUserId';

-- Create roles if missing
INSERT INTO d_roles (id, c_role, user_id, c_user)
SELECT nextval('hibernate_sequence'), 'admin', '$compositeUserId', id
FROM d_users WHERE userid = '$compositeUserId'
AND NOT EXISTS (SELECT 1 FROM d_roles WHERE user_id = '$compositeUserId' AND c_role = 'admin');

INSERT INTO d_roles (id, c_role, user_id, c_user)
SELECT nextval('hibernate_sequence'), 'user', '$compositeUserId', id
FROM d_users WHERE userid = '$compositeUserId'
AND NOT EXISTS (SELECT 1 FROM d_roles WHERE user_id = '$compositeUserId' AND c_role = 'user');

INSERT INTO d_roles (id, c_role, user_id, c_user)
SELECT nextval('hibernate_sequence'), 'doctor', '$compositeUserId', id
FROM d_users WHERE userid = '$compositeUserId'
AND NOT EXISTS (SELECT 1 FROM d_roles WHERE user_id = '$compositeUserId' AND c_role = 'doctor');
"@

    $tmpSql = Join-Path $env:TEMP "modern_user_seed.sql"
    [System.IO.File]::WriteAllText($tmpSql, $sql, (New-Object System.Text.UTF8Encoding $false))
    docker cp $tmpSql "${PostgresContainerName}:/tmp/modern_user_seed.sql"
    docker exec $PostgresContainerName psql -U opendolphin -d opendolphin_modern -v ON_ERROR_STOP=1 -f /tmp/modern_user_seed.sql
    Log "User registration SQL executed successfully." -Color Green
}

function Stop-ExistingWebClientDevServer {
    if (Test-Path $WebClientDevPidFilePath) {
        $idStr = Get-Content $WebClientDevPidFilePath -Raw
        if ($idStr -and ($idStr -match '^\d+$')) {
            $existingPid = [int]$idStr
            if (Get-Process -Id $existingPid -ErrorAction SilentlyContinue) {
                Log "Stopping existing Web Client dev server PID $existingPid..." -Color Yellow
                Stop-Process -Id $existingPid -Force -ErrorAction SilentlyContinue
            }
        }
        Remove-Item $WebClientDevPidFilePath -Force
    }

    try {
        $connections = Get-NetTCPConnection -LocalPort $WebClientDevPort -State Listen -ErrorAction SilentlyContinue
        foreach ($conn in $connections) {
            $p = Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue
            if ($p -and ($p.ProcessName -match "node|npm")) {
                Log "Clearing lingering listener on port $WebClientDevPort (PID $($p.Id))..." -Color Yellow
                Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
            }
        }
    } catch {}

    # Docker コンテナがポートを占有している可能性があるため停止
    Log "Stopping Web Client Docker container if running..."
    try {
        docker compose -f docker-compose.web-client.yml down *>&1 | Out-Null
    } catch {
        Log "Warning: Failed to stop docker container (ignoring): $_" -Color Yellow
    }
}

function Start-WebClient-Npm {
    Log "Starting Web Client dev server via npm run dev..." -Color Cyan
    if (-not (Test-Path (Split-Path $WebClientDevLogPath))) {
        New-Item -ItemType Directory -Path (Split-Path $WebClientDevLogPath) -Force | Out-Null
    }
    Stop-ExistingWebClientDevServer

    $devProxyTarget = $WebClientDevProxyTarget
    $devUseHttps = if ($env:VITE_DEV_USE_HTTPS) { $env:VITE_DEV_USE_HTTPS } else { "0" }
    $devDisableMsw = if ($env:VITE_DISABLE_MSW) { $env:VITE_DISABLE_MSW } else { "1" }
    $devEnableTelemetry = if ($env:VITE_ENABLE_TELEMETRY) { $env:VITE_ENABLE_TELEMETRY } else { "0" }
    $devDisableSecurity = if ($env:VITE_DISABLE_SECURITY) { $env:VITE_DISABLE_SECURITY } else { "0" }
    $devDisableAudit = if ($env:VITE_DISABLE_AUDIT) { $env:VITE_DISABLE_AUDIT } else { "0" }
    $devApiBaseUrl = if ($env:WEB_CLIENT_DEV_API_BASE) { $env:WEB_CLIENT_DEV_API_BASE } else { "/api" }
    $devOrcaMode = if ($env:ORCA_MODE) { $env:ORCA_MODE } elseif ($global:ORN_ORCA_MODE) { $global:ORN_ORCA_MODE } else { "" }
    $devOrcaPathPrefix = if ($env:ORCA_API_PATH_PREFIX) { $env:ORCA_API_PATH_PREFIX } else { "" }

    $envContent = @"
VITE_API_BASE_URL=$devApiBaseUrl
VITE_HTTP_TIMEOUT_MS=10000
VITE_HTTP_MAX_RETRIES=2
VITE_DEV_PROXY_TARGET=$devProxyTarget
VITE_DEV_USE_HTTPS=$devUseHttps
VITE_DISABLE_MSW=$devDisableMsw
VITE_ENABLE_TELEMETRY=$devEnableTelemetry
VITE_DISABLE_SECURITY=$devDisableSecurity
VITE_DISABLE_AUDIT=$devDisableAudit
VITE_SINGLE_FACILITY_LOGIN=$ViteSingleFacilityLogin
VITE_DEFAULT_FACILITY_ID=$ViteDefaultFacilityId
VITE_ORCA_MODE=$devOrcaMode
VITE_ORCA_API_PATH_PREFIX=$devOrcaPathPrefix
"@
    if (-not (Test-Path (Split-Path $WebClientEnvLocal))) {
        New-Item -ItemType Directory -Path (Split-Path $WebClientEnvLocal) -Force | Out-Null
    }
    [System.IO.File]::WriteAllText($WebClientEnvLocal, $envContent, (New-Object System.Text.UTF8Encoding $false))

    # 環境変数をセッションに設定（Start-Process で継承される）
    $env:VITE_DEV_PROXY_TARGET = $devProxyTarget
    $env:VITE_DEV_USE_HTTPS = $devUseHttps
    $env:VITE_DISABLE_MSW = $devDisableMsw
    $env:VITE_ENABLE_TELEMETRY = $devEnableTelemetry
    $env:VITE_DISABLE_SECURITY = $devDisableSecurity
    $env:VITE_DISABLE_AUDIT = $devDisableAudit
    $env:VITE_API_BASE_URL = $devApiBaseUrl
    $env:VITE_SINGLE_FACILITY_LOGIN = $ViteSingleFacilityLogin
    $env:VITE_DEFAULT_FACILITY_ID = $ViteDefaultFacilityId
    $env:VITE_ORCA_MODE = $devOrcaMode
    $env:VITE_ORCA_API_PATH_PREFIX = $devOrcaPathPrefix

    $webClientDir = Join-Path $ScriptDir "web-client"

    $npmCmd = "npm"
    if ($env:OS -match "Windows_NT") {
        $npmCmd = "npm.cmd"
    }
    
    # node_modules/.bin/vite.cmd が存在しない場合は npm install を実行
    $viteCmdPath = Join-Path $webClientDir "node_modules\.bin\vite.cmd"
    if (-not (Test-Path $viteCmdPath)) {
        Log "Dependencies missing (vite.cmd not found). Running 'npm install' in $webClientDir ..." -Color Yellow
        $installProc = Start-Process -FilePath $npmCmd -ArgumentList "install" `
            -WorkingDirectory $webClientDir `
            -NoNewWindow -PassThru -Wait
        
        if ($installProc.ExitCode -ne 0) {
            Write-Error "npm install failed with exit code $($installProc.ExitCode)"
        }
        Log "npm install completed." -Color Green
    }

    $npmArgsStr = "run dev -- --host $WebClientDevHost --port $WebClientDevPort"
    
    Log "  Executing: $npmCmd $npmArgsStr (in $webClientDir)"
    
    # Windows PowerShell 5.1 では Start-Process の -RedirectStandard* と -WindowStyle/-NoNewWindow が排他的
    # cmd.exe 経由でリダイレクトを行うことで回避
    $cmdArgs = "/c `"cd /d `"$webClientDir`" && set VITE_DEV_PROXY_TARGET=$devProxyTarget && set VITE_DEV_USE_HTTPS=$devUseHttps && set VITE_DISABLE_MSW=$devDisableMsw && set VITE_ENABLE_TELEMETRY=$devEnableTelemetry && set VITE_DISABLE_SECURITY=$devDisableSecurity && set VITE_DISABLE_AUDIT=$devDisableAudit && set VITE_API_BASE_URL=$devApiBaseUrl && set VITE_SINGLE_FACILITY_LOGIN=$ViteSingleFacilityLogin && set VITE_DEFAULT_FACILITY_ID=$ViteDefaultFacilityId && set VITE_ORCA_MODE=$devOrcaMode && set VITE_ORCA_API_PATH_PREFIX=$devOrcaPathPrefix && $npmCmd $npmArgsStr > `"$WebClientDevLogPath`" 2>&1`""
    
    $proc = Start-Process -FilePath "cmd.exe" -ArgumentList $cmdArgs -WindowStyle Hidden -PassThru
    
    $proc.Id | Out-File -FilePath $WebClientDevPidFilePath -NoNewline
    
    Log "Web Client dev server PID $($proc.Id), logs at $WebClientDevLogPath" -Color Yellow
    Log "Tail the log via 'Get-Content $WebClientDevLog -Wait' to watch the dev server output."
}

function Start-WebClient-Docker {
    Log "Starting Web Client container via docker-compose..." -Color Cyan
    $dockerProxyTarget = if ($WebClientDevProxyTargetOverride) { $WebClientDevProxyTargetOverride } else { $WebClientDockerProxyTargetDefault }
    $env:VITE_DEV_PROXY_TARGET = $dockerProxyTarget
    $env:VITE_API_BASE_URL = $WebClientDevApiBase
    $env:VITE_SINGLE_FACILITY_LOGIN = $ViteSingleFacilityLogin
    $env:VITE_DEFAULT_FACILITY_ID = $ViteDefaultFacilityId
    $env:VITE_ORCA_MODE = if ($env:ORCA_MODE) { $env:ORCA_MODE } elseif ($global:ORN_ORCA_MODE) { $global:ORN_ORCA_MODE } else { "" }
    $env:VITE_ORCA_API_PATH_PREFIX = if ($env:ORCA_API_PATH_PREFIX) { $env:ORCA_API_PATH_PREFIX } else { "" }
    docker compose -f docker-compose.web-client.yml up -d --build --force-recreate
}

function Start-WebClient {
    $mode = $WebClientMode.ToLower()
    if ($mode -match "^(npm|dev)") {
        Start-WebClient-Npm
    } else {
        Start-WebClient-Docker
    }
}

function Main {
    Read-OrcaInfo
    Resolve-DevAdminCredentials
    if (Is-OrcaConfigOnly) {
        Log "ORCA_CONFIG_ONLY=1: skipping docker startup." -Color Yellow
        return
    }
    Generate-CustomProperties
    Generate-ComposeOverride
    Start-ModernizedServer
    Apply-FlywayMigrations
    Wait-ForServer
    Apply-BaselineSeed
    Register-InitialUser
    Start-WebClient
    
    $mode = $WebClientMode.ToLower()
    if ($mode -match "^(npm|dev)") {
      Log "All set! Web Client dev server is listening at http://${WebClientDevHost}:${WebClientDevPort}" -Color Green
      Log "Logs: $WebClientDevLogPath"
    } else {
      Log "All set! Web Client is running at http://localhost:${WebClientDevPort}" -Color Green
    }
    Log "Login with User: $NewUserId / Pass: $NewUserPass" -Color Green
}

Main
