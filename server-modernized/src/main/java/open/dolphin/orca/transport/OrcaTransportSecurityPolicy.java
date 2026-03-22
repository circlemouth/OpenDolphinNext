package open.dolphin.orca.transport;

import java.net.URI;
import java.util.Locale;
import open.dolphin.runtime.RuntimeConfigurationSupport;
import open.dolphin.runtime.config.ServerRuntimeConfiguration;
import open.dolphin.runtime.config.ServerConfigurationResolver;

public final class OrcaTransportSecurityPolicy {

    private OrcaTransportSecurityPolicy() {
    }

    public static void validateBaseUrl(String baseUrl, boolean useWeborca) {
        ServerConfigurationResolver resolver = new ServerConfigurationResolver();
        validateBaseUrl(baseUrl, useWeborca, resolver.runtime(), resolver.orcaTransportHttp());
    }

    public static void validateBaseUrl(String baseUrl, boolean useWeborca,
            ServerRuntimeConfiguration.RuntimeSettings runtime,
            ServerRuntimeConfiguration.OrcaTransportHttpSettings transportHttp) {
        if (baseUrl == null || baseUrl.isBlank()) {
            throw new IllegalArgumentException("サーバURLは必須です。");
        }
        URI uri;
        try {
            uri = URI.create(baseUrl);
        } catch (RuntimeException ex) {
            throw new IllegalArgumentException("サーバURLが不正です。", ex);
        }
        String environment = runtime != null ? runtime.environment() : null;
        boolean allowInsecureHttp = transportHttp != null && Boolean.TRUE.equals(transportHttp.allowInsecureHttp());
        validateUri(uri, useWeborca, environment, allowInsecureHttp);
    }

    static void validateUri(URI uri, boolean useWeborca, String environment) {
        validateUri(uri, useWeborca, environment, false);
    }

    static void validateUri(URI uri, boolean useWeborca, String environment, boolean allowInsecureHttp) {
        if (uri == null) {
            throw new IllegalArgumentException("サーバURLが不正です。");
        }
        String scheme = normalize(uri.getScheme());
        String host = normalizeHost(uri);
        if (scheme == null || host == null) {
            throw new IllegalArgumentException("サーバURLが不正です。");
        }
        if (useWeborca && !"https".equals(scheme)) {
            throw new OrcaConnectionPolicyException("weborca_requires_https", "useWeborca=true の接続先は HTTPS が必須です。");
        }
        if (!"http".equals(scheme)) {
            return;
        }
        if (!RuntimeConfigurationSupport.isProductionLikeEnvironment(environment)) {
            return;
        }
        if (!allowInsecureHttp) {
            throw new OrcaConnectionPolicyException(
                    "insecure_http_disallowed",
                    "production-like 環境では HTTP 接続は既定で拒否されます。"
                            + " OPENDOLPHIN_ORCA_ALLOW_INSECURE_HTTP"
                            + "=1 を設定したうえで localhost/127.0.0.1/::1/RFC1918 private range に限定してください。");
        }
        if (!isLoopbackOrPrivateIpv4(host)) {
            throw new OrcaConnectionPolicyException(
                    "insecure_http_target_not_allowed",
                    "HTTP 接続は localhost/127.0.0.1/::1/RFC1918 private range のみ許可されています。");
        }
    }

    static boolean isLoopbackOrPrivateIpv4(String host) {
        String normalized = normalize(host);
        if (normalized == null) {
            return false;
        }
        if ("localhost".equals(normalized) || "127.0.0.1".equals(normalized) || "::1".equals(normalized) || "[::1]".equals(normalized)) {
            return true;
        }
        String candidate = normalized;
        if (candidate.startsWith("[") && candidate.endsWith("]")) {
            candidate = candidate.substring(1, candidate.length() - 1);
        }
        String[] octets = candidate.split("\\.");
        if (octets.length != 4) {
            return false;
        }
        int[] values = new int[4];
        for (int i = 0; i < octets.length; i++) {
            try {
                values[i] = Integer.parseInt(octets[i]);
            } catch (NumberFormatException ex) {
                return false;
            }
            if (values[i] < 0 || values[i] > 255) {
                return false;
            }
        }
        return values[0] == 10
                || (values[0] == 172 && values[1] >= 16 && values[1] <= 31)
                || (values[0] == 192 && values[1] == 168);
    }

    private static String normalizeHost(URI uri) {
        String host = uri.getHost();
        if (host != null && !host.isBlank()) {
            return host.trim();
        }
        String authority = uri.getAuthority();
        if (authority == null || authority.isBlank()) {
            return null;
        }
        int atIndex = authority.lastIndexOf('@');
        String withoutUserInfo = atIndex >= 0 ? authority.substring(atIndex + 1) : authority;
        if (withoutUserInfo.startsWith("[") && withoutUserInfo.contains("]")) {
            return withoutUserInfo.substring(0, withoutUserInfo.indexOf(']') + 1);
        }
        int colonIndex = withoutUserInfo.indexOf(':');
        return colonIndex >= 0 ? withoutUserInfo.substring(0, colonIndex) : withoutUserInfo;
    }

    private static String normalize(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed.toLowerCase(Locale.ROOT);
    }
}
