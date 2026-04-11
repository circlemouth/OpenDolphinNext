package open.dolphin.rest.orca;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.WebApplicationException;
import java.lang.reflect.Field;
import java.lang.reflect.Proxy;
import java.time.Instant;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import open.dolphin.audit.AuditEventEnvelope;
import open.dolphin.infomodel.PatientModel;
import open.dolphin.rest.dto.orca.PrescriptionClaimComment;
import open.dolphin.rest.dto.orca.PrescriptionDrug;
import open.dolphin.rest.dto.orca.PrescriptionOrder;
import open.dolphin.rest.dto.orca.PrescriptionOrderFetchResponse;
import open.dolphin.rest.dto.orca.PrescriptionOrderSaveResponse;
import open.dolphin.rest.dto.orca.PrescriptionRp;
import open.dolphin.security.audit.AuditEventPayload;
import open.dolphin.security.audit.SessionAuditDispatcher;
import open.dolphin.session.PatientServiceBean;
import open.dolphin.testsupport.RuntimeDelegateTestSupport;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class OrcaPrescriptionOrderResourceTest extends RuntimeDelegateTestSupport {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper().findAndRegisterModules();

    private OrcaPrescriptionOrderResource resource;
    private FakePrescriptionOrderRepository fakeRepository;
    private HttpServletRequest servletRequest;

    @BeforeEach
    void setUp() throws Exception {
        resource = new OrcaPrescriptionOrderResource();
        fakeRepository = new FakePrescriptionOrderRepository();

        injectField(resource, "sessionAuditDispatcher", new RecordingSessionAuditDispatcher());
        injectField(resource, "patientServiceBean", new FakePatientServiceBean());
        injectField(resource, "prescriptionOrderRepository", fakeRepository);

        Map<String, Object> attributes = new HashMap<>();
        servletRequest = (HttpServletRequest) Proxy.newProxyInstance(
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
                        return "/api/local/prescription-orders";
                    }
                    if ("getAttribute".equals(name) && args != null && args.length == 1) {
                        return attributes.get(args[0]);
                    }
                    if ("setAttribute".equals(name) && args != null && args.length == 2) {
                        attributes.put(String.valueOf(args[0]), args[1]);
                        return null;
                    }
                    if ("removeAttribute".equals(name) && args != null && args.length == 1) {
                        attributes.remove(String.valueOf(args[0]));
                        return null;
                    }
                    if ("getHeader".equals(name) && args != null && args.length == 1) {
                        String header = String.valueOf(args[0]);
                        return switch (header) {
                            case "X-Request-Id" -> "req-rx-save";
                            case "X-Trace-Id" -> "trace-rx-save";
                            case "X-Run-Id" -> "20260403T000000Z";
                            case "User-Agent" -> "JUnit";
                            default -> null;
                        };
                    }
                    return null;
                });
    }

    @Test
    void saveOrderReturns400WhenDrugClaimCommentCodeIsMissing() {
        PrescriptionOrder payload = buildPayload();
        payload.getRps().get(0).getDrugs().get(0).setClaimComments(List.of(claimComment(null, "drug comment", "note")));

        WebApplicationException ex = assertThrows(WebApplicationException.class,
                () -> resource.saveOrder(servletRequest, payload));

        assertValidationError(ex, "rps[0].drugs[0].claimComments[0].code");
        assertEquals(0, fakeRepository.saveCalls);
    }

    @Test
    void saveOrderReturns400WhenRpClaimCommentCodeIsMissing() {
        PrescriptionOrder payload = buildPayload();
        payload.getRps().get(0).setClaimComments(List.of(claimComment(null, "rp comment", "rp-note")));

        WebApplicationException ex = assertThrows(WebApplicationException.class,
                () -> resource.saveOrder(servletRequest, payload));

        assertValidationError(ex, "rps[0].claimComments[0].code");
        assertEquals(0, fakeRepository.saveCalls);
    }

    @Test
    void saveOrderAllowsMissingUsageCode() {
        PrescriptionOrder payload = buildPayload();
        payload.getRps().get(0).setUsageCode(null);

        PrescriptionOrderSaveResponse response = resource.saveOrder(servletRequest, payload);

        assertNotNull(response);
        assertEquals("00", response.getApiResult());
        assertEquals(1, fakeRepository.saveCalls);
        assertTrue(fakeRepository.savedPayloadJson.contains("\"usageName\":\"after meal\""));
        assertFalse(fakeRepository.savedPayloadJson.contains("\"usageCode\":\"001000\""));
    }

    @Test
    void saveOrderReturns400WhenStructuredClaimCommentNoteIsMissing() {
        PrescriptionOrder payload = buildPayload();
        payload.getRps().get(0).setClaimComments(List.of(claimComment("850100001", "special comment", null)));

        WebApplicationException ex = assertThrows(WebApplicationException.class,
                () -> resource.saveOrder(servletRequest, payload));

        assertValidationError(ex, "rps[0].claimComments[0].note");
        assertEquals(0, fakeRepository.saveCalls);
    }

    @Test
    void saveOrderReturns400WhenStructuredClaimCommentNoteFormatIsInvalid() {
        PrescriptionOrder payload = buildPayload();
        payload.getRps().get(0).setClaimComments(List.of(claimComment("842000001", "numeric comment", "abc")));

        WebApplicationException ex = assertThrows(WebApplicationException.class,
                () -> resource.saveOrder(servletRequest, payload));

        assertValidationError(ex, "rps[0].claimComments[0].note");
        assertEquals(0, fakeRepository.saveCalls);
    }

    @Test
    void saveOrderReturns400WhenUnknownStructuredClaimCommentFamilyIsProvided() {
        PrescriptionOrder payload = buildPayload();
        payload.getRps().get(0).setClaimComments(List.of(claimComment("850000001", "unknown family", "note")));

        WebApplicationException ex = assertThrows(WebApplicationException.class,
                () -> resource.saveOrder(servletRequest, payload));

        assertValidationError(ex, "rps[0].claimComments[0].code");
        assertEquals(0, fakeRepository.saveCalls);
    }

    @Test
    void saveOrderNormalizesStructuredClaimCommentNotesBeforePersisting() throws Exception {
        PrescriptionOrder payload = buildPayload();
        payload.getRps().get(0).setClaimComments(List.of(
                claimComment("830000001", "free text", "  補足メモ  "),
                claimComment("842000001", "numeric", "1.5"),
                claimComment("831000001", "management", "123456789")));
        payload.getRps().get(0).getDrugs().get(0).setClaimComments(List.of(
                claimComment("850100001", "date", "2026/4/9"),
                claimComment("851100001", "month-day", "4/9"),
                claimComment("852100001", "integer", "12")));

        PrescriptionOrderSaveResponse response = resource.saveOrder(servletRequest, payload);

        assertNotNull(response);
        PrescriptionOrder saved = OBJECT_MAPPER.readValue(fakeRepository.savedPayloadJson, PrescriptionOrder.class);
        assertEquals("補足メモ", saved.getRps().get(0).getClaimComments().get(0).getNote());
        assertEquals("1.5", saved.getRps().get(0).getClaimComments().get(1).getNote());
        assertEquals("123456789", saved.getRps().get(0).getClaimComments().get(2).getNote());
        assertEquals("2026-04-09", saved.getRps().get(0).getDrugs().get(0).getClaimComments().get(0).getNote());
        assertEquals("04-09", saved.getRps().get(0).getDrugs().get(0).getClaimComments().get(1).getNote());
        assertEquals("12", saved.getRps().get(0).getDrugs().get(0).getClaimComments().get(2).getNote());
    }

    @Test
    void saveOrderPersistsEncounterScopedPayload() {
        PrescriptionOrder payload = buildPayload();

        PrescriptionOrderSaveResponse response = resource.saveOrder(servletRequest, payload);

        assertNotNull(response);
        assertEquals("00", response.getApiResult());
        assertEquals(1, fakeRepository.saveCalls);
        assertEquals(101L, response.getOrderId());
        assertEquals("00001", response.getPatientId());
        assertEquals("F001:E100", response.getEncounterId());
        assertEquals("F001:E100", fakeRepository.savedEncounterId);
        assertEquals(LocalDate.parse("2026-04-03"), fakeRepository.savedEncounterDate);
        assertNotNull(fakeRepository.savedPayloadJson);
        assertTrue(fakeRepository.savedPayloadJson.contains("\"numberCode\":\"001\""));
        assertTrue(fakeRepository.savedPayloadJson.contains("\"lowerUsageCode\":\"L-USAGE\""));
        assertTrue(fakeRepository.savedPayloadJson.contains("\"lowerClaimCode\":\"L-CLAIM\""));
        assertTrue(fakeRepository.savedPayloadJson.contains("\"lowerDrugCode\":\"L-DRUG\""));
    }

    @Test
    void getLatestOrderUsesEncounterIdToAvoidSameDayMixup() throws Exception {
        PrescriptionOrder encounterA = buildPayload();
        encounterA.setEncounterId("F001:E100");
        PrescriptionOrder encounterB = buildPayload();
        encounterB.setEncounterId("F001:E200");
        encounterB.getRps().get(0).setRpNumber("rp-enc-200");

        fakeRepository.addStoredOrder(encounterA);
        fakeRepository.addStoredOrder(encounterB);

        PrescriptionOrderFetchResponse response = resource.getLatestOrder(
                servletRequest,
                "00001",
                "F001:E200",
                "2026-04-03");

        assertTrue(response.isFound());
        assertEquals("F001:E200", response.getEncounterId());
        assertEquals("F001:E200", response.getOrder().getEncounterId());
        assertEquals("rp-enc-200", response.getOrder().getRps().get(0).getRpNumber());
        assertEquals("F001:E200", fakeRepository.lastFindEncounterId);
        assertEquals(LocalDate.parse("2026-04-03"), fakeRepository.lastFindEncounterDate);
        assertFalse("F001:E100".equals(response.getOrder().getEncounterId()));
    }

    private static PrescriptionOrder buildPayload() {
        PrescriptionDrug drug = new PrescriptionDrug();
        drug.setCode("620000001");
        drug.setName("Amlodipine");
        drug.setQuantity("1");
        drug.setUnit("tab");
        drug.setNumberCode("001");
        drug.setNumberCodeSystem("urn:orca:number");
        drug.setNumberCodeName("number-name");
        drug.setGenericChangeAllowed(Boolean.TRUE);
        drug.setGeneralNamePrescription(Boolean.FALSE);
        drug.setDrugComment("after meal");
        drug.setPatientRequested(Boolean.TRUE);
        drug.setLowerUsageCode("L-USAGE");
        drug.setClaimComments(List.of(claimComment("810000001", "drug comment", "note")));

        PrescriptionRp rp = new PrescriptionRp();
        rp.setRpNumber("rp-1");
        rp.setBundleName("Prescription RP");
        rp.setMedicalClass("212");
        rp.setMedicalClassNumber("1");
        rp.setUsageCode("001000");
        rp.setUsageName("after meal");
        rp.setStarted("2026-04-03");
        rp.setLowerDrugCode("L-DRUG");
        rp.setDrugs(List.of(drug));

        PrescriptionOrder payload = new PrescriptionOrder();
        payload.setPatientId("00001");
        payload.setEncounterId("F001:E100");
        payload.setEncounterDate("2026-04-03");
        payload.setPerformDate("2026-04-03");
        payload.setRps(List.of(rp));
        return payload;
    }

    private static PrescriptionClaimComment claimComment(String code, String text, String note) {
        PrescriptionClaimComment claimComment = new PrescriptionClaimComment();
        claimComment.setCode(code);
        claimComment.setText(text);
        claimComment.setNote(note);
        claimComment.setLowerClaimCode("L-CLAIM");
        return claimComment;
    }

    @SuppressWarnings("unchecked")
    private static void assertValidationError(WebApplicationException ex, String field) {
        assertNotNull(ex);
        assertEquals(400, ex.getResponse().getStatus());
        Map<String, Object> body = (Map<String, Object>) ex.getResponse().getEntity();
        assertNotNull(body);
        assertEquals("invalid_request", body.get("error"));
        assertEquals(field, body.get("field"));
        assertEquals(Boolean.TRUE, body.get("validationError"));
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

    private static final class RecordingSessionAuditDispatcher extends SessionAuditDispatcher {
        @Override
        public AuditEventEnvelope record(AuditEventPayload payload, AuditEventEnvelope.Outcome overrideOutcome,
                String errorCode, String errorMessage) {
            return null;
        }
    }

    private static final class FakePatientServiceBean extends PatientServiceBean {
        @Override
        public PatientModel getPatientById(String fid, String pid) {
            PatientModel patient = new PatientModel();
            patient.setId(100L);
            patient.setFacilityId(fid);
            patient.setPatientId(pid);
            patient.setFullName("Test Patient");
            patient.setKanaName("Test Kana");
            patient.setBirthday(LocalDate.parse("1990-01-01"));
            return patient;
        }
    }

    private static final class FakePrescriptionOrderRepository extends PrescriptionOrderRepository {
        private int saveCalls;
        private String savedEncounterId;
        private LocalDate savedEncounterDate;
        private String savedPayloadJson;
        private String lastFindEncounterId;
        private LocalDate lastFindEncounterDate;
        private final Map<String, StoredPrescriptionOrder> storedOrdersByEncounterId = new HashMap<>();

        @Override
        long save(String facilityId, String patientId, String encounterId, LocalDate encounterDate, LocalDate performDate,
                String payloadJson, Instant createdAt, String createdBy) {
            saveCalls += 1;
            savedEncounterId = encounterId;
            savedEncounterDate = encounterDate;
            savedPayloadJson = payloadJson;
            return 101L;
        }

        @Override
        Optional<StoredPrescriptionOrder> findLatest(String facilityId, String patientId, String encounterId,
                LocalDate encounterDate) {
            lastFindEncounterId = encounterId;
            lastFindEncounterDate = encounterDate;
            if (encounterId == null) {
                return storedOrdersByEncounterId.values().stream().findFirst();
            }
            return Optional.ofNullable(storedOrdersByEncounterId.get(encounterId));
        }

        void addStoredOrder(PrescriptionOrder order) throws Exception {
            String encounterId = order.getEncounterId();
            storedOrdersByEncounterId.put(
                    encounterId,
                    new StoredPrescriptionOrder(
                            storedOrdersByEncounterId.size() + 1L,
                            OBJECT_MAPPER.writeValueAsString(order),
                            encounterId,
                            LocalDate.parse(order.getEncounterDate()),
                            LocalDate.parse(order.getPerformDate()),
                            Instant.parse("2026-04-03T00:00:00Z")));
        }
    }
}
