package open.dolphin.orca.transport;

import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.util.Arrays;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.logging.Level;
import java.util.logging.Logger;
import javax.net.ssl.SSLContext;
import open.dolphin.orca.config.OrcaConnectionConfigStore;
import open.dolphin.orca.transport.OrcaConnectionPolicyException;
import open.dolphin.runtime.config.ServerConfigurationResolver;
import open.dolphin.runtime.config.ServerRuntimeConfiguration;

/**
 * Resolves facility-scoped ORCA transport settings and caches HttpClient instances.
 */
final class OrcaTransportRegistry {

    private static final Logger LOGGER = Logger.getLogger(OrcaTransportRegistry.class.getName());
    private static final Duration DEFAULT_CONNECT_TIMEOUT = Duration.ofSeconds(5);

    private final OrcaConnectionConfigStore orcaConnectionConfigStore;
    private final long cacheTtlMs;
    private final ServerConfigurationResolver configurationResolver;
    private final Map<String, CachedTransportEntry> facilityCache = new ConcurrentHashMap<>();

    OrcaTransportRegistry(OrcaConnectionConfigStore orcaConnectionConfigStore, long cacheTtlMs,
            ServerConfigurationResolver configurationResolver) {
        this.orcaConnectionConfigStore = orcaConnectionConfigStore;
        this.cacheTtlMs = cacheTtlMs;
        this.configurationResolver = configurationResolver != null ? configurationResolver : new ServerConfigurationResolver();
    }

    OrcaResolvedTransport currentTransport(String facilityId) {
        CachedTransportEntry entry = currentEntry(facilityId);
        return entry != null ? entry.transport() : null;
    }

    OrcaTransportSettings currentSettings(String facilityId) {
        OrcaResolvedTransport transport = currentTransport(facilityId);
        return transport != null ? transport.settings() : null;
    }

    HttpClient rawHttpClient(String facilityId) {
        OrcaResolvedTransport transport = currentTransport(facilityId);
        return transport != null ? transport.rawHttpClient() : null;
    }

    OrcaTransportSettings reloadSettings(String facilityId) {
        CachedTransportEntry entry = reloadCache(facilityId);
        return entry != null ? entry.transport().settings() : null;
    }

    private CachedTransportEntry currentEntry(String facilityId) {
        String key = cacheKey(requireFacilityId(facilityId));
        CachedTransportEntry entry = facilityCache.get(key);
        if (entry == null || entry.isExpired(cacheTtlMs)) {
            entry = reloadCache(facilityId, entry);
        }
        return entry;
    }

    private CachedTransportEntry reloadCache(String facilityId) {
        String key = cacheKey(requireFacilityId(facilityId));
        return reloadCache(facilityId, facilityCache.get(key));
    }

    private CachedTransportEntry reloadCache(String facilityId, CachedTransportEntry existingEntry) {
        facilityId = requireFacilityId(facilityId);
        String key = cacheKey(facilityId);
        ResolvedTransportConfig resolvedConfig = loadSettingsExplicit(facilityId);
        if (resolvedConfig == null) {
            LOGGER.warning("ORCA transport settings load returned null");
            facilityCache.remove(key);
            return null;
        }
        CachedTransportEntry entry = existingEntry != null && existingEntry.hasFingerprint(resolvedConfig.fingerprint())
                ? existingEntry.refresh(resolvedConfig.settings(), resolvedConfig.fingerprint(), System.currentTimeMillis())
                : buildTransportEntry(resolvedConfig);
        if (!entry.transport().settings().isReady()) {
            LOGGER.log(Level.WARNING, "ORCA transport settings not ready: {0}", entry.transport().settings().auditSummary());
        }
        facilityCache.put(key, entry);
        return entry;
    }

