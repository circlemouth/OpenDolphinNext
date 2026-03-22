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

class OrcaMasterTensuEndpointService {
    private final OrcaMasterAuditSupport auditSupport;
    private final OrcaMasterFixtureSupport fixtureSupport;
    private final OrcaMasterResponseAssembler responseAssembler;
    private final OrcaMasterResponseMapper responseMapper;
    private final OrcaMasterCacheSupport cacheSupport;

    OrcaMasterTensuEndpointService(SessionAuditDispatcher sessionAuditDispatcher, OrcaMasterFixtureSupport fixtureSupport,
            OrcaMasterResponseAssembler responseAssembler, OrcaMasterResponseMapper responseMapper,
            OrcaMasterCacheSupport cacheSupport) {
        this.auditSupport = new OrcaMasterAuditSupport(sessionAuditDispatcher);
        this.fixtureSupport = fixtureSupport;
        this.responseAssembler = responseAssembler;
        this.responseMapper = responseMapper;
        this.cacheSupport = cacheSupport;
    }

    Response buildDrugResponse(String ifNoneMatch, HttpServletRequest request, MultivaluedMap<String, String> params,
            OrcaMasterDao.ListSearchResult<OrcaMasterDao.DrugRecord> dbResult, Map<String, Object> auditDetails) {
        return buildDrugEntryListResponse(ifNoneMatch, request, params, "/api/orca/master/drug", "orca08-drug",
                "MASTER_DRUG_UNAVAILABLE", "薬剤マスタを取得できませんでした", fromListResult(dbResult), auditDetails,
                responseMapper::toDrugEntry);
    }

    Response buildCommentResponse(String ifNoneMatch, HttpServletRequest request, MultivaluedMap<String, String> params,
            OrcaMasterDao.ListSearchResult<OrcaMasterDao.CommentRecord> dbResult, Map<String, Object> auditDetails) {
        return buildTensuEntryListResponse(ifNoneMatch, request, params, "/api/orca/master/comment", "orca08-comment",
                "MASTER_COMMENT_UNAVAILABLE", "コメントマスタを取得できませんでした", fromListResult(dbResult), auditDetails);
    }

    Response buildBodypartResponse(String ifNoneMatch, HttpServletRequest request, MultivaluedMap<String, String> params,
            OrcaMasterDao.ListSearchResult<OrcaMasterDao.CommentRecord> dbResult, Map<String, Object> auditDetails) {
        return buildTensuEntryListResponse(ifNoneMatch, request, params, "/api/orca/master/bodypart", "orca08-bodypart",
                "MASTER_BODYPART_UNAVAILABLE", "部位マスタを取得できませんでした", fromListResult(dbResult), auditDetails);
    }

    private Response buildTensuEntryListResponse(String ifNoneMatch, HttpServletRequest request,
            MultivaluedMap<String, String> params, String apiRoute, String masterType, String unavailableCode,
            String unavailableMessage, SearchPayload<OrcaMasterDao.CommentRecord> payload,
            Map<String, Object> auditDetails) {
        if (payload == null) {
            OrcaMasterFixtureSupport.LoadedFixture<OrcaMasterDao.CommentRecord> unavailableFixture =
                    fixtureSupport.unavailableFixture();
            Response failure = auditSupport.serviceUnavailable(request, unavailableCode, unavailableMessage);
            auditSupport.recordMasterAudit(request, apiRoute, masterType, 503,
                    fixtureSupport.toServiceFixture(unavailableFixture), false, true, 0, auditDetails);
            return failure;
        }
        OrcaMasterFixtureSupport.LoadedFixture<OrcaMasterDao.CommentRecord> fixture =
                fixtureSupport.buildDbFixture(payload.records, payload.version, false);
        String etagValue = cacheSupport.buildEtag(apiRoute, masterType, fixtureSupport.toServiceFixture(fixture), params);
        long ttlSeconds = cacheSupport.cacheTtlSeconds(masterType);
        if (cacheSupport.etagMatches(ifNoneMatch, etagValue)) {
            auditSupport.recordMasterAudit(request, apiRoute, masterType, 304, fixtureSupport.toServiceFixture(fixture),
                    true, null, null, auditDetails);
            return cacheSupport.buildNotModifiedResponse(etagValue, ttlSeconds, null);
        }
        List<OrcaTensuEntry> items = new ArrayList<>(fixture.entries.size());
        OrcaMasterService.LoadedFixture<OrcaMasterDao.CommentRecord> serviceFixture = fixtureSupport.toServiceFixture(fixture);
        for (OrcaMasterDao.CommentRecord entry : fixture.entries) {
            items.add(responseMapper.toCommentEntry(entry, serviceFixture));
        }
        OrcaMasterListResponse<OrcaTensuEntry> response = responseAssembler.toListResponse(items, payload.totalCount);
        auditSupport.recordMasterAudit(request, apiRoute, masterType, 200, serviceFixture, false, items.isEmpty(),
                payload.totalCount, auditDetails);
        return cacheSupport.buildCachedOkResponse(response, etagValue, ttlSeconds, null);
    }

    private <T extends OrcaMasterDao.VersionedRecord> Response buildDrugEntryListResponse(String ifNoneMatch,
            HttpServletRequest request, MultivaluedMap<String, String> params, String apiRoute, String masterType,
            String unavailableCode, String unavailableMessage, SearchPayload<T> payload, Map<String, Object> auditDetails,
            DrugEntryMapper<T> mapper) {
        if (payload == null) {
            OrcaMasterFixtureSupport.LoadedFixture<T> unavailableFixture = fixtureSupport.unavailableFixture();
            Response failure = auditSupport.serviceUnavailable(request, unavailableCode, unavailableMessage);
            auditSupport.recordMasterAudit(request, apiRoute, masterType, 503,
                    fixtureSupport.toServiceFixture(unavailableFixture), false, true, 0, auditDetails);
            return failure;
        }
        OrcaMasterFixtureSupport.LoadedFixture<T> fixture = fixtureSupport.buildDbFixture(payload.records, payload.version, false);
        String etagValue = cacheSupport.buildEtag(apiRoute, masterType, fixtureSupport.toServiceFixture(fixture), params);
        long ttlSeconds = cacheSupport.cacheTtlSeconds(masterType);
        if (cacheSupport.etagMatches(ifNoneMatch, etagValue)) {
            auditSupport.recordMasterAudit(request, apiRoute, masterType, 304, fixtureSupport.toServiceFixture(fixture),
                    true, null, null, auditDetails);
            return cacheSupport.buildNotModifiedResponse(etagValue, ttlSeconds, null);
        }
        List<OrcaDrugMasterEntry> items = new ArrayList<>(fixture.entries.size());
        OrcaMasterService.LoadedFixture<T> serviceFixture = fixtureSupport.toServiceFixture(fixture);
        for (T entry : fixture.entries) {
            items.add(mapper.map(entry, serviceFixture));
        }
        OrcaMasterListResponse<OrcaDrugMasterEntry> response = responseAssembler.toListResponse(items, payload.totalCount);
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
