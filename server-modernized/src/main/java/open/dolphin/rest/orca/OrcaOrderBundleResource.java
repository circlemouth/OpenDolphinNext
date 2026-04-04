package open.dolphin.rest.orca;

import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.sql.SQLException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Date;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import open.dolphin.audit.AuditEventEnvelope;
import open.dolphin.infomodel.BundleDolphin;
import open.dolphin.infomodel.ClaimConst;
import open.dolphin.infomodel.DocumentModel;
import open.dolphin.infomodel.IInfoModel;
import open.dolphin.infomodel.KarteBean;
import open.dolphin.infomodel.ModuleModel;
import open.dolphin.infomodel.PatientModel;
import open.dolphin.infomodel.UserModel;
import open.dolphin.rest.dto.orca.OrderBundleFetchResponse;
import open.dolphin.rest.dto.orca.OrderBundleMutationRequest;
import open.dolphin.rest.dto.orca.OrderBundleMutationResponse;
import open.dolphin.rest.dto.orca.OrderBundleRecommendationResponse;
import open.dolphin.rest.dto.orca.OrcaOrderInputSetDetailResponse;
import open.dolphin.rest.dto.orca.OrcaOrderInputSetListResponse;
import open.dolphin.rest.dto.orca.OrcaOrderInteractionCheckRequest;
import open.dolphin.rest.dto.orca.OrcaOrderInteractionCheckResponse;
import open.dolphin.rest.dto.orca.BacteriaOrderMetadata;
import open.dolphin.session.KarteServiceBean;
import open.dolphin.session.PatientServiceBean;
import open.dolphin.session.UserServiceBean;
import open.orca.rest.ORCAConnection;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Order bundle (prescription/order) wrappers for Charts edit panels.
 */
@Path("/orca/order")
public class OrcaOrderBundleResource extends AbstractOrcaRestResource {

    private static final Logger LOGGER = LoggerFactory.getLogger(OrcaOrderBundleResource.class);
    private static final String ORDER_BUNDLE_UNAVAILABLE = "order_bundle_unavailable";
    private static final String ORDER_BUNDLE_ERROR_MESSAGE = "Failed to mutate order bundle";
    public static final String ORDER_BUNDLE_CONTEXT_KEY = "orcaOrderBundleContext";
    private static final String BODY_PART_CODE_PREFIX = "002";
    private static final int DEFAULT_PATIENT_LIMIT = 8;
    private static final int DEFAULT_FACILITY_LIMIT = 8;
    private static final int DEFAULT_SCAN_LIMIT = 800;
    private static final int MAX_LIMIT = 64;
    private static final int MAX_SCAN_LIMIT = 5000;
    private static final int DEFAULT_INPUT_SET_SIZE = 20;
    private static final int MAX_INPUT_SET_SIZE = 100;
    private static final String CLAIM_CLASS_SYSTEM = ClaimConst.CLASS_CODE_ID;

    @Inject
    private PatientServiceBean patientServiceBean;

    @Inject
    private KarteServiceBean karteServiceBean;

    @Inject
    private UserServiceBean userServiceBean;

