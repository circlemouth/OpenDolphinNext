package open.dolphin.rest.orca;

import jakarta.persistence.EntityManager;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Instant;
import java.util.Date;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import open.dolphin.infomodel.BundleDolphin;
import open.dolphin.infomodel.KarteBean;
import open.dolphin.infomodel.ModuleModel;
import open.dolphin.infomodel.PatientModel;
import open.dolphin.rest.dto.orca.OrderBundleRecommendationResponse;
import open.dolphin.session.KarteServiceBean;
import open.dolphin.session.PatientServiceBean;
import org.slf4j.Logger;
import jakarta.ws.rs.core.Response;

final class OrcaOrderBundleRecommendationFlowSupport {

    private OrcaOrderBundleRecommendationFlowSupport() {
    }

    static RecommendationFlowResult execute(
            AbstractOrcaRestResource resource,
            HttpServletRequest request,
            PatientServiceBean patientServiceBean,
            KarteServiceBean karteServiceBean,
            EntityManager entityManager,
            Logger logger,
            String patientId,
            String entity,
            String from,
            Boolean includeFacility,
            Integer patientLimit,
            Integer facilityLimit,
            Integer scanLimit,
            String facilityId,
            String runId,
            OrcaOrderBundleRecommendationCollectorSupport.BundleDecoder decoder) {

        RecommendationContext context = validateRequest(
                resource,
                request,
                patientServiceBean,
                karteServiceBean,
                facilityId,
                runId,
                patientId,
                entity,
                includeFacility,
                patientLimit,
                facilityLimit,
                scanLimit,
                from);
        RecommendationData data = collectData(entityManager, logger, karteServiceBean, context, decoder);
        return new RecommendationFlowResult(
                buildResponse(runId, patientId, context.resolvedEntity(), data),
                buildAudit(context, data));
    }

    private static RecommendationContext validateRequest(
            AbstractOrcaRestResource resource,
            HttpServletRequest request,
            PatientServiceBean patientServiceBean,
            KarteServiceBean karteServiceBean,
            String facilityId,
            String runId,
            String patientId,
            String entity,
            Boolean includeFacility,
            Integer patientLimit,
            Integer facilityLimit,
            Integer scanLimit,
            String from) {
        if (patientId == null || patientId.isBlank()) {
            throw orderBundleValidationFailure(resource, request, LocalOrderBundleResource.AUDIT_RECOMMENDATION_ACTION,
                    facilityId, null, runId, "patientId", "patientId is required");
        }
        String resolvedEntity = OrcaOrderBundleRequestSupport.normalizeEntityQuery(entity);
        if (OrcaOrderBundleRequestSupport.isInvalidEntityQuery(entity)
                || (resolvedEntity != null && !OrcaOrderBundleRequestSupport.isValidEntity(resolvedEntity))) {
            throw orderBundleValidationFailure(resource, request, LocalOrderBundleResource.AUDIT_RECOMMENDATION_ACTION,
                    facilityId, patientId, runId, "entity", "entity is invalid");
        }
        PatientModel patient = patientServiceBean.getPatientById(facilityId, patientId);
        if (patient == null) {
            throw orderBundleNotFoundFailure(resource, request, LocalOrderBundleResource.AUDIT_RECOMMENDATION_ACTION,
                    facilityId, patientId, runId, "patient_not_found", "Patient not found");
        }
        KarteBean karte = karteServiceBean.getKarte(facilityId, patientId, null);
        if (karte == null) {
            throw orderBundleNotFoundFailure(resource, request, LocalOrderBundleResource.AUDIT_RECOMMENDATION_ACTION,
                    facilityId, patientId, runId, "karte_not_found", "Karte not found");
        }
        boolean includeFacilityRows = includeFacility == null || includeFacility;
        int resolvedPatientLimit = OrcaOrderBundleRecommendationCollectorSupport.clampLimit(patientLimit, 8, 64);
        int resolvedFacilityLimit = OrcaOrderBundleRecommendationCollectorSupport.clampOptionalLimit(facilityLimit, 8, 64);
        int resolvedScanLimit = OrcaOrderBundleRecommendationCollectorSupport.clampScanLimit(scanLimit, 800, 5000);
        Date since = OrcaOrderBundleRequestSupport.parseDate(
                from,
                Date.from(Instant.now().minusSeconds(60L * 60L * 24L * 180L)));
        return new RecommendationContext(
                resolvedEntity,
                facilityId,
                patientId,
                runId,
                karte,
                includeFacilityRows,
                resolvedPatientLimit,
                resolvedFacilityLimit,
                resolvedScanLimit,
                since);
    }

