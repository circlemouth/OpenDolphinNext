package open.dolphin.rest.orca;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.inject.Inject;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import open.dolphin.audit.AuditEventEnvelope;
import open.dolphin.encounter.EncounterProjectionRepository;
import open.dolphin.infomodel.PatientModel;
import open.dolphin.orca.service.DiseaseProjectionService;
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
import open.dolphin.session.PatientServiceBean;

@Path("/orca/official/chart-support")
public class OrcaChartSupportResource extends AbstractOrcaRestResource {
    private static final String ROUTE_NAMESPACE = "official";
    private static final ZoneId TOKYO_ZONE = ZoneId.of("Asia/Tokyo");
    private static final ObjectMapper JSON_MAPPER = new ObjectMapper();
    private static final String AUDIT_MEDICAL_MOD_ACTION = "ORCA_OFFICIAL_MEDICAL_MOD_V2";
    private static final String AUDIT_MEDICATION_GET_ACTION = "ORCA_OFFICIAL_MEDICATION_GET";
    private static final String AUDIT_CONTRAINDICATION_CHECK_ACTION = "ORCA_OFFICIAL_CONTRAINDICATION_CHECK";
    private static final String AUDIT_INCOME_INFO_ACTION = "ORCA_OFFICIAL_INCOME_INFO";
    private static final String AUDIT_SUBJECTIVES_MOD_ACTION = "ORCA_OFFICIAL_SUBJECTIVES_MOD_V2";
    private static final String AUDIT_DISEASE_MOD_ACTION = "ORCA_OFFICIAL_DISEASE_MOD_V3";
    private static final Set<String> DISEASE_COMPONENT_TYPES =
            Set.of("PREFIX", "SITE", "BODY", "SUFFIX", "UNKNOWN");

    @Inject
    private OrcaTransport orcaTransport;

    @Inject
    private ServerConfigurationResolver configurationResolver;

    @Inject
    EncounterProjectionRepository encounterProjectionRepository;

    @Inject
    private PatientServiceBean patientServiceBean;

    @Inject
    private DiseaseProjectionService diseaseProjectionService;

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

        String facilityId = requireFacilityId(request);
        MedicalModContextAuthority contextAuthority =
                requireServerDerivedMedicalModV2Context(request, facilityId, encounterContext);
        String runId = resolveRunId(request);
        String traceId = resolveTraceId(request);
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
        details.put("serverDerivedEncounterContextVerified", true);
        details.put("serverDerivedEncounterContextSource", contextAuthority.source());
        details.put("serverDerivedEncounterContextProvisional", contextAuthority.provisional());
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

    private MedicalModContextAuthority requireServerDerivedMedicalModV2Context(
            HttpServletRequest request,
            String facilityId,
            OrcaEncounterContext encounterContext) {
        if (encounterProjectionRepository == null) {
            throw validationError(request, "encounterContext", "server-derived encounter context is required");
        }
        LocalDate visitDate = parseEncounterVisitDate(encounterContext != null ? encounterContext.getVisitDate() : null);
        if (visitDate == null) {
            throw validationError(request, "encounterContext.visitDate", "visitDate must be yyyy-MM-dd");
        }
        List<EncounterProjectionRepository.EncounterRow> rows =
                encounterProjectionRepository.findByFacilityAndAcceptanceRange(
                        facilityId,
                        visitDate.atStartOfDay(TOKYO_ZONE).toInstant(),
                        visitDate.plusDays(1).atStartOfDay(TOKYO_ZONE).toInstant());
        List<MedicalModContextAuthority> matches = rows.stream()
                .map(row -> resolveMedicalModContextAuthority(row, encounterContext, visitDate))
                .filter(MedicalModContextAuthority::accepted)
                .toList();
        if (matches.size() != 1) {
            throw validationError(request, "encounterContext",
                    matches.isEmpty()
                            ? "server-derived encounter context was not found"
                            : "server-derived encounter context is ambiguous");
        }
        return matches.get(0);
    }

