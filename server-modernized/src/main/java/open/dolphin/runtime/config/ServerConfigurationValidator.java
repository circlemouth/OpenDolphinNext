package open.dolphin.runtime.config;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;

/**
 * Startup validation for required runtime settings.
 */
@ApplicationScoped
public class ServerConfigurationValidator {

    @Inject
    ServerConfigurationResolver resolver;

    public ServerConfigurationValidator() {
    }

    ServerConfigurationValidator(ServerConfigurationResolver resolver) {
        this.resolver = resolver;
    }

    public void validateOrThrow() {
        List<String> errors = new ArrayList<>();

        validateRuntime(errors, resolver.runtime());
        validateOrcaRuntime(errors, resolver.orcaRuntime());
        validateOrcaLegacy(errors, resolver.orcaLegacy());
        validateDatasource(errors, resolver.orcaDatasource());
        validateFactor2(errors, resolver.factor2());
        validateOrcaSecretProtection(errors, resolver.orcaSecretProtection(), resolver.factor2());
        validateOrcaApi(errors, resolver.orcaApi());
        validateOrcaTransportHttp(errors, resolver.orcaTransportHttp());
        validateOrcaPushEventCache(errors, resolver.orcaPushEventCache());
        validateMetrics(errors, resolver.metrics());
        validateSystemNetwork(errors, resolver.systemNetwork());
        validateAudit(errors, resolver.audit());
        validateTemplates(errors, resolver.templates());
        validateLicense(errors, resolver.license());
        validatePvtOperations(errors, resolver.pvtOperations());
        validateSmtp(errors, resolver.smtp());
        validateAttachmentStorage(errors, resolver.attachmentStorage());
        validateDocumentIntegrity(errors, resolver.documentIntegrity());
        validatePatientImages(errors, resolver.patientImages());
        validateChartEventHistory(errors, resolver.chartEventHistory());
        validateFido2(errors, resolver.fido2());

        if (!errors.isEmpty()) {
            throw new IllegalStateException("Startup configuration validation failed: " + String.join(" | ", errors));
        }
    }

    private void validateRuntime(List<String> errors, ServerRuntimeConfiguration.RuntimeSettings settings) {
        if (settings.environment() == null || settings.environment().isBlank()) {
            errors.add(ServerConfigurationResolver.KEY_ENVIRONMENT + " is required");
        }
        if (settings.timezone() == null) {
            errors.add(ServerConfigurationResolver.KEY_TIMEZONE + " is invalid");
        }
        if (settings.serverDataDirectory() == null || settings.serverDataDirectory().isBlank()) {
            errors.add(ServerConfigurationResolver.KEY_SERVER_DATA_DIR + " is required");
        }
    }

    private void validateDatasource(List<String> errors, ServerRuntimeConfiguration.DatasourceSettings settings) {
        if (settings == null) {
            errors.add("Datasource configuration is missing");
            return;
        }
        List<String> missing = new ArrayList<>();
        if (isBlank(settings.host())) {
            missing.add(settings.namespace() + ".host");
        }
        if (isBlank(settings.database())) {
            missing.add(settings.namespace() + ".name");
        }
        if (isBlank(settings.user())) {
            missing.add(settings.namespace() + ".user");
        }
        if (isBlank(settings.password())) {
            missing.add(settings.namespace() + ".password");
        }
        if (settings.port() == null) {
            missing.add(settings.namespace() + ".port");
        } else if (settings.port() < 1 || settings.port() > 65535) {
            errors.add(settings.namespace() + ".port must be between 1 and 65535");
        }
        if (isBlank(settings.sslMode())) {
            missing.add(settings.namespace() + ".sslmode");
        }
        if (settings.sslRootCert() == null) {
            missing.add(settings.namespace() + ".sslrootcert");
        }
        if (!missing.isEmpty()) {
            errors.add("Datasource configuration is incomplete: " + String.join(",", missing));
        }
    }

