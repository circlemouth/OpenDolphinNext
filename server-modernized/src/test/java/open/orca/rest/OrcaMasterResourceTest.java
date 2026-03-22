package open.orca.rest;

import static org.junit.jupiter.api.Assertions.*;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.core.EntityTag;
import jakarta.ws.rs.core.MultivaluedHashMap;
import jakarta.ws.rs.core.MultivaluedMap;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.UriInfo;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.lang.reflect.Proxy;
import java.util.Collections;
import java.util.List;
import java.util.regex.Pattern;
import open.dolphin.rest.dto.orca.OrcaDrugMasterEntry;
import open.dolphin.rest.dto.orca.OrcaMasterErrorResponse;
import open.dolphin.rest.dto.orca.OrcaMasterListResponse;
import open.dolphin.rest.dto.orca.OrcaMasterMeta;
import open.dolphin.rest.dto.orca.OrcaTensuEntry;
import org.junit.jupiter.api.Test;

class OrcaMasterResourceTest {

    private static final String TEST_USER = "1.3.6.1.4.1.9414.70.1:admin";
    @Test
    void getGenericClass_returnsPagedResponseWithMeta() {
        OrcaMasterDao masterDao = new OrcaMasterDao() {
            @Override
            public GenericClassSearchResult searchGenericClass(GenericClassCriteria criteria) {
                GenericClassRecord record = new GenericClassRecord();
                record.classCode = "101";
                record.className = "Test Generic";
                record.startDate = "20240401";
                record.endDate = "99991231";
                record.version = "20240426";
                return new GenericClassSearchResult(List.of(record), criteria.isIncludeTotalCount() ? 1 : null, "20240426");
            }
        };
        OrcaMasterResource resource = new OrcaMasterResource(new EtensuDao(), masterDao);
        UriInfo uriInfo = createUriInfo(new MultivaluedHashMap<>());

        Response response = resource.getGenericClass(null, uriInfo, authenticatedRequest());

        assertEquals(200, response.getStatus());
        @SuppressWarnings("unchecked")
        OrcaMasterListResponse<OrcaDrugMasterEntry> payload =
                (OrcaMasterListResponse<OrcaDrugMasterEntry>) response.getEntity();
        assertNotNull(payload);
        assertNull(payload.getTotalCount());
        assertNotNull(payload.getItems());
        assertFalse(payload.getItems().isEmpty());
        OrcaDrugMasterEntry entry = payload.getItems().get(0);
        assertEquals("generic", entry.getCategory());
        assertNotNull(entry.getValidFrom());
        assertNotNull(entry.getValidTo());
        OrcaMasterMeta meta = entry.getMeta();
        assertNotNull(meta);
        assertEquals("server", meta.getDataSource());
        assertNotNull(meta.getRunId());
        assertFalse(meta.getRunId().isBlank());
        assertNotNull(meta.getFetchedAt());
    }

    @Test
    void getGenericClass_dbUnavailable_returnsServiceUnavailable() {
        OrcaMasterDao masterDao = new OrcaMasterDao() {
            @Override
            public GenericClassSearchResult searchGenericClass(GenericClassCriteria criteria) {
                return null;
            }
        };
        OrcaMasterResource resource = new OrcaMasterResource(new EtensuDao(), masterDao);

        Response response = resource.getGenericClass(null, createUriInfo(new MultivaluedHashMap<>()), authenticatedRequest());

        assertEquals(503, response.getStatus());
        OrcaMasterErrorResponse payload = (OrcaMasterErrorResponse) response.getEntity();
        assertNotNull(payload);
        assertEquals("MASTER_GENERIC_CLASS_UNAVAILABLE", payload.getCode());
    }

    @Test
    void getGenericClass_dbUnavailable_returnsStableErrorBody() {
        OrcaMasterDao masterDao = new OrcaMasterDao() {
            @Override
            public GenericClassSearchResult searchGenericClass(GenericClassCriteria criteria) {
                return null;
            }
        };
        OrcaMasterResource resource = new OrcaMasterResource(new EtensuDao(), masterDao);

        Response response = resource.getGenericClass(null, createUriInfo(new MultivaluedHashMap<>()),
                authenticatedRequest());

        assertEquals(503, response.getStatus());
        OrcaMasterErrorResponse payload = (OrcaMasterErrorResponse) response.getEntity();
        assertNotNull(payload);
        assertEquals("MASTER_GENERIC_CLASS_UNAVAILABLE", payload.getCode());
    }

    @Test
    void getGenericClass_returnsEtagAndCacheControlHeader() {
        OrcaMasterDao masterDao = new OrcaMasterDao() {
            @Override
            public GenericClassSearchResult searchGenericClass(GenericClassCriteria criteria) {
                GenericClassRecord record = new GenericClassRecord();
                record.classCode = "101";
                record.className = "Test Generic";
                record.startDate = "20240401";
                record.endDate = "99991231";
                record.version = "20240426";
                return new GenericClassSearchResult(List.of(record), 1, "20240426");
            }
        };
        OrcaMasterResource resource = new OrcaMasterResource(new EtensuDao(), masterDao);

        Response response = resource.getGenericClass(null, createUriInfo(new MultivaluedHashMap<>()), authenticatedRequest());

        assertEquals(200, response.getStatus());
        assertNotNull(response.getEntityTag());
        assertEquals("public, max-age=300, stale-while-revalidate=86400", response.getHeaderString("Cache-Control"));
    }

    @Test
    void getGenericClass_ifNoneMatch_returnsNotModifiedWithStableCacheHeader() {
        OrcaMasterDao masterDao = new OrcaMasterDao() {
            @Override
            public GenericClassSearchResult searchGenericClass(GenericClassCriteria criteria) {
                GenericClassRecord record = new GenericClassRecord();
                record.classCode = "101";
                record.className = "Test Generic";
                record.startDate = "20240401";
                record.endDate = "99991231";
                record.version = "20240426";
                return new GenericClassSearchResult(List.of(record), 1, "20240426");
            }
        };
        OrcaMasterResource resource = new OrcaMasterResource(new EtensuDao(), masterDao);
        UriInfo uriInfo = createUriInfo(new MultivaluedHashMap<>());

        Response initial = resource.getGenericClass(null, uriInfo, authenticatedRequest());
        EntityTag etag = initial.getEntityTag();
        Response cached = resource.getGenericClass("\"" + etag.getValue() + "\"", uriInfo, authenticatedRequest());

        assertEquals(304, cached.getStatus());
        assertEquals(etag.getValue(), cached.getEntityTag().getValue());
        assertEquals("public, max-age=300, stale-while-revalidate=86400", cached.getHeaderString("Cache-Control"));
    }

