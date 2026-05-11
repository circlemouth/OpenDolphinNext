package open.dolphin.session;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.Query;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.Response;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.StringJoiner;
import java.util.regex.Pattern;
import open.dolphin.infomodel.ChartDocumentModel;
import open.dolphin.infomodel.ChartRevisionEventModel;
import open.dolphin.infomodel.ChartRevisionModel;
import open.dolphin.rest.AbstractResource;
import open.dolphin.rest.dto.chart.ChartRevisionExportEvent;
import open.dolphin.rest.dto.chart.ChartRevisionExportOrcaEvent;
import open.dolphin.rest.dto.chart.ChartRevisionExportPrescriptionEvent;
import open.dolphin.rest.dto.chart.ChartRevisionExportResponse;
import open.dolphin.rest.dto.chart.ChartRevisionExportRevision;

@ApplicationScoped
@Transactional
public class ChartRevisionExportService {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper().findAndRegisterModules();
    private static final String EXPORT_DENIED = "chart_revision_export_denied";
    private static final String EXPORT_INCONSISTENT = "chart_revision_export_inconsistent";
    private static final String NOT_FOUND = "chart_revision_export_not_found";
    private static final int EXPORT_SCHEMA_VERSION = 1;
    private static final String EXPORT_HASH_ALGORITHM = "SHA-256";
    private static final List<String> SUMMARY_ALLOWLIST = List.of(
            "status",
            "contentHash",
            "eventType",
            "newRevisionCreated",
            "hasReasonCode",
            "revisionId",
            "revisionNumber",
            "encounterId",
            "encounterDate",
            "departmentCode",
            "physicianCode",
            "insuranceCombinationNumber",
            "enteredByUserId",
            "entryMode",
            "delegatedByUserId",
            "finalizedByUserId",
            "hasSnapshotManifest",
            "hasOrcaAcceptanceId",
            "hasNoAcceptanceReason");
    private static final List<String> PRESCRIPTION_SUMMARY_ALLOWLIST = List.of(
            "status",
            "contentHash",
            "eventType",
            "revisionId",
            "revisionNumber",
            "prescriptionOrderId",
            "prescriptionRevisionId",
            "itemCount",
            "hasReasonCode",
            "newRevisionCreated",
            "sendable",
            "candidateStatus",
            "needsUserReview",
            "rawSensitiveFieldsExcluded");
    private static final List<String> ORCA_SUMMARY_ALLOWLIST = List.of(
            "status",
            "operationStatus",
            "transmissionStatus",
            "transportStatus",
            "apiResult",
            "apiResultMessageCategory",
            "needsUserReview",
            "retryCount",
            "attemptNumber",
            "requestHash",
            "responseHash",
            "contentHash",
            "reconciliationStatus",
            "matchedCount",
            "totalCount",
            "resendBlocked",
            "resendBlockReason",
            "rawSensitiveFieldsExcluded");
    private static final List<String> SNAPSHOT_MANIFEST_ALLOWLIST = List.of(
            "snapshotVersion",
            "source",
            "orcaPatientId",
            "encounterId",
            "encounterDate",
            "orcaAcceptanceId",
            "hasNoAcceptanceReason",
            "departmentCode",
            "physicianCode",
            "insuranceCombinationNumber",
            "patientSnapshotStatus",
            "acceptanceSnapshotStatus",
            "insuranceSnapshotStatus",
            "diseaseSnapshotStatus",
            "prescriptionCandidateSnapshotStatus",
            "orcaTransmissionSnapshotStatus",
            "patientSnapshotReference",
            "patientSnapshotHash",
            "acceptanceSnapshotReference",
            "acceptanceSnapshotHash",
            "insuranceSnapshotReference",
            "insuranceSnapshotHash",
            "diseaseSnapshotReference",
            "diseaseSnapshotHash",
            "prescriptionCandidateSnapshotReference",
            "prescriptionCandidateSnapshotHash",
            "prescriptionOrderId",
            "prescriptionOrderRevisionId",
            "prescriptionContentHash",
            "orcaOperationReference",
            "orcaOperationStatus",
            "orcaTransmissionReference",
            "orcaTransmissionHash",
            "orcaReconciliationStatus",
            "snapshotCapturedAt",
            "rawSensitiveFieldsExcluded");
    private static final Pattern AUTHORIZATION_LINE = Pattern.compile("(?i)authorization\\s*:\\s*[^\\r\\n]+");
    private static final Pattern COOKIE_LINE = Pattern.compile("(?i)cookie\\s*:\\s*[^\\r\\n]+");
    private static final Pattern RAW_XML = Pattern.compile("(?is)<\\?xml.*");
    private static final Pattern SOAP_BODY = Pattern.compile("(?is)<soap[^>]*>.*?</soap[^>]*>");

