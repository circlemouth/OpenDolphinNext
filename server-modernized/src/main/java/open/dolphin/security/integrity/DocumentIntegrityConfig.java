package open.dolphin.security.integrity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import open.dolphin.runtime.config.ServerConfigurationResolver;
import open.dolphin.runtime.config.ServerRuntimeConfiguration;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Resolves runtime configuration for document integrity sealing and verification.
 */
@ApplicationScoped
public class DocumentIntegrityConfig {

    private static final Logger LOGGER = LoggerFactory.getLogger(DocumentIntegrityConfig.class);
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final int MIN_HMAC_KEY_BYTES = 32;
    private static final String KEYRING_ALGORITHM = "HMAC-SHA256";
    private static final String STATUS_ACTIVE = "active";
    private static final String STATUS_VERIFY_ONLY = "verify-only";

    @Inject
    ServerConfigurationResolver configurationResolver;

    public DocumentIntegrityConfig() {}

    DocumentIntegrityConfig(ServerConfigurationResolver configurationResolver) {
        this.configurationResolver = configurationResolver;
    }

    public Mode resolveMode() {
        String raw = configuration().mode();
        if (raw == null) {
            return Mode.PERMISSIVE;
        }
        String normalized = raw.trim().toLowerCase(Locale.ROOT);
        return switch (normalized) {
            case "off" -> Mode.OFF;
            case "permissive" -> Mode.PERMISSIVE;
            case "enforce" -> Mode.ENFORCE;
            default -> {
                LOGGER.warn("Unknown {}='{}'. Fallback to permissive.",
                        ServerConfigurationResolver.KEY_DOCUMENT_INTEGRITY_MODE, raw);
                yield Mode.PERMISSIVE;
            }
        };
    }

    public Settings resolveSettings() {
        Mode mode = resolveMode();
        if (mode == Mode.OFF) {
            return Settings.disabled(mode);
        }

        Path keyringPath = requireAbsolutePath(configuration().keyringPath(),
                ServerConfigurationResolver.KEY_DOCUMENT_INTEGRITY_KEYRING_PATH);
        ValidatedKeyring keyring = loadValidatedKeyringInternal(keyringPath);
        return new Settings(mode, keyring.activeKey(), keyring.keysById());
    }

    public static void validateKeyring(Path keyringPath) {
        loadValidatedKeyringInternal(keyringPath);
    }

    private static ValidatedKeyring loadValidatedKeyringInternal(Path keyringPath) {
        Path resolvedPath = requireAbsolutePath(keyringPath, ServerConfigurationResolver.KEY_DOCUMENT_INTEGRITY_KEYRING_PATH);
        if (!Files.isRegularFile(resolvedPath)) {
            throw new IllegalStateException(ServerConfigurationResolver.KEY_DOCUMENT_INTEGRITY_KEYRING_PATH
                    + " must point to an existing file");
        }

        KeyringDocument document;
        try {
            document = JSON.readValue(Files.readString(resolvedPath), KeyringDocument.class);
        } catch (IOException ex) {
            throw new IllegalStateException(ServerConfigurationResolver.KEY_DOCUMENT_INTEGRITY_KEYRING_PATH
                    + " must be valid JSON", ex);
        }
        if (document == null) {
            throw new IllegalStateException(ServerConfigurationResolver.KEY_DOCUMENT_INTEGRITY_KEYRING_PATH
                    + " must contain a keyring object");
        }
        if (!KEYRING_ALGORITHM.equalsIgnoreCase(trimToNull(document.algorithm()))) {
            throw new IllegalStateException("document integrity keyring algorithm must be " + KEYRING_ALGORITHM);
        }
        List<KeyEntryDocument> entries = document.keys();
        if (entries == null || entries.isEmpty()) {
            throw new IllegalStateException("document integrity keyring must contain at least one key");
        }

        Map<String, KeyMaterial> keysById = new LinkedHashMap<>();
        KeyMaterial activeKey = null;
        for (KeyEntryDocument entry : entries) {
            if (entry == null) {
                continue;
            }
            String keyId = requireNonBlank(entry.keyId(), "document integrity keyId");
            if (keysById.containsKey(keyId)) {
                throw new IllegalStateException("document integrity keyring must not contain duplicate keyId: " + keyId);
            }
            String status = normalizeStatus(entry.status());
            byte[] hmacKey = decodeKey(entry.hmacKeyB64(), keyId);
            KeyMaterial material = new KeyMaterial(keyId, status, hmacKey);
            keysById.put(keyId, material);
            if (STATUS_ACTIVE.equals(status)) {
                if (activeKey != null) {
                    throw new IllegalStateException("document integrity keyring must contain exactly one active key");
                }
                activeKey = material;
            }
        }
        if (activeKey == null) {
            throw new IllegalStateException("document integrity keyring must contain exactly one active key");
        }
        return new ValidatedKeyring(activeKey, Map.copyOf(keysById));
    }