    @Inject
    private ORCAConnection orcaConnection;

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
    @Path("/inputsets")
    @Produces(MediaType.APPLICATION_JSON)
    public OrcaOrderInputSetListResponse getInputSets(
            @Context HttpServletRequest request,
            @QueryParam("keyword") String keyword,
            @QueryParam("entity") String entity,
            @QueryParam("effective") String effective,
            @QueryParam("page") @DefaultValue("1") Integer page,
            @QueryParam("size") @DefaultValue("20") Integer size) {

        String runId = resolveRunId(request);
        requireRemoteUser(request);
        String facilityId = requireFacilityId(request);
        String normalizedEffective = OrcaOrderBundleRequestSupport.normalizeOrcaDateOrToday(effective);
        int resolvedPage = Math.max(1, page == null ? 1 : page.intValue());
        int resolvedSize = Math.min(MAX_INPUT_SET_SIZE, Math.max(1, size == null ? DEFAULT_INPUT_SET_SIZE : size.intValue()));
        String normalizedEntity = OrcaOrderBundleRequestSupport.normalizeEntityQuery(entity);
        String normalizedKeyword = keyword != null ? keyword.trim() : null;

        if (normalizedEntity != null && !OrcaOrderBundleRequestSupport.isValidEntity(normalizedEntity)) {
            Map<String, Object> audit = new HashMap<>();
            audit.put("facilityId", facilityId);
            audit.put("runId", runId);
            audit.put("validationError", Boolean.TRUE);
            audit.put("field", "entity");
            markFailureDetails(audit, Response.Status.BAD_REQUEST.getStatusCode(), "invalid_request", "entity is invalid");
            recordAudit(request, "ORCA_ORDER_INPUTSET_LIST", audit, AuditEventEnvelope.Outcome.FAILURE);
            throw validationError(request, "entity", "entity is invalid");
        }

        List<OrcaOrderInputSetListResponse.Item> allRows = loadInputSetSummaries(normalizedKeyword, normalizedEffective);
        OrcaOrderInputSetListResponse response = OrcaOrderBundleFetchSupport.buildInputSetListResponse(
                runId,
                resolveTraceId(request),
                allRows,
                normalizedEntity,
                resolvedPage,
                resolvedSize);

        Map<String, Object> audit = new HashMap<>();
        audit.put("facilityId", facilityId);
        audit.put("runId", runId);
        audit.put("keywordPresent", normalizedKeyword != null && !normalizedKeyword.isBlank());
        audit.put("entity", normalizedEntity);
        audit.put("effective", normalizedEffective);
        audit.put("page", resolvedPage);
        audit.put("size", resolvedSize);
        audit.put("totalCount", response.getTotalCount());
        recordAudit(request, "ORCA_ORDER_INPUTSET_LIST", audit, AuditEventEnvelope.Outcome.SUCCESS);
        return response;
    }

