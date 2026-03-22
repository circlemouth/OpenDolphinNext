package open.dolphin.runtime.config;

import java.nio.file.Path;
import java.time.Duration;
import java.time.ZoneId;
import java.util.List;

/**
 * Typed runtime configuration contract for production server startup.
 */
public final class ServerRuntimeConfiguration {

    private ServerRuntimeConfiguration() {
    }

    public record RuntimeSettings(
            String environment,
            ZoneId timezone,
            String serverDataDirectory
    ) {
    }

    public record OrcaRuntimeSettings(
            String facilityId,
            boolean cloudZero,
            PvtListenerSettings pvtListener
    ) {
    }

    public record OrcaLegacySettings(
            String facilityJmariCode,
            String healthcareFacilityCode,
            String defaultPrescriptionInOut
    ) {
    }

    public record PvtListenerSettings(
            boolean enabled,
            String bindIp,
            Integer port,
            String encoding,
            Integer acceptTimeoutMillis,
            Integer readTimeoutMillis,
            Integer maxThreads,
            Integer queueCapacity,
            Integer retryMax,
            Integer retryBackoffMillis,
            Long idempotencyWindowMillis,
            Integer poisonQueueCapacity
    ) {
    }

    public record PvtWorkerHealthSettings(
            Long staleSuccessSeconds,
            Long maxProcessingMillis
    ) {
    }

    public record DatasourceSettings(
            String namespace,
            String host,
            Integer port,
            String database,
            String user,
            String password,
            String sslMode,
            Path sslRootCert,
            String secretRef,
            String secretVersion
    ) {
        public boolean isComplete() {
            return host != null && !host.isBlank()
                    && database != null && !database.isBlank()
                    && user != null && !user.isBlank()
                    && password != null && !password.isBlank();
        }
    }

    public record Factor2Settings(String aesKeyBase64) {
    }

    public record OrcaSecretProtectionSettings(String aesKeyBase64) {
    }

    public record OrcaApiSettings(
            String baseUrl,
            String mode,
            String host,
            Integer port,
            String scheme,
            String user,
            String password,
            String pathPrefix,
            Boolean weborca,
            Integer retryMax,
            Long retryBackoffMs
    ) {
    }

    public record OrcaTransportHttpSettings(
            Integer networkRetryMax,
            Integer transientRetryMax,
            Long networkRetryBackoffMs,
            Long transientRetryBackoffMs,
            Duration connectTimeout,
            Duration readTimeout,
            Duration totalTimeout,
            String logMode,
            Boolean allowInsecureHttp,
            Long cacheTtlMs
    ) {
    }

    public record OrcaProxySettings(
            Boolean forwardXOrcaHeaders,
            Boolean forwardApiResultMessageHeader
    ) {
    }

    public record OrcaPushSettings(
            boolean enabled,
            boolean shadowMode,
            boolean receptionEnabled,
            boolean medicalEnabled,
            Integer connectTimeoutMs,
            Integer pingIntervalSeconds,
            Integer idleTimeoutSeconds,
            Integer reconnectInitialDelayMs,
            Integer reconnectMaxDelayMs,
            boolean recoveryEnabled,
            boolean recoveryUsePusheventget,
            Integer recoveryIntervalMinutes,
            Integer recoveryInitialLookbackMinutes,
            Integer recoveryOverlapMinutes,
            Integer dedupRetentionDays
    ) {
    }

    public record MasterUpdateSchedulerSettings(boolean enabled) {
    }

    public record MetricsSettings(String registryJndi) {
    }

    public record SystemNetworkSettings(String bindAddress) {
    }

    public record AuditSettings(List<String> trustedProxyRules) {
        public AuditSettings {
            trustedProxyRules = trustedProxyRules == null ? List.of() : List.copyOf(trustedProxyRules);
        }
    }

    public record TemplatesSettings(Path directory) {
    }

    public record LicenseSettings(Path directory) {
    }

    public record PvtOperationSettings(boolean listClearEnabled) {
    }

    public record SmtpSettings(
            String host,
            String port,
            Boolean auth,
            String username,
            String password,
            String from,
            String bcc,
            Boolean startTls,
            String activityTo
    ) {
    }

    public record AttachmentStorageSettings(
            String mode,
            String databaseLobTable,
            S3StorageSettings s3
    ) {
    }

    public record S3StorageSettings(
            String bucket,
            String region,
            String endpoint,
            String basePath,
            Boolean forcePathStyle,
            String serverSideEncryption,
            String kmsKeyId,
            Integer multipartThresholdMb,
            String accessKey,
            String secretKey
    ) {
    }

    public record DocumentIntegritySettings(
            String mode,
            Path keyringPath
    ) {
    }

    public record PatientImagesSettings(
            boolean enabled,
            Long maxBytes,
            Integer maxWidth,
            Integer maxHeight
    ) {
    }

    public record OrcaPatientSyncSettings(
            boolean enabled,
            Integer intervalMinutes,
            Integer initialLookbackDays,
            boolean includeTestPatient,
            boolean includeInsurance,
            String facilityId
    ) {
    }

    public record ChartEventHistoryPurgeSettings(
            boolean enabled,
            Integer intervalMinutes
    ) {
    }

    public record ChartEventHistorySettings(
            Integer replayLimit,
            Integer retentionCount,
            Duration retentionDuration
    ) {
    }

    public record Fido2Settings(
            String relyingPartyId,
            String relyingPartyName,
            List<String> allowedOrigins
    ) {
        public Fido2Settings {
            allowedOrigins = allowedOrigins == null ? List.of() : List.copyOf(allowedOrigins);
        }
    }

    public record PlivoSettings(
            String authId,
            String authToken,
            String sourceNumber,
            String baseUrl,
            String environment,
            String defaultCountryCode,
            String logLevel,
            Boolean logMessageContent,
            Duration connectTimeout,
            Duration readTimeout,
            Duration writeTimeout,
            Duration callTimeout,
            Boolean retryOnConnectionFailure
    ) {
    }
}
