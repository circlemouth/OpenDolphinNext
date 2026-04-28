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
import open.dolphin.rest.dto.orca.ChartSupportDiseaseModV3Request;
import open.dolphin.rest.dto.orca.ChartSupportDiseaseModV3Response;
import open.dolphin.rest.dto.orca.ChartSupportIncomeInfoRequest;
import open.dolphin.rest.dto.orca.ChartSupportIncomeInfoResponse;
import open.dolphin.rest.dto.orca.ChartSupportMedicationGetRequest;
import open.dolphin.rest.dto.orca.ChartSupportMedicationGetResponse;
import open.dolphin.rest.dto.orca.ChartSupportMedicalModResponse;
import open.dolphin.rest.dto.orca.ChartSupportMedicalModV2Request;
import open.dolphin.rest.dto.orca.ChartSupportSubjectivesModV2Request;
import open.dolphin.rest.dto.orca.ChartSupportSubjectivesModV2Response;
import open.dolphin.rest.dto.orca.OrcaEncounterContext;

@Path("/orca/official/chart-support")
public class OrcaChartSupportResource extends AbstractOrcaRestResource {
    private static final String ROUTE_NAMESPACE = "official";
    private static final String AUDIT_MEDICAL_MOD_ACTION = "ORCA_OFFICIAL_MEDICAL_MOD_V2";
    private static final String AUDIT_MEDICATION_GET_ACTION = "ORCA_OFFICIAL_MEDICATION_GET";
    private static final String AUDIT_CONTRAINDICATION_CHECK_ACTION = "ORCA_OFFICIAL_CONTRAINDICATION_CHECK";
    private static final String AUDIT_INCOME_INFO_ACTION = "ORCA_OFFICIAL_INCOME_INFO";
    private static final String AUDIT_SUBJECTIVES_MOD_ACTION = "ORCA_OFFICIAL_SUBJECTIVES_MOD_V2";
    private static final String AUDIT_DISEASE_MOD_ACTION = "ORCA_OFFICIAL_DISEASE_MOD_V3";

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
        OrcaEncounterContext encounterContext = payload != null ? payload.getEncounterContext() : null;
        if (payload == null || encounterContext == null || isBlank(payload.getPatientId()) || isBlank(payload.getPerformDate())
                || isBlank(payload.getDepartmentCode()) || isBlank(payload.getPhysicianCode())
                || isBlank(payload.getInsuranceCombinationNumber()) || isBlank(encounterContext.getVoucherNumber())
                || isBlank(encounterContext.getSequentialNumber()) || isBlank(payload.getClassCode())) {
            throw validationError(request, "payload",
                    "encounterContext.patientId, visitDate, departmentCode, physicianCode, "
                            + "insuranceCombinationNumber, voucherNumber, sequentialNumber, classCode are required");
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
        String requestXml;
        try {
            support().validateMedicalModV2Request(payload);
            requestXml = support().buildMedicalModV2RequestXml(payload);
        } catch (IllegalArgumentException ex) {
            throw validationError(request, "payload.medicalInformation", ex.getMessage());
        }
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
        details.put("physicianCode", payload.getPhysicianCode());
        details.put("insuranceCombinationNumber", payload.getInsuranceCombinationNumber());
        details.put("voucherNumber", encounterContext.getVoucherNumber());
        details.put("sequentialNumber", encounterContext.getSequentialNumber());
        details.put("classCode", classCode);
        details.put("medicalInformationCount",
                payload.getMedicalInformation() != null ? payload.getMedicalInformation().size() : 0);
        details.put("medicalPush", payload.getMedicalPush());
        details.put("medicalUidPresent", !isBlank(payload.getMedicalUid()));
        details.put("apiResult", response.getApiResult());
        details.put("httpStatus", response.getStatus());
        details.put("routeNamespace", ROUTE_NAMESPACE);
        recordAudit(request, AUDIT_MEDICAL_MOD_ACTION, details,
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
        String requestNumber = payload != null && !isBlank(payload.getRequestNumber())
                ? payload.getRequestNumber().trim()
                : "02";
        if (payload == null || isBlank(payload.getRequestCode())) {
            throw validationError(request, "payload", "requestCode is required");
        }
        if (!"01".equals(requestNumber) && !"02".equals(requestNumber)) {
            throw validationError(request, "payload.requestNumber", "requestNumber must be 01 or 02");
        }
        if ("01".equals(requestNumber) && !payload.getRequestCode().trim().matches("[A-Za-z0-9]+")) {
            throw validationError(request, "payload.requestCode", "requestCode must be an alphanumeric input code for requestNumber 01");
        }
        if ("02".equals(requestNumber) && !payload.getRequestCode().trim().matches("\\d{9}")) {
            throw validationError(request, "payload.requestCode", "requestCode must be a 9-digit medical code for requestNumber 02");
        }
        if (isBlank(payload.getBaseDate())) {
            throw validationError(request, "payload.baseDate", "baseDate is required");
        }
        if (!payload.getBaseDate().trim().matches("\\d{8}|\\d{4}-\\d{2}-\\d{2}")) {
            throw validationError(request, "payload.baseDate", "baseDate must be yyyy-MM-dd or yyyymmdd");
        }
        if (!isBlank(payload.getBaseDate())) {
            payload.setBaseDate(payload.getBaseDate().trim());
        }
        payload.setRequestCode(payload.getRequestCode().trim());
        payload.setRequestNumber(requestNumber);

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
        details.put("requestNumber", requestNumber);
        details.put("requestCode", payload.getRequestCode());
        details.put("baseDatePresent", !isBlank(payload.getBaseDate()));
        details.put("apiResult", response.getApiResult());
        details.put("httpStatus", response.getStatus());
        details.put("routeNamespace", ROUTE_NAMESPACE);
        recordAudit(request, AUDIT_MEDICATION_GET_ACTION, details,
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
        details.put("routeNamespace", ROUTE_NAMESPACE);
        recordAudit(request, AUDIT_CONTRAINDICATION_CHECK_ACTION, details,
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
        if (payload == null || isBlank(payload.getPatientId()) || isBlank(payload.getBaseDate())) {
            throw validationError(request, "payload", "patientId and baseDate are required");
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
        details.put("baseDate", payload.getBaseDate());
        details.put("apiResult", response.getApiResult());
        details.put("httpStatus", response.getStatus());
        details.put("routeNamespace", ROUTE_NAMESPACE);
        recordAudit(request, AUDIT_INCOME_INFO_ACTION, details,
                response.isOk() ? AuditEventEnvelope.Outcome.SUCCESS : AuditEventEnvelope.Outcome.FAILURE);
        return response;
    }

    @POST
    @Path("/subjectives-mod-v2")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public ChartSupportSubjectivesModV2Response subjectivesModV2(
            @Context HttpServletRequest request,
            ChartSupportSubjectivesModV2Request payload) {
        requireRemoteUser(request);
        String facilityId = requireFacilityId(request);
        if (payload == null || isBlank(payload.getPatientId()) || isBlank(payload.getPerformDate())
                || isBlank(payload.getDepartmentCode()) || isBlank(payload.getSubjectivesCode())
                || isBlank(payload.getSubjectivesDetailRecord())) {
            throw validationError(request, "payload",
                    "patientId, performDate, departmentCode, subjectivesCode, and subjectivesDetailRecord are required");
        }
        if (!isBlank(payload.getInOut()) && !"O".equals(payload.getInOut().trim())) {
            throw validationError(request, "payload.inOut", "inOut must be O for the outpatient subjectivesv2 wrapper");
        }
        if (!payload.getPerformDate().trim().matches("\\d{4}-\\d{2}(-\\d{2})?|\\d{6}|\\d{8}")) {
            throw validationError(request, "payload.performDate", "performDate must be yyyy-MM, yyyy-MM-dd, yyyymm, or yyyymmdd");
        }

        String runId = resolveRunId(request);
        String traceId = resolveTraceId(request);
        String requestXml = support().buildSubjectivesModV2RequestXml(payload);
        OrcaTransportResult result = orcaTransport.invoke(
                facilityId,
                OrcaEndpoint.SUBJECTIVES_MOD,
                OrcaTransportRequest.post(requestXml).withQuery("class=01"));
        ChartSupportSubjectivesModV2Response response = support().parseSubjectivesModV2Response(result, runId, traceId);

        Map<String, Object> details = new LinkedHashMap<>();
        details.put("runId", runId);
        details.put("traceId", traceId);
        details.put("patientIdPresent", true);
        details.put("departmentCode", payload.getDepartmentCode());
        details.put("subjectivesDetailRecord", payload.getSubjectivesDetailRecord());
        details.put("apiResult", response.getApiResult());
        details.put("responseClassification", response.getResponseClassification());
        details.put("httpStatus", response.getStatus());
        details.put("routeNamespace", ROUTE_NAMESPACE);
        recordAudit(request, AUDIT_SUBJECTIVES_MOD_ACTION, details,
                response.isBusinessAccepted() ? AuditEventEnvelope.Outcome.SUCCESS : AuditEventEnvelope.Outcome.FAILURE);
        return response;
    }

    @POST
    @Path("/disease-mod-v3")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public ChartSupportDiseaseModV3Response diseaseModV3(
            @Context HttpServletRequest request,
            ChartSupportDiseaseModV3Request payload) {
        requireRemoteUser(request);
        String facilityId = requireFacilityId(request);
        if (payload == null || isBlank(payload.getPatientId()) || isBlank(payload.getPerformDate())
                || isBlank(payload.getDepartmentCode()) || payload.getDiseaseInformation() == null
                || payload.getDiseaseInformation().isEmpty()) {
            throw validationError(request, "payload",
                    "patientId, performDate, departmentCode, and diseaseInformation are required");
        }
        if (!isBlank(payload.getRequestNumber())) {
            throw validationError(request, "payload.requestNumber",
                    "diseaseModV3 create currently requires Request_Number to be absent");
        }
        for (ChartSupportDiseaseModV3Request.DiseaseInformation entry : payload.getDiseaseInformation()) {
            if (entry == null || isBlank(entry.getDiseaseCode()) || isBlank(entry.getDiseaseStartDate())) {
                throw validationError(request, "payload.diseaseInformation",
                        "diseaseCode and diseaseStartDate are required for every create candidate");
            }
        }

        String runId = resolveRunId(request);
        String traceId = resolveTraceId(request);
        String requestXml = support().buildDiseaseModV3RequestXml(payload);
        OrcaTransportResult result = orcaTransport.invoke(
                facilityId,
                OrcaEndpoint.DISEASE_MOD_V3,
                OrcaTransportRequest.post(requestXml));
        ChartSupportDiseaseModV3Response response = support().parseDiseaseModV3Response(result, runId, traceId);

        Map<String, Object> details = new LinkedHashMap<>();
        details.put("runId", runId);
        details.put("traceId", traceId);
        details.put("patientIdPresent", true);
        details.put("departmentCode", payload.getDepartmentCode());
        details.put("diseaseCandidateCount", payload.getDiseaseInformation().size());
        details.put("apiResult", response.getApiResult());
        details.put("responseClassification", response.getResponseClassification());
        details.put("httpStatus", response.getStatus());
        details.put("routeNamespace", ROUTE_NAMESPACE);
        recordAudit(request, AUDIT_DISEASE_MOD_ACTION, details,
                response.isBusinessAccepted() ? AuditEventEnvelope.Outcome.SUCCESS : AuditEventEnvelope.Outcome.FAILURE);
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
