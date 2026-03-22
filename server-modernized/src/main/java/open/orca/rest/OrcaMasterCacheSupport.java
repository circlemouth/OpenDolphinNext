package open.orca.rest;

import jakarta.ws.rs.core.MultivaluedMap;
import jakarta.ws.rs.core.Response;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;

class OrcaMasterCacheSupport {
    private final OrcaMasterService masterService;

    OrcaMasterCacheSupport(OrcaMasterService masterService) {
        this.masterService = masterService;
    }

    String buildEtag(String apiRoute, String masterType, OrcaMasterService.LoadedFixture<?> fixture,
            MultivaluedMap<String, String> params) {
        return masterService.buildEtag(apiRoute, masterType, fixture, params);
    }

    String normalizeQuery(MultivaluedMap<String, String> params) {
        return masterService.normalizeQuery(params);
    }

    boolean etagMatches(String ifNoneMatch, String etagValue) {
        return masterService.etagMatches(ifNoneMatch, etagValue);
    }

    Response buildCachedOkResponse(Object entity, String etagValue, long ttlSeconds) {
        return masterService.buildCachedOkResponse(entity, etagValue, ttlSeconds);
    }

    Response buildCachedOkResponse(Object entity, String etagValue, long ttlSeconds, Map<String, String> extraHeaders) {
        return masterService.buildCachedOkResponse(entity, etagValue, ttlSeconds, extraHeaders);
    }

    Response buildNotModifiedResponse(String etagValue, long ttlSeconds) {
        return masterService.buildNotModifiedResponse(etagValue, ttlSeconds);
    }

    Response buildNotModifiedResponse(String etagValue, long ttlSeconds, Map<String, String> extraHeaders) {
        return masterService.buildNotModifiedResponse(etagValue, ttlSeconds, extraHeaders);
    }

    long cacheTtlSeconds(String masterType) {
        return masterService.cacheTtlSeconds(masterType);
    }

    Map<String, String> buildEtensuPerformanceHeaders(EtensuDao.EtensuSearchResult result, boolean cacheHit) {
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
}
