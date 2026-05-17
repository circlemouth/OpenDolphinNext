package open.orca.rest;

import jakarta.enterprise.context.Dependent;
import jakarta.inject.Inject;
import jakarta.ws.rs.core.EntityTag;
import jakarta.ws.rs.core.MultivaluedMap;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.Response.Status;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.TreeMap;
import java.util.stream.Collectors;

@Dependent
class OrcaMasterService {

    static final String DEFAULT_VERSION = "20240426";
    static final String DEFAULT_VALID_FROM = "20240401";
    static final String DEFAULT_VALID_TO = "99991231";

    private static final long CACHE_TTL_SHORT_SECONDS = 300;
    private static final long CACHE_STALE_REVALIDATE_SECONDS = 86400;
    private static final int MAX_PAGE_SIZE = 2000;

    enum DataOrigin {
        ORCA_DB,
        LOCAL_CACHE,
        FALLBACK
    }

    static final class LoadedFixture<T> {
        final List<T> entries;
        final String snapshotVersion;
        final String version;
        final DataOrigin origin;
        final boolean loadFailed;
        final OrcaMasterCacheState cacheState;

        LoadedFixture(List<T> entries, String snapshotVersion, String version, DataOrigin origin, boolean loadFailed) {
            this(entries, snapshotVersion, version, origin, loadFailed,
                    OrcaMasterCacheState.current("master", version));
        }

        LoadedFixture(List<T> entries, String snapshotVersion, String version, DataOrigin origin, boolean loadFailed,
                OrcaMasterCacheState cacheState) {
            this.entries = entries;
            this.snapshotVersion = snapshotVersion;
            this.version = version;
            this.origin = origin;
            this.loadFailed = loadFailed;
            this.cacheState = cacheState;
        }
    }

    private final OrcaMasterGateway masterGateway;

    @Inject
    OrcaMasterService(OrcaMasterGateway masterGateway) {
        this.masterGateway = masterGateway;
    }

    OrcaMasterDao.GenericClassSearchResult searchGenericClass(OrcaMasterDao.GenericClassCriteria criteria) {
        return masterGateway.searchGenericClass(criteria);
    }

    OrcaMasterDao.LookupResult<OrcaMasterDao.GenericPriceRecord> findGenericPrice(OrcaMasterDao.GenericPriceCriteria criteria) {
        return masterGateway.findGenericPrice(criteria);
    }

    OrcaMasterDao.ListSearchResult<OrcaMasterDao.DrugRecord> searchDrug(OrcaMasterDao.DrugCriteria criteria) {
        return masterGateway.searchDrug(criteria);
    }

    OrcaMasterDao.ListSearchResult<OrcaMasterDao.HokenjaRecord> searchHokenja(OrcaMasterDao.HokenjaCriteria criteria) {
        return masterGateway.searchHokenja(criteria);
    }

    OrcaMasterDao.LookupResult<OrcaMasterDao.AddressRecord> findAddress(OrcaMasterDao.AddressCriteria criteria) {
        return masterGateway.findAddress(criteria);
    }

    OrcaMasterDao.ListSearchResult<OrcaMasterDao.CommentRecord> searchComment(OrcaMasterDao.CommentCriteria criteria) {
        return masterGateway.searchComment(criteria);
    }

    OrcaMasterDao.ListSearchResult<OrcaMasterDao.CommentRecord> searchBodypart(OrcaMasterDao.CommentCriteria criteria) {
        return masterGateway.searchBodypart(criteria);
    }

    OrcaMasterDao.ListSearchResult<OrcaMasterDao.YouhouRecord> searchYouhou(OrcaMasterDao.YouhouCriteria criteria) {
        return masterGateway.searchYouhou(criteria);
    }

    OrcaMasterDao.ListSearchResult<OrcaMasterDao.MaterialRecord> searchMaterial(OrcaMasterDao.MaterialCriteria criteria) {
        return masterGateway.searchMaterial(criteria);
    }

