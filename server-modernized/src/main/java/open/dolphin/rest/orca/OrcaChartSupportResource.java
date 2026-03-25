package open.dolphin.rest.orca;

import jakarta.inject.Inject;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.LinkedHashMap;
import java.util.Map;
import open.dolphin.audit.AuditEventEnvelope;
import open.dolphin.orca.transport.OrcaEndpoint;
import open.dolphin.orca.transport.OrcaTransport;
import open.dolphin.orca.transport.OrcaTransportRequest;
import open.dolphin.orca.transport.OrcaTransportResult;
import open.dolphin.runtime.config.ServerConfigurationResolver;
import open.dolphin.rest.dto.orca.ChartSupportContraindicationCheckRequest;
import open.dolphin.rest.dto.orca.ChartSupportContraindicationCheckResponse;
import open.dolphin.rest.dto.orca.ChartSupportIncomeInfoRequest;
import open.dolphin.rest.dto.orca.ChartSupportIncomeInfoResponse;
import open.dolphin.rest.dto.orca.ChartSupportMedicationGetRequest;
import open.dolphin.rest.dto.orca.ChartSupportMedicationGetResponse;
import open.dolphin.rest.dto.orca.ChartSupportMedicalModResponse;
import open.dolphin.rest.dto.orca.ChartSupportMedicalModV23Request;
import open.dolphin.rest.dto.orca.ChartSupportMedicalModV2Request;

@Path("/orca/chart-support")
public class OrcaChartSupportResource extends AbstractOrcaRestResource {

    @Inject
    private OrcaTransport orcaTransport;

    @Inject
    private ServerConfigurationResolver configurationResolver;

    @POST
    @Path("/medical-mod-v2")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public ChartSupportMedicalModResponse medicalModV2(
            @Context HttpServletRequest request,
            ChartSupportMedicalModV2Request payload) {
        requireRemoteUser(request);
        requireFacilityId(request);
        if (payload == null || isBlank(payload.getPatientId()) || isBlank(payload.getPerformDate())
                || isBlank(payload.getDepartmentCode()) || isBlank(payload.getClassCode())) {
            throw validationError(request, "payload", "patientId, performDate, departmentCode, classCode are required");
        }
        String classCode;
        try {
            classCode = normalizeClassCode(payload.getClassCode());
        } catch (IllegalArgumentException ex) {
            throw validationError(request, "payload.classCode", ex.getMessage());
        }
        payload.setClassCode(classCode);
        if (requiresMedicalUid(classCode) && isBlank(payload.getMedicalUid())) {
            throw validationError(request, "payload", "medicalUid is required for classCode 02/03");
        }
        if (isPushMedicalEnabled() && isBlank(payload.getMedicalPush())) {
            payload.setMedicalPush("Yes");
        }

        String runId = resolveRunId(request);
        String traceId = resolveTraceId(request);
        String facilityId = requireFacilityId(request);
        String requestXml = support().buildMedicalModV2RequestXml(payload);
        OrcaTransportResult result = orcaTransport.invoke(
                facilityId,
                OrcaEndpoint.MEDICAL_MOD,
                OrcaTransportRequest.post(requestXml).withQuery("class=" + classCode));
        ChartSupportMedicalModResponse response = support().parseMedicalModResponse(result, runId, traceId);

        Map<String, Object> details = new LinkedHashMap<>();
        details.put("runId", runId);
        details.put("traceId", traceId);
        details.put("patientId", payload.getPatientId());
        details.put("departmentCode", payload.getDepartmentCode());
        details.put("classCode", classCode);
        details.put("medicalInformationCount",
                payload.getMedicalInformation() != null ? payload.getMedicalInformation().size() : 0);
        details.put("medicalPush", payload.getMedicalPush());
        details.put("medicalUidPresent", !isBlank(payload.getMedicalUid()));
        details.put("apiResult", response.getApiResult());
        details.put("httpStatus", response.getStatus());
        recordAudit(request, "ORCA_MEDICAL_MOD_V2", details,
                response.isOk() ? AuditEventEnvelope.Outcome.SUCCESS : AuditEventEnvelope.Outcome.FAILURE);
        return response;
    }

    @POST
    @Path("/medical-mod-v23")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public ChartSupportMedicalModResponse medicalModV23(
            @Context HttpServletRequest request,
            ChartSupportMedicalModV23Request payload) {
        requireRemoteUser(request);
        requireFacilityId(request);
        if (payload == null || isBlank(payload.getPatientId()) || isBlank(payload.getDepartmentCode())) {
            throw validationError(request, "payload", "patientId and departmentCode are required");
        }

        String runId = resolveRunId(request);
        String traceId = resolveTraceId(request);
        String facilityId = requireFacilityId(request);
        String requestXml = support().buildMedicalModV23RequestXml(payload);
        OrcaTransportResult result = orcaTransport.invoke(
                facilityId,
                OrcaEndpoint.MEDICAL_MOD_V23,
                OrcaTransportRequest.post(requestXml));
        ChartSupportMedicalModResponse response = support().parseMedicalModResponse(result, runId, traceId);

        Map<String, Object> details = new LinkedHashMap<>();
        details.put("runId", runId);
        details.put("traceId", traceId);
        details.put("patientId", payload.getPatientId());
        details.put("departmentCode", payload.getDepartmentCode());
        details.put("apiResult", response.getApiResult());
        details.put("httpStatus", response.getStatus());
        recordAudit(request, "ORCA_MEDICAL_MOD_V23", details,
                response.isOk() ? AuditEventEnvelope.Outcome.SUCCESS : AuditEventEnvelope.Outcome.FAILURE);
        return response;
    }

