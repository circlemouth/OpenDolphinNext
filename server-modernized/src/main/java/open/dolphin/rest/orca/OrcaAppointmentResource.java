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
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import open.dolphin.audit.AuditEventEnvelope;
import open.dolphin.encounter.CanonicalEncounterKeys;
import open.dolphin.encounter.ProjectionPatientSummaryRepository;
import open.dolphin.encounter.ScheduleProjectionRepository;
import open.dolphin.orca.service.OrcaLiveGateway;
import open.dolphin.rest.dto.orca.AppointmentMutationRequest;
import open.dolphin.rest.dto.orca.AppointmentMutationResponse;
import open.dolphin.rest.dto.orca.BillingSimulationRequest;
import open.dolphin.rest.dto.orca.BillingSimulationResponse;
import open.dolphin.rest.dto.orca.OrcaAppointmentListRequest;
import open.dolphin.rest.dto.orca.OrcaAppointmentListResponse;
import open.dolphin.rest.dto.orca.PatientAppointmentListRequest;
import open.dolphin.rest.dto.orca.PatientAppointmentListResponse;
import open.dolphin.session.framework.SessionOperation;

/**
 * REST wrapper for appointment, billing simulation, and visit helper endpoints.
 */
@Path("/orca")
@SessionOperation
public class OrcaAppointmentResource extends AbstractOrcaWrapperResource {

    private static final String OPERATION_APPOINTMENT_LIST = "appointment_list";
    private static final String OPERATION_PATIENT_APPOINTMENTS = "patient_appointments";
    private static final String OPERATION_BILLING_ESTIMATE = "billing_estimate";
    private static final String OPERATION_APPOINTMENT_MUTATION = "appointment_mutation";
    private static final ZoneId TOKYO_ZONE = ZoneId.of("Asia/Tokyo");
    private static final DateTimeFormatter ORCA_TIME_FORMAT = DateTimeFormatter.ofPattern("HHmm").withZone(TOKYO_ZONE);

    private OrcaLiveGateway wrapperService;
    @Inject
    ScheduleProjectionRepository scheduleProjectionRepository;
    @Inject
    ProjectionPatientSummaryRepository projectionPatientSummaryRepository;

    public OrcaAppointmentResource() {
    }

    @Inject
    public OrcaAppointmentResource(OrcaLiveGateway wrapperService) {
        this.wrapperService = wrapperService;
    }

    @POST
    @Path("/appointments/list")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public OrcaAppointmentListResponse listAppointments(@Context HttpServletRequest request,
            OrcaAppointmentListRequest body) {
        if (body == null || (body.getAppointmentDate() == null && body.getFromDate() == null && body.getToDate() == null)) {
            Map<String, Object> details = newAuditDetails(request);
            details.put("operation", OPERATION_APPOINTMENT_LIST);
            markFailureDetails(details, Response.Status.BAD_REQUEST.getStatusCode(),
                    "orca.appointment.invalid", "appointmentDate or fromDate/toDate is required");
            recordAudit(request, ACTION_APPOINTMENT_OUTPATIENT, details, AuditEventEnvelope.Outcome.FAILURE);
            throw restError(request, Response.Status.BAD_REQUEST, "orca.appointment.invalid",
                    "appointmentDate or fromDate/toDate is required");
        }
        if (body.getFromDate() != null && body.getToDate() != null
                && body.getToDate().isAfter(body.getFromDate().plusDays(OrcaLiveGateway.MAX_APPOINTMENT_RANGE_DAYS - 1))) {
            Map<String, Object> details = newAuditDetails(request);
            details.put("operation", OPERATION_APPOINTMENT_LIST);
            details.put("fromDate", body.getFromDate());
            details.put("toDate", body.getToDate());
            markFailureDetails(details, Response.Status.BAD_REQUEST.getStatusCode(),
                    "orca.appointment.range.tooWide",
                    "appointmentDate range too wide; up to " + OrcaLiveGateway.MAX_APPOINTMENT_RANGE_DAYS + " days are allowed");
            recordAudit(request, ACTION_APPOINTMENT_OUTPATIENT, details, AuditEventEnvelope.Outcome.FAILURE);
            throw restError(request, Response.Status.BAD_REQUEST, "orca.appointment.range.tooWide",
                    "appointmentDate range too wide; up to " + OrcaLiveGateway.MAX_APPOINTMENT_RANGE_DAYS + " days are allowed");
        }
        String facilityId = requireFacilityId(request);
        Map<String, Object> details = newAuditDetails(request);
        details.put("operation", OPERATION_APPOINTMENT_LIST);
        putAuditDetail(details, "appointmentDate", body.getAppointmentDate());
        if (body.getFromDate() != null) {
            putAuditDetail(details, "fromDate", body.getFromDate());
        }
        if (body.getToDate() != null) {
            putAuditDetail(details, "toDate", body.getToDate());
        }
        try {
            OrcaAppointmentListResponse response = wrapperService.getAppointmentList(facilityId, body);
            enrichAppointmentKeys(facilityId, response);
            mergeRuntimeProjectedSchedules(facilityId, body, response);
            applyResponseAuditDetails(response, details);
            applyResponseMetadata(response, details);
            markSuccessDetails(details);
            recordAudit(request, ACTION_APPOINTMENT_OUTPATIENT, details, AuditEventEnvelope.Outcome.SUCCESS);
            return response;
        } catch (RuntimeException ex) {
            markFailureDetails(details, Response.Status.INTERNAL_SERVER_ERROR.getStatusCode(),
                    "orca.appointment.error", ex.getMessage());
            recordAudit(request, ACTION_APPOINTMENT_OUTPATIENT, details, AuditEventEnvelope.Outcome.FAILURE);
            throw ex;
        }
    }