    OrcaMasterDao.ListSearchResult<OrcaMasterDao.KensaSortRecord> searchKensaSort(OrcaMasterDao.KensaSortCriteria criteria) {
        return masterGateway.searchKensaSort(criteria);
    }

    EtensuDao.EtensuSearchResult searchEtensu(EtensuDao.EtensuSearchCriteria criteria) {
        return masterGateway.searchEtensu(criteria);
    }

    <T> List<T> safeList(List<T> source) {
        return source == null ? Collections.emptyList() : source;
    }

    <T> LoadedFixture<T> buildDbFixture(List<T> entries, String version, boolean loadFailed) {
        return new LoadedFixture<>(safeList(entries), null, version, DataOrigin.LOCAL_CACHE, loadFailed,
                OrcaMasterCacheState.current("master", version));
    }

    <T> LoadedFixture<T> buildLocalCacheFixture(List<T> entries, String version, boolean loadFailed,
            OrcaMasterCacheState cacheState) {
        return new LoadedFixture<>(safeList(entries), null, version, DataOrigin.LOCAL_CACHE, loadFailed, cacheState);
    }

    boolean isUnavailableFallback(LoadedFixture<?> fixture) {
        return fixture != null && fixture.origin == DataOrigin.FALLBACK && fixture.loadFailed && fixture.entries.isEmpty();
    }

    <T> List<T> paginateList(List<T> source, MultivaluedMap<String, String> params) {
        List<T> safeSource = safeList(source);
        int page = parsePositiveInt(params, "page", 1);
        int size = parsePageSize(params, "size", 100);
        int fromIndex = Math.max(0, (page - 1) * size);
        if (fromIndex >= safeSource.size()) {
            return Collections.emptyList();
        }
        int toIndex = Math.min(safeSource.size(), fromIndex + size);
        return safeSource.subList(fromIndex, toIndex);
    }

    int parsePositiveInt(MultivaluedMap<String, String> params, String key, int fallback) {
        if (params == null || key == null) {
            return fallback;
        }
        String value = firstValue(params, key);
        if (value == null || value.isBlank()) {
            return fallback;
        }
        try {
            int parsed = Integer.parseInt(value);
            return parsed > 0 ? parsed : fallback;
        } catch (NumberFormatException e) {
            return fallback;
        }
    }

    int parsePageSize(MultivaluedMap<String, String> params, String key, int fallback) {
        return Math.min(parsePositiveInt(params, key, fallback), MAX_PAGE_SIZE);
    }

    String buildEtag(String apiRoute, String masterType, LoadedFixture<?> fixture, MultivaluedMap<String, String> params) {
        StringBuilder seed = new StringBuilder();
        seed.append(apiRoute).append('|');
        seed.append(masterType).append('|');
        seed.append(dataSourceForOrigin(fixture.origin)).append('|');
        seed.append(firstNonBlank(fixture.snapshotVersion, "none")).append('|');
        seed.append(firstNonBlank(fixture.version, DEFAULT_VERSION)).append('|');
        seed.append(normalizeQuery(params));
        return sha256Hex(seed.toString());
    }

    String normalizeQuery(MultivaluedMap<String, String> params) {
        if (params == null || params.isEmpty()) {
            return "";
        }
        Map<String, List<String>> sorted = new TreeMap<>();
        for (Map.Entry<String, List<String>> entry : params.entrySet()) {
            if (entry.getKey() == null) {
                continue;
            }
            List<String> values = entry.getValue() != null ? entry.getValue() : Collections.emptyList();
            List<String> normalized = values.stream()
                    .filter(Objects::nonNull)
                    .sorted()
                    .collect(Collectors.toList());
            sorted.put(entry.getKey(), normalized);
        }
        StringBuilder query = new StringBuilder();
        for (Map.Entry<String, List<String>> entry : sorted.entrySet()) {
            if (query.length() > 0) {
                query.append('&');
            }
            query.append(entry.getKey()).append('=');
            query.append(String.join(",", entry.getValue()));
        }
        return query.toString();
    }