    @GET
    @Path("/inputsets/{setCode}")
    @Produces(MediaType.APPLICATION_JSON)
    public OrcaOrderInputSetDetailResponse getInputSetDetail(
            @Context HttpServletRequest request,
            @PathParam("setCode") String setCode,
            @QueryParam("effective") String effective,
            @QueryParam("entity") String entity,
            @QueryParam("name") String name) {

        String runId = resolveRunId(request);
        requireRemoteUser(request);
        String facilityId = requireFacilityId(request);
        String normalizedSetCode = setCode != null ? setCode.trim() : null;
        if (normalizedSetCode == null || normalizedSetCode.isBlank()) {
            Map<String, Object> audit = new HashMap<>();
            audit.put("facilityId", facilityId);
            audit.put("runId", runId);
            audit.put("validationError", Boolean.TRUE);
            audit.put("field", "setCode");
            markFailureDetails(audit, Response.Status.BAD_REQUEST.getStatusCode(), "invalid_request", "setCode is required");
            recordAudit(request, "ORCA_ORDER_INPUTSET_DETAIL", audit, AuditEventEnvelope.Outcome.FAILURE);
            throw validationError(request, "setCode", "setCode is required");
        }
        String normalizedEntity = OrcaOrderBundleRequestSupport.normalizeEntityQuery(entity);
        if (normalizedEntity != null && !OrcaOrderBundleRequestSupport.isValidEntity(normalizedEntity)) {
            Map<String, Object> audit = new HashMap<>();
            audit.put("facilityId", facilityId);
            audit.put("runId", runId);
            audit.put("validationError", Boolean.TRUE);
            audit.put("field", "entity");
            markFailureDetails(audit, Response.Status.BAD_REQUEST.getStatusCode(), "invalid_request", "entity is invalid");
            recordAudit(request, "ORCA_ORDER_INPUTSET_DETAIL", audit, AuditEventEnvelope.Outcome.FAILURE);
            throw validationError(request, "entity", "entity is invalid");
        }
        String normalizedEffective = OrcaOrderBundleRequestSupport.normalizeOrcaDateOrToday(effective);
        OrcaOrderInputSetDetailResponse.Bundle bundle = loadInputSetDetailData(normalizedSetCode, normalizedEffective, name);
        if (bundle == null) {
            Map<String, Object> audit = new HashMap<>();
            audit.put("facilityId", facilityId);
            audit.put("runId", runId);
            audit.put("setCode", normalizedSetCode);
            audit.put("effective", normalizedEffective);
            markFailureDetails(audit, Response.Status.NOT_FOUND.getStatusCode(), "inputset_not_found", "Input set not found");
            recordAudit(request, "ORCA_ORDER_INPUTSET_DETAIL", audit, AuditEventEnvelope.Outcome.FAILURE);
            throw restError(request, Response.Status.NOT_FOUND, "inputset_not_found", "Input set not found");
        }
        bundle.setEntity(OrcaOrderBundle600SubtypeSupport.resolveInputSetEntity(
                normalizedEntity,
                OrcaOrderBundleRequestSupport.normalizeEntityResponse(bundle.getEntity()),
                bundle.getClassCode()));
        if (!OrcaOrderInputSetMetadataSupport.isSupportedEntity(bundle.getEntity())) {
            Map<String, Object> audit = new HashMap<>();
            audit.put("facilityId", facilityId);
            audit.put("runId", runId);
            audit.put("setCode", normalizedSetCode);
            audit.put("effective", normalizedEffective);
            markFailureDetails(audit, Response.Status.NOT_FOUND.getStatusCode(), "inputset_not_found", "Input set not found");
            recordAudit(request, "ORCA_ORDER_INPUTSET_DETAIL", audit, AuditEventEnvelope.Outcome.FAILURE);
            throw restError(request, Response.Status.NOT_FOUND, "inputset_not_found", "Input set not found");
        }
        bundle.setSubtype(OrcaOrderBundle600SubtypeSupport.resolveSubtype(
                normalizedEntity != null ? normalizedEntity : bundle.getEntity(),
                bundle.getSubtype(),
                null));
        bundle.setBacteria(deriveBacteriaFromInputSetBundle(bundle));
        if (normalizedEntity != null && !OrcaOrderBundle600SubtypeSupport.matchesInputSetEntity(
                normalizedEntity, bundle.getEntity(), bundle.getClassCode())) {
            Map<String, Object> audit = new HashMap<>();
            audit.put("facilityId", facilityId);
            audit.put("runId", runId);
            audit.put("setCode", normalizedSetCode);
            audit.put("entity", normalizedEntity);
            markFailureDetails(audit, Response.Status.NOT_FOUND.getStatusCode(), "inputset_not_found", "Input set not found");
            recordAudit(request, "ORCA_ORDER_INPUTSET_DETAIL", audit, AuditEventEnvelope.Outcome.FAILURE);
            throw restError(request, Response.Status.NOT_FOUND, "inputset_not_found", "Input set not found");
        }

        OrcaOrderInputSetDetailResponse response = OrcaOrderBundleFetchSupport.buildInputSetDetailResponse(
                runId,
                resolveTraceId(request),
                normalizedSetCode,
                bundle);

        Map<String, Object> audit = new HashMap<>();
        audit.put("facilityId", facilityId);
        audit.put("runId", runId);
        audit.put("setCode", normalizedSetCode);
        audit.put("entity", bundle.getEntity());
        audit.put("effective", normalizedEffective);
        audit.put("itemCount", bundle.getItems().size());
        recordAudit(request, "ORCA_ORDER_INPUTSET_DETAIL", audit, AuditEventEnvelope.Outcome.SUCCESS);
        return response;
    }

    private static BacteriaOrderMetadata deriveBacteriaFromInputSetBundle(OrcaOrderInputSetDetailResponse.Bundle bundle) {
        if (bundle == null || !IInfoModel.ENTITY_BACTERIA_ORDER.equals(OrcaOrderBundleRequestSupport.normalizeEntityResponse(bundle.getEntity()))) {
            return null;
        }
        BacteriaOrderMetadata metadata = new BacteriaOrderMetadata();
        List<BacteriaOrderMetadata.CarrierComment> comments = new ArrayList<>();
        if (bundle.getItems() != null) {
            for (OrcaOrderInputSetDetailResponse.Item item : bundle.getItems()) {
                if (item == null || !OrcaOrderBundleRecommendationSupport.isCommentCode(item.getCode())) {
                    continue;
                }
                BacteriaOrderMetadata.CarrierComment comment = new BacteriaOrderMetadata.CarrierComment();
                comment.setCode(OrcaOrderBundleRequestSupport.trimToNull(item.getCode()));
                comment.setName(OrcaOrderBundleRequestSupport.trimToNull(item.getName()));
                if (comment.getCode() != null && comment.getCode().matches("^842\\d{6}$")) {
                    comment.setInputValue(OrcaOrderBundleRequestSupport.trimToNull(item.getQuantity()));
                }
                comments.add(comment);
            }
        }
        metadata.setCarrierComments(comments);
        return comments.isEmpty() ? null : metadata;
    }

