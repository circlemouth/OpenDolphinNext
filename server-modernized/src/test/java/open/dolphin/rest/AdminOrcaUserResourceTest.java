package open.dolphin.rest;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.fail;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.Response;
import java.lang.reflect.Field;
import java.util.List;
import java.util.Map;
import open.dolphin.orca.transport.OrcaEndpoint;
import open.dolphin.orca.transport.OrcaTransport;
import open.dolphin.orca.transport.OrcaTransportRequest;
import open.dolphin.orca.transport.OrcaTransportResult;
import open.dolphin.security.auth.AdminStepUpGuard;
import open.dolphin.security.audit.SessionAuditDispatcher;
import open.dolphin.session.UserServiceBean;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class AdminOrcaUserResourceTest {

    private AdminOrcaUserResource resource;
    private HttpServletRequest request;
    private UserServiceBean userServiceBean;
    private OrcaTransport orcaTransport;

    @BeforeEach
    void setUp() throws Exception {
        resource = new AdminOrcaUserResource();
        request = mock(HttpServletRequest.class);
        userServiceBean = mock(UserServiceBean.class);
        orcaTransport = mock(OrcaTransport.class);

        setField(resource, "userServiceBean", userServiceBean);
        setField(resource, "orcaTransport", orcaTransport);
        setField(resource, "adminStepUpGuard", mock(AdminStepUpGuard.class));
        setField(resource, "sessionAuditDispatcher", mock(SessionAuditDispatcher.class));
    }

    @Test
    void listOrcaUsersRejectsWhenUnauthenticated() {
        when(request.getRemoteUser()).thenReturn(null);

        try {
            resource.listOrcaUsers(request);
            fail("Expected WebApplicationException");
        } catch (WebApplicationException ex) {
            assertEquals(401, ex.getResponse().getStatus());
        }
    }

    @Test
    void listOrcaUsersRejectsWhenNotAdmin() {
        when(request.getRemoteUser()).thenReturn("FACILITY:testuser");
        when(userServiceBean.isAdmin("FACILITY:testuser")).thenReturn(false);

        try {
            resource.listOrcaUsers(request);
            fail("Expected WebApplicationException");
        } catch (WebApplicationException ex) {
            assertEquals(403, ex.getResponse().getStatus());
        }
    }

    @Test
    void listOrcaUsersReturnsUsersForAdmin() {
        when(request.getHeader("X-Run-Id")).thenReturn("RUN-ORCA-USERS");
        when(request.getRemoteUser()).thenReturn("FACILITY:admin");
        when(userServiceBean.isAdmin("FACILITY:admin")).thenReturn(true);
        when(orcaTransport.invoke(anyString(), eq(OrcaEndpoint.MANAGE_USERS), any(OrcaTransportRequest.class)))
                .thenReturn(okManageUsersResponse());

        Response response = resource.listOrcaUsers(request);
        assertEquals(200, response.getStatus());

        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getEntity();
        assertNotNull(body);
        assertEquals("RUN-ORCA-USERS", body.get("runId"));
        assertEquals("0000", body.get("apiResult"));
        assertEquals("OK", body.get("apiResultMessage"));

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> users = (List<Map<String, Object>>) body.get("users");
        assertNotNull(users);
        assertEquals(1, users.size());
        assertEquals("orca_01", users.get(0).get("userId"));
        assertEquals("ORCA Taro", users.get(0).get("fullName"));
        assertEquals(Boolean.TRUE, users.get(0).get("isAdmin"));

        @SuppressWarnings("unchecked")
        Map<String, Object> syncStatus = (Map<String, Object>) body.get("syncStatus");
        assertNotNull(syncStatus);
        assertEquals(Boolean.FALSE, syncStatus.get("running"));
    }

    @Test
    void syncOrcaUsersReturnsSyncedCountForAdmin() {
        when(request.getHeader("X-Run-Id")).thenReturn("RUN-ORCA-SYNC");
        when(request.getRemoteUser()).thenReturn("FACILITY:admin");
        when(userServiceBean.isAdmin("FACILITY:admin")).thenReturn(true);
        when(orcaTransport.invoke(anyString(), eq(OrcaEndpoint.MANAGE_USERS), any(OrcaTransportRequest.class)))
                .thenReturn(okManageUsersResponse());

        Response response = resource.syncOrcaUsers(request, Map.of());
        assertEquals(200, response.getStatus());

        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getEntity();
        assertNotNull(body);
        @SuppressWarnings("unchecked")
        Map<String, Object> syncStatus = (Map<String, Object>) body.get("syncStatus");
        assertNotNull(syncStatus);
        assertEquals(Boolean.FALSE, syncStatus.get("running"));
        assertEquals(1, syncStatus.get("syncedCount"));
        assertTrue(syncStatus.containsKey("lastSyncedAt"));
    }

    @Test
    void createOrcaUserRejectsInvalidUserId() {
        when(request.getRemoteUser()).thenReturn("FACILITY:admin");
        when(userServiceBean.isAdmin("FACILITY:admin")).thenReturn(true);

        try {
            resource.createOrcaUser(
                    request,
                    Map.of(
                            "userId", "bad-id!",
                            "password", "pass",
                            "staffClass", "1",
                            "fullName", "ORCA Taro"));
            fail("Expected WebApplicationException");
        } catch (WebApplicationException ex) {
            assertEquals(400, ex.getResponse().getStatus());
        }
    }

    private OrcaTransportResult okManageUsersResponse() {
        String xml = """
                <data>
                  <manageusersres type=\"record\">
                    <Api_Result type=\"string\">0000</Api_Result>
                    <Api_Result_Message type=\"string\">OK</Api_Result_Message>
                    <User_Information type=\"array\">
                      <User_Information_child type=\"record\">
                        <User_Id type=\"string\">orca_01</User_Id>
                        <Full_Name type=\"string\">ORCA Taro</Full_Name>
                        <Kana_Name type=\"string\">ORCAタロウ</Kana_Name>
                        <Group_Number type=\"string\">01</Group_Number>
                        <User_Number type=\"string\">100</User_Number>
                        <Administrator_Privilege type=\"string\">1</Administrator_Privilege>
                      </User_Information_child>
                    </User_Information>
                  </manageusersres>
                </data>
                """;
        return new OrcaTransportResult(
                "https://weborca-trial.orca.med.or.jp/api01rv2/manageusersv2",
                "POST",
                200,
                xml,
                "application/xml",
                Map.of());
    }

    private static void setField(Object target, String name, Object value) throws Exception {
        Field f = target.getClass().getDeclaredField(name);
        f.setAccessible(true);
        f.set(target, value);
    }
}
