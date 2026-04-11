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
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import open.dolphin.audit.AuditEventEnvelope;
import open.dolphin.infomodel.PatientModel;
import open.dolphin.infomodel.SimpleAddressModel;
import open.dolphin.rest.dto.orca.PatientMutationRequest;
import open.dolphin.rest.dto.orca.PatientMutationRequest.PatientPayload;
import open.dolphin.rest.dto.orca.PatientMutationResponse;
import open.dolphin.session.PatientServiceBean;

/**
 * Local-only patient mutation wrapper.
 */
@Path("/local/patients")
public class OrcaPatientResource extends AbstractOrcaRestResource {

    private static final String ROUTE_NAMESPACE = "local";
    private static final String AUDIT_ACTION = "LOCAL_PATIENT_MUTATION";

    @Inject
    private PatientServiceBean patientServiceBean;

    void setPatientServiceBean(PatientServiceBean patientServiceBean) {
        this.patientServiceBean = patientServiceBean;
    }

    @POST
    @Path("/mutation")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public PatientMutationResponse mutatePatient(@Context HttpServletRequest request,
            PatientMutationRequest payload) {
        requireRemoteUser(request);
        String facilityId = requireFacilityId(request);
        String runId = resolveRunId(request);
        String operation = requireMutationOperation(request, payload, facilityId, runId);
        String patientId = requireMutationPatientId(request, payload, facilityId, operation, runId);
        Map<String, Object> auditDetails = buildPatientMutationAudit(facilityId, patientId, operation, runId);

        return switch (operation.toLowerCase()) {
            case "create" -> createPatient(request, payload, facilityId, auditDetails);
            case "update" -> updatePatient(request, payload, facilityId, auditDetails);
            case "delete" -> rejectDeleteOperation(request, auditDetails);
            default -> rejectUnsupportedOperation(request, payload.getOperation(), auditDetails);
        };
    }

    private String requireMutationOperation(HttpServletRequest request, PatientMutationRequest payload,
            String facilityId, String runId) {
        if (payload == null || payload.getOperation() == null) {
            Map<String, Object> auditDetails = buildPatientMutationAudit(facilityId, null, null, runId);
            failMutationRequest(request, auditDetails, "operation", "operation is required");
        }
        return payload.getOperation().trim();
    }

    private String requireMutationPatientId(HttpServletRequest request, PatientMutationRequest payload,
            String facilityId, String operation, String runId) {
        if (payload.getPatient() == null || payload.getPatient().getPatientId() == null
                || payload.getPatient().getPatientId().isBlank()) {
            Map<String, Object> auditDetails = buildPatientMutationAudit(facilityId, null, operation, runId);
            failMutationRequest(request, auditDetails, "patient.patientId", "patientId is required");
        }
        return payload.getPatient().getPatientId().trim();
    }

    private Map<String, Object> buildPatientMutationAudit(String facilityId, String patientId, String operation,
            String runId) {
        Map<String, Object> auditDetails = new HashMap<>();
        auditDetails.put("facilityId", facilityId);
        if (patientId != null) {
            auditDetails.put("patientId", patientId);
        }
        if (operation != null) {
            auditDetails.put("operation", operation);
        }
        auditDetails.put("runId", runId);
        auditDetails.put("routeNamespace", ROUTE_NAMESPACE);
        return auditDetails;
    }

    private PatientMutationResponse createPatient(HttpServletRequest request, PatientMutationRequest payload,
            String facilityId, Map<String, Object> auditDetails) {
        PatientMutationResponse response = new PatientMutationResponse();
        response.setRunId((String) auditDetails.get("runId"));
        response.setRouteNamespace(ROUTE_NAMESPACE);
        response.setPatientId(payload.getPatient().getPatientId());

        PatientModel existing = patientServiceBean.getPatientById(facilityId, payload.getPatient().getPatientId());
        if (existing != null) {
            return resolveExistingPatientCreate(request, payload, auditDetails, existing, response, "existing_patient");
        }

        try {
            long id = patientServiceBean.addPatient(toPatientModel(payload.getPatient(), facilityId));
            response.setApiResult("00");
            response.setApiResultMessage("登録完了");
            response.setPatientDbId(id);
            recordAudit(request, AUDIT_ACTION, auditDetails, AuditEventEnvelope.Outcome.SUCCESS);
            return response;
        } catch (RuntimeException ex) {
            PatientModel retryExisting = patientServiceBean.getPatientById(facilityId, payload.getPatient().getPatientId());
            if (retryExisting != null) {
                return resolveExistingPatientCreate(request, payload, auditDetails, retryExisting, response,
                        "duplicate_detected");
            }
            throw ex;
        }
    }

