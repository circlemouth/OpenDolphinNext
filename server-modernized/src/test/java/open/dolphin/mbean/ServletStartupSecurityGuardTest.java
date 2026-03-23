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
                ServerConfigurationResolver.KEY_DOCUMENT_INTEGRITY_MODE, "permissive",
                ServerConfigurationResolver.KEY_ATTACHMENT_STORAGE_MODE, "s3")) {
            IllegalStateException ex = assertThrows(IllegalStateException.class, ServletStartup::enforceStartupSecurityGuards);

            assertTrue(ex.getMessage().contains(ServerConfigurationResolver.KEY_DOCUMENT_INTEGRITY_MODE));
        }
    }

    @Test
    void productionLikeEnvironmentRejectsFido2Configuration() throws Exception {
        Path keyring = writeKeyring("guard-fido2.json");
        try (AutoCloseable ignored = MicroProfileConfigTestSupport.withConfig(
                ServerConfigurationResolver.KEY_ENVIRONMENT, "production",
                ServerConfigurationResolver.KEY_DOCUMENT_INTEGRITY_MODE, "enforce",
                ServerConfigurationResolver.KEY_DOCUMENT_INTEGRITY_KEYRING_PATH, keyring.toString(),
                ServerConfigurationResolver.KEY_ATTACHMENT_STORAGE_MODE, "s3",
                ServerConfigurationResolver.KEY_FIDO2_RP_ID, "localhost")) {
            IllegalStateException ex = assertThrows(IllegalStateException.class, ServletStartup::enforceStartupSecurityGuards);

            assertTrue(ex.getMessage().contains(ServerConfigurationResolver.KEY_FIDO2_RP_ID));
        }
    }

    @Test
    void productionLikeEnvironmentRejectsDatabaseAttachmentStorage() throws Exception {
        Path keyring = writeKeyring("guard-storage.json");
        try (AutoCloseable ignored = MicroProfileConfigTestSupport.withConfig(
                ServerConfigurationResolver.KEY_ENVIRONMENT, "production",
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
}
