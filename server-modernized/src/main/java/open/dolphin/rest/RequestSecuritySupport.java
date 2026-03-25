package open.dolphin.rest;

import jakarta.servlet.http.HttpServletRequest;
import java.net.URI;
import java.util.Locale;
import open.dolphin.security.auth.TrustedRequestContextResolver.TrustedRequestContext;

final class RequestSecuritySupport {

    private static final String ORIGIN_HEADER = "Origin";
    private static final String REFERER_HEADER = "Referer";

    private RequestSecuritySupport() {
    }

    static boolean isSecureRequest(HttpServletRequest request) {
        return AbstractResource.resolveTrustedRequestContext(request).secure();
    }

    static String resolveExpectedOrigin(HttpServletRequest request) {
        if (request == null) {
            return null;
        }
        TrustedRequestContext context = AbstractResource.resolveTrustedRequestContext(request);
        return buildOrigin(context.scheme(), context.host(), context.port());
    }

    static SameOriginCheckResult validateSameOrigin(HttpServletRequest request) {
        String expectedOrigin = resolveExpectedOrigin(request);
        String origin = normalizeOrigin(firstHeaderValue(request, ORIGIN_HEADER));
        if (origin != null) {
            if (!origin.equals(expectedOrigin)) {
                return SameOriginCheckResult.rejected("csrf_origin_mismatch", expectedOrigin, origin);
            }
            return SameOriginCheckResult.allowed(expectedOrigin, origin);
        }

        String referer = normalizeToken(firstHeaderValue(request, REFERER_HEADER));
        if (referer != null) {
            String refererOrigin = extractOrigin(referer);
            if (refererOrigin == null || !refererOrigin.equals(expectedOrigin)) {
                return SameOriginCheckResult.rejected("csrf_origin_mismatch", expectedOrigin, refererOrigin);
            }
            return SameOriginCheckResult.allowed(expectedOrigin, refererOrigin);
        }

        return SameOriginCheckResult.rejected("csrf_origin_missing", expectedOrigin, null);
    }

    static String resolvePresentedOrigin(HttpServletRequest request) {
        String origin = normalizeOrigin(firstHeaderValue(request, ORIGIN_HEADER));
        if (origin != null) {
            return origin;
        }
        String referer = normalizeToken(firstHeaderValue(request, REFERER_HEADER));
        if (referer == null) {
            return null;
        }
        return extractOrigin(referer);
    }

    static boolean shouldAttachHsts(HttpServletRequest request) {
        if (!isSecureRequest(request)) {
            return false;
        }
        String host = resolveHostName(request);
        return host != null && !isLocalHost(host);
    }

    static String resolveHostName(HttpServletRequest request) {
        String expectedOrigin = resolveExpectedOrigin(request);
        if (expectedOrigin == null) {
            return null;
        }
        try {
            URI uri = URI.create(expectedOrigin);
            return uri.getHost();
        } catch (RuntimeException ex) {
            return null;
        }
    }

    private static String extractOrigin(String referer) {
        try {
            URI uri = URI.create(referer);
            return buildOrigin(uri.getScheme(), uri.getHost(), uri.getPort());
        } catch (RuntimeException ex) {
            return null;
        }
    }

    private static String normalizeOrigin(String origin) {
        if (origin == null) {
            return null;
        }
        String trimmed = origin.trim();
        if (trimmed.isEmpty() || "null".equalsIgnoreCase(trimmed)) {
            return null;
        }
        try {
            URI uri = URI.create(trimmed);
            return buildOrigin(uri.getScheme(), uri.getHost(), uri.getPort());
        } catch (RuntimeException ex) {
            return null;
        }
    }

    private static String buildOrigin(String scheme, String host, Integer port) {
        String normalizedScheme = normalizeToken(scheme);
        String normalizedHost = normalizeHost(host);
        if (normalizedScheme == null || normalizedHost == null) {
            return null;
        }
        Integer effectivePort = normalizePortForOrigin(normalizedScheme, port);
        StringBuilder builder = new StringBuilder();
        builder.append(normalizedScheme.toLowerCase(Locale.ROOT)).append("://");
        if (normalizedHost.contains(":") && !normalizedHost.startsWith("[")) {
            builder.append('[').append(normalizedHost).append(']');
        } else {
            builder.append(normalizedHost);
        }
        if (effectivePort != null) {
            builder.append(':').append(effectivePort);
        }
        return builder.toString();
    }

    private static Integer normalizePortForOrigin(String scheme, Integer port) {
        if (port == null || port <= 0) {
            return null;
        }
        String normalizedScheme = scheme.toLowerCase(Locale.ROOT);
        if (("http".equals(normalizedScheme) && port == 80)
                || ("https".equals(normalizedScheme) && port == 443)) {
            return null;
        }
        return port;
    }

    private static Integer parsePort(String value) {
        String normalized = normalizeToken(value);
        if (normalized == null) {
            return null;
        }
        try {
            int parsed = Integer.parseInt(normalized);
            return parsed > 0 ? parsed : null;
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private static String firstHeaderValue(HttpServletRequest request, String headerName) {
        if (request == null || headerName == null) {
            return null;
        }
        String header = request.getHeader(headerName);
        if (header == null) {
            return null;
        }
        String[] values = header.split(",", 2);
        return values.length > 0 ? values[0].trim() : header.trim();
    }

    private static String normalizeToken(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static String normalizeHost(String value) {
        String normalized = normalizeToken(value);
        if (normalized == null) {
            return null;
        }
        String withoutBrackets = normalized.startsWith("[") && normalized.endsWith("]")
                ? normalized.substring(1, normalized.length() - 1)
                : normalized;
        return withoutBrackets.trim().isEmpty() ? null : withoutBrackets.trim().toLowerCase(Locale.ROOT);
    }

    private static boolean isLocalHost(String host) {
        String normalized = normalizeHost(host);
        if (normalized == null) {
            return false;
        }
        return "localhost".equals(normalized)
                || "127.0.0.1".equals(normalized)
                || "::1".equals(normalized)
                || "0:0:0:0:0:0:0:1".equals(normalized);
    }

    record SameOriginCheckResult(boolean allowed, String code, String expectedOrigin, String actualOrigin) {
        static SameOriginCheckResult allowed(String expectedOrigin, String actualOrigin) {
            return new SameOriginCheckResult(true, null, expectedOrigin, actualOrigin);
        }

        static SameOriginCheckResult rejected(String code, String expectedOrigin, String actualOrigin) {
            return new SameOriginCheckResult(false, code, expectedOrigin, actualOrigin);
        }
    }
}
