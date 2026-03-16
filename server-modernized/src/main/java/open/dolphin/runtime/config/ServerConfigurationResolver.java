package open.dolphin.runtime.config;

import jakarta.enterprise.context.ApplicationScoped;
import java.nio.file.Path;
import java.time.ZoneId;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.stream.Collectors;
import org.eclipse.microprofile.config.Config;
import org.eclipse.microprofile.config.ConfigProvider;

/**
 * Resolves runtime settings from MicroProfile Config using explicit namespaces.
 */
@ApplicationScoped
public class ServerConfigurationResolver {

    public static final String KEY_ENVIRONMENT = "opendolphin.environment";
    public static final String KEY_TIMEZONE = "opendolphin.timezone";
    public static final String KEY_SERVER_DATA_DIR = "jboss.server.data.dir";
    public static final String KEY_FACILITY_ID = "opendolphin.facility-id";
    public static final String KEY_CLOUD_ZERO = "opendolphin.cloud.zero";
    public static final String KEY_PVT_ENABLED = "opendolphin.pvt.enabled";
    public static final String KEY_PVT_BIND_IP = "opendolphin.pvt.bind-ip";
    public static final String KEY_PVT_PORT = "opendolphin.pvt.port";
    public static final String KEY_PVT_ENCODING = "opendolphin.pvt.encoding";
    public static final String KEY_PVT_ACCEPT_TIMEOUT_MILLIS = "opendolphin.pvt.accept-timeout-millis";
    public static final String KEY_PVT_READ_TIMEOUT_MILLIS = "opendolphin.pvt.read-timeout-millis";
    public static final String KEY_PVT_MAX_THREADS = "opendolphin.pvt.max-threads";
    public static final String KEY_PVT_QUEUE_CAPACITY = "opendolphin.pvt.queue-capacity";
    public static final String KEY_PVT_RETRY_MAX = "opendolphin.pvt.retry.max";
    public static final String KEY_PVT_RETRY_BACKOFF_MILLIS = "opendolphin.pvt.retry.backoff-millis";
    public static final String KEY_PVT_IDEMPOTENCY_WINDOW_MILLIS = "opendolphin.pvt.idempotency-window-millis";
    public static final String KEY_PVT_POISON_QUEUE_CAPACITY = "opendolphin.pvt.poison-queue-capacity";

    public static final String KEY_DB_HOST = "db.host";
    public static final String KEY_DB_PORT = "db.port";
    public static final String KEY_DB_NAME = "db.name";
    public static final String KEY_DB_USER = "db.user";
    public static final String KEY_DB_PASSWORD = "db.password";
    public static final String KEY_DB_SSLMODE = "db.sslmode";
    public static final String KEY_DB_SSLROOTCERT = "db.sslrootcert";

    public static final String KEY_ORCA_DB_HOST = "orca.db.host";
    public static final String KEY_ORCA_DB_PORT = "orca.db.port";
    public static final String KEY_ORCA_DB_NAME = "orca.db.name";
    public static final String KEY_ORCA_DB_USER = "orca.db.user";
    public static final String KEY_ORCA_DB_PASSWORD = "orca.db.password";
    public static final String KEY_ORCA_DB_SSLMODE = "orca.db.sslmode";
    public static final String KEY_ORCA_DB_SSLROOTCERT = "orca.db.sslrootcert";
    public static final String KEY_ORCA_DB_SECRET_REF = "orca.db.secret-ref";
    public static final String KEY_ORCA_DB_SECRET_VERSION = "orca.db.secret-version";

    public static final String KEY_FACTOR2_AES_KEY_B64 = "factor2.aes-key-b64";

    public static final String KEY_FIDO2_RP_ID = "fido2.rp.id";
    public static final String KEY_FIDO2_RP_NAME = "fido2.rp.name";
    public static final String KEY_FIDO2_ALLOWED_ORIGINS = "fido2.allowed.origins";

