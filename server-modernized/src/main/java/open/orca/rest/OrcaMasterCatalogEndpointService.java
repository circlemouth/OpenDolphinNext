package open.orca.rest;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.core.MultivaluedMap;
import jakarta.ws.rs.core.Response;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import open.dolphin.rest.dto.orca.OrcaDrugMasterEntry;
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
                dbResult == null ? null : new SearchPayload<>(dbResult.getRecords(), dbResult.getTotalCount(), dbResult.getVersion());
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
        if (payload == null) {
            OrcaMasterFixtureSupport.LoadedFixture<T> unavailableFixture = fixtureSupport.unavailableFixture();
            Response failure = auditSupport.serviceUnavailable(request, unavailableCode, unavailableMessage);
            auditSupport.recordMasterAudit(request, apiRoute, masterType, 503, fixtureSupport.toServiceFixture(unavailableFixture),
                    false, true, 0, auditDetails);
            return failure;
        }
        OrcaMasterFixtureSupport.LoadedFixture<T> fixture =
                fixtureSupport.buildDbFixture(payload.records, payload.version, false);
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
        OrcaMasterListResponse<OrcaDrugMasterEntry> response = responseAssembler.toListResponse(items, payload.totalCount);
        auditSupport.recordMasterAudit(request, apiRoute, masterType, 200, serviceFixture, false, items.isEmpty(),
                payload.totalCount, auditDetails);
        return cacheSupport.buildCachedOkResponse(response, etagValue, ttlSeconds, null);
    }

    private <T extends OrcaMasterDao.VersionedRecord> Response buildArrayDrugEntryResponse(String ifNoneMatch,
            HttpServletRequest request, MultivaluedMap<String, String> params, String apiRoute, String masterType,
            String unavailableCode, String unavailableMessage, SearchPayload<T> payload, Map<String, Object> auditDetails,
            DrugEntryMapper<T> mapper) {
        if (payload == null) {
            OrcaMasterFixtureSupport.LoadedFixture<T> unavailableFixture = fixtureSupport.unavailableFixture();
            Response failure = auditSupport.serviceUnavailable(request, unavailableCode, unavailableMessage);
            auditSupport.recordMasterAudit(request, apiRoute, masterType, 503, fixtureSupport.toServiceFixture(unavailableFixture),
                    false, true, 0, auditDetails);
            return failure;
        }
        OrcaMasterFixtureSupport.LoadedFixture<T> fixture =
                fixtureSupport.buildDbFixture(payload.records, payload.version, false);
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
        if (payload == null) {
            OrcaMasterFixtureSupport.LoadedFixture<T> unavailableFixture = fixtureSupport.unavailableFixture();
            Response failure = auditSupport.serviceUnavailable(request, unavailableCode, unavailableMessage);
            auditSupport.recordMasterAudit(request, apiRoute, masterType, 503, fixtureSupport.toServiceFixture(unavailableFixture),
                    false, true, 0, auditDetails);
            return failure;
        }
        OrcaMasterFixtureSupport.LoadedFixture<T> fixture =
                fixtureSupport.buildDbFixture(payload.records, payload.version, false);
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
        OrcaMasterListResponse<OrcaTensuEntry> response = responseAssembler.toListResponse(items, payload.totalCount);
        auditSupport.recordMasterAudit(request, apiRoute, masterType, 200, serviceFixture, false, items.isEmpty(),
                payload.totalCount, auditDetails);
        return cacheSupport.buildCachedOkResponse(response, etagValue, ttlSeconds, null);
    }

    private static <T extends OrcaMasterDao.VersionedRecord> SearchPayload<T> fromListResult(
            OrcaMasterDao.ListSearchResult<T> result) {
        if (result == null) {
            return null;
        }
        return new SearchPayload<>(result.getRecords(), result.getTotalCount(), result.getVersion());
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

        private SearchPayload(List<T> records, Integer totalCount, String version) {
            this.records = records != null ? records : Collections.emptyList();
            this.totalCount = totalCount;
            this.version = version;
        }
    }
}
