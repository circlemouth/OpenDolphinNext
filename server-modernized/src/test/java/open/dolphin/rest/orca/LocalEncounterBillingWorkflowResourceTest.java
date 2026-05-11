package open.dolphin.rest.orca;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.Response;
import java.lang.reflect.Field;
import java.lang.reflect.Proxy;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import open.dolphin.encounter.EncounterProjectionRepository;
import open.dolphin.rest.dto.orca.CloseAndSendToBillingRequest;
import open.dolphin.security.audit.AuthoritativeAuditRepository;
import org.junit.jupiter.api.Test;

class LocalEncounterBillingWorkflowResourceTest {

    @Test
    void closeAndSendRejectsEncounterWithoutOrcaAcceptanceBeforePatientOrTransportLookup() throws Exception {
        LocalEncounterBillingWorkflowResource resource = new LocalEncounterBillingWorkflowResource();
        EncounterProjectionRepository encounterRepository = mock(EncounterProjectionRepository.class);
        when(encounterRepository.findByEncounterKey("F001:E100")).thenReturn(new EncounterProjectionRepository.EncounterRow(
                "F001:E100",
                "F001",
                "000001",
                100L,
                "F001:S100",
                null,
                Instant.parse("2026-04-27T00:30:00Z"),
                "chart_opened",
                Instant.parse("2026-04-27T00:35:00Z"),
                null,
                null,
                "doctor01",
                null,
                "{\"source\":\"server_derived_acceptance\"}",
                null,
                1L,
                Instant.parse("2026-04-27T00:35:01Z")));
        AuthoritativeAuditRepository auditRepository = mock(AuthoritativeAuditRepository.class);
        when(auditRepository.isWritePathAvailable()).thenReturn(true);
        setField(resource, "encounterProjectionRepository", encounterRepository);
        setField(resource, "authoritativeAuditRepository", auditRepository);

        CloseAndSendToBillingRequest payload = new CloseAndSendToBillingRequest();
        payload.setIdempotencyKey("idem-acceptance-missing");

        WebApplicationException ex = assertThrows(WebApplicationException.class,
                () -> resource.closeAndSendToBilling(createRequest(), "F001:E100", payload));

        assertRestError(ex, Response.Status.CONFLICT.getStatusCode(), "orca_acceptance_missing");
    }

    @Test
    void closeAndSendRejectsClientProvidedAcceptanceAuthorityAliasesBeforeEncounterLookup() throws Exception {
        LocalEncounterBillingWorkflowResource resource = new LocalEncounterBillingWorkflowResource();
        EncounterProjectionRepository encounterRepository = mock(EncounterProjectionRepository.class);
        AuthoritativeAuditRepository auditRepository = mock(AuthoritativeAuditRepository.class);
        setField(resource, "encounterProjectionRepository", encounterRepository);
        setField(resource, "authoritativeAuditRepository", auditRepository);

        CloseAndSendToBillingRequest payload = new CloseAndSendToBillingRequest();
        payload.setIdempotencyKey("idem-forged-acceptance");
        payload.captureUnknownField("acceptanceId", "A-100");
        payload.captureUnknownField("departmentCode", "01");
        payload.captureUnknownField("physicianCode", "10001");

        WebApplicationException ex = assertThrows(WebApplicationException.class,
                () -> resource.closeAndSendToBilling(createRequest(), "F001:E100", payload));

        assertRestError(ex, Response.Status.BAD_REQUEST.getStatusCode(), "invalid_request");
        verifyNoInteractions(encounterRepository, auditRepository);
    }

    @Test
    void closeAndSendRejectsMismatchedProjectionVoucherBeforePatientOrTransportLookup() throws Exception {
        LocalEncounterBillingWorkflowResource resource = new LocalEncounterBillingWorkflowResource();
        EncounterProjectionRepository encounterRepository = mock(EncounterProjectionRepository.class);
        when(encounterRepository.findByEncounterKey("F001:E100")).thenReturn(new EncounterProjectionRepository.EncounterRow(
                "F001:E100",
                "F001",
                "000001",
                100L,
                "F001:S100",
                "A-100",
                Instant.parse("2026-04-27T00:30:00Z"),
                "chart_opened",
                Instant.parse("2026-04-27T00:35:00Z"),
                null,
                null,
                "doctor01",
                null,
                """
                {
                  "rawSensitiveFieldsExcluded": true,
                  "clientProvidedIdentifiersTrusted": false,
                  "serverDerivedAuthorityRequired": true,
                  "officialVisitIdentifiers": {
                    "departmentCode": "01",
                    "physicianCode": "10001",
                    "insuranceCombinationNumber": "0001",
                    "voucherNumber": "A-999",
                    "sequentialNumber": "1"
                  }
                }
                """,
                null,
                1L,
                Instant.parse("2026-04-27T00:35:01Z")));
        AuthoritativeAuditRepository auditRepository = mock(AuthoritativeAuditRepository.class);
        when(auditRepository.isWritePathAvailable()).thenReturn(true);
        setField(resource, "encounterProjectionRepository", encounterRepository);
        setField(resource, "authoritativeAuditRepository", auditRepository);

        CloseAndSendToBillingRequest payload = new CloseAndSendToBillingRequest();
        payload.setIdempotencyKey("idem-mismatched-voucher");

        WebApplicationException ex = assertThrows(WebApplicationException.class,
                () -> resource.closeAndSendToBilling(createRequest(), "F001:E100", payload));

        assertRestError(ex, Response.Status.BAD_REQUEST.getStatusCode(), "invalid_request");
    }

