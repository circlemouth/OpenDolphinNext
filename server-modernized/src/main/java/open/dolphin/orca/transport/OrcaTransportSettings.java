package open.dolphin.orca.transport;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Locale;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * Shared configuration resolver for ORCA HTTP transport.
 */
public final class OrcaTransportSettings {

    private static final Logger LOGGER = Logger.getLogger(OrcaTransportSettings.class.getName());

    private static final String ENV_ORCA_API_HOST = "ORCA_API_HOST";
    private static final String ENV_ORCA_API_PORT = "ORCA_API_PORT";
    private static final String ENV_ORCA_API_SCHEME = "ORCA_API_SCHEME";
    private static final String ENV_ORCA_API_USER = "ORCA_API_USER";
    private static final String ENV_ORCA_API_PASSWORD = "ORCA_API_PASSWORD";
    private static final String ENV_ORCA_API_PATH_PREFIX = "ORCA_API_PATH_PREFIX";
    private static final String ENV_ORCA_API_WEBORCA = "ORCA_API_WEBORCA";
    private static final String ENV_ORCA_API_RETRY_MAX = "ORCA_API_RETRY_MAX";
    private static final String ENV_ORCA_API_RETRY_BACKOFF_MS = "ORCA_API_RETRY_BACKOFF_MS";
    private static final String ENV_ORCA_BASE_URL = "ORCA_BASE_URL";
    private static final String ENV_ORCA_MODE = "ORCA_MODE";
    private static final String PROP_ORCA_BASE_URL = "orca.base-url";
    private static final String PROP_ORCA_API_HOST = "orca.api.host";
    private static final String PROP_ORCA_API_PORT = "orca.api.port";
    private static final String PROP_ORCA_API_SCHEME = "orca.api.scheme";
    private static final String PROP_ORCA_API_USER = "orca.api.user";
    private static final String PROP_ORCA_API_PASSWORD = "orca.api.password";
    private static final String PROP_ORCA_API_PATH_PREFIX = "orca.api.path-prefix";
    private static final String PROP_ORCA_API_WEBORCA = "orca.api.weborca";
    private static final String PROP_ORCA_API_RETRY_MAX = "orca.api.retry.max";
    private static final String PROP_ORCA_API_RETRY_BACKOFF_MS = "orca.api.retry.backoff-ms";
    private static final String PROP_ORCA_MODE = "orca.mode";

    private static final int DEFAULT_RETRY_MAX = 0;
    private static final long DEFAULT_RETRY_BACKOFF_MS = 200L;

    private final String host;
    private final int port;
    private final String scheme;
    private final String user;
    private final String password;
    private final String pathPrefix;
    private final boolean weborcaExplicit;
    private final boolean autoApiPrefixEnabled;
    final int retryMax;
    final long retryBackoffMs;
    private final String baseUrl;
    private final String mode;
    private final String modeNormalized;

    private OrcaTransportSettings(String host, int port, String scheme, String user, String password,
            String pathPrefix, boolean weborcaExplicit, boolean autoApiPrefixEnabled,
            int retryMax, long retryBackoffMs, String baseUrl, String mode) {
        this.host = host;
        this.port = port;
        this.scheme = scheme;
        this.user = user;
        this.password = password;
        this.pathPrefix = pathPrefix;
        this.weborcaExplicit = weborcaExplicit;
        this.autoApiPrefixEnabled = autoApiPrefixEnabled;
        this.retryMax = retryMax;
        this.retryBackoffMs = retryBackoffMs;
        this.baseUrl = trim(baseUrl);
        this.mode = trim(mode);
        this.modeNormalized = normalizeMode(this.mode);
    }

