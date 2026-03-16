package open.dolphin.runtime.config;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;

/**
 * Startup validation for required runtime settings.
 */
@ApplicationScoped
public class ServerConfigurationValidator {

    @Inject
    ServerConfigurationResolver resolver;

    public ServerConfigurationValidator() {
    }

    ServerConfigurationValidator(ServerConfigurationResolver resolver) {
        this.resolver = resolver;
    }

    public void validateOrThrow() {
        List<String> errors = new ArrayList<>();

        validateRuntime(errors, resolver.runtime());
        validateDatasource(errors, resolver.orcaDatasource());
        validateFactor2(errors, resolver.factor2());
        validateFido2(errors, resolver.fido2());

        if (!errors.isEmpty()) {
            throw new IllegalStateException("Startup configuration validation failed: " + String.join(" | ", errors));
        }
    }

    private void validateRuntime(List<String> errors, ServerRuntimeConfiguration.RuntimeSettings settings) {
        if (settings.environment() == null || settings.environment().isBlank()) {
            errors.add(ServerConfigurationResolver.KEY_ENVIRONMENT + " is required");
        }
        if (settings.timezone() == null) {
            errors.add(ServerConfigurationResolver.KEY_TIMEZONE + " is invalid");
        }
    }

    private void validateDatasource(List<String> errors, ServerRuntimeConfiguration.DatasourceSettings settings) {
        List<String> missing = new ArrayList<>();
        if (isBlank(settings.host())) {
            missing.add(settings.namespace() + ".host");
        }
        if (isBlank(settings.database())) {
            missing.add(settings.namespace() + ".name");
        }
        if (isBlank(settings.user())) {
            missing.add(settings.namespace() + ".user");
        }
        if (isBlank(settings.password())) {
            missing.add(settings.namespace() + ".password");
        }
        if (!missing.isEmpty()) {
            errors.add("ORCA datasource secrets are incomplete: " + String.join(",", missing));
        }
    }

    private void validateFactor2(List<String> errors, ServerRuntimeConfiguration.Factor2Settings settings) {
        if (isBlank(settings.aesKeyBase64())) {
            errors.add(ServerConfigurationResolver.KEY_FACTOR2_AES_KEY_B64 + " is required");
            return;
        }
        try {
            Base64.getDecoder().decode(settings.aesKeyBase64());
        } catch (IllegalArgumentException ex) {
            errors.add(ServerConfigurationResolver.KEY_FACTOR2_AES_KEY_B64 + " must be valid Base64");
        }
    }

    private void validateFido2(List<String> errors, ServerRuntimeConfiguration.Fido2Settings settings) {
        if (isBlank(settings.relyingPartyId())) {
            errors.add(ServerConfigurationResolver.KEY_FIDO2_RP_ID + " is required");
        }
        if (isBlank(settings.relyingPartyName())) {
            errors.add(ServerConfigurationResolver.KEY_FIDO2_RP_NAME + " is required");
        }
        if (settings.allowedOrigins().isEmpty()) {
            errors.add(ServerConfigurationResolver.KEY_FIDO2_ALLOWED_ORIGINS + " must contain at least one origin");
            return;
        }
        for (String origin : settings.allowedOrigins()) {
            try {
                URI uri = new URI(origin);
                String scheme = uri.getScheme();
                if (!"http".equalsIgnoreCase(scheme) && !"https".equalsIgnoreCase(scheme)) {
                    errors.add("Invalid FIDO2 origin scheme: " + origin);
                }
            } catch (URISyntaxException ex) {
                errors.add("Invalid FIDO2 origin: " + origin);
            }
        }
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
