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
import java.util.List;
import java.util.Map;
import open.dolphin.session.UserServiceBean;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class AdminOrcaCapabilitiesResourceTest {

    private AdminOrcaCapabilitiesResource resource;
    private HttpServletRequest request;
    private UserServiceBean userServiceBean;

    @BeforeEach
    void setUp() throws Exception {
        resource = new AdminOrcaCapabilitiesResource();
        request = mock(HttpServletRequest.class);
        userServiceBean = mock(UserServiceBean.class);
        setField(resource, "userServiceBean", userServiceBean);
    }

    @Test
    void getCapabilitiesRejectsWhenNotAdmin() {
        when(request.getRemoteUser()).thenReturn("FACILITY:testuser");
        when(userServiceBean.isAdmin("FACILITY:testuser")).thenReturn(false);

        try {
            resource.getCapabilities(request);
            fail("Expected WebApplicationException");
        } catch (WebApplicationException ex) {
            assertEquals(403, ex.getResponse().getStatus());
        }
    }

    @Test
    void getCapabilitiesReturnsInternalWrapperMetadata() {
        when(request.getHeader("X-Run-Id")).thenReturn("RUN-CAP");
        when(request.getRemoteUser()).thenReturn("FACILITY:admin");
        when(userServiceBean.isAdmin("FACILITY:admin")).thenReturn(true);

        Response response = resource.getCapabilities(request);

        assertEquals(200, response.getStatus());
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getEntity();
        assertNotNull(body);
        assertEquals("RUN-CAP", body.get("runId"));
        assertEquals(Boolean.TRUE, body.get("ok"));
        @SuppressWarnings("unchecked")
        Map<String, Object> connection = (Map<String, Object>) body.get("connection");
        assertEquals(Boolean.TRUE, connection.get("available"));
        assertEquals("api_only", connection.get("testedScope"));
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> items = (List<Map<String, Object>>) body.get("internalWrappers");
        assertEquals(5, items.size());
        assertEquals("medical-sets", items.get(0).get("id"));
        assertEquals("stub_fixed", items.get(0).get("behavior"));
    }

    private static void setField(Object target, String name, Object value) throws Exception {
        Field f = target.getClass().getDeclaredField(name);
        f.setAccessible(true);
        f.set(target, value);
    }
}
