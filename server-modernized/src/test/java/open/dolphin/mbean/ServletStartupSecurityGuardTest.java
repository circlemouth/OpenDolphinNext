package open.dolphin.mbean;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import open.dolphin.runtime.config.ServerConfigurationResolver;
import open.dolphin.testsupport.MicroProfileConfigTestSupport;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class ServletStartupSecurityGuardTest {

    @TempDir
    Path tempDir;

    @Test
    void productionLikeEnvironmentRejectsLegacyOrcaMasterCredential() throws Exception {
        try (AutoCloseable ignored = MicroProfileConfigTestSupport.withConfig(
                ServerConfigurationResolver.KEY_ENVIRONMENT, "production",
                ServletStartup.ORCA_MASTER_BASIC_PASSWORD_KEY, "legacy-secret")) {
            IllegalStateException ex = assertThrows(IllegalStateException.class, ServletStartup::enforceStartupSecurityGuards);

            assertTrue(ex.getMessage().contains(ServletStartup.ORCA_MASTER_BASIC_PASSWORD_KEY));
        }
    }

    @Test
    void nonProductionEnvironmentSkipsGuards() throws Exception {
        try (AutoCloseable ignored = MicroProfileConfigTestSupport.withConfig(
                ServerConfigurationResolver.KEY_ENVIRONMENT, "local",
                ServletStartup.ORCA_MASTER_BASIC_PASSWORD_KEY, "legacy-secret")) {
            assertDoesNotThrow(ServletStartup::enforceStartupSecurityGuards);
        }
    }

    @Test
    void productionLikeEnvironmentRejectsDangerousStartupFlags() throws Exception {
        Path keyring = writeKeyring("guard-valid.json");
        try (AutoCloseable ignored = MicroProfileConfigTestSupport.withConfig(
                ServerConfigurationResolver.KEY_ENVIRONMENT, "production",
                ServerConfigurationResolver.KEY_SECURITY_TRUSTED_PROXIES, "127.0.0.1/32",
                ServerConfigurationResolver.KEY_FACTOR2_AES_KEY_B64, validAesKey(),
                ServerConfigurationResolver.KEY_DOCUMENT_INTEGRITY_MODE, "enforce",
                ServerConfigurationResolver.KEY_DOCUMENT_INTEGRITY_KEYRING_PATH, keyring.toString(),
                ServerConfigurationResolver.KEY_ATTACHMENT_STORAGE_MODE, "s3",
                ServerConfigurationResolver.KEY_ORCA_PUSH_ENABLED, "true")) {
            IllegalStateException ex = assertThrows(IllegalStateException.class, ServletStartup::enforceStartupSecurityGuards);

            assertTrue(ex.getMessage().contains(ServerConfigurationResolver.KEY_ORCA_PUSH_ENABLED));
        }
    }

    @Test
    void productionLikeEnvironmentRejectsNonEnforcedIntegrityMode() throws Exception {
        try (AutoCloseable ignored = MicroProfileConfigTestSupport.withConfig(
                ServerConfigurationResolver.KEY_ENVIRONMENT, "production",
                ServerConfigurationResolver.KEY_SECURITY_TRUSTED_PROXIES, "127.0.0.1/32",
                ServerConfigurationResolver.KEY_FACTOR2_AES_KEY_B64, validAesKey(),
                ServerConfigurationResolver.KEY_DOCUMENT_INTEGRITY_MODE, "permissive",
                ServerConfigurationResolver.KEY_ATTACHMENT_STORAGE_MODE, "s3")) {
            IllegalStateException ex = assertThrows(IllegalStateException.class, ServletStartup::enforceStartupSecurityGuards);

            assertTrue(ex.getMessage().contains(ServerConfigurationResolver.KEY_DOCUMENT_INTEGRITY_MODE));
        }
    }

    @Test
    void productionLikeEnvironmentRejectsMissingTrustedProxyRules() throws Exception {
        Path keyring = writeKeyring("guard-trusted-proxies.json");
        try (AutoCloseable ignored = MicroProfileConfigTestSupport.withConfig(
                ServerConfigurationResolver.KEY_ENVIRONMENT, "production",
                ServerConfigurationResolver.KEY_FACTOR2_AES_KEY_B64, validAesKey(),
                ServerConfigurationResolver.KEY_DOCUMENT_INTEGRITY_MODE, "enforce",
                ServerConfigurationResolver.KEY_DOCUMENT_INTEGRITY_KEYRING_PATH, keyring.toString(),
                ServerConfigurationResolver.KEY_ATTACHMENT_STORAGE_MODE, "s3")) {
            IllegalStateException ex = assertThrows(IllegalStateException.class, ServletStartup::enforceStartupSecurityGuards);

            assertTrue(ex.getMessage().contains(ServerConfigurationResolver.KEY_SECURITY_TRUSTED_PROXIES));
        }
    }

    @Test
    void productionLikeEnvironmentRejectsMissingFactor2Key() throws Exception {
        Path keyring = writeKeyring("guard-factor2.json");
        try (AutoCloseable ignored = MicroProfileConfigTestSupport.withConfig(
                ServerConfigurationResolver.KEY_ENVIRONMENT, "production",
                ServerConfigurationResolver.KEY_SECURITY_TRUSTED_PROXIES, "127.0.0.1/32",
                ServerConfigurationResolver.KEY_DOCUMENT_INTEGRITY_MODE, "enforce",
                ServerConfigurationResolver.KEY_DOCUMENT_INTEGRITY_KEYRING_PATH, keyring.toString(),
                ServerConfigurationResolver.KEY_ATTACHMENT_STORAGE_MODE, "s3")) {
            IllegalStateException ex = assertThrows(IllegalStateException.class, ServletStartup::enforceStartupSecurityGuards);

            assertTrue(ex.getMessage().contains(ServerConfigurationResolver.KEY_FACTOR2_AES_KEY_B64));
        }
    }

    @Test
    void productionLikeEnvironmentRejectsDatabaseAttachmentStorage() throws Exception {
        Path keyring = writeKeyring("guard-storage.json");
        try (AutoCloseable ignored = MicroProfileConfigTestSupport.withConfig(
                ServerConfigurationResolver.KEY_ENVIRONMENT, "production",
                ServerConfigurationResolver.KEY_SECURITY_TRUSTED_PROXIES, "127.0.0.1/32",
                ServerConfigurationResolver.KEY_FACTOR2_AES_KEY_B64, validAesKey(),
                ServerConfigurationResolver.KEY_DOCUMENT_INTEGRITY_MODE, "enforce",
                ServerConfigurationResolver.KEY_DOCUMENT_INTEGRITY_KEYRING_PATH, keyring.toString(),
                ServerConfigurationResolver.KEY_ATTACHMENT_STORAGE_MODE, "database",
                ServerConfigurationResolver.KEY_ATTACHMENT_STORAGE_DATABASE_LOB_TABLE, "d_attachment")) {
            IllegalStateException ex = assertThrows(IllegalStateException.class, ServletStartup::enforceStartupSecurityGuards);

            assertTrue(ex.getMessage().contains(ServerConfigurationResolver.KEY_ATTACHMENT_STORAGE_MODE));
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

    private String validAesKey() {
        return java.util.Base64.getEncoder()
                .encodeToString("0123456789abcdef0123456789abcdef".getBytes());
    }
}
