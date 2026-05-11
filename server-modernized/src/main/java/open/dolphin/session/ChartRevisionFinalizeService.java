package open.dolphin.session;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
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
import open.dolphin.infomodel.ChartRevisionEntryMode;
import open.dolphin.infomodel.ChartRevisionEventModel;
import open.dolphin.infomodel.ChartRevisionEventType;
import open.dolphin.infomodel.ChartRevisionModel;
import open.dolphin.infomodel.ChartRevisionStatus;
import open.dolphin.rest.AbstractResource;
import open.dolphin.rest.dto.chart.ChartRevisionChangeRequest;
import open.dolphin.rest.dto.chart.ChartRevisionChangeResponse;
import open.dolphin.rest.dto.chart.ChartRevisionFinalizeRequest;
import open.dolphin.rest.dto.chart.ChartRevisionFinalizeResponse;
import open.dolphin.security.audit.AuditEventPayload;
import open.dolphin.security.audit.AuditTrailService;

@ApplicationScoped
@Transactional
public class ChartRevisionFinalizeService {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper().findAndRegisterModules();
    private static final String FINALIZE_DENIED = "chart_revision_finalize_denied";
    private static final String REVISION_EVENT_DENIED = "chart_revision_event_denied";
    private static final String INVALID_REQUEST = "chart_revision_finalize_invalid_request";

    @PersistenceContext(unitName = "opendolphinPU")
    private EntityManager em;

    @Inject
    private AuditTrailService auditTrailService;

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
        Long enteredByUserId = requirePositiveUserId(revision.getEnteredByUserId(), "enteredByUserId");
        ChartRevisionEntryMode entryMode = resolveEntryMode(request.getEntryMode(), enteredByUserId,
                finalizedByUserId);
        Long delegatedByUserId = resolveDelegatedByUserId(entryMode, request.getDelegatedByUserId(),
                finalizedByUserId);

