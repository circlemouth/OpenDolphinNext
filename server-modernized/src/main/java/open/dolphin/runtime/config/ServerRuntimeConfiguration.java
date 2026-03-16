package open.dolphin.runtime.config;

import java.nio.file.Path;
import java.time.ZoneId;
import java.util.List;

/**
 * Typed runtime configuration contract for production server startup.
 */
public final class ServerRuntimeConfiguration {

    private ServerRuntimeConfiguration() {
    }

    public record RuntimeSettings(
            String environment,
            ZoneId timezone,
            String serverDataDirectory
    ) {
    }

    public record OrcaRuntimeSettings(
            String facilityId,
            boolean cloudZero,
            PvtListenerSettings pvtListener
    ) {
    }

    public record PvtListenerSettings(
            boolean enabled,
            String bindIp,
            Integer port,
            String encoding,
            Integer acceptTimeoutMillis,
            Integer readTimeoutMillis,
            Integer maxThreads,
            Integer queueCapacity,
            Integer retryMax,
            Integer retryBackoffMillis,
            Long idempotencyWindowMillis,
            Integer poisonQueueCapacity
    ) {
    }

    public record DatasourceSettings(
            String namespace,
            String host,
            Integer port,
            String database,
            String user,
            String password,
            String sslMode,
            Path sslRootCert,
            String secretRef,
            String secretVersion
    ) {
        public boolean isComplete() {
            return host != null && !host.isBlank()
                    && database != null && !database.isBlank()
                    && user != null && !user.isBlank()
                    && password != null && !password.isBlank();
        }
    }

    public record Factor2Settings(String aesKeyBase64) {
    }

    public record Fido2Settings(
            String relyingPartyId,
            String relyingPartyName,
            List<String> allowedOrigins
    ) {
        public Fido2Settings {
            allowedOrigins = allowedOrigins == null ? List.of() : List.copyOf(allowedOrigins);
        }
    }

    public record PlivoSettings(
            String authId,
            String authToken,
            String sourceNumber,
            String baseUrl,
            String environment,
            String defaultCountryCode
    ) {
    }
}
