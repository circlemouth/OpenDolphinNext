package open.dolphin.runtime;

import java.util.Locale;
import java.util.Set;

/**
 * Shared runtime configuration helpers for environment/safety-sensitive settings.
 */
public final class RuntimeConfigurationSupport {

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