    private void validateOrcaRuntime(List<String> errors, ServerRuntimeConfiguration.OrcaRuntimeSettings settings) {
        if (settings == null) {
            errors.add(ServerConfigurationResolver.KEY_FACILITY_ID + " is required");
            errors.add(ServerConfigurationResolver.KEY_CLOUD_ZERO + " is required");
            return;
        }
        requireNonBlank(errors, ServerConfigurationResolver.KEY_FACILITY_ID, settings.facilityId());
        if (resolver.optional(ServerConfigurationResolver.KEY_CLOUD_ZERO).isEmpty()) {
            errors.add(ServerConfigurationResolver.KEY_CLOUD_ZERO + " is required");
        }
        ServerRuntimeConfiguration.PvtListenerSettings pvt = settings.pvtListener();
        if (pvt == null || !pvt.enabled()) {
            return;
        }
        requireNonBlank(errors, ServerConfigurationResolver.KEY_PVT_BIND_IP, pvt.bindIp());
        requirePositive(errors, ServerConfigurationResolver.KEY_PVT_PORT, pvt.port());
        requireNonBlank(errors, ServerConfigurationResolver.KEY_PVT_ENCODING, pvt.encoding());
        requirePositive(errors, ServerConfigurationResolver.KEY_PVT_ACCEPT_TIMEOUT_MILLIS, pvt.acceptTimeoutMillis());
        requirePositive(errors, ServerConfigurationResolver.KEY_PVT_READ_TIMEOUT_MILLIS, pvt.readTimeoutMillis());
        requirePositive(errors, ServerConfigurationResolver.KEY_PVT_MAX_THREADS, pvt.maxThreads());
        requirePositive(errors, ServerConfigurationResolver.KEY_PVT_QUEUE_CAPACITY, pvt.queueCapacity());
        requireNonNegative(errors, ServerConfigurationResolver.KEY_PVT_RETRY_MAX, pvt.retryMax());
        requireNonNegative(errors, ServerConfigurationResolver.KEY_PVT_RETRY_BACKOFF_MILLIS, pvt.retryBackoffMillis());
        requirePositive(errors, ServerConfigurationResolver.KEY_PVT_IDEMPOTENCY_WINDOW_MILLIS, pvt.idempotencyWindowMillis());
        requirePositive(errors, ServerConfigurationResolver.KEY_PVT_POISON_QUEUE_CAPACITY, pvt.poisonQueueCapacity());
    }

    private void validateOrcaLegacy(List<String> errors, ServerRuntimeConfiguration.OrcaLegacySettings settings) {
        if (settings == null) {
            return;
        }
        if (!isBlank(settings.facilityJmariCode()) && settings.facilityJmariCode().trim().length() != 12) {
            errors.add(ServerConfigurationResolver.KEY_ORCA_FACILITY_JMARI_CODE + " must be 12 characters");
        }
        if (!isBlank(settings.healthcareFacilityCode()) && settings.healthcareFacilityCode().trim().length() != 10) {
            errors.add(ServerConfigurationResolver.KEY_ORCA_FACILITY_HEALTHCAREFACILITY_CODE + " must be 10 characters");
        }
        if (!isBlank(settings.defaultPrescriptionInOut())) {
            String normalized = settings.defaultPrescriptionInOut().trim().toLowerCase();
            if (!"in".equals(normalized) && !"out".equals(normalized)) {
                errors.add(ServerConfigurationResolver.KEY_ORCA_RP_DEFAULT_INOUT + " must be in or out");
            }
        }
    }

    private void validateFactor2(List<String> errors, ServerRuntimeConfiguration.Factor2Settings settings) {
        if (isBlank(settings.aesKeyBase64())) {
            errors.add(ServerConfigurationResolver.KEY_FACTOR2_AES_KEY_B64 + " is required");
            return;
        }
        try {
            byte[] decoded = Base64.getDecoder().decode(settings.aesKeyBase64());
            if (decoded.length < 32) {
                errors.add(ServerConfigurationResolver.KEY_FACTOR2_AES_KEY_B64 + " must decode to at least 32 bytes");
            }
        } catch (IllegalArgumentException ex) {
            errors.add(ServerConfigurationResolver.KEY_FACTOR2_AES_KEY_B64 + " must be valid Base64");
        }
    }

