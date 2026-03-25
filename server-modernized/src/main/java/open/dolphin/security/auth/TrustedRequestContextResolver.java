package open.dolphin.security.auth;

import jakarta.servlet.http.HttpServletRequest;
import java.net.InetAddress;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

public final class TrustedRequestContextResolver {

    private static final String FORWARDED_HEADER = "Forwarded";
    private static final String X_FORWARDED_FOR_HEADER = "X-Forwarded-For";
    private static final String X_FORWARDED_PROTO_HEADER = "X-Forwarded-Proto";
    private static final String X_FORWARDED_HOST_HEADER = "X-Forwarded-Host";
    private static final String X_FORWARDED_PORT_HEADER = "X-Forwarded-Port";
    private static final String X_REAL_IP_HEADER = "X-Real-Ip";

    private final TrustedProxyPolicy trustedProxyPolicy;

    public TrustedRequestContextResolver(TrustedProxyPolicy trustedProxyPolicy) {
        this.trustedProxyPolicy = trustedProxyPolicy == null ? TrustedProxyPolicy.loopbackOnly() : trustedProxyPolicy;
    }

    public TrustedRequestContext resolve(HttpServletRequest request) {
        String remoteAddr = normalizeIpCandidate(request != null ? request.getRemoteAddr() : null);
        String fallbackScheme = resolveFallbackScheme(request);
        String fallbackHost = normalizeHost(request != null ? request.getServerName() : null);
        int fallbackPort = request != null ? normalizePort(request.getServerPort()) : -1;
        boolean fallbackSecure = "https".equalsIgnoreCase(fallbackScheme);
        if (request == null) {
            return new TrustedRequestContext(null, null, fallbackScheme, fallbackHost, fallbackPort, fallbackSecure, false, false);
        }

        boolean trustedProxy = trustedProxyPolicy.isTrusted(remoteAddr);
        if (!trustedProxy) {
            return new TrustedRequestContext(
                    remoteAddr,
                    remoteAddr,
                    fallbackScheme,
                    fallbackHost,
                    fallbackPort,
                    fallbackSecure,
                    false,
                    false);
        }

        ForwardedResolution forwarded = resolveForwarded(request, remoteAddr);
        if (forwarded != null) {
            return new TrustedRequestContext(
                    remoteAddr,
                    forwarded.clientIp(),
                    forwarded.scheme(),
                    forwarded.host(),
                    forwarded.port(),
                    "https".equalsIgnoreCase(forwarded.scheme()),
                    true,
                    true);
        }

        String xForwardedFor = request.getHeader(X_FORWARDED_FOR_HEADER);
        String clientIp = remoteAddr;
        if (xForwardedFor != null && !xForwardedFor.isBlank()) {
            try {
                clientIp = resolveClientIp(parseForwardedFor(xForwardedFor), remoteAddr);
            } catch (IllegalArgumentException ex) {
                clientIp = remoteAddr;
            }
        } else {
            String realIp = normalizeIpCandidate(request.getHeader(X_REAL_IP_HEADER));
            if (realIp != null) {
                clientIp = realIp;
            }
        }

        LegacyForwardedValues legacy = resolveLegacyForwarded(request, fallbackScheme, fallbackHost, fallbackPort);
        return new TrustedRequestContext(
                remoteAddr,
                clientIp,
                legacy.scheme(),
                legacy.host(),
                legacy.port(),
                "https".equalsIgnoreCase(legacy.scheme()),
                true,
                legacy.forwardedUsed());
    }