    @PersistenceContext(unitName = "opendolphinPU")
    private EntityManager em;

    public ChartRevisionExportResponse exportChart(long chartId, String facilityId) {
        ChartDocumentModel document = em.find(ChartDocumentModel.class, chartId);
        if (document == null) {
            throw restError(Response.Status.NOT_FOUND, NOT_FOUND, "Chart document was not found",
                    Map.of("chartId", chartId));
        }
        if (facilityId != null && !facilityId.isBlank() && !facilityId.equals(document.getFacilityId())) {
            throw restError(Response.Status.FORBIDDEN, EXPORT_DENIED,
                    "Chart export is not available for this facility",
                    Map.of("chartId", chartId));
        }

        List<ChartRevisionModel> revisions = em.createQuery(
                        "select r from ChartRevisionModel r where r.chartDocumentId = :chartId "
                                + "order by r.revisionNumber asc, r.id asc",
                        ChartRevisionModel.class)
                .setParameter("chartId", chartId)
                .getResultList();
        List<ChartRevisionEventModel> events = em.createQuery(
                        "select e from ChartRevisionEventModel e where e.chartDocumentId = :chartId "
                                + "order by e.occurredAt asc, e.id asc",
                        ChartRevisionEventModel.class)
                .setParameter("chartId", chartId)
                .getResultList();

        ChartRevisionExportResponse response = new ChartRevisionExportResponse();
        response.setChartId(chartId);
        response.setCurrentRevisionId(document.getCurrentRevisionId());
        response.setExportSchemaVersion(EXPORT_SCHEMA_VERSION);
        response.setExportHashAlgorithm(EXPORT_HASH_ALGORITHM);
        response.setRevisions(revisions.stream().map(this::toRevision).toList());
        response.setEvents(events.stream().map(this::toEvent).toList());
        response.setPrescriptionEvents(loadPrescriptionEvents(document.getFacilityId(), response.getRevisions()));
        response.setOrcaEvents(loadOrcaEvents(document.getFacilityId(), response.getRevisions()));
        ChartRevisionExportRevision currentRevision = resolveCurrentRevision(document, response);
        if (currentRevision != null) {
            response.setCurrentRevisionNumber(currentRevision.getRevisionNumber());
            response.setCurrentRevisionStatus(currentRevision.getStatus());
            response.setCurrentRevisionContentHash(currentRevision.getContentHash());
        }
        response.setRevisionCount(response.getRevisions().size());
        response.setEventCount(response.getEvents().size());
        response.setExportHash(sha256(writeJson(exportHashMaterial(response))));
        return response;
    }

