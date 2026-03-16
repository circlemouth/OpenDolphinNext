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
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Date;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import open.dolphin.audit.AuditEventEnvelope;
import open.dolphin.infomodel.BundleDolphin;
import open.dolphin.infomodel.ClaimConst;
import open.dolphin.infomodel.ClaimItem;
import open.dolphin.infomodel.DocInfoModel;
import open.dolphin.infomodel.DocumentModel;
import open.dolphin.infomodel.IInfoModel;
import open.dolphin.infomodel.KarteBean;
import open.dolphin.infomodel.ModelUtils;
import open.dolphin.infomodel.ModuleInfoBean;
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
    private static final String MATERIAL_CODE_PREFIX = "7";
    private static final String BODY_PART_CODE_PREFIX = "002";
    private static final String COMMENT_CODE_REGEX = "^(008[1-6]|8[1-6]|098|099|98|99).*";
    private static final int DEFAULT_PATIENT_LIMIT = 8;
    private static final int DEFAULT_FACILITY_LIMIT = 8;
    private static final int DEFAULT_SCAN_LIMIT = 800;
    private static final int MAX_LIMIT = 64;
    private static final int MAX_SCAN_LIMIT = 5000;
    private static final int DEFAULT_INPUT_SET_SIZE = 20;
    private static final int MAX_INPUT_SET_SIZE = 100;
    private static final String CLAIM_CLASS_SYSTEM = ClaimConst.CLASS_CODE_ID;
    private static final Set<String> ORDER_BUNDLE_ENTITIES = Set.of(
            IInfoModel.ENTITY_GENERAL_ORDER,
            IInfoModel.ENTITY_MED_ORDER,
            IInfoModel.ENTITY_OTHER_ORDER,
            IInfoModel.ENTITY_TREATMENT,
            IInfoModel.ENTITY_SURGERY_ORDER,
            IInfoModel.ENTITY_RADIOLOGY_ORDER,
            IInfoModel.ENTITY_LABO_TEST, // "testOrder"
            "laboTest", // legacy alias used by Web Client
            IInfoModel.ENTITY_PHYSIOLOGY_ORDER,
            IInfoModel.ENTITY_BACTERIA_ORDER,
            IInfoModel.ENTITY_INJECTION_ORDER,
            IInfoModel.ENTITY_BASE_CHARGE_ORDER,
            IInfoModel.ENTITY_INSTRACTION_CHARGE_ORDER);

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
        if (entity != null && !entity.isBlank() && !isValidEntity(entity)) {
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

        Date since = parseDate(from, Date.from(Instant.now().minusSeconds(60L * 60L * 24L * 30L)));
        List<DocumentModel> documents = resolveDocuments(karte, since);
        List<OrderBundleFetchResponse.OrderBundleEntry> bundles = new ArrayList<>();

        for (DocumentModel document : documents) {
            if (document.getModules() == null) {
                continue;
            }
            for (ModuleModel module : document.getModules()) {
                ModuleInfoBean info = module.getModuleInfoBean();
                String moduleEntity = info != null ? info.getEntity() : null;
                if (entity != null && !entity.isBlank() && moduleEntity != null && !moduleEntity.equals(entity)) {
                    continue;
                }
                if (entity != null && !entity.isBlank() && moduleEntity == null) {
                    continue;
                }
                BundleDolphin bundle = decodeBundle(module);
                if (bundle == null) {
                    continue;
                }
                OrderBundleFetchResponse.OrderBundleEntry entry = new OrderBundleFetchResponse.OrderBundleEntry();
                entry.setDocumentId(document.getId());
                entry.setModuleId(module.getId());
                entry.setEntity(moduleEntity);
                entry.setBundleName(resolveBundleName(bundle, info));
                entry.setBundleNumber(bundle.getBundleNumber());
                entry.setClassCode(bundle.getClassCode());
                entry.setClassCodeSystem(bundle.getClassCodeSystem());
                entry.setClassName(bundle.getClassName());
                entry.setAdmin(bundle.getAdmin());
                entry.setAdminMemo(bundle.getAdminMemo());
                entry.setMemo(bundle.getMemo());
                entry.setStarted(formatDate(module.getStarted()));
                UserModel enteredBy = resolveEnteredByUser(module, document);
                entry.setEnteredByName(resolveEnteredByName(enteredBy));
                entry.setEnteredByRole(resolveEnteredByRole(enteredBy));
                List<OrderBundleFetchResponse.OrderBundleItem> items = toItems(bundle.getClaimItem());
                entry.setBodyPart(extractBodyPart(items));
                entry.setItems(items);
                bundles.add(entry);
            }
        }

        OrderBundleFetchResponse response = new OrderBundleFetchResponse();
        response.setApiResult("00");
        response.setApiResultMessage("処理終了");
        response.setRunId(runId);
        response.setPatientId(patientId);
        response.setBundles(bundles);
        response.setRecordsReturned(bundles.size());

        Map<String, Object> audit = new HashMap<>();
        audit.put("facilityId", facilityId);
        audit.put("patientId", patientId);
        audit.put("entity", entity);
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
        String normalizedEffective = normalizeOrcaDateOrToday(effective);
        int resolvedPage = Math.max(1, page == null ? 1 : page.intValue());
        int resolvedSize = Math.min(MAX_INPUT_SET_SIZE, Math.max(1, size == null ? DEFAULT_INPUT_SET_SIZE : size.intValue()));
        String normalizedEntity = normalizeEntityQuery(entity);
        String normalizedKeyword = keyword != null ? keyword.trim() : null;

        if (normalizedEntity != null && !isValidEntity(normalizedEntity)) {
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
        List<OrcaOrderInputSetListResponse.Item> filtered = allRows.stream()
                .filter(row -> normalizedEntity == null || normalizedEntity.equals(row.getEntity()))
                .sorted(Comparator.comparing(OrcaOrderInputSetListResponse.Item::getSetCode))
                .collect(Collectors.toList());
        int fromIndex = Math.min(filtered.size(), (resolvedPage - 1) * resolvedSize);
        int toIndex = Math.min(filtered.size(), fromIndex + resolvedSize);

        OrcaOrderInputSetListResponse response = new OrcaOrderInputSetListResponse();
        response.setTotalCount(filtered.size());
        response.setRunId(runId);
        response.setTraceId(resolveTraceId(request));
        response.setItems(new ArrayList<>(filtered.subList(fromIndex, toIndex)));

        Map<String, Object> audit = new HashMap<>();
        audit.put("facilityId", facilityId);
        audit.put("runId", runId);
        audit.put("keywordPresent", normalizedKeyword != null && !normalizedKeyword.isBlank());
        audit.put("entity", normalizedEntity);
        audit.put("effective", normalizedEffective);
        audit.put("page", resolvedPage);
        audit.put("size", resolvedSize);
        audit.put("totalCount", filtered.size());
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
        String normalizedEntity = normalizeEntityQuery(entity);
        if (normalizedEntity != null && !isValidEntity(normalizedEntity)) {
            Map<String, Object> audit = new HashMap<>();
            audit.put("facilityId", facilityId);
            audit.put("runId", runId);
            audit.put("validationError", Boolean.TRUE);
            audit.put("field", "entity");
            markFailureDetails(audit, Response.Status.BAD_REQUEST.getStatusCode(), "invalid_request", "entity is invalid");
            recordAudit(request, "ORCA_ORDER_INPUTSET_DETAIL", audit, AuditEventEnvelope.Outcome.FAILURE);
            throw validationError(request, "entity", "entity is invalid");
        }
        String normalizedEffective = normalizeOrcaDateOrToday(effective);
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
        if (normalizedEntity != null && !normalizedEntity.equals(bundle.getEntity())) {
            Map<String, Object> audit = new HashMap<>();
            audit.put("facilityId", facilityId);
            audit.put("runId", runId);
            audit.put("setCode", normalizedSetCode);
            audit.put("entity", normalizedEntity);
            markFailureDetails(audit, Response.Status.NOT_FOUND.getStatusCode(), "inputset_not_found", "Input set not found");
            recordAudit(request, "ORCA_ORDER_INPUTSET_DETAIL", audit, AuditEventEnvelope.Outcome.FAILURE);
            throw restError(request, Response.Status.NOT_FOUND, "inputset_not_found", "Input set not found");
        }

        OrcaOrderInputSetDetailResponse response = new OrcaOrderInputSetDetailResponse();
        response.setOk(true);
        response.setSetCode(normalizedSetCode);
        response.setBundle(bundle);
        response.setRunId(runId);
        response.setTraceId(resolveTraceId(request));

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
        List<String> codes = sanitizeInteractionCodes(body != null ? body.getCodes() : null);
        List<String> existingCodes = sanitizeInteractionCodes(body != null ? body.getExistingCodes() : null);
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
        OrcaOrderInteractionCheckResponse response = new OrcaOrderInteractionCheckResponse();
        response.setOk(true);
        response.setPairs(rows);
        response.setTotalCount(rows.size());
        response.setRunId(runId);
        response.setTraceId(resolveTraceId(request));

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
        if (patientId == null || patientId.isBlank()) {
            Map<String, Object> audit = new HashMap<>();
            audit.put("facilityId", facilityId);
            audit.put("runId", runId);
            audit.put("validationError", Boolean.TRUE);
            audit.put("field", "patientId");
            markFailureDetails(audit, Response.Status.BAD_REQUEST.getStatusCode(), "invalid_request", "patientId is required");
            recordAudit(request, "ORCA_ORDER_RECOMMENDATION_FETCH", audit, AuditEventEnvelope.Outcome.FAILURE);
            throw validationError(request, "patientId", "patientId is required");
        }
        if (entity != null && !entity.isBlank() && !isValidEntity(entity)) {
            Map<String, Object> audit = new HashMap<>();
            audit.put("facilityId", facilityId);
            audit.put("patientId", patientId);
            audit.put("runId", runId);
            audit.put("validationError", Boolean.TRUE);
            audit.put("field", "entity");
            audit.put("entity", entity);
            markFailureDetails(audit, Response.Status.BAD_REQUEST.getStatusCode(), "invalid_request", "entity is invalid");
            recordAudit(request, "ORCA_ORDER_RECOMMENDATION_FETCH", audit, AuditEventEnvelope.Outcome.FAILURE);
            throw validationError(request, "entity", "entity is invalid");
        }

        PatientModel patient = patientServiceBean.getPatientById(facilityId, patientId);
        if (patient == null) {
            Map<String, Object> audit = new HashMap<>();
            audit.put("facilityId", facilityId);
            audit.put("patientId", patientId);
            audit.put("runId", runId);
            markFailureDetails(audit, Response.Status.NOT_FOUND.getStatusCode(), "patient_not_found", "Patient not found");
            recordAudit(request, "ORCA_ORDER_RECOMMENDATION_FETCH", audit, AuditEventEnvelope.Outcome.FAILURE);
            throw restError(request, Response.Status.NOT_FOUND, "patient_not_found", "Patient not found");
        }

        KarteBean karte = karteServiceBean.getKarte(facilityId, patientId, null);
        if (karte == null) {
            Map<String, Object> audit = new HashMap<>();
            audit.put("facilityId", facilityId);
            audit.put("patientId", patientId);
            audit.put("runId", runId);
            markFailureDetails(audit, Response.Status.NOT_FOUND.getStatusCode(), "karte_not_found", "Karte not found");
            recordAudit(request, "ORCA_ORDER_RECOMMENDATION_FETCH", audit, AuditEventEnvelope.Outcome.FAILURE);
            throw restError(request, Response.Status.NOT_FOUND, "karte_not_found", "Karte not found");
        }

        boolean includeFacilityRows = includeFacility == null || includeFacility;
        int resolvedPatientLimit = clampLimit(patientLimit, DEFAULT_PATIENT_LIMIT);
        int resolvedFacilityLimit = clampOptionalLimit(facilityLimit, DEFAULT_FACILITY_LIMIT);
        int resolvedScanLimit = clampScanLimit(scanLimit);
        String resolvedEntity = hasText(entity) ? entity.trim() : null;
        Date since = parseDate(from, Date.from(Instant.now().minusSeconds(60L * 60L * 24L * 180L)));

        Map<String, RecommendationAggregate> patientAggregates = new LinkedHashMap<>();
        int patientScanned = collectAggregatesFromPatient(
                facilityId,
                patientId,
                karte,
                resolvedEntity,
                since,
                resolvedScanLimit,
                patientAggregates);
        List<RecommendationAggregate> sortedPatientAggregates = sortAggregates(patientAggregates);
        int facilityFallbackNeeded = includeFacilityRows
                ? Math.max(0, resolvedPatientLimit - Math.min(resolvedPatientLimit, sortedPatientAggregates.size()))
                : 0;
        int effectiveFacilityLimit = Math.min(resolvedFacilityLimit, facilityFallbackNeeded);

        Map<String, RecommendationAggregate> facilityAggregates = new LinkedHashMap<>();
        int facilityScanned = 0;
        if (includeFacilityRows && effectiveFacilityLimit > 0) {
            facilityScanned = collectAggregatesFromFacility(facilityId, patientId, resolvedEntity, since, resolvedScanLimit,
                    facilityAggregates);
        }
        int scanned = patientScanned + facilityScanned;

        List<OrderBundleRecommendationResponse.OrderRecommendationEntry> recommendations = new ArrayList<>();
        Map<String, Boolean> usedKeys = new HashMap<>();
        for (RecommendationAggregate aggregate : sortedPatientAggregates) {
            if (recommendations.size() >= resolvedPatientLimit) {
                break;
            }
            recommendations.add(toRecommendationEntry(aggregate, "patient"));
            usedKeys.put(aggregate.key(), Boolean.TRUE);
        }
        int facilityFallbackApplied = 0;
        if (includeFacilityRows && effectiveFacilityLimit > 0) {
            int facilityAdded = 0;
            for (RecommendationAggregate aggregate : sortAggregates(facilityAggregates)) {
                if (facilityAdded >= effectiveFacilityLimit) {
                    break;
                }
                if (usedKeys.containsKey(aggregate.key())) {
                    continue;
                }
                recommendations.add(toRecommendationEntry(aggregate, "facility"));
                usedKeys.put(aggregate.key(), Boolean.TRUE);
                facilityAdded++;
            }
            facilityFallbackApplied = facilityAdded;
        }

        OrderBundleRecommendationResponse response = new OrderBundleRecommendationResponse();
        response.setApiResult("00");
        response.setApiResultMessage("処理終了");
        response.setRunId(runId);
        response.setPatientId(patientId);
        response.setEntity(resolvedEntity);
        response.setRecordsScanned(scanned);
        response.setRecordsReturned(recommendations.size());
        response.setRecommendations(recommendations);

        Map<String, Object> audit = new HashMap<>();
        audit.put("facilityId", facilityId);
        audit.put("patientId", patientId);
        audit.put("entity", resolvedEntity);
        audit.put("runId", runId);
        audit.put("includeFacility", includeFacilityRows);
        audit.put("patientLimit", resolvedPatientLimit);
        audit.put("facilityLimit", resolvedFacilityLimit);
        audit.put("effectiveFacilityLimit", effectiveFacilityLimit);
        audit.put("facilityFallbackNeeded", facilityFallbackNeeded);
        audit.put("facilityFallbackApplied", facilityFallbackApplied);
        audit.put("scanLimit", resolvedScanLimit);
        audit.put("patientScanned", patientScanned);
        audit.put("facilityScanned", facilityScanned);
        audit.put("recordsScanned", scanned);
        audit.put("recordsReturned", recommendations.size());
        recordAudit(request, "ORCA_ORDER_RECOMMENDATION_FETCH", audit, AuditEventEnvelope.Outcome.SUCCESS);
        return response;
    }

    @POST
    @Path("/bundles")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public OrderBundleMutationResponse postBundles(@Context HttpServletRequest request, OrderBundleMutationRequest payload) {
        String runId = resolveRunId(request);
        String remoteUser = requireRemoteUser(request);
        String facilityId = requireFacilityId(request);
        Map<String, Object> orderBundleContext = new HashMap<>();
        orderBundleContext.put("facilityId", facilityId);
        orderBundleContext.put("runId", runId);
        if (payload == null || payload.getPatientId() == null || payload.getPatientId().isBlank()) {
            Map<String, Object> audit = new HashMap<>();
            audit.put("facilityId", facilityId);
            audit.put("runId", runId);
            audit.put("validationError", Boolean.TRUE);
            audit.put("field", "patientId");
            markFailureDetails(audit, Response.Status.BAD_REQUEST.getStatusCode(), "invalid_request", "patientId is required");
            recordAudit(request, "ORCA_ORDER_BUNDLE_MUTATION", audit, AuditEventEnvelope.Outcome.FAILURE);
            throw validationError(request, "patientId", "patientId is required");
        }

        PatientModel patient = patientServiceBean.getPatientById(facilityId, payload.getPatientId());
        if (patient == null) {
            Map<String, Object> audit = new HashMap<>();
            audit.put("facilityId", facilityId);
            audit.put("patientId", payload.getPatientId());
            audit.put("runId", runId);
            markFailureDetails(audit, Response.Status.NOT_FOUND.getStatusCode(), "patient_not_found", "Patient not found");
            recordAudit(request, "ORCA_ORDER_BUNDLE_MUTATION", audit, AuditEventEnvelope.Outcome.FAILURE);
            throw restError(request, Response.Status.NOT_FOUND, "patient_not_found", "Patient not found");
        }
        orderBundleContext.put("patientId", payload.getPatientId());
        request.setAttribute(ORDER_BUNDLE_CONTEXT_KEY, orderBundleContext);

        KarteBean karte = karteServiceBean.getKarte(facilityId, payload.getPatientId(), null);
        if (karte == null) {
            Map<String, Object> audit = new HashMap<>();
            audit.put("facilityId", facilityId);
            audit.put("patientId", payload.getPatientId());
            audit.put("runId", runId);
            markFailureDetails(audit, Response.Status.NOT_FOUND.getStatusCode(), "karte_not_found", "Karte not found");
            recordAudit(request, "ORCA_ORDER_BUNDLE_MUTATION", audit, AuditEventEnvelope.Outcome.FAILURE);
            throw restError(request, Response.Status.NOT_FOUND, "karte_not_found", "Karte not found");
        }
        Long karteId = karte.getId();
        orderBundleContext.put("karteId", karteId);

        if (payload.getOperations() == null || payload.getOperations().isEmpty()) {
            Map<String, Object> audit = new HashMap<>();
            audit.put("facilityId", facilityId);
            audit.put("patientId", payload.getPatientId());
            audit.put("runId", runId);
            audit.put("validationError", Boolean.TRUE);
            audit.put("field", "operations");
            markFailureDetails(audit, Response.Status.BAD_REQUEST.getStatusCode(), "invalid_request", "operations is required");
            recordAudit(request, "ORCA_ORDER_BUNDLE_MUTATION", audit, AuditEventEnvelope.Outcome.FAILURE);
            throw validationError(request, "operations", "operations is required");
        }
        UserModel user = userServiceBean.getUser(remoteUser);

        List<Long> created = new ArrayList<>();
        List<Long> updated = new ArrayList<>();
        List<Long> deleted = new ArrayList<>();

        if (payload.getOperations() != null) {
            for (OrderBundleMutationRequest.BundleOperation op : payload.getOperations()) {
                if (op == null || op.getOperation() == null || op.getOperation().isBlank()) {
                    Map<String, Object> audit = new HashMap<>();
                    audit.put("facilityId", facilityId);
                    audit.put("patientId", payload.getPatientId());
                    audit.put("runId", runId);
                    audit.put("validationError", Boolean.TRUE);
                    audit.put("field", "operation");
                    markFailureDetails(audit, Response.Status.BAD_REQUEST.getStatusCode(), "invalid_request", "operation is required");
                    recordAudit(request, "ORCA_ORDER_BUNDLE_MUTATION", audit, AuditEventEnvelope.Outcome.FAILURE);
                    throw validationError(request, "operation", "operation is required");
                }
                String operation = op.getOperation().toLowerCase(Locale.ROOT);
                if (!isSupportedOperation(operation)) {
                    Map<String, Object> audit = new HashMap<>();
                    audit.put("facilityId", facilityId);
                    audit.put("patientId", payload.getPatientId());
                    audit.put("runId", runId);
                    audit.put("validationError", Boolean.TRUE);
                    audit.put("field", "operation");
                    audit.put("operation", op.getOperation());
                    markFailureDetails(audit, Response.Status.BAD_REQUEST.getStatusCode(), "invalid_request", "operation is invalid");
                    recordAudit(request, "ORCA_ORDER_BUNDLE_MUTATION", audit, AuditEventEnvelope.Outcome.FAILURE);
                    throw validationError(request, "operation", "operation is invalid");
                }
                if (op.getEntity() != null && !op.getEntity().isBlank() && !isValidEntity(op.getEntity())) {
                    Map<String, Object> audit = new HashMap<>();
                    audit.put("facilityId", facilityId);
                    audit.put("patientId", payload.getPatientId());
                    audit.put("runId", runId);
                    audit.put("validationError", Boolean.TRUE);
                    audit.put("field", "entity");
                    audit.put("entity", op.getEntity());
                    markFailureDetails(audit, Response.Status.BAD_REQUEST.getStatusCode(), "invalid_request", "entity is invalid");
                    recordAudit(request, "ORCA_ORDER_BUNDLE_MUTATION", audit, AuditEventEnvelope.Outcome.FAILURE);
                    throw validationError(request, "entity", "entity is invalid");
                }
                Date performDate = null;
                if ("create".equals(operation) || "update".equals(operation)) {
                    performDate = requireMutationDate(request, facilityId, payload.getPatientId(), runId,
                            op.getOperation(), "startDate", op.getStartDate(), true);
                    requireMutationDate(request, facilityId, payload.getPatientId(), runId,
                            op.getOperation(), "endDate", op.getEndDate(), false);
                }
                orderBundleContext.put("operation", operation);
                if (op.getDocumentId() != null) {
                    orderBundleContext.put("documentId", op.getDocumentId());
                } else {
                    orderBundleContext.remove("documentId");
                }
                switch (operation) {
                    case "create" -> {
                        try {
                            DocumentModel document = buildDocument(karte, user, op, performDate);
                            long id = karteServiceBean.addDocument(document);
                            karteServiceBean.flush();
                            created.add(id);
                        } catch (RuntimeException ex) {
                            throw buildOrderBundleFailure(request, runId, facilityId, payload.getPatientId(), karteId,
                                    null, operation, ex);
                        }
                    }
                    case "update" -> {
                        Long documentId = op.getDocumentId();
                        if (documentId == null || documentId <= 0) {
                            Map<String, Object> audit = new HashMap<>();
                            audit.put("facilityId", facilityId);
                            audit.put("patientId", payload.getPatientId());
                            audit.put("runId", runId);
                            audit.put("validationError", Boolean.TRUE);
                            audit.put("field", "documentId");
                            markFailureDetails(audit, Response.Status.BAD_REQUEST.getStatusCode(), "invalid_request",
                                    "documentId is required");
                            recordAudit(request, "ORCA_ORDER_BUNDLE_MUTATION", audit, AuditEventEnvelope.Outcome.FAILURE);
                            throw validationError(request, "documentId", "documentId is required");
                        }
                        DocumentModel document = fetchDocument(documentId);
                        if (document == null) {
                            continue;
                        }
                        try {
                            updateDocumentWithBundle(document, user, op, performDate);
                            karteServiceBean.updateDocument(document);
                            karteServiceBean.flush();
                            updated.add(documentId);
                        } catch (RuntimeException ex) {
                            throw buildOrderBundleFailure(request, runId, facilityId, payload.getPatientId(), karteId,
                                    documentId, operation, ex);
                        }
                    }
                    case "delete" -> {
                        Long documentId = op.getDocumentId();
                        if (documentId == null || documentId <= 0) {
                            Map<String, Object> audit = new HashMap<>();
                            audit.put("facilityId", facilityId);
                            audit.put("patientId", payload.getPatientId());
                            audit.put("runId", runId);
                            audit.put("validationError", Boolean.TRUE);
                            audit.put("field", "documentId");
                            markFailureDetails(audit, Response.Status.BAD_REQUEST.getStatusCode(), "invalid_request",
                                    "documentId is required");
                            recordAudit(request, "ORCA_ORDER_BUNDLE_MUTATION", audit, AuditEventEnvelope.Outcome.FAILURE);
                            throw validationError(request, "documentId", "documentId is required");
                        }
                        try {
                            karteServiceBean.deleteDocument(documentId);
                            karteServiceBean.flush();
                            deleted.add(documentId);
                        } catch (RuntimeException ex) {
                            throw buildOrderBundleFailure(request, runId, facilityId, payload.getPatientId(), karteId,
                                    documentId, operation, ex);
                        }
                    }
                    default -> {
                    }
                }
            }
        }

        OrderBundleMutationResponse response = new OrderBundleMutationResponse();
        response.setApiResult("00");
        response.setApiResultMessage("処理終了");
        response.setRunId(runId);
        response.setCreatedDocumentIds(created);
        response.setUpdatedDocumentIds(updated);
        response.setDeletedDocumentIds(deleted);

        Map<String, Object> audit = new HashMap<>();
        audit.put("facilityId", facilityId);
        audit.put("patientId", payload.getPatientId());
        audit.put("runId", runId);
        audit.put("created", created.size());
        audit.put("updated", updated.size());
        audit.put("deleted", deleted.size());
        recordAudit(request, "ORCA_ORDER_BUNDLE_MUTATION", audit, AuditEventEnvelope.Outcome.SUCCESS);
        return response;
    }

    private RuntimeException buildOrderBundleFailure(HttpServletRequest request,
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
        markFailureDetails(details, Response.Status.SERVICE_UNAVAILABLE.getStatusCode(),
                ORDER_BUNDLE_UNAVAILABLE, ORDER_BUNDLE_ERROR_MESSAGE);
        recordAudit(request, "ORCA_ORDER_BUNDLE_MUTATION", details, AuditEventEnvelope.Outcome.FAILURE);
        LOGGER.warn("Order bundle mutation failed (patientId={}, karteId={}, documentId={}, operation={}, runId={})",
                patientId, karteId, documentId, operation, runId, ex);
        return restError(request, Response.Status.SERVICE_UNAVAILABLE,
                ORDER_BUNDLE_UNAVAILABLE, ORDER_BUNDLE_ERROR_MESSAGE, details, ex);
    }

    private DocumentModel buildDocument(KarteBean karte, UserModel user, OrderBundleMutationRequest.BundleOperation op,
            Date performDate) {
        Date now = new Date();
        DocumentModel document = new DocumentModel();
        document.setKarteBean(karte);
        document.setUserModel(user);
        document.setStarted(performDate);
        document.setConfirmed(performDate);
        document.setRecorded(now);
        document.setStatus(IInfoModel.STATUS_FINAL);

        DocInfoModel info = document.getDocInfoModel();
        info.setDocId(UUID.randomUUID().toString().replace("-", ""));
        info.setDocType(IInfoModel.DOCTYPE_KARTE);
        info.setTitle(resolveTitle(op));
        info.setPurpose(IInfoModel.PURPOSE_RECORD);
        info.setVersionNumber("1.0");

        ModuleModel module = buildModule(karte, user, document, op, performDate, now);
        document.setModules(List.of(module));
        return document;
    }

    private void updateDocumentWithBundle(DocumentModel document, UserModel user,
            OrderBundleMutationRequest.BundleOperation op, Date performDate) {
        Date now = new Date();
        document.setStarted(performDate);
        document.setConfirmed(performDate);
        document.setRecorded(now);
        document.setStatus(IInfoModel.STATUS_FINAL);
        DocInfoModel info = document.getDocInfoModel();
        if (info != null) {
            info.setTitle(resolveTitle(op));
        }
        ModuleModel module = buildModule(document.getKarteBean(), user, document, op, performDate, now);
        if (op.getModuleId() != null && op.getModuleId() > 0) {
            module.setId(op.getModuleId());
        } else if (document.getModules() != null && !document.getModules().isEmpty()) {
            module.setId(document.getModules().get(0).getId());
        }
        document.setModules(List.of(module));
    }

    private ModuleModel buildModule(KarteBean karte, UserModel user, DocumentModel document,
            OrderBundleMutationRequest.BundleOperation op, Date performDate, Date now) {
        BundleDolphin bundle = new BundleDolphin();
        bundle.setOrderName(op.getBundleName());
        bundle.setBundleNumber(hasText(op.getBundleNumber()) ? op.getBundleNumber() : "1");
        bundle.setAdmin(op.getAdmin());
        bundle.setAdminMemo(op.getAdminMemo());
        bundle.setMemo(op.getMemo());
        if (hasText(op.getClassName())) {
            bundle.setClassName(op.getClassName());
        } else if (hasText(op.getBundleName())) {
            bundle.setClassName(op.getBundleName());
        }
        if (hasText(op.getClassCode())) {
            bundle.setClassCode(op.getClassCode());
            bundle.setClassCodeSystem(hasText(op.getClassCodeSystem()) ? op.getClassCodeSystem() : ClaimConst.CLASS_CODE_ID);
        }
        bundle.setClaimItem(toClaimItems(op));

        ModuleModel module = new ModuleModel();
        ModuleInfoBean info = new ModuleInfoBean();
        info.setStampName(op.getBundleName() != null ? op.getBundleName() : resolveTitle(op));
        info.setStampRole(IInfoModel.ROLE_P);
        info.setEntity(resolveEntity(op));
        info.setStampNumber(0);
        module.setModuleInfoBean(info);
        module.setModel(bundle);
        module.setBeanJson(ModelUtils.encodeModule(module));
        module.setKarteBean(karte);
        module.setUserModel(user);
        module.setStarted(performDate);
        module.setConfirmed(performDate);
        module.setRecorded(now);
        module.setStatus(IInfoModel.STATUS_FINAL);
        module.setDocumentModel(document);
        return module;
    }

    private ClaimItem[] toClaimItems(OrderBundleMutationRequest.BundleOperation op) {
        List<ClaimItem> converted = new ArrayList<>();
        List<OrderBundleMutationRequest.BundleItem> items = op != null ? op.getItems() : null;
        if (items != null) {
            for (OrderBundleMutationRequest.BundleItem item : items) {
                ClaimItem claimItem = toClaimItem(item);
                if (claimItem != null) {
                    converted.add(claimItem);
                }
            }
        }
        ClaimItem explicitBodyPart = toClaimItem(op != null ? op.getBodyPart() : null);
        if (explicitBodyPart != null) {
            List<ClaimItem> prioritized = new ArrayList<>();
            prioritized.add(explicitBodyPart);
            for (ClaimItem claimItem : converted) {
                if (claimItem != null && !isBodyPartCode(claimItem.getCode())) {
                    prioritized.add(claimItem);
                }
            }
            converted = prioritized;
        }
        return converted.isEmpty() ? null : converted.toArray(new ClaimItem[0]);
    }

    private ClaimItem toClaimItem(OrderBundleMutationRequest.BundleItem item) {
        if (item == null || item.getName() == null || item.getName().isBlank()) {
            return null;
        }
        ClaimItem claimItem = new ClaimItem();
        claimItem.setName(item.getName());
        claimItem.setCode(item.getCode());
        claimItem.setNumber(item.getQuantity());
        claimItem.setUnit(item.getUnit());
        claimItem.setMemo(item.getMemo());
        return claimItem;
    }

    private String resolveEntity(OrderBundleMutationRequest.BundleOperation op) {
        if (op.getEntity() != null && !op.getEntity().isBlank()) {
            return op.getEntity().trim();
        }
        return IInfoModel.ENTITY_GENERAL_ORDER;
    }

    private String resolveTitle(OrderBundleMutationRequest.BundleOperation op) {
        String entity = resolveEntity(op);
        if (IInfoModel.ENTITY_MED_ORDER.equals(entity)) {
            return "処方";
        }
        return "オーダー";
    }

    private List<OrderBundleFetchResponse.OrderBundleItem> toItems(ClaimItem[] items) {
        if (items == null || items.length == 0) {
            return List.of();
        }
        List<OrderBundleFetchResponse.OrderBundleItem> list = new ArrayList<>();
        for (ClaimItem item : items) {
            if (item == null) {
                continue;
            }
            OrderBundleFetchResponse.OrderBundleItem entry = new OrderBundleFetchResponse.OrderBundleItem();
            entry.setCode(item.getCode());
            entry.setName(item.getName());
            entry.setQuantity(item.getNumber());
            entry.setUnit(item.getUnit());
            entry.setMemo(item.getMemo());
            list.add(entry);
        }
        return list;
    }

    private OrderBundleFetchResponse.OrderBundleItem extractBodyPart(
            List<OrderBundleFetchResponse.OrderBundleItem> items) {
        if (items == null || items.isEmpty()) {
            return null;
        }
        for (OrderBundleFetchResponse.OrderBundleItem item : items) {
            if (item == null) {
                continue;
            }
            if (isBodyPartCode(item.getCode())) {
                return item;
            }
        }
        return null;
    }

    private int collectAggregatesFromDocuments(List<DocumentModel> documents,
            String entity,
            Map<String, RecommendationAggregate> aggregates) {
        if (documents == null || documents.isEmpty()) {
            return 0;
        }
        int scanned = 0;
        for (DocumentModel document : documents) {
            if (document.getModules() == null || document.getModules().isEmpty()) {
                continue;
            }
            for (ModuleModel module : document.getModules()) {
                String moduleEntity = module.getModuleInfoBean() != null ? module.getModuleInfoBean().getEntity() : null;
                if (entity != null && !entity.equals(moduleEntity)) {
                    continue;
                }
                if (!hasText(moduleEntity) || !isValidEntity(moduleEntity)) {
                    continue;
                }
                BundleDolphin bundle = decodeBundle(module);
                if (bundle == null) {
                    continue;
                }
                OrderBundleRecommendationResponse.OrderRecommendationTemplate template =
                        toRecommendationTemplate(bundle, module.getModuleInfoBean(), moduleEntity);
                String key = buildRecommendationKey(moduleEntity, template);
                Date usedAt = module.getStarted() != null
                        ? module.getStarted()
                        : document.getStarted();
                upsertAggregate(aggregates, key, moduleEntity, template, usedAt);
                scanned++;
            }
        }
        return scanned;
    }

    private int collectAggregatesFromPatient(String facilityId,
            String patientId,
            KarteBean karte,
            String entity,
            Date fromDate,
            int scanLimit,
            Map<String, RecommendationAggregate> aggregates) {
        if (entityManager != null && scanLimit > 0) {
            List<ModuleModel> modules;
            try {
                StringBuilder jpql = new StringBuilder(
                        "SELECT m FROM ModuleModel m JOIN m.karte k JOIN k.patient p "
                                + "WHERE p.facilityId = :facilityId AND p.patientId = :patientId");
                if (entity != null) {
                    jpql.append(" AND m.moduleInfo.entity = :entity");
                }
                if (fromDate != null) {
                    jpql.append(" AND m.started >= :fromDate");
                }
                jpql.append(" ORDER BY m.started DESC");
                var query = entityManager.createQuery(jpql.toString(), ModuleModel.class)
                        .setParameter("facilityId", facilityId)
                        .setParameter("patientId", patientId)
                        .setMaxResults(scanLimit);
                if (entity != null) {
                    query.setParameter("entity", entity);
                }
                if (fromDate != null) {
                    query.setParameter("fromDate", fromDate);
                }
                modules = query.getResultList();
                return collectAggregatesFromModules(modules, entity, aggregates);
            } catch (RuntimeException ex) {
                LOGGER.warn(
                        "Failed to load patient order recommendation rows with JPQL, falling back to document scan (facilityId={}, patientId={}, entity={})",
                        facilityId,
                        patientId,
                        entity,
                        ex);
            }
        }
        List<DocumentModel> documents = resolveDocuments(karte, fromDate, scanLimit);
        return collectAggregatesFromDocuments(documents, entity, aggregates);
    }

    private int collectAggregatesFromFacility(String facilityId,
            String patientId,
            String entity,
            Date fromDate,
            int scanLimit,
            Map<String, RecommendationAggregate> aggregates) {
        if (entityManager == null || scanLimit <= 0) {
            return 0;
        }
        StringBuilder jpql = new StringBuilder(
                "SELECT m FROM ModuleModel m JOIN m.karte k JOIN k.patient p "
                        + "WHERE p.facilityId = :facilityId AND p.patientId <> :patientId");
        if (entity != null) {
            jpql.append(" AND m.moduleInfo.entity = :entity");
        }
        if (fromDate != null) {
            jpql.append(" AND m.started >= :fromDate");
        }
        jpql.append(" ORDER BY m.started DESC");
        List<ModuleModel> modules;
        try {
            var query = entityManager.createQuery(jpql.toString(), ModuleModel.class)
                    .setParameter("facilityId", facilityId)
                    .setParameter("patientId", patientId)
                    .setMaxResults(scanLimit);
            if (entity != null) {
                query.setParameter("entity", entity);
            }
            if (fromDate != null) {
                query.setParameter("fromDate", fromDate);
            }
            modules = query.getResultList();
        } catch (RuntimeException ex) {
            LOGGER.warn("Failed to load facility order recommendation rows (facilityId={}, patientId={}, entity={})",
                    facilityId, patientId, entity, ex);
            return 0;
        }
        return collectAggregatesFromModules(modules, entity, aggregates);
    }

    private int collectAggregatesFromModules(List<ModuleModel> modules,
            String entity,
            Map<String, RecommendationAggregate> aggregates) {
        int scanned = 0;
        if (modules == null || modules.isEmpty()) {
            return scanned;
        }
        for (ModuleModel module : modules) {
            String moduleEntity = module.getModuleInfoBean() != null ? module.getModuleInfoBean().getEntity() : null;
            if (!hasText(moduleEntity) || !isValidEntity(moduleEntity)) {
                continue;
            }
            if (entity != null && !entity.equals(moduleEntity)) {
                continue;
            }
            BundleDolphin bundle = decodeBundle(module);
            if (bundle == null) {
                continue;
            }
            OrderBundleRecommendationResponse.OrderRecommendationTemplate template =
                    toRecommendationTemplate(bundle, module.getModuleInfoBean(), moduleEntity);
            String key = buildRecommendationKey(moduleEntity, template);
            upsertAggregate(aggregates, key, moduleEntity, template, module.getStarted());
            scanned++;
        }
        return scanned;
    }

    private void upsertAggregate(Map<String, RecommendationAggregate> aggregates,
            String key,
            String entity,
            OrderBundleRecommendationResponse.OrderRecommendationTemplate template,
            Date usedAt) {
        RecommendationAggregate current = aggregates.get(key);
        if (current == null) {
            aggregates.put(key, new RecommendationAggregate(key, entity, template, 1, usedAt));
            return;
        }
        Date nextUsedAt = current.lastUsedAt();
        if (usedAt != null && (nextUsedAt == null || usedAt.after(nextUsedAt))) {
            nextUsedAt = usedAt;
        }
        aggregates.put(key, new RecommendationAggregate(
                current.key(),
                current.entity(),
                current.template(),
                current.count() + 1,
                nextUsedAt));
    }

    private List<RecommendationAggregate> sortAggregates(Map<String, RecommendationAggregate> aggregates) {
        Comparator<Date> dateComparator = Comparator.nullsLast(Comparator.naturalOrder());
        return aggregates.values().stream()
                .sorted((left, right) -> {
                    if (left.count() != right.count()) {
                        return Integer.compare(right.count(), left.count());
                    }
                    return dateComparator.compare(right.lastUsedAt(), left.lastUsedAt());
                })
                .collect(Collectors.toList());
    }

    private OrderBundleRecommendationResponse.OrderRecommendationEntry toRecommendationEntry(
            RecommendationAggregate aggregate,
            String source) {
        OrderBundleRecommendationResponse.OrderRecommendationEntry entry =
                new OrderBundleRecommendationResponse.OrderRecommendationEntry();
        entry.setKey(aggregate.key());
        entry.setEntity(aggregate.entity());
        entry.setSource(source);
        entry.setCount(aggregate.count());
        entry.setLastUsedAt(formatDate(aggregate.lastUsedAt()));
        entry.setTemplate(aggregate.template());
        return entry;
    }

    private OrderBundleRecommendationResponse.OrderRecommendationTemplate toRecommendationTemplate(
            BundleDolphin bundle,
            ModuleInfoBean info,
            String entity) {
        List<OrderBundleFetchResponse.OrderBundleItem> normalItems = new ArrayList<>();
        List<OrderBundleFetchResponse.OrderBundleItem> materialItems = new ArrayList<>();
        List<OrderBundleFetchResponse.OrderBundleItem> commentItems = new ArrayList<>();
        OrderBundleFetchResponse.OrderBundleItem bodyPart = null;
        for (OrderBundleFetchResponse.OrderBundleItem item : toItems(bundle.getClaimItem())) {
            if (item == null) {
                continue;
            }
            String code = normalize(item.getCode());
            if (isBodyPartCode(code)) {
                if (bodyPart == null) {
                    bodyPart = item;
                } else {
                    normalItems.add(item);
                }
                continue;
            }
            if (code.startsWith(MATERIAL_CODE_PREFIX)) {
                materialItems.add(item);
                continue;
            }
            if (code.matches(COMMENT_CODE_REGEX)) {
                commentItems.add(item);
                continue;
            }
            normalItems.add(item);
        }
        PrescriptionMeta prescriptionMeta = resolvePrescriptionMeta(bundle.getClassCode());

        OrderBundleRecommendationResponse.OrderRecommendationTemplate template =
                new OrderBundleRecommendationResponse.OrderRecommendationTemplate();
        template.setBundleName(resolveBundleName(bundle, info));
        template.setAdmin(normalize(bundle.getAdmin()));
        template.setBundleNumber(hasText(bundle.getBundleNumber()) ? bundle.getBundleNumber().trim() : "1");
        template.setAdminMemo(normalize(bundle.getAdminMemo()));
        template.setMemo(normalize(bundle.getMemo()));
        if (IInfoModel.ENTITY_MED_ORDER.equals(entity)) {
            template.setPrescriptionLocation(prescriptionMeta.location());
            template.setPrescriptionTiming(prescriptionMeta.timing());
        }
        template.setItems(normalItems);
        template.setMaterialItems(materialItems);
        template.setCommentItems(commentItems);
        template.setBodyPart(bodyPart);
        return template;
    }

    private String buildRecommendationKey(String entity,
            OrderBundleRecommendationResponse.OrderRecommendationTemplate template) {
        StringBuilder builder = new StringBuilder();
        appendNormalized(builder, entity);
        appendNormalized(builder, template.getBundleName());
        appendNormalized(builder, template.getAdmin());
        appendNormalized(builder, template.getBundleNumber());
        appendNormalized(builder, template.getAdminMemo());
        appendNormalized(builder, template.getMemo());
        appendNormalized(builder, template.getPrescriptionLocation());
        appendNormalized(builder, template.getPrescriptionTiming());
        appendItems(builder, template.getItems());
        appendItems(builder, template.getMaterialItems());
        appendItems(builder, template.getCommentItems());
        appendItem(builder, template.getBodyPart());
        String raw = builder.toString();
        return Integer.toHexString(Objects.hash(raw)) + ":" + Integer.toString(raw.length(), 36);
    }

    private void appendItems(StringBuilder builder, List<OrderBundleFetchResponse.OrderBundleItem> items) {
        builder.append("|[");
        if (items != null) {
            for (OrderBundleFetchResponse.OrderBundleItem item : items) {
                appendItem(builder, item);
            }
        }
        builder.append("]");
    }

    private void appendItem(StringBuilder builder, OrderBundleFetchResponse.OrderBundleItem item) {
        if (item == null) {
            builder.append("{}");
            return;
        }
        builder.append("{");
        appendNormalized(builder, item.getCode());
        appendNormalized(builder, item.getName());
        appendNormalized(builder, item.getQuantity());
        appendNormalized(builder, item.getUnit());
        appendNormalized(builder, item.getMemo());
        builder.append("}");
    }

    private void appendNormalized(StringBuilder builder, String value) {
        builder.append(normalize(value)).append("|");
    }

    private PrescriptionMeta resolvePrescriptionMeta(String classCode) {
        String normalized = normalize(classCode);
        if (normalized.isEmpty()) {
            return new PrescriptionMeta("out", "regular");
        }
        String location = normalized.endsWith("2") ? "out" : "in";
        String timing = "regular";
        if (normalized.startsWith("22")) {
            timing = "tonyo";
        } else if (normalized.startsWith("29")) {
            timing = "temporal";
        }
        return new PrescriptionMeta(location, timing);
    }

    private int clampLimit(Integer value, int fallback) {
        if (value == null) {
            return fallback;
        }
        return Math.max(1, Math.min(MAX_LIMIT, value));
    }

    private int clampOptionalLimit(Integer value, int fallback) {
        if (value == null) {
            return Math.max(0, Math.min(MAX_LIMIT, fallback));
        }
        return Math.max(0, Math.min(MAX_LIMIT, value));
    }

    private int clampScanLimit(Integer value) {
        if (value == null) {
            return DEFAULT_SCAN_LIMIT;
        }
        return Math.max(1, Math.min(MAX_SCAN_LIMIT, value));
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim();
    }

    private boolean isBodyPartCode(String code) {
        return normalize(code).startsWith(BODY_PART_CODE_PREFIX);
    }

    private BundleDolphin decodeBundle(ModuleModel module) {
        if (module == null) {
            return null;
        }
        if (module.getModel() instanceof BundleDolphin bundle) {
            return bundle;
        }
        Object decoded = ModelUtils.decodeModule(module);
        if (decoded instanceof BundleDolphin bundle) {
            return bundle;
        }
        return decodeBundleFromDatabase(module);
    }

    private BundleDolphin decodeBundleFromDatabase(ModuleModel module) {
        if (entityManager == null || module == null || module.getId() <= 0) {
            return null;
        }
        Object row;
        try {
            row = entityManager
                    .createNativeQuery("SELECT CAST(bean_json AS text) FROM d_module WHERE id = ?1")
                    .setParameter(1, module.getId())
                    .getSingleResult();
        } catch (Exception ex) {
            LOGGER.warn("Failed to fetch module payload for order bundle id={}", module.getId(), ex);
            return null;
        }
        return decodeBundleFromJson(row != null ? row.toString() : null);
    }

    private BundleDolphin decodeBundleFromJson(String beanJsonRaw) {
        if (beanJsonRaw == null || beanJsonRaw.isBlank()) {
            return null;
        }
        Object decoded = ModelUtils.decodeModuleJson(beanJsonRaw);
        if (decoded instanceof BundleDolphin bundle) {
            return bundle;
        }
        return null;
    }

    private String resolveBundleName(BundleDolphin bundle, ModuleInfoBean info) {
        if (bundle.getOrderName() != null && !bundle.getOrderName().isBlank()) {
            return bundle.getOrderName();
        }
        if (info != null && info.getStampName() != null && !info.getStampName().isBlank()) {
            return info.getStampName();
        }
        return "—";
    }

    private UserModel resolveEnteredByUser(ModuleModel module, DocumentModel document) {
        if (module != null && module.getUserModel() != null) {
            return module.getUserModel();
        }
        if (document != null) {
            return document.getUserModel();
        }
        return null;
    }

    private String resolveEnteredByName(UserModel user) {
        if (user == null) {
            return null;
        }
        if (hasText(user.getCommonName())) {
            return user.getCommonName().trim();
        }
        if (hasText(user.getUserId())) {
            return user.getUserId().trim();
        }
        return null;
    }

    private String resolveEnteredByRole(UserModel user) {
        if (user != null && user.getLicenseModel() != null) {
            if (hasText(user.getLicenseModel().getLicenseDesc())) {
                return user.getLicenseModel().getLicenseDesc().trim();
            }
            if (hasText(user.getLicenseModel().getLicense())) {
                return user.getLicenseModel().getLicense().trim();
            }
        }
        return "医師";
    }

    private String normalizeEntityQuery(String entity) {
        if (entity == null || entity.isBlank()) {
            return null;
        }
        String normalized = entity.trim();
        if ("laboTest".equals(normalized)) {
            return IInfoModel.ENTITY_LABO_TEST;
        }
        return normalized;
    }

    private String normalizeOrcaDateOrToday(String input) {
        if (input == null || input.isBlank()) {
            return LocalDate.now().toString().replace("-", "");
        }
        String digits = input.replaceAll("[^0-9]", "");
        if (digits.length() == 8) {
            return digits;
        }
        return LocalDate.now().toString().replace("-", "");
    }

    private String toIsoDate(String yyyymmdd) {
        if (yyyymmdd == null || yyyymmdd.length() != 8) {
            return LocalDate.now().toString();
        }
        return yyyymmdd.substring(0, 4) + "-" + yyyymmdd.substring(4, 6) + "-" + yyyymmdd.substring(6, 8);
    }

    protected List<OrcaOrderInputSetListResponse.Item> loadInputSetSummaries(String keyword, String effective) {
        Map<String, InputSetAggregate> aggregates = new LinkedHashMap<>();
        String normalizedKeyword = keyword != null ? keyword.trim().toLowerCase(Locale.ROOT) : null;
        try (Connection connection = resolveOrcaConnection().getConnection();
             PreparedStatement ps = connection.prepareStatement(
                     "SELECT inputcd, dspname FROM tbl_inputcd WHERE inputcd LIKE 'P%' OR inputcd LIKE 'S%' ORDER BY inputcd");
             ResultSet rs = ps.executeQuery()) {
            while (rs.next()) {
                String setCode = trimToNull(rs.getString(1));
                String name = trimToNull(rs.getString(2));
                if (setCode == null || name == null) {
                    continue;
                }
                if (normalizedKeyword != null && !normalizedKeyword.isBlank()) {
                    String target = (setCode + " " + name).toLowerCase(Locale.ROOT);
                    if (!target.contains(normalizedKeyword)) {
                        continue;
                    }
                }
                InputSetAggregate aggregate = aggregates.computeIfAbsent(setCode, key -> new InputSetAggregate(setCode, name));
                aggregate.name = name;
            }
        } catch (SQLException e) {
            throw restError(null, Response.Status.SERVICE_UNAVAILABLE, "inputset_unavailable", "Failed to load input sets");
        }
        try (Connection connection = resolveOrcaConnection().getConnection()) {
            for (InputSetAggregate aggregate : aggregates.values()) {
                fillInputSetAggregate(connection, aggregate, effective);
            }
        } catch (SQLException e) {
            throw restError(null, Response.Status.SERVICE_UNAVAILABLE, "inputset_unavailable", "Failed to load input sets");
        }
        return aggregates.values().stream()
                .filter(InputSetAggregate::hasValidItems)
                .map(InputSetAggregate::toItem)
                .collect(Collectors.toList());
    }

    private void fillInputSetAggregate(Connection connection, InputSetAggregate aggregate, String effective) throws SQLException {
        try (PreparedStatement ps = connection.prepareStatement(
                "SELECT SUM(CASE WHEN inputcd NOT LIKE '.%' THEN 1 ELSE 0 END), MIN(yukostymd), MAX(yukoedymd) "
                        + "FROM tbl_inputset WHERE setcd=? AND yukostymd<=? AND yukoedymd>=?")) {
            ps.setString(1, aggregate.setCode);
            ps.setString(2, effective);
            ps.setString(3, effective);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    aggregate.itemCount = rs.getInt(1);
                    aggregate.validFrom = trimToNull(rs.getString(2));
                    aggregate.validTo = trimToNull(rs.getString(3));
                }
            }
        }
        aggregate.kind = aggregate.setCode.startsWith("P") ? "P" : "S";
        if ("P".equals(aggregate.kind)) {
            aggregate.entity = IInfoModel.ENTITY_MED_ORDER;
            aggregate.classCode = "212";
            aggregate.classCodeSystem = CLAIM_CLASS_SYSTEM;
            return;
        }
        try (PreparedStatement ps = connection.prepareStatement(
                "SELECT inputcd FROM tbl_inputset "
                        + "WHERE setcd=? AND yukostymd<=? AND yukoedymd>=? AND inputcd LIKE '.%' "
                        + "ORDER BY setseq")) {
            ps.setString(1, aggregate.setCode);
            ps.setString(2, effective);
            ps.setString(3, effective);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    String classCode = normalizeClassCode(trimToNull(rs.getString(1)));
                    if (!hasText(classCode)) {
                        continue;
                    }
                    String[] resolved = resolveEntityOrderName(classCode);
                    aggregate.entity = resolved[0];
                    aggregate.classCode = classCode;
                    aggregate.classCodeSystem = CLAIM_CLASS_SYSTEM;
                    return;
                }
            }
        }
    }

    protected OrcaOrderInputSetDetailResponse.Bundle loadInputSetDetailData(String setCode, String effective, String requestedName) {
        try (Connection connection = resolveOrcaConnection().getConnection()) {
            String bundleName = trimToNull(requestedName);
            if (bundleName == null) {
                bundleName = loadInputSetName(connection, setCode);
            }
            if (bundleName == null) {
                return null;
            }
            OrcaOrderInputSetDetailResponse.Bundle bundle = new OrcaOrderInputSetDetailResponse.Bundle();
            bundle.setBundleName(bundleName);
            bundle.setBundleNumber("1");
            bundle.setClassCodeSystem(CLAIM_CLASS_SYSTEM);
            bundle.setStarted(toIsoDate(effective));
            bundle.setItems(new ArrayList<>());

            try (PreparedStatement ps = connection.prepareStatement(
                    "SELECT inputcd, suryo1, kaisu, yukostymd, yukoedymd FROM tbl_inputset WHERE setcd=? AND yukostymd<=? AND yukoedymd>=? ORDER BY setseq")) {
                ps.setString(1, setCode);
                ps.setString(2, effective);
                ps.setString(3, effective);
                try (ResultSet rs = ps.executeQuery()) {
                    while (rs.next()) {
                        String inputCode = trimToNull(rs.getString(1));
                        if (inputCode == null) {
                            continue;
                        }
                        String bundleNumber = trimToNull(rs.getString(3));
                        if (bundleNumber != null && !bundleNumber.isBlank() && !"0".equals(bundleNumber)) {
                            bundle.setBundleNumber(bundleNumber);
                        }
                        if (inputCode.startsWith(".")) {
                            String classCode = normalizeClassCode(inputCode);
                            applyBundleClass(bundle, classCode);
                            continue;
                        }
                        OrcaOrderInputSetDetailResponse.Item item = loadInputSetItem(connection, inputCode);
                        if (item == null) {
                            continue;
                        }
                        item.setCode(inputCode);
                        item.setQuantity(trimNumeric(rs.getString(2)));
                        if (item.getCode() != null && item.getCode().startsWith(BODY_PART_CODE_PREFIX) && bundle.getBodyPart() == null) {
                            OrcaOrderInputSetDetailResponse.BodyPart bodyPart = new OrcaOrderInputSetDetailResponse.BodyPart();
                            bodyPart.setCode(item.getCode());
                            bodyPart.setName(item.getName());
                            bodyPart.setQuantity(item.getQuantity());
                            bodyPart.setUnit(item.getUnit());
                            bodyPart.setMemo(item.getMemo());
                            bundle.setBodyPart(bodyPart);
                            continue;
                        }
                        bundle.getItems().add(item);
                    }
                }
            }
            if (bundle.getClassCode() == null) {
                String fallbackClassCode = setCode.startsWith("P") ? "212" : "900";
                applyBundleClass(bundle, fallbackClassCode);
            }
            if (bundle.getItems().isEmpty() && bundle.getBodyPart() == null) {
                return null;
            }
            return bundle;
        } catch (SQLException e) {
            throw restError(null, Response.Status.SERVICE_UNAVAILABLE, "inputset_unavailable", "Failed to load input set detail");
        }
    }

    private String loadInputSetName(Connection connection, String setCode) throws SQLException {
        try (PreparedStatement ps = connection.prepareStatement(
                "SELECT dspname FROM tbl_inputcd WHERE inputcd=? ORDER BY dspseq")) {
            ps.setString(1, setCode);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    String name = trimToNull(rs.getString(1));
                    if (name != null) {
                        return name;
                    }
                }
            }
        }
        return null;
    }

    private OrcaOrderInputSetDetailResponse.Item loadInputSetItem(Connection connection, String inputCode) throws SQLException {
        try (PreparedStatement ps = connection.prepareStatement(
                "SELECT name, taniname FROM tbl_tensu WHERE srycd=? ORDER BY yukoedymd DESC")) {
            ps.setString(1, inputCode);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    return null;
                }
                OrcaOrderInputSetDetailResponse.Item item = new OrcaOrderInputSetDetailResponse.Item();
                item.setName(trimToNull(rs.getString(1)));
                item.setUnit(trimToNull(rs.getString(2)));
                item.setMemo("");
                return item;
            }
        }
    }

    private void applyBundleClass(OrcaOrderInputSetDetailResponse.Bundle bundle, String classCode) {
        if (!hasText(classCode)) {
            return;
        }
        String[] resolved = resolveEntityOrderName(classCode);
        bundle.setClassCode(classCode);
        bundle.setClassCodeSystem(CLAIM_CLASS_SYSTEM);
        bundle.setEntity(resolved[0]);
        bundle.setClassName(resolved[1]);
    }

    protected List<OrcaOrderInteractionCheckResponse.Pair> loadInteractionPairs(List<String> codes, List<String> existingCodes) {
        List<String> rightCodes = existingCodes.isEmpty() ? codes : existingCodes;
        if (codes.isEmpty() || rightCodes.isEmpty()) {
            return List.of();
        }
        Map<String, OrcaOrderInteractionCheckResponse.Pair> deduped = new LinkedHashMap<>();
        try (Connection connection = resolveOrcaConnection().getConnection()) {
            String leftInClause = codes.stream().map(code -> "?").collect(Collectors.joining(","));
            String rightInClause = rightCodes.stream().map(code -> "?").collect(Collectors.joining(","));
            String sql = "SELECT drugcd, drugcd2, TI.syojyoucd, syojyou "
                    + "FROM tbl_interact TI INNER JOIN tbl_sskijyo TS ON TI.syojyoucd = TS.syojyoucd "
                    + "WHERE ((drugcd IN (" + leftInClause + ") AND drugcd2 IN (" + rightInClause + ")) "
                    + "OR (drugcd IN (" + rightInClause + ") AND drugcd2 IN (" + leftInClause + ")))";
            try (PreparedStatement ps = connection.prepareStatement(sql)) {
                int index = 1;
                for (String code : codes) {
                    ps.setString(index++, code);
                }
                for (String code : rightCodes) {
                    ps.setString(index++, code);
                }
                for (String code : rightCodes) {
                    ps.setString(index++, code);
                }
                for (String code : codes) {
                    ps.setString(index++, code);
                }
                try (ResultSet rs = ps.executeQuery()) {
                    while (rs.next()) {
                        String left = trimToNull(rs.getString(1));
                        String right = trimToNull(rs.getString(2));
                        if (left == null || right == null || left.equals(right)) {
                            continue;
                        }
                        String first = left.compareTo(right) <= 0 ? left : right;
                        String second = left.compareTo(right) <= 0 ? right : left;
                        String key = first + "|" + second + "|" + trimToNull(rs.getString(3));
                        if (!deduped.containsKey(key)) {
                            OrcaOrderInteractionCheckResponse.Pair pair = new OrcaOrderInteractionCheckResponse.Pair();
                            pair.setCode1(first);
                            pair.setCode2(second);
                            pair.setInteractionCode(trimToNull(rs.getString(3)));
                            pair.setInteractionName(trimToNull(rs.getString(4)));
                            pair.setMessage("相互作用が検出されました");
                            deduped.put(key, pair);
                        }
                    }
                }
            }
        } catch (SQLException e) {
            throw restError(null, Response.Status.SERVICE_UNAVAILABLE, "interaction_unavailable", "Failed to check interactions");
        }
        return new ArrayList<>(deduped.values());
    }

    private List<String> sanitizeInteractionCodes(List<String> source) {
        if (source == null || source.isEmpty()) {
            return List.of();
        }
        LinkedHashSet<String> unique = new LinkedHashSet<>();
        for (String value : source) {
            String normalized = trimToNull(value);
            if (normalized == null) {
                continue;
            }
            unique.add(normalized);
        }
        return new ArrayList<>(unique);
    }

    private String normalizeClassCode(String inputCode) {
        if (inputCode == null || inputCode.isBlank()) {
            return null;
        }
        String normalized = inputCode.startsWith(".") ? inputCode.substring(1) : inputCode;
        if (normalized.length() > 3) {
            return normalized.substring(0, 3);
        }
        return normalized;
    }

    private String[] resolveEntityOrderName(String receiptCode) {
        try {
            int number = Integer.parseInt(receiptCode);
            if (number >= 110 && number <= 125) {
                return new String[]{IInfoModel.ENTITY_BASE_CHARGE_ORDER, "診断料"};
            }
            if (number >= 130 && number <= 150) {
                return new String[]{IInfoModel.ENTITY_INSTRACTION_CHARGE_ORDER, "指導・在宅"};
            }
            if (number >= 200 && number <= 299) {
                return new String[]{IInfoModel.ENTITY_MED_ORDER, "RP"};
            }
            if (number >= 300 && number <= 399) {
                return new String[]{IInfoModel.ENTITY_INJECTION_ORDER, "注射"};
            }
            if (number >= 400 && number <= 499) {
                return new String[]{IInfoModel.ENTITY_TREATMENT, "処置"};
            }
            if (number >= 500 && number <= 599) {
                return new String[]{IInfoModel.ENTITY_SURGERY_ORDER, "手術"};
            }
            if (number >= 600 && number <= 699) {
                return new String[]{IInfoModel.ENTITY_LABO_TEST, "検査"};
            }
            if (number >= 700 && number <= 799) {
                return new String[]{IInfoModel.ENTITY_RADIOLOGY_ORDER, "放射線"};
            }
            if (number >= 800 && number <= 899) {
                return new String[]{IInfoModel.ENTITY_OTHER_ORDER, "その他"};
            }
        } catch (NumberFormatException e) {
            LOGGER.debug("Failed to resolve entity from receipt code {}", receiptCode);
        }
        return new String[]{IInfoModel.ENTITY_GENERAL_ORDER, "汎用"};
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private String trimNumeric(String value) {
        String trimmed = trimToNull(value);
        if (trimmed == null) {
            return null;
        }
        if (trimmed.endsWith(".0")) {
            return trimmed.substring(0, trimmed.length() - 2);
        }
        return trimmed;
    }

    private static final class InputSetAggregate {
        private final String setCode;
        private String name;
        private String entity;
        private String kind;
        private String classCode;
        private String classCodeSystem;
        private Integer itemCount;
        private String validFrom;
        private String validTo;

        private InputSetAggregate(String setCode, String name) {
            this.setCode = setCode;
            this.name = name;
        }

        private boolean hasValidItems() {
            return itemCount != null && itemCount.intValue() > 0 && name != null && !name.isBlank();
        }

        private OrcaOrderInputSetListResponse.Item toItem() {
            OrcaOrderInputSetListResponse.Item item = new OrcaOrderInputSetListResponse.Item();
            item.setSetCode(setCode);
            item.setName(name);
            item.setEntity(entity);
            item.setKind(kind);
            item.setClassCode(classCode);
            item.setClassCodeSystem(classCodeSystem);
            item.setItemCount(itemCount);
            item.setValidFrom(validFrom);
            item.setValidTo(validTo);
            return item;
        }
    }

    private record RecommendationAggregate(
            String key,
            String entity,
            OrderBundleRecommendationResponse.OrderRecommendationTemplate template,
            int count,
            Date lastUsedAt) {
    }

    private record PrescriptionMeta(String location, String timing) {
    }

    private Date parseDate(String input, Date fallback) {
        if (input == null || input.isBlank()) {
            return fallback;
        }
        Date parsed = ModelUtils.getDateAsObject(input);
        return parsed != null ? parsed : fallback;
    }

    private Date requireMutationDate(HttpServletRequest request, String facilityId, String patientId, String runId,
            String operation, String field, String input, boolean required) {
        if (input == null || input.isBlank()) {
            if (!required) {
                return null;
            }
            Map<String, Object> audit = new HashMap<>();
            audit.put("facilityId", facilityId);
            audit.put("patientId", patientId);
            audit.put("runId", runId);
            audit.put("validationError", Boolean.TRUE);
            audit.put("field", field);
            audit.put("operation", operation);
            markFailureDetails(audit, Response.Status.BAD_REQUEST.getStatusCode(),
                    "invalid_request", field + " is required");
            recordAudit(request, "ORCA_ORDER_BUNDLE_MUTATION", audit, AuditEventEnvelope.Outcome.FAILURE);
            throw validationError(request, field, field + " is required");
        }

        Date parsed = parseStrictIsoDate(input);
        if (parsed != null) {
            return parsed;
        }

        Map<String, Object> audit = new HashMap<>();
        audit.put("facilityId", facilityId);
        audit.put("patientId", patientId);
        audit.put("runId", runId);
        audit.put("validationError", Boolean.TRUE);
        audit.put("field", field);
        audit.put("operation", operation);
        markFailureDetails(audit, Response.Status.BAD_REQUEST.getStatusCode(),
                "invalid_request", field + " must be yyyy-MM-dd");
        recordAudit(request, "ORCA_ORDER_BUNDLE_MUTATION", audit, AuditEventEnvelope.Outcome.FAILURE);
        throw validationError(request, field, field + " must be yyyy-MM-dd");
    }

    private Date parseStrictIsoDate(String input) {
        if (input == null) {
            return null;
        }
        try {
            LocalDate date = LocalDate.parse(input.trim());
            return Date.from(date.atStartOfDay(ZoneId.systemDefault()).toInstant());
        } catch (DateTimeParseException ex) {
            return null;
        }
    }

    private String formatDate(Date date) {
        if (date == null) {
            return null;
        }
        return ModelUtils.getDateAsString(date);
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private boolean isSupportedOperation(String operation) {
        return "create".equals(operation) || "update".equals(operation) || "delete".equals(operation);
    }

    private boolean isValidEntity(String entity) {
        if (entity == null) {
            return false;
        }
        String normalized = entity.trim();
        if (normalized.isEmpty()) {
            return false;
        }
        return ORDER_BUNDLE_ENTITIES.contains(normalized);
    }

    private DocumentModel fetchDocument(long documentId) {
        List<DocumentModel> list = karteServiceBean.getDocumentsWithModules(List.of(documentId));
        if (list == null || list.isEmpty()) {
            return null;
        }
        return list.get(0);
    }

    private List<DocumentModel> resolveDocuments(KarteBean karte, Date fromDate) {
        return resolveDocuments(karte, fromDate, Integer.MAX_VALUE);
    }

    private List<DocumentModel> resolveDocuments(KarteBean karte, Date fromDate, int limit) {
        List<open.dolphin.infomodel.DocInfoModel> docInfos =
                karteServiceBean.getDocumentList(karte.getId(), fromDate, true);
        if (docInfos == null || docInfos.isEmpty()) {
            return List.of();
        }
        List<Long> ids = docInfos.stream()
                .map(open.dolphin.infomodel.DocInfoModel::getDocPk)
                .filter(id -> id != null && id > 0)
                .limit(Math.max(1, limit))
                .collect(Collectors.toList());
        if (ids.isEmpty()) {
            return List.of();
        }
        return karteServiceBean.getDocumentsWithModules(ids);
    }

    private ORCAConnection resolveOrcaConnection() {
        return orcaConnection != null ? orcaConnection : ORCAConnection.current();
    }
}
