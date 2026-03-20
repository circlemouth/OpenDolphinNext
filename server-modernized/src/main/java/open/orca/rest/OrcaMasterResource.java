package open.orca.rest;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.TreeMap;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import jakarta.inject.Inject;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.HeaderParam;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.EntityTag;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.MultivaluedMap;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.Response.Status;
import jakarta.ws.rs.core.UriInfo;
import open.dolphin.rest.dto.orca.OrcaDrugMasterEntry;
import open.dolphin.rest.dto.orca.OrcaMasterErrorResponse;
import open.dolphin.rest.dto.orca.OrcaMasterListResponse;
import open.dolphin.rest.dto.orca.OrcaMasterMeta;
import open.dolphin.rest.dto.orca.OrcaAddressEntry;
import open.dolphin.rest.dto.orca.OrcaInsurerEntry;
import open.dolphin.rest.dto.orca.OrcaTensuEntry;
import open.dolphin.rest.AbstractResource;
import open.dolphin.audit.AuditEventEnvelope;
import open.dolphin.security.audit.AuditEventPayload;
import open.dolphin.security.audit.SessionAuditDispatcher;
import open.dolphin.rest.orca.AbstractOrcaRestResource;

/**
 * ORCA master endpoints for the modernized server.
 * Provides read-only responses with audit/meta fields that align with the web client bridge.
 */
@Path("/orca/master")
@Produces(MediaType.APPLICATION_JSON)
public class OrcaMasterResource extends AbstractResource {
    private static final OrcaMasterGateway NOOP_GATEWAY = new OrcaMasterGateway() {
        @Override
        public OrcaMasterDao.GenericClassSearchResult searchGenericClass(OrcaMasterDao.GenericClassCriteria criteria) {
            return null;
        }

        @Override
        public OrcaMasterDao.ListSearchResult<OrcaMasterDao.DrugRecord> searchDrug(OrcaMasterDao.DrugCriteria criteria) {
            return null;
        }

        @Override
        public OrcaMasterDao.ListSearchResult<OrcaMasterDao.CommentRecord> searchComment(OrcaMasterDao.CommentCriteria criteria) {
            return null;
        }

        @Override
        public OrcaMasterDao.ListSearchResult<OrcaMasterDao.CommentRecord> searchBodypart(OrcaMasterDao.CommentCriteria criteria) {
            return null;
        }

        @Override
        public OrcaMasterDao.ListSearchResult<OrcaMasterDao.YouhouRecord> searchYouhou(OrcaMasterDao.YouhouCriteria criteria) {
            return null;
        }

        @Override
        public OrcaMasterDao.ListSearchResult<OrcaMasterDao.MaterialRecord> searchMaterial(OrcaMasterDao.MaterialCriteria criteria) {
            return null;
        }

        @Override
        public OrcaMasterDao.ListSearchResult<OrcaMasterDao.KensaSortRecord> searchKensaSort(OrcaMasterDao.KensaSortCriteria criteria) {
            return null;
        }

        @Override
        public EtensuDao.EtensuSearchResult searchEtensu(EtensuDao.EtensuSearchCriteria criteria) {
            return new EtensuDao.EtensuSearchResult(Collections.emptyList(), 0, null, 0, true);
        }
    };


    private static final String DEFAULT_VERSION = "20240426";
    private static final String DEFAULT_VALID_FROM = "20240401";
    private static final String DEFAULT_VALID_TO = "99991231";
    private static final long CACHE_STALE_REVALIDATE_SECONDS = 86400;
    private static final Pattern SRYCD_PATTERN = Pattern.compile("^\\d{9}$");
    private static final Pattern ZIP_PATTERN = Pattern.compile("^\\d{7}$");
    private static final Pattern PREF_PATTERN = Pattern.compile("^(0[1-9]|[1-3][0-9]|4[0-7])$");
    private static final Pattern ETENSU_CATEGORY_PATTERN = Pattern.compile("^\\d{1,2}$");
    private static final Pattern TENSU_VERSION_PATTERN = Pattern.compile("^\\d{6}$");
    private static final Pattern AS_OF_PATTERN = Pattern.compile("^\\d{8}$");

    @Inject
    SessionAuditDispatcher sessionAuditDispatcher;

    @Inject
    OrcaMasterService masterService;

    @Inject
    OrcaMasterResponseMapper responseMapper;

    public OrcaMasterResource() {
        this.masterService = new OrcaMasterService(NOOP_GATEWAY);
        this.responseMapper = new OrcaMasterResponseMapper();
    }

    OrcaMasterResource(EtensuDao etensuDao, OrcaMasterDao masterDao) {
        this(new OrcaMasterDaoGateway(etensuDao, masterDao));
    }

    OrcaMasterResource(OrcaMasterGateway masterGateway) {
        this.masterService = new OrcaMasterService(masterGateway);
        this.responseMapper = new OrcaMasterResponseMapper();
    }

    private enum DataOrigin {
        ORCA_DB,
        FALLBACK
    }

    private static final class LoadedFixture<T> {
        final List<T> entries;
        final String snapshotVersion;
        final String version;
        final DataOrigin origin;
        final boolean loadFailed;

        LoadedFixture(List<T> entries, String snapshotVersion, String version, DataOrigin origin, boolean loadFailed) {
            this.entries = entries;
            this.snapshotVersion = snapshotVersion;
            this.version = version;
            this.origin = origin;
            this.loadFailed = loadFailed;
        }
    }

    private OrcaMasterAuditSupport auditSupport() {
        return new OrcaMasterAuditSupport(sessionAuditDispatcher);
    }

    private <T> LoadedFixture<T> toResourceFixture(OrcaMasterService.LoadedFixture<T> fixture) {
        if (fixture == null) {
            return new LoadedFixture<>(Collections.emptyList(), null, null, DataOrigin.FALLBACK, false);
        }
        return new LoadedFixture<>(
                fixture.entries,
                fixture.snapshotVersion,
                fixture.version,
                DataOrigin.valueOf(fixture.origin.name()),
                fixture.loadFailed
        );
    }

    private <T> OrcaMasterService.LoadedFixture<T> toServiceFixture(LoadedFixture<T> fixture) {
        if (fixture == null) {
            return new OrcaMasterService.LoadedFixture<>(Collections.emptyList(), null, null,
                    OrcaMasterService.DataOrigin.FALLBACK, false);
        }
        return new OrcaMasterService.LoadedFixture<>(
                fixture.entries,
                fixture.snapshotVersion,
                fixture.version,
                OrcaMasterService.DataOrigin.valueOf(fixture.origin.name()),
                fixture.loadFailed
        );
    }