    private ServerRuntimeConfiguration.DocumentIntegritySettings configuration() {
        if (configurationResolver == null) {
            configurationResolver = new ServerConfigurationResolver();
        }
        return configurationResolver.documentIntegrity();
    }

    private static String normalizeStatus(String status) {
        String normalized = requireNonBlank(status, "document integrity key status").toLowerCase(Locale.ROOT);
        if (!STATUS_ACTIVE.equals(normalized) && !STATUS_VERIFY_ONLY.equals(normalized)) {
            throw new IllegalStateException("document integrity key status must be active or verify-only");
        }
        return normalized;
    }

    private static byte[] decodeKey(String value, String keyId) {
        try {
            byte[] decoded = Base64.getDecoder().decode(requireNonBlank(value, "document integrity hmacKeyB64"));
            if (decoded.length < MIN_HMAC_KEY_BYTES) {
                throw new IllegalStateException("document integrity key '" + keyId + "' must decode to at least "
                        + MIN_HMAC_KEY_BYTES + " bytes");
            }
            return decoded;
        } catch (IllegalArgumentException ex) {
            throw new IllegalStateException("document integrity key '" + keyId + "' must be valid Base64", ex);
        }
    }

    private static String requireNonBlank(String value, String label) {
        String normalized = trimToNull(value);
        if (normalized == null) {
            throw new IllegalStateException(label + " is required");
        }
        return normalized;
    }

    public static Path requireAbsolutePath(Path path, String key) {
        if (path == null) {
            throw new IllegalStateException(key + " is required when document integrity mode is not off");
        }
        if (!path.isAbsolute()) {
            throw new IllegalStateException(key + " must be an absolute path");
        }
        return path.normalize();
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    public enum Mode {
        OFF,
        PERMISSIVE,
        ENFORCE
    }

    public static final class Settings {

        private final Mode mode;
        private final KeyMaterial activeKey;
        private final Map<String, KeyMaterial> keysById;

        private Settings(Mode mode, KeyMaterial activeKey, Map<String, KeyMaterial> keysById) {
            this.mode = mode;
            this.activeKey = activeKey;
            this.keysById = keysById == null ? Map.of() : Map.copyOf(keysById);
        }

        static Settings disabled(Mode mode) {
            return new Settings(mode, null, Map.of());
        }

        public Mode getMode() {
            return mode;
        }

        public KeyMaterial getActiveKey() {
            return activeKey;
        }

        public KeyMaterial getKey(String keyId) {
            if (keyId == null) {
                return null;
            }
            return keysById.get(keyId);
        }

        public Map<String, KeyMaterial> getKeysById() {
            return keysById;
        }
    }

    public record KeyMaterial(
            String keyId,
            String status,
            byte[] hmacKey
    ) {
        public KeyMaterial {
            hmacKey = hmacKey == null ? null : hmacKey.clone();
        }

        @Override
        public byte[] hmacKey() {
            return hmacKey == null ? null : hmacKey.clone();
        }
    }

    private record ValidatedKeyring(
            KeyMaterial activeKey,
            Map<String, KeyMaterial> keysById
    ) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    record KeyringDocument(
            String algorithm,
            List<KeyEntryDocument> keys
    ) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    record KeyEntryDocument(
            String keyId,
            String status,
            String hmacKeyB64
    ) {}
}
