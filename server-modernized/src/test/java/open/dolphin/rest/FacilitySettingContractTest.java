package open.dolphin.rest;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.core.Response;
import java.lang.reflect.Field;
import java.util.Map;
import open.dolphin.orca.config.OrcaConnectionConfigRecord;
import open.dolphin.orca.config.OrcaConnectionConfigStore;
import open.dolphin.rest.admin.AdminConfigSnapshot;
import open.dolphin.rest.admin.AdminConfigStore;
import open.dolphin.session.UserServiceBean;
import org.junit.jupiter.api.Test;

class FacilitySettingContractTest {

    @Test
    void adminSettingInventoryKeepsConfigConnectionAndCapabilitySeparated() throws Exception {
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getHeader("X-Run-Id")).thenReturn("RUN-SPLIT");
        when(request.getRemoteUser()).thenReturn("FACILITY:admin");

        UserServiceBean userServiceBean = mock(UserServiceBean.class);
        when(userServiceBean.isAdmin("FACILITY:admin")).thenReturn(true);

        AdminConfigResource configResource = new AdminConfigResource();
        AdminConfigStore adminConfigStore = mock(AdminConfigStore.class);
        AdminConfigSnapshot snapshot = new AdminConfigSnapshot();
        snapshot.setChartsDisplayEnabled(Boolean.TRUE);
        snapshot.setChartsSendEnabled(Boolean.FALSE);
        snapshot.setChartsMasterSource("fallback");
        snapshot.setDeliveryId("DELIVERY-1");
        snapshot.setDeliveryVersion("VERSION-1");
        snapshot.setDeliveryEtag("ETAG-1");
        snapshot.setDeliveredAt("2026-04-17T00:00:00Z");
        snapshot.setSource("live");
        when(adminConfigStore.getSnapshot()).thenReturn(snapshot);
        setField(configResource, "userServiceBean", userServiceBean);
        setField(configResource, "adminConfigStore", adminConfigStore);

        @SuppressWarnings("unchecked")
        Map<String, Object> configBody = (Map<String, Object>) configResource.getConfig(request).getEntity();
        assertNotNull(configBody);
        assertEquals(Boolean.TRUE, configBody.get("chartsDisplayEnabled"));
        assertFalse(configBody.containsKey("orcaEndpoint"));
        assertFalse(configBody.containsKey("verifyAdminDelivery"));

        AdminOrcaConnectionResource connectionResource = new AdminOrcaConnectionResource();
        OrcaConnectionConfigStore connectionStore = mock(OrcaConnectionConfigStore.class);
        OrcaConnectionConfigRecord record = new OrcaConnectionConfigRecord();
        record.setUseWeborca(Boolean.TRUE);
        record.setServerUrl("https://weborca.example.invalid");
        record.setPort(443);
        record.setUsername("orca-user");
        record.setPushUrl("wss://push.example.invalid/ws");
        record.setPushTenantId("tenant-001");
        when(connectionStore.getSnapshot("FACILITY")).thenReturn(record);
        when(connectionStore.getDefaultFacilityId()).thenReturn("FACILITY");
        setField(connectionResource, "userServiceBean", userServiceBean);
        setField(connectionResource, "orcaConnectionConfigStore", connectionStore);

        @SuppressWarnings("unchecked")
        Map<String, Object> connectionBody = (Map<String, Object>) connectionResource.getConfig(request).getEntity();
        assertNotNull(connectionBody);
        assertEquals(Boolean.TRUE, connectionBody.get("pushConfigured"));
        assertEquals(Boolean.TRUE, connectionBody.get("pushTenantConfigured"));
        assertFalse(connectionBody.containsKey("testedScope"));

        AdminOrcaCapabilitiesResource capabilitiesResource = new AdminOrcaCapabilitiesResource();
        setField(capabilitiesResource, "userServiceBean", userServiceBean);

        @SuppressWarnings("unchecked")
        Map<String, Object> capabilitiesBody = (Map<String, Object>) capabilitiesResource.getCapabilities(request).getEntity();
        assertNotNull(capabilitiesBody);
        @SuppressWarnings("unchecked")
        Map<String, Object> connectionCapability = (Map<String, Object>) capabilitiesBody.get("connection");
        assertEquals("api_only", connectionCapability.get("testedScope"));
        assertFalse(connectionCapability.containsKey("pushConfigured"));
        assertFalse(connectionCapability.containsKey("pushTenantConfigured"));
    }

    private static void setField(Object target, String name, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(name);
        field.setAccessible(true);
        field.set(target, value);
    }
}
