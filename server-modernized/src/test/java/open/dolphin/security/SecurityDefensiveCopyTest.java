package open.dolphin.security;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotSame;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import open.dolphin.reporting.SigningConfig;
import open.dolphin.security.audit.AuditEventPayload;
import open.dolphin.session.framework.SessionTraceContext;
import org.junit.jupiter.api.Test;

class SecurityDefensiveCopyTest {

    @Test
    void auditPayloadProtectsDetails() {
        Map<String, Object> details = new HashMap<>();
        details.put("action", "login");

        AuditEventPayload payload = new AuditEventPayload();
        payload.setDetails(details);

        details.put("extra", "mutation");

        assertEquals(Map.of("action", "login"), payload.getDetails());
        assertThrows(UnsupportedOperationException.class, () -> payload.getDetails().put("another", "value"));
    }

    @Test
    void signingConfigClonesPasswords() throws Exception {
        char[] keystorePassword = "secret".toCharArray();
        char[] tsaPassword = "tsa".toCharArray();
        Path keystorePath = Files.createTempFile("keystore", ".p12");

        SigningConfig config = new SigningConfig.Builder()
                .keystorePath(keystorePath)
                .keystorePassword(keystorePassword)
                .keyAlias("alias")
                .reason("reason")
                .location("location")
                .tsaUrl("https://tsa")
                .tsaUsername("user")
                .tsaPassword(tsaPassword)
                .build();

        keystorePassword[0] = 'X';
        tsaPassword[0] = 'Y';

        char[] first = config.getKeystorePassword();
        char[] second = config.getKeystorePassword();
        assertEquals('s', first[0]);
        assertEquals('s', second[0]);
        assertNotSame(first, second);

        first[0] = 'Z';
        assertEquals('s', config.getKeystorePassword()[0]);

        char[] tsaCopy = config.getTsaPassword();
        assertNotSame(tsaCopy, config.getTsaPassword());
        tsaCopy[0] = 'Z';
        assertEquals('t', config.getTsaPassword()[0]);
    }

    @Test
    void sessionTraceContextProtectsAttributes() {
        Map<String, String> attributes = new HashMap<>();
        attributes.put(SessionTraceContext.ATTRIBUTE_ACTOR_ROLE, "doctor");

        SessionTraceContext context = new SessionTraceContext("trace", Instant.EPOCH, "operation", attributes);

        attributes.put("new", "value");

        assertEquals("doctor", context.getActorRole());
        assertThrows(UnsupportedOperationException.class, () -> context.getAttributes().put("role", "mutated"));
        assertEquals(Map.of(SessionTraceContext.ATTRIBUTE_ACTOR_ROLE, "doctor"), context.getAttributes());
    }
}
