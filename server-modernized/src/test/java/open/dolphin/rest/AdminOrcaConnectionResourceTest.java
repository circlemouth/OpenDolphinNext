package open.dolphin.rest;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.fail;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.HttpHeaders;
import jakarta.ws.rs.core.MultivaluedHashMap;
import jakarta.ws.rs.core.Response;
import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.lang.reflect.Field;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import open.dolphin.orca.config.OrcaConnectionConfigRecord;
import open.dolphin.orca.config.OrcaConnectionConfigStore;
import open.dolphin.orca.transport.OrcaConnectionPolicyException;
import open.dolphin.orca.transport.RestOrcaTransport;
import open.dolphin.security.audit.SessionAuditDispatcher;
import open.dolphin.session.UserServiceBean;
import org.jboss.resteasy.plugins.providers.multipart.InputPart;
import org.jboss.resteasy.plugins.providers.multipart.MultipartFormDataInput;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class AdminOrcaConnectionResourceTest {

    private AdminOrcaConnectionResource resource;
    private HttpServletRequest request;
    private UserServiceBean userServiceBean;
    private OrcaConnectionConfigStore configStore;
    private RestOrcaTransport restOrcaTransport;

    @BeforeEach
    void setUp() throws Exception {
        resource = new AdminOrcaConnectionResource();
        request = mock(HttpServletRequest.class);
        userServiceBean = mock(UserServiceBean.class);
        configStore = mock(OrcaConnectionConfigStore.class);
        restOrcaTransport = mock(RestOrcaTransport.class);

        setField(resource, "orcaConnectionConfigStore", configStore);
        setField(resource, "restOrcaTransport", restOrcaTransport);
        setField(resource, "userServiceBean", userServiceBean);
        setField(resource, "sessionAuditDispatcher", mock(SessionAuditDispatcher.class));
    }

    @Test
    void getConfigRejectsWhenUnauthenticated() {
        when(request.getRemoteUser()).thenReturn(null);

        try {
            resource.getConfig(request);
            fail("Expected WebApplicationException");
        } catch (WebApplicationException ex) {
            assertEquals(401, ex.getResponse().getStatus());
        }
    }

    @Test
    void getConfigRejectsWhenNotAdmin() {
        when(request.getRemoteUser()).thenReturn("FACILITY:testuser");
        when(userServiceBean.isAdmin("FACILITY:testuser")).thenReturn(false);

        try {
            resource.getConfig(request);
            fail("Expected WebApplicationException");
        } catch (WebApplicationException ex) {
            assertEquals(403, ex.getResponse().getStatus());
        }
    }

    @Test
    void getConfigReturnsMaskedConfigForAdmin() {
        when(request.getHeader("X-Run-Id")).thenReturn("RUN-ORCA");
        when(request.getRemoteUser()).thenReturn("FACILITY:admin");
        when(userServiceBean.isAdmin("FACILITY:admin")).thenReturn(true);
        when(configStore.getDefaultFacilityId()).thenReturn("FACILITY");

        OrcaConnectionConfigRecord record = new OrcaConnectionConfigRecord();
        record.setUseWeborca(Boolean.TRUE);
        record.setServerUrl("https://weborca-trial.orca.med.or.jp");
        record.setPort(443);
        record.setUsername("trial");
        record.setPushUrl("wss://push.orca.med.or.jp/ws/notifications");
        record.setPushTenantId("tenant-001");
        record.setPasswordEncrypted("encrypted-password");
        record.setPasswordUpdatedAt("2026-02-11T23:25:24Z");
        when(configStore.getSnapshot("FACILITY")).thenReturn(record);

        Response response = resource.getConfig(request);
        assertEquals(200, response.getStatus());

        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getEntity();
        assertNotNull(body);
        assertEquals("RUN-ORCA", body.get("runId"));
        assertEquals("FACILITY", body.get("facilityId"));
        assertEquals("FACILITY", body.get("defaultFacilityId"));
        assertEquals(Boolean.TRUE, body.get("ok"));
        assertEquals("https://weborca-trial.orca.med.or.jp", body.get("serverUrl"));
        assertEquals(443, body.get("port"));
        assertEquals("trial", body.get("username"));
        assertEquals("wss://push.orca.med.or.jp/ws/notifications", body.get("pushUrl"));
        assertEquals("tenant-001", body.get("pushTenantId"));
        assertEquals(Boolean.TRUE, body.get("pushConfigured"));
        assertEquals(Boolean.TRUE, body.get("passwordConfigured"));
        assertTrue(!body.containsKey("password"));
    }

    @Test
    void testConnectionReturnsBadRequestForPolicyViolation() {
        when(request.getHeader("X-Run-Id")).thenReturn("RUN-ORCA");
        when(request.getRemoteUser()).thenReturn("FACILITY:admin");
        when(userServiceBean.isAdmin("FACILITY:admin")).thenReturn(true);
        when(configStore.resolve("FACILITY"))
                .thenThrow(new OrcaConnectionPolicyException("insecure_http_disallowed", "本番環境では ORCA の insecure HTTP は許可されていません。"));

        Response response = resource.testConnection(request);

        assertEquals(400, response.getStatus());
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getEntity();
        assertEquals(Boolean.FALSE, body.get("ok"));
        assertEquals("insecure_http_disallowed", body.get("errorCategory"));
    }

    @Test
    void putConfigRejectsWhenUnauthenticated() throws Exception {
        when(request.getRemoteUser()).thenReturn(null);

        try {
            resource.putConfig(request, multipartInputWithConfig("{}"));
            fail("Expected WebApplicationException");
        } catch (WebApplicationException ex) {
            assertEquals(401, ex.getResponse().getStatus());
        }
    }

    @Test
    void putConfigSavesConfigForAdmin() throws Exception {
        when(request.getHeader("X-Run-Id")).thenReturn("RUN-SAVE");
        when(request.getRemoteUser()).thenReturn("FACILITY:admin");
        when(request.getRequestURI()).thenReturn("/openDolphin/api/admin/orca/connection");
        when(userServiceBean.isAdmin("FACILITY:admin")).thenReturn(true);
        when(configStore.getDefaultFacilityId()).thenReturn("FACILITY");

        OrcaConnectionConfigRecord updated = new OrcaConnectionConfigRecord();
        updated.setUseWeborca(Boolean.TRUE);
        updated.setServerUrl("https://weborca-trial.orca.med.or.jp");
        updated.setPort(443);
        updated.setUsername("trial");
        updated.setPushUrl("wss://push.orca.med.or.jp/ws/notifications");
        updated.setPushTenantId("tenant-001");
        updated.setPasswordEncrypted("encrypted-password");
        when(configStore.update(eq("FACILITY"), org.mockito.ArgumentMatchers.any(), isNull(), isNull(), eq("RUN-SAVE"), eq("FACILITY:admin")))
                .thenReturn(updated);

        Response response = resource.putConfig(
                request,
                multipartInputWithConfig("{\"useWeborca\":true,\"serverUrl\":\"https://weborca-trial.orca.med.or.jp\",\"port\":443,\"username\":\"trial\",\"pushUrl\":\"wss://push.orca.med.or.jp/ws/notifications\",\"pushTenantId\":\"tenant-001\"}")
        );

        assertEquals(200, response.getStatus());
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getEntity();
        assertNotNull(body);
        assertEquals(Boolean.TRUE, body.get("ok"));
        assertEquals("RUN-SAVE", body.get("runId"));
        assertEquals("FACILITY", body.get("facilityId"));
        assertEquals("FACILITY", body.get("defaultFacilityId"));
        assertEquals("wss://push.orca.med.or.jp/ws/notifications", body.get("pushUrl"));
        assertEquals("tenant-001", body.get("pushTenantId"));
        assertEquals(Boolean.TRUE, body.get("pushConfigured"));
        assertEquals(Boolean.TRUE, body.get("passwordConfigured"));
        verify(configStore).update(eq("FACILITY"), org.mockito.ArgumentMatchers.any(), isNull(), isNull(), eq("RUN-SAVE"), eq("FACILITY:admin"));
        verify(restOrcaTransport).reloadSettings("FACILITY");
    }

    @Test
    void putConfigReturnsBadRequestWhenPushUrlIsInvalid() throws Exception {
        when(request.getHeader("X-Run-Id")).thenReturn("RUN-PUSH");
        when(request.getRemoteUser()).thenReturn("FACILITY:admin");
        when(request.getRequestURI()).thenReturn("/openDolphin/api/admin/orca/connection");
        when(userServiceBean.isAdmin("FACILITY:admin")).thenReturn(true);
        when(configStore.update(eq("FACILITY"), org.mockito.ArgumentMatchers.any(), isNull(), isNull(), eq("RUN-PUSH"), eq("FACILITY:admin")))
                .thenThrow(new IllegalArgumentException("Push URL は ws:// または wss:// のみ指定できます。"));

        try {
            resource.putConfig(
                    request,
                    multipartInputWithConfig("{\"useWeborca\":true,\"serverUrl\":\"https://weborca-trial.orca.med.or.jp\",\"port\":443,\"username\":\"trial\",\"pushUrl\":\"https://push.orca.med.or.jp/ws\"}")
            );
            fail("Expected WebApplicationException");
        } catch (WebApplicationException ex) {
            assertEquals(400, ex.getResponse().getStatus());
        }
    }

    @Test
    void putDefaultFacilitySeparatesDefaultSwitchFromConfigSave() {
        when(request.getHeader("X-Run-Id")).thenReturn("RUN-DEFAULT");
        when(request.getRemoteUser()).thenReturn("FACILITY:admin");
        when(userServiceBean.isAdmin("FACILITY:admin")).thenReturn(true);
        when(configStore.updateDefaultFacilityId("F001", "RUN-DEFAULT", "FACILITY:admin")).thenReturn("F001");

        OrcaConnectionConfigRecord record = new OrcaConnectionConfigRecord();
        record.setFacilityId("F001");
        record.setUseWeborca(Boolean.TRUE);
        record.setServerUrl("https://facility.example.orca");
        record.setPort(443);
        record.setUsername("facility-user");
        record.setPushUrl("wss://facility.example.orca/push");
        record.setPushTenantId("tenant-f001");
        record.setPasswordEncrypted("encrypted-password");
        when(configStore.getSnapshot("F001")).thenReturn(record);

        Response response = resource.putDefaultFacility(request, "{\"defaultFacilityId\":\"F001\"}");

        assertEquals(200, response.getStatus());
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getEntity();
        assertEquals("F001", body.get("facilityId"));
        assertEquals("F001", body.get("defaultFacilityId"));
        assertEquals("wss://facility.example.orca/push", body.get("pushUrl"));
        assertEquals("tenant-f001", body.get("pushTenantId"));
        verify(configStore).updateDefaultFacilityId("F001", "RUN-DEFAULT", "FACILITY:admin");
        verify(restOrcaTransport).reloadSettings(null);
    }

    private static MultipartFormDataInput multipartInputWithConfig(String configJson) throws Exception {
        MultipartFormDataInput input = mock(MultipartFormDataInput.class);
        InputPart configPart = mock(InputPart.class);
        var headers = new MultivaluedHashMap<String, String>();
        headers.putSingle(HttpHeaders.CONTENT_DISPOSITION, "form-data; name=\"config\"");
        when(configPart.getHeaders()).thenReturn(headers);
        when(configPart.getBody(eq(InputStream.class), isNull()))
                .thenReturn(new ByteArrayInputStream(configJson.getBytes(StandardCharsets.UTF_8)));
        when(input.getFormDataMap()).thenReturn(Map.of("config", List.of(configPart)));
        return input;
    }

    private static void setField(Object target, String name, Object value) throws Exception {
        Field f = target.getClass().getDeclaredField(name);
        f.setAccessible(true);
        f.set(target, value);
    }
}
