package open.dolphin.rest;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
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
import java.lang.reflect.Method;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import open.dolphin.audit.AuditEventEnvelope;
import open.dolphin.orca.config.OrcaConnectionConfigRecord;
import open.dolphin.orca.config.OrcaConnectionConfigStore;
import open.dolphin.orca.transport.OrcaConnectionPolicyException;
import open.dolphin.orca.transport.RestOrcaTransport;
import open.dolphin.security.auth.AdminStepUpGuard;
import open.dolphin.security.audit.AuditDetailSanitizer;
import open.dolphin.security.audit.AuditEventPayload;
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
    private CapturingAuditDispatcher auditDispatcher;

    @BeforeEach
    void setUp() throws Exception {
        resource = new AdminOrcaConnectionResource();
        request = mock(HttpServletRequest.class);
        userServiceBean = mock(UserServiceBean.class);
        configStore = mock(OrcaConnectionConfigStore.class);
        restOrcaTransport = mock(RestOrcaTransport.class);
        auditDispatcher = new CapturingAuditDispatcher();

        setField(resource, "orcaConnectionConfigStore", configStore);
        setField(resource, "restOrcaTransport", restOrcaTransport);
        setField(resource, "userServiceBean", userServiceBean);
        setField(resource, "adminStepUpGuard", mock(AdminStepUpGuard.class));
        setField(resource, "sessionAuditDispatcher", auditDispatcher);
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
        record.setServerUrl("https://orca-trial.example.invalid");
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
        assertEquals("https://orca-trial.example.invalid", body.get("serverUrl"));
        assertEquals(443, body.get("port"));
        assertEquals("trial", body.get("username"));
        assertEquals("wss://push.orca.med.or.jp/ws/notifications", body.get("pushUrl"));
        assertEquals("tenant-001", body.get("pushTenantId"));
        assertEquals(Boolean.TRUE, body.get("pushConfigured"));
        assertEquals(Boolean.TRUE, body.get("pushTenantConfigured"));
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
        updated.setServerUrl("https://orca-trial.example.invalid");
        updated.setPort(443);
        updated.setUsername("trial");
        updated.setPushUrl("wss://push.orca.med.or.jp/ws/notifications");
        updated.setPushTenantId("tenant-001");
        updated.setPasswordEncrypted("encrypted-password");
        when(configStore.update(eq("FACILITY"), org.mockito.ArgumentMatchers.any(), isNull(), isNull(), eq("RUN-SAVE"), eq("FACILITY:admin")))
                .thenReturn(updated);

        Response response = resource.putConfig(
                request,
                multipartInputWithConfig("{\"useWeborca\":true,\"serverUrl\":\"https://orca-trial.example.invalid\",\"port\":443,\"username\":\"trial\",\"pushUrl\":\"wss://push.orca.med.or.jp/ws/notifications\",\"pushTenantId\":\"tenant-001\"}")
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
        assertEquals(Boolean.TRUE, body.get("pushTenantConfigured"));
        assertEquals(Boolean.TRUE, body.get("passwordConfigured"));
        verify(configStore).update(eq("FACILITY"), org.mockito.ArgumentMatchers.any(), isNull(), isNull(), eq("RUN-SAVE"), eq("FACILITY:admin"));
        verify(restOrcaTransport).reloadSettings("FACILITY");
    }

    @Test
    void certificateFileNameSanitizerDropsPathAndControlCharacters() throws Exception {
        assertEquals("client.p12", invokeSafeFileName("..\\private/client\u0001.p12", "clientCertificate.bin"));
        assertEquals("clientCertificate.bin", invokeSafeFileName("../", "clientCertificate.bin"));
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
                    multipartInputWithConfig("{\"useWeborca\":true,\"serverUrl\":\"https://orca-trial.example.invalid\",\"port\":443,\"username\":\"trial\",\"pushUrl\":\"https://push.orca.med.or.jp/ws\"}")
            );
            fail("Expected WebApplicationException");
        } catch (WebApplicationException ex) {
            assertEquals(400, ex.getResponse().getStatus());
        }
    }

    @Test
    void putConfigSanitizesUserinfoFailureInResponse() throws Exception {
        when(request.getHeader("X-Run-Id")).thenReturn("RUN-USERINFO");
        when(request.getRemoteUser()).thenReturn("FACILITY:admin");
        when(request.getRequestURI()).thenReturn("/openDolphin/api/admin/orca/connection");
        when(userServiceBean.isAdmin("FACILITY:admin")).thenReturn(true);
        when(configStore.update(eq("FACILITY"), org.mockito.ArgumentMatchers.any(), isNull(), isNull(), eq("RUN-USERINFO"), eq("FACILITY:admin")))
                .thenThrow(new IllegalArgumentException("Invalid target https://" + "admin:pass@" + "facility.example.orca/secret-prefix"));

        try {
            resource.putConfig(
                    request,
                    multipartInputWithConfig("{\"useWeborca\":true,\"serverUrl\":\"https://" + "admin:pass@" + "facility.example.orca/secret-prefix\",\"port\":443,\"username\":\"trial\"}")
            );
            fail("Expected WebApplicationException");
        } catch (WebApplicationException ex) {
            assertEquals(400, ex.getResponse().getStatus());
            @SuppressWarnings("unchecked")
            Map<String, Object> body = (Map<String, Object>) ex.getResponse().getEntity();
            assertEquals("invalid_request", body.get("error"));
            assertEquals("接続先URLが不正です。", body.get("message"));
            assertNull(body.get("details"));
            assertFalse(body.containsKey("operation"));
            assertFalse(body.containsKey("facilityId"));
            String rendered = AbstractResource.getSerializeMapper().writeValueAsString(body);
            assertFalse(rendered.contains("facility.example.orca"));
            assertFalse(rendered.contains("admin:pass"));
            assertFalse(rendered.contains("secret-prefix"));
            assertFalse(String.valueOf(auditDispatcher.errorMessage).contains("facility.example.orca"));
            assertFalse(String.valueOf(auditDispatcher.errorMessage).contains("admin:pass"));
            assertFalse(String.valueOf(auditDispatcher.errorMessage).contains("secret-prefix"));
            assertFalse(String.valueOf(auditDispatcher.sanitizedDetails).contains("facility.example.orca"));
            assertFalse(String.valueOf(auditDispatcher.sanitizedDetails).contains("admin:pass"));
            assertFalse(String.valueOf(auditDispatcher.sanitizedDetails).contains("secret-prefix"));
        }
    }

    @Test
    void getConfigOmitsLegacyUserinfoServerUrl() throws Exception {
        when(request.getHeader("X-Run-Id")).thenReturn("RUN-LEGACY");
        when(request.getRemoteUser()).thenReturn("FACILITY:admin");
        when(userServiceBean.isAdmin("FACILITY:admin")).thenReturn(true);
        when(configStore.getDefaultFacilityId()).thenReturn("FACILITY");

        OrcaConnectionConfigRecord record = new OrcaConnectionConfigRecord();
        record.setUseWeborca(Boolean.TRUE);
        record.setServerUrl("https://" + "admin:pass@" + "facility.example.orca/secret-prefix");
        record.setPort(443);
        record.setUsername("trial");
        when(configStore.getSnapshot("FACILITY")).thenReturn(record);

        Response response = resource.getConfig(request);
        assertEquals(200, response.getStatus());

        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getEntity();
        assertNull(body.get("serverUrl"));
        String rendered = AbstractResource.getSerializeMapper().writeValueAsString(body);
        assertTrue(!rendered.contains("facility.example.orca"));
        assertTrue(!rendered.contains("admin:pass"));
        assertTrue(!rendered.contains("secret-prefix"));
    }

    @Test
    void putDefaultFacilityRejectsReservedDefaultLiteral() {
        when(request.getHeader("X-Run-Id")).thenReturn("RUN-DEFAULT");
        when(request.getRemoteUser()).thenReturn("FACILITY:admin");
        when(userServiceBean.isAdmin("FACILITY:admin")).thenReturn(true);

        try {
            resource.putDefaultFacility(request, "{\"defaultFacilityId\":\"DeFaUlT\"}");
            fail("Expected WebApplicationException");
        } catch (WebApplicationException ex) {
            assertEquals(400, ex.getResponse().getStatus());
            @SuppressWarnings("unchecked")
            Map<String, Object> body = (Map<String, Object>) ex.getResponse().getEntity();
            assertEquals("invalid_request", body.get("error"));
            assertEquals("defaultFacilityId に予約語 default は指定できません。", body.get("message"));
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
        assertEquals(Boolean.TRUE, body.get("pushTenantConfigured"));
        verify(configStore).updateDefaultFacilityId("F001", "RUN-DEFAULT", "FACILITY:admin");
        verify(restOrcaTransport).reloadSettings("F001");
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

    private String invokeSafeFileName(String original, String fallback) throws Exception {
        Method method = AdminOrcaConnectionResource.class.getDeclaredMethod("safeFileName", String.class, String.class);
        method.setAccessible(true);
        return (String) method.invoke(resource, original, fallback);
    }

    private static final class CapturingAuditDispatcher extends SessionAuditDispatcher {
        private String errorMessage;
        private Map<String, Object> sanitizedDetails;

        @Override
        public AuditEventEnvelope record(AuditEventPayload payload, AuditEventEnvelope.Outcome overrideOutcome,
                String errorCode, String errorMessage) {
            this.errorMessage = errorMessage;
            this.sanitizedDetails = AuditDetailSanitizer.sanitizeDetails(
                    payload != null ? payload.getAction() : null,
                    payload != null ? payload.getDetails() : null);
            return null;
        }
    }
}