    public String exportChartCsv(long chartId, String facilityId) {
        ChartRevisionExportResponse export = exportChart(chartId, facilityId);
        StringBuilder csv = new StringBuilder();
        appendCsvRow(csv,
                "recordType",
                "chartId",
                "currentRevisionId",
                "revisionId",
                "revisionNumber",
                "status",
                "eventId",
                "eventType",
                "previousRevisionId",
                "newRevisionId",
                "actorUserId",
                "occurredAt",
                "reasonCode",
                "reasonText",
                "contentHash",
                "summary");
        for (ChartRevisionExportRevision revision : export.getRevisions()) {
            appendCsvRow(csv,
                    "revision",
                    export.getChartId(),
                    export.getCurrentRevisionId(),
                    revision.getRevisionId(),
                    revision.getRevisionNumber(),
                    revision.getStatus(),
                    null,
                    null,
                    null,
                    null,
                    null,
                    revision.getFinalizedAt(),
                    null,
                    null,
                    revision.getContentHash(),
                    revisionSummary(revision));
        }
        for (ChartRevisionExportEvent event : export.getEvents()) {
            appendCsvRow(csv,
                    "event",
                    export.getChartId(),
                    export.getCurrentRevisionId(),
                    event.getChartRevisionId(),
                    null,
                    null,
                    event.getEventId(),
                    event.getEventType(),
                    event.getPreviousRevisionId(),
                    event.getNewRevisionId(),
                    event.getActorUserId(),
                    event.getOccurredAt(),
                    event.getReasonCode(),
                    event.getReasonText(),
                    event.getEventHash(),
                    flattenSummary(event.getBeforeSummary(), event.getAfterSummary()));
        }
        for (ChartRevisionExportPrescriptionEvent event : export.getPrescriptionEvents()) {
            appendCsvRow(csv,
                    "prescriptionEvent",
                    export.getChartId(),
                    export.getCurrentRevisionId(),
                    event.getChartRevisionId(),
                    event.getRevisionNumber(),
                    event.getStatus(),
                    event.getEventId(),
                    event.getEventType(),
                    null,
                    event.getPrescriptionRevisionId(),
                    event.getActorUserId(),
                    event.getOccurredAt(),
                    event.getReasonCode(),
                    event.getReasonText(),
                    firstNonBlank(event.getEventHash(), event.getContentHash()),
                    flattenSummary(event.getBeforeSummary(), event.getAfterSummary()));
        }
        for (ChartRevisionExportOrcaEvent event : export.getOrcaEvents()) {
            appendCsvRow(csv,
                    "orcaEvent",
                    export.getChartId(),
                    export.getCurrentRevisionId(),
                    event.getChartRevisionId(),
                    null,
                    event.getOperationStatus(),
                    event.getOrcaOperationId(),
                    event.getOperationType(),
                    null,
                    event.getLatestTransmissionId(),
                    event.getRequestedBy(),
                    firstNonBlank(event.getTransmissionStartedAt(), event.getRequestedAt()),
                    event.getReconciliationStatus(),
                    event.getTransportStatus(),
                    firstNonBlank(event.getTransmissionResponseHash(), event.getResponseHash()),
                    orcaEventSummary(event));
        }
        return csv.toString();
    }

    private ChartRevisionExportRevision resolveCurrentRevision(ChartDocumentModel document,
            ChartRevisionExportResponse response) {
        Long currentRevisionId = document.getCurrentRevisionId();
        if (currentRevisionId == null) {
            return null;
        }
        return response.getRevisions().stream()
                .filter(revision -> currentRevisionId.equals(revision.getRevisionId()))
                .findFirst()
                .orElseThrow(() -> restError(Response.Status.CONFLICT, EXPORT_INCONSISTENT,
                        "Chart revision export is inconsistent",
                        Map.of("chartId", document.getId(), "currentRevisionId", currentRevisionId)));
    }

    private ChartRevisionExportRevision toRevision(ChartRevisionModel revision) {
        ChartRevisionExportRevision dto = new ChartRevisionExportRevision();
        dto.setRevisionId(revision.getId());
        dto.setRevisionNumber(revision.getRevisionNumber());
        dto.setStatus(revision.getStatus() != null ? revision.getStatus().name() : null);
        dto.setSourceDocumentId(revision.getSourceDocumentId());
        dto.setTitle(redactUnsafeText(revision.getTitle()));
        dto.setContentHash(revision.getContentHash());
        dto.setEncounterId(redactUnsafeText(revision.getEncounterId()));
        dto.setEncounterDate(revision.getEncounterDate() != null ? revision.getEncounterDate().toString() : null);
        dto.setDepartmentCode(redactUnsafeText(revision.getDepartmentCode()));
        dto.setPhysicianCode(redactUnsafeText(revision.getPhysicianCode()));
        dto.setInsuranceCombinationNumber(redactUnsafeText(revision.getInsuranceCombinationNumber()));
        dto.setSnapshotManifest(sanitizeSnapshotManifest(revision.getSnapshotManifestJson()));
        dto.setEnteredByUserId(revision.getEnteredByUserId());
        dto.setEntryMode(revision.getEntryMode() != null ? revision.getEntryMode().name() : null);
        dto.setDelegatedByUserId(revision.getDelegatedByUserId());
        dto.setFinalizedByUserId(revision.getFinalizedByUserId());
        dto.setFinalizedAt(revision.getFinalizedAt() != null ? revision.getFinalizedAt().toString() : null);
        return dto;
    }