    private void validateOrcaSecretProtection(List<String> errors,
                                              ServerRuntimeConfiguration.OrcaSecretProtectionSettings settings,
                                              ServerRuntimeConfiguration.Factor2Settings factor2Settings) {
        if (settings == null || isBlank(settings.aesKeyBase64())) {
            errors.add(ServerConfigurationResolver.KEY_ORCA_CREDENTIALS_AES_KEY_B64 + " is required");
            return;
        }
        byte[] decoded = decodeAesKey(errors,
                ServerConfigurationResolver.KEY_ORCA_CREDENTIALS_AES_KEY_B64,
                settings.aesKeyBase64());
        byte[] factor2Decoded = null;
        if (factor2Settings != null && !isBlank(factor2Settings.aesKeyBase64())) {
            factor2Decoded = decodeAesKey(errors,
                    ServerConfigurationResolver.KEY_FACTOR2_AES_KEY_B64,
                    factor2Settings.aesKeyBase64());
        }
        if (decoded != null && factor2Decoded != null && java.util.Arrays.equals(decoded, factor2Decoded)) {
            errors.add(ServerConfigurationResolver.KEY_ORCA_CREDENTIALS_AES_KEY_B64
                    + " must differ from " + ServerConfigurationResolver.KEY_FACTOR2_AES_KEY_B64);
        }
    }

    private void validateOrcaApi(List<String> errors, ServerRuntimeConfiguration.OrcaApiSettings settings) {
        if (settings == null) {
            errors.add(ServerConfigurationResolver.KEY_ORCA_API_MODE + " is required");
            return;
        }
        String mode = trimToNull(settings.mode());
        if (mode == null) {
            errors.add(ServerConfigurationResolver.KEY_ORCA_API_MODE + " is required");
        } else {
            String normalized = mode.toLowerCase();
            if (!"weborca".equals(normalized) && !"onprem".equals(normalized)) {
                errors.add(ServerConfigurationResolver.KEY_ORCA_API_MODE + " must be weborca or onprem");
            }
        }

        boolean hasBaseUrl = trimToNull(settings.baseUrl()) != null;
        boolean hasHostPortScheme = trimToNull(settings.host()) != null
                || settings.port() != null
                || trimToNull(settings.scheme()) != null;
        if (!hasBaseUrl && !hasHostPortScheme) {
            errors.add(ServerConfigurationResolver.KEY_ORCA_API_BASE_URL
                    + " or " + ServerConfigurationResolver.KEY_ORCA_API_HOST + "/port/scheme is required");
        }
        if (hasBaseUrl && hasHostPortScheme) {
            errors.add(ServerConfigurationResolver.KEY_ORCA_API_BASE_URL
                    + " must not be combined with " + ServerConfigurationResolver.KEY_ORCA_API_HOST + "/port/scheme");
        }
        if (hasBaseUrl) {
            try {
                URI uri = new URI(settings.baseUrl());
                if (trimToNull(uri.getScheme()) == null || trimToNull(uri.getHost()) == null) {
                    errors.add(ServerConfigurationResolver.KEY_ORCA_API_BASE_URL + " must be an absolute URI");
                }
            } catch (URISyntaxException ex) {
                errors.add(ServerConfigurationResolver.KEY_ORCA_API_BASE_URL + " must be a valid URI");
            }
        } else {
            requireNonBlank(errors, ServerConfigurationResolver.KEY_ORCA_API_HOST, settings.host());
            if (settings.port() == null || settings.port() < 1 || settings.port() > 65535) {
                errors.add(ServerConfigurationResolver.KEY_ORCA_API_PORT + " must be between 1 and 65535");
            }
            String scheme = trimToNull(settings.scheme());
            if (scheme == null) {
                errors.add(ServerConfigurationResolver.KEY_ORCA_API_SCHEME + " is required");
            } else {
                String normalized = scheme.toLowerCase();
                if (!"http".equals(normalized) && !"https".equals(normalized)) {
                    errors.add(ServerConfigurationResolver.KEY_ORCA_API_SCHEME + " must be http or https");
                }
            }
        }

        requireNonBlank(errors, ServerConfigurationResolver.KEY_ORCA_API_USER, settings.user());
        requireNonBlank(errors, ServerConfigurationResolver.KEY_ORCA_API_PASSWORD, settings.password());
        if (!isBlank(settings.pathPrefix()) && !settings.pathPrefix().startsWith("/")) {
            errors.add(ServerConfigurationResolver.KEY_ORCA_API_PATH_PREFIX + " must start with '/'");
        }
        if (settings.retryMax() != null && settings.retryMax() < 0) {
            errors.add(ServerConfigurationResolver.KEY_ORCA_API_RETRY_MAX + " must be >= 0");
        }
        if (settings.retryBackoffMs() != null && settings.retryBackoffMs() < 0L) {
            errors.add(ServerConfigurationResolver.KEY_ORCA_API_RETRY_BACKOFF_MS + " must be >= 0");
        }
    }

