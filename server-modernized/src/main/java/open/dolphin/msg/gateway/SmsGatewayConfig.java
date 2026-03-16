package open.dolphin.msg.gateway;

import com.plivo.api.models.base.LogLevel;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.net.URI;
import java.net.URISyntaxException;
import java.time.Duration;
import java.util.Locale;
import java.util.logging.Level;
import java.util.logging.Logger;
import open.dolphin.runtime.config.ServerConfigurationResolver;
import open.dolphin.runtime.config.ServerRuntimeConfiguration;

/**
 * Plivo SMS ゲートウェイ設定を typed runtime config から解決する。
 */
@ApplicationScoped
public class SmsGatewayConfig {

    private static final Logger LOGGER = Logger.getLogger(SmsGatewayConfig.class.getName());

    private static final String ENVIRONMENT_SANDBOX = "sandbox";
    private static final String DEFAULT_PROD_BASE = "https://api.plivo.com/v1/";
    private static final String DEFAULT_SANDBOX_BASE = "https://api.sandbox.plivo.com/v1/";

    private static final Duration DEFAULT_CONNECT_TIMEOUT = Duration.ofSeconds(10);
    private static final Duration DEFAULT_READ_TIMEOUT = Duration.ofSeconds(30);
    private static final Duration DEFAULT_WRITE_TIMEOUT = Duration.ofSeconds(30);
    private static final Duration DEFAULT_CALL_TIMEOUT = Duration.ofSeconds(45);

    @Inject
    ServerConfigurationResolver configurationResolver;

    private volatile PlivoSettings cachedSettings;

    public SmsGatewayConfig() {
    }

    SmsGatewayConfig(ServerConfigurationResolver configurationResolver) {
        this.configurationResolver = configurationResolver;
    }

    public PlivoSettings plivoSettings() {
        PlivoSettings settings = cachedSettings;
        if (settings == null) {
            settings = reload();
        }
        return settings;
    }

    public synchronized PlivoSettings reload() {
        ServerRuntimeConfiguration.PlivoSettings settings = configurationResolver.plivo();
        PlivoSettings resolved = new PlivoSettings(
                trim(settings.authId()),
                trim(settings.authToken()),
                trim(settings.sourceNumber()),
                determineBaseUrl(settings.environment(), settings.baseUrl()),
                environmentName(settings.environment()),
                parseLogLevel(settings.logLevel()),
                settings.logMessageContent() != null && settings.logMessageContent(),
                normalizeCountryCode(settings.defaultCountryCode()),
                settings.connectTimeout() != null ? settings.connectTimeout() : DEFAULT_CONNECT_TIMEOUT,
                settings.readTimeout() != null ? settings.readTimeout() : DEFAULT_READ_TIMEOUT,
                settings.writeTimeout() != null ? settings.writeTimeout() : DEFAULT_WRITE_TIMEOUT,
                settings.callTimeout() != null ? settings.callTimeout() : DEFAULT_CALL_TIMEOUT,
                settings.retryOnConnectionFailure() == null || settings.retryOnConnectionFailure()
        );
        cachedSettings = resolved;
        return resolved;
    }

    private String determineBaseUrl(String environment, String candidate) {
        String trimmed = trim(candidate);
        if (trimmed == null || trimmed.isEmpty()) {
            trimmed = ENVIRONMENT_SANDBOX.equalsIgnoreCase(trim(environment))
                    ? DEFAULT_SANDBOX_BASE
                    : DEFAULT_PROD_BASE;
        }
        try {
            URI uri = new URI(trimmed);
            if (!"https".equalsIgnoreCase(uri.getScheme())) {
                throw new IllegalArgumentException("Plivo base URL must use HTTPS");
            }
        } catch (URISyntaxException ex) {
            throw new IllegalArgumentException("Plivo base URL is invalid: " + trimmed, ex);
        }
        return ensureTrailingSlash(trimmed);
    }

    private String ensureTrailingSlash(String value) {
        return value.endsWith("/") ? value : value + "/";
    }

    private LogLevel parseLogLevel(String value) {
        if (value == null || value.isBlank()) {
            return LogLevel.NONE;
        }
        try {
            return LogLevel.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            LOGGER.log(Level.WARNING, "Invalid plivo.log.level value: {0}", value);
            return LogLevel.NONE;
        }
    }

    private String normalizeCountryCode(String value) {
        if (value == null || value.isBlank()) {
            return "+81";
        }
        String trimmed = value.trim();
        return trimmed.startsWith("+") ? trimmed : "+" + trimmed;
    }

    private String environmentName(String value) {
        String trimmed = trim(value);
        return trimmed == null ? "production" : trimmed.toLowerCase(Locale.ROOT);
    }

    private String trim(String value) {
        return value != null ? value.trim() : null;
    }

    public record PlivoSettings(
            String authId,
            String authToken,
            String sourceNumber,
            String baseUrl,
            String environment,
            LogLevel logLevel,
            boolean logMessageContent,
            String defaultCountryCode,
            Duration connectTimeout,
            Duration readTimeout,
            Duration writeTimeout,
            Duration callTimeout,
            boolean retryOnConnectionFailure
    ) {

        public boolean isConfigured() {
            return authId != null && !authId.isBlank()
                    && authToken != null && !authToken.isBlank()
                    && sourceNumber != null && !sourceNumber.isBlank();
        }
    }
}
