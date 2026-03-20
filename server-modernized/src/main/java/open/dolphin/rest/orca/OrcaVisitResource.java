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
import java.time.LocalDate;
import java.util.Locale;
import java.util.Map;
import java.util.logging.Level;
import java.util.logging.Logger;
import open.dolphin.audit.AuditEventEnvelope;
import open.dolphin.orca.service.OrcaWrapperService;
import open.dolphin.rest.OrcaApiProxySupport;
import open.dolphin.rest.ReceptionRealtimeSseSupport;
import open.dolphin.rest.dto.orca.VisitMutationRequest;
import open.dolphin.rest.dto.orca.VisitMutationResponse;
import open.dolphin.rest.dto.orca.VisitPatientListRequest;
import open.dolphin.rest.dto.orca.VisitPatientListResponse;
import open.dolphin.session.framework.SessionOperation;

/**
 * REST wrapper for acceptmodv2 (reception mutations).
 */
@Path("/orca/visits")
@SessionOperation
public class OrcaVisitResource extends AbstractOrcaWrapperResource {

    private static final Logger LOGGER = Logger.getLogger(OrcaVisitResource.class.getName());
    private static final String OPERATION_VISIT_MUTATION = "visit_mutation";
    private static final String OPERATION_VISIT_LIST = "visit_list";

    private OrcaWrapperService wrapperService;
    private ReceptionRealtimeSseSupport receptionRealtimeSseSupport;

    public OrcaVisitResource() {
    }

    @Inject
    public OrcaVisitResource(OrcaWrapperService wrapperService) {
        this.wrapperService = wrapperService;
    }

    @Inject
    void setReceptionRealtimeSseSupport(ReceptionRealtimeSseSupport receptionRealtimeSseSupport) {
        this.receptionRealtimeSseSupport = receptionRealtimeSseSupport;
    }

    @POST
    @Path("/mutation")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public VisitMutationResponse mutateVisit(@Context HttpServletRequest request,
            VisitMutationRequest body) {
        if (request == null || request.getRemoteUser() == null || request.getRemoteUser().isBlank()) {
            Map<String, Object> details = newAuditDetails(request);
            details.put("operation", OPERATION_VISIT_MUTATION);
            markFailureDetails(details, Response.Status.UNAUTHORIZED.getStatusCode(),
                    "remote_user_missing", "Authenticated user is required");
            recordAudit(request, ACTION_APPOINTMENT_OUTPATIENT, details, AuditEventEnvelope.Outcome.FAILURE);
            throw restError(request, Response.Status.UNAUTHORIZED, "remote_user_missing",
                    "Authenticated user is required");
        }
        if (body == null) {
            Map<String, Object> details = newAuditDetails(request);
            details.put("operation", OPERATION_VISIT_MUTATION);
            markFailureDetails(details, Response.Status.BAD_REQUEST.getStatusCode(),
                    "orca.visit.mutation.invalid", "Request payload is required");
            recordAudit(request, ACTION_APPOINTMENT_OUTPATIENT, details, AuditEventEnvelope.Outcome.FAILURE);
            throw restError(request, Response.Status.BAD_REQUEST, "orca.visit.mutation.invalid",
                    "Request payload is required");
        }
        if (body.getRequestNumber() == null || body.getRequestNumber().isBlank()) {
            Map<String, Object> details = newAuditDetails(request);
            details.put("operation", OPERATION_VISIT_MUTATION);
            details.put("patientId", body.getPatientId());
            markFailureDetails(details, Response.Status.BAD_REQUEST.getStatusCode(),
                    "orca.visit.mutation.invalid", "requestNumber is required");
            recordAudit(request, ACTION_APPOINTMENT_OUTPATIENT, details, AuditEventEnvelope.Outcome.FAILURE);
            throw restError(request, Response.Status.BAD_REQUEST, "orca.visit.mutation.invalid",
                    "requestNumber is required");
        }
        if (body.getPatientId() == null || body.getPatientId().isBlank()) {
            Map<String, Object> details = newAuditDetails(request);
            details.put("operation", OPERATION_VISIT_MUTATION);
            markFailureDetails(details, Response.Status.BAD_REQUEST.getStatusCode(),
                    "orca.visit.mutation.invalid", "patientId is required");
            recordAudit(request, ACTION_APPOINTMENT_OUTPATIENT, details, AuditEventEnvelope.Outcome.FAILURE);
            throw restError(request, Response.Status.BAD_REQUEST, "orca.visit.mutation.invalid",
                    "patientId is required");
        }
        if (!isQueryRequest(body.getRequestNumber())
                && (body.getAcceptanceDate() == null || body.getAcceptanceDate().isBlank()
                || body.getAcceptanceTime() == null || body.getAcceptanceTime().isBlank())) {
            Map<String, Object> details = newAuditDetails(request);
            details.put("operation", OPERATION_VISIT_MUTATION);
            details.put("patientId", body.getPatientId());
            markFailureDetails(details, Response.Status.BAD_REQUEST.getStatusCode(),
                    "orca.visit.mutation.invalid", "acceptanceDate and acceptanceTime are required");
            recordAudit(request, ACTION_APPOINTMENT_OUTPATIENT, details, AuditEventEnvelope.Outcome.FAILURE);
            throw restError(request, Response.Status.BAD_REQUEST, "orca.visit.mutation.invalid",
                    "acceptanceDate and acceptanceTime are required");
        }
        Map<String, Object> details = newAuditDetails(request);
        details.put("operation", OPERATION_VISIT_MUTATION);
        details.put("requestNumber", body.getRequestNumber());
        details.put("patientId", body.getPatientId());
        details.put("acceptanceDate", body.getAcceptanceDate());
        details.put("acceptanceTime", body.getAcceptanceTime());
        try {
            VisitMutationResponse response = wrapperService.mutateVisit(body);
            applyResponseAuditDetails(response, details);
            applyResponseMetadata(response, details);
            if (response.getAcceptanceId() != null && !response.getAcceptanceId().isBlank()) {
                details.put("acceptanceId", response.getAcceptanceId());
            }
            publishReceptionRealtimeUpdateIfNeeded(request, body, response, details);
            markSuccessDetails(details);
            recordAudit(request, ACTION_APPOINTMENT_OUTPATIENT, details, AuditEventEnvelope.Outcome.SUCCESS);
            return response;
        } catch (RuntimeException ex) {
            markFailureDetails(details, Response.Status.INTERNAL_SERVER_ERROR.getStatusCode(),
                    "orca.visit.mutation.error", ex.getMessage());
            recordAudit(request, ACTION_APPOINTMENT_OUTPATIENT, details, AuditEventEnvelope.Outcome.FAILURE);
            throw ex;
        }
    }