    @POST
    @Path("/appointments/patient")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public PatientAppointmentListResponse patientAppointments(@Context HttpServletRequest request,
            PatientAppointmentListRequest body) {
        if (body == null || body.getPatientId() == null || body.getPatientId().isBlank()) {
            Map<String, Object> details = newAuditDetails(request);
            details.put("operation", OPERATION_PATIENT_APPOINTMENTS);
            markFailureDetails(details, Response.Status.BAD_REQUEST.getStatusCode(),
                    "orca.appointment.patient.invalid", "patientId is required");
            recordAudit(request, ACTION_APPOINTMENT_OUTPATIENT, details, AuditEventEnvelope.Outcome.FAILURE);
            throw restError(request, Response.Status.BAD_REQUEST, "orca.appointment.patient.invalid",
                    "patientId is required");
        }
        String facilityId = requireFacilityId(request);
        Map<String, Object> details = newAuditDetails(request);
        details.put("operation", OPERATION_PATIENT_APPOINTMENTS);
        details.put("patientId", body.getPatientId());
        try {
            PatientAppointmentListResponse response = wrapperService.getPatientAppointments(facilityId, body);
            enrichPatientAppointmentKeys(facilityId, response);
            applyResponseAuditDetails(response, details);
            applyResponseMetadata(response, details);
            markSuccessDetails(details);
            recordAudit(request, ACTION_APPOINTMENT_OUTPATIENT, details, AuditEventEnvelope.Outcome.SUCCESS);
            return response;
        } catch (RuntimeException ex) {
            markFailureDetails(details, Response.Status.INTERNAL_SERVER_ERROR.getStatusCode(),
                    "orca.appointment.patient.error", ex.getMessage());
            recordAudit(request, ACTION_APPOINTMENT_OUTPATIENT, details, AuditEventEnvelope.Outcome.FAILURE);
            throw ex;
        }
    }

