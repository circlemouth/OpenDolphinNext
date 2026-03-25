package open.dolphin.rest;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.fail;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.Response;
import java.lang.reflect.Field;
import java.util.LinkedHashMap;
import java.util.Map;
import open.dolphin.rest.masterupdate.MasterUpdateService;
import open.dolphin.security.auth.AdminStepUpGuard;
import open.dolphin.security.audit.SessionAuditDispatcher;
import open.dolphin.session.UserServiceBean;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class AdminMasterUpdateResourceTest {

    private AdminMasterUpdateResource resource;
    private HttpServletRequest request;
    private UserServiceBean userServiceBean;
    private MasterUpdateService masterUpdateService;

    @BeforeEach
    void setUp() throws Exception {
        resource = new AdminMasterUpdateResource();
        request = mock(HttpServletRequest.class);
        userServiceBean = mock(UserServiceBean.class);
        masterUpdateService = mock(MasterUpdateService.class);

        setField(resource, "userServiceBean", userServiceBean);
        setField(resource, "masterUpdateService", masterUpdateService);
        setField(resource, "adminStepUpGuard", mock(AdminStepUpGuard.class));
        setField(resource, "sessionAuditDispatcher", mock(SessionAuditDispatcher.class));
    }

    @Test
    void listDatasetsRejectsWhenUnauthenticated() {
        when(request.getRemoteUser()).thenReturn(null);
        try {
            resource.listDatasets(request);
            fail("Expected WebApplicationException");
        } catch (WebApplicationException ex) {
            assertEquals(401, ex.getResponse().getStatus());
        }
    }

    @Test
    void listDatasetsRejectsWhenNotAdmin() {
        when(request.getRemoteUser()).thenReturn("FACILITY:testuser");
        when(userServiceBean.isAdmin("FACILITY:testuser")).thenReturn(false);
        try {
            resource.listDatasets(request);
            fail("Expected WebApplicationException");
        } catch (WebApplicationException ex) {
            assertEquals(403, ex.getResponse().getStatus());
        }
    }

    @Test
    void listDatasetsReturnsBodyForAdmin() {
        when(request.getHeader("X-Run-Id")).thenReturn("RUN-MASTER");
        when(request.getRemoteUser()).thenReturn("FACILITY:admin");
        when(userServiceBean.isAdmin("FACILITY:admin")).thenReturn(true);

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("runId", "RUN-MASTER");
        body.put("datasets", java.util.List.of());
        when(masterUpdateService.listDatasets("RUN-MASTER")).thenReturn(body);

        Response response = resource.listDatasets(request);
        assertEquals(200, response.getStatus());
        @SuppressWarnings("unchecked")
        Map<String, Object> entity = (Map<String, Object>) response.getEntity();
        assertNotNull(entity);
        assertEquals("RUN-MASTER", entity.get("runId"));
    }

    @Test
    void runDatasetReturnsNotFoundWhenServiceThrows() {
        when(request.getHeader("X-Run-Id")).thenReturn("RUN-MASTER");
        when(request.getRemoteUser()).thenReturn("FACILITY:admin");
        when(userServiceBean.isAdmin("FACILITY:admin")).thenReturn(true);

        when(masterUpdateService.runDataset("unknown", "MANUAL", "FACILITY:admin", "RUN-MASTER", false))
                .thenThrow(new MasterUpdateService.MasterUpdateException(404, "dataset_not_found", "not found"));

        try {
            resource.runDataset(request, "unknown", Map.of());
            fail("Expected WebApplicationException");
        } catch (WebApplicationException ex) {
            assertEquals(404, ex.getResponse().getStatus());
        }
    }

    private static void setField(Object target, String name, Object value) throws Exception {
        Field f = target.getClass().getDeclaredField(name);
        f.setAccessible(true);
        f.set(target, value);
    }
}
