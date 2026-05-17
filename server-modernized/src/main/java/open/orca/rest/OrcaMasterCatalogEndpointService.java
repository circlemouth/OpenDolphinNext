package open.orca.rest;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.core.MultivaluedMap;
import jakarta.ws.rs.core.Response;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import open.dolphin.rest.dto.orca.OrcaAddressEntry;
import open.dolphin.rest.dto.orca.OrcaDrugMasterEntry;
import open.dolphin.rest.dto.orca.OrcaInsurerEntry;
import open.dolphin.rest.dto.orca.OrcaMasterListResponse;
import open.dolphin.rest.dto.orca.OrcaTensuEntry;
import open.dolphin.security.audit.SessionAuditDispatcher;

class OrcaMasterCatalogEndpointService {
    private final OrcaMasterAuditSupport auditSupport;
    private final OrcaMasterFixtureSupport fixtureSupport;
    private final OrcaMasterResponseAssembler responseAssembler;
    private final OrcaMasterResponseMapper responseMapper;
    private final OrcaMasterCacheSupport cacheSupport;

    OrcaMasterCatalogEndpointService(SessionAuditDispatcher sessionAuditDispatcher, OrcaMasterFixtureSupport fixtureSupport,
            OrcaMasterResponseAssembler responseAssembler, OrcaMasterResponseMapper responseMapper,
            OrcaMasterCacheSupport cacheSupport) {
        this.auditSupport = new OrcaMasterAuditSupport(sessionAuditDispatcher);
        this.fixtureSupport = fixtureSupport;
        this.responseAssembler = responseAssembler;
        this.responseMapper = responseMapper;
        this.cacheSupport = cacheSupport;
    }

    Response buildGenericClassResponse(String ifNoneMatch, HttpServletRequest request,
            MultivaluedMap<String, String> params, OrcaMasterDao.GenericClassSearchResult dbResult,
            Map<String, Object> auditDetails) {
        SearchPayload<OrcaMasterDao.GenericClassRecord> payload =
                dbResult == null ? null : new SearchPayload<>(dbResult.getRecords(), dbResult.getTotalCount(),
                        dbResult.getVersion(), dbResult.getCacheState());
        return buildPagedDrugEntryResponse(ifNoneMatch, request, params, "/api/orca/master/generic-class",
                "orca05-generic-class", "MASTER_GENERIC_CLASS_UNAVAILABLE", "薬効分類マスタを取得できませんでした",
                payload, auditDetails, responseMapper::toGenericClassEntry);
    }

    Response buildDrugResponse(String ifNoneMatch, HttpServletRequest request, MultivaluedMap<String, String> params,
            OrcaMasterDao.ListSearchResult<OrcaMasterDao.DrugRecord> dbResult, Map<String, Object> auditDetails) {
        return buildPagedDrugEntryResponse(ifNoneMatch, request, params, "/api/orca/master/drug", "orca08-drug",
                "MASTER_DRUG_UNAVAILABLE", "薬剤マスタを取得できませんでした", fromListResult(dbResult), auditDetails,
                responseMapper::toDrugEntry);
    }

