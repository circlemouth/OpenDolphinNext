package open.dolphin.rest;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.NotFoundException;
import java.lang.reflect.Field;
import java.time.Instant;
import java.util.Map;
import open.dolphin.encounter.ScheduleProjectionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class ScheduleResourceTest {

    private ScheduleResource resource;
    private StubScheduleProjectionRepository projectionRepository;
    private HttpServletRequest request;

    @BeforeEach
    void setUp() throws Exception {
        resource = new ScheduleResource();
        projectionRepository = new StubScheduleProjectionRepository();
        setField(resource, "scheduleProjectionRepository", projectionRepository);
        request = mock(HttpServletRequest.class);
        when(request.getRemoteUser()).thenReturn("F001:doctor01");
    }

    @Test
    void getScheduleReturnsCanonicalScheduleAndEncounterKeys() {
        Map<String, Object> response = resource.getSchedule(request, "F001:S100");

        assertEquals("F001:S100", response.get("scheduleKey"));
        assertEquals("F001:E100", response.get("encounterKey"));
        assertEquals("scheduled", response.get("state"));
        @SuppressWarnings("unchecked")
        Map<String, Object> metadata = (Map<String, Object>) response.get("metadata");
        assertNotNull(metadata);
        assertEquals("01", metadata.get("departmentCode"));
    }

    @Test
    void getScheduleRejectsFacilityMismatch() {
        assertThrows(NotFoundException.class, () -> resource.getSchedule(request, "F999:S100"));
    }

    private static void setField(Object target, String fieldName, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(fieldName);
        field.setAccessible(true);
        field.set(target, value);
    }

    private static final class StubScheduleProjectionRepository extends ScheduleProjectionRepository {
        @Override
        public ScheduleRow findByScheduleKey(String scheduleKey) {
            if (!"F001:S100".equals(scheduleKey)) {
                return new ScheduleRow(
                        scheduleKey,
                        "F999",
                        "P001",
                        10L,
                        "A100",
                        Instant.parse("2026-03-25T09:00:00Z"),
                        "01",
                        "DR01",
                        "scheduled",
                        "F001:E100",
                        Instant.parse("2026-03-25T08:59:00Z"),
                        Instant.parse("2026-03-25T09:01:00Z"));
            }
            return new ScheduleRow(
                    "F001:S100",
                    "F001",
                    "P001",
                    10L,
                    "A100",
                    Instant.parse("2026-03-25T09:00:00Z"),
                    "01",
                    "DR01",
                    "scheduled",
                    "F001:E100",
                    Instant.parse("2026-03-25T08:59:00Z"),
                    Instant.parse("2026-03-25T09:01:00Z"));
        }
    }
}