    private ChartRevisionExportEvent toEvent(ChartRevisionEventModel event) {
        ChartRevisionExportEvent dto = new ChartRevisionExportEvent();
        dto.setEventId(event.getId());
        dto.setChartRevisionId(event.getChartRevisionId());
        dto.setPreviousRevisionId(event.getPreviousRevisionId());
        dto.setNewRevisionId(event.getNewRevisionId());
        dto.setEventType(event.getEventType() != null ? event.getEventType().name() : null);
        dto.setActorUserId(event.getActorUserId());
        dto.setOccurredAt(event.getOccurredAt() != null ? event.getOccurredAt().toString() : null);
        dto.setReasonCode(redactUnsafeText(event.getReasonCode()));
        dto.setReasonText(redactUnsafeText(event.getReasonText()));
        dto.setBeforeSummary(sanitizeSummary(event.getBeforeSummaryJson()));
        dto.setAfterSummary(sanitizeSummary(event.getAfterSummaryJson()));
        dto.setEventHash(event.getEventHash());
        return dto;
    }

    private List<ChartRevisionExportPrescriptionEvent> loadPrescriptionEvents(String facilityId,
            List<ChartRevisionExportRevision> revisions) {
        if (facilityId == null || facilityId.isBlank() || revisions == null || revisions.isEmpty()) {
            return List.of();
        }
        List<String> chartRevisionIds = revisions.stream()
                .map(ChartRevisionExportRevision::getRevisionId)
                .filter(id -> id != null)
                .map(String::valueOf)
                .toList();
        if (chartRevisionIds.isEmpty()) {
            return List.of();
        }
        Query query = em.createNativeQuery("""
                SELECT po.prescription_order_id,
                       pr.prescription_order_revision_id,
                       po.chart_revision_id,
                       pr.revision_number,
                       pr.status,
                       pr.content_hash,
                       pe.prescription_order_event_id,
                       pe.event_type,
                       pe.actor_user_id,
                       pe.occurred_at,
                       pe.reason_code,
                       pe.reason_text,
                       CAST(pe.before_summary_json AS text),
                       CAST(pe.after_summary_json AS text),
                       pe.event_hash
                  FROM opendolphin.prescription_order po
                  JOIN opendolphin.prescription_order_event pe
                    ON pe.prescription_order_id = po.prescription_order_id
                  LEFT JOIN opendolphin.prescription_order_revision pr
                    ON pr.prescription_order_revision_id = pe.prescription_order_revision_id
                 WHERE po.facility_id = :facilityId
                   AND po.chart_revision_id IN (:chartRevisionIds)
                 ORDER BY po.chart_revision_id ASC, pe.occurred_at ASC, pe.prescription_order_event_id ASC
                """);
        query.setParameter("facilityId", facilityId);
        query.setParameter("chartRevisionIds", chartRevisionIds);
        @SuppressWarnings("unchecked")
        List<Object[]> rows = query.getResultList();
        return rows.stream().map(this::toPrescriptionEvent).toList();
    }

    private ChartRevisionExportPrescriptionEvent toPrescriptionEvent(Object[] row) {
        ChartRevisionExportPrescriptionEvent dto = new ChartRevisionExportPrescriptionEvent();
        dto.setPrescriptionOrderId(longValue(row[0]));
        dto.setPrescriptionRevisionId(longValue(row[1]));
        dto.setChartRevisionId(textValue(row[2]));
        dto.setRevisionNumber(integerValue(row[3]));
        dto.setStatus(redactUnsafeText(textValue(row[4])));
        dto.setContentHash(redactUnsafeText(textValue(row[5])));
        dto.setEventId(longValue(row[6]));
        dto.setEventType(redactUnsafeText(textValue(row[7])));
        dto.setActorUserId(redactUnsafeText(textValue(row[8])));
        dto.setOccurredAt(row[9] != null ? row[9].toString() : null);
        dto.setReasonCode(redactUnsafeText(textValue(row[10])));
        dto.setReasonText(redactUnsafeText(textValue(row[11])));
        dto.setBeforeSummary(sanitizeObject(textValue(row[12]), PRESCRIPTION_SUMMARY_ALLOWLIST));
        dto.setAfterSummary(sanitizeObject(textValue(row[13]), PRESCRIPTION_SUMMARY_ALLOWLIST));
        dto.setEventHash(redactUnsafeText(textValue(row[14])));
        return dto;
    }

