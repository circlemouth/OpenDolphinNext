package open.dolphin.security.auth;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class TrustedProxyPolicyTest {

    @Test
    void supportsIpv4Exact() {
        TrustedProxyPolicy policy = TrustedProxyPolicy.fromRules(java.util.List.of("198.51.100.10"));
        assertTrue(policy.isTrusted("198.51.100.10"));
        assertFalse(policy.isTrusted("198.51.100.11"));
    }

    @Test
    void supportsIpv4Cidr() {
        TrustedProxyPolicy policy = TrustedProxyPolicy.fromRules(java.util.List.of("10.0.0.0/24"));
        assertTrue(policy.isTrusted("10.0.0.9"));
        assertFalse(policy.isTrusted("10.0.1.9"));
    }

    @Test
    void supportsIpv6Exact() {
        TrustedProxyPolicy policy = TrustedProxyPolicy.fromRules(java.util.List.of("2001:db8::1"));
        assertTrue(policy.isTrusted("2001:db8::1"));
        assertFalse(policy.isTrusted("2001:db8::2"));
    }

    @Test
    void supportsIpv6Cidr() {
        TrustedProxyPolicy policy = TrustedProxyPolicy.fromRules(java.util.List.of("2001:db8::/64"));
        assertTrue(policy.isTrusted("2001:db8::12"));
        assertFalse(policy.isTrusted("2001:db9::12"));
    }

    @Test
    void rejectsInvalidToken() {
        assertThrows(IllegalArgumentException.class, () -> TrustedProxyPolicy.validateRule("10.0.0.0/33"));
        assertFalse(TrustedProxyPolicy.loopbackOnly().isTrusted("bad-token"));
    }
}