    Response buildGenericPriceResponse(String ifNoneMatch, HttpServletRequest request,
            MultivaluedMap<String, String> params, OrcaMasterDao.LookupResult<OrcaMasterDao.GenericPriceRecord> dbResult,
            Map<String, Object> auditDetails) {
        if (dbResult == null || cacheUnavailable(dbResult.getCacheState())) {
            OrcaMasterFixtureSupport.LoadedFixture<OrcaMasterDao.GenericPriceRecord> unavailableFixture = fixtureSupport.unavailableFixture();
            Response failure = auditSupport.serviceUnavailable(request, "MASTER_GENERIC_PRICE_UNAVAILABLE",
                    "最低薬価マスタを取得できませんでした");
            auditSupport.recordMasterAudit(request, "/api/orca/master/generic-price", "orca05-generic-price",
                    503, fixtureSupport.toServiceFixture(unavailableFixture), false, true, 0,
                    withCacheState(auditDetails, dbResult != null ? dbResult.getCacheState() : null));
            return failure;
        }
        OrcaMasterFixtureSupport.LoadedFixture<OrcaMasterDao.GenericPriceRecord> fixture =
                fixtureSupport.buildLocalCacheFixture(dbResult.isFound() && dbResult.getRecord() != null
                        ? List.of(dbResult.getRecord()) : List.of(), dbResult.getVersion(), false, dbResult.getCacheState());
        if (!dbResult.isFound() || dbResult.getRecord() == null) {
            auditSupport.recordMasterAudit(request, "/api/orca/master/generic-price", "orca05-generic-price",
                    404, fixtureSupport.toServiceFixture(fixture), false, true, 0, auditDetails);
            return auditSupport.notFound("MASTER_GENERIC_PRICE_NOT_FOUND", "最低薬価マスタが見つかりませんでした", request);
        }
        String etagValue = cacheSupport.buildEtag("/api/orca/master/generic-price", "orca05-generic-price",
                fixtureSupport.toServiceFixture(fixture), params);
        long ttlSeconds = cacheSupport.cacheTtlSeconds("orca05-generic-price");
        if (cacheSupport.etagMatches(ifNoneMatch, etagValue)) {
            auditSupport.recordMasterAudit(request, "/api/orca/master/generic-price", "orca05-generic-price",
                    304, fixtureSupport.toServiceFixture(fixture), true, false, 1, auditDetails);
            return cacheSupport.buildNotModifiedResponse(etagValue, ttlSeconds, null);
        }
        OrcaDrugMasterEntry response = responseMapper.toGenericPriceEntry(
                dbResult.getRecord(), fixtureSupport.toServiceFixture(fixture));
        auditSupport.recordMasterAudit(request, "/api/orca/master/generic-price", "orca05-generic-price",
                200, fixtureSupport.toServiceFixture(fixture), false, false, 1, auditDetails);
        return cacheSupport.buildCachedOkResponse(response, etagValue, ttlSeconds, null);
    }

    Response buildHokenjaResponse(String ifNoneMatch, HttpServletRequest request,
            MultivaluedMap<String, String> params, OrcaMasterDao.ListSearchResult<OrcaMasterDao.HokenjaRecord> dbResult,
            Map<String, Object> auditDetails) {
        if (dbResult == null || cacheUnavailable(dbResult.getCacheState())) {
            OrcaMasterFixtureSupport.LoadedFixture<OrcaMasterDao.HokenjaRecord> unavailableFixture = fixtureSupport.unavailableFixture();
            Response failure = auditSupport.serviceUnavailable(request, "MASTER_HOKENJA_UNAVAILABLE",
                    "保険者マスタを取得できませんでした");
            auditSupport.recordMasterAudit(request, "/api/orca/master/hokenja", "orca06-hokenja",
                    503, fixtureSupport.toServiceFixture(unavailableFixture), false, true, 0,
                    withCacheState(auditDetails, dbResult != null ? dbResult.getCacheState() : null));
            return failure;
        }
        OrcaMasterFixtureSupport.LoadedFixture<OrcaMasterDao.HokenjaRecord> fixture =
                fixtureSupport.buildLocalCacheFixture(dbResult.getRecords(), dbResult.getVersion(), false,
                        dbResult.getCacheState());
        String etagValue = cacheSupport.buildEtag("/api/orca/master/hokenja", "orca06-hokenja",
                fixtureSupport.toServiceFixture(fixture), params);
        long ttlSeconds = cacheSupport.cacheTtlSeconds("orca06-hokenja");
        if (cacheSupport.etagMatches(ifNoneMatch, etagValue)) {
            auditSupport.recordMasterAudit(request, "/api/orca/master/hokenja", "orca06-hokenja",
                    304, fixtureSupport.toServiceFixture(fixture), true, dbResult.getRecords().isEmpty(),
                    dbResult.getTotalCount(), auditDetails);
            return cacheSupport.buildNotModifiedResponse(etagValue, ttlSeconds, null);
        }
        List<OrcaInsurerEntry> items = new ArrayList<>(dbResult.getRecords().size());
        for (OrcaMasterDao.HokenjaRecord entry : dbResult.getRecords()) {
            items.add(responseMapper.toInsurerEntry(entry, fixtureSupport.toServiceFixture(fixture)));
        }
        OrcaMasterListResponse<OrcaInsurerEntry> response =
                responseAssembler.toListResponse(items, dbResult.getTotalCount(), fixture.cacheState.toMeta());
        auditSupport.recordMasterAudit(request, "/api/orca/master/hokenja", "orca06-hokenja",
                200, fixtureSupport.toServiceFixture(fixture), false, items.isEmpty(), dbResult.getTotalCount(), auditDetails);
        return cacheSupport.buildCachedOkResponse(response, etagValue, ttlSeconds, null);
    }