    private ResolvedTransportConfig loadSettingsExplicit(String facilityId) {
        if (orcaConnectionConfigStore == null) {
            return loadFallbackSettings();
        }
        if (orcaConnectionConfigStore.listConfiguredFacilityIds().isEmpty()) {
            return loadFallbackSettings();
        }
        try {
            return loadSettingsFromAdminConfig(facilityId);
        } catch (OrcaConnectionPolicyException ex) {
            if (OrcaConnectionConfigStore.REASON_CODE_FACILITY_CONFIGURATION_MISSING.equals(ex.getErrorCategory())) {
                LOGGER.log(Level.INFO,
                        "ORCA admin config is not bootstrapped for facilityId={0}; using external runtime config fallback",
                        safeFacility(facilityId));
                return loadFallbackSettings();
            }
            LOGGER.log(Level.WARNING,
                    "Failed to load ORCA transport settings from admin config: " + ex.getMessage()
                            + " facilityId=" + safeFacility(facilityId),
                    ex);
            return null;
        } catch (RuntimeException ex) {
            LOGGER.log(Level.WARNING,
                    "Failed to load ORCA transport settings from admin config: " + ex.getMessage()
                            + " facilityId=" + safeFacility(facilityId),
                    ex);
            return null;
        }
    }

    private ResolvedTransportConfig loadSettingsFromAdminConfig(String facilityId) {
        if (orcaConnectionConfigStore == null) {
            return null;
        }

        OrcaConnectionConfigStore.ResolvedOrcaConnection resolved = orcaConnectionConfigStore.resolve(facilityId);
        OrcaTransportSettings settings = OrcaTransportSettings.fromAdminConfig(
                resolved.baseUrl(),
                resolved.useWeborca(),
                resolved.username(),
                resolved.password(),
                configurationResolver);
        return ResolvedTransportConfig.forAdminConfig(
                settings,
                resolved.clientAuthEnabled(),
                resolved.clientCertificateP12(),
                resolved.clientCertificatePassphrase(),
                resolved.caCertificate());
    }

    private ResolvedTransportConfig loadFallbackSettings() {
        OrcaTransportSettings settings = OrcaTransportSettings.load(configurationResolver);
        return ResolvedTransportConfig.forFallback(settings);
    }

    private CachedTransportEntry buildTransportEntry(ResolvedTransportConfig resolvedConfig) {
        HttpClient.Builder builder = HttpClient.newBuilder()
                .connectTimeout(resolveConnectTimeout())
                .followRedirects(HttpClient.Redirect.NEVER);
        if (resolvedConfig.requiresCustomSslContext()) {
            builder.sslContext(resolvedConfig.buildSslContext());
        }
        HttpClient raw = builder.build();
        OrcaResolvedTransport transport = new OrcaResolvedTransport(
                resolvedConfig.settings(),
                raw,
                new OrcaHttpClient(raw, configurationResolver.orcaTransportHttp()));
        return new CachedTransportEntry(
                transport,
                System.currentTimeMillis(),
                resolvedConfig.fingerprint());
    }

    private Duration resolveConnectTimeout() {
        ServerRuntimeConfiguration.OrcaTransportHttpSettings settings = configurationResolver.orcaTransportHttp();
        Duration configured = settings.connectTimeout();
        if (configured == null || configured.isZero() || configured.isNegative()) {
            return DEFAULT_CONNECT_TIMEOUT;
        }
        return configured;
    }

    private static String cacheKey(String facilityId) {
        return requireFacilityId(facilityId);
    }