    private void validateOrcaTransportHttp(List<String> errors, ServerRuntimeConfiguration.OrcaTransportHttpSettings settings) {
        if (settings == null) {
            return;
        }
        if (settings.networkRetryMax() != null && settings.networkRetryMax() < 0) {
            errors.add(ServerConfigurationResolver.KEY_ORCA_API_RETRY_NETWORK_MAX + " must be >= 0");
        }
        if (settings.transientRetryMax() != null && settings.transientRetryMax() < 0) {
            errors.add(ServerConfigurationResolver.KEY_ORCA_API_RETRY_TRANSIENT_MAX + " must be >= 0");
        }
        if (settings.networkRetryBackoffMs() != null && settings.networkRetryBackoffMs() < 0L) {
            errors.add(ServerConfigurationResolver.KEY_ORCA_API_RETRY_NETWORK_BACKOFF_MS + " must be >= 0");
        }
        if (settings.transientRetryBackoffMs() != null && settings.transientRetryBackoffMs() < 0L) {
            errors.add(ServerConfigurationResolver.KEY_ORCA_API_RETRY_TRANSIENT_BACKOFF_MS + " must be >= 0");
        }
        requirePositiveDuration(errors, ServerConfigurationResolver.KEY_ORCA_API_CONNECT_TIMEOUT_MS, settings.connectTimeout());
        requirePositiveDuration(errors, ServerConfigurationResolver.KEY_ORCA_API_READ_TIMEOUT_MS, settings.readTimeout());
        requirePositiveDuration(errors, ServerConfigurationResolver.KEY_ORCA_API_TOTAL_TIMEOUT_MS, settings.totalTimeout());
        if (!isBlank(settings.logMode())) {
            String normalized = settings.logMode().trim().toLowerCase();
            if (!"quiet".equals(normalized)
                    && !"summary".equals(normalized)
                    && !"detail".equals(normalized)
                    && !"debug".equals(normalized)) {
                errors.add(ServerConfigurationResolver.KEY_ORCA_HTTP_LOG_MODE + " must be quiet, summary, detail or debug");
            }
        }
        if (settings.cacheTtlMs() != null && settings.cacheTtlMs() < 0L) {
            errors.add(ServerConfigurationResolver.KEY_ORCA_TRANSPORT_CACHE_TTL_MS + " must be >= 0");
        }
    }

    private void validateOrcaPushEventCache(
            List<String> errors, ServerRuntimeConfiguration.PushEventCacheSettings settings) {
        if (settings == null) {
            return;
        }
        if (settings.maxEntries() != null && settings.maxEntries() < 1) {
            errors.add(ServerConfigurationResolver.KEY_ORCA_PUSH_EVENT_CACHE_MAX + " must be >= 1");
        }
        if (settings.ttlDays() != null && settings.ttlDays() < 1L) {
            errors.add(ServerConfigurationResolver.KEY_ORCA_PUSH_EVENT_CACHE_TTL_DAYS + " must be >= 1");
        }
    }

