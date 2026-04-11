package open.dolphin.rest.orca;

import jakarta.inject.Inject;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import open.dolphin.audit.AuditEventEnvelope;
import open.dolphin.infomodel.ModelUtils;
import open.dolphin.infomodel.PatientModel;
import open.dolphin.infomodel.SimpleAddressModel;
import open.dolphin.rest.AbstractResource;
import open.dolphin.rest.orca.AbstractOrcaRestResource;
import open.dolphin.rest.dto.outpatient.OutpatientFlagResponse;
import open.dolphin.rest.dto.outpatient.PatientOutpatientResponse;
import open.dolphin.security.audit.AuditEventPayload;
import open.dolphin.security.audit.SessionAuditDispatcher;
import open.dolphin.session.PatientServiceBean;
import open.dolphin.session.PatientServiceBean.PatientSearchType;

/**
 * Local-only patient search endpoint served at `/api/local/patients/search`.
 */
@Path("/local/patients/search")
public class OrcaPatientLocalSearchResource extends AbstractResource {

    private static final String DATA_SOURCE = "local";
    private static final String ROUTE_NAMESPACE = "local";
    @Inject
    private PatientServiceBean patientServiceBean;

    @Inject
    private SessionAuditDispatcher sessionAuditDispatcher;

    @POST
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public PatientOutpatientResponse postPatients(@Context HttpServletRequest request, Map<String, Object> payload) {
        String runId = AbstractOrcaRestResource.resolveRunIdValue(request);
        String traceId = resolveTraceId(request);
        String requestId = resolveRequestId(request, traceId);

        String resourcePath = resolveResourcePath(request, getDefaultResourcePath());
        String facilityId = requireActorFacility(request);
        String keyword = payload != null ? toString(payload.get("keyword")) : null;
        PatientSearchType searchType = resolveSearchType(payload, keyword);
        String paymentMode = payload != null ? toString(payload.get("paymentMode")) : null;

        List<PatientModel> models = resolvePatients(facilityId, keyword, searchType);
        List<PatientOutpatientResponse.PatientRecord> records = new ArrayList<>();
        for (PatientModel model : models) {
            PatientOutpatientResponse.PatientRecord record = toRecord(model);
            if (record != null) {
                records.add(record);
            }
        }

        PatientOutpatientResponse response = new PatientOutpatientResponse();
        response.setRunId(runId);
        response.setTraceId(traceId);
        response.setRequestId(requestId);
        response.setRouteNamespace(ROUTE_NAMESPACE);
        response.setDataSource(DATA_SOURCE);
        response.setDataSourceTransition(DATA_SOURCE);
        response.setCacheHit(false);
        response.setMissingMaster(false);
        response.setFallbackUsed(false);
        response.setFetchedAt(Instant.now().toString());
        response.setRecordsReturned(records.size());
        response.setPatients(records);
        response.setApiResult("00");
        response.setApiResultMessage("OK");

        Map<String, Object> details = new LinkedHashMap<>();
        if (facilityId != null && !facilityId.isBlank()) {
            details.put("facilityId", facilityId);
        }
        details.put("resource", resourcePath);
        details.put("routeNamespace", ROUTE_NAMESPACE);
        details.put("runId", runId);
        details.put("dataSource", DATA_SOURCE);
        details.put("dataSourceTransition", DATA_SOURCE);
        details.put("cacheHit", false);
        details.put("missingMaster", false);
        details.put("fallbackUsed", false);
        details.put("fetchedAt", response.getFetchedAt());
        details.put("recordsReturned", records.size());
        String operation = getOperationName();
        if (operation != null && !operation.isBlank()) {
            details.put("operation", operation);
        }
        if (keyword != null && !keyword.isBlank()) {
            details.put("keyword", keyword);
        }
        if (searchType != null) {
            details.put("searchType", searchType.name().toLowerCase());
        }
        if (paymentMode != null && !paymentMode.isBlank()) {
            details.put("paymentMode", paymentMode);
        }

        OutpatientFlagResponse.AuditEvent auditEvent = new OutpatientFlagResponse.AuditEvent();
        auditEvent.setAction(getAuditAction());
        auditEvent.setResource(resourcePath);
        auditEvent.setOutcome("SUCCESS");
        auditEvent.setDetails(details);
        auditEvent.setTraceId(traceId);
        auditEvent.setRequestId(requestId);
        response.setAuditEvent(auditEvent);

        dispatchAuditEvent(request, auditEvent);
        return response;
    }