    boolean etagMatches(String ifNoneMatch, String etagValue) {
        if (ifNoneMatch == null || ifNoneMatch.isBlank()) {
            return false;
        }
        String[] tokens = ifNoneMatch.split(",");
        for (String token : tokens) {
            String candidate = token.trim();
            if (candidate.isEmpty()) {
                continue;
            }
            if ("*".equals(candidate)) {
                return true;
            }
            if (candidate.startsWith("W/")) {
                candidate = candidate.substring(2).trim();
            }
            if (candidate.startsWith("\"") && candidate.endsWith("\"") && candidate.length() >= 2) {
                candidate = candidate.substring(1, candidate.length() - 1);
            }
            if (etagValue.equals(candidate)) {
                return true;
            }
        }
        return false;
    }

    Response buildCachedOkResponse(Object entity, String etagValue, long ttlSeconds) {
        return buildCachedOkResponse(entity, etagValue, ttlSeconds, null);
    }

    Response buildCachedOkResponse(Object entity, String etagValue, long ttlSeconds, Map<String, String> extraHeaders) {
        EntityTag tag = new EntityTag(etagValue);
        Response.ResponseBuilder builder = Response.ok(entity)
                .tag(tag)
                .header("Cache-Control", cacheControlHeader(ttlSeconds));
        applyExtraHeaders(builder, extraHeaders);
        return builder.build();
    }

    Response buildNotModifiedResponse(String etagValue, long ttlSeconds) {
        return buildNotModifiedResponse(etagValue, ttlSeconds, null);
    }

    Response buildNotModifiedResponse(String etagValue, long ttlSeconds, Map<String, String> extraHeaders) {
        EntityTag tag = new EntityTag(etagValue);
        Response.ResponseBuilder builder = Response.status(Status.NOT_MODIFIED)
                .tag(tag)
                .header("Cache-Control", cacheControlHeader(ttlSeconds));
        applyExtraHeaders(builder, extraHeaders);
        return builder.build();
    }

    long cacheTtlSeconds(String masterType) {
        return CACHE_TTL_SHORT_SECONDS;
    }

    private void applyExtraHeaders(Response.ResponseBuilder builder, Map<String, String> extraHeaders) {
        if (builder == null || extraHeaders == null || extraHeaders.isEmpty()) {
            return;
        }
        for (Map.Entry<String, String> entry : extraHeaders.entrySet()) {
            if (entry.getKey() == null || entry.getKey().isBlank() || entry.getValue() == null) {
                continue;
            }
            builder.header(entry.getKey(), entry.getValue());
        }
    }

    private String cacheControlHeader(long ttlSeconds) {
        return "public, max-age=" + ttlSeconds + ", stale-while-revalidate=" + CACHE_STALE_REVALIDATE_SECONDS;
    }

    private String sha256Hex(String input) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] bytes = digest.digest(input.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder(bytes.length * 2);
            for (byte value : bytes) {
                String part = Integer.toHexString(value & 0xff);
                if (part.length() == 1) {
                    hex.append('0');
                }
                hex.append(part);
            }
            return hex.toString();
        } catch (Exception e) {
            return Integer.toHexString(input.hashCode());
        }
    }

    private String dataSourceForOrigin(DataOrigin origin) {
        if (origin == DataOrigin.FALLBACK) {
            return "fallback";
        }
        if (origin == DataOrigin.ORCA_DB || origin == DataOrigin.LOCAL_CACHE) {
            return "server";
        }
        return "snapshot";
    }

    private String firstValue(MultivaluedMap<String, String> params, String key) {
        List<String> values = params.get(key);
        if (values == null || values.isEmpty()) {
            return null;
        }
        String value = values.get(0);
        return value != null && !value.isBlank() ? value : null;
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
}