    public static OrcaTransportSettings load() {
        String baseUrl = trim(external(ENV_ORCA_BASE_URL, PROP_ORCA_BASE_URL));
        String rawMode = trim(external(ENV_ORCA_MODE, PROP_ORCA_MODE));
        String mode = rawMode != null && !rawMode.isBlank() ? rawMode : null;
        String host = firstNonBlank(trim(external(ENV_ORCA_API_HOST, PROP_ORCA_API_HOST)));
        int port = resolvePort(parsePort(external(ENV_ORCA_API_PORT, PROP_ORCA_API_PORT)), null);
        String scheme = firstNonBlank(trim(external(ENV_ORCA_API_SCHEME, PROP_ORCA_API_SCHEME)));
        String user = firstNonBlank(trim(external(ENV_ORCA_API_USER, PROP_ORCA_API_USER)));
        String password = firstNonBlank(trim(external(ENV_ORCA_API_PASSWORD, PROP_ORCA_API_PASSWORD)));
        PrefixSpec prefixSpec = parsePathPrefix(external(ENV_ORCA_API_PATH_PREFIX, PROP_ORCA_API_PATH_PREFIX));
        String pathPrefix = prefixSpec.pathPrefix;
        boolean autoApiPrefixEnabled = prefixSpec.autoApiPrefixEnabled;
        boolean weborcaExplicit = parseBoolean(external(ENV_ORCA_API_WEBORCA, PROP_ORCA_API_WEBORCA));

        HostSpec baseSpec = parseHostSpec(baseUrl, scheme);
        if (baseSpec != null) {
            if (host == null || host.isBlank()) {
                host = baseSpec.host;
            }
            if (scheme == null || scheme.isBlank()) {
                scheme = baseSpec.schemeOverride;
            }
            if (port <= 0 && baseSpec.portOverride > 0) {
                port = baseSpec.portOverride;
            }
            if ((pathPrefix == null || pathPrefix.isBlank()) && baseSpec.pathPrefixOverride != null) {
                pathPrefix = baseSpec.pathPrefixOverride;
                autoApiPrefixEnabled = false;
            }
        }

        HostSpec spec = parseHostSpec(host, scheme);
        if (spec != null) {
            host = spec.host;
            if (spec.schemeOverride != null && (scheme == null || scheme.isBlank())) {
                scheme = spec.schemeOverride;
            }
            if (spec.portOverride > 0 && port <= 0) {
                port = spec.portOverride;
            }
            if ((pathPrefix == null || pathPrefix.isBlank()) && spec.pathPrefixOverride != null) {
                pathPrefix = spec.pathPrefixOverride;
                autoApiPrefixEnabled = false;
            }
        }
        boolean weborcaResolved = weborcaExplicit || isWebOrcaMode(mode);
        scheme = normalizeScheme(scheme, weborcaResolved);
        if (port <= 0) {
            port = isHttpsScheme(scheme) ? 443 : 80;
        }

        OrcaTransportSettings settings = new OrcaTransportSettings(
                host,
                port,
                scheme,
                user,
                password,
                pathPrefix,
                weborcaExplicit,
                autoApiPrefixEnabled,
                parseInt(external(ENV_ORCA_API_RETRY_MAX, PROP_ORCA_API_RETRY_MAX), DEFAULT_RETRY_MAX),
                parseLong(external(ENV_ORCA_API_RETRY_BACKOFF_MS, PROP_ORCA_API_RETRY_BACKOFF_MS), DEFAULT_RETRY_BACKOFF_MS),
                baseUrl,
                mode
        );
        settings.validateSecurityPolicy();
        return settings;
    }

    /**
     * Build settings from admin-managed ORCA connection config.
     *
     * <p>When {@code baseUrl} is provided, it is always used as the primary URL resolver
     * (same precedence as {@code ORCA_BASE_URL}).</p>
     */
    public static OrcaTransportSettings fromAdminConfig(String baseUrl,
            boolean useWeborca,
            String user,
            String password) {
        String resolvedBaseUrl = trim(baseUrl);
        if (resolvedBaseUrl == null || resolvedBaseUrl.isBlank()) {
            throw new IllegalArgumentException("baseUrl is required");
        }
        HostSpec spec = parseHostSpec(resolvedBaseUrl, null);
        String host = spec != null ? spec.host : null;
        String scheme = spec != null ? spec.schemeOverride : null;
        int port = spec != null ? spec.portOverride : -1;
        String mode = useWeborca ? "weborca" : "onprem";
        boolean autoApiPrefixEnabled = true;
        OrcaTransportSettings settings = new OrcaTransportSettings(
                host,
                port,
                scheme,
                user,
                password,
                null,
                false,
                autoApiPrefixEnabled,
                parseInt(external(ENV_ORCA_API_RETRY_MAX, PROP_ORCA_API_RETRY_MAX), DEFAULT_RETRY_MAX),
                parseLong(external(ENV_ORCA_API_RETRY_BACKOFF_MS, PROP_ORCA_API_RETRY_BACKOFF_MS), DEFAULT_RETRY_BACKOFF_MS),
                resolvedBaseUrl,
                mode
        );
        settings.validateSecurityPolicy();
        return settings;
    }

