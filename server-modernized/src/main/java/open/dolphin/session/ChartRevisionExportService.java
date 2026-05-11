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
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.StringJoiner;
import java.util.regex.Pattern;
import open.dolphin.infomodel.ChartDocumentModel;
import open.dolphin.infomodel.ChartRevisionEventModel;
import open.dolphin.infomodel.ChartRevisionModel;
import open.dolphin.rest.AbstractResource;
import open.dolphin.rest.dto.chart.ChartRevisionExportEvent;
import open.dolphin.rest.dto.chart.ChartRevisionExportResponse;
import open.dolphin.rest.dto.chart.ChartRevisionExportRevision;

@ApplicationScoped
@Transactional
public class ChartRevisionExportService {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper().findAndRegisterModules();
    private static final String EXPORT_DENIED = "chart_revision_export_denied";
    private static final String NOT_FOUND = "chart_revision_export_not_found";
    private static final Set<String> SUMMARY_ALLOWLIST = Set.of(
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
    private static final Set<String> SNAPSHOT_MANIFEST_ALLOWLIST = Set.of(
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
            "orcaTransmissionSnapshotStatus");
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
        response.setRevisions(revisions.stream().map(this::toRevision).toList());
        response.setEvents(events.stream().map(this::toEvent).toList());
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
        return csv.toString();
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

    private Map<String, Object> sanitizeSummary(String summaryJson) {
        return sanitizeObject(summaryJson, SUMMARY_ALLOWLIST);
    }

    private Map<String, Object> sanitizeSnapshotManifest(String snapshotManifestJson) {
        return sanitizeObject(snapshotManifestJson, SNAPSHOT_MANIFEST_ALLOWLIST);
    }

    private Map<String, Object> sanitizeObject(String json, Set<String> allowlist) {
        if (json == null || json.isBlank()) {
            return Map.of();
        }
        try {
            JsonNode root = OBJECT_MAPPER.readTree(json);
            if (!root.isObject()) {
                return Map.of();
            }
            Map<String, Object> sanitized = new LinkedHashMap<>();
            root.fields().forEachRemaining(entry -> {
                if (allowlist.contains(entry.getKey())) {
                    Object value = scalarValue(entry.getValue());
                    if (value != null) {
                        sanitized.put(entry.getKey(), value);
                    }
                }
            });
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
        material.put("chartId", response.getChartId());
        material.put("currentRevisionId", response.getCurrentRevisionId());
        material.put("revisions", response.getRevisions().stream().map(this::revisionHashMaterial).toList());
        material.put("events", response.getEvents().stream().map(this::eventHashMaterial).toList());
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