    private PatientMutationResponse resolveExistingPatientCreate(HttpServletRequest request, PatientMutationRequest payload,
            Map<String, Object> auditDetails, PatientModel existing, PatientMutationResponse response,
            String idempotentReason) {
        List<String> conflicts = resolveConflicts(existing, payload.getPatient());
        if (!conflicts.isEmpty()) {
            Map<String, Object> conflictAudit = new HashMap<>(auditDetails);
            conflictAudit.put("conflictFields", conflicts);
            markFailureDetails(conflictAudit, Response.Status.CONFLICT.getStatusCode(),
                    "patient_conflict", "Patient already exists with different attributes");
            recordAudit(request, AUDIT_ACTION, conflictAudit, AuditEventEnvelope.Outcome.FAILURE);
            Map<String, Object> errorDetails = new HashMap<>();
            errorDetails.put("patientId", payload.getPatient().getPatientId());
            errorDetails.put("conflictFields", conflicts);
            throw restError(request, Response.Status.CONFLICT, "patient_conflict",
                    "Patient already exists with different attributes", errorDetails, null);
        }
        response.setApiResult("00");
        response.setApiResultMessage("登録済み");
        response.setPatientDbId(existing.getId());
        response.setIdempotent(Boolean.TRUE);
        response.setIdempotentReason(idempotentReason);
        auditDetails.put("idempotent", Boolean.TRUE);
        auditDetails.put("idempotentReason", idempotentReason);
        recordAudit(request, AUDIT_ACTION, auditDetails, AuditEventEnvelope.Outcome.SUCCESS);
        return response;
    }

    private PatientMutationResponse updatePatient(HttpServletRequest request, PatientMutationRequest payload,
            String facilityId, Map<String, Object> auditDetails) {
        PatientModel existing = patientServiceBean.getPatientById(facilityId, payload.getPatient().getPatientId());
        if (existing == null) {
            Map<String, Object> missingAudit = new HashMap<>(auditDetails);
            markFailureDetails(missingAudit, Response.Status.NOT_FOUND.getStatusCode(),
                    "patient_not_found", "Patient not found");
            recordAudit(request, AUDIT_ACTION, missingAudit, AuditEventEnvelope.Outcome.FAILURE);
            throw restError(request, Response.Status.NOT_FOUND, "patient_not_found", "Patient not found");
        }
        PatientModel update = toPatientModel(payload.getPatient(), facilityId);
        update.setId(existing.getId());
        patientServiceBean.update(update);
        PatientMutationResponse response = new PatientMutationResponse();
        response.setRunId((String) auditDetails.get("runId"));
        response.setRouteNamespace(ROUTE_NAMESPACE);
        response.setPatientId(payload.getPatient().getPatientId());
        response.setApiResult("00");
        response.setApiResultMessage("更新完了");
        response.setPatientDbId(existing.getId());
        recordAudit(request, AUDIT_ACTION, auditDetails, AuditEventEnvelope.Outcome.SUCCESS);
        return response;
    }

    private PatientMutationResponse rejectDeleteOperation(HttpServletRequest request, Map<String, Object> auditDetails) {
        Map<String, Object> unsupportedAudit = new HashMap<>(auditDetails);
        unsupportedAudit.put("validationError", Boolean.TRUE);
        unsupportedAudit.put("field", "operation");
        markFailureDetails(unsupportedAudit, Response.Status.BAD_REQUEST.getStatusCode(),
                "invalid_request", "delete operation is not supported");
        recordAudit(request, AUDIT_ACTION, unsupportedAudit, AuditEventEnvelope.Outcome.FAILURE);
        throw validationError(request, "operation", "delete operation is not supported");
    }