    public boolean isReady() {
        return (hasBaseUrl() || (host != null && !host.isBlank() && port > 0))
                && hasCredentials();
    }

    public boolean hasCredentials() {
        return user != null && !user.isBlank()
                && password != null && !password.isBlank();
    }

    public String buildUrl(OrcaEndpoint endpoint, String query) {
        String resolvedPath = normalizeEndpointPath(endpoint != null ? endpoint.getPath() : null);
        String url = buildOrcaUrl(resolvedPath);
        if (query != null && !query.isBlank()) {
            url = url + "?" + query;
        }
        return url;
    }

    public String buildOrcaUrl(String path) {
        String resolvedPath = normalizeEndpointPath(path);
        if (hasBaseUrl()) {
            return buildOrcaUrlFromBase(baseUrl, resolvedPath, isWebOrca(), pathPrefix, autoApiPrefixEnabled);
        }
        StringBuilder builder = new StringBuilder();
        builder.append(scheme != null ? scheme : "http");
        builder.append("://");
        builder.append(host);
        if (!(isHttps() && port == 443)) {
            builder.append(':');
            builder.append(port);
        }
        String resolvedPrefix = resolvePathPrefix(pathPrefix);
        builder.append(joinPath(resolvedPrefix, resolvedPath));
        return builder.toString();
    }

    public String getBaseUrl() {
        return baseUrl;
    }

    public boolean isWebOrca() {
        if (weborcaExplicit) {
            return true;
        }
        if (modeNormalized != null && "weborca".equals(modeNormalized)) {
            return true;
        }
        return false;
    }

    public String basicAuthHeader() {
        String token = user + ":" + password;
        String encoded = java.util.Base64.getEncoder().encodeToString(token.getBytes(java.nio.charset.StandardCharsets.UTF_8));
        return "Basic " + encoded;
    }

    public String auditSummary() {
        String resolvedScheme = scheme != null ? scheme : "http";
        if (hasBaseUrl()) {
            return String.format(Locale.ROOT, "orca.baseUrl=%s orca.mode=%s", safe(baseUrl), safe(modeNormalized));
        }
        return String.format(Locale.ROOT, "orca.host=%s orca.port=%d orca.scheme=%s", safe(host), port, resolvedScheme);
    }

    public int getRetryMax() {
        return retryMax;
    }

    public long getRetryBackoffMs() {
        return retryBackoffMs;
    }

    public String cacheFingerprint() {
        MessageDigest digest = newDigest();
        updateDigest(digest, host);
        updateDigest(digest, port);
        updateDigest(digest, scheme);
        updateDigest(digest, user);
        updateDigest(digest, password);
        updateDigest(digest, pathPrefix);
        updateDigest(digest, weborcaExplicit);
        updateDigest(digest, autoApiPrefixEnabled);
        updateDigest(digest, retryMax);
        updateDigest(digest, retryBackoffMs);
        updateDigest(digest, baseUrl);
        updateDigest(digest, mode);
        updateDigest(digest, modeNormalized);
        return toHex(digest.digest());
    }