    private void validateMetrics(List<String> errors, ServerRuntimeConfiguration.MetricsSettings settings) {
        if (settings == null) {
            return;
        }
        if (settings.registryJndi() != null && settings.registryJndi().isBlank()) {
            errors.add(ServerConfigurationResolver.KEY_METRICS_REGISTRY_JNDI + " must not be blank");
        }
    }

    private void validateSystemNetwork(List<String> errors, ServerRuntimeConfiguration.SystemNetworkSettings settings) {
        if (settings == null) {
            return;
        }
        if (settings.bindAddress() != null && settings.bindAddress().isBlank()) {
            errors.add(ServerConfigurationResolver.KEY_BIND_ADDRESS + " must not be blank");
        }
    }

    private void validateAudit(List<String> errors, ServerRuntimeConfiguration.AuditSettings settings) {
        if (settings == null) {
            return;
        }
        for (String rule : settings.trustedProxyRules()) {
            if (rule == null || rule.isBlank()) {
                errors.add(ServerConfigurationResolver.KEY_AUDIT_TRUSTED_PROXIES + " must not contain blank rules");
            }
        }
    }

    private void validateTemplates(List<String> errors, ServerRuntimeConfiguration.TemplatesSettings settings) {
        if (settings == null) {
            return;
        }
        if (settings.directory() != null && !settings.directory().isAbsolute()) {
            errors.add(ServerConfigurationResolver.KEY_TEMPLATES_DIR + " must be an absolute path");
        }
    }

    private void validateLicense(List<String> errors, ServerRuntimeConfiguration.LicenseSettings settings) {
        if (settings == null) {
            return;
        }
        if (settings.directory() != null && !settings.directory().isAbsolute()) {
            errors.add(ServerConfigurationResolver.KEY_LICENSE_DIR + " must be an absolute path");
        }
    }

    private void validatePvtOperations(List<String> errors, ServerRuntimeConfiguration.PvtOperationSettings settings) {
        if (settings == null) {
            return;
        }
    }

    private void validateSmtp(List<String> errors, ServerRuntimeConfiguration.SmtpSettings settings) {
        if (settings == null) {
            return;
        }
        boolean configured = trimToNull(settings.host()) != null
                || trimToNull(settings.port()) != null
                || trimToNull(settings.username()) != null
                || trimToNull(settings.password()) != null
                || trimToNull(settings.from()) != null
                || trimToNull(settings.activityTo()) != null;
        if (!configured) {
            return;
        }
        requireNonBlank(errors, ServerConfigurationResolver.KEY_SMTP_HOST, settings.host());
        requireNonBlank(errors, ServerConfigurationResolver.KEY_SMTP_FROM, settings.from());
        if (!isBlank(settings.port())) {
            try {
                if (Integer.parseInt(settings.port().trim()) < 1) {
                    errors.add(ServerConfigurationResolver.KEY_SMTP_PORT + " must be >= 1");
                }
            } catch (NumberFormatException ex) {
                errors.add(ServerConfigurationResolver.KEY_SMTP_PORT + " must be numeric");
            }
        }
        boolean authRequired = Boolean.TRUE.equals(settings.auth())
                || trimToNull(settings.username()) != null
                || trimToNull(settings.password()) != null;
        if (authRequired) {
            requireNonBlank(errors, ServerConfigurationResolver.KEY_SMTP_USERNAME, settings.username());
            requireNonBlank(errors, ServerConfigurationResolver.KEY_SMTP_PASSWORD, settings.password());
        }
    }

    private void validateAttachmentStorage(List<String> errors, ServerRuntimeConfiguration.AttachmentStorageSettings settings) {
        if (settings == null || isBlank(settings.mode())) {
            errors.add(ServerConfigurationResolver.KEY_ATTACHMENT_STORAGE_MODE + " is required");
            return;
        }
        String mode = settings.mode().trim().toLowerCase();
        switch (mode) {
            case "database" -> {
                if (isBlank(settings.databaseLobTable())) {
                    errors.add(ServerConfigurationResolver.KEY_ATTACHMENT_STORAGE_DATABASE_LOB_TABLE + " is required");
                }
            }
            case "s3" -> validateAttachmentS3(errors, settings.s3());
            default -> errors.add(ServerConfigurationResolver.KEY_ATTACHMENT_STORAGE_MODE + " must be database or s3");
        }
    }

