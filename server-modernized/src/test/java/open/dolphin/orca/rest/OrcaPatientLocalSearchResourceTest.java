package open.dolphin.orca.rest;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import jakarta.servlet.http.HttpServletRequest;
import java.lang.reflect.Field;
import java.lang.reflect.Proxy;
import java.util.List;
import java.util.Map;
import open.dolphin.infomodel.PatientModel;
import open.dolphin.rest.dto.outpatient.PatientOutpatientResponse;
import open.dolphin.session.PatientServiceBean;
import open.dolphin.session.PatientServiceBean.PatientSearchType;
import org.junit.jupiter.api.Test;

class OrcaPatientLocalSearchResourceTest {

    @Test
    void localSearchProvidesRequestMetadata() {
        OrcaPatientLocalSearchResource resource = new OrcaPatientLocalSearchResource();

        HttpServletRequest request = createRequest(
                "F001:doctor01",
                "/api/orca/patients/local-search",
                Map.of("X-Trace-Id", "trace-local", "X-Request-Id", "req-local"));

        PatientOutpatientResponse response = resource.postPatients(request, Map.of("keyword", "test"));

        assertEquals("trace-local", response.getTraceId());
        assertEquals("req-local", response.getRequestId());
        assertEquals("server", response.getDataSource());
        assertEquals("server", response.getDataSourceTransition());
        assertNotNull(response.getFetchedAt());
    }

    @Test
    void localSearchResolvesSearchTypeFromKeyword() throws Exception {
        CapturingPatientServiceBean service = new CapturingPatientServiceBean();
        OrcaPatientLocalSearchResource resource = new OrcaPatientLocalSearchResource();
        injectField(resource, "patientServiceBean", service);

        HttpServletRequest request = createRequest(
                "F001:doctor01",
                "/api/orca/patients/local-search",
                Map.of("X-Trace-Id", "trace-local", "X-Request-Id", "req-local"));

        resource.postPatients(request, Map.of("keyword", "000123"));
        assertEquals(PatientSearchType.PATIENT_ID, service.lastSearchType);

        resource.postPatients(request, Map.of("keyword", "やまだ"));
        assertEquals(PatientSearchType.KANA, service.lastSearchType);

        PatientOutpatientResponse response = resource.postPatients(request, Map.of("keyword", "山田"));
        assertEquals(PatientSearchType.NAME, service.lastSearchType);
        assertEquals("name", response.getAuditEvent().getDetails().get("searchType"));
    }

    @Test
    void localSearchHonorsExplicitSearchType() throws Exception {
        CapturingPatientServiceBean service = new CapturingPatientServiceBean();
        OrcaPatientLocalSearchResource resource = new OrcaPatientLocalSearchResource();
        injectField(resource, "patientServiceBean", service);

        HttpServletRequest request = createRequest(
                "F001:doctor01",
                "/api/orca/patients/local-search",
                Map.of("X-Trace-Id", "trace-local", "X-Request-Id", "req-local"));

        PatientOutpatientResponse response = resource.postPatients(
                request,
                Map.of("keyword", "09012345678", "searchType", "phone"));

        assertEquals(PatientSearchType.TELEPHONE, service.lastSearchType);
        assertEquals("telephone", response.getAuditEvent().getDetails().get("searchType"));
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
}