    private List<ChartRevisionExportOrcaEvent> loadOrcaEvents(String facilityId,
            List<ChartRevisionExportRevision> revisions) {
        if (facilityId == null || facilityId.isBlank() || revisions == null || revisions.isEmpty()) {
            return List.of();
        }
        List<String> chartRevisionIds = revisions.stream()
                .map(ChartRevisionExportRevision::getRevisionId)
                .filter(id -> id != null)
                .map(String::valueOf)
                .toList();
        if (chartRevisionIds.isEmpty()) {
            return List.of();
        }
        Query query = em.createNativeQuery("""
                SELECT oo.orca_operation_id,
                       oo.chart_revision_id,
                       oo.operation_scope,
                       oo.operation_type,
                       oo.source_api,
                       oo.operation_status,
                       oo.requested_by,
                       oo.requested_at,
                       oo.completed_at,
                       oo.request_hash,
                       oo.response_hash,
                       oo.retry_count,
                       oo.needs_user_review,
                       ot.orca_transmission_id,
                       ot.transmission_status,
                       ot.transport_status,
                       ot.attempt_number,
                       ot.started_at,
                       ot.completed_at,
                       ot.request_hash,
                       ot.response_hash,
                       rr.reconciliation_status,
                       CAST(oo.response_summary_json AS text),
                       CAST(ot.response_summary_json AS text)
                  FROM opendolphin.orca_operation oo
                  LEFT JOIN LATERAL (
                      SELECT tx.orca_transmission_id,
                             tx.transmission_status,
                             tx.transport_status,
                             tx.attempt_number,
                             tx.started_at,
                             tx.completed_at,
                             tx.request_hash,
                             tx.response_hash,
                             tx.response_summary_json
                        FROM opendolphin.orca_transmission tx
                       WHERE tx.orca_operation_id = oo.orca_operation_id
                         AND tx.facility_id = oo.facility_id
                       ORDER BY tx.attempt_number DESC, tx.started_at DESC, tx.orca_transmission_id DESC
                       LIMIT 1
                  ) ot ON TRUE
                  LEFT JOIN LATERAL (
                      SELECT rc.reconciliation_status
                        FROM opendolphin.orca_reconciliation_result rc
                       WHERE rc.orca_operation_id = oo.orca_operation_id
                         AND rc.facility_id = oo.facility_id
                       ORDER BY rc.reconciled_at DESC, rc.orca_reconciliation_result_id DESC
                       LIMIT 1
                  ) rr ON TRUE
                 WHERE oo.facility_id = :facilityId
                   AND oo.chart_revision_id IN (:chartRevisionIds)
                 ORDER BY oo.chart_revision_id ASC, oo.requested_at ASC, oo.orca_operation_id ASC
                """);
        query.setParameter("facilityId", facilityId);
        query.setParameter("chartRevisionIds", chartRevisionIds);
        @SuppressWarnings("unchecked")
        List<Object[]> rows = query.getResultList();
        return rows.stream().map(this::toOrcaEvent).toList();
    }

    private ChartRevisionExportOrcaEvent toOrcaEvent(Object[] row) {
        ChartRevisionExportOrcaEvent dto = new ChartRevisionExportOrcaEvent();
        dto.setOrcaOperationId(longValue(row[0]));
        dto.setChartRevisionId(redactUnsafeText(textValue(row[1])));
        dto.setOperationScope(redactUnsafeText(textValue(row[2])));
        dto.setOperationType(redactUnsafeText(textValue(row[3])));
        dto.setSourceApi(redactUnsafeText(textValue(row[4])));
        dto.setOperationStatus(redactUnsafeText(textValue(row[5])));
        dto.setRequestedBy(redactUnsafeText(textValue(row[6])));
        dto.setRequestedAt(row[7] != null ? row[7].toString() : null);
        dto.setCompletedAt(row[8] != null ? row[8].toString() : null);
        dto.setRequestHash(redactUnsafeText(textValue(row[9])));
        dto.setResponseHash(redactUnsafeText(textValue(row[10])));
        dto.setRetryCount(integerValue(row[11]));
        dto.setNeedsUserReview(booleanValue(row[12]));
        dto.setLatestTransmissionId(longValue(row[13]));
        dto.setTransmissionStatus(redactUnsafeText(textValue(row[14])));
        dto.setTransportStatus(redactUnsafeText(textValue(row[15])));
        dto.setAttemptNumber(integerValue(row[16]));
        dto.setTransmissionStartedAt(row[17] != null ? row[17].toString() : null);
        dto.setTransmissionCompletedAt(row[18] != null ? row[18].toString() : null);
        dto.setTransmissionRequestHash(redactUnsafeText(textValue(row[19])));
        dto.setTransmissionResponseHash(redactUnsafeText(textValue(row[20])));
        dto.setReconciliationStatus(redactUnsafeText(textValue(row[21])));
        dto.setOperationSummary(sanitizeObject(textValue(row[22]), ORCA_SUMMARY_ALLOWLIST));
        dto.setTransmissionSummary(sanitizeObject(textValue(row[23]), ORCA_SUMMARY_ALLOWLIST));
        return dto;
    }

