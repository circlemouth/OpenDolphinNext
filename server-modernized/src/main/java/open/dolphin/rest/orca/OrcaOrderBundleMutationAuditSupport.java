package open.dolphin.rest.orca;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.core.Response;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;
import org.slf4j.Logger;

final class OrcaOrderBundleMutationAuditSupport {

    private OrcaOrderBundleMutationAuditSupport() {
    }

    static RuntimeException buildOrderBundleFailure(
            AbstractOrcaRestResource resource,
            Logger logger,
            HttpServletRequest request,
            String runId,
            String facilityId,
            String patientId,
            Long karteId,
            Long documentId,
            String operation,
            RuntimeException ex) {
        Map<String, Object> details = new HashMap<>();
        details.put("facilityId", facilityId);
        details.put("patientId", patientId);
        details.put("karteId", karteId);
        if (documentId != null) {
            details.put("documentId", documentId);
        }
        details.put("operation", operation);
        details.put("runId", runId);
        resource.markFailureDetails(
                details,
                Response.Status.SERVICE_UNAVAILABLE.getStatusCode(),
                "order_bundle_unavailable",
                "Failed to mutate order bundle");
        resource.recordAudit(request, "ORCA_ORDER_BUNDLE_MUTATION", details, open.dolphin.audit.AuditEventEnvelope.Outcome.FAILURE);
        logger.warn("Order bundle mutation failed (patientId={}, karteId={}, documentId={}, operation={}, runId={})",
                patientId, karteId, documentId, operation, runId, ex);
        return resource.restError(
                request,
                Response.Status.SERVICE_UNAVAILABLE,
                "order_bundle_unavailable",
                "Failed to mutate order bundle",
                details,
                ex);
    }

    static Date requireMutationDate(
            AbstractOrcaRestResource resource,
            HttpServletRequest request,
            String facilityId,
            String patientId,
            String runId,
            String operation,
            String field,
            String input,
            boolean required) {
        if (input == null || input.isBlank()) {
            if (!required) {
                return null;
            }
            throw validationFailure(resource, request, facilityId, patientId, runId, field, field + " is required", operation);
        }
        Date parsed = OrcaOrderBundleRequestSupport.parseStrictIsoDate(input);
        if (parsed != null) {
            return parsed;
        }
        throw validationFailure(resource, request, facilityId, patientId, runId, field, field + " must be yyyy-MM-dd", operation);
    }

    static RuntimeException validationFailure(
            AbstractOrcaRestResource resource,
            HttpServletRequest request,
            String facilityId,
            String patientId,
            String runId,
            String field,
            String message) {
        return validationFailure(resource, request, facilityId, patientId, runId, field, message, null);
    }

    private static RuntimeException validationFailure(
            AbstractOrcaRestResource resource,
            HttpServletRequest request,
            String facilityId,
            String patientId,
            String runId,
            String field,
            String message,
            String operation) {
        Map<String, Object> audit = new HashMap<>();
        audit.put("facilityId", facilityId);
        if (patientId != null) {
            audit.put("patientId", patientId);
        }
        audit.put("runId", runId);
        audit.put("validationError", Boolean.TRUE);
        audit.put("field", field);
        if (operation != null) {
            audit.put("operation", operation);
        }
        resource.markFailureDetails(audit, Response.Status.BAD_REQUEST.getStatusCode(), "invalid_request", message);
        resource.recordAudit(request, "ORCA_ORDER_BUNDLE_MUTATION", audit, open.dolphin.audit.AuditEventEnvelope.Outcome.FAILURE);
        return resource.validationError(request, field, message);
    }
}