    @Test
    void getDrug_returnsPagedResponseWithMeta() {
        OrcaMasterDao masterDao = new OrcaMasterDao() {
            @Override
            public ListSearchResult<DrugRecord> searchDrug(DrugCriteria criteria) {
                DrugRecord record = new DrugRecord();
                record.srycd = "622961200";
                record.drugName = "ゲンタマイシン硫酸塩１０ｍｇ注射液";
                record.unit = "管";
                record.price = 109d;
                record.startDate = "20250401";
                record.endDate = "99999999";
                record.version = "20250401";
                return new ListSearchResult<>(List.of(record), criteria.isIncludeTotalCount() ? 1 : null, "20250401");
            }
        };
        OrcaMasterResource resource = new OrcaMasterResource(new EtensuDao(), masterDao);
        MultivaluedMap<String, String> params = new MultivaluedHashMap<>();
        params.add("keyword", "ゲンタ");
        params.add("includeTotalCount", "true");
        UriInfo uriInfo = createUriInfo(params);

        Response response = resource.getDrug(null, uriInfo, authenticatedRequest());

        assertEquals(200, response.getStatus());
        @SuppressWarnings("unchecked")
        OrcaMasterListResponse<OrcaDrugMasterEntry> payload =
                (OrcaMasterListResponse<OrcaDrugMasterEntry>) response.getEntity();
        assertNotNull(payload);
        assertEquals(1, payload.getTotalCount());
        assertNotNull(payload.getItems());
        assertFalse(payload.getItems().isEmpty());
        OrcaDrugMasterEntry entry = payload.getItems().get(0);
        assertEquals("622961200", entry.getCode());
        assertEquals("ゲンタマイシン硫酸塩１０ｍｇ注射液", entry.getName());
        assertEquals("drug", entry.getCategory());
        assertNotNull(entry.getMeta());
        assertEquals("server", entry.getMeta().getDataSource());
    }

    @Test
    void getDrug_dbUnavailable_returnsServiceUnavailable() {
        OrcaMasterDao masterDao = new OrcaMasterDao() {
            @Override
            public ListSearchResult<DrugRecord> searchDrug(DrugCriteria criteria) {
                return null;
            }
        };
        OrcaMasterResource resource = new OrcaMasterResource(new EtensuDao(), masterDao);
        MultivaluedMap<String, String> params = new MultivaluedHashMap<>();
        params.add("keyword", "ゲンタ");
        UriInfo uriInfo = createUriInfo(params);

        Response response = resource.getDrug(null, uriInfo, authenticatedRequest());

        assertEquals(503, response.getStatus());
        OrcaMasterErrorResponse payload = (OrcaMasterErrorResponse) response.getEntity();
        assertNotNull(payload);
        assertEquals("MASTER_DRUG_UNAVAILABLE", payload.getCode());
    }

    @Test
    void getDrug_rejectsUnsupportedScopeParameter() {
        OrcaMasterDao masterDao = new OrcaMasterDao() {
            @Override
            public ListSearchResult<DrugRecord> searchDrug(DrugCriteria criteria) {
                fail("scope 指定時は DAO を呼ばない");
                return null;
            }
        };
        OrcaMasterResource resource = new OrcaMasterResource(new EtensuDao(), masterDao);
        MultivaluedMap<String, String> params = new MultivaluedHashMap<>();
        params.add("keyword", "ゲンタ");
        params.add("scope", "outer");

        Response response = resource.getDrug(null, createUriInfo(params), authenticatedRequest());

        assertEquals(400, response.getStatus());
        OrcaMasterErrorResponse payload = (OrcaMasterErrorResponse) response.getEntity();
        assertNotNull(payload);
        assertEquals("unsupported_parameter", payload.getCode());
        assertEquals("scope query parameter is not supported", payload.getMessage());
    }

    @Test
    void getDrug_ifNoneMatch_returnsNotModifiedWithSameEtagAndCacheHeader() {
        OrcaMasterDao masterDao = new OrcaMasterDao() {
            @Override
            public ListSearchResult<DrugRecord> searchDrug(DrugCriteria criteria) {
                DrugRecord record = new DrugRecord();
                record.srycd = "622961200";
                record.drugName = "ゲンタマイシン硫酸塩１０ｍｇ注射液";
                record.unit = "管";
                record.price = 109d;
                record.startDate = "20250401";
                record.endDate = "99999999";
                record.version = "20250401";
                return new ListSearchResult<>(List.of(record), 1, "20250401");
            }
        };
        OrcaMasterResource resource = new OrcaMasterResource(new EtensuDao(), masterDao);
        MultivaluedMap<String, String> params = new MultivaluedHashMap<>();
        params.add("keyword", "ゲンタ");
        UriInfo uriInfo = createUriInfo(params);

        Response initial = resource.getDrug(null, uriInfo, authenticatedRequest());
        EntityTag etag = initial.getEntityTag();

        Response cached = resource.getDrug("\"" + etag.getValue() + "\"", uriInfo, authenticatedRequest());

        assertEquals(304, cached.getStatus());
        assertEquals(etag.getValue(), cached.getEntityTag().getValue());
        assertEquals("public, max-age=300, stale-while-revalidate=86400", cached.getHeaderString("Cache-Control"));
    }

    @Test
    void getDrug_ifNoneMatch_returnsNotModifiedWithStableCacheHeaders() {
        OrcaMasterDao masterDao = new OrcaMasterDao() {
            @Override
            public ListSearchResult<DrugRecord> searchDrug(DrugCriteria criteria) {
                DrugRecord record = new DrugRecord();
                record.srycd = "622961200";
                record.drugName = "ゲンタマイシン硫酸塩１０ｍｇ注射液";
                record.unit = "管";
                record.price = 109d;
                record.startDate = "20250401";
                record.endDate = "99999999";
                record.version = "20250401";
                return new ListSearchResult<>(List.of(record), 1, "20250401");
            }
        };
        OrcaMasterResource resource = new OrcaMasterResource(new EtensuDao(), masterDao);
        MultivaluedMap<String, String> params = new MultivaluedHashMap<>();
        params.add("keyword", "ゲンタ");
        UriInfo uriInfo = createUriInfo(params);

        Response initial = resource.getDrug(null, uriInfo, authenticatedRequest());

        assertEquals(200, initial.getStatus());
        assertEquals("public, max-age=300, stale-while-revalidate=86400", initial.getHeaderString("Cache-Control"));
        EntityTag etag = initial.getEntityTag();
        assertNotNull(etag);

        Response cached = resource.getDrug("\"" + etag.getValue() + "\"", uriInfo, authenticatedRequest());

        assertEquals(304, cached.getStatus());
        assertEquals(etag.getValue(), cached.getEntityTag().getValue());
        assertEquals("public, max-age=300, stale-while-revalidate=86400", cached.getHeaderString("Cache-Control"));
    }

    @Test
    void getComment_returnsPagedResponseWithMeta() {
        OrcaMasterDao masterDao = new OrcaMasterDao() {
            @Override
            public ListSearchResult<CommentRecord> searchComment(CommentCriteria criteria) {
                CommentRecord record = new CommentRecord();
                record.tensuCode = "820000001";
                record.name = "別途コメントあり";
                record.category = "820";
                record.unit = "回";
                record.startDate = "00000000";
                record.endDate = "99999999";
                record.version = "20260125";
                return new ListSearchResult<>(List.of(record), criteria.isIncludeTotalCount() ? 1 : null, "20260125");
            }
        };
        OrcaMasterResource resource = new OrcaMasterResource(new EtensuDao(), masterDao);
        MultivaluedMap<String, String> params = new MultivaluedHashMap<>();
        params.add("keyword", "別途");
        params.add("includeTotalCount", "1");
        UriInfo uriInfo = createUriInfo(params);

        Response response = resource.getComment(null, uriInfo, authenticatedRequest());

        assertEquals(200, response.getStatus());
        @SuppressWarnings("unchecked")
        OrcaMasterListResponse<OrcaTensuEntry> payload =
                (OrcaMasterListResponse<OrcaTensuEntry>) response.getEntity();
        assertNotNull(payload);
        assertEquals(1, payload.getTotalCount());
        assertNotNull(payload.getItems());
        assertFalse(payload.getItems().isEmpty());
        OrcaTensuEntry entry = payload.getItems().get(0);
        assertEquals("820000001", entry.getTensuCode());
        assertEquals("別途コメントあり", entry.getName());
        assertNotNull(entry.getMeta());
        assertEquals("server", entry.getMeta().getDataSource());
    }