    private static String normalizeFacilityId(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static String requireFacilityId(String facilityId) {
        String normalized = normalizeFacilityId(facilityId);
        if (normalized == null || "default".equalsIgnoreCase(normalized)) {
            throw new IllegalStateException("ORCA facilityId is required");
        }
        return normalized;
    }

    private static String safeFacility(String facilityId) {
        return facilityId != null ? facilityId : "missing";
    }

    record OrcaResolvedTransport(
            OrcaTransportSettings settings,
            HttpClient rawHttpClient,
            OrcaHttpClient httpClient) {
    }

    private record CachedTransportEntry(
            OrcaResolvedTransport transport,
            long loadedAtEpochMilli,
            String fingerprint) {

        private boolean isExpired(long ttlMs) {
            if (ttlMs <= 0L) {
                return true;
            }
            return System.currentTimeMillis() - loadedAtEpochMilli >= ttlMs;
        }

        private boolean hasFingerprint(String candidate) {
            return fingerprint != null && fingerprint.equals(candidate);
        }

        private CachedTransportEntry refresh(OrcaTransportSettings refreshedSettings, String refreshedFingerprint, long refreshedAt) {
            OrcaResolvedTransport currentTransport = transport();
            return new CachedTransportEntry(
                    new OrcaResolvedTransport(refreshedSettings, currentTransport.rawHttpClient(), currentTransport.httpClient()),
                    refreshedAt,
                    refreshedFingerprint);
        }
    }

    private record ResolvedTransportConfig(
            OrcaTransportSettings settings,
            boolean clientAuthEnabled,
            byte[] clientCertificateP12,
            String clientCertificatePassphrase,
            byte[] caCertificate,
            String fingerprint) {

        private static ResolvedTransportConfig forAdminConfig(
                OrcaTransportSettings settings,
                boolean clientAuthEnabled,
                byte[] clientCertificateP12,
                String clientCertificatePassphrase,
                byte[] caCertificate) {
            byte[] p12Copy = clientCertificateP12 != null ? Arrays.copyOf(clientCertificateP12, clientCertificateP12.length) : null;
            byte[] caCopy = caCertificate != null ? Arrays.copyOf(caCertificate, caCertificate.length) : null;
            return new ResolvedTransportConfig(
                    settings,
                    clientAuthEnabled,
                    p12Copy,
                    clientCertificatePassphrase,
                    caCopy,
                    computeFingerprint(settings, clientAuthEnabled, p12Copy, clientCertificatePassphrase, caCopy));
        }

        private static ResolvedTransportConfig forFallback(OrcaTransportSettings settings) {
            return new ResolvedTransportConfig(
                    settings,
                    false,
                    null,
                    null,
                    null,
                    computeFingerprint(settings, false, null, null, null));
        }

        private boolean requiresCustomSslContext() {
            return clientAuthEnabled || (caCertificate != null && caCertificate.length > 0);
        }

        private SSLContext buildSslContext() {
            return OrcaTlsSupport.buildSslContext(
                    clientAuthEnabled ? clientCertificateP12 : null,
                    clientAuthEnabled ? clientCertificatePassphrase : null,
                    caCertificate);
        }
    }

    private static String computeFingerprint(
            OrcaTransportSettings settings,
            boolean clientAuthEnabled,
            byte[] clientCertificateP12,
            String clientCertificatePassphrase,
            byte[] caCertificate) {
        MessageDigest digest = newDigest();
        updateDigest(digest, settings != null ? settings.cacheFingerprint() : null);
        updateDigest(digest, clientAuthEnabled);
        updateDigest(digest, clientCertificateP12);
        updateDigest(digest, clientCertificatePassphrase);
        updateDigest(digest, caCertificate);
        return toHex(digest.digest());
    }

    private static MessageDigest newDigest() {
        try {
            return MessageDigest.getInstance("SHA-256");
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 digest unavailable", ex);
        }
    }

    private static void updateDigest(MessageDigest digest, String value) {
        if (value == null) {
            digest.update((byte) 0);
            return;
        }
        digest.update((byte) 1);
        byte[] bytes = value.getBytes(StandardCharsets.UTF_8);
        digest.update(intBytes(bytes.length));
        digest.update(bytes);
    }

    private static void updateDigest(MessageDigest digest, byte[] value) {
        if (value == null) {
            digest.update((byte) 0);
            return;
        }
        digest.update((byte) 1);
        digest.update(intBytes(value.length));
        digest.update(value);
    }

    private static void updateDigest(MessageDigest digest, boolean value) {
        digest.update((byte) (value ? 1 : 0));
    }

    private static byte[] intBytes(int value) {
        return new byte[]{
                (byte) (value >>> 24),
                (byte) (value >>> 16),
                (byte) (value >>> 8),
                (byte) value
        };
    }

    private static String toHex(byte[] bytes) {
        StringBuilder builder = new StringBuilder(bytes.length * 2);
        for (byte value : bytes) {
            builder.append(Character.forDigit((value >>> 4) & 0xF, 16));
            builder.append(Character.forDigit(value & 0xF, 16));
        }
        return builder.toString();
    }
}