    private Map<String, Object> sanitizeSummary(String summaryJson) {
        return sanitizeObject(summaryJson, SUMMARY_ALLOWLIST);
    }

    private Map<String, Object> sanitizeSnapshotManifest(String snapshotManifestJson) {
        return sanitizeObject(snapshotManifestJson, SNAPSHOT_MANIFEST_ALLOWLIST);
    }

    private Map<String, Object> sanitizeObject(String json, List<String> allowlist) {
        if (json == null || json.isBlank()) {
            return Map.of();
        }
        try {
            JsonNode root = OBJECT_MAPPER.readTree(json);
            if (!root.isObject()) {
                return Map.of();
            }
            Map<String, Object> sanitized = new LinkedHashMap<>();
            for (String key : allowlist) {
                JsonNode node = root.get(key);
                if (node != null) {
                    Object value = scalarValue(node);
                    if (value != null) {
                        sanitized.put(key, value);
                    }
                }
            }
            return sanitized;
        } catch (JsonProcessingException ex) {
            return Map.of("summaryParseError", true);
        }
    }

    private Object scalarValue(JsonNode node) {
        if (node == null || node.isNull()) {
            return null;
        }
        if (node.isTextual()) {
            return redactUnsafeText(node.asText());
        }
        if (node.isBoolean()) {
            return node.asBoolean();
        }
        if (node.isIntegralNumber()) {
            return node.asLong();
        }
        if (node.isFloatingPointNumber()) {
            return node.asDouble();
        }
        if (node.isArray()) {
            List<Object> values = new ArrayList<>();
            node.forEach(item -> {
                Object value = scalarValue(item);
                if (value != null) {
                    values.add(value);
                }
            });
            return values;
        }
        return null;
    }

    private String redactUnsafeText(String value) {
        if (value == null) {
            return null;
        }
        String sanitized = AUTHORIZATION_LINE.matcher(value).replaceAll("Authorization: [redacted]");
        sanitized = COOKIE_LINE.matcher(sanitized).replaceAll("Cookie: [redacted]");
        sanitized = SOAP_BODY.matcher(sanitized).replaceAll("[redacted-soap-body]");
        sanitized = RAW_XML.matcher(sanitized).replaceAll("[redacted-xml-body]");
        return sanitized;
    }

    private String revisionSummary(ChartRevisionExportRevision revision) {
        StringJoiner joiner = new StringJoiner("; ");
        addSummary(joiner, "title", revision.getTitle());
        addSummary(joiner, "encounterId", revision.getEncounterId());
        addSummary(joiner, "encounterDate", revision.getEncounterDate());
        addSummary(joiner, "departmentCode", revision.getDepartmentCode());
        addSummary(joiner, "physicianCode", revision.getPhysicianCode());
        addSummary(joiner, "insuranceCombinationNumber", revision.getInsuranceCombinationNumber());
        flattenSummaryMap(joiner, "snapshot", revision.getSnapshotManifest());
        addSummary(joiner, "enteredByUserId", revision.getEnteredByUserId());
        addSummary(joiner, "entryMode", revision.getEntryMode());
        addSummary(joiner, "delegatedByUserId", revision.getDelegatedByUserId());
        addSummary(joiner, "finalizedByUserId", revision.getFinalizedByUserId());
        return joiner.toString();
    }

    private String flattenSummary(Map<String, Object> before, Map<String, Object> after) {
        StringJoiner joiner = new StringJoiner("; ");
        flattenSummaryMap(joiner, "before", before);
        flattenSummaryMap(joiner, "after", after);
        return joiner.toString();
    }

    private String orcaEventSummary(ChartRevisionExportOrcaEvent event) {
        StringJoiner joiner = new StringJoiner("; ");
        addSummary(joiner, "operationScope", event.getOperationScope());
        addSummary(joiner, "sourceApi", event.getSourceApi());
        addSummary(joiner, "requestHash", event.getRequestHash());
        addSummary(joiner, "responseHash", event.getResponseHash());
        addSummary(joiner, "retryCount", event.getRetryCount());
        addSummary(joiner, "needsUserReview", event.getNeedsUserReview());
        addSummary(joiner, "attemptNumber", event.getAttemptNumber());
        addSummary(joiner, "transmissionStatus", event.getTransmissionStatus());
        addSummary(joiner, "transportStatus", event.getTransportStatus());
        addSummary(joiner, "transmissionRequestHash", event.getTransmissionRequestHash());
        addSummary(joiner, "transmissionResponseHash", event.getTransmissionResponseHash());
        flattenSummaryMap(joiner, "operation", event.getOperationSummary());
        flattenSummaryMap(joiner, "transmission", event.getTransmissionSummary());
        return joiner.toString();
    }