    @Test
    void getComment_dbUnavailable_returnsServiceUnavailable() {
        OrcaMasterDao masterDao = new OrcaMasterDao() {
            @Override
            public ListSearchResult<CommentRecord> searchComment(CommentCriteria criteria) {
                return null;
            }
        };
        OrcaMasterResource resource = new OrcaMasterResource(new EtensuDao(), masterDao);
        MultivaluedMap<String, String> params = new MultivaluedHashMap<>();
        params.add("keyword", "別途");
        UriInfo uriInfo = createUriInfo(params);

        Response response = resource.getComment(null, uriInfo, authenticatedRequest());

        assertEquals(503, response.getStatus());
        OrcaMasterErrorResponse payload = (OrcaMasterErrorResponse) response.getEntity();
        assertNotNull(payload);
        assertEquals("MASTER_COMMENT_UNAVAILABLE", payload.getCode());
    }

    @Test
    void getComment_ifNoneMatch_returnsNotModifiedWithStableCacheHeader() {
        OrcaMasterDao masterDao = new OrcaMasterDao() {
            @Override
            public ListSearchResult<CommentRecord> searchComment(CommentCriteria criteria) {
                CommentRecord record = new CommentRecord();
                record.tensuCode = "820000001";
                record.name = "別途コメントあり";
                record.category = "820";
                record.unit = "回";
                record.startDate = "00000000";
                record.endDate = "99999999";
                record.version = "20260125";
                return new ListSearchResult<>(List.of(record), 1, "20260125");
            }
        };
        OrcaMasterResource resource = new OrcaMasterResource(new EtensuDao(), masterDao);
        MultivaluedMap<String, String> params = new MultivaluedHashMap<>();
        params.add("keyword", "別途");
        UriInfo uriInfo = createUriInfo(params);

        Response initial = resource.getComment(null, uriInfo, authenticatedRequest());
        EntityTag etag = initial.getEntityTag();
        Response cached = resource.getComment("\"" + etag.getValue() + "\"", uriInfo, authenticatedRequest());

        assertEquals(304, cached.getStatus());
        assertEquals(etag.getValue(), cached.getEntityTag().getValue());
        assertEquals("public, max-age=300, stale-while-revalidate=86400", cached.getHeaderString("Cache-Control"));
    }

    @Test
    void getBodypart_returnsPagedResponseWithMeta() {
        OrcaMasterDao masterDao = new OrcaMasterDao() {
            @Override
            public ListSearchResult<CommentRecord> searchBodypart(CommentCriteria criteria) {
                CommentRecord record = new CommentRecord();
                record.tensuCode = "820183500";
                record.name = "撮影部位（ＭＲＩ撮影）：膝";
                record.category = "820";
                record.unit = "部位";
                record.startDate = "00000000";
                record.endDate = "99999999";
                record.version = "20260125";
                return new ListSearchResult<>(List.of(record), criteria.isIncludeTotalCount() ? 1 : null, "20260125");
            }
        };
        OrcaMasterResource resource = new OrcaMasterResource(new EtensuDao(), masterDao);
        MultivaluedMap<String, String> params = new MultivaluedHashMap<>();
        params.add("keyword", "膝");
        UriInfo uriInfo = createUriInfo(params);

        Response response = resource.getBodypart(null, uriInfo, authenticatedRequest());

        assertEquals(200, response.getStatus());
        @SuppressWarnings("unchecked")
        OrcaMasterListResponse<OrcaTensuEntry> payload =
                (OrcaMasterListResponse<OrcaTensuEntry>) response.getEntity();
        assertNotNull(payload);
        assertNull(payload.getTotalCount());
        assertNotNull(payload.getItems());
        assertFalse(payload.getItems().isEmpty());
        OrcaTensuEntry entry = payload.getItems().get(0);
        assertEquals("820183500", entry.getTensuCode());
        assertEquals("撮影部位（ＭＲＩ撮影）：膝", entry.getName());
        assertNotNull(entry.getMeta());
        assertEquals("server", entry.getMeta().getDataSource());
    }

    @Test
    void getBodypart_dbUnavailable_returnsServiceUnavailable() {
        OrcaMasterDao masterDao = new OrcaMasterDao() {
            @Override
            public ListSearchResult<CommentRecord> searchBodypart(CommentCriteria criteria) {
                return null;
            }
        };
        OrcaMasterResource resource = new OrcaMasterResource(new EtensuDao(), masterDao);
        MultivaluedMap<String, String> params = new MultivaluedHashMap<>();
        params.add("keyword", "膝");
        UriInfo uriInfo = createUriInfo(params);

        Response response = resource.getBodypart(null, uriInfo, authenticatedRequest());

        assertEquals(503, response.getStatus());
        OrcaMasterErrorResponse payload = (OrcaMasterErrorResponse) response.getEntity();
        assertNotNull(payload);
        assertEquals("MASTER_BODYPART_UNAVAILABLE", payload.getCode());
    }

    @Test
    void getBodypart_ifNoneMatch_returnsNotModifiedWithStableCacheHeader() {
        OrcaMasterDao masterDao = new OrcaMasterDao() {
            @Override
            public ListSearchResult<CommentRecord> searchBodypart(CommentCriteria criteria) {
                CommentRecord record = new CommentRecord();
                record.tensuCode = "820183500";
                record.name = "撮影部位（ＭＲＩ撮影）：膝";
                record.category = "820";
                record.unit = "部位";
                record.startDate = "00000000";
                record.endDate = "99999999";
                record.version = "20260125";
                return new ListSearchResult<>(List.of(record), 1, "20260125");
            }
        };
        OrcaMasterResource resource = new OrcaMasterResource(new EtensuDao(), masterDao);
        MultivaluedMap<String, String> params = new MultivaluedHashMap<>();
        params.add("keyword", "膝");
        UriInfo uriInfo = createUriInfo(params);

        Response initial = resource.getBodypart(null, uriInfo, authenticatedRequest());
        EntityTag etag = initial.getEntityTag();
        Response cached = resource.getBodypart("\"" + etag.getValue() + "\"", uriInfo, authenticatedRequest());

        assertEquals(304, cached.getStatus());
        assertEquals(etag.getValue(), cached.getEntityTag().getValue());
        assertEquals("public, max-age=300, stale-while-revalidate=86400", cached.getHeaderString("Cache-Control"));
    }

    @Test
    void getGenericPrice_returnsEntryWithMetaFromFixture() {
        OrcaMasterResource resource = new OrcaMasterResource(new EtensuDao(), new OrcaMasterDao());
        MultivaluedMap<String, String> params = new MultivaluedHashMap<>();
        params.add("srycd", "110001110");
        UriInfo uriInfo = createUriInfo(params);

        Response response = resource.getGenericPrice(null, uriInfo, authenticatedRequest());

        assertEquals(503, response.getStatus());
        OrcaMasterErrorResponse payload = (OrcaMasterErrorResponse) response.getEntity();
        assertNotNull(payload);
        assertEquals("MASTER_GENERIC_PRICE_UNAVAILABLE", payload.getCode());
    }

