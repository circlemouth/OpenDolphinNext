package open.dolphin.session;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.Response;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.Map;
import open.dolphin.infomodel.ChartDocumentModel;
import open.dolphin.infomodel.ChartRevisionEventModel;
import open.dolphin.infomodel.ChartRevisionEventType;
import open.dolphin.infomodel.ChartRevisionModel;
import open.dolphin.infomodel.ChartRevisionStatus;
import open.dolphin.rest.AbstractResource;
import open.dolphin.rest.dto.chart.ChartRevisionFinalizeRequest;
import open.dolphin.rest.dto.chart.ChartRevisionFinalizeResponse;

@ApplicationScoped
@Transactional
public class ChartRevisionFinalizeService {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper().findAndRegisterModules();
    private static final String FINALIZE_DENIED = "chart_revision_finalize_denied";
    private static final String INVALID_REQUEST = "chart_revision_finalize_invalid_request";

    @PersistenceContext(unitName = "opendolphinPU")
    private EntityManager em;

    public ChartRevisionFinalizeResponse finalizeRevision(long chartId, long revisionId,
            String facilityId, ChartRevisionFinalizeRequest request) {
        requireRequest(request);
        String orcaPatientId = requireText(request.getOrcaPatientId(), "orcaPatientId");
        requireText(request.getPatientName(), "patientName");
        LocalDate patientBirthDate = parseDate(requireText(request.getPatientBirthDate(), "patientBirthDate"),
                "patientBirthDate");
        String patientGender = requireText(request.getPatientGender(), "patientGender");
        String encounterId = requireText(request.getEncounterId(), "encounterId");
        LocalDate encounterDate = parseDate(requireText(request.getEncounterDate(), "encounterDate"),
                "encounterDate");
        String departmentCode = requireText(request.getDepartmentCode(), "departmentCode");
        String physicianCode = requireText(request.getPhysicianCode(), "physicianCode");
        String insuranceCombinationNumber = requireText(request.getInsuranceCombinationNumber(),
                "insuranceCombinationNumber");
        Long finalizedByUserId = request.getFinalizedByUserId();
        if (finalizedByUserId == null || finalizedByUserId <= 0L) {
            throw badRequest("finalizedByUserId", "finalizedByUserId is required");
        }
        String contentJson = requireText(request.getContentJson(), "contentJson");
        String orcaAcceptanceId = trimToNull(request.getOrcaAcceptanceId());
        String noAcceptanceReason = trimToNull(request.getNoAcceptanceReason());
        if (orcaAcceptanceId == null && noAcceptanceReason == null) {
            throw badRequest("orcaAcceptanceId", "orcaAcceptanceId or noAcceptanceReason is required");
        }

        ChartDocumentModel document = em.find(ChartDocumentModel.class, chartId);
        ChartRevisionModel revision = em.find(ChartRevisionModel.class, revisionId);
        if (document == null || revision == null || !Long.valueOf(chartId).equals(revision.getChartDocumentId())) {
            throw restError(Response.Status.NOT_FOUND, "chart_revision_not_found", "Chart revision was not found",
                    Map.of("chartId", chartId, "revisionId", revisionId));
        }
        if (facilityId != null && !facilityId.isBlank() && !facilityId.equals(document.getFacilityId())) {
            throw restError(Response.Status.FORBIDDEN, "chart_revision_facility_mismatch",
                    "Chart revision is not available for this facility",
                    Map.of("chartId", chartId, "revisionId", revisionId));
        }
        if (revision.getStatus() != ChartRevisionStatus.DRAFT) {
            throw restError(Response.Status.CONFLICT, FINALIZE_DENIED,
                    "Only DRAFT chart revisions can be finalized",
                    Map.of("chartId", chartId, "revisionId", revisionId, "status", revision.getStatus().name()));
        }
        Long currentRevisionId = document.getCurrentRevisionId();
        if (currentRevisionId != null && !currentRevisionId.equals(revisionId)) {
            throw restError(Response.Status.CONFLICT, FINALIZE_DENIED,
                    "Current chart revision does not match finalize target",
                    Map.of("chartId", chartId, "revisionId", revisionId));
        }

        String canonicalContent = canonicalizeContent(contentJson);
        String finalizeContextJson = writeContextJson(orcaPatientId, patientBirthDate, patientGender, encounterId,
                encounterDate, orcaAcceptanceId, noAcceptanceReason, departmentCode, physicianCode,
                insuranceCombinationNumber, finalizedByUserId);
        String contentHash = sha256(writeHashMaterial(chartId, revisionId, revision.getTitle(), finalizeContextJson,
                canonicalContent));
        Instant finalizedAt = Instant.now();

        revision.setStatus(ChartRevisionStatus.FINAL);
        revision.setOrcaPatientId(orcaPatientId);
        revision.setEncounterId(encounterId);
        revision.setEncounterDate(encounterDate);
        revision.setOrcaAcceptanceId(orcaAcceptanceId);
        revision.setNoAcceptanceReason(noAcceptanceReason);
        revision.setDepartmentCode(departmentCode);
        revision.setPhysicianCode(physicianCode);
        revision.setInsuranceCombinationNumber(insuranceCombinationNumber);
        revision.setFinalizeContextJson(finalizeContextJson);
        revision.setContentHash(contentHash);
        revision.setFinalizedByUserId(finalizedByUserId);
        revision.setFinalizedAt(finalizedAt);
        document.setCurrentRevisionId(revisionId);

        ChartRevisionEventModel event = new ChartRevisionEventModel();
        event.setChartDocumentId(chartId);
        event.setChartRevisionId(revisionId);
        event.setNewRevisionId(revisionId);
        event.setEventType(ChartRevisionEventType.FINALIZED);
        event.setActorUserId(finalizedByUserId);
        event.setReasonCode("FINALIZE");
        event.setBeforeSummaryJson("{\"status\":\"DRAFT\"}");
        event.setAfterSummaryJson(writeEventSummary(contentHash, encounterId, encounterDate, departmentCode,
                physicianCode, insuranceCombinationNumber, orcaAcceptanceId != null, noAcceptanceReason != null));
        event.setEventHash(sha256(event.getAfterSummaryJson()));
        em.persist(event);
        em.flush();

        ChartRevisionFinalizeResponse response = new ChartRevisionFinalizeResponse();
        response.setChartId(chartId);
        response.setRevisionId(revisionId);
        response.setStatus(ChartRevisionStatus.FINAL.name());
        response.setContentHash(contentHash);
        response.setFinalizedAt(finalizedAt.toString());
        response.setFinalizedByUserId(finalizedByUserId);
        return response;
    }