    @GET
    @Path("/generic-class")
    public Response getGenericClass(
            @HeaderParam("If-None-Match") String ifNoneMatch,
            @Context UriInfo uriInfo,
            @Context HttpServletRequest request
    ) {
        if (!isAuthorized(request)) {
            return unauthorized(request);
        }
        final MultivaluedMap<String, String> params = uriInfo.getQueryParameters();
        final String keyword = getFirstValue(params, "keyword");
        final String effective = getFirstValue(params, "effective");
        OrcaMasterDao.GenericClassCriteria criteria = new OrcaMasterDao.GenericClassCriteria();
        criteria.setKeyword(keyword);
        criteria.setEffective(effective);
        criteria.setPage(parsePositiveInt(params, "page", 1));
        criteria.setSize(parsePageSize(params, "size", 100));
        criteria.setIncludeTotalCount(shouldIncludeTotalCount(params));
        OrcaMasterDao.GenericClassSearchResult dbResult = masterService.searchGenericClass(criteria);
        final String masterType = "orca05-generic-class";
        if (dbResult == null) {
            LoadedFixture<OrcaMasterDao.GenericClassRecord> unavailableFixture = unavailableFixture();
            Response failure = serviceUnavailable(request, "MASTER_GENERIC_CLASS_UNAVAILABLE",
                    "薬効分類マスタを取得できませんでした");
            recordMasterAudit(request, "/api/orca/master/generic-class", masterType, 503, unavailableFixture, false,
                    true, 0, buildQueryDetails(null, keyword, effective, params));
            return failure;
        }
        LoadedFixture<OrcaMasterDao.GenericClassRecord> fixture = buildDbFixture(
                dbResult.getRecords(),
                dbResult.getVersion(),
                false
        );
        final String etagValue = buildEtag("/api/orca/master/generic-class", masterType, fixture, params);
        final long ttlSeconds = cacheTtlSeconds(masterType);
        if (etagMatches(ifNoneMatch, etagValue)) {
            recordMasterAudit(request, "/api/orca/master/generic-class", masterType, 304, fixture, true, null, null,
                    buildQueryDetails(null, keyword, effective, params));
            return buildNotModifiedResponse(etagValue, ttlSeconds);
        }
        final Integer totalCount = dbResult.getTotalCount();
        final List<OrcaDrugMasterEntry> items = fixture.entries.stream()
                .map(entry -> toGenericClassEntry(entry, fixture))
                .collect(Collectors.toList());
        OrcaMasterListResponse<OrcaDrugMasterEntry> response = new OrcaMasterListResponse<>();
        if (totalCount != null) {
            response.setTotalCount(totalCount);
        }
        response.setItems(items);
        recordMasterAudit(request, "/api/orca/master/generic-class", masterType, 200, fixture, false, items.isEmpty(),
                totalCount, buildQueryDetails(null, keyword, effective, params));
        return buildCachedOkResponse(response, etagValue, ttlSeconds);
    }

    @GET
    @Path("/generic-price")
    public Response getGenericPrice(
            @HeaderParam("If-None-Match") String ifNoneMatch,
            @Context UriInfo uriInfo,
            @Context HttpServletRequest request
    ) {
        if (!isAuthorized(request)) {
            return unauthorized(request);
        }
        final MultivaluedMap<String, String> params = uriInfo.getQueryParameters();
        final String srycd = getFirstValue(params, "srycd");
        final String effective = normalizeEffectiveDate(getFirstValue(params, "effective"));
        final String masterType = "orca05-generic-price";
        final String apiRoute = "/api/orca/master/generic-price";
        if (srycd == null || !SRYCD_PATTERN.matcher(srycd).matches()) {
            recordMasterAudit(request, apiRoute, masterType, 422,
                    new LoadedFixture<>(Collections.emptyList(), null, null, DataOrigin.FALLBACK, false),
                    false, null, 0, buildSrycdDetails(srycd, effective, params));
            return validationError(request, "SRYCD_VALIDATION_ERROR", "srycd must be 9 digits");
        }
        LoadedFixture<OrcaDrugMasterEntry> unavailableFixture = unavailableFixture();
        Response failure = serviceUnavailable(request, "MASTER_GENERIC_PRICE_UNAVAILABLE",
                "最低薬価マスタを取得できませんでした");
        recordMasterAudit(request, apiRoute, masterType, 503, unavailableFixture, false, true, 0,
                buildSrycdDetails(srycd, effective, params));
        return failure;
    }

    @GET
    @Path("/drug")
    public Response getDrug(
            @HeaderParam("If-None-Match") String ifNoneMatch,
            @Context UriInfo uriInfo,
            @Context HttpServletRequest request
    ) {
        if (!isAuthorized(request)) {
            return unauthorized(request);
        }
        final MultivaluedMap<String, String> params = uriInfo.getQueryParameters();
        final String keyword = getFirstValue(params, "keyword");
        final String effective = normalizeEffectiveDate(getFirstValue(params, "effective"));
        final String searchMethod = normalizeDrugSearchMethod(getFirstValue(params, "method"));
        final String scope = normalizeDrugScope(getFirstValue(params, "scope"));
        OrcaMasterDao.DrugCriteria criteria = new OrcaMasterDao.DrugCriteria();
        criteria.setKeyword(keyword);
        criteria.setEffective(effective);
        criteria.setSearchMethod(searchMethod);
        criteria.setScope(scope);
        criteria.setPage(parsePositiveInt(params, "page", 1));
        criteria.setSize(parsePageSize(params, "size", 100));
        criteria.setIncludeTotalCount(shouldIncludeTotalCount(params));
        OrcaMasterDao.ListSearchResult<OrcaMasterDao.DrugRecord> dbResult = masterService.searchDrug(criteria);
        final String masterType = "orca08-drug";
        final String apiRoute = "/api/orca/master/drug";
        if (dbResult == null) {
            LoadedFixture<OrcaMasterDao.DrugRecord> dbFixture = buildDbFixture(
                    Collections.emptyList(),
                    null,
                    true
            );
            Response failure = serviceUnavailable(request, "MASTER_DRUG_UNAVAILABLE", "薬剤マスタを取得できませんでした");
            recordMasterAudit(request, apiRoute, masterType, 503, dbFixture, false, true, 0,
                    buildQueryDetails(null, keyword, effective, params));
            return failure;
        }
        LoadedFixture<OrcaMasterDao.DrugRecord> fixture = buildDbFixture(
                dbResult.getRecords(),
                dbResult.getVersion(),
                false
        );
        final String etagValue = buildEtag(apiRoute, masterType, fixture, params);
        final long ttlSeconds = cacheTtlSeconds(masterType);
        if (etagMatches(ifNoneMatch, etagValue)) {
            recordMasterAudit(request, apiRoute, masterType, 304, fixture, true, null, null,
                    buildQueryDetails(null, keyword, effective, params));
            return buildNotModifiedResponse(etagValue, ttlSeconds);
        }
        final Integer totalCount = dbResult.getTotalCount();
        final List<OrcaDrugMasterEntry> items = fixture.entries.stream()
                .map(entry -> toDrugEntry(entry, fixture))
                .collect(Collectors.toList());
        OrcaMasterListResponse<OrcaDrugMasterEntry> response = new OrcaMasterListResponse<>();
        if (totalCount != null) {
            response.setTotalCount(totalCount);
        }
        response.setItems(items);
        recordMasterAudit(request, apiRoute, masterType, 200, fixture, false, items.isEmpty(),
                totalCount, buildQueryDetails(null, keyword, effective, params));
        return buildCachedOkResponse(response, etagValue, ttlSeconds);
    }

    @GET
    @Path("/hokenja")
    public Response getHokenja(
            @HeaderParam("If-None-Match") String ifNoneMatch,
            @Context UriInfo uriInfo,
            @Context HttpServletRequest request
    ) {
        if (!isAuthorized(request)) {
            return unauthorized(request);
        }
        final MultivaluedMap<String, String> params = uriInfo.getQueryParameters();
        final String pref = getFirstValue(params, "pref");
        final String keyword = getFirstValue(params, "keyword");
        final String effective = normalizeEffectiveDate(getFirstValue(params, "effective"));
        final String masterType = "orca06-hokenja";
        final String apiRoute = "/api/orca/master/hokenja";
        if (pref != null && !PREF_PATTERN.matcher(pref).matches()) {
            recordMasterAudit(request, apiRoute, masterType, 422,
                    new LoadedFixture<>(Collections.emptyList(), null, null, DataOrigin.FALLBACK, false),
                    false, null, 0, buildQueryDetails(pref, keyword, effective, params));
            return validationError(request, "PREF_VALIDATION_ERROR", "pref must be a 2-digit prefecture code");
        }
        LoadedFixture<OrcaInsurerEntry> unavailableFixture = unavailableFixture();
        Response failure = serviceUnavailable(request, "MASTER_HOKENJA_UNAVAILABLE", "保険者マスタを取得できませんでした");
        recordMasterAudit(request, apiRoute, masterType, 503, unavailableFixture, false, true, 0,
                buildQueryDetails(pref, keyword, effective, params));
        return failure;
    }