    @Test
    void closeAndSendRejectsAccountingWaitEncounterBeforePatientOrTransportLookup() throws Exception {
        LocalEncounterBillingWorkflowResource resource = new LocalEncounterBillingWorkflowResource();
        EncounterProjectionRepository encounterRepository = mock(EncounterProjectionRepository.class);
        when(encounterRepository.findByEncounterKey("F001:E100")).thenReturn(new EncounterProjectionRepository.EncounterRow(
                "F001:E100",
                "F001",
                "000001",
                100L,
                "F001:S100",
                "A-100",
                Instant.parse("2026-04-27T00:30:00Z"),
                "accounting-wait",
                Instant.parse("2026-04-27T00:35:00Z"),
                Instant.parse("2026-04-27T00:45:00Z"),
                null,
                "doctor01",
                null,
                """
                {
                  "rawSensitiveFieldsExcluded": true,
                  "clientProvidedIdentifiersTrusted": false,
                  "serverDerivedAuthorityRequired": true,
                  "officialVisitIdentifiers": {
                    "departmentCode": "01",
                    "physicianCode": "10001",
                    "insuranceCombinationNumber": "0001",
                    "voucherNumber": "A-100",
                    "sequentialNumber": "1"
                  }
                }
                """,
                null,
                1L,
                Instant.parse("2026-04-27T00:45:01Z")));
        AuthoritativeAuditRepository auditRepository = mock(AuthoritativeAuditRepository.class);
        when(auditRepository.isWritePathAvailable()).thenReturn(true);
        BillingOrcaWorkflowRepository workflowRepository = mock(BillingOrcaWorkflowRepository.class);
        when(workflowRepository.findTransmission("F001", "F001:E100", "idem-accounting-wait")).thenReturn(null);
        setField(resource, "encounterProjectionRepository", encounterRepository);
        setField(resource, "authoritativeAuditRepository", auditRepository);
        setField(resource, "workflowRepository", workflowRepository);

        CloseAndSendToBillingRequest payload = new CloseAndSendToBillingRequest();
        payload.setIdempotencyKey("idem-accounting-wait");

        WebApplicationException ex = assertThrows(WebApplicationException.class,
                () -> resource.closeAndSendToBilling(createRequest(), "F001:E100", payload));

        assertRestError(ex, Response.Status.CONFLICT.getStatusCode(), "encounter_billing_send_blocked");
    }

    private static HttpServletRequest createRequest() {
        Map<String, Object> attributes = new HashMap<>();
        return (HttpServletRequest) Proxy.newProxyInstance(
                LocalEncounterBillingWorkflowResourceTest.class.getClassLoader(),
                new Class[]{HttpServletRequest.class},
                (proxy, method, args) -> switch (method.getName()) {
                    case "getRemoteUser" -> "F001:doctor01";
                    case "getRequestURI" -> "/api/local/encounters/F001:E100/close-and-send-to-billing";
                    case "getRemoteAddr" -> "127.0.0.1";
                    case "getHeader" -> null;
                    case "getAttribute" -> args != null && args.length == 1 ? attributes.get(String.valueOf(args[0])) : null;
                    case "setAttribute" -> {
                        if (args != null && args.length == 2) {
                            attributes.put(String.valueOf(args[0]), args[1]);
                        }
                        yield null;
                    }
                    default -> null;
                });
    }

    private static void setField(Object target, String fieldName, Object value) throws Exception {
        Class<?> type = target.getClass();
        while (type != null) {
            try {
                Field field = type.getDeclaredField(fieldName);
                field.setAccessible(true);
                field.set(target, value);
                return;
            } catch (NoSuchFieldException ex) {
                type = type.getSuperclass();
            }
        }
        throw new NoSuchFieldException(fieldName);
    }

    @SuppressWarnings("unchecked")
    private static void assertRestError(WebApplicationException ex, int status, String errorCode) {
        assertNotNull(ex);
        Response response = ex.getResponse();
        assertNotNull(response);
        assertEquals(status, response.getStatus());
        assertTrue(response.getEntity() instanceof Map);
        Map<String, Object> body = (Map<String, Object>) response.getEntity();
        assertEquals(errorCode, body.get("errorCode"));
        assertEquals(status, body.get("status"));
    }
}
