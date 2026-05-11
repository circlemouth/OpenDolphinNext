package open.dolphin.rest.orca;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.WebApplicationException;
import java.lang.reflect.Field;
import java.lang.reflect.Proxy;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import open.dolphin.audit.AuditEventEnvelope;
import open.dolphin.rest.dto.orca.OrcaMedicalCandidateResponse;
import open.dolphin.rest.dto.orca.PrescriptionDrug;
import open.dolphin.rest.dto.orca.PrescriptionOrder;
import open.dolphin.rest.dto.orca.PrescriptionRp;
import open.dolphin.security.audit.AuditEventPayload;
import open.dolphin.security.audit.AuthoritativeAuditRepository;
import open.dolphin.security.audit.SessionAuditDispatcher;
import open.dolphin.testsupport.RuntimeDelegateTestSupport;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class LocalOrcaMedicalCandidateResourceTest extends RuntimeDelegateTestSupport {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper().findAndRegisterModules();
    private static final String CONTENT_HASH = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

    private LocalOrcaMedicalCandidateResource resource;
    private FakeCandidateRepository repository;
    private HttpServletRequest request;

    @BeforeEach
    void setUp() throws Exception {
        resource = new LocalOrcaMedicalCandidateResource();
        repository = new FakeCandidateRepository();
        injectField(resource, "candidateRepository", repository);
        injectField(resource, "authoritativeAuditRepository", new StubAuditRepository(true));
        injectField(resource, "sessionAuditDispatcher", new RecordingSessionAuditDispatcher());
        request = request("/api/local/orca/medical-candidates/from-chart/CHART-REV-001");
    }

    @Test
    void prepareFromChartPersistsNonAuthoritativeReadyCandidate() throws Exception {
        repository.source = new OrcaMedicalCandidateRepository.PrescriptionRevisionRecord(
                101L,
                201L,
                "00001",
                "ENC-001",
                "FINAL",
                CONTENT_HASH,
                OBJECT_MAPPER.writeValueAsString(order("211", "001000", "620000001")));

        OrcaMedicalCandidateResponse response = resource.prepareFromChart(request, "CHART-REV-001");

        assertEquals("READY_TO_SEND", response.getCandidateStatus());
        assertTrue(response.isSendable());
        assertTrue(response.isNonAuthoritative());
        assertEquals(301L, response.getCandidateId());
        assertEquals("00001", response.getPatientId());
        assertEquals(CONTENT_HASH, response.getPrescriptionContentHash());
        assertEquals("CHART-REV-001", repository.chartRevisionId);
        assertEquals("F001", repository.facilityId);
        assertEquals(1, response.getMedicalInformation().get(0).getRpSequence());
        assertEquals("211", response.getMedicalInformation().get(0).getMedicalClass());
        assertEquals("001000", response.getMedicalInformation().get(0).getUsageCode());
        assertEquals("after meal", response.getMedicalInformation().get(0).getUsageName());
        assertEquals(1, response.getMedicalInformation().get(0).getMedications().get(0).getItemSequence());
        assertEquals("620000001", response.getMedicalInformation().get(0).getMedications().get(0).getCode());
    }

    @Test
    void prepareFromChartMarksUnresolvedItemsNeedsReviewAndUnsendable() throws Exception {
        repository.source = new OrcaMedicalCandidateRepository.PrescriptionRevisionRecord(
                101L,
                201L,
                "00001",
                "ENC-001",
                "FINAL",
                CONTENT_HASH,
                OBJECT_MAPPER.writeValueAsString(order("211", null, null)));

        OrcaMedicalCandidateResponse response = resource.prepareFromChart(request, "CHART-REV-001");

        assertEquals("NEEDS_REVIEW", response.getCandidateStatus());
        assertFalse(response.isSendable());
        assertTrue(response.getIssues().stream().anyMatch(issue -> "usage_code_unresolved".equals(issue.getCode())));
        assertTrue(response.getIssues().stream().anyMatch(issue -> "drug_code_unresolved".equals(issue.getCode())));
    }

    @Test
    void prepareFromChartRequiresServerGeneratedPrescriptionContentHash() throws Exception {
        repository.source = new OrcaMedicalCandidateRepository.PrescriptionRevisionRecord(
                101L,
                201L,
                "00001",
                "ENC-001",
                "FINAL",
                null,
                OBJECT_MAPPER.writeValueAsString(order("211", "001000", "620000001")));

        OrcaMedicalCandidateResponse response = resource.prepareFromChart(request, "CHART-REV-001");

        assertEquals("NEEDS_REVIEW", response.getCandidateStatus());
        assertFalse(response.isSendable());
        assertTrue(response.getIssues().stream().anyMatch(issue -> "prescription_content_hash_missing".equals(issue.getCode())));
    }

    @Test
    void prepareFromChartRejectsSummaryContextMismatchBeforePersistingCandidate() throws Exception {
        PrescriptionOrder mismatched = order("211", "001000", "620000001");
        mismatched.setPatientId("OTHER-PATIENT");
        repository.source = new OrcaMedicalCandidateRepository.PrescriptionRevisionRecord(
                101L,
                201L,
                "00001",
                "ENC-001",
                "FINAL",
                CONTENT_HASH,
                OBJECT_MAPPER.writeValueAsString(mismatched));

        WebApplicationException ex = assertThrows(WebApplicationException.class,
                () -> resource.prepareFromChart(request, "CHART-REV-001"));

        assertEquals(409, ex.getResponse().getStatus());
        assertEquals(0, repository.saveCalls);
    }

    @Test
    void prepareFromChartRejectsDraftStoppedAndCancelledPrescriptionSources() throws Exception {
        for (String status : List.of("DRAFT", "STOPPED", "CANCELLED")) {
            repository.source = new OrcaMedicalCandidateRepository.PrescriptionRevisionRecord(
                    101L,
                    201L,
                    "00001",
                    "ENC-001",
                    status,
                    CONTENT_HASH,
                    OBJECT_MAPPER.writeValueAsString(order("211", "001000", "620000001")));

            WebApplicationException ex = assertThrows(WebApplicationException.class,
                    () -> resource.prepareFromChart(request, "CHART-REV-001"));

            assertEquals(409, ex.getResponse().getStatus());
        }
        assertEquals(0, repository.saveCalls);
    }

    @Test
    void prepareFromChartFailsClosedWhenAuditUnavailable() throws Exception {
        injectField(resource, "authoritativeAuditRepository", new StubAuditRepository(false));

        WebApplicationException ex = assertThrows(WebApplicationException.class,
                () -> resource.prepareFromChart(request, "CHART-REV-001"));

        assertEquals(503, ex.getResponse().getStatus());
        assertEquals(0, repository.saveCalls);
    }

    @Test
    void prepareFromChartReturns404WhenPrescriptionSourceMissing() {
        WebApplicationException ex = assertThrows(WebApplicationException.class,
                () -> resource.prepareFromChart(request, "CHART-REV-404"));

        assertEquals(404, ex.getResponse().getStatus());
        assertEquals(0, repository.saveCalls);
    }

    @Test
    void latestFromChartUsesFacilityContextAndReturnsSavedCandidatePreview() {
        repository.latest = new OrcaMedicalCandidateRepository.LatestCandidateRecord(
                301L,
                101L,
                201L,
                "00001",
                "ENC-001",
                "READY_TO_SEND",
                true,
                """
                        {
                          "nonAuthoritative": true,
                          "candidateStatus": "READY_TO_SEND",
                          "sendable": true,
                          "prescriptionContentHash": "%s",
                          "medicalInformation": [
                            {
                              "entity": "medOrder",
                              "rpSequence": 1,
                              "medicalClass": "211",
                              "usageCode": "001000",
                              "medications": [{"itemSequence": 1, "code": "620000001", "number": "1"}]
                            }
                          ]
                        }
                        """.formatted(CONTENT_HASH),
                "[]",
                201L,
                CONTENT_HASH);

        OrcaMedicalCandidateResponse response = resource.latestFromChart(
                request("/api/local/orca/medical-candidates/from-chart/CHART-REV-001/latest"),
                "CHART-REV-001");

        assertEquals(301L, response.getCandidateId());
        assertTrue(response.isSendable());
        assertTrue(response.isNonAuthoritative());
        assertEquals("00001", response.getPatientId());
        assertEquals("ENC-001", response.getEncounterId());
        assertEquals(CONTENT_HASH, response.getPrescriptionContentHash());
        assertEquals("F001", repository.latestFacilityId);
        assertEquals("CHART-REV-001", repository.latestChartRevisionId);
        assertEquals(1, response.getMedicalInformation().get(0).getRpSequence());
        assertEquals("620000001", response.getMedicalInformation().get(0).getMedications().get(0).getCode());
    }

    @Test
    void latestFromChartReturns404WhenCandidateMissing() {
        WebApplicationException ex = assertThrows(WebApplicationException.class,
                () -> resource.latestFromChart(
                        request("/api/local/orca/medical-candidates/from-chart/CHART-REV-404/latest"),
                        "CHART-REV-404"));

        assertEquals(404, ex.getResponse().getStatus());
        assertEquals("F001", repository.latestFacilityId);
        assertEquals("CHART-REV-404", repository.latestChartRevisionId);
    }

    private static PrescriptionOrder order(String medicalClass, String usageCode, String drugCode) {
        PrescriptionDrug drug = new PrescriptionDrug();
        drug.setCode(drugCode);
        drug.setName("Candidate Drug");
        drug.setQuantity("1");
        PrescriptionRp rp = new PrescriptionRp();
        rp.setMedicalClass(medicalClass);
        rp.setMedicalClassNumber("7");
        rp.setBundleName("candidate rp");
        rp.setUsageCode(usageCode);
        rp.setUsageName("after meal");
        rp.setDrugs(List.of(drug));
        PrescriptionOrder order = new PrescriptionOrder();
        order.setPatientId("00001");
        order.setEncounterId("ENC-001");
        order.setEncounterDate(LocalDate.parse("2026-05-10").toString());
        order.setRps(List.of(rp));
        return order;
    }

    private HttpServletRequest request(String uri) {
        Map<String, Object> attributes = new HashMap<>();
        return (HttpServletRequest) Proxy.newProxyInstance(
                getClass().getClassLoader(),
                new Class[]{HttpServletRequest.class},
                (proxy, method, args) -> {
                    String name = method.getName();
                    if ("getRemoteUser".equals(name)) {
                        return "F001:doctor01";
                    }
                    if ("getRemoteAddr".equals(name)) {
                        return "127.0.0.1";
                    }
                    if ("getRequestURI".equals(name)) {
                        return uri;
                    }
                    if ("getAttribute".equals(name) && args != null && args.length == 1) {
                        return attributes.get(args[0]);
                    }
                    if ("setAttribute".equals(name) && args != null && args.length == 2) {
                        attributes.put(String.valueOf(args[0]), args[1]);
                        return null;
                    }
                    if ("getHeader".equals(name) && args != null && args.length == 1) {
                        return switch (String.valueOf(args[0])) {
                            case "X-Run-Id" -> "20260510T220959Z";
                            case "User-Agent" -> "JUnit";
                            default -> null;
                        };
                    }
                    return null;
                });
    }

    private static void injectField(Object target, String fieldName, Object value) throws Exception {
        Class<?> type = target.getClass();
        Field field = null;
        while (type != null && field == null) {
            try {
                field = type.getDeclaredField(fieldName);
            } catch (NoSuchFieldException ignored) {
                type = type.getSuperclass();
            }
        }
        if (field == null) {
            throw new NoSuchFieldException(fieldName);
        }
        field.setAccessible(true);
        field.set(target, value);
    }

    private static final class FakeCandidateRepository extends OrcaMedicalCandidateRepository {
        private PrescriptionRevisionRecord source;
        private int saveCalls;
        private String facilityId;
        private String chartRevisionId;
        private LatestCandidateRecord latest;
        private String latestFacilityId;
        private String latestChartRevisionId;

        @Override
        PrescriptionRevisionRecord findPrescriptionByChartRevision(String facilityId, String chartRevisionId) {
            this.facilityId = facilityId;
            this.chartRevisionId = chartRevisionId;
            return source;
        }

        @Override
        long saveCandidate(String facilityId, String chartRevisionId, PrescriptionRevisionRecord source,
                OrcaMedicalCandidateResponse candidate, String actor, java.time.Instant now) {
            saveCalls += 1;
            this.facilityId = facilityId;
            this.chartRevisionId = chartRevisionId;
            return 301L;
        }

        @Override
        LatestCandidateRecord findLatestCandidateByChartRevision(String facilityId, String chartRevisionId) {
            this.latestFacilityId = facilityId;
            this.latestChartRevisionId = chartRevisionId;
            return latest;
        }
    }

    private static final class RecordingSessionAuditDispatcher extends SessionAuditDispatcher {
        @Override
        public AuditEventEnvelope record(AuditEventPayload payload, AuditEventEnvelope.Outcome overrideOutcome,
                String errorCode, String errorMessage) {
            return null;
        }
    }

    private static final class StubAuditRepository extends AuthoritativeAuditRepository {
        private final boolean available;

        private StubAuditRepository(boolean available) {
            this.available = available;
        }

        @Override
        public boolean isWritePathAvailable() {
            return available;
        }
    }
}