    @Test
    void getGenericPrice_invalidSrycd_returnsValidationError() {
        OrcaMasterResource resource = new OrcaMasterResource(new EtensuDao(), new OrcaMasterDao());
        MultivaluedMap<String, String> params = new MultivaluedHashMap<>();
        params.add("srycd", "abc");
        UriInfo uriInfo = createUriInfo(params);

        Response response = resource.getGenericPrice(null, uriInfo, authenticatedRequest());

        assertEquals(422, response.getStatus());
        OrcaMasterErrorResponse payload = (OrcaMasterErrorResponse) response.getEntity();
        assertNotNull(payload);
        assertEquals("SRYCD_VALIDATION_ERROR", payload.getCode());
    }

    @Test
    void getHokenja_returnsListWithMetaFromFixture() {
        OrcaMasterResource resource = new OrcaMasterResource(new EtensuDao(), new OrcaMasterDao());
        MultivaluedMap<String, String> params = new MultivaluedHashMap<>();
        params.add("keyword", "医療共済");
        params.add("pref", "13");
        UriInfo uriInfo = createUriInfo(params);

        Response response = resource.getHokenja(null, uriInfo, authenticatedRequest());

        assertEquals(503, response.getStatus());
        OrcaMasterErrorResponse payload = (OrcaMasterErrorResponse) response.getEntity();
        assertNotNull(payload);
        assertEquals("MASTER_HOKENJA_UNAVAILABLE", payload.getCode());
    }

    @Test
    void getHokenja_invalidPref_returnsValidationError() {
        OrcaMasterResource resource = new OrcaMasterResource(new EtensuDao(), new OrcaMasterDao());
        MultivaluedMap<String, String> params = new MultivaluedHashMap<>();
        params.add("pref", "99");
        UriInfo uriInfo = createUriInfo(params);

        Response response = resource.getHokenja(null, uriInfo, authenticatedRequest());

        assertEquals(422, response.getStatus());
        OrcaMasterErrorResponse payload = (OrcaMasterErrorResponse) response.getEntity();
        assertNotNull(payload);
        assertEquals("PREF_VALIDATION_ERROR", payload.getCode());
    }

    @Test
    void getAddress_returnsEntryWithMetaFromFixture() {
        OrcaMasterResource resource = new OrcaMasterResource(new EtensuDao(), new OrcaMasterDao());
        MultivaluedMap<String, String> params = new MultivaluedHashMap<>();
        params.add("zip", "1000001");
        UriInfo uriInfo = createUriInfo(params);

        Response response = resource.getAddress(null, uriInfo, authenticatedRequest());

        assertEquals(503, response.getStatus());
        OrcaMasterErrorResponse payload = (OrcaMasterErrorResponse) response.getEntity();
        assertNotNull(payload);
        assertEquals("MASTER_ADDRESS_UNAVAILABLE", payload.getCode());
    }

    @Test
    void getAddress_unknownZip_returnsNotFound() {
        OrcaMasterResource resource = new OrcaMasterResource(new EtensuDao(), new OrcaMasterDao());
        MultivaluedMap<String, String> params = new MultivaluedHashMap<>();
        params.add("zip", "9999999");
        UriInfo uriInfo = createUriInfo(params);

        Response response = resource.getAddress(null, uriInfo, authenticatedRequest());

        assertEquals(503, response.getStatus());
        OrcaMasterErrorResponse payload = (OrcaMasterErrorResponse) response.getEntity();
        assertNotNull(payload);
        assertEquals("MASTER_ADDRESS_UNAVAILABLE", payload.getCode());
    }

    @Test
    void getGenericPrice_noFixtureFallbackRemains() {
        OrcaMasterResource resource = new OrcaMasterResource(new EtensuDao(), new OrcaMasterDao());
        MultivaluedMap<String, String> params = new MultivaluedHashMap<>();
        params.add("srycd", "110001110");
        Response response = resource.getGenericPrice(null, createUriInfo(params), authenticatedRequest());

        assertEquals(503, response.getStatus());
        OrcaMasterErrorResponse payload = (OrcaMasterErrorResponse) response.getEntity();
        assertNotNull(payload);
        assertEquals("MASTER_GENERIC_PRICE_UNAVAILABLE", payload.getCode());
    }

    @Test
    void getHokenja_noFixtureFallbackRemains() {
        OrcaMasterResource resource = new OrcaMasterResource(new EtensuDao(), new OrcaMasterDao());
        MultivaluedMap<String, String> params = new MultivaluedHashMap<>();
        params.add("keyword", "医療共済");
        Response response = resource.getHokenja(null, createUriInfo(params), authenticatedRequest());

        assertEquals(503, response.getStatus());
        OrcaMasterErrorResponse payload = (OrcaMasterErrorResponse) response.getEntity();
        assertNotNull(payload);
        assertEquals("MASTER_HOKENJA_UNAVAILABLE", payload.getCode());
    }

    @Test
    void getAddress_noFixtureFallbackRemains() {
        OrcaMasterResource resource = new OrcaMasterResource(new EtensuDao(), new OrcaMasterDao());
        MultivaluedMap<String, String> params = new MultivaluedHashMap<>();
        params.add("zip", "1000001");
        Response response = resource.getAddress(null, createUriInfo(params), authenticatedRequest());

        assertEquals(503, response.getStatus());
        OrcaMasterErrorResponse payload = (OrcaMasterErrorResponse) response.getEntity();
        assertNotNull(payload);
        assertEquals("MASTER_ADDRESS_UNAVAILABLE", payload.getCode());
    }


    @Test
    void getYouhou_returnsListWithMeta() {
        OrcaMasterDao masterDao = new OrcaMasterDao() {
            @Override
            public ListSearchResult<YouhouRecord> searchYouhou(YouhouCriteria criteria) {
                YouhouRecord record = new YouhouRecord();
                record.youhouCode = "Y001";
                record.youhouName = "Sample Youhou";
                record.startDate = "20240401";
                record.endDate = "99991231";
                record.version = "20240426";
                return new ListSearchResult<>(List.of(record), 1, "20240426");
            }
        };
        OrcaMasterResource resource = new OrcaMasterResource(new EtensuDao(), masterDao);
        UriInfo uriInfo = createUriInfo(new MultivaluedHashMap<>());

        Response response = resource.getYouhou(null, uriInfo, authenticatedRequest());

        assertEquals(200, response.getStatus());
        @SuppressWarnings("unchecked")
        List<OrcaDrugMasterEntry> payload = (List<OrcaDrugMasterEntry>) response.getEntity();
        assertFalse(payload.isEmpty());
        OrcaDrugMasterEntry entry = payload.get(0);
        assertEquals("youhou", entry.getCategory());
        assertEquals(entry.getCode(), entry.getYouhouCode());
        assertNotNull(entry.getMeta());
    }

    @Test
    void getYouhou_dbUnavailable_returnsServiceUnavailable() {
        OrcaMasterDao masterDao = new OrcaMasterDao() {
            @Override
            public ListSearchResult<YouhouRecord> searchYouhou(YouhouCriteria criteria) {
                return null;
            }
        };
        OrcaMasterResource resource = new OrcaMasterResource(new EtensuDao(), masterDao);

        Response response = resource.getYouhou(null, createUriInfo(new MultivaluedHashMap<>()), authenticatedRequest());

        assertEquals(503, response.getStatus());
        OrcaMasterErrorResponse payload = (OrcaMasterErrorResponse) response.getEntity();
        assertNotNull(payload);
        assertEquals("MASTER_YOUHOU_UNAVAILABLE", payload.getCode());
    }

