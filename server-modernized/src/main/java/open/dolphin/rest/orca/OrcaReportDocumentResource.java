package open.dolphin.rest.orca;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.inject.Inject;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.Map;
import open.dolphin.audit.AuditEventEnvelope;
import open.dolphin.orca.transport.OrcaEndpoint;
import open.dolphin.orca.transport.OrcaTransport;
import open.dolphin.orca.transport.OrcaTransportRequest;
import open.dolphin.orca.transport.OrcaTransportResult;
import open.dolphin.rest.dto.orca.OrcaReportRequest;
import open.dolphin.rest.dto.orca.OrcaReportResponse;

@Path("/orca/reports")
public class OrcaReportDocumentResource extends AbstractOrcaRestResource {

    @Inject
    private OrcaTransport orcaTransport;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @POST
    @Path("/{type}")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public OrcaReportResponse createReport(
            @Context HttpServletRequest request,
            @PathParam("type") String type,
            OrcaReportRequest payload) {
        requireRemoteUser(request);
        requireFacilityId(request);
        if (payload == null || isBlank(payload.getPatientId())) {
            throw validationError(request, "patientId", "patientId is required");
        }

        OrcaEndpoint endpoint = resolveEndpoint(type);
        if (endpoint == null) {
            throw validationError(request, "type", "unsupported report type: " + type);
        }

        String runId = resolveRunId(request);
        String traceId = resolveTraceId(request);
        String requestXml = buildRequestXml(type, payload);
        OrcaTransportResult transportResult = orcaTransport.invokeDetailed(
                endpoint,
                OrcaTransportRequest.post(requestXml).withAccept(MediaType.APPLICATION_JSON));

        OrcaReportResponse response = parseResponse(transportResult, runId, traceId);

        Map<String, Object> details = new LinkedHashMap<>();
        details.put("runId", runId);
        details.put("traceId", traceId);
        details.put("reportType", type);
        details.put("patientId", payload.getPatientId());
        details.put("invoiceNumber", payload.getInvoiceNumber());
        details.put("dataId", response.getDataId());
        details.put("apiResult", response.getApiResult());
        details.put("httpStatus", response.getStatus());
        recordAudit(
                request,
                "ORCA_REPORT_CREATE",
                details,
                response.isOk() ? AuditEventEnvelope.Outcome.SUCCESS : AuditEventEnvelope.Outcome.FAILURE);
        return response;
    }

    private OrcaEndpoint resolveEndpoint(String type) {
        if (type == null) {
            return null;
        }
        return switch (type) {
            case "prescription" -> OrcaEndpoint.PRESCRIPTION_REPORT;
            case "medicinenotebook" -> OrcaEndpoint.MEDICINE_NOTEBOOK_REPORT;
            case "karteno1" -> OrcaEndpoint.KARTENO1_REPORT;
            case "karteno3" -> OrcaEndpoint.KARTENO3_REPORT;
            case "invoicereceipt" -> OrcaEndpoint.INVOICE_RECEIPT_REPORT;
            case "statement" -> OrcaEndpoint.STATEMENT_REPORT;
            default -> null;
        };
    }