    @GET
    @Path("/address")
    public Response getAddress(
            @HeaderParam("If-None-Match") String ifNoneMatch,
            @Context UriInfo uriInfo,
            @Context HttpServletRequest request
    ) {
        if (!isAuthorized(request)) {
            return unauthorized(request);
        }
        final MultivaluedMap<String, String> params = uriInfo.getQueryParameters();
        final String zip = getFirstValue(params, "zip");
        final String effective = normalizeEffectiveDate(getFirstValue(params, "effective"));
        final String masterType = "orca06-address";
        final String apiRoute = "/api/orca/master/address";
        if (zip == null || !ZIP_PATTERN.matcher(zip).matches()) {
            recordMasterAudit(request, apiRoute, masterType, 422,
                    new LoadedFixture<>(Collections.emptyList(), null, null, DataOrigin.FALLBACK, false),
                    false, null, 0, buildQueryDetails(null, null, effective, params, zip));
            return validationError(request, "ZIP_VALIDATION_ERROR", "zip must be 7 digits");
        }
        LoadedFixture<OrcaAddressEntry> unavailableFixture = unavailableFixture();
        Response failure = serviceUnavailable(request, "MASTER_ADDRESS_UNAVAILABLE", "住所マスタを取得できませんでした");
        recordMasterAudit(request, apiRoute, masterType, 503, unavailableFixture, false, true, 0,
                buildQueryDetails(null, null, effective, params, zip));
        return failure;
    }

    @GET
    @Path("/comment")
    public Response getComment(
            @HeaderParam("If-None-Match") String ifNoneMatch,
            @Context UriInfo uriInfo,
            @Context HttpServletRequest request
    ) {
        if (!isAuthorized(request)) {
            return unauthorized(request);
        }
        final MultivaluedMap<String, String> params = uriInfo.getQueryParameters();
        final String keyword = getFirstValue(params, "keyword");
        final String effective = normalizeEffectiveDate(getFirstValue(params, "effective"));
        OrcaMasterDao.CommentCriteria criteria = new OrcaMasterDao.CommentCriteria();
        criteria.setKeyword(keyword);
        criteria.setEffective(effective);
        criteria.setPage(parsePositiveInt(params, "page", 1));
        criteria.setSize(parsePageSize(params, "size", 100));
        criteria.setIncludeTotalCount(shouldIncludeTotalCount(params));
        OrcaMasterDao.ListSearchResult<OrcaMasterDao.CommentRecord> dbResult = masterService.searchComment(criteria);
        final String masterType = "orca08-comment";
        final String apiRoute = "/api/orca/master/comment";
        if (dbResult == null) {
            LoadedFixture<OrcaMasterDao.CommentRecord> dbFixture = buildDbFixture(
                    Collections.emptyList(),
                    null,
                    true
            );
            Response failure = serviceUnavailable(request, "MASTER_COMMENT_UNAVAILABLE", "コメントマスタを取得できませんでした");
            recordMasterAudit(request, apiRoute, masterType, 503, dbFixture, false, true, 0,
                    buildQueryDetails(null, keyword, effective, params));
            return failure;
        }
        LoadedFixture<OrcaMasterDao.CommentRecord> fixture = buildDbFixture(
                dbResult.getRecords(),
                dbResult.getVersion(),
                false
        );
        final String etagValue = buildEtag(apiRoute, masterType, fixture, params);
        final long ttlSeconds = cacheTtlSeconds(masterType);
        if (etagMatches(ifNoneMatch, etagValue)) {
            recordMasterAudit(request, apiRoute, masterType, 304, fixture, true, null, null,
                    buildQueryDetails(null, keyword, effective, params));
            return buildNotModifiedResponse(etagValue, ttlSeconds);
        }
        final Integer totalCount = dbResult.getTotalCount();
        final List<OrcaTensuEntry> items = fixture.entries.stream()
                .map(entry -> toCommentEntry(entry, fixture))
                .collect(Collectors.toList());
        OrcaMasterListResponse<OrcaTensuEntry> response = new OrcaMasterListResponse<>();
        if (totalCount != null) {
            response.setTotalCount(totalCount);
        }
        response.setItems(items);
        recordMasterAudit(request, apiRoute, masterType, 200, fixture, false, items.isEmpty(),
                totalCount, buildQueryDetails(null, keyword, effective, params));
        return buildCachedOkResponse(response, etagValue, ttlSeconds);
    }

    @GET
    @Path("/bodypart")
    public Response getBodypart(
            @HeaderParam("If-None-Match") String ifNoneMatch,
            @Context UriInfo uriInfo,
            @Context HttpServletRequest request
    ) {
        if (!isAuthorized(request)) {
            return unauthorized(request);
        }
        final MultivaluedMap<String, String> params = uriInfo.getQueryParameters();
        final String keyword = getFirstValue(params, "keyword");
        final String effective = normalizeEffectiveDate(getFirstValue(params, "effective"));
        OrcaMasterDao.CommentCriteria criteria = new OrcaMasterDao.CommentCriteria();
        criteria.setKeyword(keyword);
        criteria.setEffective(effective);
        criteria.setPage(parsePositiveInt(params, "page", 1));
        criteria.setSize(parsePageSize(params, "size", 100));
        criteria.setIncludeTotalCount(shouldIncludeTotalCount(params));
        OrcaMasterDao.ListSearchResult<OrcaMasterDao.CommentRecord> dbResult = masterService.searchBodypart(criteria);
        final String masterType = "orca08-bodypart";
        final String apiRoute = "/api/orca/master/bodypart";
        if (dbResult == null) {
            LoadedFixture<OrcaMasterDao.CommentRecord> dbFixture = buildDbFixture(
                    Collections.emptyList(),
                    null,
                    true
            );
            Response failure = serviceUnavailable(request, "MASTER_BODYPART_UNAVAILABLE", "部位マスタを取得できませんでした");
            recordMasterAudit(request, apiRoute, masterType, 503, dbFixture, false, true, 0,
                    buildQueryDetails(null, keyword, effective, params));
            return failure;
        }
        LoadedFixture<OrcaMasterDao.CommentRecord> fixture = buildDbFixture(
                dbResult.getRecords(),
                dbResult.getVersion(),
                false
        );
        final String etagValue = buildEtag(apiRoute, masterType, fixture, params);
        final long ttlSeconds = cacheTtlSeconds(masterType);
        if (etagMatches(ifNoneMatch, etagValue)) {
            recordMasterAudit(request, apiRoute, masterType, 304, fixture, true, null, null,
                    buildQueryDetails(null, keyword, effective, params));
            return buildNotModifiedResponse(etagValue, ttlSeconds);
        }
        final Integer totalCount = dbResult.getTotalCount();
        final List<OrcaTensuEntry> items = fixture.entries.stream()
                .map(entry -> toCommentEntry(entry, fixture))
                .collect(Collectors.toList());
        OrcaMasterListResponse<OrcaTensuEntry> response = new OrcaMasterListResponse<>();
        if (totalCount != null) {
            response.setTotalCount(totalCount);
        }
        response.setItems(items);
        recordMasterAudit(request, apiRoute, masterType, 200, fixture, false, items.isEmpty(),
                totalCount, buildQueryDetails(null, keyword, effective, params));
        return buildCachedOkResponse(response, etagValue, ttlSeconds);
    }


