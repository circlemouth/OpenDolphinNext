package open.dolphin.runtime.config;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Base64;
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
        assertTrue(ex.getMessage().contains(ServerConfigurationResolver.KEY_FIDO2_RP_ID));
    }

    @Test
    void acceptsCompleteStartupConfiguration() throws Exception {
        Path keyring = writeKeyring("validator-valid.json", VALID_AES_KEY_B64);
        ServerConfigurationValidator validator = new ServerConfigurationValidator(
                TestServerConfigurationResolvers.resolver(
                        ServerConfigurationResolver.KEY_ENVIRONMENT, "dev",
                        ServerConfigurationResolver.KEY_TIMEZONE, "Asia/Tokyo",
                        ServerConfigurationResolver.KEY_SERVER_DATA_DIR, "/tmp/opendolphin-test",
                        ServerConfigurationResolver.KEY_FACILITY_ID, "facility-01",
                        ServerConfigurationResolver.KEY_CLOUD_ZERO, "false",
                        ServerConfigurationResolver.KEY_DB_HOST, "localhost",
                        ServerConfigurationResolver.KEY_DB_PORT, "5432",
                        ServerConfigurationResolver.KEY_DB_NAME, "opendolphin",
                        ServerConfigurationResolver.KEY_DB_USER, "app",
                        ServerConfigurationResolver.KEY_DB_PASSWORD, "secret",
                        ServerConfigurationResolver.KEY_DB_SSLMODE, "verify-full",
                        ServerConfigurationResolver.KEY_DB_SSLROOTCERT, VALID_SSL_ROOT_CERT,
                        ServerConfigurationResolver.KEY_ATTACHMENT_STORAGE_MODE, "database",
                        ServerConfigurationResolver.KEY_ATTACHMENT_STORAGE_DATABASE_LOB_TABLE, "d_attachment",
                        ServerConfigurationResolver.KEY_DOCUMENT_INTEGRITY_MODE, "enforce",
                        ServerConfigurationResolver.KEY_DOCUMENT_INTEGRITY_KEYRING_PATH, keyring.toString(),
                        ServerConfigurationResolver.KEY_FACTOR2_AES_KEY_B64, VALID_AES_KEY_B64,
                        ServerConfigurationResolver.KEY_ORCA_CREDENTIALS_AES_KEY_B64, VALID_ORCA_AES_KEY_B64,
                        ServerConfigurationResolver.KEY_ORCA_API_BASE_URL, "https://orca.example.test",
                        ServerConfigurationResolver.KEY_ORCA_API_MODE, "weborca",
                        ServerConfigurationResolver.KEY_ORCA_API_USER, "orca-user",
                        ServerConfigurationResolver.KEY_ORCA_API_PASSWORD, "orca-pass",
                        ServerConfigurationResolver.KEY_FIDO2_RP_ID, "localhost",
                        ServerConfigurationResolver.KEY_FIDO2_RP_NAME, "OpenDolphin",
                        ServerConfigurationResolver.KEY_FIDO2_ALLOWED_ORIGINS, "https://localhost:8443"));

        assertDoesNotThrow(validator::validateOrThrow);
    }

    @Test
    void rejectsIncompleteS3AttachmentStorageConfiguration() {
        ServerConfigurationValidator validator = new ServerConfigurationValidator(
                TestServerConfigurationResolvers.resolver(
                        ServerConfigurationResolver.KEY_ENVIRONMENT, "dev",
                        ServerConfigurationResolver.KEY_TIMEZONE, "Asia/Tokyo",
                        ServerConfigurationResolver.KEY_SERVER_DATA_DIR, "/tmp/opendolphin-test",
                        ServerConfigurationResolver.KEY_FACILITY_ID, "facility-01",
                        ServerConfigurationResolver.KEY_CLOUD_ZERO, "false",
                        ServerConfigurationResolver.KEY_DB_HOST, "localhost",
                        ServerConfigurationResolver.KEY_DB_PORT, "5432",
                        ServerConfigurationResolver.KEY_DB_NAME, "opendolphin",
                        ServerConfigurationResolver.KEY_DB_USER, "app",
                        ServerConfigurationResolver.KEY_DB_PASSWORD, "secret",
                        ServerConfigurationResolver.KEY_DB_SSLMODE, "verify-full",
                        ServerConfigurationResolver.KEY_DB_SSLROOTCERT, VALID_SSL_ROOT_CERT,
                        ServerConfigurationResolver.KEY_ATTACHMENT_STORAGE_MODE, "s3",
                        ServerConfigurationResolver.KEY_DOCUMENT_INTEGRITY_MODE, "off",
                        ServerConfigurationResolver.KEY_FACTOR2_AES_KEY_B64, VALID_AES_KEY_B64,
                        ServerConfigurationResolver.KEY_ORCA_CREDENTIALS_AES_KEY_B64, VALID_ORCA_AES_KEY_B64,
                        ServerConfigurationResolver.KEY_ORCA_API_BASE_URL, "https://orca.example.test",
                        ServerConfigurationResolver.KEY_ORCA_API_MODE, "weborca",
                        ServerConfigurationResolver.KEY_ORCA_API_USER, "orca-user",
                        ServerConfigurationResolver.KEY_ORCA_API_PASSWORD, "orca-pass",
                        ServerConfigurationResolver.KEY_FIDO2_RP_ID, "localhost",
                        ServerConfigurationResolver.KEY_FIDO2_RP_NAME, "OpenDolphin",
                        ServerConfigurationResolver.KEY_FIDO2_ALLOWED_ORIGINS, "https://localhost:8443"));

        IllegalStateException ex = assertThrows(IllegalStateException.class, validator::validateOrThrow);

        assertTrue(ex.getMessage().contains(ServerConfigurationResolver.KEY_ATTACHMENT_STORAGE_S3_BUCKET));
        assertTrue(ex.getMessage().contains(ServerConfigurationResolver.KEY_ATTACHMENT_STORAGE_S3_ACCESS_KEY));
    }

    @Test
    void rejectsEnabledPatientImagesWithoutDimensionLimits() {
        ServerConfigurationValidator validator = new ServerConfigurationValidator(
                TestServerConfigurationResolvers.resolver(
                        ServerConfigurationResolver.KEY_ENVIRONMENT, "dev",
                        ServerConfigurationResolver.KEY_TIMEZONE, "Asia/Tokyo",
                        ServerConfigurationResolver.KEY_SERVER_DATA_DIR, "/tmp/opendolphin-test",
                        ServerConfigurationResolver.KEY_FACILITY_ID, "facility-01",
                        ServerConfigurationResolver.KEY_CLOUD_ZERO, "false",
                        ServerConfigurationResolver.KEY_DB_HOST, "localhost",
                        ServerConfigurationResolver.KEY_DB_PORT, "5432",
                        ServerConfigurationResolver.KEY_DB_NAME, "opendolphin",
                        ServerConfigurationResolver.KEY_DB_USER, "app",
                        ServerConfigurationResolver.KEY_DB_PASSWORD, "secret",
                        ServerConfigurationResolver.KEY_DB_SSLMODE, "verify-full",
                        ServerConfigurationResolver.KEY_DB_SSLROOTCERT, VALID_SSL_ROOT_CERT,
                        ServerConfigurationResolver.KEY_ATTACHMENT_STORAGE_MODE, "database",
                        ServerConfigurationResolver.KEY_ATTACHMENT_STORAGE_DATABASE_LOB_TABLE, "d_attachment",
                        ServerConfigurationResolver.KEY_DOCUMENT_INTEGRITY_MODE, "off",
                        ServerConfigurationResolver.KEY_PATIENT_IMAGES_ENABLED, "true",
                        ServerConfigurationResolver.KEY_FACTOR2_AES_KEY_B64, VALID_AES_KEY_B64,
                        ServerConfigurationResolver.KEY_ORCA_CREDENTIALS_AES_KEY_B64, VALID_ORCA_AES_KEY_B64,
                        ServerConfigurationResolver.KEY_ORCA_API_BASE_URL, "https://orca.example.test",
                        ServerConfigurationResolver.KEY_ORCA_API_MODE, "weborca",
                        ServerConfigurationResolver.KEY_ORCA_API_USER, "orca-user",
                        ServerConfigurationResolver.KEY_ORCA_API_PASSWORD, "orca-pass",
                        ServerConfigurationResolver.KEY_FIDO2_RP_ID, "localhost",
                        ServerConfigurationResolver.KEY_FIDO2_RP_NAME, "OpenDolphin",
                        ServerConfigurationResolver.KEY_FIDO2_ALLOWED_ORIGINS, "https://localhost:8443"));

        IllegalStateException ex = assertThrows(IllegalStateException.class, validator::validateOrThrow);

        assertTrue(ex.getMessage().contains(ServerConfigurationResolver.KEY_PATIENT_IMAGES_MAX_BYTES));
        assertTrue(ex.getMessage().contains(ServerConfigurationResolver.KEY_PATIENT_IMAGES_MAX_WIDTH));
        assertTrue(ex.getMessage().contains(ServerConfigurationResolver.KEY_PATIENT_IMAGES_MAX_HEIGHT));
    }

    @Test
    void rejectsInvalidDocumentIntegrityKeyLength() throws Exception {
        Path keyring = writeKeyring("validator-short.json",
                Base64.getEncoder().encodeToString("too-short-key".getBytes()));
        ServerConfigurationValidator validator = new ServerConfigurationValidator(
                TestServerConfigurationResolvers.resolver(
                        ServerConfigurationResolver.KEY_ENVIRONMENT, "dev",
                        ServerConfigurationResolver.KEY_TIMEZONE, "Asia/Tokyo",
                        ServerConfigurationResolver.KEY_SERVER_DATA_DIR, "/tmp/opendolphin-test",
                        ServerConfigurationResolver.KEY_FACILITY_ID, "facility-01",
                        ServerConfigurationResolver.KEY_CLOUD_ZERO, "false",
                        ServerConfigurationResolver.KEY_DB_HOST, "localhost",
                        ServerConfigurationResolver.KEY_DB_PORT, "5432",
                        ServerConfigurationResolver.KEY_DB_NAME, "opendolphin",
                        ServerConfigurationResolver.KEY_DB_USER, "app",
                        ServerConfigurationResolver.KEY_DB_PASSWORD, "secret",
                        ServerConfigurationResolver.KEY_DB_SSLMODE, "verify-full",
                        ServerConfigurationResolver.KEY_DB_SSLROOTCERT, VALID_SSL_ROOT_CERT,
                        ServerConfigurationResolver.KEY_ATTACHMENT_STORAGE_MODE, "database",
                        ServerConfigurationResolver.KEY_ATTACHMENT_STORAGE_DATABASE_LOB_TABLE, "d_attachment",
                        ServerConfigurationResolver.KEY_DOCUMENT_INTEGRITY_MODE, "enforce",
                        ServerConfigurationResolver.KEY_DOCUMENT_INTEGRITY_KEYRING_PATH, keyring.toString(),
                        ServerConfigurationResolver.KEY_FACTOR2_AES_KEY_B64, VALID_AES_KEY_B64,
                        ServerConfigurationResolver.KEY_ORCA_CREDENTIALS_AES_KEY_B64, VALID_ORCA_AES_KEY_B64,
                        ServerConfigurationResolver.KEY_ORCA_API_BASE_URL, "https://orca.example.test",
                        ServerConfigurationResolver.KEY_ORCA_API_MODE, "weborca",
                        ServerConfigurationResolver.KEY_ORCA_API_USER, "orca-user",
                        ServerConfigurationResolver.KEY_ORCA_API_PASSWORD, "orca-pass",
                        ServerConfigurationResolver.KEY_FIDO2_RP_ID, "localhost",
                        ServerConfigurationResolver.KEY_FIDO2_RP_NAME, "OpenDolphin",
                        ServerConfigurationResolver.KEY_FIDO2_ALLOWED_ORIGINS, "https://localhost:8443"));

        IllegalStateException ex = assertThrows(IllegalStateException.class, validator::validateOrThrow);

        assertTrue(ex.getMessage().contains("at least 32 bytes"));
    }

    @Test
    void rejectsMissingOrcaApiCredentialConfiguration() {
        ServerConfigurationValidator validator = new ServerConfigurationValidator(
                TestServerConfigurationResolvers.resolver(
                        ServerConfigurationResolver.KEY_ENVIRONMENT, "dev",
                        ServerConfigurationResolver.KEY_TIMEZONE, "Asia/Tokyo",
                        ServerConfigurationResolver.KEY_SERVER_DATA_DIR, "/tmp/opendolphin-test",
                        ServerConfigurationResolver.KEY_FACILITY_ID, "facility-01",
                        ServerConfigurationResolver.KEY_CLOUD_ZERO, "false",
                        ServerConfigurationResolver.KEY_DB_HOST, "localhost",
                        ServerConfigurationResolver.KEY_DB_PORT, "5432",
                        ServerConfigurationResolver.KEY_DB_NAME, "opendolphin",
                        ServerConfigurationResolver.KEY_DB_USER, "app",
                        ServerConfigurationResolver.KEY_DB_PASSWORD, "secret",
                        ServerConfigurationResolver.KEY_DB_SSLMODE, "verify-full",
                        ServerConfigurationResolver.KEY_DB_SSLROOTCERT, VALID_SSL_ROOT_CERT,
                        ServerConfigurationResolver.KEY_ATTACHMENT_STORAGE_MODE, "database",
                        ServerConfigurationResolver.KEY_ATTACHMENT_STORAGE_DATABASE_LOB_TABLE, "d_attachment",
                        ServerConfigurationResolver.KEY_DOCUMENT_INTEGRITY_MODE, "off",
                        ServerConfigurationResolver.KEY_FACTOR2_AES_KEY_B64, VALID_AES_KEY_B64,
                        ServerConfigurationResolver.KEY_ORCA_CREDENTIALS_AES_KEY_B64, VALID_ORCA_AES_KEY_B64,
                        ServerConfigurationResolver.KEY_ORCA_API_MODE, "weborca",
                        ServerConfigurationResolver.KEY_ORCA_API_BASE_URL, "https://orca.example.test",
                        ServerConfigurationResolver.KEY_FIDO2_RP_ID, "localhost",
                        ServerConfigurationResolver.KEY_FIDO2_RP_NAME, "OpenDolphin",
                        ServerConfigurationResolver.KEY_FIDO2_ALLOWED_ORIGINS, "https://localhost:8443"));

        IllegalStateException ex = assertThrows(IllegalStateException.class, validator::validateOrThrow);

        assertTrue(ex.getMessage().contains(ServerConfigurationResolver.KEY_ORCA_API_USER));
        assertTrue(ex.getMessage().contains(ServerConfigurationResolver.KEY_ORCA_API_PASSWORD));
    }

    @Test
    void rejectsOrcaSecretProtectorReuseWithFactor2Key() {
        ServerConfigurationValidator validator = new ServerConfigurationValidator(
                TestServerConfigurationResolvers.resolver(
                        ServerConfigurationResolver.KEY_ENVIRONMENT, "dev",
                        ServerConfigurationResolver.KEY_TIMEZONE, "Asia/Tokyo",
                        ServerConfigurationResolver.KEY_SERVER_DATA_DIR, "/tmp/opendolphin-test",
                        ServerConfigurationResolver.KEY_FACILITY_ID, "facility-01",
                        ServerConfigurationResolver.KEY_CLOUD_ZERO, "false",
                        ServerConfigurationResolver.KEY_DB_HOST, "localhost",
                        ServerConfigurationResolver.KEY_DB_PORT, "5432",
                        ServerConfigurationResolver.KEY_DB_NAME, "opendolphin",
                        ServerConfigurationResolver.KEY_DB_USER, "app",
                        ServerConfigurationResolver.KEY_DB_PASSWORD, "secret",
                        ServerConfigurationResolver.KEY_DB_SSLMODE, "verify-full",
                        ServerConfigurationResolver.KEY_DB_SSLROOTCERT, VALID_SSL_ROOT_CERT,
                        ServerConfigurationResolver.KEY_ATTACHMENT_STORAGE_MODE, "database",
                        ServerConfigurationResolver.KEY_ATTACHMENT_STORAGE_DATABASE_LOB_TABLE, "d_attachment",
                        ServerConfigurationResolver.KEY_DOCUMENT_INTEGRITY_MODE, "off",
                        ServerConfigurationResolver.KEY_FACTOR2_AES_KEY_B64, VALID_AES_KEY_B64,
                        ServerConfigurationResolver.KEY_ORCA_CREDENTIALS_AES_KEY_B64, VALID_AES_KEY_B64,
                        ServerConfigurationResolver.KEY_ORCA_API_MODE, "weborca",
                        ServerConfigurationResolver.KEY_ORCA_API_BASE_URL, "https://orca.example.test",
                        ServerConfigurationResolver.KEY_ORCA_API_USER, "orca-user",
                        ServerConfigurationResolver.KEY_ORCA_API_PASSWORD, "orca-pass",
                        ServerConfigurationResolver.KEY_FIDO2_RP_ID, "localhost",
                        ServerConfigurationResolver.KEY_FIDO2_RP_NAME, "OpenDolphin",
                        ServerConfigurationResolver.KEY_FIDO2_ALLOWED_ORIGINS, "https://localhost:8443"));

        IllegalStateException ex = assertThrows(IllegalStateException.class, validator::validateOrThrow);

        assertTrue(ex.getMessage().contains(ServerConfigurationResolver.KEY_ORCA_CREDENTIALS_AES_KEY_B64));
        assertTrue(ex.getMessage().contains(ServerConfigurationResolver.KEY_FACTOR2_AES_KEY_B64));
    }

    @Test
    void rejectsInvalidOperationalRuntimeConfiguration() {
        ServerConfigurationValidator validator = new ServerConfigurationValidator(
                TestServerConfigurationResolvers.resolver(
                        ServerConfigurationResolver.KEY_ENVIRONMENT, "dev",
                        ServerConfigurationResolver.KEY_TIMEZONE, "Asia/Tokyo",
                        ServerConfigurationResolver.KEY_SERVER_DATA_DIR, "/tmp/opendolphin-test",
                        ServerConfigurationResolver.KEY_FACILITY_ID, "facility-01",
                        ServerConfigurationResolver.KEY_CLOUD_ZERO, "false",
                        ServerConfigurationResolver.KEY_DB_HOST, "localhost",
                        ServerConfigurationResolver.KEY_DB_PORT, "5432",
                        ServerConfigurationResolver.KEY_DB_NAME, "opendolphin",
                        ServerConfigurationResolver.KEY_DB_USER, "app",
                        ServerConfigurationResolver.KEY_DB_PASSWORD, "secret",
                        ServerConfigurationResolver.KEY_DB_SSLMODE, "verify-full",
                        ServerConfigurationResolver.KEY_DB_SSLROOTCERT, VALID_SSL_ROOT_CERT,
                        ServerConfigurationResolver.KEY_ATTACHMENT_STORAGE_MODE, "database",
                        ServerConfigurationResolver.KEY_ATTACHMENT_STORAGE_DATABASE_LOB_TABLE, "d_attachment",
                        ServerConfigurationResolver.KEY_DOCUMENT_INTEGRITY_MODE, "off",
                        ServerConfigurationResolver.KEY_FACTOR2_AES_KEY_B64, VALID_AES_KEY_B64,
                        ServerConfigurationResolver.KEY_ORCA_CREDENTIALS_AES_KEY_B64, VALID_ORCA_AES_KEY_B64,
                        ServerConfigurationResolver.KEY_ORCA_API_MODE, "weborca",
                        ServerConfigurationResolver.KEY_ORCA_API_BASE_URL, "https://orca.example.test",
                        ServerConfigurationResolver.KEY_ORCA_API_USER, "orca-user",
                        ServerConfigurationResolver.KEY_ORCA_API_PASSWORD, "orca-pass",
                        ServerConfigurationResolver.KEY_FIDO2_RP_ID, "localhost",
                        ServerConfigurationResolver.KEY_FIDO2_RP_NAME, "OpenDolphin",
                        ServerConfigurationResolver.KEY_FIDO2_ALLOWED_ORIGINS, "https://localhost:8443",
                        ServerConfigurationResolver.KEY_ORCA_PUSH_EVENT_CACHE_MAX, "0",
                        ServerConfigurationResolver.KEY_ORCA_PUSH_EVENT_CACHE_TTL_DAYS, "0",
                        ServerConfigurationResolver.KEY_SMTP_AUTH, "true",
                        ServerConfigurationResolver.KEY_SMTP_HOST, "smtp.example.test",
                        ServerConfigurationResolver.KEY_SMTP_FROM, "noreply@example.test"));

        IllegalStateException ex = assertThrows(IllegalStateException.class, validator::validateOrThrow);

        assertTrue(ex.getMessage().contains(ServerConfigurationResolver.KEY_ORCA_PUSH_EVENT_CACHE_MAX));
        assertTrue(ex.getMessage().contains(ServerConfigurationResolver.KEY_ORCA_PUSH_EVENT_CACHE_TTL_DAYS));
        assertTrue(ex.getMessage().contains(ServerConfigurationResolver.KEY_SMTP_USERNAME));
        assertTrue(ex.getMessage().contains(ServerConfigurationResolver.KEY_SMTP_PASSWORD));
    }

    @Test
    void rejectsEnabledPvtListenerWithoutRequiredLimits() {
        ServerConfigurationValidator validator = new ServerConfigurationValidator(
                TestServerConfigurationResolvers.resolver(
                        ServerConfigurationResolver.KEY_ENVIRONMENT, "dev",
                        ServerConfigurationResolver.KEY_TIMEZONE, "Asia/Tokyo",
                        ServerConfigurationResolver.KEY_SERVER_DATA_DIR, "/tmp/opendolphin-test",
                        ServerConfigurationResolver.KEY_FACILITY_ID, "facility-01",
                        ServerConfigurationResolver.KEY_CLOUD_ZERO, "false",
                        ServerConfigurationResolver.KEY_PVT_ENABLED, "true",
                        ServerConfigurationResolver.KEY_DB_HOST, "localhost",
                        ServerConfigurationResolver.KEY_DB_PORT, "5432",
                        ServerConfigurationResolver.KEY_DB_NAME, "opendolphin",
                        ServerConfigurationResolver.KEY_DB_USER, "app",
                        ServerConfigurationResolver.KEY_DB_PASSWORD, "secret",
                        ServerConfigurationResolver.KEY_DB_SSLMODE, "verify-full",
                        ServerConfigurationResolver.KEY_DB_SSLROOTCERT, VALID_SSL_ROOT_CERT,
                        ServerConfigurationResolver.KEY_ATTACHMENT_STORAGE_MODE, "database",
                        ServerConfigurationResolver.KEY_ATTACHMENT_STORAGE_DATABASE_LOB_TABLE, "d_attachment",
                        ServerConfigurationResolver.KEY_DOCUMENT_INTEGRITY_MODE, "off",
                        ServerConfigurationResolver.KEY_FACTOR2_AES_KEY_B64, VALID_AES_KEY_B64,
                        ServerConfigurationResolver.KEY_ORCA_CREDENTIALS_AES_KEY_B64, VALID_ORCA_AES_KEY_B64,
                        ServerConfigurationResolver.KEY_ORCA_API_MODE, "weborca",
                        ServerConfigurationResolver.KEY_ORCA_API_BASE_URL, "https://orca.example.test",
                        ServerConfigurationResolver.KEY_ORCA_API_USER, "orca-user",
                        ServerConfigurationResolver.KEY_ORCA_API_PASSWORD, "orca-pass",
                        ServerConfigurationResolver.KEY_FIDO2_RP_ID, "localhost",
                        ServerConfigurationResolver.KEY_FIDO2_RP_NAME, "OpenDolphin",
                        ServerConfigurationResolver.KEY_FIDO2_ALLOWED_ORIGINS, "https://localhost:8443"));

        IllegalStateException ex = assertThrows(IllegalStateException.class, validator::validateOrThrow);

        assertTrue(ex.getMessage().contains(ServerConfigurationResolver.KEY_PVT_BIND_IP));
        assertTrue(ex.getMessage().contains(ServerConfigurationResolver.KEY_PVT_PORT));
        assertTrue(ex.getMessage().contains(ServerConfigurationResolver.KEY_PVT_ACCEPT_TIMEOUT_MILLIS));
        assertTrue(ex.getMessage().contains(ServerConfigurationResolver.KEY_PVT_POISON_QUEUE_CAPACITY));
    }

    @Test
    void rejectsIncompleteDatasourceTransportConfiguration() {
        ServerConfigurationValidator validator = new ServerConfigurationValidator(
                TestServerConfigurationResolvers.resolver(
                        ServerConfigurationResolver.KEY_ENVIRONMENT, "dev",
                        ServerConfigurationResolver.KEY_TIMEZONE, "Asia/Tokyo",
                        ServerConfigurationResolver.KEY_SERVER_DATA_DIR, "/tmp/opendolphin-test",
                        ServerConfigurationResolver.KEY_FACILITY_ID, "facility-01",
                        ServerConfigurationResolver.KEY_CLOUD_ZERO, "false",
                        ServerConfigurationResolver.KEY_DB_HOST, "localhost",
                        ServerConfigurationResolver.KEY_DB_NAME, "opendolphin",
                        ServerConfigurationResolver.KEY_DB_USER, "app",
                        ServerConfigurationResolver.KEY_DB_PASSWORD, "secret",
                        ServerConfigurationResolver.KEY_ATTACHMENT_STORAGE_MODE, "database",
                        ServerConfigurationResolver.KEY_ATTACHMENT_STORAGE_DATABASE_LOB_TABLE, "d_attachment",
                        ServerConfigurationResolver.KEY_DOCUMENT_INTEGRITY_MODE, "off",
                        ServerConfigurationResolver.KEY_FACTOR2_AES_KEY_B64, VALID_AES_KEY_B64,
                        ServerConfigurationResolver.KEY_ORCA_CREDENTIALS_AES_KEY_B64, VALID_ORCA_AES_KEY_B64,
                        ServerConfigurationResolver.KEY_ORCA_API_MODE, "weborca",
                        ServerConfigurationResolver.KEY_ORCA_API_BASE_URL, "https://orca.example.test",
                        ServerConfigurationResolver.KEY_ORCA_API_USER, "orca-user",
                        ServerConfigurationResolver.KEY_ORCA_API_PASSWORD, "orca-pass",
                        ServerConfigurationResolver.KEY_FIDO2_RP_ID, "localhost",
                        ServerConfigurationResolver.KEY_FIDO2_RP_NAME, "OpenDolphin",
                        ServerConfigurationResolver.KEY_FIDO2_ALLOWED_ORIGINS, "https://localhost:8443"));

        IllegalStateException ex = assertThrows(IllegalStateException.class, validator::validateOrThrow);

        assertTrue(ex.getMessage().contains("db.port"));
        assertTrue(ex.getMessage().contains("db.sslmode"));
        assertTrue(ex.getMessage().contains("db.sslrootcert"));
    }

    @Test
    void rejectsInvalidOrcaTransportHttpConfiguration() {
        ServerConfigurationValidator validator = new ServerConfigurationValidator(
                TestServerConfigurationResolvers.resolver(
                        ServerConfigurationResolver.KEY_ENVIRONMENT, "dev",
                        ServerConfigurationResolver.KEY_TIMEZONE, "Asia/Tokyo",
                        ServerConfigurationResolver.KEY_SERVER_DATA_DIR, "/tmp/opendolphin-test",
                        ServerConfigurationResolver.KEY_FACILITY_ID, "facility-01",
                        ServerConfigurationResolver.KEY_CLOUD_ZERO, "false",
                        ServerConfigurationResolver.KEY_DB_HOST, "localhost",
                        ServerConfigurationResolver.KEY_DB_PORT, "5432",
                        ServerConfigurationResolver.KEY_DB_NAME, "opendolphin",
                        ServerConfigurationResolver.KEY_DB_USER, "app",
                        ServerConfigurationResolver.KEY_DB_PASSWORD, "secret",
                        ServerConfigurationResolver.KEY_DB_SSLMODE, "verify-full",
                        ServerConfigurationResolver.KEY_DB_SSLROOTCERT, VALID_SSL_ROOT_CERT,
                        ServerConfigurationResolver.KEY_ATTACHMENT_STORAGE_MODE, "database",
                        ServerConfigurationResolver.KEY_ATTACHMENT_STORAGE_DATABASE_LOB_TABLE, "d_attachment",
                        ServerConfigurationResolver.KEY_DOCUMENT_INTEGRITY_MODE, "off",
                        ServerConfigurationResolver.KEY_FACTOR2_AES_KEY_B64, VALID_AES_KEY_B64,
                        ServerConfigurationResolver.KEY_ORCA_CREDENTIALS_AES_KEY_B64, VALID_ORCA_AES_KEY_B64,
                        ServerConfigurationResolver.KEY_ORCA_API_MODE, "weborca",
                        ServerConfigurationResolver.KEY_ORCA_API_BASE_URL, "https://orca.example.test",
                        ServerConfigurationResolver.KEY_ORCA_API_USER, "orca-user",
                        ServerConfigurationResolver.KEY_ORCA_API_PASSWORD, "orca-pass",
                        ServerConfigurationResolver.KEY_ORCA_HTTP_LOG_MODE, "verbose",
                        ServerConfigurationResolver.KEY_ORCA_API_CONNECT_TIMEOUT_MS, "0ms",
                        ServerConfigurationResolver.KEY_ORCA_TRANSPORT_CACHE_TTL_MS, "-1",
                        ServerConfigurationResolver.KEY_FIDO2_RP_ID, "localhost",
                        ServerConfigurationResolver.KEY_FIDO2_RP_NAME, "OpenDolphin",
                        ServerConfigurationResolver.KEY_FIDO2_ALLOWED_ORIGINS, "https://localhost:8443"));

        IllegalStateException ex = assertThrows(IllegalStateException.class, validator::validateOrThrow);

        assertTrue(ex.getMessage().contains(ServerConfigurationResolver.KEY_ORCA_HTTP_LOG_MODE));
        assertTrue(ex.getMessage().contains(ServerConfigurationResolver.KEY_ORCA_API_CONNECT_TIMEOUT_MS));
        assertTrue(ex.getMessage().contains(ServerConfigurationResolver.KEY_ORCA_TRANSPORT_CACHE_TTL_MS));
    }

    private Path writeKeyring(String fileName, String keyB64) throws IOException {
        Path path = tempDir.resolve(fileName).toAbsolutePath();
        Files.writeString(path, """
                {
                  "algorithm": "HMAC-SHA256",
                  "keys": [
                    {"keyId":"key-v1","status":"active","hmacKeyB64":"%s"}
                  ]
                }
                """.formatted(keyB64));
        return path;
    }
}
