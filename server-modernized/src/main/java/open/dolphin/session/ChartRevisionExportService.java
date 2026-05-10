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
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
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
            "hasOrcaAcceptanceId",
            "hasNoAcceptanceReason");
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
        return response;
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
        dto.setEnteredByUserId(revision.getEnteredByUserId());
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
        if (summaryJson == null || summaryJson.isBlank()) {
            return Map.of();
        }
        try {
            JsonNode root = OBJECT_MAPPER.readTree(summaryJson);
            if (!root.isObject()) {
                return Map.of();
            }
            Map<String, Object> sanitized = new LinkedHashMap<>();
            root.fields().forEachRemaining(entry -> {
                if (SUMMARY_ALLOWLIST.contains(entry.getKey())) {
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

    private WebApplicationException restError(Response.Status status, String code, String message,
            Map<String, ?> details) {
        return AbstractResource.restError(null, status, code, message, details, null);
    }
}