    @GET
    @Path("/youhou")
    public Response getYouhou(
            @HeaderParam("If-None-Match") String ifNoneMatch,
            @Context UriInfo uriInfo,
            @Context HttpServletRequest request
    ) {
        if (!isAuthorized(request)) {
            return unauthorized(request);
        }
        final MultivaluedMap<String, String> params = uriInfo.getQueryParameters();
        final String keyword = getFirstValue(params, "keyword");
        final String effective = getFirstValue(params, "effective");
        OrcaMasterDao.YouhouCriteria criteria = new OrcaMasterDao.YouhouCriteria();
        criteria.setKeyword(keyword);
        criteria.setEffective(effective);
        OrcaMasterDao.ListSearchResult<OrcaMasterDao.YouhouRecord> dbResult = masterService.searchYouhou(criteria);
        final String masterType = "orca05-youhou";
        if (dbResult == null) {
            LoadedFixture<OrcaMasterDao.YouhouRecord> unavailableFixture = unavailableFixture();
            Response failure = serviceUnavailable(request, "MASTER_YOUHOU_UNAVAILABLE", "用法マスタを取得できませんでした");
            recordMasterAudit(request, "/api/orca/master/youhou", masterType, 503, unavailableFixture, false,
                    true, 0, buildQueryDetails(null, keyword, effective, params));
            return failure;
        }
        LoadedFixture<OrcaMasterDao.YouhouRecord> fixture = buildDbFixture(
                dbResult.getRecords(),
                dbResult.getVersion(),
                false
        );
        final String etagValue = buildEtag("/api/orca/master/youhou", masterType, fixture, params);
        final long ttlSeconds = cacheTtlSeconds(masterType);
        if (etagMatches(ifNoneMatch, etagValue)) {
            recordMasterAudit(request, "/api/orca/master/youhou", masterType, 304, fixture, true, null, null,
                    buildQueryDetails(null, keyword, effective, params));
            return buildNotModifiedResponse(etagValue, ttlSeconds);
        }
        final List<OrcaDrugMasterEntry> response = fixture.entries.stream()
                .map(entry -> toYouhouEntry(entry, fixture))
                .collect(Collectors.toList());
        recordMasterAudit(request, "/api/orca/master/youhou", masterType, 200, fixture, false, response.isEmpty(),
                response.size(), buildQueryDetails(null, keyword, effective, params));
        return buildCachedOkResponse(response, etagValue, ttlSeconds);
    }

    @GET
    @Path("/material")
    public Response getMaterial(
            @HeaderParam("If-None-Match") String ifNoneMatch,
            @Context UriInfo uriInfo,
            @Context HttpServletRequest request
    ) {
        if (!isAuthorized(request)) {
            return unauthorized(request);
        }
        final MultivaluedMap<String, String> params = uriInfo.getQueryParameters();
        final String keyword = getFirstValue(params, "keyword");
        final String effective = getFirstValue(params, "effective");
        OrcaMasterDao.MaterialCriteria criteria = new OrcaMasterDao.MaterialCriteria();
        criteria.setKeyword(keyword);
        criteria.setEffective(effective);
        OrcaMasterDao.ListSearchResult<OrcaMasterDao.MaterialRecord> dbResult = masterService.searchMaterial(criteria);
        final String masterType = "orca05-material";
        if (dbResult == null) {
            LoadedFixture<OrcaMasterDao.MaterialRecord> unavailableFixture = unavailableFixture();
            Response failure = serviceUnavailable(request, "MASTER_MATERIAL_UNAVAILABLE", "特定器材マスタを取得できませんでした");
            recordMasterAudit(request, "/api/orca/master/material", masterType, 503, unavailableFixture, false,
                    true, 0, buildQueryDetails(null, keyword, effective, params));
            return failure;
        }
        LoadedFixture<OrcaMasterDao.MaterialRecord> fixture = buildDbFixture(
                dbResult.getRecords(),
                dbResult.getVersion(),
                false
        );
        final String etagValue = buildEtag("/api/orca/master/material", masterType, fixture, params);
        final long ttlSeconds = cacheTtlSeconds(masterType);
        if (etagMatches(ifNoneMatch, etagValue)) {
            recordMasterAudit(request, "/api/orca/master/material", masterType, 304, fixture, true, null, null,
                    buildQueryDetails(null, keyword, effective, params));
            return buildNotModifiedResponse(etagValue, ttlSeconds);
        }
        final List<OrcaDrugMasterEntry> response = fixture.entries.stream()
                .map(entry -> toMaterialEntry(entry, fixture))
                .collect(Collectors.toList());
        recordMasterAudit(request, "/api/orca/master/material", masterType, 200, fixture, false, response.isEmpty(),
                response.size(), buildQueryDetails(null, keyword, effective, params));
        return buildCachedOkResponse(response, etagValue, ttlSeconds);
    }

    @GET
    @Path("/kensa-sort")
    public Response getKensaSort(
            @HeaderParam("If-None-Match") String ifNoneMatch,
            @Context UriInfo uriInfo,
            @Context HttpServletRequest request
    ) {
        if (!isAuthorized(request)) {
            return unauthorized(request);
        }
        final MultivaluedMap<String, String> params = uriInfo.getQueryParameters();
        final String keyword = getFirstValue(params, "keyword");
        final String effective = getFirstValue(params, "effective");
        OrcaMasterDao.KensaSortCriteria criteria = new OrcaMasterDao.KensaSortCriteria();
        criteria.setKeyword(keyword);
        criteria.setEffective(effective);
        OrcaMasterDao.ListSearchResult<OrcaMasterDao.KensaSortRecord> dbResult = masterService.searchKensaSort(criteria);
        final String masterType = "orca05-kensa-sort";
        if (dbResult == null) {
            LoadedFixture<OrcaMasterDao.KensaSortRecord> unavailableFixture = unavailableFixture();
            Response failure = serviceUnavailable(request, "MASTER_KENSA_SORT_UNAVAILABLE",
                    "検査区分マスタを取得できませんでした");
            recordMasterAudit(request, "/api/orca/master/kensa-sort", masterType, 503, unavailableFixture, false,
                    true, 0, buildQueryDetails(null, keyword, effective, params));
            return failure;
        }
        LoadedFixture<OrcaMasterDao.KensaSortRecord> fixture = buildDbFixture(
                dbResult.getRecords(),
                dbResult.getVersion(),
                false
        );
        final String etagValue = buildEtag("/api/orca/master/kensa-sort", masterType, fixture, params);
        final long ttlSeconds = cacheTtlSeconds(masterType);
        if (etagMatches(ifNoneMatch, etagValue)) {
            recordMasterAudit(request, "/api/orca/master/kensa-sort", masterType, 304, fixture, true, null, null,
                    buildQueryDetails(null, keyword, effective, params));
            return buildNotModifiedResponse(etagValue, ttlSeconds);
        }
        final List<OrcaDrugMasterEntry> response = fixture.entries.stream()
                .map(entry -> toKensaSortEntry(entry, fixture))
                .collect(Collectors.toList());
        recordMasterAudit(request, "/api/orca/master/kensa-sort", masterType, 200, fixture, false, response.isEmpty(),
                response.size(), buildQueryDetails(null, keyword, effective, params));
        return buildCachedOkResponse(response, etagValue, ttlSeconds);
    }