    public static final String KEY_PLIVO_AUTH_ID = "plivo.auth.id";
    public static final String KEY_PLIVO_AUTH_TOKEN = "plivo.auth.token";
    public static final String KEY_PLIVO_SOURCE_NUMBER = "plivo.source.number";
    public static final String KEY_PLIVO_BASE_URL = "plivo.base-url";
    public static final String KEY_PLIVO_ENVIRONMENT = "plivo.environment";
    public static final String KEY_PLIVO_DEFAULT_COUNTRY = "plivo.default-country";

    public ServerRuntimeConfiguration.RuntimeSettings runtime() {
        String environment = optional(KEY_ENVIRONMENT).orElse(null);
        ZoneId timezone = resolveTimezone(optional(KEY_TIMEZONE).orElse("Asia/Tokyo"));
        String serverDataDirectory = optional(KEY_SERVER_DATA_DIR).orElse(null);
        return new ServerRuntimeConfiguration.RuntimeSettings(environment, timezone, serverDataDirectory);
    }

    public ServerRuntimeConfiguration.OrcaRuntimeSettings orcaRuntime() {
        return new ServerRuntimeConfiguration.OrcaRuntimeSettings(
                optional(KEY_FACILITY_ID).orElse(null),
                optionalBoolean(KEY_CLOUD_ZERO).orElse(false),
                new ServerRuntimeConfiguration.PvtListenerSettings(
                        optionalBoolean(KEY_PVT_ENABLED).orElse(false),
                        optional(KEY_PVT_BIND_IP).orElse(null),
                        optionalInteger(KEY_PVT_PORT).orElse(null),
                        optional(KEY_PVT_ENCODING).orElse(null),
                        optionalInteger(KEY_PVT_ACCEPT_TIMEOUT_MILLIS).orElse(null),
                        optionalInteger(KEY_PVT_READ_TIMEOUT_MILLIS).orElse(null),
                        optionalInteger(KEY_PVT_MAX_THREADS).orElse(null),
                        optionalInteger(KEY_PVT_QUEUE_CAPACITY).orElse(null),
                        optionalInteger(KEY_PVT_RETRY_MAX).orElse(null),
                        optionalInteger(KEY_PVT_RETRY_BACKOFF_MILLIS).orElse(null),
                        optionalLong(KEY_PVT_IDEMPOTENCY_WINDOW_MILLIS).orElse(null),
                        optionalInteger(KEY_PVT_POISON_QUEUE_CAPACITY).orElse(null)
                )
        );
    }

    public ServerRuntimeConfiguration.DatasourceSettings orcaDatasource() {
        boolean orcaSpecific = hasAny(
                KEY_ORCA_DB_HOST,
                KEY_ORCA_DB_PORT,
                KEY_ORCA_DB_NAME,
                KEY_ORCA_DB_USER,
                KEY_ORCA_DB_PASSWORD,
                KEY_ORCA_DB_SSLMODE,
                KEY_ORCA_DB_SSLROOTCERT,
                KEY_ORCA_DB_SECRET_REF,
                KEY_ORCA_DB_SECRET_VERSION);
        String prefix = orcaSpecific ? "orca.db" : "db";
        return new ServerRuntimeConfiguration.DatasourceSettings(
                prefix,
                optional(orcaSpecific ? KEY_ORCA_DB_HOST : KEY_DB_HOST).orElse(null),
                optionalInteger(orcaSpecific ? KEY_ORCA_DB_PORT : KEY_DB_PORT).orElse(null),
                optional(orcaSpecific ? KEY_ORCA_DB_NAME : KEY_DB_NAME).orElse(null),
                optional(orcaSpecific ? KEY_ORCA_DB_USER : KEY_DB_USER).orElse(null),
                optional(orcaSpecific ? KEY_ORCA_DB_PASSWORD : KEY_DB_PASSWORD).orElse(null),
                optional(orcaSpecific ? KEY_ORCA_DB_SSLMODE : KEY_DB_SSLMODE).orElse(null),
                optionalPath(orcaSpecific ? KEY_ORCA_DB_SSLROOTCERT : KEY_DB_SSLROOTCERT).orElse(null),
                optional(KEY_ORCA_DB_SECRET_REF).orElse(null),
                optional(KEY_ORCA_DB_SECRET_VERSION).orElse(null)
        );
    }