    @POST
    @Path("/list")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public VisitPatientListResponse visitList(@Context HttpServletRequest request,
            VisitPatientListRequest body) {
        if (body == null || (body.getVisitDate() == null && body.getFromDate() == null && body.getToDate() == null)) {
            Map<String, Object> details = newAuditDetails(request);
            details.put("operation", OPERATION_VISIT_LIST);
            markFailureDetails(details, Response.Status.BAD_REQUEST.getStatusCode(),
                    "orca.visit.invalid", "visitDate or fromDate/toDate is required");
            recordAudit(request, ACTION_APPOINTMENT_OUTPATIENT, details, AuditEventEnvelope.Outcome.FAILURE);
            throw restError(request, Response.Status.BAD_REQUEST, "orca.visit.invalid",
                    "visitDate or fromDate/toDate is required");
        }
        if (body.getFromDate() != null && body.getToDate() != null
                && body.getToDate().isAfter(body.getFromDate().plusDays(OrcaWrapperService.MAX_VISIT_RANGE_DAYS - 1))) {
            Map<String, Object> details = newAuditDetails(request);
            details.put("operation", OPERATION_VISIT_LIST);
            putAuditDetail(details, "visitDate", body.getVisitDate());
            markFailureDetails(details, Response.Status.BAD_REQUEST.getStatusCode(),
                    "orca.visit.range.tooWide",
                    "visitDate range too wide; up to " + OrcaWrapperService.MAX_VISIT_RANGE_DAYS + " days are allowed");
            recordAudit(request, ACTION_APPOINTMENT_OUTPATIENT, details, AuditEventEnvelope.Outcome.FAILURE);
            throw restError(request, Response.Status.BAD_REQUEST, "orca.visit.range.tooWide",
                    "visitDate range too wide; up to " + OrcaWrapperService.MAX_VISIT_RANGE_DAYS + " days are allowed");
        }
        if (body.getRequestNumber() == null || body.getRequestNumber().isBlank()) {
            Map<String, Object> details = newAuditDetails(request);
            details.put("operation", OPERATION_VISIT_LIST);
            putAuditDetail(details, "visitDate", body.getVisitDate());
            markFailureDetails(details, Response.Status.BAD_REQUEST.getStatusCode(),
                    "orca.visit.invalid", "requestNumber is required");
            recordAudit(request, ACTION_APPOINTMENT_OUTPATIENT, details, AuditEventEnvelope.Outcome.FAILURE);
            throw restError(request, Response.Status.BAD_REQUEST, "orca.visit.invalid",
                    "requestNumber is required");
        }
        Map<String, Object> details = newAuditDetails(request);
        details.put("operation", OPERATION_VISIT_LIST);
        putAuditDetail(details, "visitDate", body.getVisitDate());
        try {
            VisitPatientListResponse response = wrapperService.getVisitList(body);
            applyResponseAuditDetails(response, details);
            applyResponseMetadata(response, details);
            markSuccessDetails(details);
            recordAudit(request, ACTION_APPOINTMENT_OUTPATIENT, details, AuditEventEnvelope.Outcome.SUCCESS);
            return response;
        } catch (RuntimeException ex) {
            markFailureDetails(details, Response.Status.INTERNAL_SERVER_ERROR.getStatusCode(),
                    "orca.visit.error", ex.getMessage());
            recordAudit(request, ACTION_APPOINTMENT_OUTPATIENT, details, AuditEventEnvelope.Outcome.FAILURE);
            throw ex;
        }
    }