    @GET
    @Path("/etensu")
    public Response getEtensu(
            @HeaderParam("If-None-Match") String ifNoneMatch,
            @Context UriInfo uriInfo,
            @Context HttpServletRequest request
    ) {
        if (!isAuthorized(request)) {
            return unauthorized(request);
        }
        final MultivaluedMap<String, String> params = uriInfo.getQueryParameters();
        final String keyword = getFirstValue(params, "keyword");
        final String masterType = "orca08-etensu";
        final String apiRoute = "/api/orca/master/etensu";
        final String category = getFirstValue(params, "category");
        if (category != null && !ETENSU_CATEGORY_PATTERN.matcher(category).matches()) {
            recordEtensuValidationAudit(request, masterType, keyword, category, null, null, null, null,
                    "TENSU_CATEGORY_INVALID", params);
            return validationError(request, "TENSU_CATEGORY_INVALID", "category must be numeric 1-2 digits");
        }
        final String asOf = getFirstValue(params, "asOf");
        if (asOf != null && !AS_OF_PATTERN.matcher(asOf).matches()) {
            recordEtensuValidationAudit(request, masterType, keyword, category, asOf, null, null, null,
                    "TENSU_ASOF_INVALID", params);
            return validationError(request, "TENSU_ASOF_INVALID", "asOf must be YYYYMMDD");
        }
        final String tensuVersion = getFirstValue(params, "tensuVersion");
        if (tensuVersion != null && !TENSU_VERSION_PATTERN.matcher(tensuVersion).matches()) {
            recordEtensuValidationAudit(request, masterType, keyword, category, asOf, tensuVersion, null, null,
                    "TENSU_VERSION_INVALID", params);
            return validationError(request, "TENSU_VERSION_INVALID", "tensuVersion must be YYYYMM");
        }
        final String pointsMinRaw = getFirstValue(params, "pointsMin");
        final Double pointsMin = parseNullableDouble(pointsMinRaw);
        if (pointsMinRaw != null && pointsMin == null) {
            recordEtensuValidationAudit(request, masterType, keyword, category, asOf, tensuVersion, null, null,
                    "TENSU_POINTS_MIN_INVALID", params);
            return badRequest(request, "TENSU_POINTS_MIN_INVALID", "pointsMin must be numeric");
        }
        final String pointsMaxRaw = getFirstValue(params, "pointsMax");
        final Double pointsMax = parseNullableDouble(pointsMaxRaw);
        if (pointsMaxRaw != null && pointsMax == null) {
            recordEtensuValidationAudit(request, masterType, keyword, category, asOf, tensuVersion, null, null,
                    "TENSU_POINTS_MAX_INVALID", params);
            return badRequest(request, "TENSU_POINTS_MAX_INVALID", "pointsMax must be numeric");
        }
        if (pointsMin != null && pointsMax != null && pointsMin.doubleValue() > pointsMax.doubleValue()) {
            recordEtensuValidationAudit(request, masterType, keyword, category, asOf, tensuVersion, pointsMin, pointsMax,
                    "TENSU_POINTS_RANGE_INVALID", params);
            return badRequest(request, "TENSU_POINTS_RANGE_INVALID", "pointsMin must be less than or equal to pointsMax");
        }
        EtensuDao.EtensuSearchCriteria criteria = new EtensuDao.EtensuSearchCriteria();
        criteria.setKeyword(keyword);
        criteria.setCategory(category);
        criteria.setAsOf(asOf);
        criteria.setTensuVersion(tensuVersion);
        criteria.setPointsMin(pointsMin);
        criteria.setPointsMax(pointsMax);
        criteria.setPage(parsePositiveInt(params, "page", 1));
        criteria.setSize(parsePageSize(params, "size", 100));
        criteria.setIncludeTotalCount(shouldIncludeTotalCount(params));
        EtensuDao.EtensuSearchResult dbResult = masterService.searchEtensu(criteria);
        if (dbResult == null || dbResult.isLoadFailed()) {
            LoadedFixture<EtensuDao.EtensuRecord> unavailableFixture = unavailableFixture();
            Response failure = serviceUnavailable(request, "ETENSU_UNAVAILABLE", "etensu master unavailable");
            recordMasterAudit(request, apiRoute, masterType, 503, unavailableFixture, false, true, 0,
                    buildTensuQueryDetails(keyword, category, asOf, tensuVersion, pointsMin, pointsMax, params));
            return failure;
        }
        LoadedFixture<EtensuDao.EtensuRecord> dbFixture = new LoadedFixture<>(
                dbResult.getRecords(),
                null,
                dbResult.getVersion(),
                DataOrigin.ORCA_DB,
                false
        );
        final String etagValue = buildEtag(apiRoute, masterType, dbFixture, params);
        final long ttlSeconds = cacheTtlSeconds(masterType);
        final Map<String, Object> etensuAuditDetails = buildEtensuAuditDetails(keyword, category, asOf, tensuVersion,
                pointsMin, pointsMax, params, dbResult);
        final Map<String, String> basePerfHeaders = buildEtensuPerformanceHeaders(dbResult, false);
        if (etagMatches(ifNoneMatch, etagValue)) {
            recordMasterAudit(request, apiRoute, masterType, 304, dbFixture, true, null,
                    dbResult.getTotalCount(), etensuAuditDetails);
            Map<String, String> perfHeaders = buildEtensuPerformanceHeaders(dbResult, true);
            return buildNotModifiedResponse(etagValue, ttlSeconds, perfHeaders);
        }
        if (dbResult.getRecords().isEmpty()) {
            Response notFound = buildErrorResponse(Status.NOT_FOUND, "TENSU_NOT_FOUND",
                    "no etensu entries matched", request, basePerfHeaders);
            recordMasterAudit(request, apiRoute, masterType, 404, dbFixture, false, true, 0,
                    true, true, etensuAuditDetails);
            return notFound;
        }
        final Integer totalCount = dbResult.getTotalCount();
        final List<OrcaTensuEntry> items = new ArrayList<>(dbResult.getRecords().size());
        for (EtensuDao.EtensuRecord entry : dbResult.getRecords()) {
            items.add(toEtensuEntry(entry, dbFixture));
        }
        OrcaMasterListResponse<OrcaTensuEntry> response = new OrcaMasterListResponse<>();
        if (totalCount != null) {
            response.setTotalCount(totalCount);
        }
        response.setItems(items);
        recordMasterAudit(request, apiRoute, masterType, 200, dbFixture, false, items.isEmpty(),
                totalCount,
                etensuAuditDetails);
        return buildCachedOkResponse(response, etagValue, ttlSeconds, basePerfHeaders);
    }

    private void recordEtensuValidationAudit(HttpServletRequest request, String masterType, String keyword,
            String category, String asOf, String tensuVersion, Double pointsMin, Double pointsMax, String errorCode,
            MultivaluedMap<String, String> params) {
        LoadedFixture<EtensuDao.EtensuRecord> dbFixture = new LoadedFixture<>(
                Collections.emptyList(),
                null,
                tensuVersion,
                DataOrigin.ORCA_DB,
                false
        );
        java.util.Map<String, Object> details =
                buildTensuQueryDetails(keyword, category, asOf, tensuVersion, pointsMin, pointsMax, params);
        details.put("validationError", true);
        if (errorCode != null && !errorCode.isBlank()) {
            details.put("errorCode", errorCode);
        }
        int httpStatus = errorCode != null && errorCode.startsWith("TENSU_POINTS_") ? 400 : 422;
        recordMasterAudit(request, "/api/orca/master/etensu", masterType, httpStatus, dbFixture, false, null, 0, details);
    }

    private Response unauthorized(HttpServletRequest request) {
        OrcaMasterErrorResponse response = new OrcaMasterErrorResponse();
        response.setCode("ORCA_MASTER_UNAUTHORIZED");
        response.setError("ORCA_MASTER_UNAUTHORIZED");
        response.setErrorCode("ORCA_MASTER_UNAUTHORIZED");
        response.setMessage("Authenticated principal is required.");
        response.setStatus(Status.UNAUTHORIZED.getStatusCode());
        response.setRunId(resolveRunId(request));
        response.setTimestamp(Instant.now().toString());
        String traceId = resolveTraceId(request);
        if (traceId != null && !traceId.isBlank()) {
            response.setCorrelationId(traceId);
            response.setTraceId(traceId);
        }
        response.setPath(request != null ? request.getRequestURI() : "/orca/master");
        response.setErrorCategory("unauthorized");
        return Response.status(Status.UNAUTHORIZED).entity(response).build();
    }