    @POST
    @Path("/medication-get")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public ChartSupportMedicationGetResponse medicationGet(
            @Context HttpServletRequest request,
            ChartSupportMedicationGetRequest payload) {
        requireRemoteUser(request);
        requireFacilityId(request);
        if (payload == null || isBlank(payload.getRequestCode())) {
            throw validationError(request, "payload", "requestCode is required");
        }

        String runId = resolveRunId(request);
        String traceId = resolveTraceId(request);
        String facilityId = requireFacilityId(request);
        String requestXml = support().buildMedicationGetRequestXml(payload);
        OrcaTransportResult result = orcaTransport.invoke(
                facilityId,
                OrcaEndpoint.MEDICATION_GET,
                OrcaTransportRequest.post(requestXml));
        ChartSupportMedicationGetResponse response = support().parseMedicationGetResponse(result, runId, traceId);

        Map<String, Object> details = new LinkedHashMap<>();
        details.put("runId", runId);
        details.put("traceId", traceId);
        details.put("requestCode", payload.getRequestCode());
        details.put("apiResult", response.getApiResult());
        details.put("httpStatus", response.getStatus());
        recordAudit(request, "ORCA_MEDICATION_GET", details,
                response.isOk() ? AuditEventEnvelope.Outcome.SUCCESS : AuditEventEnvelope.Outcome.FAILURE);
        return response;
    }

    @POST
    @Path("/contraindication-check")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public ChartSupportContraindicationCheckResponse contraindicationCheck(
            @Context HttpServletRequest request,
            ChartSupportContraindicationCheckRequest payload) {
        requireRemoteUser(request);
        requireFacilityId(request);
        if (payload == null || isBlank(payload.getPatientId())
                || isBlank(payload.getPerformMonth())) {
            throw validationError(request, "payload", "patientId and performMonth are required");
        }

        String runId = resolveRunId(request);
        String traceId = resolveTraceId(request);
        String facilityId = requireFacilityId(request);
        String requestXml = support().buildContraindicationCheckRequestXml(payload);
        OrcaTransportResult result = orcaTransport.invoke(
                facilityId,
                OrcaEndpoint.CONTRAINDICATION_CHECK,
                OrcaTransportRequest.post(requestXml));
        ChartSupportContraindicationCheckResponse response = support().parseContraindicationCheckResponse(result, runId, traceId);

        Map<String, Object> details = new LinkedHashMap<>();
        details.put("runId", runId);
        details.put("traceId", traceId);
        details.put("patientId", payload.getPatientId());
        details.put("performMonth", payload.getPerformMonth());
        details.put("requestNumber", payload.getRequestNumber());
        details.put("apiResult", response.getApiResult());
        details.put("httpStatus", response.getStatus());
        recordAudit(request, "ORCA_CONTRAINDICATION_CHECK", details,
                response.isOk() ? AuditEventEnvelope.Outcome.SUCCESS : AuditEventEnvelope.Outcome.FAILURE);
        return response;
    }

    @POST
    @Path("/income-info")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public ChartSupportIncomeInfoResponse incomeInfo(
            @Context HttpServletRequest request,
            ChartSupportIncomeInfoRequest payload) {
        requireRemoteUser(request);
        requireFacilityId(request);
        if (payload == null || isBlank(payload.getPatientId())
                || (isBlank(payload.getPerformMonth()) && isBlank(payload.getPerformYear()))) {
            throw validationError(request, "payload", "patientId and performMonth or performYear are required");
        }

        String runId = resolveRunId(request);
        String traceId = resolveTraceId(request);
        String facilityId = requireFacilityId(request);
        String requestXml = support().buildIncomeInfoRequestXml(payload);
        OrcaTransportResult result = orcaTransport.invoke(
                facilityId,
                OrcaEndpoint.INCOME_INFO,
                OrcaTransportRequest.post(requestXml));
        ChartSupportIncomeInfoResponse response = support().parseIncomeInfoResponse(result, runId, traceId);

        Map<String, Object> details = new LinkedHashMap<>();
        details.put("runId", runId);
        details.put("traceId", traceId);
        details.put("patientId", payload.getPatientId());
        details.put("performMonth", payload.getPerformMonth());
        details.put("performYear", payload.getPerformYear());
        details.put("apiResult", response.getApiResult());
        details.put("httpStatus", response.getStatus());
        recordAudit(request, "ORCA_INCOME_INFO", details,
                response.isOk() ? AuditEventEnvelope.Outcome.SUCCESS : AuditEventEnvelope.Outcome.FAILURE);
        return response;
    }

    private OrcaChartSupportSupport support() {
        return new OrcaChartSupportSupport();
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private String normalizeClassCode(String classCode) {
        if (classCode == null || classCode.isBlank()) {
            return classCode;
        }
        String normalized = classCode.trim();
        String lower = normalized.toLowerCase(java.util.Locale.ROOT);
        if (lower.startsWith("class=")) {
            normalized = normalized.substring("class=".length());
        } else if (lower.startsWith("?class=")) {
            normalized = normalized.substring("?class=".length());
        }
        int ampIndex = normalized.indexOf('&');
        if (ampIndex >= 0) {
            normalized = normalized.substring(0, ampIndex);
        }
        if (normalized.length() == 1) {
            normalized = "0" + normalized;
        }
        return switch (normalized) {
            case "01", "02", "03", "04" -> normalized;
            default -> throw new IllegalArgumentException("classCode must be 01/02/03/04");
        };
    }

    private boolean requiresMedicalUid(String classCode) {
        return "02".equals(classCode) || "03".equals(classCode);
    }

    private boolean isPushMedicalEnabled() {
        ServerConfigurationResolver resolver = configurationResolver != null ? configurationResolver : new ServerConfigurationResolver();
        var settings = resolver.orcaPush();
        return settings.enabled() && settings.medicalEnabled() && !settings.shadowMode();
    }
}
