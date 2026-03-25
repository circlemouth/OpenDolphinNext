package open.dolphin.runtime.config;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.Map;
import open.dolphin.testsupport.MicroProfileConfigTestSupport;
import org.eclipse.microprofile.config.Config;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class ServerConfigurationResolverTest {

    @TempDir
    Path tempDir;

    @Test
    void resolvesOrcaSpecificDatasourceNamespaceWhenPresent() {
        ServerRuntimeConfiguration.DatasourceSettings settings = TestServerConfigurationResolvers.resolver(
                ServerConfigurationResolver.KEY_ORCA_DB_HOST, "orca-db",
                ServerConfigurationResolver.KEY_ORCA_DB_PORT, "5432",
                ServerConfigurationResolver.KEY_ORCA_DB_NAME, "orca",
                ServerConfigurationResolver.KEY_ORCA_DB_USER, "orca_user",
                ServerConfigurationResolver.KEY_ORCA_DB_PASSWORD, "secret")
                .orcaDatasource();

        assertEquals("orca.db", settings.namespace());
        assertEquals("orca-db", settings.host());
        assertEquals(5432, settings.port());
        assertEquals("orca", settings.database());
        assertEquals("orca_user", settings.user());
    }

    @Test
    void fallsBackToGenericDatasourceNamespaceWhenOrcaSpecificKeysAreAbsent() {
        ServerRuntimeConfiguration.DatasourceSettings settings = TestServerConfigurationResolvers.resolver(
                ServerConfigurationResolver.KEY_DB_HOST, "shared-db",
                ServerConfigurationResolver.KEY_DB_NAME, "opendolphin",
                ServerConfigurationResolver.KEY_DB_USER, "app",
                ServerConfigurationResolver.KEY_DB_PASSWORD, "pw")
                .orcaDatasource();

        assertEquals("db", settings.namespace());
        assertEquals("shared-db", settings.host());
        assertNull(settings.port());
        assertEquals("opendolphin", settings.database());
    }

    @Test
    void resolvesOrcaRuntimeSettingsAsTypedValues() {
        ServerRuntimeConfiguration.OrcaRuntimeSettings settings = TestServerConfigurationResolvers.resolver(
                ServerConfigurationResolver.KEY_FACILITY_ID, "facility01",
                ServerConfigurationResolver.KEY_CLOUD_ZERO, "true",
                ServerConfigurationResolver.KEY_PVT_ENABLED, "true",
                ServerConfigurationResolver.KEY_PVT_BIND_IP, "127.0.0.1",
                ServerConfigurationResolver.KEY_PVT_PORT, "5001")
                .orcaRuntime();

        assertEquals("facility01", settings.facilityId());
        assertEquals(true, settings.cloudZero());
        assertEquals(true, settings.pvtListener().enabled());
        assertEquals("127.0.0.1", settings.pvtListener().bindIp());
        assertEquals(5001, settings.pvtListener().port());
    }

    @Test
    void resolvesLegacyRuntimeCleanupSettings() {
        ServerConfigurationResolver resolver = TestServerConfigurationResolvers.resolver(
                ServerConfigurationResolver.KEY_ORCA_FACILITY_JMARI_CODE, "012345678901",
                ServerConfigurationResolver.KEY_ORCA_FACILITY_HEALTHCAREFACILITY_CODE, "1234567890",
                ServerConfigurationResolver.KEY_ORCA_RP_DEFAULT_INOUT, "out",
                ServerConfigurationResolver.KEY_PVT_LIST_CLEAR, "true",
                ServerConfigurationResolver.KEY_BIND_ADDRESS, "127.0.0.1",
                ServerConfigurationResolver.KEY_SECURITY_TRUSTED_PROXIES, "10.0.0.0/8,192.168.0.10",
                ServerConfigurationResolver.KEY_LICENSE_DIR, tempDir.toString(),
                ServerConfigurationResolver.KEY_TEMPLATES_DIR, tempDir.resolve("templates").toString(),
                ServerConfigurationResolver.KEY_CHART_EVENT_HISTORY_REPLAY_LIMIT, "25",
                ServerConfigurationResolver.KEY_CHART_EVENT_HISTORY_RETENTION_COUNT, "500",
                ServerConfigurationResolver.KEY_CHART_EVENT_HISTORY_RETENTION_HOURS, "4");

        assertEquals("012345678901", resolver.orcaLegacy().facilityJmariCode());
        assertEquals("1234567890", resolver.orcaLegacy().healthcareFacilityCode());
        assertEquals("out", resolver.orcaLegacy().defaultPrescriptionInOut());
        assertEquals(true, resolver.pvtOperations().listClearEnabled());
        assertEquals("127.0.0.1", resolver.systemNetwork().bindAddress());
        assertEquals(2, resolver.security().trustedProxyRules().size());
        assertEquals(tempDir, resolver.license().directory());
        assertEquals(tempDir.resolve("templates"), resolver.templates().directory());
        assertEquals(25, resolver.chartEventHistory().replayLimit());
        assertEquals(500, resolver.chartEventHistory().retentionCount());
        assertEquals(Duration.ofHours(4), resolver.chartEventHistory().retentionDuration());
    }

    @Test
    void resolvesPlivoSettingsAsTypedValues() {
        ServerRuntimeConfiguration.PlivoSettings settings = TestServerConfigurationResolvers.resolver(
                ServerConfigurationResolver.KEY_PLIVO_AUTH_ID, "auth-id",
                ServerConfigurationResolver.KEY_PLIVO_AUTH_TOKEN, "auth-token",
                ServerConfigurationResolver.KEY_PLIVO_SOURCE_NUMBER, "+819012345678",
                ServerConfigurationResolver.KEY_PLIVO_ENVIRONMENT, "sandbox",
                ServerConfigurationResolver.KEY_PLIVO_LOG_LEVEL, "headers",
                ServerConfigurationResolver.KEY_PLIVO_LOG_MESSAGE_CONTENT, "true",
                ServerConfigurationResolver.KEY_PLIVO_HTTP_CONNECT_TIMEOUT, "1500ms",
                ServerConfigurationResolver.KEY_PLIVO_HTTP_READ_TIMEOUT, "PT40S",
                ServerConfigurationResolver.KEY_PLIVO_HTTP_WRITE_TIMEOUT, "45s",
                ServerConfigurationResolver.KEY_PLIVO_HTTP_CALL_TIMEOUT, "2m",
                ServerConfigurationResolver.KEY_PLIVO_HTTP_RETRY_ON_CONNECTION_FAILURE, "false")
                .plivo();

        assertEquals("auth-id", settings.authId());
        assertEquals("sandbox", settings.environment());
        assertEquals("headers", settings.logLevel());
        assertEquals(Boolean.TRUE, settings.logMessageContent());
        assertEquals(Duration.ofMillis(1500), settings.connectTimeout());
        assertEquals(Duration.ofSeconds(40), settings.readTimeout());
        assertEquals(Duration.ofSeconds(45), settings.writeTimeout());
        assertEquals(Duration.ofMinutes(2), settings.callTimeout());
        assertEquals(Boolean.FALSE, settings.retryOnConnectionFailure());
    }

    @Test
    void resolvesAttachmentStorageSettingsAsTypedValues() {
        ServerRuntimeConfiguration.AttachmentStorageSettings settings = TestServerConfigurationResolvers.resolver(
                ServerConfigurationResolver.KEY_ATTACHMENT_STORAGE_MODE, "s3",
                ServerConfigurationResolver.KEY_ATTACHMENT_STORAGE_DATABASE_LOB_TABLE, "d_attachment",
                ServerConfigurationResolver.KEY_ATTACHMENT_STORAGE_S3_BUCKET, "attachments",
                ServerConfigurationResolver.KEY_ATTACHMENT_STORAGE_S3_REGION, "ap-northeast-1",
                ServerConfigurationResolver.KEY_ATTACHMENT_STORAGE_S3_ENDPOINT, "https://s3.example.test",
                ServerConfigurationResolver.KEY_ATTACHMENT_STORAGE_S3_BASE_PATH, "facility-a",
                ServerConfigurationResolver.KEY_ATTACHMENT_STORAGE_S3_FORCE_PATH_STYLE, "true",
                ServerConfigurationResolver.KEY_ATTACHMENT_STORAGE_S3_SERVER_SIDE_ENCRYPTION, "AES256",
                ServerConfigurationResolver.KEY_ATTACHMENT_STORAGE_S3_KMS_KEY_ID, "kms-1",
                ServerConfigurationResolver.KEY_ATTACHMENT_STORAGE_S3_MULTIPART_THRESHOLD_MB, "8",
                ServerConfigurationResolver.KEY_ATTACHMENT_STORAGE_S3_ACCESS_KEY, "access",
                ServerConfigurationResolver.KEY_ATTACHMENT_STORAGE_S3_SECRET_KEY, "secret")
                .attachmentStorage();

        assertEquals("s3", settings.mode());
        assertEquals("d_attachment", settings.databaseLobTable());
        assertEquals("attachments", settings.s3().bucket());
        assertEquals("ap-northeast-1", settings.s3().region());
        assertEquals("https://s3.example.test", settings.s3().endpoint());
        assertEquals("facility-a", settings.s3().basePath());
        assertEquals(Boolean.TRUE, settings.s3().forcePathStyle());
        assertEquals("AES256", settings.s3().serverSideEncryption());
        assertEquals("kms-1", settings.s3().kmsKeyId());
        assertEquals(8, settings.s3().multipartThresholdMb());
    }

    @Test
    void resolvesDocumentIntegritySettingsAsTypedValues() throws Exception {
        Path keyring = writeKeyring("resolver-keyring.json");
        ServerRuntimeConfiguration.DocumentIntegritySettings settings = TestServerConfigurationResolvers.resolver(
                ServerConfigurationResolver.KEY_DOCUMENT_INTEGRITY_MODE, "enforce",
                ServerConfigurationResolver.KEY_DOCUMENT_INTEGRITY_KEYRING_PATH, keyring.toString())
                .documentIntegrity();

        assertEquals("enforce", settings.mode());
        assertEquals(keyring, settings.keyringPath());
    }

    @Test
    void resolvesBlankTrustedProxyConfigAsEmptyRuleList() {
        ServerRuntimeConfiguration.SecuritySettings settings = TestServerConfigurationResolvers.resolver(
                ServerConfigurationResolver.KEY_SECURITY_TRUSTED_PROXIES, "")
                .security();

        assertEquals(0, settings.trustedProxyRules().size());
    }

    @Test
    void resolvesPatientImagesSettingsAsTypedValues() {
        ServerRuntimeConfiguration.PatientImagesSettings settings = TestServerConfigurationResolvers.resolver(
                ServerConfigurationResolver.KEY_PATIENT_IMAGES_ENABLED, "true",
                ServerConfigurationResolver.KEY_PATIENT_IMAGES_MAX_BYTES, "2097152",
                ServerConfigurationResolver.KEY_PATIENT_IMAGES_MAX_WIDTH, "2048",
                ServerConfigurationResolver.KEY_PATIENT_IMAGES_MAX_HEIGHT, "1024")
                .patientImages();

        assertEquals(true, settings.enabled());
        assertEquals(2097152L, settings.maxBytes());
        assertEquals(2048, settings.maxWidth());
        assertEquals(1024, settings.maxHeight());
    }

    @Test
    void resolvesPvtWorkerHealthSettingsAsTypedValues() {
        ServerRuntimeConfiguration.PvtWorkerHealthSettings settings = TestServerConfigurationResolvers.resolver(
                ServerConfigurationResolver.KEY_PVT_WORKER_HEALTH_STALE_SUCCESS_SECONDS, "300",
                ServerConfigurationResolver.KEY_PVT_WORKER_HEALTH_MAX_PROCESSING_MILLIS, "45000")
                .pvtWorkerHealth();

        assertEquals(300L, settings.staleSuccessSeconds());
        assertEquals(45000L, settings.maxProcessingMillis());
    }

    @Test
    void resolvesOrcaPatientSyncSettingsAsTypedValues() {
        ServerRuntimeConfiguration.OrcaPatientSyncSettings settings = TestServerConfigurationResolvers.resolver(
                ServerConfigurationResolver.KEY_ORCA_PATIENT_SYNC_ENABLED, "true",
                ServerConfigurationResolver.KEY_ORCA_PATIENT_SYNC_INTERVAL_MINUTES, "15",
                ServerConfigurationResolver.KEY_ORCA_PATIENT_SYNC_INITIAL_LOOKBACK_DAYS, "3",
                ServerConfigurationResolver.KEY_ORCA_PATIENT_SYNC_INCLUDE_TEST_PATIENT, "true",
                ServerConfigurationResolver.KEY_ORCA_PATIENT_SYNC_INCLUDE_INSURANCE, "true")
                .orcaPatientSync();

        assertEquals(true, settings.enabled());
        assertEquals(15, settings.intervalMinutes());
        assertEquals(3, settings.initialLookbackDays());
        assertEquals(true, settings.includeTestPatient());
        assertEquals(true, settings.includeInsurance());
    }

    @Test
    void resolvesOrcaPushSafeDefaults() {
        ServerRuntimeConfiguration.OrcaPushSettings settings = TestServerConfigurationResolvers.resolver().orcaPush();

        assertEquals(false, settings.enabled());
        assertEquals(false, settings.shadowMode());
        assertEquals(false, settings.recoveryEnabled());
    }

    @Test
    void resolvesOrcaApiSettingsAsTypedValues() {
        ServerRuntimeConfiguration.OrcaApiSettings settings = TestServerConfigurationResolvers.resolver(
                ServerConfigurationResolver.KEY_ORCA_API_BASE_URL, "https://orca.example.test",
                ServerConfigurationResolver.KEY_ORCA_API_MODE, "weborca",
                ServerConfigurationResolver.KEY_ORCA_API_USER, "orca-user",
                ServerConfigurationResolver.KEY_ORCA_API_PASSWORD, "orca-pass",
                ServerConfigurationResolver.KEY_ORCA_API_PATH_PREFIX, "/api",
                ServerConfigurationResolver.KEY_ORCA_API_WEBORCA, "true",
                ServerConfigurationResolver.KEY_ORCA_API_RETRY_MAX, "2",
                ServerConfigurationResolver.KEY_ORCA_API_RETRY_BACKOFF_MS, "500")
                .orcaApi();

        assertEquals("https://orca.example.test", settings.baseUrl());
        assertEquals("weborca", settings.mode());
        assertEquals("orca-user", settings.user());
        assertEquals("orca-pass", settings.password());
        assertEquals("/api", settings.pathPrefix());
        assertEquals(Boolean.TRUE, settings.weborca());
        assertEquals(2, settings.retryMax());
        assertEquals(500L, settings.retryBackoffMs());
    }

    @Test
    void resolvesOrcaTransportHttpSettingsAsTypedValues() {
        ServerRuntimeConfiguration.OrcaTransportHttpSettings settings = TestServerConfigurationResolvers.resolver(
                ServerConfigurationResolver.KEY_ORCA_API_RETRY_NETWORK_MAX, "4",
                ServerConfigurationResolver.KEY_ORCA_API_RETRY_TRANSIENT_MAX, "3",
                ServerConfigurationResolver.KEY_ORCA_API_RETRY_NETWORK_BACKOFF_MS, "350",
                ServerConfigurationResolver.KEY_ORCA_API_RETRY_TRANSIENT_BACKOFF_MS, "120",
                ServerConfigurationResolver.KEY_ORCA_API_CONNECT_TIMEOUT_MS, "1500ms",
                ServerConfigurationResolver.KEY_ORCA_API_READ_TIMEOUT_MS, "PT20S",
                ServerConfigurationResolver.KEY_ORCA_API_TOTAL_TIMEOUT_MS, "45s",
                ServerConfigurationResolver.KEY_ORCA_HTTP_LOG_MODE, "detail",
                ServerConfigurationResolver.KEY_ORCA_ALLOW_INSECURE_HTTP, "true",
                ServerConfigurationResolver.KEY_ORCA_TRANSPORT_CACHE_TTL_MS, "60000")
                .orcaTransportHttp();

        assertEquals(4, settings.networkRetryMax());
        assertEquals(3, settings.transientRetryMax());
        assertEquals(350L, settings.networkRetryBackoffMs());
        assertEquals(120L, settings.transientRetryBackoffMs());
        assertEquals(Duration.ofMillis(1500), settings.connectTimeout());
        assertEquals(Duration.ofSeconds(20), settings.readTimeout());
        assertEquals(Duration.ofSeconds(45), settings.totalTimeout());
        assertEquals("detail", settings.logMode());
        assertEquals(Boolean.TRUE, settings.allowInsecureHttp());
        assertEquals(60000L, settings.cacheTtlMs());
    }

    @Test
    void resolvesOrcaSecretProtectionSettingsAsTypedValues() {
        ServerRuntimeConfiguration.OrcaSecretProtectionSettings settings = TestServerConfigurationResolvers.resolver(
                ServerConfigurationResolver.KEY_ORCA_CREDENTIALS_AES_KEY_B64,
                "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=")
                .orcaSecretProtection();

        assertEquals("MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=", settings.aesKeyBase64());
    }

    @Test
    void resolvesOperationalRuntimeSettingsAsTypedValues() {
        ServerConfigurationResolver resolver = TestServerConfigurationResolvers.resolver(
                ServerConfigurationResolver.KEY_ORCA_PROXY_FORWARD_X_ORCA_HEADERS, "false",
                ServerConfigurationResolver.KEY_ORCA_PROXY_FORWARD_API_RESULT_MESSAGE_HEADER, "false",
                ServerConfigurationResolver.KEY_ORCA_PUSH_ENABLED, "true",
                ServerConfigurationResolver.KEY_ORCA_PUSH_SHADOW_MODE, "false",
                ServerConfigurationResolver.KEY_ORCA_PUSH_RECEPTION_ENABLED, "true",
                ServerConfigurationResolver.KEY_ORCA_PUSH_MEDICAL_ENABLED, "true",
                ServerConfigurationResolver.KEY_ORCA_PUSH_CONNECT_TIMEOUT_MS, "5000",
                ServerConfigurationResolver.KEY_ORCA_PUSH_PING_INTERVAL_SECONDS, "20",
                ServerConfigurationResolver.KEY_ORCA_PUSH_IDLE_TIMEOUT_SECONDS, "60",
                ServerConfigurationResolver.KEY_ORCA_PUSH_RECONNECT_INITIAL_DELAY_MS, "1000",
                ServerConfigurationResolver.KEY_ORCA_PUSH_RECONNECT_MAX_DELAY_MS, "30000",
                ServerConfigurationResolver.KEY_ORCA_PUSH_RECOVERY_ENABLED, "true",
                ServerConfigurationResolver.KEY_ORCA_PUSH_RECOVERY_USE_PUSHEVENTGET, "false",
                ServerConfigurationResolver.KEY_ORCA_PUSH_RECOVERY_INTERVAL_MINUTES, "5",
                ServerConfigurationResolver.KEY_ORCA_PUSH_RECOVERY_INITIAL_LOOKBACK_MINUTES, "30",
                ServerConfigurationResolver.KEY_ORCA_PUSH_RECOVERY_OVERLAP_MINUTES, "5",
                ServerConfigurationResolver.KEY_ORCA_PUSH_DEDUP_RETENTION_DAYS, "14",
                ServerConfigurationResolver.KEY_MASTER_UPDATE_SCHEDULER_ENABLED, "true",
                ServerConfigurationResolver.KEY_METRICS_REGISTRY_JNDI, "java:global/test/metrics",
                ServerConfigurationResolver.KEY_SMTP_HOST, "smtp.example.test",
                ServerConfigurationResolver.KEY_SMTP_PORT, "2525",
                ServerConfigurationResolver.KEY_SMTP_AUTH, "true",
                ServerConfigurationResolver.KEY_SMTP_USERNAME, "mailer",
                ServerConfigurationResolver.KEY_SMTP_PASSWORD, "secret",
                ServerConfigurationResolver.KEY_SMTP_FROM, "noreply@example.test",
                ServerConfigurationResolver.KEY_SMTP_BCC, "audit@example.test",
                ServerConfigurationResolver.KEY_SMTP_STARTTLS, "true",
                ServerConfigurationResolver.KEY_SMTP_ACTIVITY_TO, "activity@example.test");

        assertEquals(Boolean.FALSE, resolver.orcaProxy().forwardXOrcaHeaders());
        assertEquals(Boolean.FALSE, resolver.orcaProxy().forwardApiResultMessageHeader());
        assertEquals(true, resolver.orcaPush().enabled());
        assertEquals(false, resolver.orcaPush().shadowMode());
        assertEquals(true, resolver.orcaPush().receptionEnabled());
        assertEquals(true, resolver.orcaPush().medicalEnabled());
        assertEquals(5000, resolver.orcaPush().connectTimeoutMs());
        assertEquals(20, resolver.orcaPush().pingIntervalSeconds());
        assertEquals(60, resolver.orcaPush().idleTimeoutSeconds());
        assertEquals(1000, resolver.orcaPush().reconnectInitialDelayMs());
        assertEquals(30000, resolver.orcaPush().reconnectMaxDelayMs());
        assertEquals(true, resolver.orcaPush().recoveryEnabled());
        assertEquals(false, resolver.orcaPush().recoveryUsePusheventget());
        assertEquals(5, resolver.orcaPush().recoveryIntervalMinutes());
        assertEquals(30, resolver.orcaPush().recoveryInitialLookbackMinutes());
        assertEquals(5, resolver.orcaPush().recoveryOverlapMinutes());
        assertEquals(14, resolver.orcaPush().dedupRetentionDays());
        assertEquals(true, resolver.masterUpdateScheduler().enabled());
        assertEquals("java:global/test/metrics", resolver.metrics().registryJndi());
        assertEquals("smtp.example.test", resolver.smtp().host());
        assertEquals("2525", resolver.smtp().port());
        assertEquals(Boolean.TRUE, resolver.smtp().auth());
        assertEquals("mailer", resolver.smtp().username());
        assertEquals("secret", resolver.smtp().password());
        assertEquals("noreply@example.test", resolver.smtp().from());
        assertEquals("audit@example.test", resolver.smtp().bcc());
        assertEquals(Boolean.TRUE, resolver.smtp().startTls());
        assertEquals("activity@example.test", resolver.smtp().activityTo());
    }

    @Test
    void rawAndOptionalDoNotFallbackToSystemProperties() {
        System.setProperty(ServerConfigurationResolver.KEY_ENVIRONMENT, "prod");
        try {
            ServerConfigurationResolver resolver = new ServerConfigurationResolver() {
                @Override
                Config resolveConfig() {
                    return null;
                }
            };

            assertNull(resolver.raw(ServerConfigurationResolver.KEY_ENVIRONMENT));
            assertFalse(resolver.optional(ServerConfigurationResolver.KEY_ENVIRONMENT).isPresent());
        } finally {
            System.clearProperty(ServerConfigurationResolver.KEY_ENVIRONMENT);
        }
    }

    @Test
    void optionalPrefersOverridesBeforeConfigAndFallsBackToEmpty() throws Exception {
        try (AutoCloseable ignored = MicroProfileConfigTestSupport.withConfig(
                ServerConfigurationResolver.KEY_ENVIRONMENT, "config-value")) {
            ServerConfigurationResolver overridden = new ServerConfigurationResolver(Map.of(
                    ServerConfigurationResolver.KEY_ENVIRONMENT, "override-value"));
            ServerConfigurationResolver resolved = new ServerConfigurationResolver();

            assertEquals("override-value", overridden.optional(ServerConfigurationResolver.KEY_ENVIRONMENT).orElseThrow());
            assertEquals("config-value", resolved.optional(ServerConfigurationResolver.KEY_ENVIRONMENT).orElseThrow());
            assertFalse(resolved.optional("missing.key").isPresent());
        }
    }

    private Path writeKeyring(String fileName) throws IOException {
        Path path = tempDir.resolve(fileName).toAbsolutePath();
        Files.writeString(path, """
                {
                  "algorithm": "HMAC-SHA256",
                  "keys": [
                    {"keyId":"key-v1","status":"active","hmacKeyB64":"MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDE="}
                  ]
                }
                """);
        return path;
    }
}