    private Response validationError(HttpServletRequest request, String code, String message) {
        return auditSupport().validationError(request, code, message);
    }

    private Response badRequest(HttpServletRequest request, String code, String message) {
        return auditSupport().badRequest(request, code, message);
    }

    private <T> List<T> safeList(List<T> source) {
        return masterService.safeList(source);
    }

    private <T> LoadedFixture<T> buildDbFixture(List<T> entries, String version, boolean loadFailed) {
        return toResourceFixture(masterService.buildDbFixture(entries, version, loadFailed));
    }

    private <T> LoadedFixture<T> unavailableFixture() {
        return new LoadedFixture<>(Collections.emptyList(), null, null, DataOrigin.FALLBACK, true);
    }

    private <T> List<T> paginateList(List<T> source, MultivaluedMap<String, String> params) {
        return masterService.paginateList(source, params);
    }

    private int parsePositiveInt(MultivaluedMap<String, String> params, String key, int fallback) {
        return masterService.parsePositiveInt(params, key, fallback);
    }

    private int parsePageSize(MultivaluedMap<String, String> params, String key, int fallback) {
        return masterService.parsePageSize(params, key, fallback);
    }

    private String normalizeDrugSearchMethod(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String normalized = value.trim().toLowerCase(Locale.ROOT);
        return switch (normalized) {
            case "prefix", "partial" -> normalized;
            default -> null;
        };
    }

    private String normalizeDrugScope(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String normalized = value.trim().toLowerCase(Locale.ROOT);
        return switch (normalized) {
            case "outer", "in-hospital", "adopted" -> normalized;
            default -> null;
        };
    }

    private OrcaDrugMasterEntry toGenericClassEntry(OrcaMasterDao.GenericClassRecord entry, LoadedFixture<?> fixture) {
        return responseMapper.toGenericClassEntry(entry, toServiceFixture(fixture));
    }

    private OrcaDrugMasterEntry toGenericClassEntry(FixtureGenericClassEntry entry, LoadedFixture<?> fixture) {
        return responseMapper.toGenericClassEntry(entry, toServiceFixture(fixture));
    }

    private OrcaDrugMasterEntry toGenericPriceEntry(FixtureGenericPriceEntry entry, LoadedFixture<?> fixture) {
        return responseMapper.toGenericPriceEntry(entry, toServiceFixture(fixture));
    }

    private OrcaDrugMasterEntry toDrugEntry(OrcaMasterDao.DrugRecord entry, LoadedFixture<?> fixture) {
        return responseMapper.toDrugEntry(entry, toServiceFixture(fixture));
    }

    private OrcaInsurerEntry toInsurerEntry(FixtureHokenjaEntry entry, LoadedFixture<?> fixture) {
        return responseMapper.toInsurerEntry(entry, toServiceFixture(fixture));
    }

    private OrcaAddressEntry toAddressEntry(FixtureAddressEntry entry, LoadedFixture<?> fixture) {
        return responseMapper.toAddressEntry(entry, toServiceFixture(fixture));
    }

    private OrcaTensuEntry toCommentEntry(OrcaMasterDao.CommentRecord entry, LoadedFixture<?> fixture) {
        return responseMapper.toCommentEntry(entry, toServiceFixture(fixture));
    }

    private OrcaDrugMasterEntry toYouhouEntry(OrcaMasterDao.YouhouRecord entry, LoadedFixture<?> fixture) {
        return responseMapper.toYouhouEntry(entry, toServiceFixture(fixture));
    }

    private OrcaDrugMasterEntry toYouhouEntry(FixtureYouhouEntry entry, LoadedFixture<?> fixture) {
        return responseMapper.toYouhouEntry(entry, toServiceFixture(fixture));
    }

    private OrcaDrugMasterEntry toMaterialEntry(OrcaMasterDao.MaterialRecord entry, LoadedFixture<?> fixture) {
        return responseMapper.toMaterialEntry(entry, toServiceFixture(fixture));
    }

    private OrcaDrugMasterEntry toMaterialEntry(FixtureMaterialEntry entry, LoadedFixture<?> fixture) {
        return responseMapper.toMaterialEntry(entry, toServiceFixture(fixture));
    }

    private OrcaDrugMasterEntry toKensaSortEntry(OrcaMasterDao.KensaSortRecord entry, LoadedFixture<?> fixture) {
        return responseMapper.toKensaSortEntry(entry, toServiceFixture(fixture));
    }

    private OrcaDrugMasterEntry toKensaSortEntry(FixtureKensaSortEntry entry, LoadedFixture<?> fixture) {
        return responseMapper.toKensaSortEntry(entry, toServiceFixture(fixture));
    }

    private OrcaTensuEntry toEtensuEntry(FixtureEtensuEntry entry, LoadedFixture<?> fixture) {
        return responseMapper.toEtensuEntry(entry, toServiceFixture(fixture));
    }

    private OrcaTensuEntry toEtensuEntry(EtensuDao.EtensuRecord record, LoadedFixture<?> fixture) {
        return responseMapper.toEtensuEntry(record, toServiceFixture(fixture));
    }

    private OrcaDrugMasterEntry buildDrugEntry(
            String code,
            String name,
            String category,
            String unit,
            Double minPrice,
            String youhouCode,
            String materialCategory,
            String kensaSort,
            String validFrom,
            String validTo,
            String note,
            LoadedFixture<?> fixture,
            Boolean cacheHit,
            Boolean missingMaster,
            Boolean fallbackUsed
    ) {
        return responseMapper.buildDrugEntry(code, name, category, unit, minPrice, youhouCode, materialCategory,
                kensaSort, validFrom, validTo, note, toServiceFixture(fixture), cacheHit, missingMaster, fallbackUsed);
    }

    private boolean isEffective(String effective, String... ranges) {
        if (effective == null || effective.isBlank()) {
            return true;
        }
        String validFrom = null;
        String validTo = null;
        if (ranges != null && ranges.length > 0) {
            if (ranges.length >= 1) {
                validFrom = ranges[0];
            }
            if (ranges.length >= 2) {
                validTo = ranges[1];
            }
            if (ranges.length >= 3 && validFrom == null) {
                validFrom = ranges[2];
            }
            if (ranges.length >= 4 && validTo == null) {
                validTo = ranges[3];
            }
        }
        validFrom = firstNonBlank(validFrom, DEFAULT_VALID_FROM);
        validTo = firstNonBlank(validTo, DEFAULT_VALID_TO);
        return effective.compareTo(validFrom) >= 0 && effective.compareTo(validTo) <= 0;
    }

    private String getFirstValue(MultivaluedMap<String, String> params, String... keys) {
        if (params == null) {
            return null;
        }
        for (String key : keys) {
            List<String> values = params.get(key);
            if (values != null && !values.isEmpty()) {
                String value = values.get(0);
                if (value != null && !value.isBlank()) {
                    return value;
                }
            }
        }
        return null;
    }

    private String normalizeEffectiveDate(String value) {
        if (value == null || value.isBlank()) {
            return value;
        }
        String digitsOnly = value.replaceAll("[^0-9]", "");
        if (digitsOnly.length() == 8) {
            return digitsOnly;
        }
        return value;
    }

    private boolean matchesKeyword(String keyword, String... values) {
        if (keyword == null || keyword.isBlank()) {
            return true;
        }
        if (values == null) {
            return false;
        }
        for (String value : values) {
            if (value != null && value.toLowerCase().contains(keyword.toLowerCase())) {
                return true;
            }
        }
        return false;
    }

