package open.dolphin.rest;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.NotFoundException;
import jakarta.ws.rs.core.Response;
import java.lang.reflect.Field;
import java.time.Instant;
import java.util.Map;
import open.dolphin.encounter.EncounterProjectionRepository;
import open.dolphin.encounter.EncounterTransitionService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class EncounterResourceTest {

    private EncounterResource resource;
    private StubEncounterProjectionRepository projectionRepository;
    private StubEncounterTransitionService transitionService;
    private HttpServletRequest request;

    @BeforeEach
    void setUp() throws Exception {
        resource = new EncounterResource();
        projectionRepository = new StubEncounterProjectionRepository();
        transitionService = new StubEncounterTransitionService();
        setField(resource, "encounterProjectionRepository", projectionRepository);
        setField(resource, "encounterTransitionService", transitionService);
        request = mock(HttpServletRequest.class);
        when(request.getRemoteUser()).thenReturn("F001:doctor01");
        when(request.getHeader("X-Trace-Id")).thenReturn("trace-001");
    }

    @Test
    void getEncounterReturnsProjectionWithSeparatedMetadata() {
        Map<String, Object> response = resource.getEncounter(request, "F001:A100");

        assertEquals("F001:A100", response.get("encounterKey"));
        assertEquals("F001:S100", response.get("scheduleKey"));
        assertEquals("A100", response.get("orcaAcceptanceId"));
        assertEquals("checked_in", response.get("businessState"));
        @SuppressWarnings("unchecked")
        Map<String, Object> metadata = (Map<String, Object>) response.get("metadata");
        assertNotNull(metadata);
        assertEquals("owner01", metadata.get("ownerUserId"));
        assertEquals("{\"waiting\":true}", metadata.get("worklistFlags"));
    }

    @Test
    void getEncounterRejectsFacilityMismatch() {
        assertThrows(NotFoundException.class, () -> resource.getEncounter(request, "F999:A100"));
    }

    @Test
    void transitionEncounterRequiresIdempotencyKey() {
        Response response = resource.transitionEncounter(request, "F001:A100", Map.of(
                "operation", "chart_open",
                "facilityId", "F001",
                "patientId", "00001",
                "karteId", 1001L,
                "requestId", "req-001",
                "traceId", "trace-001",
                "idempotencyKey", "idem-001"));

        assertEquals(200, response.getStatus());
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getEntity();
        assertEquals("F001:A100", body.get("encounterKey"));
        assertEquals("F001:S100", body.get("scheduleKey"));
        assertEquals("chart_opened", body.get("businessState"));
        assertEquals("idem-001", body.get("idempotencyKey"));
    }

    private static void setField(Object target, String fieldName, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(fieldName);
        field.setAccessible(true);
        field.set(target, value);
    }

    private static final class StubEncounterProjectionRepository extends EncounterProjectionRepository {
        @Override
        public EncounterRow findByEncounterKey(String encounterKey) {
            if (!"F001:A100".equals(encounterKey)) {
                return new EncounterRow(
                        encounterKey,
                        "F999",
                        "00001",
                        1001L,
                        "F001:S100",
                        "A100",
                        Instant.parse("2026-03-25T09:00:00Z"),
                        "checked_in",
                        null,
                        null,
                        null,
                        "owner01",
                        "memo",
                        "{\"waiting\":true}",
                        null,
                        1L,
                        Instant.parse("2026-03-25T09:00:00Z"));
            }
            return new EncounterRow(
                    "F001:A100",
                    "F001",
                    "00001",
                    1001L,
                    "F001:S100",
                    "A100",
                    Instant.parse("2026-03-25T09:00:00Z"),
                    "checked_in",
                    null,
                    null,
                    null,
                    "owner01",
                    "memo",
                    "{\"waiting\":true}",
                    null,
                    1L,
                    Instant.parse("2026-03-25T09:00:00Z"));
        }
    }

    private static final class StubEncounterTransitionService extends EncounterTransitionService {
        @Override
        public TransitionResult transition(TransitionCommand command) {
            return new TransitionResult(
                    command.encounterKey(),
                    "F001:S100",
                    "F001",
                    "00001",
                    1001L,
                    "checked_in",
                    "chart_opened",
                    command.requestId(),
                    command.traceId(),
                    command.idempotencyKey(),
                    Instant.parse("2026-03-25T09:05:00Z"));
        }
    }
}