    private void validateAttachmentS3(List<String> errors, ServerRuntimeConfiguration.S3StorageSettings settings) {
        if (settings == null) {
            errors.add(ServerConfigurationResolver.KEY_ATTACHMENT_STORAGE_S3_BUCKET + " is required");
            errors.add(ServerConfigurationResolver.KEY_ATTACHMENT_STORAGE_S3_REGION + " is required");
            errors.add(ServerConfigurationResolver.KEY_ATTACHMENT_STORAGE_S3_ACCESS_KEY + " is required");
            errors.add(ServerConfigurationResolver.KEY_ATTACHMENT_STORAGE_S3_SECRET_KEY + " is required");
            return;
        }
        requireNonBlank(errors, ServerConfigurationResolver.KEY_ATTACHMENT_STORAGE_S3_BUCKET, settings.bucket());
        requireNonBlank(errors, ServerConfigurationResolver.KEY_ATTACHMENT_STORAGE_S3_REGION, settings.region());
        requireNonBlank(errors, ServerConfigurationResolver.KEY_ATTACHMENT_STORAGE_S3_ACCESS_KEY, settings.accessKey());
        requireNonBlank(errors, ServerConfigurationResolver.KEY_ATTACHMENT_STORAGE_S3_SECRET_KEY, settings.secretKey());
        if (settings.multipartThresholdMb() != null && settings.multipartThresholdMb() < 5) {
            errors.add(ServerConfigurationResolver.KEY_ATTACHMENT_STORAGE_S3_MULTIPART_THRESHOLD_MB + " must be >= 5");
        }
        if (!isBlank(settings.endpoint())) {
            try {
                new URI(settings.endpoint());
            } catch (URISyntaxException ex) {
                errors.add(ServerConfigurationResolver.KEY_ATTACHMENT_STORAGE_S3_ENDPOINT + " must be a valid URI");
            }
        }
    }

    private void validateDocumentIntegrity(List<String> errors, ServerRuntimeConfiguration.DocumentIntegritySettings settings) {
        if (settings == null || isBlank(settings.mode())) {
            errors.add(ServerConfigurationResolver.KEY_DOCUMENT_INTEGRITY_MODE + " is required");
            return;
        }
        String mode = settings.mode().trim().toLowerCase();
        switch (mode) {
            case "off" -> {
                return;
            }
            case "permissive", "enforce" -> {
                if (settings.keyringPath() == null) {
                    errors.add(ServerConfigurationResolver.KEY_DOCUMENT_INTEGRITY_KEYRING_PATH + " is required");
                    return;
                }
                try {
                    open.dolphin.security.integrity.DocumentIntegrityConfig.validateKeyring(
                            open.dolphin.security.integrity.DocumentIntegrityConfig.requireAbsolutePath(
                                    settings.keyringPath(),
                                    ServerConfigurationResolver.KEY_DOCUMENT_INTEGRITY_KEYRING_PATH));
                } catch (IllegalStateException ex) {
                    errors.add(ex.getMessage());
                }
            }
            default -> errors.add(ServerConfigurationResolver.KEY_DOCUMENT_INTEGRITY_MODE + " must be off, permissive or enforce");
        }
    }

    private void validatePatientImages(List<String> errors, ServerRuntimeConfiguration.PatientImagesSettings settings) {
        if (settings == null || !settings.enabled()) {
            return;
        }
        if (settings.maxBytes() == null) {
            errors.add(ServerConfigurationResolver.KEY_PATIENT_IMAGES_MAX_BYTES + " is required");
        } else if (settings.maxBytes() < 1024L * 1024L || settings.maxBytes() > 20L * 1024L * 1024L) {
            errors.add(ServerConfigurationResolver.KEY_PATIENT_IMAGES_MAX_BYTES + " must be between 1048576 and 20971520");
        }
        if (settings.maxWidth() == null) {
            errors.add(ServerConfigurationResolver.KEY_PATIENT_IMAGES_MAX_WIDTH + " is required");
        } else if (settings.maxWidth() < 1 || settings.maxWidth() > 8192) {
            errors.add(ServerConfigurationResolver.KEY_PATIENT_IMAGES_MAX_WIDTH + " must be between 1 and 8192");
        }
        if (settings.maxHeight() == null) {
            errors.add(ServerConfigurationResolver.KEY_PATIENT_IMAGES_MAX_HEIGHT + " is required");
        } else if (settings.maxHeight() < 1 || settings.maxHeight() > 8192) {
            errors.add(ServerConfigurationResolver.KEY_PATIENT_IMAGES_MAX_HEIGHT + " must be between 1 and 8192");
        }
    }