    Response buildAddressResponse(String ifNoneMatch, HttpServletRequest request,
            MultivaluedMap<String, String> params, OrcaMasterDao.LookupResult<OrcaMasterDao.AddressRecord> dbResult,
            Map<String, Object> auditDetails) {
        if (dbResult == null || cacheUnavailable(dbResult.getCacheState())) {
            OrcaMasterFixtureSupport.LoadedFixture<OrcaMasterDao.AddressRecord> unavailableFixture = fixtureSupport.unavailableFixture();
            Response failure = auditSupport.serviceUnavailable(request, "MASTER_ADDRESS_UNAVAILABLE",
                    "住所マスタを取得できませんでした");
            auditSupport.recordMasterAudit(request, "/api/orca/master/address", "orca06-address",
                    503, fixtureSupport.toServiceFixture(unavailableFixture), false, true, 0,
                    withCacheState(auditDetails, dbResult != null ? dbResult.getCacheState() : null));
            return failure;
        }
        OrcaMasterFixtureSupport.LoadedFixture<OrcaMasterDao.AddressRecord> fixture =
                fixtureSupport.buildLocalCacheFixture(dbResult.isFound() && dbResult.getRecord() != null
                        ? List.of(dbResult.getRecord()) : List.of(), dbResult.getVersion(), false, dbResult.getCacheState());
        if (!dbResult.isFound() || dbResult.getRecord() == null) {
            auditSupport.recordMasterAudit(request, "/api/orca/master/address", "orca06-address",
                    404, fixtureSupport.toServiceFixture(fixture), false, true, 0, auditDetails);
            return auditSupport.notFound("MASTER_ADDRESS_NOT_FOUND", "住所マスタが見つかりませんでした", request);
        }
        String etagValue = cacheSupport.buildEtag("/api/orca/master/address", "orca06-address",
                fixtureSupport.toServiceFixture(fixture), params);
        long ttlSeconds = cacheSupport.cacheTtlSeconds("orca06-address");
        if (cacheSupport.etagMatches(ifNoneMatch, etagValue)) {
            auditSupport.recordMasterAudit(request, "/api/orca/master/address", "orca06-address",
                    304, fixtureSupport.toServiceFixture(fixture), true, false, 1, auditDetails);
            return cacheSupport.buildNotModifiedResponse(etagValue, ttlSeconds, null);
        }
        OrcaAddressEntry response = responseMapper.toAddressEntry(
                dbResult.getRecord(), fixtureSupport.toServiceFixture(fixture));
        auditSupport.recordMasterAudit(request, "/api/orca/master/address", "orca06-address",
                200, fixtureSupport.toServiceFixture(fixture), false, false, 1, auditDetails);
        return cacheSupport.buildCachedOkResponse(response, etagValue, ttlSeconds, null);
    }

