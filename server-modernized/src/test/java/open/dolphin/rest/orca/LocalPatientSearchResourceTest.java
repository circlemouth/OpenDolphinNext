package open.dolphin.rest.orca;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import jakarta.servlet.http.HttpServletRequest;
import java.lang.reflect.Field;
import java.lang.reflect.Proxy;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import open.dolphin.infomodel.PatientModel;
import open.dolphin.orca.service.OrcaPatientCacheStore;
import open.dolphin.rest.dto.outpatient.PatientOutpatientResponse;
import open.dolphin.session.PatientServiceBean;
import open.dolphin.session.PatientServiceBean.PatientSearchType;
import org.junit.jupiter.api.Test;

class LocalPatientSearchResourceTest {

    @Test
    void localSearchProvidesRequestMetadata() {
        LocalPatientSearchResource resource = new LocalPatientSearchResource();

        HttpServletRequest request = createRequest(
                "F001:doctor01",
                "/api/local/patients/search",
                Map.of("X-Trace-Id", "trace-local", "X-Request-Id", "req-local"));

        PatientOutpatientResponse response = resource.postPatients(request, Map.of("keyword", "test"));

        assertEquals("trace-local", response.getTraceId());
        assertEquals("req-local", response.getRequestId());
        assertEquals("local", response.getRouteNamespace());
        assertEquals("local", response.getDataSource());
        assertEquals("local", response.getDataSourceTransition());
        assertNotNull(response.getFetchedAt());
    }

    @Test
    void localSearchResolvesSearchTypeFromKeyword() throws Exception {
        CapturingPatientServiceBean service = new CapturingPatientServiceBean();
        LocalPatientSearchResource resource = new LocalPatientSearchResource();
        injectField(resource, "patientServiceBean", service);

        HttpServletRequest request = createRequest(
                "F001:doctor01",
                "/api/local/patients/search",
                Map.of("X-Trace-Id", "trace-local", "X-Request-Id", "req-local"));

        resource.postPatients(request, Map.of("keyword", "000123"));
        assertEquals(PatientSearchType.PATIENT_ID, service.lastSearchType);

        resource.postPatients(request, Map.of("keyword", "1000001"));
        assertEquals(PatientSearchType.ZIPCODE, service.lastSearchType);

        resource.postPatients(request, Map.of("keyword", "090-1234-5678"));
        assertEquals(PatientSearchType.TELEPHONE, service.lastSearchType);

        resource.postPatients(request, Map.of("keyword", "やまだ"));
        assertEquals(PatientSearchType.KANA, service.lastSearchType);

        PatientOutpatientResponse response = resource.postPatients(request, Map.of("keyword", "山田"));
        assertEquals(PatientSearchType.NAME, service.lastSearchType);
        assertEquals("name", response.getAuditEvent().getDetails().get("searchType"));
    }

    @Test
    void localSearchHonorsExplicitSearchType() throws Exception {
        CapturingPatientServiceBean service = new CapturingPatientServiceBean();
        LocalPatientSearchResource resource = new LocalPatientSearchResource();
        injectField(resource, "patientServiceBean", service);

        HttpServletRequest request = createRequest(
                "F001:doctor01",
                "/api/local/patients/search",
                Map.of("X-Trace-Id", "trace-local", "X-Request-Id", "req-local"));

        PatientOutpatientResponse response = resource.postPatients(
                request,
                Map.of("keyword", "09012345678", "searchType", "phone"));

        assertEquals(PatientSearchType.TELEPHONE, service.lastSearchType);
        assertEquals("telephone", response.getAuditEvent().getDetails().get("searchType"));
    }

    @Test
    void localSearchDoesNotEchoUnsupportedDetailedFilters() throws Exception {
        CapturingPatientServiceBean service = new CapturingPatientServiceBean();
        LocalPatientSearchResource resource = new LocalPatientSearchResource();
        injectField(resource, "patientServiceBean", service);

        HttpServletRequest request = createRequest(
                "F001:doctor01",
                "/api/local/patients/search",
                Map.of("X-Trace-Id", "trace-local", "X-Request-Id", "req-local"));

        PatientOutpatientResponse response = resource.postPatients(
                request,
                Map.of(
                        "keyword", "山田",
                        "paymentMode", "insurance",
                        "department", "01",
                        "physician", "doctor01"));

        assertEquals(PatientSearchType.NAME, service.lastSearchType);
        assertEquals("name", response.getAuditEvent().getDetails().get("searchType"));
        assertEquals(null, response.getAuditEvent().getDetails().get("paymentMode"));
        assertEquals(null, response.getAuditEvent().getDetails().get("department"));
        assertEquals(null, response.getAuditEvent().getDetails().get("physician"));
    }