    private boolean isQueryRequest(String requestNumber) {
        if (requestNumber == null || requestNumber.isBlank()) {
            return false;
        }
        String normalized = requestNumber.trim().toLowerCase(Locale.ROOT);
        if (normalized.startsWith("class=")) {
            normalized = normalized.substring("class=".length());
        } else if (normalized.startsWith("?class=")) {
            normalized = normalized.substring("?class=".length());
        } else if (normalized.startsWith("request_number=")) {
            normalized = normalized.substring("request_number=".length());
        }
        if (normalized.matches("\\d+")) {
            if (normalized.length() == 1) {
                normalized = "0" + normalized;
            }
            return "00".equals(normalized);
        }
        return switch (normalized) {
            case "query", "read", "get", "list", "inquiry" -> true;
            default -> false;
        };
    }

    void setWrapperService(OrcaWrapperService wrapperService) {
        this.wrapperService = wrapperService;
    }

    void setReceptionRealtimeSseSupportForTest(ReceptionRealtimeSseSupport receptionRealtimeSseSupport) {
        this.receptionRealtimeSseSupport = receptionRealtimeSseSupport;
    }

    private void publishReceptionRealtimeUpdateIfNeeded(HttpServletRequest request,
            VisitMutationRequest body,
            VisitMutationResponse response,
            Map<String, Object> details) {
        if (receptionRealtimeSseSupport == null || body == null || response == null) {
            return;
        }
        String normalizedRequestNumber = normalizeRequestNumber(body.getRequestNumber());
        if ("00".equals(normalizedRequestNumber)) {
            return;
        }
        if (!OrcaApiProxySupport.isApiResultSuccess(response.getApiResult())) {
            return;
        }
        String facilityId = resolveFacilityIdForRealtime(request, details);
        if (facilityId == null || facilityId.isBlank()) {
            return;
        }
        String patientId = resolvePatientId(body, response);
        String date = normalizeEventDate(response.getAcceptanceDate());
        if (date == null || date.isBlank()) {
            date = normalizeEventDate(body.getAcceptanceDate());
        }
        try {
            receptionRealtimeSseSupport.publishReceptionUpdate(
                    facilityId,
                    date,
                    patientId,
                    normalizedRequestNumber,
                    response.getRunId());
        } catch (RuntimeException ex) {
            LOGGER.log(Level.FINE, "Failed to publish reception realtime update", ex);
        }
    }

    private String resolveFacilityIdForRealtime(HttpServletRequest request, Map<String, Object> details) {
        String remoteUser = request != null ? request.getRemoteUser() : null;
        String facilityId = getRemoteFacility(remoteUser);
        if (facilityId != null && !facilityId.isBlank()) {
            return facilityId;
        }
        if (details == null) {
            return null;
        }
        Object fromAudit = details.get("facilityId");
        if (fromAudit instanceof String text && !text.isBlank()) {
            return text.trim();
        }
        return null;
    }

    private String resolvePatientId(VisitMutationRequest body, VisitMutationResponse response) {
        if (body.getPatientId() != null && !body.getPatientId().isBlank()) {
            return body.getPatientId().trim();
        }
        if (response.getPatient() != null
                && response.getPatient().getPatientId() != null
                && !response.getPatient().getPatientId().isBlank()) {
            return response.getPatient().getPatientId().trim();
        }
        return null;
    }

    private String normalizeRequestNumber(String requestNumber) {
        if (requestNumber == null || requestNumber.isBlank()) {
            return requestNumber;
        }
        String normalized = requestNumber.trim().toLowerCase(Locale.ROOT);
        if (normalized.startsWith("class=")) {
            normalized = normalized.substring("class=".length());
        } else if (normalized.startsWith("?class=")) {
            normalized = normalized.substring("?class=".length());
        } else if (normalized.startsWith("request_number=")) {
            normalized = normalized.substring("request_number=".length());
        }
        if (normalized.matches("\\d+")) {
            if (normalized.length() == 1) {
                normalized = "0" + normalized;
            }
            return normalized;
        }
        return switch (normalized) {
            case "create", "register", "add" -> "01";
            case "delete", "cancel", "remove" -> "02";
            case "update", "modify" -> "03";
            case "query", "read", "get", "list", "inquiry" -> "00";
            default -> normalized;
        };
    }

    private String normalizeEventDate(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String trimmed = value.trim();
        if (trimmed.matches("\\d{4}-\\d{2}-\\d{2}")) {
            return trimmed;
        }
        if (trimmed.matches("\\d{8}")) {
            return trimmed.substring(0, 4) + "-" + trimmed.substring(4, 6) + "-" + trimmed.substring(6, 8);
        }
        try {
            return LocalDate.parse(trimmed).toString();
        } catch (RuntimeException ex) {
            return null;
        }
    }
}