    private String buildRequestXml(String type, OrcaReportRequest payload) {
        StringBuilder builder = new StringBuilder();
        builder.append("<data>");
        switch (type) {
            case "prescription" -> {
                builder.append("<prescriptionv2req type=\"record\">");
                appendTag(builder, "Request_Number", "01");
                appendTag(builder, "Patient_ID", payload.getPatientId());
                appendTag(builder, "Invoice_Number", payload.getInvoiceNumber());
                appendTag(builder, "Outside_Class", fallback(payload.getOutsideClass(), "False"));
                builder.append("</prescriptionv2req>");
            }
            case "medicinenotebook" -> {
                builder.append("<medicine_notebookv2req type=\"record\">");
                appendTag(builder, "Request_Number", "01");
                appendTag(builder, "Patient_ID", payload.getPatientId());
                appendTag(builder, "Invoice_Number", payload.getInvoiceNumber());
                appendTag(builder, "Outside_Class", fallback(payload.getOutsideClass(), "False"));
                builder.append("</medicine_notebookv2req>");
            }
            case "karteno1" -> {
                builder.append("<karte_no1v2req type=\"record\">");
                appendTag(builder, "Request_Number", "01");
                appendTag(builder, "Order_Class", fallback(payload.getOrderClass(), "1"));
                appendTag(builder, "Patient_ID", payload.getPatientId());
                appendTag(builder, "Department_Code", payload.getDepartmentCode());
                appendTag(builder, "Insurance_Combination_Number", payload.getInsuranceCombinationNumber());
                builder.append("</karte_no1v2req>");
            }
            case "karteno3" -> {
                builder.append("<karte_no3v2req type=\"record\">");
                appendTag(builder, "Request_Number", "01");
                appendTag(builder, "Order_Class", fallback(payload.getOrderClass(), "1"));
                appendTag(builder, "Patient_ID", payload.getPatientId());
                appendTag(builder, "Perform_Month", payload.getPerformMonth());
                appendTag(builder, "Department_Code", payload.getDepartmentCode());
                appendTag(builder, "Insurance_Combination_Number", payload.getInsuranceCombinationNumber());
                appendTag(builder, "Start_Day", payload.getStartDay());
                appendTag(builder, "Last_Page_Number", payload.getLastPageNumber());
                appendTag(builder, "Last_Row_Number", payload.getLastRowNumber());
                builder.append("</karte_no3v2req>");
            }
            case "invoicereceipt" -> {
                builder.append("<invoice_receiptv2req type=\"record\">");
                appendTag(builder, "Request_Number", "01");
                appendTag(builder, "Patient_ID", payload.getPatientId());
                appendTag(builder, "Invoice_Number", payload.getInvoiceNumber());
                builder.append("</invoice_receiptv2req>");
            }
            case "statement" -> {
                builder.append("<statementv2req type=\"record\">");
                appendTag(builder, "Request_Number", "01");
                appendTag(builder, "Patient_ID", payload.getPatientId());
                appendTag(builder, "Invoice_Number", payload.getInvoiceNumber());
                builder.append("</statementv2req>");
            }
            default -> throw new IllegalArgumentException("unsupported report type");
        }
        builder.append("</data>");
        return builder.toString();
    }

    private OrcaReportResponse parseResponse(OrcaTransportResult result, String runId, String traceId) {
        OrcaReportResponse response = new OrcaReportResponse();
        response.setRunId(runId);
        response.setTraceId(traceId);
        response.setStatus(result != null ? result.getStatus() : 0);
        if (result == null || isBlank(result.getBody())) {
            response.setOk(false);
            response.setError("empty response");
            return response;
        }

        try {
            JsonNode root = objectMapper.readTree(result.getBody());
            response.setApiResult(readString(root, "Api_Result"));
            response.setApiResultMessage(readString(root, "Api_Result_Message"));
            response.setInformationDate(readString(root, "Information_Date"));
            response.setInformationTime(readString(root, "Information_Time"));
            response.setDataId(readString(root, "Data_Id"));
            response.setFormId(readString(root, "Form_ID"));
            response.setFormName(readString(root, "Form_Name"));
            boolean ok = result.getStatus() >= 200 && result.getStatus() < 300;
            response.setOk(ok);
            if (!ok) {
                response.setError(firstNonBlank(response.getApiResultMessage(), "HTTP " + result.getStatus()));
            }
            return response;
        } catch (IOException ex) {
            response.setOk(false);
            response.setError("json parse failed: " + ex.getMessage());
            return response;
        }
    }

    private String readString(JsonNode root, String fieldName) {
        if (root == null || fieldName == null) {
            return null;
        }
        JsonNode found = root.findValue(fieldName);
        if (found == null || found.isMissingNode() || found.isNull()) {
            return null;
        }
        String value = found.asText();
        return value != null && !value.isBlank() ? value : null;
    }

    private String fallback(String value, String fallback) {
        return !isBlank(value) ? value : fallback;
    }

    private String firstNonBlank(String... values) {
        if (values == null) {
            return null;
        }
        for (String value : values) {
            if (!isBlank(value)) {
                return value;
            }
        }
        return null;
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private void appendTag(StringBuilder builder, String tag, String value) {
        builder.append('<').append(tag).append(" type=\"string\">");
        builder.append(escapeXml(value));
        builder.append("</").append(tag).append('>');
    }

    private String escapeXml(String value) {
        if (value == null) {
            return "";
        }
        return value
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&apos;");
    }
}