    @Test
    void getYouhou_returnsStableCacheControlHeader() {
        OrcaMasterDao masterDao = new OrcaMasterDao() {
            @Override
            public ListSearchResult<YouhouRecord> searchYouhou(YouhouCriteria criteria) {
                YouhouRecord record = new YouhouRecord();
                record.youhouCode = "Y001";
                record.youhouName = "Sample Youhou";
                record.startDate = "20240401";
                record.endDate = "99991231";
                record.version = "20240426";
                return new ListSearchResult<>(List.of(record), 1, "20240426");
            }
        };
        OrcaMasterResource resource = new OrcaMasterResource(new EtensuDao(), masterDao);

        Response response = resource.getYouhou(null, createUriInfo(new MultivaluedHashMap<>()), authenticatedRequest());

        assertEquals(200, response.getStatus());
        assertNotNull(response.getEntityTag());
        assertEquals("public, max-age=300, stale-while-revalidate=86400", response.getHeaderString("Cache-Control"));
    }

    @Test
    void getMaterial_returnsListWithMeta() {
        OrcaMasterDao masterDao = new OrcaMasterDao() {
            @Override
            public ListSearchResult<MaterialRecord> searchMaterial(MaterialCriteria criteria) {
                MaterialRecord record = new MaterialRecord();
                record.materialCode = "710010004";
                record.materialName = "中心静脈用カテーテル（標準・シングルルーメン）";
                record.category = "700";
                record.materialCategory = "700";
                record.unit = "本";
                record.price = 1234d;
                record.startDate = "20200401";
                record.endDate = "99999999";
                record.version = "20250401";
                return new ListSearchResult<>(List.of(record), 1, "20250401");
            }
        };
        OrcaMasterResource resource = new OrcaMasterResource(new EtensuDao(), masterDao);
        MultivaluedMap<String, String> params = new MultivaluedHashMap<>();
        params.add("keyword", "カテーテル");
        UriInfo uriInfo = createUriInfo(params);

        Response response = resource.getMaterial(null, uriInfo, authenticatedRequest());

        assertEquals(200, response.getStatus());
        @SuppressWarnings("unchecked")
        List<OrcaDrugMasterEntry> payload = (List<OrcaDrugMasterEntry>) response.getEntity();
        assertFalse(payload.isEmpty());
        OrcaDrugMasterEntry entry = payload.get(0);
        assertEquals("710010004", entry.getCode());
        assertEquals("中心静脈用カテーテル（標準・シングルルーメン）", entry.getName());
        assertEquals("material", entry.getCategory());
        assertNotNull(entry.getMaterialCategory());
        assertNotNull(entry.getMeta());
        assertEquals("server", entry.getMeta().getDataSource());
    }

    @Test
    void getMaterial_dbUnavailable_returnsServiceUnavailable() {
        OrcaMasterDao masterDao = new OrcaMasterDao() {
            @Override
            public ListSearchResult<MaterialRecord> searchMaterial(MaterialCriteria criteria) {
                return null;
            }
        };
        OrcaMasterResource resource = new OrcaMasterResource(new EtensuDao(), masterDao);
        Response response = resource.getMaterial(null, createUriInfo(new MultivaluedHashMap<>()), authenticatedRequest());

        assertEquals(503, response.getStatus());
        OrcaMasterErrorResponse payload = (OrcaMasterErrorResponse) response.getEntity();
        assertNotNull(payload);
        assertEquals("MASTER_MATERIAL_UNAVAILABLE", payload.getCode());
    }

    @Test
    void getMaterial_returnsStableCacheControlHeader() {
        OrcaMasterDao masterDao = new OrcaMasterDao() {
            @Override
            public ListSearchResult<MaterialRecord> searchMaterial(MaterialCriteria criteria) {
                MaterialRecord record = new MaterialRecord();
                record.materialCode = "710010004";
                record.materialName = "中心静脈用カテーテル";
                record.category = "700";
                record.materialCategory = "700";
                record.unit = "本";
                record.price = 1234d;
                record.startDate = "20200401";
                record.endDate = "99999999";
                record.version = "20250401";
                return new ListSearchResult<>(List.of(record), 1, "20250401");
            }
        };
        OrcaMasterResource resource = new OrcaMasterResource(new EtensuDao(), masterDao);
        MultivaluedMap<String, String> params = new MultivaluedHashMap<>();
        params.add("keyword", "カテーテル");

        Response response = resource.getMaterial(null, createUriInfo(params), authenticatedRequest());

        assertEquals(200, response.getStatus());
        assertNotNull(response.getEntityTag());
        assertEquals("public, max-age=300, stale-while-revalidate=86400", response.getHeaderString("Cache-Control"));
    }

    @Test
    void getKensaSort_returnsListWithMeta() {
        OrcaMasterDao masterDao = new OrcaMasterDao() {
            @Override
            public ListSearchResult<KensaSortRecord> searchKensaSort(KensaSortCriteria criteria) {
                KensaSortRecord record = new KensaSortRecord();
                record.kensaCode = "160008010";
                record.kensaName = "末梢血液一般";
                record.kensaSort = "2";
                record.classification = "600";
                record.startDate = "20240401";
                record.endDate = "99999999";
                record.version = "20250401";
                return new ListSearchResult<>(List.of(record), 1, "20250401");
            }
        };
        OrcaMasterResource resource = new OrcaMasterResource(new EtensuDao(), masterDao);
        MultivaluedMap<String, String> params = new MultivaluedHashMap<>();
        params.add("keyword", "血液");
        UriInfo uriInfo = createUriInfo(params);

        Response response = resource.getKensaSort(null, uriInfo, authenticatedRequest());

        assertEquals(200, response.getStatus());
        @SuppressWarnings("unchecked")
        List<OrcaDrugMasterEntry> payload = (List<OrcaDrugMasterEntry>) response.getEntity();
        assertFalse(payload.isEmpty());
        OrcaDrugMasterEntry entry = payload.get(0);
        assertEquals("160008010", entry.getCode());
        assertEquals("末梢血液一般", entry.getName());
        assertEquals("kensa-sort", entry.getCategory());
        assertEquals("2", entry.getKensaSort());
        assertNotNull(entry.getMeta());
        assertEquals("server", entry.getMeta().getDataSource());
    }

    @Test
    void getKensaSort_dbUnavailable_returnsServiceUnavailable() {
        OrcaMasterDao masterDao = new OrcaMasterDao() {
            @Override
            public ListSearchResult<KensaSortRecord> searchKensaSort(KensaSortCriteria criteria) {
                return null;
            }
        };
        OrcaMasterResource resource = new OrcaMasterResource(new EtensuDao(), masterDao);
        MultivaluedMap<String, String> params = new MultivaluedHashMap<>();
        params.add("keyword", "血液");

        Response response = resource.getKensaSort(null, createUriInfo(params), authenticatedRequest());

        assertEquals(503, response.getStatus());
        OrcaMasterErrorResponse payload = (OrcaMasterErrorResponse) response.getEntity();
        assertNotNull(payload);
        assertEquals("MASTER_KENSA_SORT_UNAVAILABLE", payload.getCode());
    }