    private boolean matchesPref(String pref, FixtureHokenjaEntry entry) {
        if (pref == null || pref.isBlank()) {
            return true;
        }
        String candidate = firstNonBlank(entry.prefCode, entry.prefectureCode);
        if (candidate != null && pref.equals(candidate)) {
            return true;
        }
        String payerCode = firstNonBlank(entry.payerCode, entry.insurerNumber);
        return payerCode != null && payerCode.startsWith(pref);
    }

    private boolean matchesEtensuCategory(String category, FixtureEtensuEntry entry) {
        if (category == null || category.isBlank()) {
            return true;
        }
        String entryCategory = firstNonBlank(entry.category, entry.etensuCategory, entry.kubun);
        if (entryCategory == null) {
            return false;
        }
        if (category.equals(entryCategory)) {
            return true;
        }
        return category.length() > entryCategory.length() && category.startsWith(entryCategory);
    }

    private boolean matchesTensuVersion(String normalized, FixtureEtensuEntry entry) {
        if (normalized == null || normalized.isBlank()) {
            return true;
        }
        String entryVersion = normalizeTensuVersion(resolveTensuVersion(entry));
        if (entryVersion == null) {
            return false;
        }
        return normalized.equals(entryVersion);
    }

    private boolean isAuthorized(HttpServletRequest request) {
        return OrcaMasterAuthSupport.isAuthorized(request);
    }

    private String firstNonBlank(String... candidates) {
        if (candidates == null) {
            return null;
        }
        for (String candidate : candidates) {
            if (candidate != null && !candidate.isBlank()) {
                return candidate;
            }
        }
        return null;
    }

    private Double firstNonBlankDouble(Double... candidates) {
        if (candidates == null) {
            return null;
        }
        for (Double candidate : candidates) {
            if (candidate != null) {
                return candidate;
            }
        }
        return null;
    }

    private String normalizeTensuVersion(String version) {
        if (version == null || version.isBlank()) {
            return null;
        }
        if (TENSU_VERSION_PATTERN.matcher(version).matches()) {
            return version;
        }
        String digits = version.replaceAll("\\D", "");
        if (digits.length() >= 6) {
            return digits.substring(0, 6);
        }
        return version;
    }

    private String resolveTensuVersion(FixtureEtensuEntry entry) {
        return firstNonBlank(entry.tensuVersion, entry.version, entry.snapshotVersion);
    }

    private Response notFound(String code, String message, HttpServletRequest request) {
        return auditSupport().notFound(code, message, request);
    }

    private Response serviceUnavailable(HttpServletRequest request, String code, String message) {
        return auditSupport().serviceUnavailable(request, code, message);
    }

    private Response buildErrorResponse(Status status, String code, String message, HttpServletRequest request,
            Map<String, String> extraHeaders) {
        OrcaMasterErrorResponse response = new OrcaMasterErrorResponse();
        response.setCode(code);
        response.setError(code);
        response.setErrorCode(code);
        response.setMessage(message);
        response.setStatus(status != null ? status.getStatusCode() : null);
        response.setRunId(resolveRunId(request));
        response.setTimestamp(Instant.now().toString());
        String traceId = resolveTraceId(request);
        if (traceId != null && !traceId.isBlank()) {
            response.setCorrelationId(traceId);
            response.setTraceId(traceId);
        }
        response.setPath(request != null ? request.getRequestURI() : "/orca/master");
        if (status != null) {
            response.setErrorCategory(switch (status.getStatusCode()) {
                case 400, 422 -> "validation_error";
                case 401 -> "unauthorized";
                case 403 -> "forbidden";
                case 404 -> "not_found";
                default -> status.getStatusCode() >= 500 ? "server_error" : "client_error";
            });
        }
        Response.ResponseBuilder builder = Response.status(status).entity(response);
        applyExtraHeaders(builder, extraHeaders);
        return builder.build();
    }

    private String resolveRunId(HttpServletRequest request) {
        return AbstractOrcaRestResource.resolveRunIdValue(request);
    }

    private String resolvePayerType(String rawType, String payerCode) {
        String source = rawType != null ? rawType : "";
        if (source.contains("国保")) {
            return "national_health";
        }
        if (source.contains("船員")) {
            return "seamen";
        }
        if (source.contains("共済")) {
            return "mutual_aid";
        }
        if (source.contains("後期")) {
            return "late_elderly";
        }
        if (source.contains("社保") || source.contains("健保") || source.contains("協会")) {
            return "social_insurance";
        }
        if (payerCode != null && payerCode.startsWith("39")) {
            return "late_elderly";
        }
        return "other";
    }

    private Double resolvePayerRatio(Double ratio, String payerType) {
        if (ratio != null) {
            return ratio;
        }
        if ("late_elderly".equals(payerType)) {
            return 0.1;
        }
        return 0.3;
    }

    private String derivePrefCode(String payerCode) {
        if (payerCode == null || payerCode.length() < 2) {
            return null;
        }
        return payerCode.substring(0, 2);
    }

    private String deriveCityCode(String prefCode) {
        if (prefCode == null || prefCode.isBlank()) {
            return null;
        }
        return prefCode + "000";
    }


    private void recordMasterAudit(HttpServletRequest request, String apiRoute, String masterType, int httpStatus,
            LoadedFixture<?> fixture, boolean cacheHit, Boolean emptyResult, Integer resultCount,
            java.util.Map<String, Object> extraDetails) {
        auditSupport().recordMasterAudit(request, apiRoute, masterType, httpStatus, toServiceFixture(fixture), cacheHit,
                emptyResult, resultCount, extraDetails);
    }

    private void recordMasterAudit(HttpServletRequest request, String apiRoute, String masterType, int httpStatus,
            LoadedFixture<?> fixture, boolean cacheHit, Boolean emptyResult, Integer resultCount,
            Boolean missingMasterOverride, Boolean fallbackUsedOverride, java.util.Map<String, Object> extraDetails) {
        auditSupport().recordMasterAudit(request, apiRoute, masterType, httpStatus, toServiceFixture(fixture), cacheHit,
                emptyResult, resultCount, missingMasterOverride, fallbackUsedOverride, extraDetails);
    }

    private java.util.Map<String, Object> buildQueryDetails(String pref, String keyword, String effective,
            MultivaluedMap<String, String> params) {
        return auditSupport().buildQueryDetails(pref, keyword, effective, params);
    }

    private java.util.Map<String, Object> buildQueryDetails(String pref, String keyword, String effective,
            MultivaluedMap<String, String> params, String zip) {
        return auditSupport().buildQueryDetails(pref, keyword, effective, params, zip);
    }

    private java.util.Map<String, Object> buildSrycdDetails(String srycd, String effective,
            MultivaluedMap<String, String> params) {
        return auditSupport().buildSrycdDetails(srycd, effective, params);
    }

    private java.util.Map<String, Object> buildTensuQueryDetails(String keyword, String category, String asOf,
            String tensuVersion, Double pointsMin, Double pointsMax, MultivaluedMap<String, String> params) {
        return auditSupport().buildTensuQueryDetails(keyword, category, asOf, tensuVersion, pointsMin, pointsMax, params);
    }

    private java.util.Map<String, Object> buildEtensuAuditDetails(String keyword, String category, String asOf,
            String tensuVersion, Double pointsMin, Double pointsMax, MultivaluedMap<String, String> params,
            EtensuDao.EtensuSearchResult result) {
        return auditSupport().buildEtensuAuditDetails(keyword, category, asOf, tensuVersion, pointsMin, pointsMax,
                params, result);
    }