    private void dispatchAuditEvent(HttpServletRequest request, OutpatientFlagResponse.AuditEvent auditEvent) {
        if (sessionAuditDispatcher == null || auditEvent == null) {
            return;
        }
        AuditEventPayload payload = new AuditEventPayload();
        payload.setAction(auditEvent.getAction());
        payload.setResource(auditEvent.getResource());
        payload.setDetails(auditEvent.getDetails());
        payload.setTraceId(auditEvent.getTraceId());
        payload.setRequestId(auditEvent.getRequestId());
        if (request != null) {
            payload.setActorId(request.getRemoteUser());
            payload.setIpAddress(request.getRemoteAddr());
            payload.setUserAgent(request.getHeader("User-Agent"));
        }
        sessionAuditDispatcher.record(payload, AuditEventEnvelope.Outcome.SUCCESS, null, null);
    }

    private String resolveRequestId(HttpServletRequest request, String traceId) {
        if (request != null) {
            String header = request.getHeader("X-Request-Id");
            if (header != null && !header.isBlank()) {
                return header.trim();
            }
        }
        return traceId;
    }

    protected String getDefaultResourcePath() {
        return "/api/local/patients/search";
    }

    protected String getAuditAction() {
        return "LOCAL_PATIENT_SEARCH";
    }

    protected String getOperationName() {
        return "patient_local_search";
    }

    protected String resolveResourcePath(HttpServletRequest request, String fallback) {
        if (request != null) {
            String uri = request.getRequestURI();
            if (uri != null && !uri.isBlank()) {
                return uri;
            }
        }
        return fallback;
    }

    private List<PatientModel> resolvePatients(String facilityId, String keyword, PatientSearchType searchType) {
        if (patientServiceBean == null) {
            return List.of();
        }
        if (facilityId == null || facilityId.isBlank()) {
            return List.of();
        }
        if (keyword == null || keyword.isBlank()) {
            return List.of();
        }
        return patientServiceBean.searchPatients(facilityId, searchType, keyword);
    }

    private PatientSearchType resolveSearchType(Map<String, Object> payload, String keyword) {
        PatientSearchType explicit = parseSearchType(payload != null ? toString(payload.get("searchType")) : null);
        if (explicit != null) {
            return explicit;
        }
        if (keyword == null || keyword.isBlank()) {
            return null;
        }
        if (keyword.matches("\\d+")) {
            return PatientSearchType.PATIENT_ID;
        }
        if (keyword.matches("[ぁ-んァ-ヶー]+")) {
            return PatientSearchType.KANA;
        }
        return PatientSearchType.NAME;
    }

    private PatientSearchType parseSearchType(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        return switch (raw.trim().toLowerCase()) {
            case "name" -> PatientSearchType.NAME;
            case "kana" -> PatientSearchType.KANA;
            case "patientid", "patient-id", "id" -> PatientSearchType.PATIENT_ID;
            case "telephone", "phone" -> PatientSearchType.TELEPHONE;
            case "zipcode", "zip" -> PatientSearchType.ZIPCODE;
            default -> null;
        };
    }

    private PatientOutpatientResponse.PatientRecord toRecord(PatientModel model) {
        if (model == null) {
            return null;
        }
        PatientOutpatientResponse.PatientRecord record = new PatientOutpatientResponse.PatientRecord();
        record.setPatientId(model.getPatientId());
        record.setName(model.getFullName());
        record.setKana(model.getKanaName());
        record.setBirthDate(ModelUtils.formatDate(model.getBirthday()));
        record.setSex(model.getGender());
        record.setMemo(model.getMemo());
        record.setLastVisit(model.getLastVisitAt() != null ? ModelUtils.formatDate(model.getLastVisitAt().toLocalDate()) : null);
        String phone = firstNonBlank(model.getTelephone(), model.getMobilePhone());
        record.setPhone(phone);
        SimpleAddressModel address = model.getAddress();
        if (address != null) {
            record.setZip(address.getZipCode());
            record.setAddress(address.getAddress());
        }
        return record;
    }

    private String toString(Object value) {
        return value instanceof String text ? text : null;
    }

    private String firstNonBlank(String... values) {
        if (values == null) {
            return null;
        }
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return null;
    }
}