    Response buildCommentResponse(String ifNoneMatch, HttpServletRequest request, MultivaluedMap<String, String> params,
            OrcaMasterDao.ListSearchResult<OrcaMasterDao.CommentRecord> dbResult, Map<String, Object> auditDetails) {
        return buildPagedTensuEntryResponse(ifNoneMatch, request, params, "/api/orca/master/comment", "orca08-comment",
                "MASTER_COMMENT_UNAVAILABLE", "コメントマスタを取得できませんでした", fromListResult(dbResult), auditDetails,
                responseMapper::toCommentEntry);
    }

    Response buildBodypartResponse(String ifNoneMatch, HttpServletRequest request, MultivaluedMap<String, String> params,
            OrcaMasterDao.ListSearchResult<OrcaMasterDao.CommentRecord> dbResult, Map<String, Object> auditDetails) {
        return buildPagedTensuEntryResponse(ifNoneMatch, request, params, "/api/orca/master/bodypart", "orca08-bodypart",
                "MASTER_BODYPART_UNAVAILABLE", "部位マスタを取得できませんでした", fromListResult(dbResult), auditDetails,
                responseMapper::toCommentEntry);
    }

    Response buildYouhouResponse(String ifNoneMatch, HttpServletRequest request, MultivaluedMap<String, String> params,
            OrcaMasterDao.ListSearchResult<OrcaMasterDao.YouhouRecord> dbResult, Map<String, Object> auditDetails) {
        return buildArrayDrugEntryResponse(ifNoneMatch, request, params, "/api/orca/master/youhou", "orca05-youhou",
                "MASTER_YOUHOU_UNAVAILABLE", "用法マスタを取得できませんでした", fromListResult(dbResult),
                auditDetails, responseMapper::toYouhouEntry);
    }

    Response buildMaterialResponse(String ifNoneMatch, HttpServletRequest request, MultivaluedMap<String, String> params,
            OrcaMasterDao.ListSearchResult<OrcaMasterDao.MaterialRecord> dbResult, Map<String, Object> auditDetails) {
        return buildArrayDrugEntryResponse(ifNoneMatch, request, params, "/api/orca/master/material",
                "orca05-material", "MASTER_MATERIAL_UNAVAILABLE", "特定器材マスタを取得できませんでした",
                fromListResult(dbResult), auditDetails, responseMapper::toMaterialEntry);
    }

    Response buildKensaSortResponse(String ifNoneMatch, HttpServletRequest request, MultivaluedMap<String, String> params,
            OrcaMasterDao.ListSearchResult<OrcaMasterDao.KensaSortRecord> dbResult, Map<String, Object> auditDetails) {
        return buildArrayDrugEntryResponse(ifNoneMatch, request, params, "/api/orca/master/kensa-sort",
                "orca05-kensa-sort", "MASTER_KENSA_SORT_UNAVAILABLE", "検査区分マスタを取得できませんでした",
                fromListResult(dbResult), auditDetails, responseMapper::toKensaSortEntry);
    }