    private void flattenSummaryMap(StringJoiner joiner, String prefix, Map<String, Object> summary) {
        if (summary == null || summary.isEmpty()) {
            return;
        }
        summary.forEach((key, value) -> addSummary(joiner, prefix + "." + key, value));
    }

    private void addSummary(StringJoiner joiner, String key, Object value) {
        if (value != null) {
            joiner.add(key + "=" + value);
        }
    }

    private void appendCsvRow(StringBuilder csv, Object... values) {
        for (int i = 0; i < values.length; i++) {
            if (i > 0) {
                csv.append(',');
            }
            csv.append(csvValue(values[i]));
        }
        csv.append('\n');
    }

    private String csvValue(Object value) {
        if (value == null) {
            return "";
        }
        String text = neutralizeCsvFormula(String.valueOf(value));
        return '"' + text.replace("\"", "\"\"") + '"';
    }

    private String neutralizeCsvFormula(String value) {
        if (value == null || value.isEmpty()) {
            return value;
        }
        char first = value.charAt(0);
        if (first == '=' || first == '+' || first == '-' || first == '@' || first == '\t') {
            return "'" + value;
        }
        return value;
    }

    private Map<String, Object> exportHashMaterial(ChartRevisionExportResponse response) {
        Map<String, Object> material = new LinkedHashMap<>();
        material.put("exportSchemaVersion", response.getExportSchemaVersion());
        material.put("exportHashAlgorithm", response.getExportHashAlgorithm());
        material.put("chartId", response.getChartId());
        material.put("currentRevisionId", response.getCurrentRevisionId());
        material.put("currentRevisionNumber", response.getCurrentRevisionNumber());
        material.put("currentRevisionStatus", response.getCurrentRevisionStatus());
        material.put("currentRevisionContentHash", response.getCurrentRevisionContentHash());
        material.put("revisionCount", response.getRevisionCount());
        material.put("eventCount", response.getEventCount());
        material.put("revisions", response.getRevisions().stream().map(this::revisionHashMaterial).toList());
        material.put("events", response.getEvents().stream().map(this::eventHashMaterial).toList());
        material.put("prescriptionEvents",
                response.getPrescriptionEvents().stream().map(this::prescriptionEventHashMaterial).toList());
        material.put("orcaEvents",
                response.getOrcaEvents().stream().map(this::orcaEventHashMaterial).toList());
        return material;
    }

    private Map<String, Object> revisionHashMaterial(ChartRevisionExportRevision revision) {
        Map<String, Object> material = new LinkedHashMap<>();
        material.put("revisionId", revision.getRevisionId());
        material.put("revisionNumber", revision.getRevisionNumber());
        material.put("status", revision.getStatus());
        material.put("sourceDocumentId", revision.getSourceDocumentId());
        material.put("title", revision.getTitle());
        material.put("contentHash", revision.getContentHash());
        material.put("encounterId", revision.getEncounterId());
        material.put("encounterDate", revision.getEncounterDate());
        material.put("departmentCode", revision.getDepartmentCode());
        material.put("physicianCode", revision.getPhysicianCode());
        material.put("insuranceCombinationNumber", revision.getInsuranceCombinationNumber());
        material.put("snapshotManifest", revision.getSnapshotManifest());
        material.put("enteredByUserId", revision.getEnteredByUserId());
        material.put("entryMode", revision.getEntryMode());
        material.put("delegatedByUserId", revision.getDelegatedByUserId());
        material.put("finalizedByUserId", revision.getFinalizedByUserId());
        material.put("finalizedAt", revision.getFinalizedAt());
        return material;
    }