    private ForwardedResolution resolveForwarded(HttpServletRequest request, String remoteAddr) {
        String rawForwarded = request.getHeader(FORWARDED_HEADER);
        if (rawForwarded == null || rawForwarded.isBlank()) {
            return null;
        }
        try {
            List<ForwardedElement> elements = parseForwardedHeader(rawForwarded);
            if (elements.isEmpty()) {
                return null;
            }
            List<String> chain = new ArrayList<>();
            for (ForwardedElement element : elements) {
                if (element.forValue() != null) {
                    chain.add(normalizeForwardedFor(element.forValue()));
                }
            }
            String clientIp = chain.isEmpty() ? remoteAddr : resolveClientIp(chain, remoteAddr);
            ForwardedElement first = elements.get(0);
            HostPort hostPort = parseHostPort(first.host());
            String scheme = normalizeToken(first.proto());
            String host = hostPort.host() != null ? hostPort.host() : normalizeHost(request.getServerName());
            int port = hostPort.port() != null ? hostPort.port() : defaultPort(scheme, normalizePort(request.getServerPort()));
            return new ForwardedResolution(clientIp, scheme != null ? scheme : normalizeToken(request.getScheme()), host, port);
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    private LegacyForwardedValues resolveLegacyForwarded(HttpServletRequest request, String fallbackScheme, String fallbackHost, int fallbackPort) {
        String scheme = normalizeToken(request.getHeader(X_FORWARDED_PROTO_HEADER));
        HostPort hostPort = parseHostPort(request.getHeader(X_FORWARDED_HOST_HEADER));
        Integer explicitPort = parsePort(request.getHeader(X_FORWARDED_PORT_HEADER));
        String resolvedScheme = scheme != null ? scheme : fallbackScheme;
        String resolvedHost = hostPort.host() != null ? hostPort.host() : fallbackHost;
        int resolvedPort = explicitPort != null
                ? explicitPort
                : hostPort.port() != null ? hostPort.port() : defaultPort(resolvedScheme, fallbackPort);
        return new LegacyForwardedValues(resolvedScheme, resolvedHost, resolvedPort,
                scheme != null || hostPort.host() != null || explicitPort != null);
    }

    private List<ForwardedElement> parseForwardedHeader(String headerValue) {
        List<ForwardedElement> result = new ArrayList<>();
        for (String elementValue : splitRespectingQuotes(headerValue, ',')) {
            Map<String, String> params = new LinkedHashMap<>();
            for (String part : splitRespectingQuotes(elementValue, ';')) {
                String token = normalizeToken(part);
                if (token == null) {
                    continue;
                }
                int separator = token.indexOf('=');
                if (separator <= 0 || separator == token.length() - 1) {
                    throw new IllegalArgumentException("invalid forwarded token");
                }
                String key = token.substring(0, separator).trim().toLowerCase(Locale.ROOT);
                String value = stripQuotes(token.substring(separator + 1).trim());
                params.put(key, value);
            }
            result.add(new ForwardedElement(params.get("for"), params.get("proto"), params.get("host")));
        }
        return result;
    }

    private List<String> parseForwardedFor(String headerValue) {
        List<String> chain = new ArrayList<>();
        for (String token : headerValue.split(",")) {
            chain.add(normalizeForwardedFor(token));
        }
        return chain;
    }

    private String resolveClientIp(List<String> chain, String remoteAddr) {
        List<String> fullChain = new ArrayList<>(chain);
        if (remoteAddr != null) {
            fullChain.add(remoteAddr);
        }
        for (int i = fullChain.size() - 1; i >= 0; i--) {
            String candidate = fullChain.get(i);
            if (!trustedProxyPolicy.isTrusted(candidate)) {
                return candidate;
            }
        }
        return fullChain.isEmpty() ? remoteAddr : fullChain.get(0);
    }

    private static String normalizeForwardedFor(String value) {
        String normalized = normalizeToken(value);
        if (normalized == null || "unknown".equalsIgnoreCase(normalized)) {
            throw new IllegalArgumentException("invalid forwarded for");
        }
        if (normalized.startsWith("_")) {
            throw new IllegalArgumentException("obfuscated forwarded for");
        }
        if (normalized.startsWith("[") && normalized.endsWith("]")) {
            normalized = normalized.substring(1, normalized.length() - 1);
        }
        int lastColon = normalized.lastIndexOf(':');
        if (lastColon > 0 && normalized.indexOf(':') == lastColon) {
            String hostCandidate = normalized.substring(0, lastColon);
            Integer port = parsePort(normalized.substring(lastColon + 1));
            if (port != null) {
                normalized = hostCandidate;
            }
        }
        String ip = normalizeIpCandidate(normalized);
        if (ip == null) {
            throw new IllegalArgumentException("invalid forwarded for");
        }
        return ip;
    }

    private static String normalizeIpCandidate(String value) {
        String normalized = normalizeToken(value);
        if (normalized == null) {
            return null;
        }
        if (normalized.startsWith("[") && normalized.endsWith("]")) {
            normalized = normalized.substring(1, normalized.length() - 1);
        }
        try {
            InetAddress address = InetAddress.getByName(normalized);
            String hostAddress = address.getHostAddress();
            return hostAddress == null || hostAddress.isBlank() ? null : hostAddress;
        } catch (Exception ex) {
            return null;
        }
    }

    private static HostPort parseHostPort(String rawHost) {
        String normalized = normalizeToken(rawHost);
        if (normalized == null) {
            return new HostPort(null, null);
        }
        try {
            URI uri = new URI("http://" + normalized);
            return new HostPort(normalizeHost(uri.getHost()), parsePort(uri.getPort()));
        } catch (URISyntaxException ex) {
            if (normalized.startsWith("[") && normalized.contains("]")) {
                int close = normalized.indexOf(']');
                String host = normalizeHost(normalized.substring(0, close + 1));
                Integer port = close + 1 < normalized.length() && normalized.charAt(close + 1) == ':'
                        ? parsePort(normalized.substring(close + 2))
                        : null;
                return new HostPort(host, port);
            }
            int lastColon = normalized.lastIndexOf(':');
            if (lastColon > 0 && normalized.indexOf(':') == lastColon) {
                Integer port = parsePort(normalized.substring(lastColon + 1));
                if (port != null) {
                    return new HostPort(normalizeHost(normalized.substring(0, lastColon)), port);
                }
            }
            return new HostPort(normalizeHost(normalized), null);
        }
    }

    private static List<String> splitRespectingQuotes(String value, char separator) {
        List<String> tokens = new ArrayList<>();
        StringBuilder current = new StringBuilder();
        boolean quoted = false;
        for (int i = 0; i < value.length(); i++) {
            char ch = value.charAt(i);
            if (ch == '"') {
                quoted = !quoted;
                current.append(ch);
                continue;
            }
            if (ch == separator && !quoted) {
                tokens.add(current.toString());
                current.setLength(0);
                continue;
            }
            current.append(ch);
        }
        if (quoted) {
            throw new IllegalArgumentException("unterminated quote");
        }
        tokens.add(current.toString());
        return tokens;
    }

    private static String stripQuotes(String value) {
        if (value == null) {
            return null;
        }
        if (value.startsWith("\"") && value.endsWith("\"") && value.length() >= 2) {
            return value.substring(1, value.length() - 1);
        }
        return value;
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

    private static Integer parsePort(String value) {
        String normalized = normalizeToken(value);
        if (normalized == null) {
            return null;
        }
        try {
            return parsePort(Integer.parseInt(normalized));
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private static Integer parsePort(int value) {
        return value > 0 && value <= 65535 ? value : null;
    }

    private static int normalizePort(int value) {
        return value > 0 && value <= 65535 ? value : -1;
    }

    private static int defaultPort(String scheme, int fallbackPort) {
        if ("https".equalsIgnoreCase(scheme)) {
            return 443;
        }
        if ("http".equalsIgnoreCase(scheme)) {
            return 80;
        }
        return fallbackPort;
    }

    private static String resolveFallbackScheme(HttpServletRequest request) {
        if (request == null) {
            return null;
        }
        String scheme = normalizeToken(request.getScheme());
        if (scheme != null) {
            return scheme;
        }
        return request.isSecure() ? "https" : "http";
    }

    public record TrustedRequestContext(
            String remoteAddr,
            String clientIp,
            String scheme,
            String host,
            int port,
            boolean secure,
            boolean trustedProxy,
            boolean forwardedUsed) {
    }

    private record ForwardedElement(String forValue, String proto, String host) {
    }

    private record ForwardedResolution(String clientIp, String scheme, String host, int port) {
    }

    private record HostPort(String host, Integer port) {
    }

    private record LegacyForwardedValues(String scheme, String host, int port, boolean forwardedUsed) {
    }
}