    @POST
    @Path("/interactions/check")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public OrcaOrderInteractionCheckResponse checkInteractions(
            @Context HttpServletRequest request,
            OrcaOrderInteractionCheckRequest body) {

        String runId = resolveRunId(request);
        requireRemoteUser(request);
        String facilityId = requireFacilityId(request);
        List<String> codes = OrcaOrderInteractionSupport.sanitizeCodes(body != null ? body.getCodes() : null);
        List<String> existingCodes = OrcaOrderInteractionSupport.sanitizeCodes(body != null ? body.getExistingCodes() : null);
        if (codes.isEmpty()) {
            Map<String, Object> audit = new HashMap<>();
            audit.put("facilityId", facilityId);
            audit.put("runId", runId);
            audit.put("validationError", Boolean.TRUE);
            audit.put("field", "codes");
            markFailureDetails(audit, Response.Status.BAD_REQUEST.getStatusCode(), "invalid_request", "codes is required");
            recordAudit(request, "ORCA_ORDER_INTERACTION_CHECK", audit, AuditEventEnvelope.Outcome.FAILURE);
            throw validationError(request, "codes", "codes is required");
        }

        List<OrcaOrderInteractionCheckResponse.Pair> rows = loadInteractionPairs(codes, existingCodes);
        OrcaOrderInteractionCheckResponse response = OrcaOrderBundleFetchSupport.buildInteractionResponse(
                runId,
                resolveTraceId(request),
                rows);

        Map<String, Object> audit = new HashMap<>();
        audit.put("facilityId", facilityId);
        audit.put("runId", runId);
        audit.put("codes", codes.size());
        audit.put("existingCodes", existingCodes.size());
        audit.put("totalCount", response.getTotalCount());
        recordAudit(request, "ORCA_ORDER_INTERACTION_CHECK", audit, AuditEventEnvelope.Outcome.SUCCESS);
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

    protected List<OrcaOrderInputSetListResponse.Item> loadInputSetSummaries(String keyword, String effective) {
        try {
            return OrcaOrderInputSetSupport.loadInputSetSummaries(
                    resolveOrcaConnection(),
                    keyword,
                    effective,
                    CLAIM_CLASS_SYSTEM,
                    receiptCode -> OrcaOrderInputSetMetadataSupport.resolveClassMetadata(receiptCode, LOGGER));
        } catch (SQLException e) {
            throw restError(null, Response.Status.SERVICE_UNAVAILABLE, "inputset_unavailable", "Failed to load input sets");
        }
    }

    protected OrcaOrderInputSetDetailResponse.Bundle loadInputSetDetailData(String setCode, String effective, String requestedName) {
        try {
            return OrcaOrderInputSetSupport.loadInputSetDetail(
                    resolveOrcaConnection(),
                    setCode,
                    effective,
                    requestedName,
                    BODY_PART_CODE_PREFIX,
                    CLAIM_CLASS_SYSTEM,
                    receiptCode -> OrcaOrderInputSetMetadataSupport.resolveClassMetadata(receiptCode, LOGGER));
        } catch (SQLException e) {
            throw restError(null, Response.Status.SERVICE_UNAVAILABLE, "inputset_unavailable", "Failed to load input set detail");
        }
    }

    protected List<OrcaOrderInteractionCheckResponse.Pair> loadInteractionPairs(List<String> codes, List<String> existingCodes) {
        try {
            return OrcaOrderInteractionSupport.loadInteractionPairs(resolveOrcaConnection(), codes, existingCodes);
        } catch (SQLException e) {
            throw restError(null, Response.Status.SERVICE_UNAVAILABLE, "interaction_unavailable", "Failed to check interactions");
        }
    }

    private ORCAConnection resolveOrcaConnection() {
        return orcaConnection != null ? orcaConnection : ORCAConnection.current();
    }
}