    @POST
    @Path("/billing/estimate")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public BillingSimulationResponse estimateBilling(@Context HttpServletRequest request,
            BillingSimulationRequest body) {
        if (body == null || body.getPatientId() == null || body.getPatientId().isBlank()) {
            Map<String, Object> details = newAuditDetails(request);
            details.put("operation", OPERATION_BILLING_ESTIMATE);
            markFailureDetails(details, Response.Status.BAD_REQUEST.getStatusCode(),
                    "orca.billing.invalid", "patientId is required");
            recordAudit(request, ACTION_APPOINTMENT_OUTPATIENT, details, AuditEventEnvelope.Outcome.FAILURE);
            throw restError(request, Response.Status.BAD_REQUEST, "orca.billing.invalid",
                    "patientId is required");
        }
        if (body.getItems().isEmpty()) {
            Map<String, Object> details = newAuditDetails(request);
            details.put("operation", OPERATION_BILLING_ESTIMATE);
            details.put("patientId", body.getPatientId());
            markFailureDetails(details, Response.Status.BAD_REQUEST.getStatusCode(),
                    "orca.billing.invalid", "At least one billing item is required");
            recordAudit(request, ACTION_APPOINTMENT_OUTPATIENT, details, AuditEventEnvelope.Outcome.FAILURE);
            throw restError(request, Response.Status.BAD_REQUEST, "orca.billing.invalid",
                    "At least one billing item is required");
        }
        String facilityId = requireFacilityId(request);
        Map<String, Object> details = newAuditDetails(request);
        details.put("operation", OPERATION_BILLING_ESTIMATE);
        details.put("patientId", body.getPatientId());
        details.put("itemCount", body.getItems().size());
        try {
            BillingSimulationResponse response = wrapperService.simulateBilling(facilityId, body);
            applyResponseAuditDetails(response, details);
            applyResponseMetadata(response, details);
            markSuccessDetails(details);
            recordAudit(request, ACTION_APPOINTMENT_OUTPATIENT, details, AuditEventEnvelope.Outcome.SUCCESS);
            return response;
        } catch (RuntimeException ex) {
            markFailureDetails(details, Response.Status.INTERNAL_SERVER_ERROR.getStatusCode(),
                    "orca.billing.error", ex.getMessage());
            recordAudit(request, ACTION_APPOINTMENT_OUTPATIENT, details, AuditEventEnvelope.Outcome.FAILURE);
            throw ex;
        }
    }

