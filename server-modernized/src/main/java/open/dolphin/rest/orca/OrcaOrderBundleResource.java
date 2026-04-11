package open.dolphin.rest.orca;

import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.time.Instant;
import java.util.Comparator;
import java.util.Date;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import open.dolphin.audit.AuditEventEnvelope;
import open.dolphin.infomodel.BundleDolphin;
import open.dolphin.infomodel.DocumentModel;
import open.dolphin.infomodel.KarteBean;
import open.dolphin.infomodel.ModuleModel;
import open.dolphin.infomodel.PatientModel;
import open.dolphin.infomodel.UserModel;
import open.dolphin.rest.dto.orca.OrderBundleFetchResponse;
import open.dolphin.rest.dto.orca.OrderBundleMutationRequest;
import open.dolphin.rest.dto.orca.OrderBundleMutationResponse;
import open.dolphin.rest.dto.orca.OrderBundleRecommendationResponse;
import open.dolphin.session.KarteServiceBean;
import open.dolphin.session.PatientServiceBean;
import open.dolphin.session.UserServiceBean;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Order bundle (prescription/order) wrappers for Charts edit panels.
 */
@Path("/local/order")
public class OrcaOrderBundleResource extends AbstractOrcaRestResource {

    private static final Logger LOGGER = LoggerFactory.getLogger(OrcaOrderBundleResource.class);
    private static final String ORDER_BUNDLE_UNAVAILABLE = "order_bundle_unavailable";
    private static final String ORDER_BUNDLE_ERROR_MESSAGE = "Failed to mutate order bundle";
    public static final String ORDER_BUNDLE_CONTEXT_KEY = "orcaOrderBundleContext";
    private static final int DEFAULT_PATIENT_LIMIT = 8;
    private static final int DEFAULT_FACILITY_LIMIT = 8;
    private static final int DEFAULT_SCAN_LIMIT = 800;
    private static final int MAX_LIMIT = 64;
    private static final int MAX_SCAN_LIMIT = 5000;

    @Inject
    private PatientServiceBean patientServiceBean;

    @Inject
    private KarteServiceBean karteServiceBean;

    @Inject
    private UserServiceBean userServiceBean;

    @PersistenceContext
    private EntityManager entityManager;

    @GET
    @Path("/bundles")
    @Produces(MediaType.APPLICATION_JSON)
    public OrderBundleFetchResponse getBundles(
            @Context HttpServletRequest request,
            @QueryParam("patientId") String patientId,
            @QueryParam("entity") String entity,
            @QueryParam("from") String from) {

        String runId = resolveRunId(request);
        requireRemoteUser(request);
        String facilityId = requireFacilityId(request);
        if (patientId == null || patientId.isBlank()) {
            Map<String, Object> audit = new HashMap<>();
            audit.put("facilityId", facilityId);
            audit.put("runId", runId);
            audit.put("validationError", Boolean.TRUE);
            audit.put("field", "patientId");
            markFailureDetails(audit, Response.Status.BAD_REQUEST.getStatusCode(), "invalid_request", "patientId is required");
            recordAudit(request, "ORCA_ORDER_BUNDLE_FETCH", audit, AuditEventEnvelope.Outcome.FAILURE);
            throw validationError(request, "patientId", "patientId is required");
        }
        if (entity != null && !entity.isBlank() && !OrcaOrderBundleRequestSupport.isValidEntity(entity)) {
            Map<String, Object> audit = new HashMap<>();
            audit.put("facilityId", facilityId);
            audit.put("patientId", patientId);
            audit.put("runId", runId);
            audit.put("validationError", Boolean.TRUE);
            audit.put("field", "entity");
            audit.put("entity", entity);
            markFailureDetails(audit, Response.Status.BAD_REQUEST.getStatusCode(), "invalid_request", "entity is invalid");
            recordAudit(request, "ORCA_ORDER_BUNDLE_FETCH", audit, AuditEventEnvelope.Outcome.FAILURE);
            throw validationError(request, "entity", "entity is invalid");
        }

        PatientModel patient = patientServiceBean.getPatientById(facilityId, patientId);
        if (patient == null) {
            Map<String, Object> audit = new HashMap<>();
            audit.put("facilityId", facilityId);
            audit.put("patientId", patientId);
            audit.put("runId", runId);
            markFailureDetails(audit, Response.Status.NOT_FOUND.getStatusCode(), "patient_not_found", "Patient not found");
            recordAudit(request, "ORCA_ORDER_BUNDLE_FETCH", audit, AuditEventEnvelope.Outcome.FAILURE);
            throw restError(request, Response.Status.NOT_FOUND, "patient_not_found", "Patient not found");
        }

        KarteBean karte = karteServiceBean.getKarte(facilityId, patientId, null);
        if (karte == null) {
            Map<String, Object> audit = new HashMap<>();
            audit.put("facilityId", facilityId);
            audit.put("patientId", patientId);
            audit.put("runId", runId);
            markFailureDetails(audit, Response.Status.NOT_FOUND.getStatusCode(), "karte_not_found", "Karte not found");
            recordAudit(request, "ORCA_ORDER_BUNDLE_FETCH", audit, AuditEventEnvelope.Outcome.FAILURE);
            throw restError(request, Response.Status.NOT_FOUND, "karte_not_found", "Karte not found");
        }

        Date since = OrcaOrderBundleRequestSupport.parseDate(
                from,
                Date.from(Instant.now().minusSeconds(60L * 60L * 24L * 30L)));
        List<DocumentModel> documents = OrcaOrderBundleQuerySupport.resolveDocuments(karteServiceBean, karte, since);
        String normalizedEntity = OrcaOrderBundleRequestSupport.normalizeEntityQuery(entity);
        List<OrderBundleFetchResponse.OrderBundleEntry> bundles =
                OrcaOrderBundleFetchSupport.collectBundles(documents, normalizedEntity, this::decodeBundle);
        OrderBundleFetchResponse response = OrcaOrderBundleFetchSupport.buildResponse(runId, patientId, bundles);

        Map<String, Object> audit = new HashMap<>();
        audit.put("facilityId", facilityId);
        audit.put("patientId", patientId);
        audit.put("entity", normalizedEntity);
        audit.put("runId", runId);
        audit.put("recordsReturned", bundles.size());
        recordAudit(request, "ORCA_ORDER_BUNDLE_FETCH", audit, AuditEventEnvelope.Outcome.SUCCESS);
        return response;
    }