    @Test
    void localSearchUsesCurrentOrcaPatientCacheForExactPatientIdMiss() throws Exception {
        EmptyPatientServiceBean service = new EmptyPatientServiceBean();
        LocalPatientSearchResource resource = new LocalPatientSearchResource();
        injectField(resource, "patientServiceBean", service);
        injectField(resource, "patientCacheStore", new StubPatientCacheStore(currentCacheRow("F001", "00001")));

        HttpServletRequest request = createRequest(
                "F001:doctor01",
                "/api/local/patients/search",
                Map.of("X-Trace-Id", "trace-local", "X-Request-Id", "req-local"));

        PatientOutpatientResponse response = resource.postPatients(request, Map.of("keyword", "00001"));

        assertEquals(1, response.getRecordsReturned());
        assertEquals("00001", response.getPatients().get(0).getPatientId());
        assertEquals("Trial Patient", response.getPatients().get(0).getName());
        assertEquals(true, response.isCacheHit());
        assertEquals(true, response.getAuditEvent().getDetails().get("patientCacheFallback"));
        assertEquals("CURRENT", response.getAuditEvent().getDetails().get("patientCacheStatus"));
    }

    @Test
    void localSearchDoesNotUseNotFoundOrcaPatientCache() throws Exception {
        EmptyPatientServiceBean service = new EmptyPatientServiceBean();
        LocalPatientSearchResource resource = new LocalPatientSearchResource();
        injectField(resource, "patientServiceBean", service);
        injectField(resource, "patientCacheStore", new StubPatientCacheStore(cacheRow(
                "F001",
                "00001",
                "NOT_FOUND",
                "ORCA_PATIENT_NOT_FOUND",
                Instant.now().plusSeconds(300))));

        HttpServletRequest request = createRequest(
                "F001:doctor01",
                "/api/local/patients/search",
                Map.of("X-Trace-Id", "trace-local", "X-Request-Id", "req-local"));

        PatientOutpatientResponse response = resource.postPatients(request, Map.of("keyword", "00001"));

        assertEquals(0, response.getRecordsReturned());
        assertEquals(false, response.isCacheHit());
        assertEquals(null, response.getAuditEvent().getDetails().get("patientCacheFallback"));
    }

    private HttpServletRequest createRequest(String remoteUser, String uri, Map<String, String> headers) {
        return (HttpServletRequest) Proxy.newProxyInstance(
                getClass().getClassLoader(),
                new Class[]{HttpServletRequest.class},
                (proxy, method, args) -> {
                    switch (method.getName()) {
                        case "getRemoteUser":
                            return remoteUser;
                        case "getRequestURI":
                            return uri;
                        case "getRemoteAddr":
                            return "127.0.0.1";
                        case "getHeader":
                            if (args != null && args.length == 1) {
                                String key = String.valueOf(args[0]);
                                return headers.get(key);
                            }
                            return null;
                        default:
                            return null;
                    }
                });
    }

    private static void injectField(Object target, String fieldName, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(fieldName);
        field.setAccessible(true);
        field.set(target, value);
    }

    private static final class CapturingPatientServiceBean extends PatientServiceBean {
        private PatientSearchType lastSearchType;

        @Override
        public List<PatientModel> searchPatients(String fid, PatientSearchType searchType, String keyword) {
            this.lastSearchType = searchType;
            PatientModel patient = new PatientModel();
            patient.setFacilityId(fid);
            patient.setPatientId(keyword);
            patient.setFullName("dummy");
            return List.of(patient);
        }
    }

    private static final class EmptyPatientServiceBean extends PatientServiceBean {
        @Override
        public List<PatientModel> searchPatients(String fid, PatientSearchType searchType, String keyword) {
            return List.of();
        }
    }

    private static final class StubPatientCacheStore extends OrcaPatientCacheStore {
        private final PatientCacheRow row;

        private StubPatientCacheStore(PatientCacheRow row) {
            this.row = row;
        }

        @Override
        public PatientCacheRow findLatest(String facilityId, String orcaPatientId) {
            if (row != null && row.facilityId().equals(facilityId) && row.orcaPatientId().equals(orcaPatientId)) {
                return row;
            }
            return null;
        }
    }

    private static OrcaPatientCacheStore.PatientCacheRow currentCacheRow(String facilityId, String patientId) {
        return cacheRow(facilityId, patientId, "CURRENT", "ORCA_PATIENT_FOUND", Instant.now().plusSeconds(300));
    }

    private static OrcaPatientCacheStore.PatientCacheRow cacheRow(
            String facilityId,
            String patientId,
            String cacheStatus,
            String businessStatus,
            Instant cacheExpiresAt) {
        return new OrcaPatientCacheStore.PatientCacheRow(
                1L,
                facilityId,
                patientId,
                null,
                "patientgetv2",
                "req-local",
                "trace-local",
                Instant.now(),
                cacheExpiresAt,
                cacheStatus,
                businessStatus,
                "a".repeat(64),
                """
                        {
                          "sourceSystem": "ORCA",
                          "sourceApi": "patientgetv2",
                          "cacheStatus": "%s",
                          "businessStatus": "%s",
                          "patient": {
                            "patientId": "%s",
                            "wholeName": "Trial Patient",
                            "wholeNameKana": "TRIAL PATIENT",
                            "birthDate": "1980-01-01",
                            "sex": "1",
                            "addressSummary": "not returned by local search fallback",
                            "phoneSummary": "not returned by local search fallback"
                          }
                        }
                        """.formatted(cacheStatus, businessStatus, patientId),
                "{\"rawResponseStored\":false}");
    }
}