    private <T extends OrcaMasterDao.VersionedRecord> Response buildPagedDrugEntryResponse(String ifNoneMatch,
            HttpServletRequest request, MultivaluedMap<String, String> params, String apiRoute, String masterType,
            String unavailableCode, String unavailableMessage, SearchPayload<T> payload, Map<String, Object> auditDetails,
            DrugEntryMapper<T> mapper) {
        if (payload == null || cacheUnavailable(payload.cacheState)) {
            OrcaMasterFixtureSupport.LoadedFixture<T> unavailableFixture = fixtureSupport.unavailableFixture();
            Response failure = auditSupport.serviceUnavailable(request, unavailableCode, unavailableMessage);
            auditSupport.recordMasterAudit(request, apiRoute, masterType, 503, fixtureSupport.toServiceFixture(unavailableFixture),
                    false, true, 0, withCacheState(auditDetails, payload != null ? payload.cacheState : null));
            return failure;
        }
        OrcaMasterFixtureSupport.LoadedFixture<T> fixture =
                fixtureSupport.buildLocalCacheFixture(payload.records, payload.version, false, payload.cacheState);
        String etagValue = cacheSupport.buildEtag(apiRoute, masterType, fixtureSupport.toServiceFixture(fixture), params);
        long ttlSeconds = cacheSupport.cacheTtlSeconds(masterType);
        if (cacheSupport.etagMatches(ifNoneMatch, etagValue)) {
            auditSupport.recordMasterAudit(request, apiRoute, masterType, 304, fixtureSupport.toServiceFixture(fixture),
                    true, null, null, auditDetails);
            return cacheSupport.buildNotModifiedResponse(etagValue, ttlSeconds, null);
        }
        OrcaMasterService.LoadedFixture<T> serviceFixture = fixtureSupport.toServiceFixture(fixture);
        List<OrcaDrugMasterEntry> items = new ArrayList<>(fixture.entries.size());
        for (T entry : fixture.entries) {
            items.add(mapper.map(entry, serviceFixture));
        }
        OrcaMasterListResponse<OrcaDrugMasterEntry> response =
                responseAssembler.toListResponse(items, payload.totalCount, fixture.cacheState.toMeta());
        auditSupport.recordMasterAudit(request, apiRoute, masterType, 200, serviceFixture, false, items.isEmpty(),
                payload.totalCount, auditDetails);
        return cacheSupport.buildCachedOkResponse(response, etagValue, ttlSeconds, null);
    }

    private <T extends OrcaMasterDao.VersionedRecord> Response buildArrayDrugEntryResponse(String ifNoneMatch,
            HttpServletRequest request, MultivaluedMap<String, String> params, String apiRoute, String masterType,
            String unavailableCode, String unavailableMessage, SearchPayload<T> payload, Map<String, Object> auditDetails,
            DrugEntryMapper<T> mapper) {
        if (payload == null || cacheUnavailable(payload.cacheState)) {
            OrcaMasterFixtureSupport.LoadedFixture<T> unavailableFixture = fixtureSupport.unavailableFixture();
            Response failure = auditSupport.serviceUnavailable(request, unavailableCode, unavailableMessage);
            auditSupport.recordMasterAudit(request, apiRoute, masterType, 503, fixtureSupport.toServiceFixture(unavailableFixture),
                    false, true, 0, withCacheState(auditDetails, payload != null ? payload.cacheState : null));
            return failure;
        }
        OrcaMasterFixtureSupport.LoadedFixture<T> fixture =
                fixtureSupport.buildLocalCacheFixture(payload.records, payload.version, false, payload.cacheState);
        String etagValue = cacheSupport.buildEtag(apiRoute, masterType, fixtureSupport.toServiceFixture(fixture), params);
        long ttlSeconds = cacheSupport.cacheTtlSeconds(masterType);
        if (cacheSupport.etagMatches(ifNoneMatch, etagValue)) {
            auditSupport.recordMasterAudit(request, apiRoute, masterType, 304, fixtureSupport.toServiceFixture(fixture),
                    true, null, null, auditDetails);
            return cacheSupport.buildNotModifiedResponse(etagValue, ttlSeconds, null);
        }
        OrcaMasterService.LoadedFixture<T> serviceFixture = fixtureSupport.toServiceFixture(fixture);
        List<OrcaDrugMasterEntry> response = new ArrayList<>(fixture.entries.size());
        for (T entry : fixture.entries) {
            response.add(mapper.map(entry, serviceFixture));
        }
        auditSupport.recordMasterAudit(request, apiRoute, masterType, 200, serviceFixture, false, response.isEmpty(),
                response.size(), auditDetails);
        return cacheSupport.buildCachedOkResponse(response, etagValue, ttlSeconds, null);
    }