    private PatientMutationResponse rejectUnsupportedOperation(HttpServletRequest request, String operation,
            Map<String, Object> auditDetails) {
        Map<String, Object> unsupportedAudit = new HashMap<>(auditDetails);
        unsupportedAudit.put("validationError", Boolean.TRUE);
        unsupportedAudit.put("field", "operation");
        markFailureDetails(unsupportedAudit, Response.Status.BAD_REQUEST.getStatusCode(),
                "invalid_request", "Unsupported operation: " + operation);
        recordAudit(request, AUDIT_ACTION, unsupportedAudit, AuditEventEnvelope.Outcome.FAILURE);
        throw validationError(request, "operation", "Unsupported operation: " + operation);
    }

    private void failMutationRequest(HttpServletRequest request, Map<String, Object> auditDetails, String field,
            String message) {
        auditDetails.put("validationError", Boolean.TRUE);
        auditDetails.put("field", field);
        markFailureDetails(auditDetails, Response.Status.BAD_REQUEST.getStatusCode(),
                "invalid_request", message);
        recordAudit(request, AUDIT_ACTION, auditDetails, AuditEventEnvelope.Outcome.FAILURE);
        throw validationError(request, field, message);
    }

    private PatientModel toPatientModel(PatientPayload payload, String facilityId) {
        PatientModel model = new PatientModel();
        model.setFacilityId(facilityId);
        model.setPatientId(payload.getPatientId());
        if (payload.getWholeName() != null) {
            model.setFullName(payload.getWholeName());
            String[] parts = payload.getWholeName().trim().split("\\s+", 2);
            if (parts.length > 0) {
                model.setFamilyName(parts[0]);
            }
            if (parts.length > 1) {
                model.setGivenName(parts[1]);
            }
        }
        model.setKanaName(payload.getWholeNameKana());
        model.setGender(Optional.ofNullable(payload.getSex()).orElse("0"));
        model.setBirthday(parseBirthDate(payload.getBirthDate()));
        model.setTelephone(payload.getTelephone());
        model.setMobilePhone(payload.getMobilePhone());
        if (payload.getAddressLine() != null || payload.getZipCode() != null) {
            SimpleAddressModel address = new SimpleAddressModel();
            address.setAddress(payload.getAddressLine());
            address.setZipCode(payload.getZipCode());
            model.setAddress(address);
        }
        return model;
    }

    private List<String> resolveConflicts(PatientModel existing, PatientPayload payload) {
        List<String> conflicts = new ArrayList<>();
        if (existing == null || payload == null) {
            return conflicts;
        }
        compareText(conflicts, "wholeName", payload.getWholeName(), existing.getFullName());
        compareText(conflicts, "wholeNameKana", payload.getWholeNameKana(), existing.getKanaName());
        compareText(conflicts, "birthDate", payload.getBirthDate(),
                existing.getBirthday() != null ? existing.getBirthday().toString() : null);
        compareText(conflicts, "sex", payload.getSex(), existing.getGender());
        compareText(conflicts, "telephone", payload.getTelephone(), existing.getTelephone());
        compareText(conflicts, "mobilePhone", payload.getMobilePhone(), existing.getMobilePhone());
        String existingAddress = existing.getAddress() != null ? existing.getAddress().getAddress() : null;
        String existingZip = existing.getAddress() != null ? existing.getAddress().getZipCode() : null;
        compareText(conflicts, "addressLine", payload.getAddressLine(), existingAddress);
        compareText(conflicts, "zipCode", payload.getZipCode(), existingZip);
        return conflicts;
    }

    private void compareText(List<String> conflicts, String field, String requestValue, String existingValue) {
        if (conflicts == null || field == null) {
            return;
        }
        if (requestValue == null || requestValue.isBlank()) {
            return;
        }
        String normalizedRequest = requestValue.trim();
        String normalizedExisting = existingValue == null ? "" : existingValue.trim();
        if (!normalizedRequest.equals(normalizedExisting)) {
            conflicts.add(field);
        }
    }

    private LocalDate parseBirthDate(String birthDate) {
        if (birthDate == null || birthDate.isBlank()) {
            return null;
        }
        return LocalDate.parse(birthDate.trim());
    }
}