    private boolean hasBaseUrl() {
        return baseUrl != null && !baseUrl.isBlank();
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

    private static void updateDigest(MessageDigest digest, boolean value) {
        digest.update((byte) (value ? 1 : 0));
    }

    private static void updateDigest(MessageDigest digest, int value) {
        digest.update(intBytes(value));
    }

    private static void updateDigest(MessageDigest digest, long value) {
        digest.update(new byte[]{
                (byte) (value >>> 56),
                (byte) (value >>> 48),
                (byte) (value >>> 40),
                (byte) (value >>> 32),
                (byte) (value >>> 24),
                (byte) (value >>> 16),
                (byte) (value >>> 8),
                (byte) value
        });
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

    private void validateSecurityPolicy() {
        if (!hasBaseUrl() && (host == null || host.isBlank())) {
            return;
        }
        String effectiveBaseUrl = hasBaseUrl() ? baseUrl : buildOrcaUrl("");
        OrcaTransportSecurityPolicy.validateBaseUrl(effectiveBaseUrl, isWebOrca());
    }

    private boolean isHttps() {
        return isHttpsScheme(scheme);
    }

    private static String external(String envKey, String propertyKey) {
        String fromEnv = envKey != null ? System.getenv(envKey) : null;
        if (fromEnv != null && !fromEnv.isBlank()) {
            return fromEnv;
        }
        String fromProp = propertyKey != null ? System.getProperty(propertyKey) : null;
        if (fromProp != null && !fromProp.isBlank()) {
            return fromProp;
        }
        return null;
    }

    private static String trim(String value) {
        return value == null ? null : value.trim();
    }

    private static String firstNonBlank(String... values) {
        if (values == null) {
            return null;
        }
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value.trim();
            }
        }
        return null;
    }

    private static int parsePort(String value) {
        if (value == null || value.isBlank()) {
            return -1;
        }
        try {
            return Integer.parseInt(value.trim());
        } catch (NumberFormatException ex) {
            LOGGER.log(Level.WARNING, "Invalid ORCA API port: {0}", value);
            return -1;
        }
    }

    private static int resolvePort(int primary, String... candidates) {
        if (primary > 0) {
            return primary;
        }
        if (candidates != null) {
            for (String candidate : candidates) {
                int parsed = parsePort(candidate);
                if (parsed > 0) {
                    return parsed;
                }
            }
        }
        return -1;
    }

    private static String normalizeScheme(String value, boolean weborca) {
        String schemeValue = trim(value);
        if (schemeValue == null || schemeValue.isBlank()) {
            return weborca ? "https" : "http";
        }
        return schemeValue.toLowerCase(Locale.ROOT);
    }

    private static boolean isHttpsScheme(String value) {
        return value != null && value.toLowerCase(Locale.ROOT).startsWith("https");
    }

    private static boolean parseBoolean(String value) {
        if (value == null) {
            return false;
        }
        return "true".equalsIgnoreCase(value)
                || "1".equals(value)
                || "yes".equalsIgnoreCase(value)
                || "on".equalsIgnoreCase(value);
    }

    private static int parseInt(String value, int fallback) {
        if (value == null || value.isBlank()) {
            return fallback;
        }
        try {
            return Integer.parseInt(value.trim());
        } catch (NumberFormatException ex) {
            return fallback;
        }
    }

    private static long parseLong(String value, long fallback) {
        if (value == null || value.isBlank()) {
            return fallback;
        }
        try {
            return Long.parseLong(value.trim());
        } catch (NumberFormatException ex) {
            return fallback;
        }
    }

    private static boolean isWebOrcaMode(String mode) {
        if (mode == null) {
            return false;
        }
        String normalized = mode.trim().toLowerCase(Locale.ROOT);
        return "weborca".equals(normalized) || "cloud".equals(normalized);
    }

    private static String normalizeMode(String mode) {
        if (mode == null) {
            return null;
        }
        String normalized = mode.trim().toLowerCase(Locale.ROOT);
        return normalized.isBlank() ? null : normalized;
    }

    private static PrefixSpec parsePathPrefix(String raw) {
        String trimmed = trim(raw);
        if (trimmed == null || trimmed.isBlank()) {
            return new PrefixSpec(null, true);
        }
        if (isExplicitDisable(trimmed)) {
            return new PrefixSpec("", false);
        }
        String normalized = normalizePathPrefix(trimmed);
        return new PrefixSpec(normalized, false);
    }

    private static boolean isExplicitDisable(String value) {
        String normalized = value.trim().toLowerCase(Locale.ROOT);
        return "off".equals(normalized)
                || "false".equals(normalized)
                || "none".equals(normalized)
                || "disable".equals(normalized)
                || "disabled".equals(normalized);
    }