    private void requireRequest(ChartRevisionFinalizeRequest request) {
        if (request == null) {
            throw badRequest("payload", "payload is required");
        }
    }

    private String requireText(String value, String field) {
        String normalized = trimToNull(value);
        if (normalized == null) {
            throw badRequest(field, field + " is required");
        }
        return normalized;
    }

    private LocalDate parseDate(String value, String field) {
        try {
            return LocalDate.parse(value);
        } catch (DateTimeParseException ex) {
            throw badRequest(field, field + " must be YYYY-MM-DD");
        }
    }

    private String canonicalizeContent(String contentJson) {
        try {
            JsonNode node = OBJECT_MAPPER.readTree(contentJson);
            return OBJECT_MAPPER.writeValueAsString(node);
        } catch (JsonProcessingException ex) {
            throw badRequest("contentJson", "contentJson must be valid JSON");
        }
    }

    private String writeContextJson(String orcaPatientId, LocalDate patientBirthDate, String patientGender,
            String encounterId, LocalDate encounterDate, String orcaAcceptanceId, String noAcceptanceReason,
            String departmentCode, String physicianCode, String insuranceCombinationNumber, Long finalizedByUserId) {
        Map<String, Object> context = new LinkedHashMap<>();
        context.put("orcaPatientId", orcaPatientId);
        context.put("patientBirthDate", patientBirthDate.toString());
        context.put("patientGender", patientGender);
        context.put("encounterId", encounterId);
        context.put("encounterDate", encounterDate.toString());
        context.put("orcaAcceptanceId", orcaAcceptanceId);
        context.put("noAcceptanceReason", noAcceptanceReason);
        context.put("departmentCode", departmentCode);
        context.put("physicianCode", physicianCode);
        context.put("insuranceCombinationNumber", insuranceCombinationNumber);
        context.put("finalizedByUserId", finalizedByUserId);
        return writeJson(context);
    }

    private String writeEventSummary(String contentHash, String encounterId, LocalDate encounterDate,
            String departmentCode, String physicianCode, String insuranceCombinationNumber,
            boolean hasOrcaAcceptanceId, boolean hasNoAcceptanceReason) {
        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("status", ChartRevisionStatus.FINAL.name());
        summary.put("contentHash", contentHash);
        summary.put("encounterId", encounterId);
        summary.put("encounterDate", encounterDate.toString());
        summary.put("departmentCode", departmentCode);
        summary.put("physicianCode", physicianCode);
        summary.put("insuranceCombinationNumber", insuranceCombinationNumber);
        summary.put("hasOrcaAcceptanceId", hasOrcaAcceptanceId);
        summary.put("hasNoAcceptanceReason", hasNoAcceptanceReason);
        return writeJson(summary);
    }

    private String writeHashMaterial(long chartId, long revisionId, String title, String contextJson,
            String canonicalContent) {
        Map<String, Object> material = new LinkedHashMap<>();
        material.put("chartId", chartId);
        material.put("revisionId", revisionId);
        material.put("title", title);
        material.put("finalizeContext", readJson(contextJson));
        material.put("content", readJson(canonicalContent));
        return writeJson(material);
    }

    private JsonNode readJson(String json) {
        try {
            return OBJECT_MAPPER.readTree(json);
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("failed to read canonical JSON", ex);
        }
    }

    private String writeJson(Object value) {
        try {
            return OBJECT_MAPPER.writeValueAsString(value);
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("failed to write canonical JSON", ex);
        }
    }

    private String sha256(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 is unavailable", ex);
        }
    }

    private String trimToNull(String value) {
        if (value == null || value.trim().isEmpty()) {
            return null;
        }
        return value.trim();
    }

    private WebApplicationException badRequest(String field, String message) {
        return restError(Response.Status.BAD_REQUEST, INVALID_REQUEST, message, Map.of("field", field));
    }

    private WebApplicationException restError(Response.Status status, String code, String message,
            Map<String, ?> details) {
        return AbstractResource.restError(null, status, code, message, details, null);
    }
}