    private <T extends OrcaMasterDao.VersionedRecord> Response buildPagedTensuEntryResponse(String ifNoneMatch,
            HttpServletRequest request, MultivaluedMap<String, String> params, String apiRoute, String masterType,
            String unavailableCode, String unavailableMessage, SearchPayload<T> payload, Map<String, Object> auditDetails,
            TensuEntryMapper<T> mapper) {
        if (payload == null || cacheUnavailable(payload.cacheState)) {
            OrcaMasterFixtureSupport.LoadedFixture<T> unavailableFixture = fixtureSupport.unavailableFixture();
            Response failure = auditSupport.serviceUnavailable(request, unavailableCode, unavailableMessage);
            auditSupport.recordMasterAudit(request, apiRoute, masterType, 503, fixtureSupport.toServiceFixture(unavailableFixture),
                    false, true, 0, withCacheState(auditDetails, payload != null ? payload.cacheState : null));
            return failure;
        }
        OrcaMasterFixtureSupport.LoadedFixture<T> fixture =
                fixtureSupport.buildLocalCacheFixture(payload.records, payload.version, false, payload.cacheState);
        String etagValue = cacheSupport.buildEtag(apiRoute, masterType, fixtureSupport.toServiceFixture(fixture), params);
        long ttlSeconds = cacheSupport.cacheTtlSeconds(masterType);
        if (cacheSupport.etagMatches(ifNoneMatch, etagValue)) {
            auditSupport.recordMasterAudit(request, apiRoute, masterType, 304, fixtureSupport.toServiceFixture(fixture),
                    true, null, null, auditDetails);
            return cacheSupport.buildNotModifiedResponse(etagValue, ttlSeconds, null);
        }
        OrcaMasterService.LoadedFixture<T> serviceFixture = fixtureSupport.toServiceFixture(fixture);
        List<OrcaTensuEntry> items = new ArrayList<>(fixture.entries.size());
        for (T entry : fixture.entries) {
            items.add(mapper.map(entry, serviceFixture));
        }
        OrcaMasterListResponse<OrcaTensuEntry> response =
                responseAssembler.toListResponse(items, payload.totalCount, fixture.cacheState.toMeta());
        auditSupport.recordMasterAudit(request, apiRoute, masterType, 200, serviceFixture, false, items.isEmpty(),
                payload.totalCount, auditDetails);
        return cacheSupport.buildCachedOkResponse(response, etagValue, ttlSeconds, null);
    }

    private static <T extends OrcaMasterDao.VersionedRecord> SearchPayload<T> fromListResult(
            OrcaMasterDao.ListSearchResult<T> result) {
        if (result == null) {
            return null;
        }
        return new SearchPayload<>(result.getRecords(), result.getTotalCount(), result.getVersion(), result.getCacheState());
    }

    private static boolean cacheUnavailable(OrcaMasterCacheState cacheState) {
        return cacheState != null && cacheState.isUnavailable();
    }

    private static Map<String, Object> withCacheState(Map<String, Object> auditDetails, OrcaMasterCacheState cacheState) {
        if (cacheState == null) {
            return auditDetails;
        }
        Map<String, Object> details = new java.util.LinkedHashMap<>();
        if (auditDetails != null) {
            details.putAll(auditDetails);
        }
        details.putAll(cacheState.toAuditDetails());
        return details;
    }

    @FunctionalInterface
    private interface DrugEntryMapper<T extends OrcaMasterDao.VersionedRecord> {
        OrcaDrugMasterEntry map(T entry, OrcaMasterService.LoadedFixture<?> fixture);
    }

    @FunctionalInterface
    private interface TensuEntryMapper<T extends OrcaMasterDao.VersionedRecord> {
        OrcaTensuEntry map(T entry, OrcaMasterService.LoadedFixture<?> fixture);
    }

    private static final class SearchPayload<T extends OrcaMasterDao.VersionedRecord> {
        private final List<T> records;
        private final Integer totalCount;
        private final String version;
        private final OrcaMasterCacheState cacheState;

        private SearchPayload(List<T> records, Integer totalCount, String version, OrcaMasterCacheState cacheState) {
            this.records = records != null ? records : Collections.emptyList();
            this.totalCount = totalCount;
            this.version = version;
            this.cacheState = cacheState;
        }
    }
}
