package open.dolphin.rest.orca;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.WebApplicationException;
import java.lang.reflect.Proxy;
import java.time.Instant;
import java.util.Map;
import open.dolphin.orca.sync.OrcaPatientImportService;
import open.dolphin.orca.sync.OrcaPatientSyncPlanner;
import open.dolphin.orca.sync.OrcaPatientSyncRunner;
import open.dolphin.orca.sync.OrcaSyncCursorStore;
import open.dolphin.orca.sync.OrcaSyncRunStore;
import open.dolphin.rest.dto.orca.PatientImportRequest;
import open.dolphin.rest.dto.orca.PatientImportResponse;
import open.dolphin.rest.dto.orca.PatientSyncStatusResponse;
import org.junit.jupiter.api.Test;

class OrcaPatientSyncResourceTest {

    @Test
    void importPatientsUsesRemoteUserFacility() {
        OrcaPatientImportService importService = mock(OrcaPatientImportService.class);
        OrcaPatientSyncRunner syncRunner = mock(OrcaPatientSyncRunner.class);
        OrcaPatientSyncResource resource = new OrcaPatientSyncResource(importService, syncRunner);

        PatientImportResponse response = new PatientImportResponse();
        response.setApiResult("00");
        response.setApiResultMessage("OK");
        when(importService.importPatients(eq("F001"), any(PatientImportRequest.class), anyString())).thenReturn(response);

        PatientImportRequest request = new PatientImportRequest();
        request.getPatientIds().add("000001");

        PatientImportResponse actual = resource.importPatients(
                createRequest("F001:doctor01", "/api/orca/official/patients/import", Map.of()), request);

        assertEquals("00", actual.getApiResult());
        verify(importService).importPatients(eq("F001"), any(PatientImportRequest.class), anyString());
    }

    @Test
    void importPatientsRejectsMissingFacility() {
        OrcaPatientSyncResource resource = new OrcaPatientSyncResource(
                mock(OrcaPatientImportService.class),
                mock(OrcaPatientSyncRunner.class));

        PatientImportRequest request = new PatientImportRequest();
        request.getPatientIds().add("000001");

        WebApplicationException ex = assertThrows(WebApplicationException.class,
                () -> resource.importPatients(createRequest(null, "/api/orca/official/patients/import", Map.of()), request));
        assertEquals(401, ex.getResponse().getStatus());
    }

    @Test
    void syncStatusRejectsMissingFacility() {
        OrcaPatientSyncStatusResource resource = new OrcaPatientSyncStatusResource();
        injectField(resource, "cursorStore", mock(OrcaSyncCursorStore.class));
        injectField(resource, "runStore", mock(OrcaSyncRunStore.class));

        WebApplicationException ex = assertThrows(WebApplicationException.class,
                () -> resource.syncStatus(createRequest(null, "/api/admin/internal/orca/patients/sync/status", Map.of())));
        assertEquals(401, ex.getResponse().getStatus());
    }

    @Test
    void syncStatusReturnsStateForExplicitFacility() {
        OrcaSyncCursorStore cursorStore = mock(OrcaSyncCursorStore.class);
        OrcaSyncRunStore runStore = mock(OrcaSyncRunStore.class);
        OrcaPatientSyncStatusResource resource = new OrcaPatientSyncStatusResource();
        injectField(resource, "cursorStore", cursorStore);
        injectField(resource, "runStore", runStore);

        when(cursorStore.load("F001", OrcaPatientSyncPlanner.STREAM_KIND)).thenReturn(
                new OrcaSyncCursorStore.CursorRow("F001", OrcaPatientSyncPlanner.STREAM_KIND, "date", "2026-03-24", "RUN-1",
                        Instant.parse("2026-03-24T00:00:00Z")));
        when(runStore.findLatest("F001", OrcaPatientSyncPlanner.STREAM_KIND)).thenReturn(
                new OrcaSyncRunStore.RunRow("RUN-1", "F001", OrcaPatientSyncPlanner.STREAM_KIND, "api",
                        Instant.parse("2026-03-24T00:00:00Z"),
                        Instant.parse("2026-03-24T00:00:10Z"),
                        Instant.parse("2026-03-24T00:00:20Z"),
                        2, 2, 2, 0, 0, "completed", null, null));

        PatientSyncStatusResponse response = resource.syncStatus(
                createRequest("F001:doctor01", "/api/admin/internal/orca/patients/sync/status", Map.of()));

        assertEquals("F001", response.getFacilityId());
        assertEquals("2026-03-24", response.getLastSyncDate());
        assertEquals("RUN-1", response.getLastRunId());
    }

    private void injectField(Object target, String fieldName, Object value) {
        try {
            java.lang.reflect.Field field = target.getClass().getDeclaredField(fieldName);
            field.setAccessible(true);
            field.set(target, value);
        } catch (ReflectiveOperationException ex) {
            throw new AssertionError(ex);
        }
    }

    private HttpServletRequest createRequest(String remoteUser, String uri, Map<String, String> headers) {
        return (HttpServletRequest) Proxy.newProxyInstance(
                getClass().getClassLoader(),
                new Class[]{HttpServletRequest.class},
                (proxy, method, args) -> {
                    switch (method.getName()) {
                        case "getRemoteUser":
                            return remoteUser;
                        case "getRequestURI":
                            return uri;
                        case "getRemoteAddr":
                            return "127.0.0.1";
                        case "getHeader":
                            if (args != null && args.length == 1) {
                                return headers.get(String.valueOf(args[0]));
                            }
                            return null;
                        default:
                            return null;
                    }
                });
    }
}
