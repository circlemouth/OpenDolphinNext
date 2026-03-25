package open.dolphin.security.auth;

import java.net.InetAddress;
import java.net.UnknownHostException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public final class TrustedProxyPolicy {

    private static final TrustedProxyPolicy LOOPBACK_ONLY = new TrustedProxyPolicy(List.of());

    private final List<IpMatcher> matchers;

    private TrustedProxyPolicy(List<IpMatcher> matchers) {
        this.matchers = List.copyOf(matchers);
    }

    public static TrustedProxyPolicy loopbackOnly() {
        return LOOPBACK_ONLY;
    }

    public static TrustedProxyPolicy fromRules(List<String> rules) {
        if (rules == null || rules.isEmpty()) {
            return loopbackOnly();
        }
        List<IpMatcher> matchers = new ArrayList<>();
        for (String rule : rules) {
            String normalized = normalizeRule(rule);
            if (normalized == null) {
                continue;
            }
            matchers.add(parseMatcher(normalized));
        }
        return matchers.isEmpty() ? loopbackOnly() : new TrustedProxyPolicy(matchers);
    }

    public static List<String> parseRules(String rawRules) {
        if (rawRules == null || rawRules.isBlank()) {
            return Collections.emptyList();
        }
        List<String> rules = new ArrayList<>();
        for (String token : rawRules.split(",")) {
            String normalized = normalizeRule(token);
            if (normalized == null) {
                throw new IllegalArgumentException("blank trusted proxy rule");
            }
            validateRule(normalized);
            rules.add(normalized);
        }
        return List.copyOf(rules);
    }

    public static void validateRule(String rule) {
        parseMatcher(rule);
    }

    public boolean isTrusted(String ip) {
        InetAddress address = parseAddress(ip);
        if (address == null) {
            return false;
        }
        if (address.isLoopbackAddress()) {
            return true;
        }
        for (IpMatcher matcher : matchers) {
            if (matcher.matches(address)) {
                return true;
            }
        }
        return false;
    }

    private static IpMatcher parseMatcher(String rule) {
        if (rule.contains("/")) {
            String[] parts = rule.split("/", 2);
            if (parts.length != 2 || parts[0].isBlank() || parts[1].isBlank()) {
                throw new IllegalArgumentException("invalid trusted proxy CIDR: " + rule);
            }
            InetAddress networkAddress = parseAddressStrict(parts[0]);
            int prefix;
            try {
                prefix = Integer.parseInt(parts[1]);
            } catch (NumberFormatException ex) {
                throw new IllegalArgumentException("invalid trusted proxy CIDR: " + rule, ex);
            }
            int maxPrefix = networkAddress.getAddress().length * 8;
            if (prefix < 0 || prefix > maxPrefix) {
                throw new IllegalArgumentException("invalid trusted proxy CIDR: " + rule);
            }
            return new CidrMatcher(networkAddress, prefix);
        }
        return new ExactIpMatcher(parseAddressStrict(rule));
    }

    private static InetAddress parseAddressStrict(String value) {
        InetAddress address = parseAddress(value);
        if (address == null) {
            throw new IllegalArgumentException("invalid trusted proxy IP: " + value);
        }
        return address;
    }

    private static InetAddress parseAddress(String value) {
        String normalized = normalizeRule(value);
        if (normalized == null || normalized.contains("*")) {
            return null;
        }
        try {
            InetAddress address = InetAddress.getByName(normalized);
            String hostAddress = address.getHostAddress();
            return hostAddress == null || hostAddress.isBlank() ? null : address;
        } catch (UnknownHostException ex) {
            return null;
        }
    }

    private static String normalizeRule(String rule) {
        if (rule == null) {
            return null;
        }
        String normalized = rule.trim();
        return normalized.isEmpty() ? null : normalized;
    }

    private interface IpMatcher {
        boolean matches(InetAddress candidate);
    }

    private record ExactIpMatcher(InetAddress expected) implements IpMatcher {
        @Override
        public boolean matches(InetAddress candidate) {
            return expected != null
                    && candidate != null
                    && java.util.Arrays.equals(expected.getAddress(), candidate.getAddress());
        }
    }

    private record CidrMatcher(InetAddress networkAddress, int prefixLength) implements IpMatcher {
        @Override
        public boolean matches(InetAddress candidate) {
            if (candidate == null || networkAddress == null) {
                return false;
            }
            byte[] candidateBytes = candidate.getAddress();
            byte[] networkBytes = networkAddress.getAddress();
            if (candidateBytes.length != networkBytes.length) {
                return false;
            }
            int fullBytes = prefixLength / 8;
            int remainderBits = prefixLength % 8;
            for (int i = 0; i < fullBytes; i++) {
                if (candidateBytes[i] != networkBytes[i]) {
                    return false;
                }
            }
            if (remainderBits == 0) {
                return true;
            }
            int mask = 0xFF << (8 - remainderBits);
            return (candidateBytes[fullBytes] & mask) == (networkBytes[fullBytes] & mask);
        }
    }
}