    @POST
    @Path("/appointments/mutation")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public AppointmentMutationResponse mutateAppointment(@Context HttpServletRequest request,
            AppointmentMutationRequest body) {
        if (request == null || request.getRemoteUser() == null || request.getRemoteUser().isBlank()) {
            Map<String, Object> details = newAuditDetails(request);
            details.put("operation", OPERATION_APPOINTMENT_MUTATION);
            markFailureDetails(details, Response.Status.UNAUTHORIZED.getStatusCode(),
                    "remote_user_missing", "Authenticated user is required");
            recordAudit(request, ACTION_APPOINTMENT_OUTPATIENT, details, AuditEventEnvelope.Outcome.FAILURE);
            throw restError(request, Response.Status.UNAUTHORIZED, "remote_user_missing",
                    "Authenticated user is required");
        }
        if (body == null) {
            Map<String, Object> details = newAuditDetails(request);
            details.put("operation", OPERATION_APPOINTMENT_MUTATION);
            markFailureDetails(details, Response.Status.BAD_REQUEST.getStatusCode(),
                    "orca.appointment.mutation.invalid", "Request payload is required");
            recordAudit(request, ACTION_APPOINTMENT_OUTPATIENT, details, AuditEventEnvelope.Outcome.FAILURE);
            throw restError(request, Response.Status.BAD_REQUEST, "orca.appointment.mutation.invalid",
                    "Request payload is required");
        }
        if (body.getRequestNumber() == null || body.getRequestNumber().isBlank()) {
            Map<String, Object> details = newAuditDetails(request);
            details.put("operation", OPERATION_APPOINTMENT_MUTATION);
            details.put("patientId", body.getPatient() != null ? body.getPatient().getPatientId() : null);
            markFailureDetails(details, Response.Status.BAD_REQUEST.getStatusCode(),
                    "orca.appointment.mutation.invalid", "requestNumber is required");
            recordAudit(request, ACTION_APPOINTMENT_OUTPATIENT, details, AuditEventEnvelope.Outcome.FAILURE);
            throw restError(request, Response.Status.BAD_REQUEST, "orca.appointment.mutation.invalid",
                    "requestNumber is required");
        }
        if (body.getPatient() == null || body.getPatient().getPatientId() == null
                || body.getPatient().getPatientId().isBlank()) {
            Map<String, Object> details = newAuditDetails(request);
            details.put("operation", OPERATION_APPOINTMENT_MUTATION);
            markFailureDetails(details, Response.Status.BAD_REQUEST.getStatusCode(),
                    "orca.appointment.mutation.invalid", "patient.patientId is required");
            recordAudit(request, ACTION_APPOINTMENT_OUTPATIENT, details, AuditEventEnvelope.Outcome.FAILURE);
            throw restError(request, Response.Status.BAD_REQUEST, "orca.appointment.mutation.invalid",
                    "patient.patientId is required");
        }
        if (body.getAppointmentDate() == null || body.getAppointmentDate().isBlank()
                || body.getAppointmentTime() == null || body.getAppointmentTime().isBlank()) {
            Map<String, Object> details = newAuditDetails(request);
            details.put("operation", OPERATION_APPOINTMENT_MUTATION);
            details.put("patientId", body.getPatient().getPatientId());
            markFailureDetails(details, Response.Status.BAD_REQUEST.getStatusCode(),
                    "orca.appointment.mutation.invalid", "appointmentDate and appointmentTime are required");
            recordAudit(request, ACTION_APPOINTMENT_OUTPATIENT, details, AuditEventEnvelope.Outcome.FAILURE);
            throw restError(request, Response.Status.BAD_REQUEST, "orca.appointment.mutation.invalid",
                    "appointmentDate and appointmentTime are required");
        }
        String facilityId = requireFacilityId(request);
        Map<String, Object> details = newAuditDetails(request);
        details.put("operation", OPERATION_APPOINTMENT_MUTATION);
        details.put("requestNumber", body.getRequestNumber());
        details.put("patientId", body.getPatient().getPatientId());
        details.put("appointmentDate", body.getAppointmentDate());
        details.put("appointmentTime", body.getAppointmentTime());
        try {
            AppointmentMutationResponse response = wrapperService.mutateAppointment(facilityId, body);
            enrichAppointmentMutationKeys(facilityId, response);
            applyResponseAuditDetails(response, details);
            applyResponseMetadata(response, details);
            if (response.getAppointmentId() != null && !response.getAppointmentId().isBlank()) {
                details.put("appointmentId", response.getAppointmentId());
            }
            markSuccessDetails(details);
            recordAudit(request, ACTION_APPOINTMENT_OUTPATIENT, details, AuditEventEnvelope.Outcome.SUCCESS);
            return response;
        } catch (RuntimeException ex) {
            markFailureDetails(details, Response.Status.INTERNAL_SERVER_ERROR.getStatusCode(),
                    "orca.appointment.mutation.error", ex.getMessage());
            recordAudit(request, ACTION_APPOINTMENT_OUTPATIENT, details, AuditEventEnvelope.Outcome.FAILURE);
            throw ex;
        }
    }

    void setWrapperService(OrcaLiveGateway wrapperService) {
        this.wrapperService = wrapperService;
    }

    private void enrichAppointmentKeys(String facilityId, OrcaAppointmentListResponse response) {
        if (response == null) {
            return;
        }
        response.getSlots().forEach(slot -> {
            String scheduleKey = CanonicalEncounterKeys.optionalScheduleKey(facilityId, slot.getAppointmentId());
            slot.setScheduleKey(scheduleKey);
            slot.setEncounterKey(resolveEncounterKey(scheduleKey));
        });
    }

    private void enrichPatientAppointmentKeys(String facilityId, PatientAppointmentListResponse response) {
        if (response == null) {
            return;
        }
        response.getReservations().forEach(reservation -> {
            String scheduleKey = CanonicalEncounterKeys.optionalScheduleKey(facilityId, reservation.getAppointmentId());
            reservation.setScheduleKey(scheduleKey);
            reservation.setEncounterKey(resolveEncounterKey(scheduleKey));
        });
    }

    private void enrichAppointmentMutationKeys(String facilityId, AppointmentMutationResponse response) {
        if (response == null) {
            return;
        }
        String scheduleKey = CanonicalEncounterKeys.optionalScheduleKey(facilityId, response.getAppointmentId());
        response.setScheduleKey(scheduleKey);
        response.setEncounterKey(resolveEncounterKey(scheduleKey));
    }

