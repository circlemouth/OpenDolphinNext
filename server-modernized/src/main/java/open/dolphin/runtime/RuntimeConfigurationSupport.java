package open.dolphin.runtime;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.ZoneId;
import java.util.Locale;
import java.util.Set;

/**
 * Shared runtime configuration helpers for environment/safety-sensitive settings.
 */
public final class RuntimeConfigurationSupport {

    public static final String PROP_ENVIRONMENT = "opendolphin.environment";
    public static final String ENV_ENVIRONMENT = "OPENDOLPHIN_ENVIRONMENT";
    public static final String PROP_SERVER_DATA_DIR = "jboss.server.data.dir";
    public static final String PROP_TIMEZONE = "opendolphin.timezone";
    public static final String ENV_TIMEZONE = "OPENDOLPHIN_TIMEZONE";
    public static final String DEFAULT_TIMEZONE = "Asia/Tokyo";

    private static final Set<String> PRODUCTION_LIKE_PREFIXES = Set.of(
            "prod", "prd", "production", "stage", "stg", "staging", "it", "uat");

    private RuntimeConfigurationSupport() {
    }

    public static String resolveEnvironment() {
        return firstNonBlank(
                System.getProperty(PROP_ENVIRONMENT),
                System.getenv(ENV_ENVIRONMENT),
                System.getenv("ENVIRONMENT"),
                System.getenv("DEPLOY_ENV"),
                System.getenv("STAGE")
        );
    }

    public static boolean isProductionLikeEnvironment(String environment) {
        if (environment == null || environment.isBlank()) {
            return false;
        }
        String normalized = environment.trim().toLowerCase(Locale.ROOT);
        for (String prefix : PRODUCTION_LIKE_PREFIXES) {
            if (normalized.startsWith(prefix)) {
                return true;
            }
        }
        return false;
    }

    public static Path resolveServerDataDirectoryOrThrow(String component) {
        String raw = firstNonBlank(System.getProperty(PROP_SERVER_DATA_DIR));
        if (raw == null) {
            throw new IllegalStateException(component
                    + " requires -D" + PROP_SERVER_DATA_DIR
                    + ". Unsafe /tmp or user.home fallback is disabled.");
        }
        Path path = Paths.get(raw).toAbsolutePath().normalize();
        try {
            Files.createDirectories(path);
        } catch (IOException ex) {
            throw new IllegalStateException("Failed to create server data directory: " + path, ex);
        }
        return path;
    }

    public static String describeServerDataDirectory() {
        String raw = firstNonBlank(System.getProperty(PROP_SERVER_DATA_DIR));
        if (raw == null) {
            return "MISSING(-D" + PROP_SERVER_DATA_DIR + ")";
        }
        return Paths.get(raw).toAbsolutePath().normalize().toString();
    }

    public static String resolveTimezoneId() {
        String configured = firstNonBlank(System.getProperty(PROP_TIMEZONE), System.getenv(ENV_TIMEZONE));
        if (configured == null) {
            return DEFAULT_TIMEZONE;
        }
        try {
            return ZoneId.of(configured.trim()).getId();
        } catch (RuntimeException ex) {
            return DEFAULT_TIMEZONE;
        }
    }

    public static ZoneId resolveTimezone() {
        return ZoneId.of(resolveTimezoneId());
    }

    public static Boolean parseBooleanFlag(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String normalized = value.trim().toLowerCase(Locale.ROOT);
        switch (normalized) {
            case "1":
            case "true":
            case "yes":
            case "y":
            case "on":
                return Boolean.TRUE;
            case "0":
            case "false":
            case "no":
            case "n":
            case "off":
                return Boolean.FALSE;
            default:
                return null;
        }
    }

    public static String firstNonBlank(String... candidates) {
        if (candidates == null) {
            return null;
        }
        for (String candidate : candidates) {
            if (candidate != null && !candidate.isBlank()) {
                return candidate.trim();
            }
        }
        return null;
    }
}