    @Test
    void getKensaSort_ifNoneMatch_returnsNotModifiedWithStableCacheHeader() {
        OrcaMasterDao masterDao = new OrcaMasterDao() {
            @Override
            public ListSearchResult<KensaSortRecord> searchKensaSort(KensaSortCriteria criteria) {
                KensaSortRecord record = new KensaSortRecord();
                record.kensaCode = "160008010";
                record.kensaName = "末梢血液一般";
                record.kensaSort = "2";
                record.classification = "600";
                record.startDate = "20240401";
                record.endDate = "99999999";
                record.version = "20250401";
                return new ListSearchResult<>(List.of(record), 1, "20250401");
            }
        };
        OrcaMasterResource resource = new OrcaMasterResource(new EtensuDao(), masterDao);
        MultivaluedMap<String, String> params = new MultivaluedHashMap<>();
        params.add("keyword", "血液");
        UriInfo uriInfo = createUriInfo(params);

        Response initial = resource.getKensaSort(null, uriInfo, authenticatedRequest());
        EntityTag etag = initial.getEntityTag();
        Response cached = resource.getKensaSort("\"" + etag.getValue() + "\"", uriInfo, authenticatedRequest());

        assertEquals(304, cached.getStatus());
        assertEquals(etag.getValue(), cached.getEntityTag().getValue());
        assertEquals("public, max-age=300, stale-while-revalidate=86400", cached.getHeaderString("Cache-Control"));
    }


    @Test
    void getEtensu_emptyResult_returnsNotFound() {
        OrcaMasterResource resource = new OrcaMasterResource(new EtensuDao() {
            @Override
            public EtensuSearchResult search(EtensuSearchCriteria criteria) {
                return new EtensuSearchResult(Collections.emptyList(), 0, "202404");
            }
        }, new OrcaMasterDao());
        MultivaluedMap<String, String> params = new MultivaluedHashMap<>();
        params.add("keyword", "no-such-entry");
        UriInfo uriInfo = createUriInfo(params);

        Response response = resource.getEtensu(null, uriInfo, authenticatedRequest());

        assertEquals(404, response.getStatus());
        OrcaMasterErrorResponse payload = (OrcaMasterErrorResponse) response.getEntity();
        assertEquals("TENSU_NOT_FOUND", payload.getCode());
    }

    @Test
    void getEtensu_returnsNoticeEffectiveKubunAndPoints() throws Exception {
        EtensuDao.EtensuRecord record = new EtensuDao.EtensuRecord();
        setEtensuField(record, "tensuCode", "110000001");
        setEtensuField(record, "name", "Sample Tensu");
        setEtensuField(record, "kubun", "11");
        setEtensuField(record, "points", 288d);
        setEtensuField(record, "tanka", 288d);
        setEtensuField(record, "unit", "visit");
        setEtensuField(record, "noticeDate", "20240101");
        setEtensuField(record, "effectiveDate", "20240401");
        setEtensuField(record, "startDate", "20240401");
        setEtensuField(record, "endDate", "99991231");
        setEtensuField(record, "tensuVersion", "202404");

        OrcaMasterResource resource = new OrcaMasterResource(new EtensuDao() {
            @Override
            public EtensuSearchResult search(EtensuSearchCriteria criteria) {
                return new EtensuSearchResult(List.of(record), criteria.isIncludeTotalCount() ? 1 : null, "202404");
            }
        }, new OrcaMasterDao());
        UriInfo uriInfo = createUriInfo(new MultivaluedHashMap<>());

        Response response = resource.getEtensu(null, uriInfo, authenticatedRequest());

        assertEquals(200, response.getStatus());
        @SuppressWarnings("unchecked")
        OrcaMasterListResponse<OrcaTensuEntry> payload =
                (OrcaMasterListResponse<OrcaTensuEntry>) response.getEntity();
        assertNotNull(payload);
        assertNull(payload.getTotalCount());
        assertNull(response.getHeaderString("X-Orca-Total-Count"));
        OrcaTensuEntry entry = payload.getItems().get(0);
        assertEquals("11", entry.getKubun());
        assertEquals(288d, entry.getPoints());
        assertEquals("20240101", entry.getNoticeDate());
        assertEquals("20240401", entry.getEffectiveDate());
    }

    @Test
    void getEtensu_includeTotalCountExplicitlyRequested_returnsCountAndHeader() throws Exception {
        EtensuDao.EtensuRecord record = new EtensuDao.EtensuRecord();
        setEtensuField(record, "tensuCode", "110000003");
        setEtensuField(record, "name", "Sample Tensu Count");
        setEtensuField(record, "kubun", "11");
        setEtensuField(record, "points", 144d);
        setEtensuField(record, "tanka", 144d);
        setEtensuField(record, "unit", "visit");
        setEtensuField(record, "noticeDate", "20240101");
        setEtensuField(record, "effectiveDate", "20240401");
        setEtensuField(record, "startDate", "20240401");
        setEtensuField(record, "endDate", "99991231");
        setEtensuField(record, "tensuVersion", "202404");

        OrcaMasterResource resource = new OrcaMasterResource(new EtensuDao() {
            @Override
            public EtensuSearchResult search(EtensuSearchCriteria criteria) {
                return new EtensuSearchResult(List.of(record), criteria.isIncludeTotalCount() ? 1 : null, "202404");
            }
        }, new OrcaMasterDao());
        MultivaluedMap<String, String> params = new MultivaluedHashMap<>();
        params.add("includeTotalCount", "true");
        UriInfo uriInfo = createUriInfo(params);

        Response response = resource.getEtensu(null, uriInfo, authenticatedRequest());

        assertEquals(200, response.getStatus());
        @SuppressWarnings("unchecked")
        OrcaMasterListResponse<OrcaTensuEntry> payload =
                (OrcaMasterListResponse<OrcaTensuEntry>) response.getEntity();
        assertNotNull(payload);
        assertEquals(1, payload.getTotalCount());
        assertEquals("1", response.getHeaderString("X-Orca-Total-Count"));
    }

    @Test
    void getEtensu_ifNoneMatch_returnsNotModifiedWithCacheHitHeader() throws Exception {
        EtensuDao.EtensuRecord record = new EtensuDao.EtensuRecord();
        setEtensuField(record, "tensuCode", "110000002");
        setEtensuField(record, "name", "Sample Tensu Cache");
        setEtensuField(record, "kubun", "11");
        setEtensuField(record, "points", 288d);
        setEtensuField(record, "tanka", 288d);
        setEtensuField(record, "unit", "visit");
        setEtensuField(record, "noticeDate", "20240101");
        setEtensuField(record, "effectiveDate", "20240401");
        setEtensuField(record, "startDate", "20240401");
        setEtensuField(record, "endDate", "99991231");
        setEtensuField(record, "tensuVersion", "202404");

        OrcaMasterResource resource = new OrcaMasterResource(new EtensuDao() {
            @Override
            public EtensuSearchResult search(EtensuSearchCriteria criteria) {
                return new EtensuSearchResult(List.of(record), 1, "202404");
            }
        }, new OrcaMasterDao());
        UriInfo uriInfo = createUriInfo(new MultivaluedHashMap<>());

        Response initial = resource.getEtensu(null, uriInfo, authenticatedRequest());

        assertEquals(200, initial.getStatus());
        EntityTag etag = initial.getEntityTag();
        assertNotNull(etag);
        String ifNoneMatch = "\"" + etag.getValue() + "\"";

        Response cached = resource.getEtensu(ifNoneMatch, uriInfo, authenticatedRequest());

        assertEquals(304, cached.getStatus());
        assertNull(cached.getEntity());
        assertNotNull(cached.getEntityTag());
        assertEquals(etag.getValue(), cached.getEntityTag().getValue());
        assertEquals("true", cached.getHeaderString("X-Orca-Cache-Hit"));
    }

