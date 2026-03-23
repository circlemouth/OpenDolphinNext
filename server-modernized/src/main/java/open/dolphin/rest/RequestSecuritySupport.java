package open.dolphin.rest;

import jakarta.servlet.http.HttpServletRequest;
import java.net.URI;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

final class RequestSecuritySupport {

    private static final String FORWARDED_HEADER = "Forwarded";
    private static final String X_FORWARDED_PROTO_HEADER = "X-Forwarded-Proto";
    private static final String X_FORWARDED_HOST_HEADER = "X-Forwarded-Host";
    private static final String X_FORWARDED_PORT_HEADER = "X-Forwarded-Port";
    private static final String ORIGIN_HEADER = "Origin";
    private static final String REFERER_HEADER = "Referer";

    private RequestSecuritySupport() {
    }

    static boolean isSecureRequest(HttpServletRequest request) {
        if (AbstractResource.shouldTrustForwardedHeaders(request)) {
            ForwardedValues forwarded = parseForwarded(firstHeaderValue(request, FORWARDED_HEADER));
            if (forwarded.proto() != null) {
                return "https".equalsIgnoreCase(forwarded.proto());
            }
            String forwardedProto = normalizeToken(firstHeaderValue(request, X_FORWARDED_PROTO_HEADER));
            if (forwardedProto != null) {
                return "https".equalsIgnoreCase(forwardedProto);
            }
        }
        return request != null && request.isSecure();
    }

    static String resolveExpectedOrigin(HttpServletRequest request) {
        if (request == null) {
            return null;
        }

        if (AbstractResource.shouldTrustForwardedHeaders(request)) {
            ForwardedValues forwarded = parseForwarded(firstHeaderValue(request, FORWARDED_HEADER));
            if (forwarded.host() != null) {
                HostPort hostPort = parseHostPort(forwarded.host(), forwarded.proto());
                String scheme = forwarded.proto() != null ? forwarded.proto() : "http";
                return buildOrigin(scheme, hostPort.host(), hostPort.port());
            }

            String xfHost = normalizeToken(firstHeaderValue(request, X_FORWARDED_HOST_HEADER));
            if (xfHost != null) {
                String scheme = normalizeToken(firstHeaderValue(request, X_FORWARDED_PROTO_HEADER));
                HostPort hostPort = parseHostPort(xfHost, scheme);
                Integer forwardedPort = parsePort(firstHeaderValue(request, X_FORWARDED_PORT_HEADER));
                Integer port = forwardedPort != null ? forwardedPort : hostPort.port();
                return buildOrigin(scheme != null ? scheme : "http", hostPort.host(), port);
            }
        }

        return buildOrigin(request.getScheme(), request.getServerName(), request.getServerPort());
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

    private static HostPort parseHostPort(String rawHost, String schemeHint) {
        String normalized = normalizeHost(rawHost);
        if (normalized == null) {
            return new HostPort(null, null);
        }
        try {
            URI uri = URI.create((schemeHint != null ? schemeHint : "http") + "://" + normalized);
            return new HostPort(normalizeHost(uri.getHost()), uri.getPort() > 0 ? uri.getPort() : null);
        } catch (RuntimeException ex) {
            if (normalized.startsWith("[") && normalized.contains("]")) {
                int close = normalized.indexOf(']');
                String host = normalizeHost(normalized.substring(0, close + 1));
                Integer port = null;
                if (close + 1 < normalized.length() && normalized.charAt(close + 1) == ':') {
                    port = parsePort(normalized.substring(close + 2));
                }
                return new HostPort(host, port);
            }
            int lastColon = normalized.lastIndexOf(':');
            if (lastColon > 0 && normalized.indexOf(':') == lastColon) {
                Integer port = parsePort(normalized.substring(lastColon + 1));
                if (port != null) {
                    return new HostPort(normalizeHost(normalized.substring(0, lastColon)), port);
                }
            }
            return new HostPort(normalized, null);
        }
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

    private static ForwardedValues parseForwarded(String headerValue) {
        String normalized = normalizeToken(headerValue);
        if (normalized == null) {
            return ForwardedValues.EMPTY;
        }
        String firstElement = normalized.split(",", 2)[0].trim();
        Map<String, String> params = new LinkedHashMap<>();
        for (String part : firstElement.split(";")) {
            String token = part.trim();
            if (token.isEmpty()) {
                continue;
            }
            int separator = token.indexOf('=');
            if (separator <= 0 || separator >= token.length() - 1) {
                continue;
            }
            String key = token.substring(0, separator).trim().toLowerCase(Locale.ROOT);
            String value = token.substring(separator + 1).trim();
            if (value.startsWith("\"") && value.endsWith("\"") && value.length() >= 2) {
                value = value.substring(1, value.length() - 1);
            }
            params.put(key, value);
        }
        return new ForwardedValues(normalizeToken(params.get("proto")), normalizeToken(params.get("host")));
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

    private record HostPort(String host, Integer port) {
    }

    private record ForwardedValues(String proto, String host) {
        private static final ForwardedValues EMPTY = new ForwardedValues(null, null);
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
