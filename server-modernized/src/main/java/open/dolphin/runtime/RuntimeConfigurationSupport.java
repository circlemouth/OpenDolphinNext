package open.dolphin.runtime;

import java.util.Locale;
import java.util.Set;

/**
 * Shared runtime configuration helpers for environment/safety-sensitive settings.
 */
public final class RuntimeConfigurationSupport {

    public static final String PROP_ENVIRONMENT = "opendolphin.environment";
    public static final String PROP_SERVER_DATA_DIR = "jboss.server.data.dir";
    public static final String PROP_FACILITY_ID = "dolphin.facilityId";

    private static final Set<String> PRODUCTION_LIKE_PREFIXES = Set.of(
            "prod", "prd", "production", "stage", "stg", "staging", "it", "uat");

    private RuntimeConfigurationSupport() {
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