    @GET
    @Path("/recommendations")
    @Produces(MediaType.APPLICATION_JSON)
    public OrderBundleRecommendationResponse getRecommendations(
            @Context HttpServletRequest request,
            @QueryParam("patientId") String patientId,
            @QueryParam("entity") String entity,
            @QueryParam("from") String from,
            @QueryParam("includeFacility") Boolean includeFacility,
            @QueryParam("patientLimit") Integer patientLimit,
            @QueryParam("facilityLimit") Integer facilityLimit,
            @QueryParam("scanLimit") Integer scanLimit) {

        String runId = resolveRunId(request);
        requireRemoteUser(request);
        String facilityId = requireFacilityId(request);
        OrcaOrderBundleRecommendationFlowSupport.RecommendationFlowResult result = OrcaOrderBundleRecommendationFlowSupport.execute(
                this,
                request,
                patientServiceBean,
                karteServiceBean,
                entityManager,
                LOGGER,
                patientId,
                entity,
                from,
                includeFacility,
                patientLimit,
                facilityLimit,
                scanLimit,
                facilityId,
                runId,
                this::decodeBundle);
        recordAudit(request, "ORCA_ORDER_RECOMMENDATION_FETCH", result.audit(), AuditEventEnvelope.Outcome.SUCCESS);
        return result.response();
    }

    @POST
    @Path("/bundles")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public OrderBundleMutationResponse postBundles(@Context HttpServletRequest request, OrderBundleMutationRequest payload) {
        String runId = resolveRunId(request);
        String remoteUser = requireRemoteUser(request);
        String facilityId = requireFacilityId(request);
        OrcaOrderBundleMutationFlowSupport.MutationFlowResult result = OrcaOrderBundleMutationFlowSupport.execute(
                this,
                LOGGER,
                request,
                payload,
                remoteUser,
                patientServiceBean,
                karteServiceBean,
                userServiceBean,
                facilityId,
                runId);
        recordAudit(request, "ORCA_ORDER_BUNDLE_MUTATION", result.audit(), AuditEventEnvelope.Outcome.SUCCESS);
        return result.response();
    }

    private BundleDolphin decodeBundle(ModuleModel module) {
        return OrcaOrderBundleDisplaySupport.decodeBundle(entityManager, LOGGER, module);
    }
}