    private MedicalModContextAuthority resolveMedicalModContextAuthority(
            EncounterProjectionRepository.EncounterRow row,
            OrcaEncounterContext context,
            LocalDate visitDate) {
        if (row == null || context == null || "cancelled".equalsIgnoreCase(normalize(row.businessState()))) {
            return MedicalModContextAuthority.rejected();
        }
        if (!safeEquals(row.patientId(), context.getPatientId())) {
            return MedicalModContextAuthority.rejected();
        }
        if (row.acceptanceDatetime() == null
                || !row.acceptanceDatetime().atZone(TOKYO_ZONE).toLocalDate().equals(visitDate)) {
            return MedicalModContextAuthority.rejected();
        }
        JsonNode flags = readProjectionFlags(row.worklistFlagsJson());
        if (!isServerDerivedProjection(flags)) {
            return MedicalModContextAuthority.rejected();
        }
        JsonNode identifiers = flags.path("officialVisitIdentifiers");
        if (!safeEquals(textNode(identifiers, "departmentCode"), context.getDepartmentCode())
                || !safeEquals(textNode(identifiers, "physicianCode"), context.getPhysicianCode())
                || !safeEquals(textNode(identifiers, "insuranceCombinationNumber"),
                        context.getInsuranceCombinationNumber())) {
            return MedicalModContextAuthority.rejected();
        }
        boolean officialIdentifiersMatch = safeEquals(textNode(identifiers, "voucherNumber"), context.getVoucherNumber())
                && safeEquals(textNode(identifiers, "sequentialNumber"), context.getSequentialNumber());
        if (officialIdentifiersMatch) {
            return new MedicalModContextAuthority(true, false, "encounter_projection_official_identifiers");
        }
        boolean provisionalAllowed = flags.path("provisionalMedicalModV2Context").asBoolean(false)
                && safeEquals(row.orcaAcceptanceId(), context.getVoucherNumber())
                && "1".equals(normalize(context.getSequentialNumber()));
        if (provisionalAllowed) {
            return new MedicalModContextAuthority(true, true, "encounter_projection_acceptlstv2_provisional");
        }
        return MedicalModContextAuthority.rejected();
    }

    private boolean isServerDerivedProjection(JsonNode flags) {
        return flags != null
                && flags.path("rawSensitiveFieldsExcluded").asBoolean(false)
                && !flags.path("clientProvidedIdentifiersTrusted").asBoolean(true)
                && flags.path("serverDerivedAuthorityRequired").asBoolean(false);
    }

    private JsonNode readProjectionFlags(String json) {
        if (json == null || json.isBlank()) {
            return JSON_MAPPER.createObjectNode();
        }
        try {
            return JSON_MAPPER.readTree(json);
        } catch (JsonProcessingException | RuntimeException ex) {
            return JSON_MAPPER.createObjectNode();
        }
    }

    private String textNode(JsonNode node, String fieldName) {
        if (node == null || fieldName == null) {
            return null;
        }
        JsonNode value = node.path(fieldName);
        if (value.isMissingNode() || value.isNull()) {
            return null;
        }
        return normalize(value.asText());
    }

    private LocalDate parseEncounterVisitDate(String value) {
        String normalized = normalize(value);
        if (normalized == null) {
            return null;
        }
        String datePart = normalized.length() >= 10 ? normalized.substring(0, 10) : normalized;
        try {
            return LocalDate.parse(datePart);
        } catch (RuntimeException ex) {
            return null;
        }
    }

    private boolean safeEquals(String left, String right) {
        String normalizedLeft = normalize(left);
        String normalizedRight = normalize(right);
        return normalizedLeft != null && normalizedLeft.equals(normalizedRight);
    }