    private Double parseNullableDouble(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return Double.parseDouble(value.trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private boolean matchesPointsRange(Double pointsMin, Double pointsMax, Double points) {
        if (points == null) {
            return pointsMin == null && pointsMax == null;
        }
        if (pointsMin != null && points.doubleValue() < pointsMin.doubleValue()) {
            return false;
        }
        if (pointsMax != null && points.doubleValue() > pointsMax.doubleValue()) {
            return false;
        }
        return true;
    }

    private Map<String, String> buildEtensuPerformanceHeaders(EtensuDao.EtensuSearchResult result, boolean cacheHit) {
        if (result == null) {
            return Collections.emptyMap();
        }
        Map<String, String> headers = new LinkedHashMap<>();
        headers.put("X-Orca-Db-Time", Long.toString(result.getDbTimeMs()));
        headers.put("X-Orca-Row-Count", Integer.toString(result.getRecords().size()));
        if (result.getTotalCount() != null) {
            headers.put("X-Orca-Total-Count", Integer.toString(result.getTotalCount()));
        }
        headers.put("X-Orca-Cache-Hit", Boolean.toString(cacheHit));
        return headers;
    }

    private boolean shouldIncludeTotalCount(MultivaluedMap<String, String> params) {
        if (params == null) {
            return false;
        }
        String raw = getFirstValue(params, "includeTotalCount");
        if (raw == null || raw.isBlank()) {
            return false;
        }
        String normalized = raw.trim().toLowerCase(Locale.ROOT);
        return "1".equals(normalized) || "true".equals(normalized) || "yes".equals(normalized);
    }

    private String buildEtag(String apiRoute, String masterType, LoadedFixture<?> fixture,
            MultivaluedMap<String, String> params) {
        return masterService.buildEtag(apiRoute, masterType, toServiceFixture(fixture), params);
    }

    private String normalizeQuery(MultivaluedMap<String, String> params) {
        return masterService.normalizeQuery(params);
    }

    private String sha256Hex(String input) {
        return input == null ? null : masterService.buildEtag("sha256", "sha256",
                new OrcaMasterService.LoadedFixture<>(List.of(), null, input, OrcaMasterService.DataOrigin.ORCA_DB, false),
                null);
    }

    private boolean etagMatches(String ifNoneMatch, String etagValue) {
        return masterService.etagMatches(ifNoneMatch, etagValue);
    }

    private Response buildCachedOkResponse(Object entity, String etagValue, long ttlSeconds) {
        return buildCachedOkResponse(entity, etagValue, ttlSeconds, null);
    }

    private Response buildNotModifiedResponse(String etagValue, long ttlSeconds) {
        return buildNotModifiedResponse(etagValue, ttlSeconds, null);
    }

    private Response buildCachedOkResponse(Object entity, String etagValue, long ttlSeconds,
            Map<String, String> extraHeaders) {
        return masterService.buildCachedOkResponse(entity, etagValue, ttlSeconds, extraHeaders);
    }

    private Response buildNotModifiedResponse(String etagValue, long ttlSeconds, Map<String, String> extraHeaders) {
        return masterService.buildNotModifiedResponse(etagValue, ttlSeconds, extraHeaders);
    }

    private void applyExtraHeaders(Response.ResponseBuilder builder, Map<String, String> extraHeaders) {
        if (builder == null || extraHeaders == null || extraHeaders.isEmpty()) {
            return;
        }
        for (Map.Entry<String, String> entry : extraHeaders.entrySet()) {
            if (entry.getKey() == null || entry.getKey().isBlank()) {
                continue;
            }
            if (entry.getValue() == null) {
                continue;
            }
            builder.header(entry.getKey(), entry.getValue());
        }
    }

    private String cacheControlHeader(long ttlSeconds) {
        return "public, max-age=" + ttlSeconds + ", stale-while-revalidate=" + CACHE_STALE_REVALIDATE_SECONDS;
    }

    private long cacheTtlSeconds(String masterType) {
        return masterService.cacheTtlSeconds(masterType);
    }

    static final class FixtureListResponse<T> {
        public List<T> list;
        public Integer totalCount;
        public String snapshotVersion;
        public String version;
    }

    static final class FixtureGenericClassEntry {
        public String classCode;
        public String className;
        public String kanaName;
        public String categoryCode;
        public String parentClassCode;
        public Boolean isLeaf;
        public String startDate;
        public String endDate;
        public String validFrom;
        public String validTo;
        public Boolean cacheHit;
        public Boolean missingMaster;
        public Boolean fallbackUsed;
    }

    static final class FixtureGenericPriceEntry {
        public String code;
        public String srycd;
        public String name;
        public String drugName;
        public String unit;
        public Double price;
        public Double minPrice;
        public String youhouCode;
        public String startDate;
        public String endDate;
        public String validFrom;
        public String validTo;
        public Boolean cacheHit;
        public Boolean missingMaster;
        public Boolean fallbackUsed;
    }

    static final class FixtureHokenjaEntry {
        public String payerCode;
        public String insurerNumber;
        public String payerName;
        public String insurerName;
        public String insurerKana;
        public String payerType;
        public String insurerType;
        public Double payerRatio;
        public String prefCode;
        public String prefectureCode;
        public String cityCode;
        public String zip;
        public String zipCode;
        public String addressLine;
        public String address;
        public String phone;
        public String startDate;
        public String endDate;
        public String validFrom;
        public String validTo;
        public Boolean cacheHit;
        public Boolean missingMaster;
        public Boolean fallbackUsed;
    }

    static final class FixtureAddressEntry {
        public String zip;
        public String zipCode;
        public String prefCode;
        public String prefectureCode;
        public String cityCode;
        public String city;
        public String town;
        public String kana;
        public String roman;
        public String fullAddress;
        public String addressLine;
        public String address;
        public String startDate;
        public String endDate;
        public String validFrom;
        public String validTo;
        public Boolean cacheHit;
        public Boolean missingMaster;
        public Boolean fallbackUsed;
    }


    static final class FixtureReference {
        public String yukostymd;
        public String yukoedymd;
        public String source;
    }

    static final class FixtureYouhouEntry {
        public String youhouCode;
        public String youhouName;
        public String timingCode;
        public String routeCode;
        public Integer daysLimit;
        public Integer dosePerDay;
        public String comment;
        public String validFrom;
        public String validTo;
        public Boolean cacheHit;
        public Boolean missingMaster;
        public Boolean fallbackUsed;
    }

    static final class FixtureMaterialEntry {
        public String materialCode;
        public String materialName;
        public String category;
        public String materialCategory;
        public String insuranceType;
        public String unit;
        public Double price;
        public String startDate;
        public String endDate;
        public String validFrom;
        public String validTo;
        public String maker;
        public Boolean cacheHit;
        public Boolean missingMaster;
        public Boolean fallbackUsed;
    }

    static final class FixtureKensaSortEntry {
        public String kensaCode;
        public String kensaName;
        public String sampleType;
        public String classification;
        public String insuranceCategory;
        public String category;
        public String departmentCode;
        public String kensaSort;
        public String validFrom;
        public String validTo;
        public Boolean cacheHit;
        public Boolean missingMaster;
        public Boolean fallbackUsed;
    }


    static final class FixtureEtensuEntry {
        public String etensuCategory;
        public String category;
        public String medicalFeeCode;
        public String tensuCode;
        public String name;
        public String note;
        public Double points;
        public Double tanka;
        public String unit;
        public String noticeDate;
        public String effectiveDate;
        public String startDate;
        public String endDate;
        public String validFrom;
        public String validTo;
        public String tensuVersion;
        public String version;
        public String snapshotVersion;
        public String kubun;
        public Boolean cacheHit;
        public Boolean missingMaster;
        public Boolean fallbackUsed;
    }
}