    private static String normalizePathPrefix(String value) {
        String trimmed = trim(value);
        if (trimmed == null || trimmed.isBlank()) {
            return null;
        }
        if (!trimmed.startsWith("/")) {
            trimmed = "/" + trimmed;
        }
        if (trimmed.endsWith("/")) {
            trimmed = trimmed.substring(0, trimmed.length() - 1);
        }
        return trimmed;
    }

    private static String resolvePathPrefix(String prefix) {
        if (prefix == null || prefix.isBlank()) {
            return "";
        }
        return prefix.startsWith("/") ? prefix : "/" + prefix;
    }

    private static String normalizeEndpointPath(String path) {
        if (path == null || path.isBlank()) {
            return "";
        }
        String resolved = path.trim();
        if (!resolved.startsWith("/")) {
            resolved = "/" + resolved;
        }
        return resolved;
    }

    private static String joinPath(String prefix, String path) {
        String left = trimSlashes(prefix);
        String right = trimSlashes(path);
        if (left.isEmpty()) {
            return "/" + right;
        }
        if (right.isEmpty()) {
            return "/" + left;
        }
        return "/" + left + "/" + right;
    }

    static HostSpec parseHostSpec(String input, String fallbackScheme) {
        if (input == null || input.isBlank()) {
            return null;
        }
        String trimmed = input.trim();
        String schemeOverride = null;
        String host = trimmed;
        int portOverride = -1;
        String pathPrefixOverride = null;
        boolean parsedUri = false;
        if (trimmed.contains("://")) {
            try {
                java.net.URI uri = new java.net.URI(trimmed);
                schemeOverride = uri.getScheme();
                host = uri.getHost();
                portOverride = uri.getPort();
                pathPrefixOverride = normalizePathPrefix(uri.getPath());
                parsedUri = host != null && !host.isBlank();
                if (!parsedUri) {
                    host = uri.getRawAuthority();
                }
            } catch (java.net.URISyntaxException ex) {
                LOGGER.log(Level.WARNING, "Invalid ORCA host spec: {0}", trimmed);
            }
        }
        if (!parsedUri) {
            HostPortSpec hostPort = extractHostPort(host);
            host = hostPort.host;
            if (hostPort.portOverride > 0 && portOverride <= 0) {
                portOverride = hostPort.portOverride;
            }
            if ((pathPrefixOverride == null || pathPrefixOverride.isBlank())
                    && hostPort.pathPrefixOverride != null) {
                pathPrefixOverride = hostPort.pathPrefixOverride;
            }
        }
        if (schemeOverride == null && fallbackScheme != null && !fallbackScheme.isBlank()) {
            schemeOverride = fallbackScheme;
        }
        if (host == null || host.isBlank()) {
            return null;
        }
        return new HostSpec(stripIpv6Brackets(host), schemeOverride, portOverride, pathPrefixOverride);
    }

    private static HostPortSpec extractHostPort(String raw) {
        String value = trim(raw);
        if (value == null || value.isBlank()) {
            return new HostPortSpec(null, -1, null);
        }
        String pathPrefixOverride = null;
        String hostValue = value;
        int slashIndex = hostValue.indexOf('/');
        if (slashIndex >= 0) {
            pathPrefixOverride = normalizePathPrefix(hostValue.substring(slashIndex));
            hostValue = hostValue.substring(0, slashIndex);
        }

        int portOverride = -1;
        String host = hostValue;
        if (hostValue.startsWith("[")) {
            int end = hostValue.indexOf(']');
            if (end > 0) {
                host = hostValue.substring(1, end);
                if (end + 1 < hostValue.length() && hostValue.charAt(end + 1) == ':') {
                    portOverride = parsePort(hostValue.substring(end + 2));
                }
            }
        } else if (countChar(hostValue, ':') == 1) {
            String[] parts = hostValue.split(":", 2);
            host = parts[0];
            portOverride = parsePort(parts[1]);
        }
        return new HostPortSpec(host, portOverride, pathPrefixOverride);
    }

    private static int countChar(String value, char needle) {
        if (value == null || value.isBlank()) {
            return 0;
        }
        int count = 0;
        for (int i = 0; i < value.length(); i++) {
            if (value.charAt(i) == needle) {
                count++;
            }
        }
        return count;
    }

