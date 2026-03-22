package open.dolphin.security.integrity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import open.dolphin.runtime.config.ServerConfigurationResolver;
import open.dolphin.runtime.config.TestServerConfigurationResolvers;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class DocumentIntegrityConfigTest {

    @TempDir
    Path tempDir;

    @Test
    void resolvesEnabledSettingsFromKeyring() throws Exception {
        Path keyring = writeKeyring("valid.json", """
                {
                  "algorithm": "HMAC-SHA256",
                  "keys": [
                    {"keyId":"2026-03-primary","status":"active","hmacKeyB64":"MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDE="},
                    {"keyId":"2026-01-previous","status":"verify-only","hmacKeyB64":"QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVowMTIzNDU="}
                  ]
                }
                """);
        DocumentIntegrityConfig config = new DocumentIntegrityConfig(TestServerConfigurationResolvers.resolver(
                ServerConfigurationResolver.KEY_DOCUMENT_INTEGRITY_MODE, "enforce",
                ServerConfigurationResolver.KEY_DOCUMENT_INTEGRITY_KEYRING_PATH, keyring.toString()));

        DocumentIntegrityConfig.Settings settings = config.resolveSettings();

        assertThat(settings.getMode()).isEqualTo(DocumentIntegrityConfig.Mode.ENFORCE);
        assertThat(settings.getActiveKey().keyId()).isEqualTo("2026-03-primary");
        assertThat(settings.getActiveKey().hmacKey()).hasSize(32);
        assertThat(settings.getKey("2026-01-previous")).isNotNull();
    }

    @Test
    void rejectsDuplicateKeyIdsInKeyring() throws Exception {
        Path keyring = writeKeyring("duplicate.json", """
                {
                  "algorithm": "HMAC-SHA256",
                  "keys": [
                    {"keyId":"duplicate","status":"active","hmacKeyB64":"MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDE="},
                    {"keyId":"duplicate","status":"verify-only","hmacKeyB64":"QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVowMTIzNDU="}
                  ]
                }
                """);
        DocumentIntegrityConfig config = new DocumentIntegrityConfig(TestServerConfigurationResolvers.resolver(
                ServerConfigurationResolver.KEY_DOCUMENT_INTEGRITY_MODE, "permissive",
                ServerConfigurationResolver.KEY_DOCUMENT_INTEGRITY_KEYRING_PATH, keyring.toString()));

        assertThatThrownBy(config::resolveSettings)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("duplicate keyId");
    }

    @Test
    void rejectsMultipleActiveKeysInKeyring() throws Exception {
        Path keyring = writeKeyring("multiple-active.json", """
                {
                  "algorithm": "HMAC-SHA256",
                  "keys": [
                    {"keyId":"active-a","status":"active","hmacKeyB64":"MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDE="},
                    {"keyId":"active-b","status":"active","hmacKeyB64":"QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVowMTIzNDU="}
                  ]
                }
                """);
        DocumentIntegrityConfig config = new DocumentIntegrityConfig(TestServerConfigurationResolvers.resolver(
                ServerConfigurationResolver.KEY_DOCUMENT_INTEGRITY_MODE, "permissive",
                ServerConfigurationResolver.KEY_DOCUMENT_INTEGRITY_KEYRING_PATH, keyring.toString()));

        assertThatThrownBy(config::resolveSettings)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("exactly one active key");
    }

    @Test
    void rejectsMalformedKeyringJson() throws Exception {
        Path keyring = tempDir.resolve("malformed.json");
        Files.writeString(keyring, "{not-json");

        DocumentIntegrityConfig config = new DocumentIntegrityConfig(TestServerConfigurationResolvers.resolver(
                ServerConfigurationResolver.KEY_DOCUMENT_INTEGRITY_MODE, "permissive",
                ServerConfigurationResolver.KEY_DOCUMENT_INTEGRITY_KEYRING_PATH, keyring.toString()));

        assertThatThrownBy(config::resolveSettings)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining(ServerConfigurationResolver.KEY_DOCUMENT_INTEGRITY_KEYRING_PATH)
                .hasMessageContaining("valid JSON");
    }

    private Path writeKeyring(String fileName, String json) throws IOException {
        Path path = tempDir.resolve(fileName).toAbsolutePath();
        Files.writeString(path, json);
        return path;
    }
}
