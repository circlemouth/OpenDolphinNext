package open.dolphin.rest;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.WebApplicationException;
import open.dolphin.orca.transport.OrcaTransport;
import open.dolphin.orca.transport.OrcaTransportRequest;
import open.dolphin.orca.transport.OrcaTransportResult;
import open.dolphin.rest.dto.orca.OrcaReportRequest;
import open.dolphin.rest.dto.orca.OrcaReportResponse;
import open.dolphin.rest.orca.OrcaReportDocumentResource;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class OrcaReportDocumentResourceTest {

    private OrcaReportDocumentResource resource;
    private OrcaTransport orcaTransport;
    private HttpServletRequest request;

    @BeforeEach
    void setUp() throws Exception {
        resource = new OrcaReportDocumentResource();
        orcaTransport = mock(OrcaTransport.class);
        request = mock(HttpServletRequest.class);

        setField(resource, "orcaTransport", orcaTransport);
        setField(resource, "sessionAuditDispatcher", null);

        when(request.getRemoteUser()).thenReturn("FACILITY:user");
        when(request.getHeader("X-Run-Id")).thenReturn("RUN-REPORT");
        when(request.getRequestURI()).thenReturn("/openDolphin/api/orca/reports/prescription");
    }

    @Test
    void createReportBuildsJsonContractAndParsesJsonResponse() {
        when(orcaTransport.invokeDetailed(any(), any(OrcaTransportRequest.class)))
                .thenReturn(OrcaTransportResult.fallback(
                        """
                        {
                          "prescriptionv2res": {
                            "Api_Result": "0000",
                            "Api_Result_Message": "正常終了",
                            "Data_Id": "DATA-01",
                            "Form_ID": "FORM-01",
                            "Form_Name": "処方箋"
                          }
                        }
                        """,
                        "application/json"));

        OrcaReportRequest payload = new OrcaReportRequest();
        payload.setPatientId("P001");
        payload.setInvoiceNumber("INV-01");

        OrcaReportResponse response = resource.createReport(request, "prescription", payload);

        assertTrue(response.isOk());
        assertEquals("0000", response.getApiResult());
        assertEquals("DATA-01", response.getDataId());
        assertEquals("FORM-01", response.getFormId());
    }

    @Test
    void createReportRejectsUnsupportedType() {
        OrcaReportRequest payload = new OrcaReportRequest();
        payload.setPatientId("P001");

        try {
            resource.createReport(request, "unknown", payload);
        } catch (WebApplicationException ex) {
            assertEquals(400, ex.getResponse().getStatus());
            return;
        }
        throw new AssertionError("Expected validation error");
    }

    @Test
    void createReportMarksJsonParseFailure() {
        when(orcaTransport.invokeDetailed(any(), any(OrcaTransportRequest.class)))
                .thenReturn(new OrcaTransportResult(null, "POST", 200, "not-json", "application/json", null));

        OrcaReportRequest payload = new OrcaReportRequest();
        payload.setPatientId("P001");
        payload.setInvoiceNumber("INV-01");

        OrcaReportResponse response = resource.createReport(request, "prescription", payload);

        assertFalse(response.isOk());
        assertTrue(response.getError().contains("json parse failed"));
    }

    private static void setField(Object target, String fieldName, Object value) throws Exception {
        Class<?> type = target.getClass();
        java.lang.reflect.Field field = null;
        while (type != null && field == null) {
          try {
              field = type.getDeclaredField(fieldName);
          } catch (NoSuchFieldException ignored) {
              type = type.getSuperclass();
          }
        }
        if (field == null) {
            throw new NoSuchFieldException(fieldName);
        }
        field.setAccessible(true);
        field.set(target, value);
    }
}