    public ServerRuntimeConfiguration.Factor2Settings factor2() {
        return new ServerRuntimeConfiguration.Factor2Settings(optional(KEY_FACTOR2_AES_KEY_B64).orElse(null));
    }

    public ServerRuntimeConfiguration.Fido2Settings fido2() {
        List<String> allowedOrigins = optional(KEY_FIDO2_ALLOWED_ORIGINS)
                .map(value -> Arrays.stream(value.split(","))
                        .map(String::trim)
                        .filter(token -> !token.isEmpty())
                        .collect(Collectors.toList()))
                .orElse(List.of());
        return new ServerRuntimeConfiguration.Fido2Settings(
                optional(KEY_FIDO2_RP_ID).orElse(null),
                optional(KEY_FIDO2_RP_NAME).orElse(null),
                allowedOrigins);
    }

    public ServerRuntimeConfiguration.PlivoSettings plivo() {
        return new ServerRuntimeConfiguration.PlivoSettings(
                optional(KEY_PLIVO_AUTH_ID).orElse(null),
                optional(KEY_PLIVO_AUTH_TOKEN).orElse(null),
                optional(KEY_PLIVO_SOURCE_NUMBER).orElse(null),
                optional(KEY_PLIVO_BASE_URL).orElse(null),
                optional(KEY_PLIVO_ENVIRONMENT).orElse(null),
                optional(KEY_PLIVO_DEFAULT_COUNTRY).orElse(null)
        );
    }

    Optional<String> optional(String key) {
        Config config = resolveConfig();
        if (config != null) {
            try {
                Optional<String> value = config.getOptionalValue(key, String.class)
                        .map(String::trim)
                        .filter(token -> !token.isEmpty());
                if (value.isPresent()) {
                    return value;
                }
            } catch (RuntimeException ignored) {
                // fall back to direct property/env lookup below
            }
        }
        String systemValue = trimToNull(System.getProperty(key));
        if (systemValue != null) {
            return Optional.of(systemValue);
        }
        String envValue = trimToNull(System.getenv(toEnvKey(key)));
        return Optional.ofNullable(envValue);
    }

    private Optional<Integer> optionalInteger(String key) {
        return optional(key).map(Integer::valueOf);
    }

    private Optional<Long> optionalLong(String key) {
        return optional(key).map(Long::valueOf);
    }

    private Optional<Boolean> optionalBoolean(String key) {
        return optional(key).map(this::parseBoolean);
    }

    private Optional<Path> optionalPath(String key) {
        return optional(key).map(value -> Path.of(value).toAbsolutePath().normalize());
    }

    private boolean hasAny(String... keys) {
        for (String key : keys) {
            if (optional(key).isPresent()) {
                return true;
            }
        }
        return false;
    }

    private Config resolveConfig() {
        try {
            return ConfigProvider.getConfig();
        } catch (IllegalStateException ex) {
            return null;
        }
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private String toEnvKey(String key) {
        return key.replace('.', '_')
                .replace('-', '_')
                .toUpperCase(Locale.ROOT);
    }

    private Boolean parseBoolean(String value) {
        String normalized = value.trim().toLowerCase(Locale.ROOT);
        return switch (normalized) {
            case "1", "true", "yes", "y", "on" -> Boolean.TRUE;
            case "0", "false", "no", "n", "off" -> Boolean.FALSE;
            default -> throw new IllegalArgumentException("Unsupported boolean value: " + value);
        };
    }

    private ZoneId resolveTimezone(String value) {
        try {
            return ZoneId.of(value);
        } catch (RuntimeException ex) {
            return null;
        }
    }
}
