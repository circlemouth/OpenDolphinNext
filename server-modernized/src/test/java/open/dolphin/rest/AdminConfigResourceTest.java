package open.dolphin.rest;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.fail;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.Response;
import java.lang.reflect.Field;
import java.util.Map;
import open.dolphin.rest.admin.AdminConfigSnapshot;
import open.dolphin.rest.admin.AdminConfigStore;
import open.dolphin.security.auth.AdminStepUpGuard;
import open.dolphin.security.audit.SessionAuditDispatcher;
import open.dolphin.session.UserServiceBean;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class AdminConfigResourceTest {

    private AdminConfigResource resource;
    private HttpServletRequest request;
    private UserServiceBean userServiceBean;
    private AdminConfigStore adminConfigStore;

    @BeforeEach
    void setUp() throws Exception {
        resource = new AdminConfigResource();
        request = mock(HttpServletRequest.class);
        userServiceBean = mock(UserServiceBean.class);
        adminConfigStore = mock(AdminConfigStore.class);

        setField(resource, "userServiceBean", userServiceBean);
        setField(resource, "adminConfigStore", adminConfigStore);
        setField(resource, "adminStepUpGuard", mock(AdminStepUpGuard.class));
        setField(resource, "sessionAuditDispatcher", mock(SessionAuditDispatcher.class));
    }

    @Test
    void putConfigRejectsInvalidEndpoint() {
        when(request.getRemoteUser()).thenReturn("FACILITY:admin");
        when(userServiceBean.isAdmin("FACILITY:admin")).thenReturn(true);

        try {
            resource.putConfig(request, Map.of("orcaEndpoint", "notaurl"));
            fail("Expected WebApplicationException");
        } catch (WebApplicationException ex) {
            assertEquals(400, ex.getResponse().getStatus());
        }
    }

    @Test
    void putConfigAppliesValidPayload() {
        when(request.getHeader("X-Run-Id")).thenReturn("RUN-ADMIN-CONFIG");
        when(request.getRemoteUser()).thenReturn("FACILITY:admin");
        when(userServiceBean.isAdmin("FACILITY:admin")).thenReturn(true);

        AdminConfigSnapshot updated = new AdminConfigSnapshot();
        updated.setOrcaEndpoint("https://weborca-trial.orca.med.or.jp");
        updated.setDeliveryMode("manual");
        updated.setChartsMasterSource("auto");
        updated.setVerifyAdminDelivery(Boolean.TRUE);
        when(adminConfigStore.updateFromPayload(any(AdminConfigSnapshot.class), eq("RUN-ADMIN-CONFIG")))
                .thenReturn(updated);

        Response response = resource.putConfig(request, Map.of(
                "orcaEndpoint", "https://weborca-trial.orca.med.or.jp",
                "deliveryMode", "manual",
                "chartsMasterSource", "auto"
        ));

        assertEquals(200, response.getStatus());
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getEntity();
        assertNotNull(body);
        assertEquals("RUN-ADMIN-CONFIG", body.get("runId"));
        assertEquals("https://weborca-trial.orca.med.or.jp", body.get("orcaEndpoint"));
        verify(adminConfigStore).updateFromPayload(any(AdminConfigSnapshot.class), eq("RUN-ADMIN-CONFIG"));
    }

    private static void setField(Object target, String name, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(name);
        field.setAccessible(true);
        field.set(target, value);
    }
}