    private static String stripIpv6Brackets(String value) {
        String normalized = trim(value);
        if (normalized == null || normalized.length() < 2) {
            return normalized;
        }
        if (normalized.startsWith("[") && normalized.endsWith("]")) {
            return normalized.substring(1, normalized.length() - 1);
        }
        return normalized;
    }

    private static String trimSlashes(String value) {
        if (value == null) {
            return "";
        }
        String result = value.trim();
        while (result.startsWith("/")) {
            result = result.substring(1);
        }
        while (result.endsWith("/")) {
            result = result.substring(0, result.length() - 1);
        }
        return result;
    }

    private static String buildOrcaUrlFromBase(String baseUrl, String path, boolean weborca,
            String pathPrefix, boolean autoApiPrefixEnabled) {
        if (baseUrl == null || baseUrl.isBlank()) {
            return path != null ? path : "";
        }
        String base = baseUrl.trim();
        if (base.endsWith("/")) {
            base = base.substring(0, base.length() - 1);
        }
        String normalizedPath = normalizeEndpointPath(path);
        String resolvedPrefix = resolvePathPrefix(pathPrefix);
        String basePath = extractBasePath(baseUrl);
        String normalizedBasePath = normalizePathPrefix(basePath);
        if (normalizedBasePath != null && !normalizedBasePath.isBlank() && !"/".equals(normalizedBasePath)) {
            if (resolvedPrefix != null && !resolvedPrefix.isBlank()) {
                String normalizedPrefix = normalizePathPrefix(resolvedPrefix);
                if (normalizedPrefix != null && normalizedBasePath.equals(normalizedPrefix)) {
                    resolvedPrefix = "";
                }
            }
            if (weborca && autoApiPrefixEnabled
                    && (normalizedBasePath.equals("/api") || normalizedBasePath.startsWith("/api/"))) {
                autoApiPrefixEnabled = false;
            }
        }
        if (resolvedPrefix != null && !resolvedPrefix.isBlank()) {
            normalizedPath = joinPath(resolvedPrefix, normalizedPath);
        } else if (weborca && autoApiPrefixEnabled && !normalizedPath.startsWith("/api/")) {
            normalizedPath = "/api" + normalizedPath;
        }
        return base + normalizedPath;
    }

    private static String extractBasePath(String baseUrl) {
        if (baseUrl == null || baseUrl.isBlank()) {
            return null;
        }
        String trimmed = baseUrl.trim();
        if (trimmed.contains("://")) {
            try {
                java.net.URI uri = new java.net.URI(trimmed);
                return normalizePathPrefix(uri.getPath());
            } catch (java.net.URISyntaxException ex) {
                LOGGER.log(Level.WARNING, "Invalid ORCA base URL: {0}", trimmed);
            }
        }
        HostSpec spec = parseHostSpec(trimmed, null);
        if (spec != null) {
            return spec.pathPrefixOverride;
        }
        return null;
    }

    private static String safe(String value) {
        return value != null ? value : "";
    }

    static final class HostSpec {
        private final String host;
        private final String schemeOverride;
        private final int portOverride;
        private final String pathPrefixOverride;

        private HostSpec(String host, String schemeOverride, int portOverride, String pathPrefixOverride) {
            this.host = host;
            this.schemeOverride = schemeOverride;
            this.portOverride = portOverride;
            this.pathPrefixOverride = pathPrefixOverride;
        }
    }

    private static final class PrefixSpec {
        private final String pathPrefix;
        private final boolean autoApiPrefixEnabled;

        private PrefixSpec(String pathPrefix, boolean autoApiPrefixEnabled) {
            this.pathPrefix = pathPrefix;
            this.autoApiPrefixEnabled = autoApiPrefixEnabled;
        }
    }

    private static final class HostPortSpec {
        private final String host;
        private final int portOverride;
        private final String pathPrefixOverride;

        private HostPortSpec(String host, int portOverride, String pathPrefixOverride) {
            this.host = host;
            this.portOverride = portOverride;
            this.pathPrefixOverride = pathPrefixOverride;
        }
    }
}
