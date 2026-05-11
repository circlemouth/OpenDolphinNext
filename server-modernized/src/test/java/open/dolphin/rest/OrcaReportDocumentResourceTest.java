package open.dolphin.rest;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.WebApplicationException;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import open.dolphin.orca.service.OrcaBillingCacheStore;
import open.dolphin.orca.service.OrcaReportBinaryStorageService;
import open.dolphin.orca.transport.OrcaTransport;
import open.dolphin.orca.transport.OrcaTransportRequest;
import open.dolphin.orca.transport.OrcaTransportResult;
import open.dolphin.rest.dto.orca.OrcaReportRequest;
import open.dolphin.rest.dto.orca.OrcaReportResponse;
import open.dolphin.rest.orca.OrcaReportDocumentResource;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class OrcaReportDocumentResourceTest {

    private OrcaReportDocumentResource resource;
    private OrcaTransport orcaTransport;
    private OrcaBillingCacheStore billingCacheStore;
    private OrcaReportBinaryStorageService reportBinaryStorageService;
    private HttpServletRequest request;

    @BeforeEach
    void setUp() throws Exception {
        resource = new OrcaReportDocumentResource();
        orcaTransport = mock(OrcaTransport.class);
        billingCacheStore = mock(OrcaBillingCacheStore.class);
        reportBinaryStorageService = mock(OrcaReportBinaryStorageService.class);
        request = mock(HttpServletRequest.class);

        setField(resource, "orcaTransport", orcaTransport);
        setField(resource, "billingCacheStore", billingCacheStore);
        setField(resource, "reportBinaryStorageService", reportBinaryStorageService);
        setField(resource, "sessionAuditDispatcher", null);

        when(request.getRemoteUser()).thenReturn("FACILITY:user");
        when(request.getHeader("X-Run-Id")).thenReturn("RUN-REPORT");
        when(request.getRequestURI()).thenReturn("/openDolphin/api/orca/official/reports/prescription");
    }

    @Test
    void createReportBuildsJsonContractAndParsesJsonResponse() {
        when(orcaTransport.invoke(anyString(), any(), any(OrcaTransportRequest.class)))
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

        ArgumentCaptor<OrcaBillingCacheStore.ReportSnapshotCommand> snapshot =
                ArgumentCaptor.forClass(OrcaBillingCacheStore.ReportSnapshotCommand.class);
        verify(billingCacheStore).saveReportSnapshot(snapshot.capture());
        OrcaBillingCacheStore.ReportSnapshotCommand command = snapshot.getValue();
        assertEquals("FACILITY", command.facilityId());
        assertEquals("P001", command.orcaPatientId());
        assertEquals("prescription", command.reportType());
        assertEquals("INV-01", command.invoiceNumber());
        assertTrue(command.requestBody().contains("<prescriptionv2req type=\"record\">"));
        assertTrue(command.responseBody().contains("\"Api_Result\": \"0000\""));
        assertNotSame(response, command.response());
        assertEquals(response.getDataId(), command.response().getDataId());
        assertEquals(response.getFormId(), command.response().getFormId());
        assertEquals("NOT_UPLOADED", response.getStorageUploadStatus());
        assertFalse(Boolean.TRUE.equals(response.getReportBinaryAvailable()));
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
        when(orcaTransport.invoke(anyString(), any(), any(OrcaTransportRequest.class)))
                .thenReturn(new OrcaTransportResult(null, "POST", 200, "not-json", "application/json", null));

        OrcaReportRequest payload = new OrcaReportRequest();
        payload.setPatientId("P001");
        payload.setInvoiceNumber("INV-01");

        OrcaReportResponse response = resource.createReport(request, "prescription", payload);

        assertFalse(response.isOk());
        assertTrue(response.getError().contains("json parse failed"));
    }

    @Test
    void createReportFailsClosedWhenSnapshotPersistenceFails() {
        when(orcaTransport.invoke(anyString(), any(), any(OrcaTransportRequest.class)))
                .thenReturn(OrcaTransportResult.fallback(
                        """
                        {
                          "prescriptionv2res": {
                            "Api_Result": "0000",
                            "Api_Result_Message": "正常終了",
                            "Data_Id": "DATA-01"
                          }
                        }
                        """,
                        "application/json"));
        doThrow(new IllegalStateException("store unavailable"))
                .when(billingCacheStore)
                .saveReportSnapshot(any(OrcaBillingCacheStore.ReportSnapshotCommand.class));

        OrcaReportRequest payload = new OrcaReportRequest();
        payload.setPatientId("P001");
        payload.setInvoiceNumber("INV-01");

        WebApplicationException exception = assertThrows(
                WebApplicationException.class,
                () -> resource.createReport(request, "prescription", payload));

        assertEquals(503, exception.getResponse().getStatus());
    }

    @Test
    void createReportStagesReportBinaryWhenStorageIsEnabledAndSnapshotIsEligible() {
        String responseBody = """
                {
                  "prescriptionv2res": {
                    "Api_Result": "0000",
                    "Api_Result_Message": "正常終了",
                    "Data_Id": "DATA-01"
                  }
                }
                """;
        when(orcaTransport.invoke(anyString(), any(), any(OrcaTransportRequest.class)))
                .thenReturn(OrcaTransportResult.fallback(responseBody, "application/json"));
        when(billingCacheStore.saveReportSnapshot(any(OrcaBillingCacheStore.ReportSnapshotCommand.class)))
                .thenReturn(new OrcaBillingCacheStore.ReportSnapshotReceipt(
                        11L,
                        "FACILITY",
                        "CURRENT",
                        "orca-reports/facility/prescription/request-response.json",
                        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
                        "NOT_UPLOADED",
                        true));
        when(reportBinaryStorageService.isUploadEnabled()).thenReturn(true);
        when(reportBinaryStorageService.uploadReportBinary(any(OrcaReportBinaryStorageService.UploadCommand.class)))
                .thenReturn(new OrcaReportBinaryStorageService.UploadResult(
                        11L,
                        "s3://bucket/orca-reports/facility/prescription/request-response.json",
                        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
                        Instant.parse("2026-05-11T00:42:09Z"),
                        Instant.parse("2026-06-10T00:42:09Z")));

        OrcaReportRequest payload = new OrcaReportRequest();
        payload.setPatientId("P001");
        payload.setInvoiceNumber("INV-01");

        OrcaReportResponse response = resource.createReport(request, "prescription", payload);

        ArgumentCaptor<OrcaReportBinaryStorageService.UploadCommand> upload =
                ArgumentCaptor.forClass(OrcaReportBinaryStorageService.UploadCommand.class);
        verify(reportBinaryStorageService).uploadReportBinary(upload.capture());
        OrcaReportBinaryStorageService.UploadCommand command = upload.getValue();
        assertEquals(11L, command.snapshotId());
        assertEquals("FACILITY", command.facilityId());
        assertEquals("orca-reports/facility/prescription/request-response.json", command.serverStorageObjectKey());
        assertEquals("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
                command.serverStorageDigest());
        assertTrue(new String(command.contentBytes(), StandardCharsets.UTF_8).contains("\"Api_Result\": \"0000\""));
        assertEquals("application/json", command.contentType());
        assertEquals("UPLOADED", response.getStorageUploadStatus());
        assertTrue(Boolean.TRUE.equals(response.getReportBinaryAvailable()));
    }

    @Test
    void createReportFailsClosedWhenEnabledBinaryUploadFails() {
        when(orcaTransport.invoke(anyString(), any(), any(OrcaTransportRequest.class)))
                .thenReturn(OrcaTransportResult.fallback(
                        """
                        {
                          "prescriptionv2res": {
                            "Api_Result": "0000",
                            "Api_Result_Message": "正常終了",
                            "Data_Id": "DATA-01"
                          }
                        }
                        """,
                        "application/json"));
        when(billingCacheStore.saveReportSnapshot(any(OrcaBillingCacheStore.ReportSnapshotCommand.class)))
                .thenReturn(new OrcaBillingCacheStore.ReportSnapshotReceipt(
                        12L,
                        "FACILITY",
                        "CURRENT",
                        "orca-reports/facility/prescription/request-response.json",
                        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
                        "NOT_UPLOADED",
                        true));
        when(reportBinaryStorageService.isUploadEnabled()).thenReturn(true);
        doThrow(new IllegalStateException("object storage unavailable"))
                .when(reportBinaryStorageService)
                .uploadReportBinary(any(OrcaReportBinaryStorageService.UploadCommand.class));

        OrcaReportRequest payload = new OrcaReportRequest();
        payload.setPatientId("P001");

        WebApplicationException exception = assertThrows(
                WebApplicationException.class,
                () -> resource.createReport(request, "prescription", payload));

        assertEquals(503, exception.getResponse().getStatus());
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
