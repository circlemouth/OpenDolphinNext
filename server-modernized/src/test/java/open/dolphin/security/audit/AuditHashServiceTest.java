package open.dolphin.security.audit;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.LinkedHashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;

class AuditHashServiceTest {

    @Test
    void canonicalizePayloadIsKeyOrderIndependent() {
        AuditHashService service = new AuditHashService();
        Map<String, Object> left = new LinkedHashMap<>();
        left.put("b", 2);
        left.put("a", 1);
        Map<String, Object> right = new LinkedHashMap<>();
        right.put("a", 1);
        right.put("b", 2);

        assertThat(service.canonicalizePayload(left)).isEqualTo(service.canonicalizePayload(right));
        assertThat(service.hashPayload(left)).isEqualTo(service.hashPayload(right));
    }

    @Test
    void eventHashUsesFixedFieldOrder() {
        AuditHashService service = new AuditHashService();
        String first = service.computeEventHash(new AuditHashService.EventHashInput(
                "2026-03-25T12:00:00Z", "ACTION", "/api", "actor", "F001", "patient", "P1",
                "SUCCESS", "200", "trace", "req", "payload", "1", "prev"));
        String second = service.computeEventHash(new AuditHashService.EventHashInput(
                "2026-03-25T12:00:00Z", "ACTION", "/api", "actor", "F001", "patient", "P1",
                "SUCCESS", "200", "trace", "req", "payload", "2", "prev"));
        assertThat(first).isNotEqualTo(second);
    }
}