    private static RecommendationData collectData(
            EntityManager entityManager,
            Logger logger,
            KarteServiceBean karteServiceBean,
            RecommendationContext context,
            OrcaOrderBundleRecommendationCollectorSupport.BundleDecoder decoder) {
        Map<String, RecommendationAggregate> patientAggregates = new LinkedHashMap<>();
        int patientScanned = OrcaOrderBundleRecommendationCollectorSupport.collectFromPatient(
                entityManager,
                logger,
                context.facilityId(),
                context.patientId(),
                context.karte(),
                context.resolvedEntity(),
                context.since(),
                context.resolvedScanLimit(),
                patientAggregates,
                (resolvedKarte, fromDate, limit) -> OrcaOrderBundleQuerySupport.resolveDocuments(
                        karteServiceBean, resolvedKarte, fromDate, limit),
                decoder,
                OrcaOrderBundleDisplaySupport::resolveBundleName);

        List<RecommendationAggregate> sortedPatientAggregates = OrcaOrderBundleRecommendationCollectorSupport.sortAggregates(patientAggregates);
        int facilityFallbackNeeded = context.includeFacilityRows()
                ? Math.max(0, context.resolvedPatientLimit() - Math.min(context.resolvedPatientLimit(), sortedPatientAggregates.size()))
                : 0;
        int effectiveFacilityLimit = Math.min(context.resolvedFacilityLimit(), facilityFallbackNeeded);

        Map<String, RecommendationAggregate> facilityAggregates = new LinkedHashMap<>();
        int facilityScanned = 0;
        if (context.includeFacilityRows() && effectiveFacilityLimit > 0) {
            facilityScanned = OrcaOrderBundleRecommendationCollectorSupport.collectFromFacility(
                    entityManager,
                    logger,
                    context.facilityId(),
                    context.patientId(),
                    context.resolvedEntity(),
                    context.since(),
                    context.resolvedScanLimit(),
                    facilityAggregates,
                    decoder,
                    OrcaOrderBundleDisplaySupport::resolveBundleName);
        }

        OrcaOrderBundleAggregationSupport.RecommendationSelection selection =
                OrcaOrderBundleAggregationSupport.selectRecommendations(
                        sortedPatientAggregates,
                        OrcaOrderBundleRecommendationCollectorSupport.sortAggregates(facilityAggregates),
                        context.resolvedPatientLimit(),
                        context.includeFacilityRows() ? effectiveFacilityLimit : 0);
        List<OrderBundleRecommendationResponse.OrderRecommendationEntry> recommendations = selection.recommendations();
        int scanned = patientScanned + facilityScanned;
        return new RecommendationData(
                recommendations,
                scanned,
                patientScanned,
                facilityScanned,
                facilityFallbackNeeded,
                effectiveFacilityLimit,
                selection.facilityFallbackApplied());
    }

    private static OrderBundleRecommendationResponse buildResponse(
            String runId,
            String patientId,
            String entity,
            RecommendationData data) {
        OrderBundleRecommendationResponse response = new OrderBundleRecommendationResponse();
        response.setApiResult("00");
        response.setApiResultMessage("処理終了");
        response.setRunId(runId);
        response.setPatientId(patientId);
        response.setEntity(entity);
        response.setRecordsScanned(data.scanned());
        response.setRecordsReturned(data.recommendations().size());
        response.setRecommendations(data.recommendations());
        return response;
    }