    @Test
    void getEtensu_dbUnavailable_returnsServiceUnavailable() {
        OrcaMasterResource resource = new OrcaMasterResource(new EtensuDao() {
            @Override
            public EtensuSearchResult search(EtensuSearchCriteria criteria) {
                return new EtensuSearchResult(Collections.emptyList(), 0, "202404", 0, true);
            }
        }, new OrcaMasterDao());
        UriInfo uriInfo = createUriInfo(new MultivaluedHashMap<>());

        Response response = resource.getEtensu(null, uriInfo, authenticatedRequest());

        assertEquals(503, response.getStatus());
        OrcaMasterErrorResponse payload = (OrcaMasterErrorResponse) response.getEntity();
        assertNotNull(payload);
        assertEquals("ETENSU_UNAVAILABLE", payload.getCode());
    }

    @Test
    void getEtensu_dbUnavailable_keepsServiceUnavailableWithoutFallbackSource() {
        OrcaMasterResource resource = new OrcaMasterResource(new EtensuDao() {
            @Override
            public EtensuSearchResult search(EtensuSearchCriteria criteria) {
                return new EtensuSearchResult(Collections.emptyList(), 0, "202404", 0, true);
            }
        }, new OrcaMasterDao());
        UriInfo uriInfo = createUriInfo(new MultivaluedHashMap<>());

        Response response = resource.getEtensu(null, uriInfo, authenticatedRequest());

        assertEquals(503, response.getStatus());
        OrcaMasterErrorResponse payload = (OrcaMasterErrorResponse) response.getEntity();
        assertNotNull(payload);
        assertEquals("ETENSU_UNAVAILABLE", payload.getCode());
    }

    @Test
    void getEtensu_dbUnavailable_withCategoryFilter_stillReturnsServiceUnavailable() {
        OrcaMasterResource resource = new OrcaMasterResource(new EtensuDao() {
            @Override
            public EtensuSearchResult search(EtensuSearchCriteria criteria) {
                return new EtensuSearchResult(Collections.emptyList(), 0, "202404", 0, true);
            }
        }, new OrcaMasterDao());
        MultivaluedMap<String, String> params = new MultivaluedHashMap<>();
        params.add("keyword", "腹");
        params.add("category", "2");
        UriInfo uriInfo = createUriInfo(params);

        Response response = resource.getEtensu(null, uriInfo, authenticatedRequest());

        assertEquals(503, response.getStatus());
        OrcaMasterErrorResponse payload = (OrcaMasterErrorResponse) response.getEntity();
        assertNotNull(payload);
        assertEquals("ETENSU_UNAVAILABLE", payload.getCode());
    }

    @Test
    void getEtensu_invalidCategory_returnsValidationError() {
        OrcaMasterResource resource = new OrcaMasterResource(new EtensuDao(), new OrcaMasterDao());
        MultivaluedMap<String, String> params = new MultivaluedHashMap<>();
        params.add("category", "ABC");
        UriInfo uriInfo = createUriInfo(params);

        Response response = resource.getEtensu(null, uriInfo, authenticatedRequest());

        assertEquals(422, response.getStatus());
        OrcaMasterErrorResponse payload = (OrcaMasterErrorResponse) response.getEntity();
        assertEquals("TENSU_CATEGORY_INVALID", payload.getCode());
        assertEquals(Boolean.TRUE, payload.getValidationError());
    }

    @Test
    void getEtensu_invalidAsOf_returnsValidationError() {
        OrcaMasterResource resource = new OrcaMasterResource(new EtensuDao(), new OrcaMasterDao());
        MultivaluedMap<String, String> params = new MultivaluedHashMap<>();
        params.add("asOf", "2024-01-01");
        UriInfo uriInfo = createUriInfo(params);

        Response response = resource.getEtensu(null, uriInfo, authenticatedRequest());

        assertEquals(422, response.getStatus());
        OrcaMasterErrorResponse payload = (OrcaMasterErrorResponse) response.getEntity();
        assertEquals("TENSU_ASOF_INVALID", payload.getCode());
        assertEquals(Boolean.TRUE, payload.getValidationError());
    }

    @Test
    void getEtensu_invalidTensuVersion_returnsValidationError() {
        OrcaMasterResource resource = new OrcaMasterResource(new EtensuDao(), new OrcaMasterDao());
        MultivaluedMap<String, String> params = new MultivaluedHashMap<>();
        params.add("tensuVersion", "2024-04");
        UriInfo uriInfo = createUriInfo(params);

        Response response = resource.getEtensu(null, uriInfo, authenticatedRequest());

        assertEquals(422, response.getStatus());
        OrcaMasterErrorResponse payload = (OrcaMasterErrorResponse) response.getEntity();
        assertEquals("TENSU_VERSION_INVALID", payload.getCode());
        assertEquals(Boolean.TRUE, payload.getValidationError());
    }

    @Test
    void getEtensu_pointsMinAndPointsMax_arePassedToDao() {
        final EtensuDao.EtensuSearchCriteria[] captured = new EtensuDao.EtensuSearchCriteria[1];
        OrcaMasterResource resource = new OrcaMasterResource(new EtensuDao() {
            @Override
            public EtensuSearchResult search(EtensuSearchCriteria criteria) {
                captured[0] = criteria;
                return new EtensuSearchResult(Collections.emptyList(), 0, "202404");
            }
        }, new OrcaMasterDao());
        MultivaluedMap<String, String> params = new MultivaluedHashMap<>();
        params.add("pointsMin", "20");
        params.add("pointsMax", "40");
        UriInfo uriInfo = createUriInfo(params);

        Response response = resource.getEtensu(null, uriInfo, authenticatedRequest());

        assertEquals(404, response.getStatus());
        assertNotNull(captured[0]);
        assertEquals(20d, captured[0].getPointsMin());
        assertEquals(40d, captured[0].getPointsMax());
    }

    @Test
    void getEtensu_pointsMinOnly_isPassedToDao() {
        final EtensuDao.EtensuSearchCriteria[] captured = new EtensuDao.EtensuSearchCriteria[1];
        OrcaMasterResource resource = new OrcaMasterResource(new EtensuDao() {
            @Override
            public EtensuSearchResult search(EtensuSearchCriteria criteria) {
                captured[0] = criteria;
                return new EtensuSearchResult(Collections.emptyList(), 0, "202404");
            }
        }, new OrcaMasterDao());
        MultivaluedMap<String, String> params = new MultivaluedHashMap<>();
        params.add("pointsMin", "12.5");
        UriInfo uriInfo = createUriInfo(params);

        Response response = resource.getEtensu(null, uriInfo, authenticatedRequest());

        assertEquals(404, response.getStatus());
        assertNotNull(captured[0]);
        assertEquals(12.5d, captured[0].getPointsMin());
        assertNull(captured[0].getPointsMax());
    }