        String canonicalContent = canonicalizeContent(contentJson);
        String finalizeContextJson = writeContextJson(orcaPatientId, patientBirthDate, patientGender, encounterId,
                encounterDate, orcaAcceptanceId, noAcceptanceReason, departmentCode, physicianCode,
                insuranceCombinationNumber, enteredByUserId, entryMode, delegatedByUserId, finalizedByUserId);
        String snapshotManifestJson = writeSnapshotManifestJson(orcaPatientId, encounterId, encounterDate,
                orcaAcceptanceId, noAcceptanceReason, departmentCode, physicianCode, insuranceCombinationNumber);
        String contentHash = sha256(writeHashMaterial(chartId, revisionId, revision.getTitle(), finalizeContextJson,
                snapshotManifestJson, canonicalContent));
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
        revision.setSnapshotManifestJson(snapshotManifestJson);
        revision.setContentHash(contentHash);
        revision.setEntryMode(entryMode);
        revision.setDelegatedByUserId(delegatedByUserId);
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
                physicianCode, insuranceCombinationNumber, enteredByUserId, entryMode, delegatedByUserId,
                finalizedByUserId, true, orcaAcceptanceId != null, noAcceptanceReason != null));
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

    public ChartRevisionChangeResponse amendRevision(long chartId, long revisionId, String facilityId,
            ChartRevisionChangeRequest request) {
        return createRevisionEvent(chartId, revisionId, facilityId, request, ChartRevisionEventType.AMENDED,
                ChartRevisionStatus.AMENDED);
    }

    public ChartRevisionChangeResponse addAddendum(long chartId, long revisionId, String facilityId,
            ChartRevisionChangeRequest request) {
        return createRevisionEvent(chartId, revisionId, facilityId, request, ChartRevisionEventType.ADDENDUM_ADDED,
                ChartRevisionStatus.ADDENDUM);
    }

    public ChartRevisionChangeResponse cancelRevision(long chartId, long revisionId, String facilityId,
            ChartRevisionChangeRequest request) {
        return createRevisionEvent(chartId, revisionId, facilityId, request, ChartRevisionEventType.CANCELLED,
                ChartRevisionStatus.CANCELLED);
    }

    private ChartRevisionChangeResponse createRevisionEvent(long chartId, long revisionId, String facilityId,
            ChartRevisionChangeRequest request, ChartRevisionEventType eventType, ChartRevisionStatus newStatus) {
        requireChangeRequest(request);
        Long actorUserId = request.getActorUserId();
        if (actorUserId == null || actorUserId <= 0L) {
            throw badRequest("actorUserId", "actorUserId is required");
        }
        String reasonText = requireText(request.getReasonText(), "reasonText");
        String reasonCode = trimToNull(request.getReasonCode());

        ChartDocumentModel document = em.find(ChartDocumentModel.class, chartId);
        ChartRevisionModel source = em.find(ChartRevisionModel.class, revisionId);
        ensureLockedRevisionTarget(chartId, revisionId, facilityId, document, source);

        ChartRevisionModel newRevision = null;
        String contentHash = null;
        if (newStatus != ChartRevisionStatus.CANCELLED) {
            String contentJson = requireText(request.getContentJson(), "contentJson");
            String canonicalContent = canonicalizeContent(contentJson);
            int nextRevisionNumber = nextRevisionNumber(chartId);
            String title = firstNonBlank(request.getTitle(), source.getTitle());
            contentHash = sha256(writeHashMaterial(chartId, 0L, title, source.getFinalizeContextJson(),
                    source.getSnapshotManifestJson(),
                    canonicalContent));
            Instant now = Instant.now();

            newRevision = new ChartRevisionModel();
            newRevision.setChartDocumentId(chartId);
            newRevision.setRevisionNumber(nextRevisionNumber);
            newRevision.setStatus(newStatus);
            newRevision.setSourceDocumentId(source.getSourceDocumentId());
            newRevision.setTitle(title);
            newRevision.setContentHash(contentHash);
            newRevision.setEnteredByUserId(source.getEnteredByUserId());
            newRevision.setEntryMode(normalizeEntryMode(source.getEntryMode()));
            newRevision.setDelegatedByUserId(source.getDelegatedByUserId());
            newRevision.setFinalizedByUserId(actorUserId);
            newRevision.setFinalizedAt(now);
            newRevision.setEncounterId(source.getEncounterId());
            newRevision.setEncounterDate(source.getEncounterDate());
            newRevision.setOrcaPatientId(source.getOrcaPatientId());
            newRevision.setOrcaAcceptanceId(source.getOrcaAcceptanceId());
            newRevision.setNoAcceptanceReason(source.getNoAcceptanceReason());
            newRevision.setDepartmentCode(source.getDepartmentCode());
            newRevision.setPhysicianCode(source.getPhysicianCode());
            newRevision.setInsuranceCombinationNumber(source.getInsuranceCombinationNumber());
            newRevision.setFinalizeContextJson(source.getFinalizeContextJson());
            newRevision.setSnapshotManifestJson(source.getSnapshotManifestJson());
            em.persist(newRevision);
            em.flush();
            contentHash = sha256(writeHashMaterial(chartId, newRevision.getId(), title, source.getFinalizeContextJson(),
                    source.getSnapshotManifestJson(), canonicalContent));
            newRevision.setContentHash(contentHash);
        }

        ChartRevisionEventModel event = new ChartRevisionEventModel();
        event.setChartDocumentId(chartId);
        event.setChartRevisionId(revisionId);
        event.setPreviousRevisionId(revisionId);
        event.setNewRevisionId(newRevision != null ? newRevision.getId() : null);
        event.setEventType(eventType);
        event.setActorUserId(actorUserId);
        event.setReasonCode(reasonCode != null ? reasonCode : eventType.name());
        event.setReasonText(reasonText);
        event.setBeforeSummaryJson(writeBeforeSummary(source));
        event.setAfterSummaryJson(writeChangeSummary(eventType, newStatus, contentHash, newRevision != null,
                reasonCode != null));
        event.setEventHash(sha256(event.getAfterSummaryJson()));
        em.persist(event);
        em.flush();

        recordRevisionChangeAudit(facilityId, document, source, newRevision, event, eventType, newStatus,
                contentHash, reasonCode != null);

        ChartRevisionChangeResponse response = new ChartRevisionChangeResponse();
        response.setChartId(chartId);
        response.setSourceRevisionId(revisionId);
        response.setNewRevisionId(newRevision != null ? newRevision.getId() : null);
        response.setEventId(event.getId() != null ? event.getId() : 0L);
        response.setEventType(eventType.name());
        response.setStatus(newStatus.name());
        response.setContentHash(contentHash);
        return response;
    }

    private void requireChangeRequest(ChartRevisionChangeRequest request) {
        if (request == null) {
            throw badRequest("payload", "payload is required");
        }
    }

    private void ensureLockedRevisionTarget(long chartId, long revisionId, String facilityId, ChartDocumentModel document,
            ChartRevisionModel revision) {
        if (document == null || revision == null || !Long.valueOf(chartId).equals(revision.getChartDocumentId())) {
            throw restError(Response.Status.NOT_FOUND, "chart_revision_not_found", "Chart revision was not found",
                    Map.of("chartId", chartId, "revisionId", revisionId));
        }
        if (facilityId != null && !facilityId.isBlank() && !facilityId.equals(document.getFacilityId())) {
            throw restError(Response.Status.FORBIDDEN, "chart_revision_facility_mismatch",
                    "Chart revision is not available for this facility",
                    Map.of("chartId", chartId, "revisionId", revisionId));
        }
        if (revision.getStatus() == ChartRevisionStatus.DRAFT) {
            throw restError(Response.Status.CONFLICT, REVISION_EVENT_DENIED,
                    "Only locked chart revisions can create revision events",
                    Map.of("chartId", chartId, "revisionId", revisionId, "status", revision.getStatus().name()));
        }
    }

    private int nextRevisionNumber(long chartId) {
        Integer max = em.createQuery(
                        "select max(r.revisionNumber) from ChartRevisionModel r where r.chartDocumentId = :chartId",
                        Integer.class)
                .setParameter("chartId", chartId)
                .getSingleResult();
        return max != null ? max + 1 : 1;
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

    private Long requirePositiveUserId(Long userId, String field) {
        if (userId == null || userId <= 0L) {
            throw badRequest(field, field + " is required");
        }
        return userId;
    }

    private ChartRevisionEntryMode resolveEntryMode(String requestedEntryMode, Long enteredByUserId,
            Long finalizedByUserId) {
        ChartRevisionEntryMode derived = enteredByUserId.equals(finalizedByUserId)
                ? ChartRevisionEntryMode.DIRECT
                : ChartRevisionEntryMode.DELEGATED;
        String normalized = trimToNull(requestedEntryMode);
        if (normalized == null) {
            return derived;
        }
        ChartRevisionEntryMode requested;
        try {
            requested = ChartRevisionEntryMode.valueOf(normalized.toUpperCase(java.util.Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw badRequest("entryMode", "entryMode must be DIRECT or DELEGATED");
        }
        if (requested != derived) {
            throw badRequest("entryMode", "entryMode must match stored enteredByUserId and finalizedByUserId");
        }
        return requested;
    }

    private Long resolveDelegatedByUserId(ChartRevisionEntryMode entryMode, Long requestedDelegatedByUserId,
            Long finalizedByUserId) {
        if (entryMode == ChartRevisionEntryMode.DIRECT) {
            if (requestedDelegatedByUserId != null) {
                throw badRequest("delegatedByUserId", "delegatedByUserId is only allowed for DELEGATED entryMode");
            }
            return null;
        }
        if (requestedDelegatedByUserId == null) {
            return finalizedByUserId;
        }
        if (requestedDelegatedByUserId <= 0L) {
            throw badRequest("delegatedByUserId", "delegatedByUserId must be positive");
        }
        if (!requestedDelegatedByUserId.equals(finalizedByUserId)) {
            throw badRequest("delegatedByUserId", "delegatedByUserId must match finalizedByUserId");
        }
        return requestedDelegatedByUserId;
    }

    private ChartRevisionEntryMode normalizeEntryMode(ChartRevisionEntryMode entryMode) {
        return entryMode != null ? entryMode : ChartRevisionEntryMode.DIRECT;
    }

    private String writeContextJson(String orcaPatientId, LocalDate patientBirthDate, String patientGender,
            String encounterId, LocalDate encounterDate, String orcaAcceptanceId, String noAcceptanceReason,
            String departmentCode, String physicianCode, String insuranceCombinationNumber, Long enteredByUserId,
            ChartRevisionEntryMode entryMode, Long delegatedByUserId, Long finalizedByUserId) {
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
        context.put("enteredByUserId", enteredByUserId);
        context.put("entryMode", entryMode.name());
        context.put("delegatedByUserId", delegatedByUserId);
        context.put("finalizedByUserId", finalizedByUserId);
        return writeJson(context);
    }

    private String writeSnapshotManifestJson(String orcaPatientId, String encounterId, LocalDate encounterDate,
            String orcaAcceptanceId, String noAcceptanceReason, String departmentCode, String physicianCode,
            String insuranceCombinationNumber) {
        Map<String, Object> manifest = new LinkedHashMap<>();
        manifest.put("snapshotVersion", 1);
        manifest.put("source", "CHART_FINALIZE");
        manifest.put("orcaPatientId", orcaPatientId);
        manifest.put("encounterId", encounterId);
        manifest.put("encounterDate", encounterDate.toString());
        manifest.put("orcaAcceptanceId", orcaAcceptanceId);
        manifest.put("hasNoAcceptanceReason", noAcceptanceReason != null);
        manifest.put("departmentCode", departmentCode);
        manifest.put("physicianCode", physicianCode);
        manifest.put("insuranceCombinationNumber", insuranceCombinationNumber);
        manifest.put("patientSnapshotStatus", "IDENTIFIER_ONLY");
        manifest.put("acceptanceSnapshotStatus", orcaAcceptanceId != null
                ? "REFERENCED_BY_ORCA_ACCEPTANCE_ID"
                : "NO_ACCEPTANCE_REASON_RECORDED");
        manifest.put("insuranceSnapshotStatus", "COMBINATION_REFERENCED");
        manifest.put("diseaseSnapshotStatus", "PENDING_WORKER_INTEGRATION");
        manifest.put("prescriptionCandidateSnapshotStatus", "PENDING_WORKER_INTEGRATION");
        manifest.put("orcaTransmissionSnapshotStatus", "PENDING_WORKER_INTEGRATION");
        return writeJson(manifest);
    }

    private String writeEventSummary(String contentHash, String encounterId, LocalDate encounterDate,
            String departmentCode, String physicianCode, String insuranceCombinationNumber,
            Long enteredByUserId, ChartRevisionEntryMode entryMode, Long delegatedByUserId, Long finalizedByUserId,
            boolean hasSnapshotManifest, boolean hasOrcaAcceptanceId, boolean hasNoAcceptanceReason) {
        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("status", ChartRevisionStatus.FINAL.name());
        summary.put("contentHash", contentHash);
        summary.put("encounterId", encounterId);
        summary.put("encounterDate", encounterDate.toString());
        summary.put("departmentCode", departmentCode);
        summary.put("physicianCode", physicianCode);
        summary.put("insuranceCombinationNumber", insuranceCombinationNumber);
        summary.put("enteredByUserId", enteredByUserId);
        summary.put("entryMode", entryMode.name());
        summary.put("delegatedByUserId", delegatedByUserId);
        summary.put("finalizedByUserId", finalizedByUserId);
        summary.put("hasSnapshotManifest", hasSnapshotManifest);
        summary.put("hasOrcaAcceptanceId", hasOrcaAcceptanceId);
        summary.put("hasNoAcceptanceReason", hasNoAcceptanceReason);
        return writeJson(summary);
    }

    private String writeBeforeSummary(ChartRevisionModel source) {
        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("revisionId", source.getId());
        summary.put("revisionNumber", source.getRevisionNumber());
        summary.put("status", source.getStatus().name());
        summary.put("contentHash", source.getContentHash());
        return writeJson(summary);
    }

    private String writeChangeSummary(ChartRevisionEventType eventType, ChartRevisionStatus status, String contentHash,
            boolean newRevisionCreated, boolean hasReasonCode) {
        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("eventType", eventType.name());
        summary.put("status", status.name());
        summary.put("contentHash", contentHash);
        summary.put("newRevisionCreated", newRevisionCreated);
        summary.put("hasReasonCode", hasReasonCode);
        return writeJson(summary);
    }

    private void recordRevisionChangeAudit(String facilityId, ChartDocumentModel document, ChartRevisionModel source,
            ChartRevisionModel newRevision, ChartRevisionEventModel event, ChartRevisionEventType eventType,
            ChartRevisionStatus newStatus, String contentHash, boolean hasReasonCode) {
        if (auditTrailService == null) {
            throw restError(Response.Status.SERVICE_UNAVAILABLE, "audit_log_write_unavailable",
                    "Audit log write path is unavailable", Map.of("reasonCode", "audit_log_write_unavailable"));
        }
        Map<String, Object> details = new LinkedHashMap<>();
        details.put("facilityId", facilityId != null && !facilityId.isBlank() ? facilityId : document.getFacilityId());
        details.put("subjectType", "chart_revision");
        details.put("subjectId", document.getId() + ":" + source.getId());
        details.put("chartId", document.getId());
        details.put("sourceRevisionId", source.getId());
        details.put("sourceRevisionNumber", source.getRevisionNumber());
        details.put("sourceRevisionStatus", source.getStatus().name());
        details.put("newRevisionId", newRevision != null ? newRevision.getId() : null);
        details.put("newRevisionNumber", newRevision != null ? newRevision.getRevisionNumber() : null);
        details.put("eventId", event.getId());
        details.put("eventType", eventType.name());
        details.put("status", newStatus.name());
        details.put("contentHash", contentHash);
        details.put("hasReasonCode", hasReasonCode);
        details.put("outcome", "SUCCESS");

        AuditEventPayload payload = new AuditEventPayload();
        payload.setAction("CHART_REVISION_EVENT_RECORDED");
        payload.setResource("/api/charts/{chartId}/revisions/{revisionId}/" + revisionEventPath(eventType));
        payload.setActorId(String.valueOf(event.getActorUserId()));
        payload.setOutcome("SUCCESS");
        payload.setDetails(details);
        auditTrailService.record(payload);
    }

    private String revisionEventPath(ChartRevisionEventType eventType) {
        return switch (eventType) {
            case AMENDED -> "amend";
            case ADDENDUM_ADDED -> "addendum";
            case CANCELLED -> "cancel";
            default -> "event";
        };
    }

    private String writeHashMaterial(long chartId, long revisionId, String title, String contextJson,
            String snapshotManifestJson, String canonicalContent) {
        Map<String, Object> material = new LinkedHashMap<>();
        material.put("chartId", chartId);
        material.put("revisionId", revisionId);
        material.put("title", title);
        material.put("finalizeContext", readJson(jsonOrEmpty(contextJson)));
        material.put("snapshotManifest", readJson(jsonOrEmpty(snapshotManifestJson)));
        material.put("content", readJson(canonicalContent));
        return writeJson(material);
    }

    private String jsonOrEmpty(String json) {
        return trimToNull(json) != null ? json : "{}";
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

    private String firstNonBlank(String first, String second) {
        String normalized = trimToNull(first);
        if (normalized != null) {
            return normalized;
        }
        return trimToNull(second);
    }

    private WebApplicationException badRequest(String field, String message) {
        return restError(Response.Status.BAD_REQUEST, INVALID_REQUEST, message, Map.of("field", field));
    }

    private WebApplicationException restError(Response.Status status, String code, String message,
            Map<String, ?> details) {
        return AbstractResource.restError(null, status, code, message, details, null);
    }
}