    private Map<String, Object> eventHashMaterial(ChartRevisionExportEvent event) {
        Map<String, Object> material = new LinkedHashMap<>();
        material.put("eventId", event.getEventId());
        material.put("chartRevisionId", event.getChartRevisionId());
        material.put("previousRevisionId", event.getPreviousRevisionId());
        material.put("newRevisionId", event.getNewRevisionId());
        material.put("eventType", event.getEventType());
        material.put("actorUserId", event.getActorUserId());
        material.put("occurredAt", event.getOccurredAt());
        material.put("reasonCode", event.getReasonCode());
        material.put("reasonText", event.getReasonText());
        material.put("beforeSummary", event.getBeforeSummary());
        material.put("afterSummary", event.getAfterSummary());
        material.put("eventHash", event.getEventHash());
        return material;
    }

    private Map<String, Object> prescriptionEventHashMaterial(ChartRevisionExportPrescriptionEvent event) {
        Map<String, Object> material = new LinkedHashMap<>();
        material.put("prescriptionOrderId", event.getPrescriptionOrderId());
        material.put("prescriptionRevisionId", event.getPrescriptionRevisionId());
        material.put("chartRevisionId", event.getChartRevisionId());
        material.put("revisionNumber", event.getRevisionNumber());
        material.put("status", event.getStatus());
        material.put("contentHash", event.getContentHash());
        material.put("eventId", event.getEventId());
        material.put("eventType", event.getEventType());
        material.put("actorUserId", event.getActorUserId());
        material.put("occurredAt", event.getOccurredAt());
        material.put("reasonCode", event.getReasonCode());
        material.put("reasonText", event.getReasonText());
        material.put("beforeSummary", event.getBeforeSummary());
        material.put("afterSummary", event.getAfterSummary());
        material.put("eventHash", event.getEventHash());
        return material;
    }

    private Map<String, Object> orcaEventHashMaterial(ChartRevisionExportOrcaEvent event) {
        Map<String, Object> material = new LinkedHashMap<>();
        material.put("orcaOperationId", event.getOrcaOperationId());
        material.put("chartRevisionId", event.getChartRevisionId());
        material.put("operationScope", event.getOperationScope());
        material.put("operationType", event.getOperationType());
        material.put("sourceApi", event.getSourceApi());
        material.put("operationStatus", event.getOperationStatus());
        material.put("requestedBy", event.getRequestedBy());
        material.put("requestedAt", event.getRequestedAt());
        material.put("completedAt", event.getCompletedAt());
        material.put("requestHash", event.getRequestHash());
        material.put("responseHash", event.getResponseHash());
        material.put("retryCount", event.getRetryCount());
        material.put("needsUserReview", event.getNeedsUserReview());
        material.put("latestTransmissionId", event.getLatestTransmissionId());
        material.put("transmissionStatus", event.getTransmissionStatus());
        material.put("transportStatus", event.getTransportStatus());
        material.put("attemptNumber", event.getAttemptNumber());
        material.put("transmissionStartedAt", event.getTransmissionStartedAt());
        material.put("transmissionCompletedAt", event.getTransmissionCompletedAt());
        material.put("transmissionRequestHash", event.getTransmissionRequestHash());
        material.put("transmissionResponseHash", event.getTransmissionResponseHash());
        material.put("reconciliationStatus", event.getReconciliationStatus());
        material.put("operationSummary", event.getOperationSummary());
        material.put("transmissionSummary", event.getTransmissionSummary());
        return material;
    }

    private Long longValue(Object value) {
        if (value instanceof Number number) {
            return number.longValue();
        }
        if (value == null) {
            return null;
        }
        try {
            return Long.valueOf(String.valueOf(value));
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private Integer integerValue(Object value) {
        if (value instanceof Number number) {
            return number.intValue();
        }
        if (value == null) {
            return null;
        }
        try {
            return Integer.valueOf(String.valueOf(value));
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private String textValue(Object value) {
        return value != null ? String.valueOf(value) : null;
    }

    private Boolean booleanValue(Object value) {
        if (value instanceof Boolean bool) {
            return bool;
        }
        if (value == null) {
            return null;
        }
        return Boolean.valueOf(String.valueOf(value));
    }

    private String firstNonBlank(String first, String second) {
        if (first != null && !first.isBlank()) {
            return first;
        }
        if (second != null && !second.isBlank()) {
            return second;
        }
        return null;
    }

    private String writeJson(Object value) {
        try {
            return OBJECT_MAPPER.writeValueAsString(value);
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("failed to write chart revision export hash material", ex);
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

    private WebApplicationException restError(Response.Status status, String code, String message,
            Map<String, ?> details) {
        return AbstractResource.restError(null, status, code, message, details, null);
    }
}