    @Test
    void getEtensu_pointsMaxOnly_isPassedToDao() {
        final EtensuDao.EtensuSearchCriteria[] captured = new EtensuDao.EtensuSearchCriteria[1];
        OrcaMasterResource resource = new OrcaMasterResource(new EtensuDao() {
            @Override
            public EtensuSearchResult search(EtensuSearchCriteria criteria) {
                captured[0] = criteria;
                return new EtensuSearchResult(Collections.emptyList(), 0, "202404");
            }
        }, new OrcaMasterDao());
        MultivaluedMap<String, String> params = new MultivaluedHashMap<>();
        params.add("pointsMax", "88");
        UriInfo uriInfo = createUriInfo(params);

        Response response = resource.getEtensu(null, uriInfo, authenticatedRequest());

        assertEquals(404, response.getStatus());
        assertNotNull(captured[0]);
        assertNull(captured[0].getPointsMin());
        assertEquals(88d, captured[0].getPointsMax());
    }

    @Test
    void getEtensu_pointsRangeInvalid_returnsBadRequest() {
        OrcaMasterResource resource = new OrcaMasterResource(new EtensuDao(), new OrcaMasterDao());
        MultivaluedMap<String, String> params = new MultivaluedHashMap<>();
        params.add("pointsMin", "40");
        params.add("pointsMax", "20");
        UriInfo uriInfo = createUriInfo(params);

        Response response = resource.getEtensu(null, uriInfo, authenticatedRequest());

        assertEquals(400, response.getStatus());
        OrcaMasterErrorResponse payload = (OrcaMasterErrorResponse) response.getEntity();
        assertEquals("TENSU_POINTS_RANGE_INVALID", payload.getCode());
    }

    @Test
    void isAuthorized_acceptsAuthenticatedRemoteUser() {
        assertTrue(OrcaMasterAuthSupport.isAuthorized(authenticatedRequest()));
    }

    @Test
    void isAuthorized_acceptsAuthenticatedPrincipal() {
        assertTrue(OrcaMasterAuthSupport.isAuthorized(createRequestWithPrincipal(TEST_USER)));
    }

    @Test
    void isAuthorized_rejectsBasicHeaderWithoutPrincipal() {
        assertFalse(OrcaMasterAuthSupport.isAuthorized(createRequestWithAuthorization("Basic ignored")));
    }

    @Test
    void isAuthorized_rejectsMissingRequest() {
        assertFalse(OrcaMasterAuthSupport.isAuthorized(null));
    }

    @Test
    void getGenericClass_rejectsMissingPrincipal() {
        OrcaMasterResource resource = new OrcaMasterResource(new EtensuDao(), new OrcaMasterDao());
        UriInfo uriInfo = createUriInfo(new MultivaluedHashMap<>());

        Response response = resource.getGenericClass(null, uriInfo, null);

        assertEquals(401, response.getStatus());
    }

    @Test
    void getDrug_rejectsMissingPrincipal() {
        OrcaMasterResource resource = new OrcaMasterResource(new EtensuDao(), new OrcaMasterDao());

        Response response = resource.getDrug(null, createUriInfo(new MultivaluedHashMap<>()), null);

        assertEquals(401, response.getStatus());
        OrcaMasterErrorResponse payload = (OrcaMasterErrorResponse) response.getEntity();
        assertNotNull(payload);
        assertEquals("ORCA_MASTER_UNAUTHORIZED", payload.getCode());
    }

    @Test
    void etagMatches_acceptsWeakMultipleAndWildcardValues() throws Exception {
        OrcaMasterResource resource = new OrcaMasterResource();
        Method method = OrcaMasterResource.class.getDeclaredMethod("etagMatches", String.class, String.class);
        method.setAccessible(true);
        assertTrue((Boolean) method.invoke(resource, "\"abc\"", "abc"));
        assertTrue((Boolean) method.invoke(resource, "W/\"abc\"", "abc"));
        assertTrue((Boolean) method.invoke(resource, "\"nope\", \"abc\"", "abc"));
        assertTrue((Boolean) method.invoke(resource, "*", "abc"));
        assertFalse((Boolean) method.invoke(resource, "\"nope\"", "abc"));
    }

    @Test
    void normalizeQuery_sortsKeysAndValuesWithDuplicates() throws Exception {
        OrcaMasterResource resource = new OrcaMasterResource();
        Method method = OrcaMasterResource.class.getDeclaredMethod("normalizeQuery", MultivaluedMap.class);
        method.setAccessible(true);
        MultivaluedMap<String, String> params = new MultivaluedHashMap<>();
        params.add("b", "2");
        params.add("a", "3");
        params.add("b", "1");
        params.add("b", "1");
        String normalized = (String) method.invoke(resource, params);
        assertEquals("a=3&b=1,1,2", normalized);
    }

    private UriInfo createUriInfo(MultivaluedMap<String, String> params) {
        return (UriInfo) Proxy.newProxyInstance(
                getClass().getClassLoader(),
                new Class[]{UriInfo.class},
                (proxy, method, args) -> {
                    if ("getQueryParameters".equals(method.getName())) {
                        return params;
                    }
                    return null;
                }
        );
    }

    private HttpServletRequest createRequestWithRunId(String runId, String requestUri) {
        return (HttpServletRequest) Proxy.newProxyInstance(
                getClass().getClassLoader(),
                new Class[]{HttpServletRequest.class},
                (proxy, method, args) -> {
                    switch (method.getName()) {
                        case "getHeader":
                            String headerName = (String) args[0];
                            if ("X-Run-Id".equalsIgnoreCase(headerName)) {
                                return runId;
                            }
                            return null;
                        case "getRemoteAddr":
                            return "127.0.0.1";
                        case "getRemoteUser":
                            return TEST_USER;
                        case "getRequestURI":
                            return requestUri;
                        default:
                            return null;
                    }
                }
        );
    }

    private HttpServletRequest authenticatedRequest() {
        return createRequestWithRemoteUser(TEST_USER);
    }

    private HttpServletRequest createRequestWithAuthorization(String authorization) {
        return (HttpServletRequest) Proxy.newProxyInstance(
                getClass().getClassLoader(),
                new Class[]{HttpServletRequest.class},
                (proxy, method, args) -> {
                    if ("getHeader".equals(method.getName())) {
                        String headerName = (String) args[0];
                        if ("Authorization".equalsIgnoreCase(headerName)) {
                            return authorization;
                        }
                    }
                    return null;
                }
        );
    }

    private HttpServletRequest createRequestWithPrincipal(String principalName) {
        return (HttpServletRequest) Proxy.newProxyInstance(
                getClass().getClassLoader(),
                new Class[]{HttpServletRequest.class},
                (proxy, method, args) -> {
                    if ("getUserPrincipal".equals(method.getName())) {
                        return (java.security.Principal) () -> principalName;
                    }
                    return null;
                }
        );
    }

    private HttpServletRequest createRequestWithRemoteUser(String remoteUser) {
        return (HttpServletRequest) Proxy.newProxyInstance(
                getClass().getClassLoader(),
                new Class[]{HttpServletRequest.class},
                (proxy, method, args) -> {
                    if ("getRemoteUser".equals(method.getName())) {
                        return remoteUser;
                    }
                    return null;
                }
        );
    }

    private static final Pattern RUN_ID_PATTERN = Pattern.compile("\\\\d{8}T\\\\d{6}Z");

    private void setEtensuField(EtensuDao.EtensuRecord record, String fieldName, Object value) throws Exception {
        Field field = EtensuDao.EtensuRecord.class.getDeclaredField(fieldName);
        field.setAccessible(true);
        field.set(record, value);
    }
}