    private void validateFido2(List<String> errors, ServerRuntimeConfiguration.Fido2Settings settings) {
        if (isBlank(settings.relyingPartyId())) {
            errors.add(ServerConfigurationResolver.KEY_FIDO2_RP_ID + " is required");
        }
        if (isBlank(settings.relyingPartyName())) {
            errors.add(ServerConfigurationResolver.KEY_FIDO2_RP_NAME + " is required");
        }
        if (settings.allowedOrigins().isEmpty()) {
            errors.add(ServerConfigurationResolver.KEY_FIDO2_ALLOWED_ORIGINS + " must contain at least one origin");
            return;
        }
        for (String origin : settings.allowedOrigins()) {
            try {
                URI uri = new URI(origin);
                String scheme = uri.getScheme();
                if (!"http".equalsIgnoreCase(scheme) && !"https".equalsIgnoreCase(scheme)) {
                    errors.add("Invalid FIDO2 origin scheme: " + origin);
                }
            } catch (URISyntaxException ex) {
                errors.add("Invalid FIDO2 origin: " + origin);
            }
        }
    }

    private void validateChartEventHistory(List<String> errors, ServerRuntimeConfiguration.ChartEventHistorySettings settings) {
        if (settings == null) {
            return;
        }
        if (settings.replayLimit() != null && settings.replayLimit() < 1) {
            errors.add(ServerConfigurationResolver.KEY_CHART_EVENT_HISTORY_REPLAY_LIMIT + " must be >= 1");
        }
        if (settings.retentionCount() != null && settings.retentionCount() < 0) {
            errors.add(ServerConfigurationResolver.KEY_CHART_EVENT_HISTORY_RETENTION_COUNT + " must be >= 0");
        }
        if (settings.retentionDuration() != null && settings.retentionDuration().isNegative()) {
            errors.add(ServerConfigurationResolver.KEY_CHART_EVENT_HISTORY_RETENTION_HOURS + " must be >= 0");
        }
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private void requireNonBlank(List<String> errors, String key, String value) {
        if (isBlank(value)) {
            errors.add(key + " is required");
        }
    }

    private void requirePositive(List<String> errors, String key, Integer value) {
        if (value == null) {
            errors.add(key + " is required");
        } else if (value < 1) {
            errors.add(key + " must be >= 1");
        }
    }

    private void requirePositive(List<String> errors, String key, Long value) {
        if (value == null) {
            errors.add(key + " is required");
        } else if (value < 1L) {
            errors.add(key + " must be >= 1");
        }
    }

    private void requirePositiveDuration(List<String> errors, String key, java.time.Duration value) {
        if (value != null && (value.isNegative() || value.isZero())) {
            errors.add(key + " must be > 0");
        }
    }

    private void requireNonNegative(List<String> errors, String key, Integer value) {
        if (value == null) {
            errors.add(key + " is required");
        } else if (value < 0) {
            errors.add(key + " must be >= 0");
        }
    }

    private byte[] decodeAesKey(List<String> errors, String key, String value) {
        if (isBlank(value)) {
            return null;
        }
        try {
            byte[] decoded = Base64.getDecoder().decode(value);
            if (decoded.length < 32) {
                errors.add(key + " must decode to at least 32 bytes");
                return null;
            }
            return decoded;
        } catch (IllegalArgumentException ex) {
            errors.add(key + " must be valid Base64");
            return null;
        }
    }
}