    private String normalize(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private record MedicalModContextAuthority(boolean accepted, boolean provisional, String source) {
        private static MedicalModContextAuthority rejected() {
            return new MedicalModContextAuthority(false, false, null);
        }
    }

    private record DiseaseModContextAuthority(
            boolean accepted,
            String departmentCode,
            String insuranceCombinationNumber,
            String source) {
        private static DiseaseModContextAuthority rejected() {
            return new DiseaseModContextAuthority(false, null, null, null);
        }
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
        if (payload == null) {
            throw validationError(request, "payload",
                    "patientId, performDate, and departmentCode are required");
        }
        if (!isBlank(payload.getRequestNumber())) {
            throw validationError(request, "payload.requestNumber",
                    "diseaseModV3 Request_Number is server-owned");
        }
        String operation = normalizeDiseaseModOperation(payload.getOperation(), request);
        validateDiseaseModPayload(request, payload, operation);
        DiseaseModContextAuthority contextAuthority =
                requireServerDerivedDiseaseModContext(request, facilityId, payload, operation);
        applyServerDerivedDiseaseContext(request, payload, contextAuthority, operation);
        prepareDiseaseModPayload(request, facilityId, payload, operation);

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
        details.put("operation", operation);
        details.put("serverDerivedEncounterContextVerified", true);
        details.put("serverDerivedEncounterContextSource", contextAuthority.source());
        details.put("diseaseCandidateCount",
                payload.getDiseaseInformation() != null ? payload.getDiseaseInformation().size() : 0);
        details.put("apiResult", response.getApiResult());
        details.put("responseClassification", response.getResponseClassification());
        details.put("operationStatus", response.getOperationStatus());
        details.put("needsUserReview", response.isNeedsUserReview());
        details.put("warningCount", response.getWarnings() != null ? response.getWarnings().size() : 0);
        details.put("unmatchCount", response.getUnmatchInformation() != null ? response.getUnmatchInformation().size() : 0);
        details.put("httpStatus", response.getStatus());
        details.put("routeNamespace", ROUTE_NAMESPACE);
        recordAudit(request, AUDIT_DISEASE_MOD_ACTION, details,
                response.isBusinessAccepted() ? AuditEventEnvelope.Outcome.SUCCESS : AuditEventEnvelope.Outcome.FAILURE);
        return response;
    }

    private String normalizeDiseaseModOperation(String operation, HttpServletRequest request) {
        if (isBlank(operation)) {
            return "create";
        }
        String normalized = operation.trim();
        return switch (normalized) {
            case "create", "update", "delete", "organizeDeletedDiseases" -> normalized;
            default -> throw validationError(request, "payload.operation",
                    "operation must be create, update, delete, or organizeDeletedDiseases");
        };
    }

    private void validateDiseaseModPayload(
            HttpServletRequest request,
            ChartSupportDiseaseModV3Request payload,
            String operation) {
        if (payload == null || isBlank(payload.getPatientId()) || isBlank(payload.getPerformDate())
                || isBlank(payload.getDepartmentCode())) {
            throw validationError(request, "payload",
                    "patientId, performDate, and departmentCode are required");
        }
        if (!payload.getForbiddenClientFields().isEmpty()) {
            throw validationError(request, "payload.clientAuthority",
                    "client-provided Request_Number, raw XML, URL, facility, or owner fields are not accepted");
        }
        requireDateOnly(request, payload.getPerformDate(), "payload.performDate");
        if ("organizeDeletedDiseases".equals(operation)) {
            ChartSupportDiseaseModV3Request.OrganizeInformation organize = payload.getOrganizeInformation();
            if (organize == null || isBlank(organize.getDiseaseStartDate())) {
                throw validationError(request, "payload.organizeInformation",
                        "diseaseStartDate is required for organizeDeletedDiseases");
            }
            if (!organize.getForbiddenClientFields().isEmpty()) {
                throw validationError(request, "payload.organizeInformation.clientAuthority",
                        "client-provided Request_Number, raw XML, URL, facility, or owner fields are not accepted");
            }
            requireDateOnly(request, organize.getDiseaseStartDate(), "payload.organizeInformation.diseaseStartDate");
            return;
        }
        if (payload.getDiseaseInformation() == null || payload.getDiseaseInformation().isEmpty()) {
            throw validationError(request, "payload.diseaseInformation",
                    "diseaseInformation is required for disease mutation");
        }
        for (ChartSupportDiseaseModV3Request.DiseaseInformation entry : payload.getDiseaseInformation()) {
            validateDiseaseEntry(request, entry, "payload.diseaseInformation");
        }
        if ("update".equals(operation) || "delete".equals(operation)) {
            validateDiseaseEntry(request, payload.getTargetDisease(), "payload.targetDisease");
        }
    }

    private DiseaseModContextAuthority requireServerDerivedDiseaseModContext(
            HttpServletRequest request,
            String facilityId,
            ChartSupportDiseaseModV3Request payload,
            String operation) {
        if (patientServiceBean == null) {
            throw validationError(request, "payload.patientId", "patient authority service is required");
        }
        PatientModel patient = patientServiceBean.getPatientById(facilityId, payload.getPatientId());
        if (patient == null) {
            throw restError(request, Response.Status.NOT_FOUND, "patient_not_found", "Patient not found");
        }
        if (encounterProjectionRepository == null) {
            throw validationError(request, "payload", "server-derived encounter context is required");
        }
        LocalDate visitDate = requireDateOnly(request, payload.getPerformDate(), "payload.performDate");
        List<EncounterProjectionRepository.EncounterRow> rows =
                encounterProjectionRepository.findByFacilityAndAcceptanceRange(
                        facilityId,
                        visitDate.atStartOfDay(TOKYO_ZONE).toInstant(),
                        visitDate.plusDays(1).atStartOfDay(TOKYO_ZONE).toInstant());
        List<DiseaseModContextAuthority> matches = rows.stream()
                .map(row -> resolveDiseaseModContextAuthority(row, payload, operation, visitDate))
                .filter(DiseaseModContextAuthority::accepted)
                .toList();
        if (matches.size() != 1) {
            throw validationError(request, "payload",
                    matches.isEmpty()
                            ? "server-derived disease context was not found"
                            : "server-derived disease context is ambiguous");
        }
        return matches.get(0);
    }

    private DiseaseModContextAuthority resolveDiseaseModContextAuthority(
            EncounterProjectionRepository.EncounterRow row,
            ChartSupportDiseaseModV3Request payload,
            String operation,
            LocalDate visitDate) {
        if (row == null || payload == null || "cancelled".equalsIgnoreCase(normalize(row.businessState()))) {
            return DiseaseModContextAuthority.rejected();
        }
        if (!safeEquals(row.patientId(), payload.getPatientId())) {
            return DiseaseModContextAuthority.rejected();
        }
        if (row.acceptanceDatetime() == null
                || !row.acceptanceDatetime().atZone(TOKYO_ZONE).toLocalDate().equals(visitDate)) {
            return DiseaseModContextAuthority.rejected();
        }
        JsonNode flags = readProjectionFlags(row.worklistFlagsJson());
        if (!isServerDerivedProjection(flags)) {
            return DiseaseModContextAuthority.rejected();
        }
        JsonNode identifiers = flags.path("officialVisitIdentifiers");
        String departmentCode = textNode(identifiers, "departmentCode");
        String insuranceCombinationNumber = textNode(identifiers, "insuranceCombinationNumber");
        if (!safeEquals(departmentCode, payload.getDepartmentCode())) {
            return DiseaseModContextAuthority.rejected();
        }
        if (!"organizeDeletedDiseases".equals(operation)
                && !payloadDiseaseInsuranceMatches(payload, insuranceCombinationNumber)) {
            return DiseaseModContextAuthority.rejected();
        }
        return new DiseaseModContextAuthority(
                true,
                departmentCode,
                insuranceCombinationNumber,
                "encounter_projection_official_identifiers");
    }

    private boolean payloadDiseaseInsuranceMatches(
            ChartSupportDiseaseModV3Request payload,
            String serverInsuranceCombinationNumber) {
        if (isBlank(serverInsuranceCombinationNumber)) {
            return true;
        }
        List<ChartSupportDiseaseModV3Request.DiseaseInformation> entries =
                payload.getDiseaseInformation() != null ? payload.getDiseaseInformation() : List.of();
        for (ChartSupportDiseaseModV3Request.DiseaseInformation entry : entries) {
            if (entry != null && !isBlank(entry.getInsuranceCombinationNumber())
                    && !safeEquals(serverInsuranceCombinationNumber, entry.getInsuranceCombinationNumber())) {
                return false;
            }
        }
        ChartSupportDiseaseModV3Request.DiseaseInformation target = payload.getTargetDisease();
        return target == null
                || isBlank(target.getInsuranceCombinationNumber())
                || safeEquals(serverInsuranceCombinationNumber, target.getInsuranceCombinationNumber());
    }

    private void applyServerDerivedDiseaseContext(
            HttpServletRequest request,
            ChartSupportDiseaseModV3Request payload,
            DiseaseModContextAuthority contextAuthority,
            String operation) {
        payload.setDepartmentCode(contextAuthority.departmentCode());
        if ("organizeDeletedDiseases".equals(operation)) {
            if (payload.getOrganizeInformation() != null) {
                payload.getOrganizeInformation().setDepartmentCode(contextAuthority.departmentCode());
            }
            return;
        }
        List<ChartSupportDiseaseModV3Request.DiseaseInformation> entries =
                payload.getDiseaseInformation() != null ? payload.getDiseaseInformation() : List.of();
        for (ChartSupportDiseaseModV3Request.DiseaseInformation entry : entries) {
            applyServerDerivedDiseaseEntryContext(request, entry, contextAuthority, "payload.diseaseInformation");
        }
        if (payload.getTargetDisease() != null) {
            applyServerDerivedDiseaseEntryContext(request, payload.getTargetDisease(), contextAuthority, "payload.targetDisease");
        }
    }

    private void applyServerDerivedDiseaseEntryContext(
            HttpServletRequest request,
            ChartSupportDiseaseModV3Request.DiseaseInformation entry,
            DiseaseModContextAuthority contextAuthority,
            String field) {
        if (entry == null) {
            return;
        }
        if (!entry.getForbiddenClientFields().isEmpty()) {
            throw validationError(request, field + ".clientAuthority",
                    "client-provided Request_Number, raw XML, URL, facility, or owner fields are not accepted");
        }
        if (!isBlank(contextAuthority.insuranceCombinationNumber())) {
            entry.setInsuranceCombinationNumber(contextAuthority.insuranceCombinationNumber());
        }
    }

    private void prepareDiseaseModPayload(
            HttpServletRequest request,
            String facilityId,
            ChartSupportDiseaseModV3Request payload,
            String operation) {
        if ("delete".equals(operation)) {
            payload.setDiseaseInformation(List.of(copyDiseaseForDelete(payload.getTargetDisease())));
        }
        if (!"organizeDeletedDiseases".equals(operation)) {
            List<ChartSupportDiseaseModV3Request.DiseaseInformation> entries =
                    payload.getDiseaseInformation() != null ? payload.getDiseaseInformation() : List.of();
            for (ChartSupportDiseaseModV3Request.DiseaseInformation entry : entries) {
                applyUncodedDiseaseDefault(entry);
                applyOutcomeSendCode(request, entry, operation);
            }
            if (payload.getTargetDisease() != null) {
                applyUncodedDiseaseDefault(payload.getTargetDisease());
                applyOutcomeSendCode(request, payload.getTargetDisease(), "target");
            }
        }
        if ("update".equals(operation) || "delete".equals(operation)) {
            requireCurrentOrcaDiseaseTarget(request, facilityId, payload);
        }
    }

    private void applyUncodedDiseaseDefault(ChartSupportDiseaseModV3Request.DiseaseInformation entry) {
        if (entry != null
                && entry.isUncodedAccepted()
                && (entry.getComponents() == null || entry.getComponents().isEmpty())
                && isBlank(entry.getDiseaseCode())) {
            entry.setDiseaseCode("0000999");
        }
    }

    private void applyOutcomeSendCode(
            HttpServletRequest request,
            ChartSupportDiseaseModV3Request.DiseaseInformation entry,
            String operation) {
        if (entry == null) {
            return;
        }
        if ("delete".equals(operation)) {
            entry.setOrcaOutcomeSendCode("O");
            entry.setDiseaseOutCome("O");
            entry.setOutcome("DELETED");
            return;
        }
        String outcome = firstNonBlank(entry.getOutcome(), entry.getDiseaseOutCome(), entry.getOrcaOutcomeSendCode());
        if (isBlank(outcome) || "ACTIVE".equalsIgnoreCase(outcome) || "継続中".equals(outcome) || "継続".equals(outcome)) {
            entry.setOrcaOutcomeSendCode("");
            entry.setDiseaseOutCome("");
            entry.setOutcome("ACTIVE");
            return;
        }
        String code = switch (outcome.trim().toUpperCase(Locale.ROOT)) {
            case "CURED", "F", "治癒" -> "F";
            case "DEATH", "D", "死亡" -> "D";
            case "DISCONTINUED", "P", "中止" -> "P";
            case "DELETED", "O", "削除" -> "O";
            case "TRANSFERRED", "移行", "転院" -> throw validationError(request, "payload.diseaseInformation.outcome",
                    "TRANSFERRED is retained locally until ORCA Trial diseasev3 send semantics are verified");
            case "C", "S" -> throw validationError(request, "payload.diseaseInformation.outcome",
                    "Disease_OutCome C/S is not accepted for diseasev3 send");
            default -> throw validationError(request, "payload.diseaseInformation.outcome",
                    "outcome must be ACTIVE, CURED, DEATH, DISCONTINUED, TRANSFERRED, or DELETED");
        };
        entry.setOrcaOutcomeSendCode(code);
        entry.setDiseaseOutCome(code);
    }

    private void validateDiseaseEntry(
            HttpServletRequest request,
            ChartSupportDiseaseModV3Request.DiseaseInformation entry,
            String field) {
        if (entry == null || isBlank(entry.getDiseaseStartDate())) {
            throw validationError(request, field,
                    "diseaseStartDate is required");
        }
        requireDateOnly(request, entry.getDiseaseStartDate(), field + ".diseaseStartDate");
        if (!isBlank(entry.getDiseaseEndDate())) {
            requireDateOnly(request, entry.getDiseaseEndDate(), field + ".diseaseEndDate");
        }
        String outcomeCode = firstNonBlank(entry.getOrcaOutcomeSendCode(), entry.getDiseaseOutCome());
        if ("C".equals(outcomeCode) || "S".equals(outcomeCode)) {
            throw validationError(request, field + ".outcome",
                    "Disease_OutCome C/S is not accepted for diseasev3 send; use P/F/D/O or keep TRANSFERRED local-only");
        }
        List<ChartSupportDiseaseModV3Request.DiseaseComponent> components =
                entry.getComponents() != null ? entry.getComponents() : List.of();
        if (components.isEmpty()) {
            if (entry.isUncodedAccepted() && !isBlank(entry.getDiseaseName())) {
                return;
            }
            throw validationError(request, field + ".components",
                    "components are required for ORCA disease mutation");
        }
        if (components.size() > 21) {
            throw validationError(request, field + ".components", "components must contain at most 21 entries");
        }
        boolean bodyPresent = false;
        int expectedSeq = 1;
        for (ChartSupportDiseaseModV3Request.DiseaseComponent component : components) {
            if (component == null) {
                throw validationError(request, field + ".components", "component must not be null");
            }
            if (component.getSeq() == null || component.getSeq() != expectedSeq) {
                throw validationError(request, field + ".components.seq", "component seq must be contiguous from 1");
            }
            expectedSeq++;
            String type = normalizeComponentType(component.getComponentType());
            if (!DISEASE_COMPONENT_TYPES.contains(type)) {
                throw validationError(request, field + ".components.componentType",
                        "componentType must be PREFIX, SITE, BODY, SUFFIX, or UNKNOWN");
            }
            if (isBlank(component.getCode()) || isBlank(component.getName())) {
                throw validationError(request, field + ".components",
                        "component code and name are required");
            }
            if (!isAcceptableDiseaseComponentCode(component.getCode())) {
                throw validationError(request, field + ".components.code",
                        "component code must be a 7-digit ORCA disease code or ZZZ modifier code");
            }
            if ("BODY".equals(type)) {
                bodyPresent = true;
            }
        }
        if (!bodyPresent) {
            throw validationError(request, field + ".components",
                    "one BODY disease component is required");
        }
    }

    private ChartSupportDiseaseModV3Request.DiseaseInformation copyDiseaseForDelete(
            ChartSupportDiseaseModV3Request.DiseaseInformation target) {
        ChartSupportDiseaseModV3Request.DiseaseInformation copy =
                new ChartSupportDiseaseModV3Request.DiseaseInformation();
        copy.setDiseaseCode(target.getDiseaseCode());
        copy.setDiseaseName(target.getDiseaseName());
        copy.setDisplayName(target.getDisplayName());
        copy.setKarteName(target.getKarteName());
        copy.setDiseaseStartDate(target.getDiseaseStartDate());
        copy.setDiseaseEndDate(target.getDiseaseEndDate());
        copy.setDiseaseInOut(target.getDiseaseInOut());
        copy.setDiseaseSuspectedFlag(target.getDiseaseSuspectedFlag());
        copy.setDiseaseOutCome("O");
        copy.setOrcaOutcomeSendCode("O");
        copy.setInsuranceCombinationNumber(target.getInsuranceCombinationNumber());
        copy.setComponents(target.getComponents());
        copy.setSupplements(target.getSupplements());
        copy.setUncodedAccepted(target.isUncodedAccepted());
        return copy;
    }

    private void requireCurrentOrcaDiseaseTarget(
            HttpServletRequest request,
            String facilityId,
            ChartSupportDiseaseModV3Request payload) {
        DiseaseProjectionService projection = diseaseProjectionService();
        LocalDate baseDate = requireDateOnly(request, payload.getPerformDate(), "payload.performDate");
        String requestXml = projection.buildDiseaseGetRequestXml(payload.getPatientId(), baseDate);
        OrcaTransportResult result = orcaTransport.invoke(
                facilityId,
                OrcaEndpoint.DISEASE_GET,
                OrcaTransportRequest.post(requestXml).withQuery(DiseaseProjectionService.DISEASE_GET_QUERY));
        open.dolphin.rest.dto.orca.DiseaseImportResponse mirror =
                projection.buildMirrorResponseFromOrca(
                        result,
                        resolveTraceId(request),
                        payload.getPatientId(),
                        java.util.Date.from(baseDate.atStartOfDay(TOKYO_ZONE).toInstant()),
                        java.util.Date.from(baseDate.plusDays(1).atStartOfDay(TOKYO_ZONE).toInstant()));
        if (!"connected".equals(mirror.getOrcaMirrorStatus())
                || mirror.getDiseases() == null
                || mirror.getDiseases().stream().noneMatch(entry -> sameDiseaseTarget(entry, payload))) {
            throw validationError(request, "payload.targetDisease", "target disease changed or was not found");
        }
    }

    private boolean sameDiseaseTarget(
            open.dolphin.rest.dto.orca.DiseaseImportResponse.DiseaseEntry current,
            ChartSupportDiseaseModV3Request payload) {
        ChartSupportDiseaseModV3Request.DiseaseInformation target =
                payload != null ? payload.getTargetDisease() : null;
        return current != null
                && target != null
                && sameDiseaseComponents(current, target)
                && safeEquals(normalizeDiseaseKeyPart(current.getStartDate()),
                        normalizeDiseaseKeyPart(target.getDiseaseStartDate()))
                && safeEquals(normalizeDiseaseKeyPart(current.getDepartmentCode()),
                        normalizeDiseaseKeyPart(payload.getDepartmentCode()))
                && (isBlank(target.getInsuranceCombinationNumber())
                        || safeEquals(normalizeDiseaseKeyPart(current.getInsuranceCombinationNumber()),
                                normalizeDiseaseKeyPart(target.getInsuranceCombinationNumber())))
                && (isBlank(target.getDiseaseName())
                        || safeEquals(normalizeDiseaseKeyPart(current.getDiagnosisName()),
                                normalizeDiseaseKeyPart(target.getDiseaseName())));
    }

    private boolean sameDiseaseComponents(
            open.dolphin.rest.dto.orca.DiseaseImportResponse.DiseaseEntry current,
            ChartSupportDiseaseModV3Request.DiseaseInformation target) {
        if (target.getComponents() != null && !target.getComponents().isEmpty()) {
            List<String> targetCodes = target.getComponents().stream()
                    .map(ChartSupportDiseaseModV3Request.DiseaseComponent::getCode)
                    .map(this::normalizeDiseaseKeyPart)
                    .toList();
            List<String> currentCodes = current.getComponents() != null
                    ? current.getComponents().stream()
                            .map(open.dolphin.rest.dto.orca.DiseaseImportResponse.DiseaseComponent::getCode)
                            .map(this::normalizeDiseaseKeyPart)
                            .toList()
                    : List.of();
            return !currentCodes.isEmpty() && currentCodes.equals(targetCodes);
        }
        return safeEquals(normalizeDiseaseKeyPart(current.getDiagnosisCode()),
                normalizeDiseaseKeyPart(target.getDiseaseCode()));
    }

    private String normalizeDiseaseKeyPart(String value) {
        return value == null ? "" : value.trim().replace("　", "").replace(" ", "");
    }

    private String normalizeComponentType(String value) {
        return isBlank(value) ? "UNKNOWN" : value.trim().toUpperCase(Locale.ROOT);
    }

    private boolean isAcceptableDiseaseComponentCode(String code) {
        if (isBlank(code)) {
            return false;
        }
        String normalized = code.trim();
        return normalized.matches("\\d{7}") || normalized.matches("ZZZ\\d{4}");
    }

    private String firstNonBlank(String... values) {
        if (values == null) {
            return null;
        }
        for (String value : values) {
            if (!isBlank(value)) {
                return value.trim();
            }
        }
        return null;
    }

    private LocalDate requireDateOnly(HttpServletRequest request, String value, String field) {
        try {
            return LocalDate.parse(value);
        } catch (DateTimeParseException ex) {
            throw validationError(request, field, "date must be yyyy-MM-dd");
        }
    }

    private DiseaseProjectionService diseaseProjectionService() {
        if (diseaseProjectionService == null) {
            diseaseProjectionService = new DiseaseProjectionService();
        }
        return diseaseProjectionService;
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