    private String resolveEncounterKey(String scheduleKey) {
        if (scheduleKey == null || scheduleProjectionRepository == null) {
            return null;
        }
        ScheduleProjectionRepository.ScheduleRow row = scheduleProjectionRepository.findByScheduleKey(scheduleKey);
        return row != null ? row.linkedEncounterKey() : null;
    }

    private void mergeRuntimeProjectedSchedules(String facilityId,
            OrcaAppointmentListRequest body,
            OrcaAppointmentListResponse response) {
        if (response == null || scheduleProjectionRepository == null || body == null) {
            return;
        }
        LocalDate fromDate = body.getAppointmentDate() != null ? body.getAppointmentDate() : body.getFromDate();
        LocalDate toDate = body.getAppointmentDate() != null ? body.getAppointmentDate() : body.getToDate();
        if (fromDate == null || toDate == null) {
            return;
        }
        List<ScheduleProjectionRepository.ScheduleRow> projectedRows =
                scheduleProjectionRepository.findByFacilityAndScheduledRange(
                        facilityId,
                        fromDate.atStartOfDay(TOKYO_ZONE).toInstant(),
                        toDate.plusDays(1).atStartOfDay(TOKYO_ZONE).toInstant());
        if (projectedRows.isEmpty()) {
            return;
        }

        HashSet<String> seenScheduleKeys = new HashSet<>();
        HashSet<String> seenEncounterKeys = new HashSet<>();
        HashSet<String> seenAppointmentIds = new HashSet<>();
        for (OrcaAppointmentListResponse.AppointmentSlot slot : response.getSlots()) {
            collectKey(seenScheduleKeys, slot.getScheduleKey());
            collectKey(seenEncounterKeys, slot.getEncounterKey());
            collectKey(seenAppointmentIds, slot.getAppointmentId());
        }

        boolean merged = false;
        for (ScheduleProjectionRepository.ScheduleRow row : projectedRows) {
            boolean alreadyPresent =
                    containsKey(seenScheduleKeys, row.scheduleKey())
                            || containsKey(seenEncounterKeys, row.linkedEncounterKey())
                            || containsKey(seenAppointmentIds, row.orcaAppointmentId());
            if (alreadyPresent) {
                continue;
            }
            OrcaAppointmentListResponse.AppointmentSlot slot = new OrcaAppointmentListResponse.AppointmentSlot();
            slot.setScheduleKey(row.scheduleKey());
            slot.setEncounterKey(row.linkedEncounterKey());
            slot.setAppointmentId(row.orcaAppointmentId());
            slot.setAppointmentTime(ORCA_TIME_FORMAT.format(row.scheduledDatetime()));
            slot.setDepartmentCode(row.departmentCode());
            slot.setPhysicianCode(row.physicianCode());
            slot.setVisitInformation(resolveProjectedAppointmentStatus(row.state()));
            slot.setPatient(projectionPatientSummaryRepository != null
                    ? projectionPatientSummaryRepository.findByFacilityAndPatientId(facilityId, row.patientId())
                    : null);
            response.getSlots().add(slot);
            collectKey(seenScheduleKeys, row.scheduleKey());
            collectKey(seenEncounterKeys, row.linkedEncounterKey());
            collectKey(seenAppointmentIds, row.orcaAppointmentId());
            merged = true;
        }
        if (merged) {
            response.setRecordsReturned(response.getSlots().size());
            response.setFallbackUsed(true);
        }
    }

    private String resolveProjectedAppointmentStatus(String state) {
        if (state == null || state.isBlank()) {
            return "予約";
        }
        return switch (state.trim().toLowerCase()) {
            case "checked_in", "chart_opened" -> "診療中";
            case "cancelled" -> "取消";
            default -> "予約";
        };
    }

    private void collectKey(HashSet<String> sink, String value) {
        String normalized = normalize(value);
        if (normalized != null) {
            sink.add(normalized);
        }
    }

    private boolean containsKey(HashSet<String> keys, String value) {
        String normalized = normalize(value);
        return normalized != null && keys.contains(normalized);
    }

    private String normalize(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
