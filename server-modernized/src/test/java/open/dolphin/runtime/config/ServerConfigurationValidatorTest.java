package open.dolphin.runtime.config;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class ServerConfigurationValidatorTest {

    private static final String VALID_AES_KEY_B64 =
            Base64.getEncoder().encodeToString("0123456789abcdef0123456789abcdef".getBytes());
    private static final String VALID_ORCA_AES_KEY_B64 =
            Base64.getEncoder().encodeToString("abcdef0123456789abcdef0123456789".getBytes());
    private static final String VALID_SSL_ROOT_CERT = "/tmp/opendolphin-test/root-ca.pem";

    @TempDir
    Path tempDir;

    @Test
    void rejectsMissingRequiredStartupConfiguration() {
        ServerConfigurationValidator validator = new ServerConfigurationValidator(
                TestServerConfigurationResolvers.resolver(ServerConfigurationResolver.KEY_ENVIRONMENT, "dev"));

        IllegalStateException ex = assertThrows(IllegalStateException.class, validator::validateOrThrow);

        assertTrue(ex.getMessage().contains("db.host"));
        assertTrue(ex.getMessage().contains("db.port"));
        assertTrue(ex.getMessage().contains("db.sslmode"));
        assertTrue(ex.getMessage().contains("db.sslrootcert"));
        assertTrue(ex.getMessage().contains(ServerConfigurationResolver.KEY_TIMEZONE));
        assertTrue(ex.getMessage().contains(ServerConfigurationResolver.KEY_SERVER_DATA_DIR));
        assertTrue(ex.getMessage().contains(ServerConfigurationResolver.KEY_FACILITY_ID));
        assertTrue(ex.getMessage().contains(ServerConfigurationResolver.KEY_CLOUD_ZERO));
        assertTrue(ex.getMessage().contains(ServerConfigurationResolver.KEY_ATTACHMENT_STORAGE_MODE));
        assertTrue(ex.getMessage().contains(ServerConfigurationResolver.KEY_FACTOR2_AES_KEY_B64));
        assertTrue(ex.getMessage().contains(ServerConfigurationResolver.KEY_ORCA_CREDENTIALS_AES_KEY_B64));
    }

    @Test
    void acceptsCompleteStartupConfiguration() {
        ServerConfigurationValidator validator = new ServerConfigurationValidator(
                resolverWithBaseConfig(
                        ServerConfigurationResolver.KEY_DOCUMENT_INTEGRITY_MODE, "enforce"));

        assertDoesNotThrow(validator::validateOrThrow);
    }

    @Test
    void rejectsIncompleteS3AttachmentStorageConfiguration() {
        ServerConfigurationValidator validator = new ServerConfigurationValidator(
                resolverWithBaseConfig(
                        ServerConfigurationResolver.KEY_ATTACHMENT_STORAGE_S3_BUCKET, "",
                        ServerConfigurationResolver.KEY_ATTACHMENT_STORAGE_S3_ACCESS_KEY, ""));

        IllegalStateException ex = assertThrows(IllegalStateException.class, validator::validateOrThrow);

        assertTrue(ex.getMessage().contains(ServerConfigurationResolver.KEY_ATTACHMENT_STORAGE_S3_BUCKET));
        assertTrue(ex.getMessage().contains(ServerConfigurationResolver.KEY_ATTACHMENT_STORAGE_S3_ACCESS_KEY));
    }

    @Test
    void rejectsDatabaseAttachmentStorageMode() {
        ServerConfigurationValidator validator = new ServerConfigurationValidator(
                resolverWithBaseConfig(
                        ServerConfigurationResolver.KEY_ATTACHMENT_STORAGE_MODE, "database"));

        IllegalStateException ex = assertThrows(IllegalStateException.class, validator::validateOrThrow);

        assertTrue(ex.getMessage().contains(ServerConfigurationResolver.KEY_ATTACHMENT_STORAGE_MODE));
    }

    @Test
    void rejectsDatabaseLobTableEvenWhenModeIsS3() {
        ServerConfigurationValidator validator = new ServerConfigurationValidator(
                resolverWithBaseConfig(
                        ServerConfigurationResolver.KEY_ATTACHMENT_STORAGE_DATABASE_LOB_TABLE, "d_attachment"));

        IllegalStateException ex = assertThrows(IllegalStateException.class, validator::validateOrThrow);

        assertTrue(ex.getMessage().contains(ServerConfigurationResolver.KEY_ATTACHMENT_STORAGE_DATABASE_LOB_TABLE));
    }

    @Test
    void rejectsEnabledPatientImagesWithoutDimensionLimits() {
        ServerConfigurationValidator validator = new ServerConfigurationValidator(
                resolverWithBaseConfig(
                        ServerConfigurationResolver.KEY_PATIENT_IMAGES_ENABLED, "true",
                        ServerConfigurationResolver.KEY_PATIENT_IMAGES_MAX_BYTES, "",
                        ServerConfigurationResolver.KEY_PATIENT_IMAGES_MAX_WIDTH, "",
                        ServerConfigurationResolver.KEY_PATIENT_IMAGES_MAX_HEIGHT, ""));

        IllegalStateException ex = assertThrows(IllegalStateException.class, validator::validateOrThrow);

        assertTrue(ex.getMessage().contains(ServerConfigurationResolver.KEY_PATIENT_IMAGES_MAX_BYTES));
        assertTrue(ex.getMessage().contains(ServerConfigurationResolver.KEY_PATIENT_IMAGES_MAX_WIDTH));
        assertTrue(ex.getMessage().contains(ServerConfigurationResolver.KEY_PATIENT_IMAGES_MAX_HEIGHT));
    }

    @Test
    void rejectsDocumentIntegrityWithoutKeyring() {
        ServerConfigurationValidator validator = new ServerConfigurationValidator(
                resolverWithBaseConfig(
                        ServerConfigurationResolver.KEY_DOCUMENT_INTEGRITY_KEYRING_PATH, ""));

        IllegalStateException ex = assertThrows(IllegalStateException.class, validator::validateOrThrow);

        assertTrue(ex.getMessage().contains(ServerConfigurationResolver.KEY_DOCUMENT_INTEGRITY_KEYRING_PATH));
    }

    @Test
    void rejectsUnknownDocumentIntegrityMode() {
        ServerConfigurationValidator validator = new ServerConfigurationValidator(
                resolverWithBaseConfig(
                        ServerConfigurationResolver.KEY_DOCUMENT_INTEGRITY_MODE, "legacy"));

        IllegalStateException ex = assertThrows(IllegalStateException.class, validator::validateOrThrow);

        assertTrue(ex.getMessage().contains(ServerConfigurationResolver.KEY_DOCUMENT_INTEGRITY_MODE));
        assertTrue(ex.getMessage().contains("must be enforce"));
    }

    @Test
    void rejectsMissingOrcaApiCredentialConfiguration() {
        ServerConfigurationValidator validator = new ServerConfigurationValidator(
                resolverWithBaseConfig(
                        ServerConfigurationResolver.KEY_ORCA_API_USER, "",
                        ServerConfigurationResolver.KEY_ORCA_API_PASSWORD, ""));

        IllegalStateException ex = assertThrows(IllegalStateException.class, validator::validateOrThrow);

        assertTrue(ex.getMessage().contains(ServerConfigurationResolver.KEY_ORCA_API_USER));
        assertTrue(ex.getMessage().contains(ServerConfigurationResolver.KEY_ORCA_API_PASSWORD));
    }

    @Test
    void rejectsOrcaSecretProtectorReuseWithFactor2Key() {
        ServerConfigurationValidator validator = new ServerConfigurationValidator(
                resolverWithBaseConfig(
                        ServerConfigurationResolver.KEY_ORCA_CREDENTIALS_AES_KEY_B64, VALID_AES_KEY_B64));

        IllegalStateException ex = assertThrows(IllegalStateException.class, validator::validateOrThrow);

        assertTrue(ex.getMessage().contains(ServerConfigurationResolver.KEY_ORCA_CREDENTIALS_AES_KEY_B64));
        assertTrue(ex.getMessage().contains(ServerConfigurationResolver.KEY_FACTOR2_AES_KEY_B64));
    }

    @Test
    void rejectsInvalidOperationalRuntimeConfiguration() {
        ServerConfigurationValidator validator = new ServerConfigurationValidator(
                resolverWithBaseConfig(
                        ServerConfigurationResolver.KEY_ORCA_PUSH_ENABLED, "true",
                        ServerConfigurationResolver.KEY_ORCA_PUSH_RECEPTION_ENABLED, "false",
                        ServerConfigurationResolver.KEY_ORCA_PUSH_MEDICAL_ENABLED, "false",
                        ServerConfigurationResolver.KEY_ORCA_PUSH_CONNECT_TIMEOUT_MS, "0",
                        ServerConfigurationResolver.KEY_ORCA_PUSH_RECONNECT_INITIAL_DELAY_MS, "5000",
                        ServerConfigurationResolver.KEY_ORCA_PUSH_RECONNECT_MAX_DELAY_MS, "1000",
                        ServerConfigurationResolver.KEY_ORCA_PUSH_DEDUP_RETENTION_DAYS, "0",
                        ServerConfigurationResolver.KEY_SMTP_AUTH, "true",
                        ServerConfigurationResolver.KEY_SMTP_HOST, "smtp.example.test",
                        ServerConfigurationResolver.KEY_SMTP_FROM, "noreply@example.test"));

        IllegalStateException ex = assertThrows(IllegalStateException.class, validator::validateOrThrow);

        assertTrue(ex.getMessage().contains(ServerConfigurationResolver.KEY_ORCA_PUSH_CONNECT_TIMEOUT_MS));
        assertTrue(ex.getMessage().contains(ServerConfigurationResolver.KEY_ORCA_PUSH_RECONNECT_MAX_DELAY_MS));
        assertTrue(ex.getMessage().contains(ServerConfigurationResolver.KEY_ORCA_PUSH_DEDUP_RETENTION_DAYS));
        assertTrue(ex.getMessage().contains(ServerConfigurationResolver.KEY_ORCA_PUSH_ENABLED));
        assertTrue(ex.getMessage().contains(ServerConfigurationResolver.KEY_SMTP_USERNAME));
        assertTrue(ex.getMessage().contains(ServerConfigurationResolver.KEY_SMTP_PASSWORD));
    }

    @Test
    void rejectsEnabledPvtListenerWithoutRequiredLimits() {
        ServerConfigurationValidator validator = new ServerConfigurationValidator(
                resolverWithBaseConfig(
                        ServerConfigurationResolver.KEY_PVT_ENABLED, "true"));

        IllegalStateException ex = assertThrows(IllegalStateException.class, validator::validateOrThrow);

        assertTrue(ex.getMessage().contains(ServerConfigurationResolver.KEY_PVT_BIND_IP));
        assertTrue(ex.getMessage().contains(ServerConfigurationResolver.KEY_PVT_PORT));
        assertTrue(ex.getMessage().contains(ServerConfigurationResolver.KEY_PVT_ACCEPT_TIMEOUT_MILLIS));
        assertTrue(ex.getMessage().contains(ServerConfigurationResolver.KEY_PVT_POISON_QUEUE_CAPACITY));
    }

    @Test
    void rejectsIncompleteDatasourceTransportConfiguration() {
        ServerConfigurationValidator validator = new ServerConfigurationValidator(
                resolverWithBaseConfig(
                        ServerConfigurationResolver.KEY_DB_PORT, "",
                        ServerConfigurationResolver.KEY_DB_SSLMODE, "",
                        ServerConfigurationResolver.KEY_DB_SSLROOTCERT, ""));

        IllegalStateException ex = assertThrows(IllegalStateException.class, validator::validateOrThrow);

        assertTrue(ex.getMessage().contains("db.port"));
        assertTrue(ex.getMessage().contains("db.sslmode"));
        assertTrue(ex.getMessage().contains("db.sslrootcert"));
    }

    @Test
    void rejectsInvalidOrcaTransportHttpConfiguration() {
        ServerConfigurationValidator validator = new ServerConfigurationValidator(
                resolverWithBaseConfig(
                        ServerConfigurationResolver.KEY_ORCA_HTTP_LOG_MODE, "verbose",
                        ServerConfigurationResolver.KEY_ORCA_API_CONNECT_TIMEOUT_MS, "0ms",
                        ServerConfigurationResolver.KEY_ORCA_TRANSPORT_CACHE_TTL_MS, "-1"));

        IllegalStateException ex = assertThrows(IllegalStateException.class, validator::validateOrThrow);

        assertTrue(ex.getMessage().contains(ServerConfigurationResolver.KEY_ORCA_HTTP_LOG_MODE));
        assertTrue(ex.getMessage().contains(ServerConfigurationResolver.KEY_ORCA_API_CONNECT_TIMEOUT_MS));
        assertTrue(ex.getMessage().contains(ServerConfigurationResolver.KEY_ORCA_TRANSPORT_CACHE_TTL_MS));
    }

    @Test
    void rejectsInvalidTrustedProxyRule() {
        ServerConfigurationValidator validator = new ServerConfigurationValidator(
                resolverWithBaseConfig(
                        ServerConfigurationResolver.KEY_SECURITY_TRUSTED_PROXIES, "10.0.0.0/33"));

        IllegalStateException ex = assertThrows(IllegalStateException.class, validator::validateOrThrow);

        assertTrue(ex.getMessage().contains(ServerConfigurationResolver.KEY_SECURITY_TRUSTED_PROXIES));
    }

    @Test
    void rejectsMissingTrustedProxyRules() {
        ServerConfigurationValidator validator = new ServerConfigurationValidator(
                resolverWithBaseConfig(
                        ServerConfigurationResolver.KEY_SECURITY_TRUSTED_PROXIES, ""));

        IllegalStateException ex = assertThrows(IllegalStateException.class, validator::validateOrThrow);

        assertTrue(ex.getMessage().contains(ServerConfigurationResolver.KEY_SECURITY_TRUSTED_PROXIES));
    }

    private ServerConfigurationResolver resolverWithBaseConfig(String... overrides) {
        Map<String, String> values = new LinkedHashMap<>();
        values.put(ServerConfigurationResolver.KEY_ENVIRONMENT, "dev");
        values.put(ServerConfigurationResolver.KEY_TIMEZONE, "Asia/Tokyo");
        values.put(ServerConfigurationResolver.KEY_SERVER_DATA_DIR, "/tmp/opendolphin-test");
        values.put(ServerConfigurationResolver.KEY_FACILITY_ID, "facility-01");
        values.put(ServerConfigurationResolver.KEY_CLOUD_ZERO, "false");
        values.put(ServerConfigurationResolver.KEY_DB_HOST, "localhost");
        values.put(ServerConfigurationResolver.KEY_DB_PORT, "5432");
        values.put(ServerConfigurationResolver.KEY_DB_NAME, "opendolphin");
        values.put(ServerConfigurationResolver.KEY_DB_USER, "app");
        values.put(ServerConfigurationResolver.KEY_DB_PASSWORD, "secret");
        values.put(ServerConfigurationResolver.KEY_DB_SSLMODE, "verify-full");
        values.put(ServerConfigurationResolver.KEY_DB_SSLROOTCERT, VALID_SSL_ROOT_CERT);
        values.put(ServerConfigurationResolver.KEY_ATTACHMENT_STORAGE_MODE, "s3");
        values.put(ServerConfigurationResolver.KEY_ATTACHMENT_STORAGE_S3_BUCKET, "attachments");
        values.put(ServerConfigurationResolver.KEY_ATTACHMENT_STORAGE_S3_REGION, "ap-northeast-1");
        values.put(ServerConfigurationResolver.KEY_ATTACHMENT_STORAGE_S3_ACCESS_KEY, "access");
        values.put(ServerConfigurationResolver.KEY_ATTACHMENT_STORAGE_S3_SECRET_KEY, "secret");
        values.put(ServerConfigurationResolver.KEY_DOCUMENT_INTEGRITY_MODE, "enforce");
        values.put(ServerConfigurationResolver.KEY_FACTOR2_AES_KEY_B64, VALID_AES_KEY_B64);
        values.put(ServerConfigurationResolver.KEY_ORCA_CREDENTIALS_AES_KEY_B64, VALID_ORCA_AES_KEY_B64);
        values.put(ServerConfigurationResolver.KEY_ORCA_API_BASE_URL, "https://orca.example.test");
        values.put(ServerConfigurationResolver.KEY_ORCA_API_MODE, "weborca");
        values.put(ServerConfigurationResolver.KEY_ORCA_API_USER, "orca-user");
        values.put(ServerConfigurationResolver.KEY_ORCA_API_PASSWORD, "orca-pass");
        values.put(ServerConfigurationResolver.KEY_SECURITY_TRUSTED_PROXIES, "127.0.0.1/32");
        try {
            values.put(ServerConfigurationResolver.KEY_DOCUMENT_INTEGRITY_KEYRING_PATH, writeDefaultKeyring());
        } catch (Exception ex) {
            throw new IllegalStateException(ex);
        }
        applyOverrides(values, overrides);
        return new ServerConfigurationResolver(values);
    }

    private String writeDefaultKeyring() throws Exception {
        Path path = tempDir.resolve("validator-keyring.json").toAbsolutePath();
        Files.writeString(path, """
                {
                  "algorithm": "HMAC-SHA256",
                  "keys": [
                    {"keyId":"key-v1","status":"active","hmacKeyB64":"MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDE="}
                  ]
                }
                """);
        return path.toString();
    }

    private static void applyOverrides(Map<String, String> values, String... overrides) {
        if (overrides == null) {
            return;
        }
        if (overrides.length % 2 != 0) {
            throw new IllegalArgumentException("overrides must be key/value pairs");
        }
        for (int i = 0; i < overrides.length; i += 2) {
            values.put(overrides[i], overrides[i + 1]);
        }
    }
}