    private static Map<String, Object> buildAudit(RecommendationContext context, RecommendationData data) {
        Map<String, Object> audit = new HashMap<>();
        audit.put("facilityId", context.facilityId());
        audit.put("patientId", context.patientId());
        audit.put("entity", context.resolvedEntity());
        audit.put("runId", context.runId());
        audit.put("includeFacility", context.includeFacilityRows());
        audit.put("patientLimit", context.resolvedPatientLimit());
        audit.put("facilityLimit", context.resolvedFacilityLimit());
        audit.put("effectiveFacilityLimit", data.effectiveFacilityLimit());
        audit.put("facilityFallbackNeeded", data.facilityFallbackNeeded());
        audit.put("facilityFallbackApplied", data.facilityFallbackApplied());
        audit.put("scanLimit", context.resolvedScanLimit());
        audit.put("patientScanned", data.patientScanned());
        audit.put("facilityScanned", data.facilityScanned());
        audit.put("recordsScanned", data.scanned());
        audit.put("recordsReturned", data.recommendations().size());
        audit.put("routeNamespace", LocalOrderBundleResource.ROUTE_NAMESPACE);
        return audit;
    }

    private static RuntimeException orderBundleValidationFailure(
            AbstractOrcaRestResource resource,
            HttpServletRequest request,
            String action,
            String facilityId,
            String patientId,
            String runId,
            String field,
            String message) {
        Map<String, Object> audit = new HashMap<>();
        audit.put("facilityId", facilityId);
        if (patientId != null) {
            audit.put("patientId", patientId);
        }
        audit.put("runId", runId);
        audit.put("validationError", Boolean.TRUE);
        audit.put("field", field);
        audit.put("routeNamespace", LocalOrderBundleResource.ROUTE_NAMESPACE);
        resource.markFailureDetails(audit, Response.Status.BAD_REQUEST.getStatusCode(), "invalid_request", message);
        resource.recordAudit(request, action, audit, open.dolphin.audit.AuditEventEnvelope.Outcome.FAILURE);
        return resource.validationError(request, field, message);
    }

    private static RuntimeException orderBundleNotFoundFailure(
            AbstractOrcaRestResource resource,
            HttpServletRequest request,
            String action,
            String facilityId,
            String patientId,
            String runId,
            String errorCode,
            String message) {
        Map<String, Object> audit = new HashMap<>();
        audit.put("facilityId", facilityId);
        audit.put("patientId", patientId);
        audit.put("runId", runId);
        audit.put("routeNamespace", LocalOrderBundleResource.ROUTE_NAMESPACE);
        resource.markFailureDetails(audit, Response.Status.NOT_FOUND.getStatusCode(), errorCode, message);
        resource.recordAudit(request, action, audit, open.dolphin.audit.AuditEventEnvelope.Outcome.FAILURE);
        return resource.restError(request, Response.Status.NOT_FOUND, errorCode, message);
    }

    record RecommendationFlowResult(
            OrderBundleRecommendationResponse response,
            Map<String, Object> audit) {
    }

    private record RecommendationContext(
            String resolvedEntity,
            String facilityId,
            String patientId,
            String runId,
            KarteBean karte,
            boolean includeFacilityRows,
            int resolvedPatientLimit,
            int resolvedFacilityLimit,
            int resolvedScanLimit,
            Date since) {
    }

    private record RecommendationData(
            List<OrderBundleRecommendationResponse.OrderRecommendationEntry> recommendations,
            int scanned,
            int patientScanned,
            int facilityScanned,
            int facilityFallbackNeeded,
            int effectiveFacilityLimit,
            int facilityFallbackApplied) {
    }
}
